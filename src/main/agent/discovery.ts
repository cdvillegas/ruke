import OpenAI from 'openai';
import { nanoid } from 'nanoid';
import yaml from 'js-yaml';
import { DISCOVERY_PROMPT } from '../ai/prompts';
import type { ApiEndpoint, DiscoveryResult, HttpMethod } from '../../shared/types';

function parseSpec(text: string): any {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed);
  }
  return yaml.load(trimmed);
}

function extractEndpoints(spec: any): ApiEndpoint[] {
  const endpoints: ApiEndpoint[] = [];
  const paths = spec.paths || {};

  for (const [path, methods] of Object.entries(paths) as [string, any][]) {
    for (const [method, details] of Object.entries(methods) as [string, any][]) {
      if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)) {
        const params = (details.parameters || []).map((p: any) => ({
          name: p.name,
          in: p.in,
          required: p.required || false,
          type: p.schema?.type || p.type || 'string',
          description: p.description,
        }));

        let requestBody: ApiEndpoint['requestBody'] | undefined;
        if (details.requestBody?.content?.['application/json']) {
          const schema = details.requestBody.content['application/json'].schema;
          requestBody = {
            type: 'json',
            schema: JSON.stringify(schema, null, 2),
            example: details.requestBody.content['application/json'].example
              ? JSON.stringify(details.requestBody.content['application/json'].example, null, 2)
              : undefined,
          };
        }

        endpoints.push({
          id: nanoid(),
          connectionId: '',
          method: method.toUpperCase() as HttpMethod,
          path,
          summary: details.summary || `${method.toUpperCase()} ${path}`,
          description: details.description,
          parameters: params.length > 0 ? params : undefined,
          requestBody,
          tags: details.tags,
        });
      }
    }
  }
  return endpoints;
}

const SPEC_URL_SUFFIXES = [
  '/openapi.json',
  '/openapi.yaml',
  '/swagger.json',
  '/swagger/v1/swagger.json',
  '/api-docs',
  '/v1/openapi.json',
  '/v2/openapi.json',
  '/docs/openapi.json',
];

async function tryFetchSpec(baseUrl: string): Promise<{ spec: any; url: string } | null> {
  for (const suffix of SPEC_URL_SUFFIXES) {
    try {
      const url = baseUrl.replace(/\/+$/, '') + suffix;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const text = await res.text();
      const spec = parseSpec(text);
      if (spec?.openapi || spec?.swagger || spec?.paths) {
        return { spec, url };
      }
    } catch {}
  }
  return null;
}

interface AiSuggestion {
  name: string;
  description: string;
  specUrl?: string;
  docsUrl?: string;
  baseUrl?: string;
  type?: 'openapi' | 'graphql';
}

export class DiscoveryAgent {
  private client: OpenAI | null = null;

  setClient(client: OpenAI | null) {
    this.client = client;
  }

  async discover(query: string): Promise<DiscoveryResult[]> {
    if (!this.client) {
      return [{ name: 'Error', description: 'No API key configured.', baseUrl: '', specType: 'openapi', endpointCount: 0, endpoints: [], error: 'No API key' }];
    }

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
      try {
        const res = await fetch(suggestion.specUrl, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          const text = await res.text();
          const spec = parseSpec(text);
          if (spec?.openapi || spec?.swagger || spec?.paths) {
            return this.buildFromSpec(spec, suggestion, suggestion.specUrl);
          }
        }
      } catch {}
    }

    if (suggestion.baseUrl) {
      const found = await tryFetchSpec(suggestion.baseUrl);
      if (found) {
        return this.buildFromSpec(found.spec, suggestion, found.url);
      }
    }

    if (suggestion.docsUrl) {
      const found = await tryFetchSpec(suggestion.docsUrl);
      if (found) {
        return this.buildFromSpec(found.spec, suggestion, found.url);
      }
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

  private buildFromSpec(spec: any, suggestion: AiSuggestion, specUrl: string): DiscoveryResult {
    const endpoints = extractEndpoints(spec);
    let baseUrl = suggestion.baseUrl || '';
    if (!baseUrl && spec.servers?.[0]?.url) baseUrl = spec.servers[0].url;
    if (!baseUrl && spec.host) {
      const scheme = spec.schemes?.[0] || 'https';
      baseUrl = `${scheme}://${spec.host}${spec.basePath || ''}`;
    }

    return {
      name: suggestion.name || spec.info?.title || 'API',
      description: suggestion.description || spec.info?.description || '',
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
