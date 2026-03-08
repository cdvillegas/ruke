import type { ApiResponse, DiscoveryResult } from '@shared/types';
import registryData from '../../main/agent/registry.json';
import { parseSpec, parseOpenApiEndpoints, getSpecBaseUrl } from '@shared/specParser';
import { SYSTEM_PROMPT } from '../../main/ai/prompts';

const isElectron = typeof window !== 'undefined' && !!(window as any).ruke;

// ---------------------------------------------------------------------------
// Registry-based discovery helpers (mirrors main process logic for web mode)
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

const bundledRegistry: Registry = registryData as unknown as Registry;

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function fuzzyMatchRegistry(query: string, registry: Registry): RegistryEntry | null {
  const q = normalize(query);
  for (const [key, entry] of Object.entries(registry)) {
    if (normalize(key) === q) return entry;
  }
  for (const entry of Object.values(registry)) {
    const matches = entry.aliases.some(a => {
      const n = normalize(a);
      return n === q || n.includes(q) || q.includes(n);
    });
    if (matches) return entry;
  }
  for (const entry of Object.values(registry)) {
    if (normalize(entry.name).includes(q) || q.includes(normalize(entry.name))) return entry;
  }
  return null;
}

async function fetchAndParseSpecWeb(specUrl: string): Promise<{ spec: any; url: string } | null> {
  try {
    const res = await fetch(specUrl, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) return null;
    const text = await res.text();
    const spec = parseSpec(text);
    if (spec?.openapi || spec?.swagger || spec?.paths) return { spec, url: specUrl };
  } catch {}
  return null;
}

