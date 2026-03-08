import OpenAI from 'openai';
import { DISCOVERY_PROMPT } from '../ai/prompts';
import { nanoid } from 'nanoid';
import type { ApiEndpoint, DiscoveryResult } from '@shared/types';
import bundledRegistryData from './registry.json';
import { parseSpec, parseOpenApiEndpoints, getSpecBaseUrl } from '@shared/specParser';

// ---------------------------------------------------------------------------
// Spec probing (try common paths on a base URL)
// ---------------------------------------------------------------------------

const SPEC_URL_SUFFIXES = [
  '/openapi.json', '/openapi.yaml', '/swagger.json',
  '/swagger/v1/swagger.json', '/api-docs',
  '/v1/openapi.json', '/v2/openapi.json', '/docs/openapi.json',
];

async function probeSpec(baseUrl: string): Promise<{ spec: any; url: string } | null> {
  const base = baseUrl.replace(/\/+$/, '');
  for (const suffix of SPEC_URL_SUFFIXES) {
    try {
      const url = base + suffix;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const text = await res.text();
      const spec = parseSpec(text);
      if (spec?.openapi || spec?.swagger || spec?.paths) return { spec, url };
    } catch {}
  }
  return null;
}

async function fetchAndParseSpec(specUrl: string): Promise<{ spec: any; url: string } | null> {
  try {
    const res = await fetch(specUrl, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) {
      console.warn(`[discovery] spec fetch failed: ${res.status} ${specUrl}`);
      return null;
    }
    const text = await res.text();
    const spec = parseSpec(text);
    if (spec?.openapi || spec?.swagger || spec?.paths) return { spec, url: specUrl };
    console.warn(`[discovery] fetched but not a valid spec: ${specUrl}`);
  } catch (e: any) {
    console.warn(`[discovery] spec fetch error for ${specUrl}:`, e.message || e);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Registry types & loading
// ---------------------------------------------------------------------------

interface RegistryEntry {
  name: string;
  description: string;
  baseUrl: string;
  specUrl?: string;
  type: 'openapi' | 'graphql';
  aliases: string[];
  auth?: string;
}

type Registry = Record<string, RegistryEntry>;

// ---------------------------------------------------------------------------
// TTL cache helper
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function isFresh<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
  return !!entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

// ---------------------------------------------------------------------------
// Fuzzy matching
// ---------------------------------------------------------------------------

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function fuzzyMatch(query: string, candidates: string[]): boolean {
  const q = normalize(query);
  return candidates.some(c => {
    const n = normalize(c);
    return n === q || n.includes(q) || q.includes(n);
  });
}

function fuzzyMatchRegistry(query: string, registry: Registry): RegistryEntry | null {
  const q = normalize(query);

  // Exact key match
  for (const [key, entry] of Object.entries(registry)) {
    if (normalize(key) === q) return entry;
  }

  // Alias match
  for (const entry of Object.values(registry)) {
    if (fuzzyMatch(query, entry.aliases)) return entry;
  }

  // Partial match on name
  for (const entry of Object.values(registry)) {
    if (normalize(entry.name).includes(q) || q.includes(normalize(entry.name))) return entry;
  }

  return null;
}

function fuzzyMatchProvider(query: string, providers: string[]): string | null {
  const q = normalize(query);

  // Exact domain match (e.g. "openai.com")
  const exact = providers.find(p => normalize(p) === q);
  if (exact) return exact;

  // Prefix match (e.g. "openai" matches "openai.com")
  const prefix = providers.find(p => normalize(p).startsWith(q));
  if (prefix) return prefix;

  // Contains match
  const contains = providers.find(p => normalize(p).includes(q) || q.includes(normalize(p).replace(/\.com$|\.io$|\.org$/, '')));
  if (contains) return contains;

  return null;
}

// ---------------------------------------------------------------------------
// LLM suggestion types
// ---------------------------------------------------------------------------

interface AiSuggestion {
  name: string;
  description: string;
  specUrl?: string;
  docsUrl?: string;
  baseUrl?: string;
  type?: 'openapi' | 'graphql';
}

// ---------------------------------------------------------------------------
// Discovery Agent
// ---------------------------------------------------------------------------

export class DiscoveryAgent {
  private client: OpenAI | null = null;
  private registryCache: CacheEntry<Registry> | null = null;
  private apisGuruProvidersCache: CacheEntry<string[]> | null = null;

  setClient(client: OpenAI | null) {
    this.client = client;
  }

  // -------------------------------------------------------------------------
  // Main entry point — three-tier discovery
  // -------------------------------------------------------------------------

  async discover(query: string): Promise<DiscoveryResult[]> {
    // Tier 1: Registry lookup (no AI key needed)
    const registryResult = await this.matchRegistry(query);
    if (registryResult && registryResult.endpointCount > 0) {
      return [registryResult];
    }

    // Tier 2: APIs.guru lookup (no AI key needed)
    const apisGuruResult = await this.matchApisGuru(query);
    if (apisGuruResult && apisGuruResult.endpointCount > 0) {
      return [apisGuruResult];
    }

    // Tier 3: LLM suggestion + fetch verification
    if (!this.client) {
      // Return whatever we got from earlier tiers, or an error
      if (registryResult) return [registryResult];
      return [{
        name: query,
        description: '',
        baseUrl: '',
        specType: 'openapi',
        endpointCount: 0,
        endpoints: [],
        error: 'No API key configured and API not found in registry.',
      }];
    }

    const llmResults = await this.discoverViaLLM(query);
    if (llmResults.length > 0) return llmResults;

    // Nothing worked
    if (registryResult) return [registryResult];
    return [{
      name: query,
      description: '',
      baseUrl: '',
      specType: 'openapi',
      endpointCount: 0,
      endpoints: [],
      error: 'Could not find a machine-readable spec. You can add this API manually.',
    }];
  }

  // -------------------------------------------------------------------------
  // Tier 1: Registry
  // -------------------------------------------------------------------------

  private async matchRegistry(query: string): Promise<DiscoveryResult | null> {
    const registry = await this.getRegistry();
    const entry = fuzzyMatchRegistry(query, registry);
    if (!entry) return null;

    if (entry.specUrl) {
      const fetched = await fetchAndParseSpec(entry.specUrl);
      if (fetched) {
        return this.buildResult(fetched.spec, {
          name: entry.name,
          description: entry.description,
          baseUrl: entry.baseUrl,
        }, fetched.url);
      }
    }

    // specUrl failed or not present — try probing baseUrl
    if (entry.baseUrl) {
      const probed = await probeSpec(entry.baseUrl);
      if (probed) {
        return this.buildResult(probed.spec, {
          name: entry.name,
          description: entry.description,
          baseUrl: entry.baseUrl,
        }, probed.url);
      }
    }

    // Return entry info with 0 endpoints (still useful as a named connection)
    return {
      name: entry.name,
      description: entry.description,
      baseUrl: entry.baseUrl,
      specType: entry.type === 'graphql' ? 'graphql' : 'openapi',
      endpointCount: 0,
      endpoints: [],
    };
  }

  private async getRegistry(): Promise<Registry> {
    if (isFresh(this.registryCache)) return this.registryCache.data;

    // Try fetching latest from remote registry repo
    try {
      const res = await fetch(
        'https://raw.githubusercontent.com/rukeapp/registry/main/registry.json',
        { signal: AbortSignal.timeout(5000) },
      );
      if (res.ok) {
        const data: Registry = await res.json();
        this.registryCache = { data, fetchedAt: Date.now() };
        return data;
      }
    } catch {}

    // Fall back to bundled registry (imported at build time)
    const data = bundledRegistryData as unknown as Registry;
    this.registryCache = { data, fetchedAt: Date.now() };
    return data;
  }

  // -------------------------------------------------------------------------
  // Tier 2: APIs.guru
  // -------------------------------------------------------------------------

  private async matchApisGuru(query: string): Promise<DiscoveryResult | null> {
    const providers = await this.getApisGuruProviders();
    const matched = fuzzyMatchProvider(query, providers);
    if (!matched) return null;

    try {
      const res = await fetch(
        `https://api.apis.guru/v2/${encodeURIComponent(matched)}.json`,
        { signal: AbortSignal.timeout(10000) },
      );
      if (!res.ok) return null;
      const data = await res.json();

      const apis = data.apis || {};
      const apiKeys = Object.keys(apis);
      if (apiKeys.length === 0) return null;

      // Pick the first API entry (usually the main one)
      const apiEntry = apis[apiKeys[0]];
      const specUrl = apiEntry.swaggerUrl || apiEntry.swaggerYamlUrl;
      if (!specUrl) return null;

      const fetched = await fetchAndParseSpec(specUrl);
      if (!fetched) return null;

      const info = apiEntry.info || {};
      return this.buildResult(fetched.spec, {
        name: info.title || matched,
        description: info.description || '',
        baseUrl: '',
      }, fetched.url);
    } catch {}

    return null;
  }

  private async getApisGuruProviders(): Promise<string[]> {
    if (isFresh(this.apisGuruProvidersCache)) return this.apisGuruProvidersCache.data;

    try {
      const res = await fetch(
        'https://api.apis.guru/v2/providers.json',
        { signal: AbortSignal.timeout(8000) },
      );
      if (res.ok) {
        const json = await res.json();
        const data: string[] = json.data || [];
        this.apisGuruProvidersCache = { data, fetchedAt: Date.now() };
        return data;
      }
    } catch {}

    return [];
  }

  // -------------------------------------------------------------------------
  // Tier 3: LLM + fetch verification
  // -------------------------------------------------------------------------

  private async discoverViaLLM(query: string): Promise<DiscoveryResult[]> {
    const suggestions = await this.getSuggestions(query);
    const results: DiscoveryResult[] = [];

    for (const suggestion of suggestions) {
      try {
        const result = await this.resolveSuggestion(suggestion);
        if (result) results.push(result);
      } catch (e: any) {
        results.push({
          name: suggestion.name,
          description: suggestion.description,
          baseUrl: suggestion.baseUrl || suggestion.docsUrl || '',
          specType: 'openapi',
          endpointCount: 0,
          endpoints: [],
          error: e.message || 'Failed to fetch spec',
        });
      }
    }

    return results;
  }

  private async getSuggestions(query: string): Promise<AiSuggestion[]> {
    try {
      const response = await this.client!.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: DISCOVERY_PROMPT },
          { role: 'user', content: query },
        ],
        temperature: 0.2,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || '';
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      return JSON.parse(jsonMatch[0]);
    } catch {
      return [];
    }
  }

  private async resolveSuggestion(suggestion: AiSuggestion): Promise<DiscoveryResult | null> {
    if (suggestion.type === 'graphql' && suggestion.baseUrl) {
      return this.resolveGraphQL(suggestion);
    }

    if (suggestion.specUrl) {
      const fetched = await fetchAndParseSpec(suggestion.specUrl);
      if (fetched) return this.buildResult(fetched.spec, suggestion, fetched.url);
    }

    if (suggestion.baseUrl) {
      const found = await probeSpec(suggestion.baseUrl);
      if (found) return this.buildResult(found.spec, suggestion, found.url);
    }

    if (suggestion.docsUrl) {
      const found = await probeSpec(suggestion.docsUrl);
      if (found) return this.buildResult(found.spec, suggestion, found.url);
    }

    return {
      name: suggestion.name,
      description: suggestion.description,
      baseUrl: suggestion.baseUrl || suggestion.docsUrl || '',
      specType: 'openapi',
      endpointCount: 0,
      endpoints: [],
      error: 'Could not find a machine-readable spec. You can add this API manually.',
    };
  }

  // -------------------------------------------------------------------------
  // Shared helpers
  // -------------------------------------------------------------------------

  private buildResult(
    spec: any,
    meta: { name?: string; description?: string; baseUrl?: string },
    specUrl: string,
  ): DiscoveryResult {
    const endpoints = parseOpenApiEndpoints(spec);
    const baseUrl = meta.baseUrl || getSpecBaseUrl(spec);

    return {
      name: meta.name || spec.info?.title || 'API',
      description: meta.description || spec.info?.description || '',
      baseUrl,
      specUrl,
      specType: 'openapi',
      endpointCount: endpoints.length,
      endpoints,
    };
  }

  private async resolveGraphQL(suggestion: AiSuggestion): Promise<DiscoveryResult> {
    const url = suggestion.baseUrl!;
    const introspectionQuery = `{ __schema { queryType { name } mutationType { name } types { name kind fields { name args { name type { name kind ofType { name } } } } } } }`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: introspectionQuery }),
        signal: AbortSignal.timeout(10000),
      });
      const json = await res.json();
      const schema = json.data?.__schema;
      if (!schema) throw new Error('Introspection returned no schema');

      const endpoints: ApiEndpoint[] = [];
      const queryTypeName = schema.queryType?.name || 'Query';
      const mutationTypeName = schema.mutationType?.name || 'Mutation';

      for (const type of schema.types || []) {
        if (type.name.startsWith('__') || !type.fields) continue;
        const isQuery = type.name === queryTypeName;
        const isMutation = type.name === mutationTypeName;
        if (!isQuery && !isMutation) continue;

        for (const field of type.fields) {
          endpoints.push({
            id: nanoid(),
            connectionId: '',
            method: 'POST',
            path: field.name,
            summary: `${isQuery ? 'Query' : 'Mutation'}: ${field.name}`,
            tags: [isQuery ? 'Queries' : 'Mutations'],
            parameters: (field.args || []).map((a: any) => ({
              name: a.name,
              in: 'query' as const,
              required: false,
              type: a.type?.name || a.type?.ofType?.name || 'unknown',
            })),
          });
        }
      }

      return {
        name: suggestion.name,
        description: suggestion.description,
        baseUrl: url,
        specType: 'graphql',
        endpointCount: endpoints.length,
        endpoints,
      };
    } catch (e: any) {
      return {
        name: suggestion.name,
        description: suggestion.description,
        baseUrl: url,
        specType: 'graphql',
        endpointCount: 0,
        endpoints: [],
        error: e.message || 'GraphQL introspection failed',
      };
    }
  }
}