function buildDiscoveryResult(
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

async function discoverFromRegistry(query: string): Promise<DiscoveryResult | null> {
  const entry = fuzzyMatchRegistry(query, bundledRegistry);
  if (!entry) return null;

  if (entry.specUrl) {
    const fetched = await fetchAndParseSpecWeb(entry.specUrl);
    if (fetched) {
      return buildDiscoveryResult(fetched.spec, {
        name: entry.name,
        description: entry.description,
        baseUrl: entry.baseUrl,
      }, fetched.url);
    }
  }
  return {
    name: entry.name,
    description: entry.description,
    baseUrl: entry.baseUrl,
    specType: entry.type === 'graphql' ? 'graphql' : 'openapi',
    endpointCount: 0,
    endpoints: [],
  };
}

async function discoverFromApisGuru(query: string): Promise<DiscoveryResult | null> {
  const q = normalize(query);
  try {
    const res = await fetch('https://api.apis.guru/v2/providers.json', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    const providers: string[] = json.data || [];
    const matched = providers.find(p => normalize(p) === q)
      || providers.find(p => normalize(p).startsWith(q))
      || providers.find(p => normalize(p).includes(q) || q.includes(normalize(p).replace(/\.com$|\.io$|\.org$/, '')));
    if (!matched) return null;

    const apiRes = await fetch(`https://api.apis.guru/v2/${encodeURIComponent(matched)}.json`, { signal: AbortSignal.timeout(10000) });
    if (!apiRes.ok) return null;
    const data = await apiRes.json();
    const apis = data.apis || {};
    const apiKeys = Object.keys(apis);
    if (apiKeys.length === 0) return null;
    const apiEntry = apis[apiKeys[0]];
    const specUrl = apiEntry.swaggerUrl || apiEntry.swaggerYamlUrl;
    if (!specUrl) return null;

    const fetched = await fetchAndParseSpecWeb(specUrl);
    if (!fetched) return null;
    const info = apiEntry.info || {};
    return buildDiscoveryResult(fetched.spec, {
      name: info.title || matched,
      description: info.description || '',
      baseUrl: '',
    }, fetched.url);
  } catch {}
  return null;
}

// ---------------------------------------------------------------------------

function getStore(key: string): any[] {
  try {
    return JSON.parse(localStorage.getItem(`ruke:${key}`) || '[]');
  } catch {
    return [];
  }
}

function setStore(key: string, data: any[]) {
  localStorage.setItem(`ruke:${key}`, JSON.stringify(data));
}

function getStoreMap(key: string): Record<string, any> {
  try {
    return JSON.parse(localStorage.getItem(`ruke:${key}`) || '{}');
  } catch {
    return {};
  }
}

function setStoreMap(key: string, data: Record<string, any>) {
  localStorage.setItem(`ruke:${key}`, JSON.stringify(data));
}

const localRepo: Record<string, (...args: any[]) => any> = {
  getWorkspaces: () => {
    let ws = getStore('workspaces');
    if (ws.length === 0) {
      ws = [{ id: 'default', name: 'My Workspace', type: 'personal', createdAt: new Date().toISOString() }];
      setStore('workspaces', ws);
    }
    return ws;
  },
  createWorkspace: (id: string, name: string, type: string) => {
    const ws = getStore('workspaces');
    ws.push({ id, name, type, createdAt: new Date().toISOString() });
    setStore('workspaces', ws);
  },

  getCollections: (workspaceId: string) =>
    getStore('collections').filter((c: any) => c.workspaceId === workspaceId).sort((a: any, b: any) => a.sortOrder - b.sortOrder),

  createCollection: (id: string, workspaceId: string, name: string, parentId: string | null, sortOrder: number) => {
    const cols = getStore('collections');
    cols.push({ id, workspaceId, name, parentId, sortOrder, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    setStore('collections', cols);
  },
  updateCollection: (id: string, data: any) => {
    const cols = getStore('collections').map((c: any) => c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c);
    setStore('collections', cols);
  },
  deleteCollection: (id: string) => {
    setStore('collections', getStore('collections').filter((c: any) => c.id !== id && c.parentId !== id));
  },

  getRequests: (collectionId: string) =>
    getStore('requests').filter((r: any) => r.collectionId === collectionId).sort((a: any, b: any) => a.sortOrder - b.sortOrder),

  getAllRequests: (workspaceId: string) => getStore('requests'),

  getRequestById: (id: string) => getStore('requests').find((r: any) => r.id === id) || null,

  createRequest: (req: any) => {
    const reqs = getStore('requests');
    reqs.push(req);
    setStore('requests', reqs);
  },
  updateRequest: (id: string, data: any) => {
    const reqs = getStore('requests').map((r: any) => r.id === id ? { ...r, ...data, updatedAt: new Date().toISOString() } : r);
    setStore('requests', reqs);
  },
  deleteRequest: (id: string) => {
    setStore('requests', getStore('requests').filter((r: any) => r.id !== id));
  },

  getEnvironments: (workspaceId: string) =>
    getStore('environments').filter((e: any) => e.workspaceId === workspaceId).sort((a: any, b: any) => a.sortOrder - b.sortOrder),

  createEnvironment: (id: string, workspaceId: string, name: string, sortOrder: number) => {
    const envs = getStore('environments');
    envs.push({ id, workspaceId, name, isActive: false, sortOrder, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    setStore('environments', envs);
  },
  setActiveEnvironment: (workspaceId: string, envId: string) => {
    const envs = getStore('environments').map((e: any) => ({
      ...e,
      isActive: e.id === envId,
    }));
    setStore('environments', envs);
  },
  updateEnvironment: (id: string, data: any) => {
    const envs = getStore('environments').map((e: any) => e.id === id ? { ...e, ...data, updatedAt: new Date().toISOString() } : e);
    setStore('environments', envs);
  },
  deleteEnvironment: (id: string) => {
    setStore('environments', getStore('environments').filter((e: any) => e.id !== id));
    setStore('env_variables', getStore('env_variables').filter((v: any) => v.environmentId !== id));
  },

  getVariables: (environmentId: string) =>
    getStore('env_variables').filter((v: any) => v.environmentId === environmentId).sort((a: any, b: any) => a.key.localeCompare(b.key)),

  createVariable: (v: any) => {
    const vars = getStore('env_variables');
    vars.push(v);
    setStore('env_variables', vars);
  },
  updateVariable: (id: string, data: any) => {
    const vars = getStore('env_variables').map((v: any) => v.id === id ? { ...v, ...data } : v);
    setStore('env_variables', vars);
  },
  deleteVariable: (id: string) => {
    setStore('env_variables', getStore('env_variables').filter((v: any) => v.id !== id));
  },

  getHistory: (limit: number = 50, _offset: number = 0) => {
    const h = getStore('history').sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return h.slice(0, limit);
  },
  addHistory: (entry: any) => {
    const h = getStore('history');
    h.push({ ...entry, timestamp: new Date().toISOString() });
    if (h.length > 200) h.splice(0, h.length - 200);
    setStore('history', h);
  },
  clearHistory: () => setStore('history', []),
  searchHistory: (query: string) => {
    const q = query.toLowerCase();
    return getStore('history')
      .filter((h: any) => h.url?.toLowerCase().includes(q) || h.method?.toLowerCase().includes(q))
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 100);
  },

  getConversation: (id: string) => null,
  saveConversation: () => {},
  getSetting: (key: string) => getStoreMap('settings')[key] || null,
  setSetting: (key: string, value: string) => {
    const s = getStoreMap('settings');
    s[key] = value;
    setStoreMap('settings', s);
  },
};

async function browserSendRequest(request: any): Promise<ApiResponse> {
  const vars: Record<string, string> = request.resolvedVariables || {};
  const resolve = (s: string) => s.replace(/\{\{([^}]+)\}\}/g, (_, k) => vars[k.trim()] ?? `{{${k}}}`);

  let url = resolve(request.url);
  const headers: Record<string, string> = {};

  for (const h of request.headers || []) {
    if (h.enabled && h.key) headers[resolve(h.key)] = resolve(h.value);
  }

  if (request.auth?.type === 'bearer' && request.auth.bearer?.token) {
    headers['Authorization'] = `Bearer ${resolve(request.auth.bearer.token)}`;
  } else if (request.auth?.type === 'basic' && request.auth.basic) {
    headers['Authorization'] = `Basic ${btoa(`${resolve(request.auth.basic.username)}:${resolve(request.auth.basic.password)}`)}`;
  } else if (request.auth?.type === 'api-key' && request.auth.apiKey?.addTo === 'header') {
    headers[resolve(request.auth.apiKey.key)] = resolve(request.auth.apiKey.value);
  }

  const enabledParams = (request.params || []).filter((p: any) => p.enabled && p.key);
  if (enabledParams.length > 0) {
    const sp = new URLSearchParams();
    for (const p of enabledParams) sp.append(resolve(p.key), resolve(p.value));
    url += (url.includes('?') ? '&' : '?') + sp.toString();
  }

  const opts: RequestInit = { method: request.method, headers };
  if (!['GET', 'HEAD'].includes(request.method) && request.body?.type !== 'none') {
    if (request.body?.type === 'json' || request.body?.type === 'raw') {
      opts.body = request.body.raw ? resolve(request.body.raw) : undefined;
      if (request.body.type === 'json' && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    } else if (request.body?.type === 'x-www-form-urlencoded') {
      const sp = new URLSearchParams();
      for (const p of (request.body.urlEncoded || [])) { if (p.enabled) sp.append(resolve(p.key), resolve(p.value)); }
      opts.body = sp.toString();
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
  }

  const start = performance.now();
  try {
    const res = await fetch(url, opts);
    const duration = Math.round(performance.now() - start);
    const bodyText = await res.text();
    const resHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => { resHeaders[k] = v; });
    return {
      status: res.status,
      statusText: res.statusText,
      headers: resHeaders,
      body: bodyText,
      size: new TextEncoder().encode(bodyText).length,
      duration,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      status: 0,
      statusText: err.message || 'Network Error',
      headers: {},
      body: JSON.stringify({ error: err.message }, null, 2),
      size: 0,
      duration: Math.round(performance.now() - start),
      timestamp: new Date().toISOString(),
    };
  }
}

let aiKeyStore: string | null = null;

export function initBridge() {
  if (isElectron) return;

  (window as any).ruke = {
    sendRequest: browserSendRequest,
    db: {
      query: (method: string, ...args: any[]) => {
        const fn = localRepo[method];
        if (!fn) {
          console.warn(`[bridge] unknown repo method: ${method}`);
          return Promise.resolve(null);
        }
        try {
          return Promise.resolve(fn(...args));
        } catch (e) {
          console.error(`[bridge] ${method} error:`, e);
          return Promise.resolve(null);
        }
      },
    },
    ai: {
      chat: async (messages: any[], context?: string) => {
        if (!aiKeyStore) {
          return { content: '', error: 'No API key configured. Add your OpenAI API key in Settings to use AI features.' };
        }
        try {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiKeyStore}` },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                ...(context ? [{ role: 'system', content: `Context:\n${context}` }] : []),
                ...messages.map((m: any) => ({ role: m.role, content: m.content })),
              ],
              temperature: 0.3,
              max_tokens: 2000,
            }),
          });
          const data = await res.json();
          return { content: data.choices?.[0]?.message?.content || 'No response.' };
        } catch (e: any) {
          return { content: '', error: e.message };
        }
      },
      setKey: async (key: string) => {
        aiKeyStore = key;
        localStorage.setItem('ruke:ai_key', key);
        return { success: true };
      },
    },
    agent: {
      discover: async (query: string): Promise<DiscoveryResult[]> => {
        // Tier 1: Registry lookup (no AI key needed)
        const registryResult = await discoverFromRegistry(query);
        if (registryResult && registryResult.endpointCount > 0) {
          return [registryResult];
        }

        // Tier 2: APIs.guru lookup (no AI key needed)
        const apisGuruResult = await discoverFromApisGuru(query);
        if (apisGuruResult && apisGuruResult.endpointCount > 0) {
          return [apisGuruResult];
        }

        // Tier 3: LLM suggestion (requires API key)
        if (aiKeyStore) {
          try {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiKeyStore}` },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                  { role: 'system', content: `You are an API discovery assistant. Given a user query about APIs they want to connect to, return a JSON array of API suggestions.\n\nFor each API, include:\n- name: The official API name\n- description: One-line description\n- specUrl: Direct URL to the OpenAPI/Swagger spec JSON or YAML file (if you know it)\n- docsUrl: URL to the API documentation page\n- baseUrl: The API base URL\n- type: "openapi" or "graphql"\n\nReturn ONLY a JSON array, no other text.\n\nImportant:\n- Only suggest real, existing APIs with correct URLs\n- Prefer official spec URLs from GitHub repos or official documentation\n- If you're unsure of the exact spec URL, provide the docsUrl and baseUrl so the system can probe for common spec paths\n- Include both REST and GraphQL APIs when relevant\n- Return up to 5 results` },
                  { role: 'user', content: query },
                ],
                temperature: 0.2,
                max_tokens: 2000,
              }),
            });
            const data = await res.json();
            const content = data.choices?.[0]?.message?.content || '';
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const suggestions = JSON.parse(jsonMatch[0]);
              const results: DiscoveryResult[] = [];
              for (const s of suggestions) {
                if (s.specUrl) {
                  const fetched = await fetchAndParseSpecWeb(s.specUrl);
                  if (fetched) {
                    results.push(buildDiscoveryResult(fetched.spec, {
                      name: s.name,
                      description: s.description,
                      baseUrl: s.baseUrl || '',
                    }, fetched.url));
                    continue;
                  }
                }
                results.push({
                  name: s.name,
                  description: s.description || '',
                  baseUrl: s.baseUrl || '',
                  specUrl: s.specUrl,
                  specType: s.type || 'openapi',
                  endpointCount: 0,
                  endpoints: [],
                });
              }
              if (results.some(r => r.endpointCount > 0)) return results;
            }
          } catch {}
        }

        // Return whatever partial result we have
        if (registryResult) return [registryResult];
        return [{
          name: query,
          description: '',
          baseUrl: '',
          specType: 'openapi',
          endpointCount: 0,
          endpoints: [],
          error: aiKeyStore
            ? 'Could not find a machine-readable spec. You can add this API manually.'
            : 'API not found in registry. Add an API key in Settings for broader discovery.',
        }];
      },
    },
    file: {
      export: async (data: string) => {
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'collection.ruke';
        a.click();
        URL.revokeObjectURL(url);
        return { success: true };
      },
      import: async () => {
        return new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json,.ruke';
          input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) { resolve({ success: false }); return; }
            const content = await file.text();
            resolve({ success: true, content, path: file.name });
          };
          input.click();
        });
      },
    },
    getAppPath: async () => '/ruke-data',
  };

  const savedKey = localStorage.getItem('ruke:ai_key');
  if (savedKey) aiKeyStore = savedKey;
}
