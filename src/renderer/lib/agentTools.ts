import { tool } from 'ai';
import { z } from 'zod';
import { useRequestStore } from '../stores/requestStore';
import { useConnectionStore } from '../stores/connectionStore';
import { useCollectionStore } from '../stores/collectionStore';
import { useEnvironmentStore } from '../stores/environmentStore';
import { useGrpcStore } from '../stores/grpcStore';
import { useUiStore } from '../stores/uiStore';
import type { HttpMethod, KeyValue, AppView, AuthConfig } from '@shared/types';
import { parseCurl, toCurl } from '@shared/curl';

function notifyView(view: AppView) {
  useUiStore.getState().incrementBadge(view);
}

const kv = (entries?: Array<{ key: string; value: string }>): KeyValue[] => {
  if (!entries?.length) return [{ key: '', value: '', enabled: true }];
  return entries.map(e => ({ key: e.key, value: e.value, enabled: true }));
};

function compactJson(raw: string | undefined): string {
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw));
  } catch {
    return raw;
  }
}

function truncateBody(body: string, maxLen = 4000): string {
  if (!body || body.length <= maxLen) return body;
  try {
    const parsed = JSON.parse(body);
    const truncated = truncateJsonValue(parsed, maxLen);
    return JSON.stringify(truncated);
  } catch {
    return body.slice(0, maxLen) + `\n... (truncated, ${body.length} total chars)`;
  }
}

function truncateJsonValue(val: unknown, budget: number): unknown {
  if (val === null || val === undefined || typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    const maxItems = Math.min(val.length, 10);
    const items = val.slice(0, maxItems).map(v => truncateJsonValue(v, Math.floor(budget / maxItems)));
    if (val.length > maxItems) items.push(`... ${val.length - maxItems} more items`);
    return items;
  }
  const entries = Object.entries(val);
  const result: Record<string, unknown> = {};
  for (const [k, v] of entries.slice(0, 30)) {
    result[k] = truncateJsonValue(v, Math.floor(budget / entries.length));
  }
  if (entries.length > 30) result['...'] = `${entries.length - 30} more keys`;
  return result;
}

function findRequest(match: string) {
  const matchStr = match.toLowerCase();
  const reqStore = useRequestStore.getState();
  const colStore = useCollectionStore.getState();
  const all: Array<{ id: string; name: string; method: string; url: string; collectionId?: string | null }> = [];
  for (const r of reqStore.uncollectedRequests) all.push({ id: r.id, name: r.name, method: r.method, url: r.url, collectionId: r.collectionId });
  for (const r of reqStore.archivedRequests) all.push({ id: r.id, name: r.name, method: r.method, url: r.url, collectionId: r.collectionId });
  for (const [colId, reqs] of Object.entries(colStore.requests)) {
    for (const r of reqs) all.push({ id: r.id, name: r.name, method: r.method, url: r.url, collectionId: colId });
  }
  return all.find(r =>
    r.id === match ||
    (r.name || '').toLowerCase() === matchStr ||
    (r.name || '').toLowerCase().includes(matchStr)
  ) || null;
}

function findCollection(match: string) {
  const matchStr = match.toLowerCase();
  const colStore = useCollectionStore.getState();
  return colStore.collections.find(c =>
    c.id === match || c.name.toLowerCase() === matchStr || c.name.toLowerCase().includes(matchStr)
  ) || null;
}

function findEnvironment(match: string) {
  const matchStr = match.toLowerCase();
  const envStore = useEnvironmentStore.getState();
  return envStore.environments.find(e =>
    e.id === match || e.name.toLowerCase() === matchStr || e.name.toLowerCase().includes(matchStr)
  ) || null;
}

function findConnection(match: string) {
  const matchStr = match.toLowerCase();
  const conns = useConnectionStore.getState().connections;
  return conns.find(c =>
    c.id === match || c.name.toLowerCase() === matchStr || c.name.toLowerCase().includes(matchStr)
  ) || null;
}

const authParamsSchema = {
  auth_type: z.enum(['none', 'bearer', 'basic', 'api-key']).optional()
    .describe('Auth type. Use "bearer" for Bearer/API tokens, "basic" for username/password, "api-key" for custom API key header or query param.'),
  auth_token: z.string().optional()
    .describe('Bearer token value (used when auth_type is "bearer")'),
  auth_username: z.string().optional()
    .describe('Username for basic auth (used when auth_type is "basic")'),
  auth_password: z.string().optional()
    .describe('Password for basic auth (used when auth_type is "basic")'),
  auth_key_name: z.string().optional()
    .describe('API key header/param name, e.g. "X-API-Key" (used when auth_type is "api-key")'),
  auth_key_value: z.string().optional()
    .describe('API key value (used when auth_type is "api-key")'),
  auth_key_location: z.enum(['header', 'query']).optional()
    .describe('Where to add the API key: "header" or "query" (default: "header")'),
};

function buildAuthConfig(args: Record<string, unknown>): AuthConfig | null {
  const authType = args.auth_type as string | undefined;
  if (!authType) return null;

  switch (authType) {
    case 'bearer':
      return { type: 'bearer', bearer: { token: (args.auth_token as string) || '' } };
    case 'basic':
      return { type: 'basic', basic: { username: (args.auth_username as string) || '', password: (args.auth_password as string) || '' } };
    case 'api-key':
      return { type: 'api-key', apiKey: { key: (args.auth_key_name as string) || '', value: (args.auth_key_value as string) || '', addTo: (args.auth_key_location as 'header' | 'query') || 'header' } };
    case 'none':
      return { type: 'none' };
    default:
      return null;
  }
}

const kvItemSchema = z.object({
  key: z.string(),
  value: z.string(),
});

// ── Tool definitions ──

const listConnectionsTool = tool({
  description: 'List all currently connected APIs with their endpoint counts. Use this first to understand what APIs are available before creating requests.',
  inputSchema: z.object({}),
  execute: async () => {
    const conns = useConnectionStore.getState().connections;
    if (conns.length === 0) return JSON.stringify({ connections: [], message: 'No APIs connected yet.' });
    return JSON.stringify({
      connections: conns.map(c => ({
        id: c.id,
        name: c.name,
        baseUrl: c.baseUrl,
        specType: c.specType,
        endpointCount: c.endpoints.length,
        description: c.description,
        authType: c.auth.type,
        authConfigured: c.auth.type !== 'none',
      })),
    });
  },
});

const searchEndpointsTool = tool({
  description: 'Search connected API endpoints by keyword. Returns matching endpoints with their method, path, summary, parameters, and body info. Use this to find the right endpoint before creating a request.',
  inputSchema: z.object({
    query: z.string().describe('Search keyword (e.g. "chat", "users", "completions")'),
    connection_id: z.string().optional().describe('Optional: limit search to a specific connection ID'),
  }),
  execute: async ({ query, connection_id }) => {
    const q = query.toLowerCase();
    const conns = useConnectionStore.getState().connections;
    const filtered = connection_id ? conns.filter(c => c.id === connection_id) : conns;
    const results: Array<Record<string, unknown>> = [];

    for (const conn of filtered) {
      for (const ep of conn.endpoints) {
        const searchable = `${ep.method} ${ep.path} ${ep.summary || ''} ${ep.description || ''} ${(ep.tags || []).join(' ')}`.toLowerCase();
        if (searchable.includes(q)) {
          results.push({
            connectionId: conn.id,
            connectionName: conn.name,
            baseUrl: conn.baseUrl,
            endpointId: ep.id,
            method: ep.method,
            path: ep.path,
            fullUrl: conn.baseUrl.replace(/\/+$/, '') + ep.path,
            summary: ep.summary,
            parameters: ep.parameters?.slice(0, 10),
            hasBody: !!ep.requestBody,
            bodyExample: ep.requestBody?.example?.slice(0, 500),
          });
        }
        if (results.length >= 15) break;
      }
      if (results.length >= 15) break;
    }

    if (results.length === 0) return JSON.stringify({ results: [], message: `No endpoints matching "${query}" found.` });
    return JSON.stringify({ results });
  },
});

const createRequestTool = tool({
  description: 'Create a new API request and open it in the request builder. Use search_endpoints first to find the correct endpoint. If the API requires auth, set auth_type and credentials. If the request is linked to a connection that already has auth configured, you can skip auth here.',
  inputSchema: z.object({
    name: z.string().describe('Descriptive name for the request'),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
    url: z.string().describe('Full URL, or just the path (e.g. /v1/chat/completions) when connection_id is provided'),
    headers: z.array(kvItemSchema).optional().describe('Request headers'),
    params: z.array(kvItemSchema).optional().describe('Query parameters'),
    body_type: z.enum(['none', 'json', 'form-data', 'raw']).optional().describe('Body type'),
    body_content: z.string().optional().describe('Body content as a compact single-line JSON string (no newlines or extra whitespace)'),
    connection_id: z.string().optional().describe('Connection ID to link this request to'),
    endpoint_id: z.string().optional().describe('Endpoint ID to link this request to'),
    collection_id: z.string().optional().describe('Collection ID to add this request to'),
    ...authParamsSchema,
  }),
  execute: async (args) => {
    const store = useRequestStore.getState();
    const method = (args.method || 'GET') as HttpMethod;
    const collectionId = args.collection_id || null;
    const connectionId = args.connection_id;
    const endpointId = args.endpoint_id;

    let url = args.url;

    if (connectionId) {
      const conn = useConnectionStore.getState().getConnection(connectionId);
      if (conn) {
        const base = conn.baseUrl.replace(/\/+$/, '');
        if (url.startsWith(base)) {
          url = url.slice(base.length) || '/';
        }
      }
    }

    const bodyRaw = compactJson(args.body_content);

    const { nanoid } = await import('nanoid');
    const now = new Date().toISOString();
    const req = {
      id: nanoid(),
      name: args.name,
      method,
      url,
      headers: kv(args.headers),
      params: kv(args.params),
      body: { type: args.body_type || 'none', raw: bodyRaw } as any,
      auth: buildAuthConfig(args as Record<string, unknown>) || { type: 'none' as const },
      connectionId,
      endpointId,
      collectionId,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await window.ruke.db.query('createRequest', req);
    } catch {}

    if (collectionId) {
      await useCollectionStore.getState().loadRequests(collectionId);
    }
    await store.loadUncollectedRequests();
    await store.loadArchivedRequests();
    notifyView('requests');
    useUiStore.getState().markAiCreated(req.id);

    return JSON.stringify({ success: true, requestId: req.id, name: req.name, method, url });
  },
});

const requestSchema = z.object({
  name: z.string().describe('Descriptive name for the request'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
  url: z.string().describe('Full URL, or just the path (e.g. /v1/chat/completions) when connection_id is provided'),
  headers: z.array(kvItemSchema).optional().describe('Request headers'),
  params: z.array(kvItemSchema).optional().describe('Query parameters'),
  body_type: z.enum(['none', 'json', 'form-data', 'raw']).optional().describe('Body type'),
  body_content: z.string().optional().describe('Body content as a compact single-line JSON string'),
  connection_id: z.string().optional().describe('Connection ID to link this request to'),
  endpoint_id: z.string().optional().describe('Endpoint ID to link this request to'),
  collection_id: z.string().optional().describe('Collection ID to add this request to'),
});

const createRequestsTool = tool({
  description: 'Create multiple API requests in one call. ALWAYS prefer this over calling create_request multiple times. Each request can be linked to a connection/endpoint/collection.',
  inputSchema: z.object({
    requests: z.array(requestSchema).min(1).describe('Array of requests to create'),
  }),
  execute: async ({ requests }) => {
    const store = useRequestStore.getState();
    const { nanoid } = await import('nanoid');
    const results: Array<{ requestId: string; name: string; method: string; url: string }> = [];
    const collectionIds = new Set<string>();

    for (const args of requests) {
      const method = (args.method || 'GET') as HttpMethod;
      let url = args.url;

      if (args.connection_id) {
        const conn = useConnectionStore.getState().getConnection(args.connection_id);
        if (conn) {
          const base = conn.baseUrl.replace(/\/+$/, '');
          if (url.startsWith(base)) url = url.slice(base.length) || '/';
        }
      }

      const now = new Date().toISOString();
      const req = {
        id: nanoid(),
        name: args.name,
        method,
        url,
        headers: kv(args.headers),
        params: kv(args.params),
        body: { type: args.body_type || 'none', raw: compactJson(args.body_content) } as any,
        auth: { type: 'none' as const },
        connectionId: args.connection_id,
        endpointId: args.endpoint_id,
        collectionId: args.collection_id || null,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      };

      try { await window.ruke.db.query('createRequest', req); } catch {}
      if (args.collection_id) collectionIds.add(args.collection_id);
      results.push({ requestId: req.id, name: req.name, method, url });
      useUiStore.getState().markAiCreated(req.id);
    }

    for (const colId of collectionIds) {
      await useCollectionStore.getState().loadRequests(colId);
    }
    await store.loadUncollectedRequests();
    await store.loadArchivedRequests();
    notifyView('requests');

    return JSON.stringify({ success: true, created: results.length, requests: results });
  },
});

const createCollectionTool = tool({
  description: 'Create a named collection to organize requests. Returns the collection ID which can be passed to create_request or create_requests.',
  inputSchema: z.object({
    name: z.string().describe('Collection name'),
  }),
  execute: async ({ name }) => {
    const store = useCollectionStore.getState();
    const collection = await store.createCollection(name);
    store.toggleExpanded(collection.id);
    notifyView('requests');
    useUiStore.getState().markAiCreated(collection.id);
    return JSON.stringify({ success: true, collectionId: collection.id, name: collection.name });
  },
});

const connectApiTool = tool({
  description: 'Connect an API by name using the discovery system. Searches the built-in registry and online sources to find and import the API spec.',
  inputSchema: z.object({
    query: z.string().describe('API name to search for (e.g. "OpenAI", "Stripe", "GitHub")'),
  }),
  execute: async ({ query }) => {
    try {
      const existing = useConnectionStore.getState().connections;
      const queryLower = query.toLowerCase();
      const alreadyConnected = existing.find(c =>
        c.name.toLowerCase().includes(queryLower) || queryLower.includes(c.name.toLowerCase())
      );
      if (alreadyConnected) {
        return JSON.stringify({
          success: true,
          connectionId: alreadyConnected.id,
          name: alreadyConnected.name,
          baseUrl: alreadyConnected.baseUrl,
          endpointCount: alreadyConnected.endpoints.length,
          note: 'Already connected — using existing connection.',
        });
      }

      const results = await window.ruke.agent.discover(query);
      if (!results.length) return JSON.stringify({ success: false, error: `No API found for "${query}"` });

      const best = results[0];
      if (best.endpoints.length > 0) {
        const conn = useConnectionStore.getState().addConnection({
          name: best.name,
          baseUrl: best.baseUrl,
          specUrl: best.specUrl,
          specType: best.specType,
          description: best.description,
          endpoints: best.endpoints,
        });
        notifyView('connections');
        return JSON.stringify({
          success: true,
          connectionId: conn.id,
          name: conn.name,
          baseUrl: conn.baseUrl,
          endpointCount: conn.endpoints.length,
        });
      }

      const conn = useConnectionStore.getState().addConnection({
        name: best.name,
        baseUrl: best.baseUrl,
        specType: 'manual',
        description: best.description,
      });
      notifyView('connections');
      return JSON.stringify({
        success: true,
        connectionId: conn.id,
        name: conn.name,
        baseUrl: conn.baseUrl,
        endpointCount: 0,
        note: 'Connected but no endpoints loaded. Try import_spec with a spec URL.',
      });
    } catch (e: any) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
});

const importSpecTool = tool({
  description: 'Import an OpenAPI specification from a URL. Fetches the spec, parses it, and creates a connection with all endpoints.',
  inputSchema: z.object({
    url: z.string().describe('URL to the OpenAPI spec (JSON or YAML)'),
  }),
  execute: async ({ url }) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return JSON.stringify({ success: false, error: `Failed to fetch spec: ${res.status} ${res.statusText}` });
      const text = await res.text();
      const conn = useConnectionStore.getState().importOpenApiSpec(text, url);
      if (!conn) return JSON.stringify({ success: false, error: 'Failed to parse the specification.' });
      return JSON.stringify({
        success: true,
        connectionId: conn.id,
        name: conn.name,
        baseUrl: conn.baseUrl,
        endpointCount: conn.endpoints.length,
      });
    } catch (e: any) {
      return JSON.stringify({ success: false, error: e.message });
    }
  },
});

const createEnvironmentTool = tool({
  description: 'Create an environment with variables. Environments are just bags of key-value pairs — use variables like base_url, api_key, token. Use {{variable}} syntax in connection base URLs and auth fields to reference them.',
  inputSchema: z.object({
    name: z.string().describe('Environment name (e.g. "Production", "Staging")'),
    variables: z.array(z.object({
      key: z.string(),
      value: z.string(),
      is_secret: z.boolean().optional().describe('Whether this is a secret value'),
    })).optional().describe('Environment variables to create (e.g. base_url, api_key, token)'),
  }),
  execute: async ({ name, variables }) => {
    const envStore = useEnvironmentStore.getState();
    const collStore = useCollectionStore.getState();
    const wsId = collStore.activeWorkspaceId;
    if (!wsId) return JSON.stringify({ success: false, error: 'No active workspace' });

    const env = await envStore.createEnvironment(wsId, name);

    const vars = variables || [];
    for (const v of vars) {
      await envStore.addVariable(env.id, v.key, v.value, 'global', v.is_secret || false);
    }

    notifyView('environments');
    useUiStore.getState().markAiCreated(env.id);
    return JSON.stringify({
      success: true,
      environmentId: env.id,
      name: env.name,
      variableCount: vars.length,
    });
  },
});

const listEnvironmentsTool = tool({
  description: 'List all environments and their variables.',
  inputSchema: z.object({}),
  execute: async () => {
    const { environments, variables, activeEnvironmentId } = useEnvironmentStore.getState();
    if (environments.length === 0) return JSON.stringify({ environments: [], message: 'No environments configured.' });
    return JSON.stringify({
      activeEnvironmentId,
      environments: environments.map(env => ({
        id: env.id,
        name: env.name,
        isActive: env.isActive,
        variables: (variables.get(env.id) || []).map(v => ({
          key: v.key,
          value: v.isSecret ? '••••••••' : v.value,
          isSecret: v.isSecret,
        })),
      })),
    });
  },
});

const listRequestsTool = tool({
  description: 'List all requests (uncollected and within collections). Use this to find requests before editing, deleting, or moving them.',
  inputSchema: z.object({}),
  execute: async () => {
    const reqStore = useRequestStore.getState();
    const colStore = useCollectionStore.getState();

    await reqStore.loadUncollectedRequests();
    await reqStore.loadArchivedRequests();
    for (const c of colStore.collections) {
      await colStore.loadRequests(c.id);
    }

    const freshReq = useRequestStore.getState();
    const freshCol = useCollectionStore.getState();

    const collectionRequests: Array<Record<string, unknown>> = [];
    for (const [colId, reqs] of Object.entries(freshCol.requests)) {
      const col = freshCol.collections.find(c => c.id === colId);
      for (const r of reqs) {
        collectionRequests.push({
          id: r.id, name: r.name || 'Untitled', method: r.method, url: r.url,
          collectionId: colId, collectionName: col?.name,
        });
      }
    }
    return JSON.stringify({
      uncollected: freshReq.uncollectedRequests.map(r => ({
        id: r.id, name: r.name || 'Untitled', method: r.method, url: r.url,
        connectionId: r.connectionId,
      })),
      inCollections: collectionRequests,
      archived: freshReq.archivedRequests.map(r => ({
        id: r.id, name: r.name || 'Untitled', method: r.method, url: r.url,
      })),
    });
  },
});

const searchRequestsTool = tool({
  description: 'Search requests by name, method, or URL keyword. Searches across uncollected, collection, and archived requests.',
  inputSchema: z.object({
    query: z.string().describe('Search keyword (case-insensitive)'),
  }),
  execute: async ({ query }) => {
    const q = query.toLowerCase();
    const reqStore = useRequestStore.getState();
    const colStore = useCollectionStore.getState();

    await reqStore.loadUncollectedRequests();
    await reqStore.loadArchivedRequests();

    const freshReq = useRequestStore.getState();
    const freshCol = useCollectionStore.getState();

    const all: Array<{ req: any; source: string; collectionName?: string }> = [];
    for (const r of freshReq.uncollectedRequests) all.push({ req: r, source: 'uncollected' });
    for (const r of freshReq.archivedRequests) all.push({ req: r, source: 'archived' });
    for (const [colId, reqs] of Object.entries(freshCol.requests)) {
      const col = freshCol.collections.find(c => c.id === colId);
      for (const r of reqs) all.push({ req: r, source: 'collection', collectionName: col?.name });
    }

    const matches = all.filter(({ req }) => {
      const s = `${req.name || ''} ${req.method} ${req.url || ''}`.toLowerCase();
      return s.includes(q);
    });

    return JSON.stringify({
      results: matches.slice(0, 20).map(({ req, source, collectionName }) => ({
        id: req.id, name: req.name, method: req.method, url: req.url,
        source, collectionName, collectionId: req.collectionId,
      })),
      total: matches.length,
    });
  },
});

const deleteRequestTool = tool({
  description: 'Permanently delete a request by name or ID. Searches across all requests (uncollected, collections, archived). Use search_requests first if unsure.',
  inputSchema: z.object({
    match: z.string().describe('Request name or ID (case-insensitive partial match)'),
  }),
  execute: async ({ match }) => {
    const matchStr = match.toLowerCase();
    const reqStore = useRequestStore.getState();
    const colStore = useCollectionStore.getState();

    const all: Array<{ id: string; name: string; collectionId?: string | null }> = [];
    for (const r of reqStore.uncollectedRequests) all.push({ id: r.id, name: r.name, collectionId: r.collectionId });
    for (const r of reqStore.archivedRequests) all.push({ id: r.id, name: r.name, collectionId: r.collectionId });
    for (const [colId, reqs] of Object.entries(colStore.requests)) {
      for (const r of reqs) all.push({ id: r.id, name: r.name, collectionId: colId });
    }

    const found = all.find(r =>
      r.id === match ||
      (r.name || '').toLowerCase() === matchStr ||
      (r.name || '').toLowerCase().includes(matchStr)
    );

    if (!found) return JSON.stringify({ success: false, error: `No request matching "${match}" found.` });

    await reqStore.deleteRequest(found.id);

    if (found.collectionId) {
      await colStore.loadRequests(found.collectionId);
    }

    return JSON.stringify({ success: true, deleted: { id: found.id, name: found.name } });
  },
});

const archiveRequestTool = tool({
  description: 'Archive a request by name or ID. Searches across uncollected, collection, and archived requests. Archived requests are hidden from the main list but can be restored.',
  inputSchema: z.object({
    match: z.string().describe('Request name or ID (case-insensitive partial match)'),
  }),
  execute: async ({ match }) => {
    const matchStr = match.toLowerCase();
    const reqStore = useRequestStore.getState();
    const colStore = useCollectionStore.getState();

    const all: Array<{ id: string; name: string }> = [];
    for (const r of reqStore.uncollectedRequests) all.push({ id: r.id, name: r.name });
    for (const [, reqs] of Object.entries(colStore.requests)) {
      for (const r of reqs) all.push({ id: r.id, name: r.name });
    }

    const found = all.find(r =>
      r.id === match ||
      (r.name || '').toLowerCase() === matchStr ||
      (r.name || '').toLowerCase().includes(matchStr)
    );
    if (!found) return JSON.stringify({ success: false, error: `No request matching "${match}" found.` });

    await reqStore.archiveRequest(found.id);
    return JSON.stringify({ success: true, archived: { id: found.id, name: found.name } });
  },
});

const moveRequestToCollectionTool = tool({
  description: 'Move a request into a collection. Use list_requests or search_requests to find the request and collection IDs.',
  inputSchema: z.object({
    request_match: z.string().describe('Request name or ID'),
    collection_match: z.string().describe('Collection name or ID'),
  }),
  execute: async ({ request_match, collection_match }) => {
    const reqStr = request_match.toLowerCase();
    const colStr = collection_match.toLowerCase();
    const reqStore = useRequestStore.getState();
    const colStore = useCollectionStore.getState();

    const allReqs = [...reqStore.uncollectedRequests];
    for (const reqs of Object.values(colStore.requests)) allReqs.push(...reqs);

    const req = allReqs.find(r =>
      r.id === request_match ||
      (r.name || '').toLowerCase() === reqStr ||
      (r.name || '').toLowerCase().includes(reqStr)
    );
    if (!req) return JSON.stringify({ success: false, error: `No request matching "${request_match}" found.` });

    const col = colStore.collections.find(c =>
      c.id === collection_match ||
      c.name.toLowerCase() === colStr ||
      c.name.toLowerCase().includes(colStr)
    );
    if (!col) return JSON.stringify({ success: false, error: `No collection matching "${collection_match}" found.` });

    await reqStore.moveToCollection(req.id, col.id);
    return JSON.stringify({ success: true, moved: { requestId: req.id, requestName: req.name, collectionId: col.id, collectionName: col.name } });
  },
});

const listCollectionsTool = tool({
  description: 'List all collections with their request counts.',
  inputSchema: z.object({}),
  execute: async () => {
    const colStore = useCollectionStore.getState();
    return JSON.stringify({
      collections: colStore.collections.map(c => ({
        id: c.id,
        name: c.name,
        parentId: c.parentId,
        requestCount: (colStore.requests[c.id] || []).length,
      })),
    });
  },
});

const renameCollectionTool = tool({
  description: 'Rename a collection by name or ID.',
  inputSchema: z.object({
    match: z.string().describe('Collection name or ID'),
    new_name: z.string().describe('New collection name'),
  }),
  execute: async ({ match, new_name }) => {
    const colStore = useCollectionStore.getState();
    const matchStr = match.toLowerCase();
    const col = colStore.collections.find(c =>
      c.id === match || c.name.toLowerCase() === matchStr || c.name.toLowerCase().includes(matchStr)
    );
    if (!col) return JSON.stringify({ success: false, error: `No collection matching "${match}" found.` });

    await colStore.renameCollection(col.id, new_name);
    return JSON.stringify({ success: true, collection: { id: col.id, oldName: col.name, newName: new_name } });
  },
});

const deleteCollectionTool = tool({
  description: 'Delete a collection by name or ID. This deletes the collection but not the requests inside it (they become uncollected).',
  inputSchema: z.object({
    match: z.string().describe('Collection name or ID'),
  }),
  execute: async ({ match }) => {
    const colStore = useCollectionStore.getState();
    const matchStr = match.toLowerCase();
    const col = colStore.collections.find(c =>
      c.id === match || c.name.toLowerCase() === matchStr || c.name.toLowerCase().includes(matchStr)
    );
    if (!col) return JSON.stringify({ success: false, error: `No collection matching "${match}" found.` });

    await colStore.deleteCollection(col.id);
    useRequestStore.getState().loadUncollectedRequests();
    return JSON.stringify({ success: true, deleted: { id: col.id, name: col.name } });
  },
});

const setConnectionAuthTool = tool({
  description: 'Configure authentication for a connected API. All requests linked to this connection will inherit this auth unless they override it. Use list_connections to find the connection ID first.',
  inputSchema: z.object({
    connection_id: z.string().describe('Connection ID to configure auth for'),
    ...authParamsSchema,
  }),
  execute: async (args) => {
    const connStore = useConnectionStore.getState();
    const conn = connStore.getConnection(args.connection_id);
    if (!conn) return JSON.stringify({ success: false, error: `No connection with ID "${args.connection_id}" found.` });

    const authConfig = buildAuthConfig(args as Record<string, unknown>);
    if (!authConfig) return JSON.stringify({ success: false, error: 'Invalid auth_type. Use "none", "bearer", "basic", or "api-key".' });

    connStore.updateConnection(conn.id, { auth: authConfig });
    return JSON.stringify({
      success: true,
      connectionId: conn.id,
      connectionName: conn.name,
      authType: authConfig.type,
      note: authConfig.type !== 'none'
        ? `Auth configured. All requests linked to "${conn.name}" will use ${authConfig.type} auth.`
        : `Auth removed from "${conn.name}".`,
    });
  },
});

const editCurrentRequestTool = tool({
  description: 'Edit fields of the currently active request. Can change method, URL, name, headers, query params, body, and auth. Only specify the fields you want to change. For auth, set auth_type plus the relevant credentials (auth_token for bearer, auth_username/auth_password for basic, auth_key_name/auth_key_value for api-key).',
  inputSchema: z.object({
    name: z.string().optional().describe('New name for the request'),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']).optional(),
    url: z.string().optional().describe('New URL or path'),
    headers: z.array(kvItemSchema).optional().describe('Replace all headers'),
    params: z.array(kvItemSchema).optional().describe('Replace all query parameters'),
    body_type: z.enum(['none', 'json', 'form-data', 'raw']).optional(),
    body_content: z.string().optional().describe('Body content (compact JSON string for json type)'),
    connection_id: z.string().optional().describe('Connection ID to link'),
    endpoint_id: z.string().optional().describe('Endpoint ID to link'),
    ...authParamsSchema,
  }),
  execute: async (args) => {
    const store = useRequestStore.getState();
    const req = store.activeRequest;
    const changes: Partial<typeof req> = {};
    const changed: string[] = [];

    if (args.name) { changes.name = args.name; changed.push('name'); }
    if (args.method) { changes.method = args.method as HttpMethod; changed.push('method'); }
    if (args.url) { changes.url = args.url; changed.push('url'); }
    if (args.headers) { changes.headers = kv(args.headers); changed.push('headers'); }
    if (args.params) { changes.params = kv(args.params); changed.push('params'); }
    if (args.body_type || args.body_content) {
      changes.body = {
        type: args.body_type || req.body?.type || 'none',
        raw: compactJson(args.body_content) || req.body?.raw || '',
      } as any;
      changed.push('body');
    }
    if (args.connection_id) { changes.connectionId = args.connection_id; changed.push('connection'); }
    if (args.endpoint_id) { changes.endpointId = args.endpoint_id; changed.push('endpoint'); }

    const authConfig = buildAuthConfig(args as Record<string, unknown>);
    if (authConfig) { changes.auth = authConfig; changed.push('auth'); }

    store.updateActiveRequest(changes);

    const updated = useRequestStore.getState().activeRequest;
    try {
      await window.ruke.db.query('updateRequest', updated.id, updated);
    } catch {}

    await store.loadUncollectedRequests();
    if (updated.collectionId) {
      await useCollectionStore.getState().loadRequests(updated.collectionId);
    }

    return JSON.stringify({
      success: true,
      requestId: req.id,
      changed,
      current: {
        name: updated.name,
        method: updated.method,
        url: updated.url,
      },
    });
  },
});

const selectRequestTool = tool({
  description: 'Select and switch to a different request by name or ID. Searches across uncollected requests and collection requests.',
  inputSchema: z.object({
    match: z.string().describe('Request name or ID to search for (case-insensitive partial match)'),
  }),
  execute: async ({ match }) => {
    const store = useRequestStore.getState();
    const colStore = useCollectionStore.getState();
    const matchStr = match.toLowerCase();

    const allRequests = [...store.uncollectedRequests, ...store.archivedRequests];
    for (const reqs of Object.values(colStore.requests)) allRequests.push(...reqs);

    const found = allRequests.find(r =>
      r.id === match ||
      (r.name || '').toLowerCase() === matchStr ||
      (r.name || '').toLowerCase().includes(matchStr)
    );

    if (!found) {
      return JSON.stringify({ success: false, error: `No request matching "${match}" found.` });
    }

    store.selectRequest(found);
    notifyView('requests');

    return JSON.stringify({
      success: true,
      requestId: found.id,
      name: found.name,
      method: found.method,
      url: found.url,
    });
  },
});

const AI_KEY_STORAGE = 'ruke:ai_key';

const setApiKeyTool = tool({
  description: 'Save an OpenAI API key to enable AI features. The key is stored securely. Only call this when the user explicitly provides a key.',
  inputSchema: z.object({
    key: z.string().describe('The OpenAI API key (must start with "sk-" and be at least 10 characters)'),
  }),
  execute: async ({ key }) => {
    const trimmed = key.trim();
    if (!trimmed.startsWith('sk-') || trimmed.length < 10) {
      return JSON.stringify({ success: false, error: 'Invalid API key. Must start with "sk-" and be at least 10 characters.' });
    }
    try {
      await window.ruke.ai.setKey(trimmed);
      localStorage.setItem(AI_KEY_STORAGE, trimmed);
    } catch {
      localStorage.setItem(AI_KEY_STORAGE, trimmed);
    }
    const masked = trimmed.slice(0, 3) + '\u2022'.repeat(Math.min(trimmed.length - 7, 20)) + trimmed.slice(-4);
    return JSON.stringify({ success: true, maskedKey: masked });
  },
});

const toggleThemeTool = tool({
  description: 'Switch between dark and light mode.',
  inputSchema: z.object({}),
  execute: async () => {
    useUiStore.getState().toggleTheme();
    const newTheme = useUiStore.getState().theme;
    return JSON.stringify({ success: true, theme: newTheme });
  },
});

const getAppInfoTool = tool({
  description: 'Get information about the current app state: theme, connections, requests, environments, AI configuration, test and workflow counts.',
  inputSchema: z.object({}),
  execute: async () => {
    const uiState = useUiStore.getState();
    const connStore = useConnectionStore.getState();
    const reqStore = useRequestStore.getState();
    const envStore = useEnvironmentStore.getState();
    const hasKey = (localStorage.getItem(AI_KEY_STORAGE) || '').length >= 10;
    const provider = localStorage.getItem('ruke:ai_provider') || 'openai';
    const model = localStorage.getItem('ruke:ai_model') || 'gpt-4o';
    const tests = loadTests();
    const workflows = loadWorkflows();
    return JSON.stringify({
      theme: uiState.theme,
      activeView: uiState.activeView,
      aiKeyConfigured: hasKey,
      aiProvider: provider,
      aiModel: model,
      connectionCount: connStore.connections.length,
      requestCount: reqStore.uncollectedRequests.length,
      environmentCount: envStore.environments.length,
      testCount: tests.length,
      workflowCount: workflows.length,
    });
  },
});

const configureAiTool = tool({
  description: 'Configure the AI provider and model. Supports OpenAI, Anthropic, Google, Ollama, or custom OpenAI-compatible endpoints.',
  inputSchema: z.object({
    provider: z.enum(['openai', 'anthropic', 'google', 'ollama', 'custom']).optional().describe('AI provider'),
    model: z.string().optional().describe('Model name (e.g. "gpt-4o", "claude-sonnet-4-20250514", "gemini-2.0-flash", "llama3")'),
    api_key: z.string().optional().describe('API key for the provider'),
    base_url: z.string().optional().describe('Custom base URL (required for custom provider, optional for others)'),
  }),
  execute: async ({ provider, model, api_key, base_url }) => {
    const { setModelConfig, getModelConfig } = await import('./agentRunner');
    const current = getModelConfig();
    const updates: Record<string, unknown> = {};
    if (provider) { localStorage.setItem('ruke:ai_provider', provider); updates.provider = provider; }
    if (model) { localStorage.setItem('ruke:ai_model', model); updates.model = model; }
    if (api_key) {
      localStorage.setItem(AI_KEY_STORAGE, api_key);
      try { await window.ruke.ai.setKey(api_key); } catch {}
      updates.apiKey = '(set)';
    }
    if (base_url !== undefined) {
      if (base_url) localStorage.setItem('ruke:ai_base_url', base_url);
      else localStorage.removeItem('ruke:ai_base_url');
      updates.baseUrl = base_url || '(cleared)';
    }
    setModelConfig({ provider, model, apiKey: api_key, baseUrl: base_url });
    const final = getModelConfig();
    return JSON.stringify({
      success: true,
      configured: updates,
      current: { provider: final?.provider, model: final?.model, hasKey: !!final?.apiKey, baseUrl: final?.baseUrl },
    });
  },
});

const importCurlTool = tool({
  description: 'Import a cURL command and create a request from it. Parses the cURL to extract method, URL, headers, body, and auth.',
  inputSchema: z.object({
    curl_command: z.string().describe('The cURL command string to import'),
    name: z.string().optional().describe('Optional name for the request'),
    collection_id: z.string().optional().describe('Optional collection ID to add this request to'),
  }),
  execute: async ({ curl_command, name, collection_id }) => {
    try {
      const parsed = parseCurl(curl_command);
      const { nanoid } = await import('nanoid');
      const now = new Date().toISOString();

      let reqName = name;
      if (!reqName) {
        try {
          const u = new URL(parsed.url);
          reqName = `${parsed.method} ${u.pathname}`;
        } catch {
          reqName = `${parsed.method} ${parsed.url.slice(0, 40)}`;
        }
      }

      const req = {
        id: nanoid(),
        name: reqName,
        method: parsed.method,
        url: parsed.url,
        headers: parsed.headers.length > 0 ? parsed.headers : [{ key: '', value: '', enabled: true }],
        params: [{ key: '', value: '', enabled: true }] as KeyValue[],
        body: parsed.body,
        auth: parsed.auth,
        collectionId: collection_id || null,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      };

      try { await window.ruke.db.query('createRequest', req); } catch {}

      const store = useRequestStore.getState();
      if (collection_id) {
        await useCollectionStore.getState().loadRequests(collection_id);
      }
      await store.loadUncollectedRequests();
      notifyView('requests');
      useUiStore.getState().markAiCreated(req.id);

      return JSON.stringify({ success: true, requestId: req.id, name: req.name, method: parsed.method, url: parsed.url });
    } catch (e: any) {
      return JSON.stringify({ success: false, error: `Failed to parse cURL: ${e.message}` });
    }
  },
});

const exportCurlTool = tool({
  description: 'Export the currently active request as a cURL command.',
  inputSchema: z.object({}),
  execute: async () => {
    const store = useRequestStore.getState();
    const req = store.activeRequest;
    const resolvedUrl = store.getResolvedUrl();
    const curl = toCurl(req, resolvedUrl);
    return JSON.stringify({ success: true, curl });
  },
});

const generateScriptTool = tool({
  description: `Generate a JavaScript test/script for a request using the rk.* API. Script format: use rk.test(name, fn) to define tests; rk.expect(val).toBe(expected) for assertions (also toEqual, toBeTruthy, toBeFalsy, toBeGreaterThan, toBeLessThan, toContain, toHaveProperty, toHaveLength, toMatch, toBeDefined, toBeUndefined, toBeNull, not.*); rk.variables.set(key, value) / rk.variables.get(key) for variables; rk.log(...) for logging. Pre-request scripts run before the request; post-response scripts have access to response.json(), response.text(), response.status, response.statusText, response.headers, response.duration. Returns the generated script—does not execute it.`,
  inputSchema: z.object({
    description: z.string().describe('What the script should do (e.g. "check status 200", "validate JSON response has id field", "set auth token from variable")'),
    phase: z.enum(['pre-request', 'post-response']).describe('Whether the script runs before the request or after receiving the response'),
    request_context: z.string().optional().describe('Optional context about the current request (URL, method, etc.)'),
  }),
  execute: async ({ description, phase, request_context }) => {
    const d = description.toLowerCase();
    const lines: string[] = [];

    if (request_context) {
      lines.push(`// Context: ${request_context}`);
      lines.push('');
    }

    if (phase === 'pre-request') {
      if (d.includes('variable') || d.includes('var') || d.includes('set') || d.includes('auth') || d.includes('token')) {
        lines.push("rk.variables.set('token', rk.variables.get('token') || 'your-token');");
        lines.push('');
      }
      if (d.includes('log') || d.includes('debug')) {
        lines.push("rk.log('Pre-request script running');");
        lines.push('');
      }
      if (lines.length === 0) {
        lines.push("rk.log('Pre-request: ready');");
      }
    } else {
      lines.push("rk.test('Response is successful', () => {");
      if (d.includes('status') || d.includes('200') || d.includes('success')) {
        lines.push("  rk.expect(response.status).toBe(200);");
      }
      if (d.includes('json') || d.includes('body') || d.includes('response')) {
        lines.push("  const data = response.json();");
        lines.push("  rk.expect(data).toBeDefined();");
        if (d.includes('id') || d.includes('field')) {
          lines.push("  rk.expect(data).toHaveProperty('id');");
        }
        if (d.includes('array') || d.includes('list') || d.includes('items')) {
          lines.push("  rk.expect(Array.isArray(data) || typeof data === 'object').toBeTruthy();");
        }
      }
      if (d.includes('header') || d.includes('content-type')) {
        lines.push("  rk.expect(response.headers).toBeDefined();");
        lines.push("  rk.expect(response.headers['content-type']).toContain('application/json');");
      }
      if (d.includes('duration') || d.includes('time') || d.includes('ms')) {
        lines.push("  rk.expect(response.duration).toBeLessThan(5000);");
      }
      if (lines.length === 1) {
        lines.push("  rk.expect(response.status).toBe(200);");
      }
      lines.push("});");
      lines.push('');
      if (d.includes('log') || d.includes('debug')) {
        lines.push("rk.log('Response received', response.status, response.duration + 'ms');");
      }
    }

    const script = lines.join('\n');
    return JSON.stringify({
      success: true,
      script,
      phase,
      description: `Generated ${phase} script based on: ${description}`,
      ...(request_context ? { request_context } : {}),
    });
  },
});

// ── P0: Send Request ──

const sendRequestTool = tool({
  description: 'Send/execute the currently active request and return the full response (status, headers, body). The request must be set up first via create_request or edit_current_request. Use this to test API calls, debug issues, or validate integrations.',
  inputSchema: z.object({}),
  execute: async () => {
    const store = useRequestStore.getState();
    const req = store.activeRequest;
    if (!req.url && !req.connectionId) {
      return JSON.stringify({ success: false, error: 'No URL set on the active request. Set a URL first with edit_current_request.' });
    }

    const variables = useEnvironmentStore.getState().resolveVariables();
    await store.sendRequest(variables);

    const { response } = useRequestStore.getState();
    if (!response) return JSON.stringify({ success: false, error: 'Request failed — no response received.' });

    return JSON.stringify({
      success: true,
      status: response.status,
      statusText: response.statusText,
      duration: response.duration,
      size: response.size,
      headers: response.headers,
      body: truncateBody(response.body),
    });
  },
});

const sendRequestByIdTool = tool({
  description: 'Select a request by name/ID, send it, and return the response. Combines select_request + send in one step.',
  inputSchema: z.object({
    match: z.string().describe('Request name or ID (case-insensitive partial match)'),
  }),
  execute: async ({ match }) => {
    const found = findRequest(match);
    if (!found) return JSON.stringify({ success: false, error: `No request matching "${match}" found.` });

    const store = useRequestStore.getState();
    const allRequests = [...store.uncollectedRequests, ...store.archivedRequests];
    for (const reqs of Object.values(useCollectionStore.getState().requests)) allRequests.push(...reqs);
    const fullReq = allRequests.find(r => r.id === found.id);
    if (!fullReq) return JSON.stringify({ success: false, error: `Request "${match}" found but could not be loaded.` });

    store.selectRequest(fullReq);
    const variables = useEnvironmentStore.getState().resolveVariables();
    await useRequestStore.getState().sendRequest(variables);

    const { response } = useRequestStore.getState();
    if (!response) return JSON.stringify({ success: false, error: 'Request failed — no response received.' });

    return JSON.stringify({
      success: true,
      requestName: found.name,
      status: response.status,
      statusText: response.statusText,
      duration: response.duration,
      size: response.size,
      headers: response.headers,
      body: truncateBody(response.body),
    });
  },
});

// ── P0: Read Response ──

const getResponseTool = tool({
  description: 'Get the full response from the last request execution. Returns status, headers, and body. Use this to inspect response data for debugging or validation.',
  inputSchema: z.object({
    max_body_length: z.number().optional().describe('Max characters of body to return (default 4000)'),
  }),
  execute: async ({ max_body_length }) => {
    const { response, activeRequest } = useRequestStore.getState();
    if (!response) return JSON.stringify({ success: false, error: 'No response available. Send a request first.' });

    return JSON.stringify({
      success: true,
      request: { name: activeRequest.name, method: activeRequest.method, url: activeRequest.url },
      status: response.status,
      statusText: response.statusText,
      duration: response.duration,
      size: response.size,
      headers: response.headers,
      body: truncateBody(response.body, max_body_length || 4000),
    });
  },
});

const getResponseBodyTool = tool({
  description: 'Get only the response body from the last request. Use for large responses where you need to focus on body content.',
  inputSchema: z.object({
    max_length: z.number().optional().describe('Max characters to return (default 8000)'),
    json_path: z.string().optional().describe('Optional dot-notation path to extract from JSON response (e.g. "data.users", "results[0].name")'),
  }),
  execute: async ({ max_length, json_path }) => {
    const { response } = useRequestStore.getState();
    if (!response) return JSON.stringify({ success: false, error: 'No response available.' });

    if (json_path) {
      try {
        const parsed = JSON.parse(response.body);
        const parts = json_path.replace(/\[(\d+)\]/g, '.$1').split('.');
        let val: unknown = parsed;
        for (const p of parts) {
          if (val == null || typeof val !== 'object') { val = undefined; break; }
          val = (val as Record<string, unknown>)[p];
        }
        return JSON.stringify({ success: true, path: json_path, value: truncateJsonValue(val, max_length || 8000) });
      } catch {
        return JSON.stringify({ success: false, error: 'Response body is not valid JSON for path extraction.' });
      }
    }

    return JSON.stringify({ success: true, body: truncateBody(response.body, max_length || 8000) });
  },
});

const getResponseHeadersTool = tool({
  description: 'Get only the response headers from the last request.',
  inputSchema: z.object({}),
  execute: async () => {
    const { response } = useRequestStore.getState();
    if (!response) return JSON.stringify({ success: false, error: 'No response available.' });
    return JSON.stringify({ success: true, status: response.status, statusText: response.statusText, headers: response.headers });
  },
});

// ── P0: Environment Mutation ──

const updateEnvironmentTool = tool({
  description: 'Rename an environment.',
  inputSchema: z.object({
    match: z.string().describe('Environment name or ID'),
    name: z.string().describe('New name'),
  }),
  execute: async ({ match, name }) => {
    const env = findEnvironment(match);
    if (!env) return JSON.stringify({ success: false, error: `No environment matching "${match}" found.` });
    await useEnvironmentStore.getState().renameEnvironment(env.id, name);
    notifyView('environments');
    return JSON.stringify({ success: true, environmentId: env.id, changed: ['name'] });
  },
});

const deleteEnvironmentTool = tool({
  description: 'Delete an environment by name or ID.',
  inputSchema: z.object({ match: z.string().describe('Environment name or ID') }),
  execute: async ({ match }) => {
    const env = findEnvironment(match);
    if (!env) return JSON.stringify({ success: false, error: `No environment matching "${match}" found.` });
    await useEnvironmentStore.getState().deleteEnvironment(env.id);
    notifyView('environments');
    return JSON.stringify({ success: true, deleted: { id: env.id, name: env.name } });
  },
});

const setActiveEnvironmentTool = tool({
  description: 'Set the active environment. All {{variable}} references will resolve from this environment.',
  inputSchema: z.object({ match: z.string().describe('Environment name or ID to activate') }),
  execute: async ({ match }) => {
    const env = findEnvironment(match);
    if (!env) return JSON.stringify({ success: false, error: `No environment matching "${match}" found.` });
    const wsId = useCollectionStore.getState().activeWorkspaceId;
    if (!wsId) return JSON.stringify({ success: false, error: 'No active workspace.' });
    await useEnvironmentStore.getState().setActiveEnvironment(wsId, env.id);
    notifyView('environments');
    return JSON.stringify({ success: true, activated: { id: env.id, name: env.name } });
  },
});

const addVariableTool = tool({
  description: 'Add a variable to an environment.',
  inputSchema: z.object({
    environment_match: z.string().describe('Environment name or ID'),
    key: z.string().describe('Variable name'),
    value: z.string().describe('Variable value'),
    is_secret: z.boolean().optional().describe('Whether this is a secret value (hidden in UI)'),
  }),
  execute: async ({ environment_match, key, value, is_secret }) => {
    const env = findEnvironment(environment_match);
    if (!env) return JSON.stringify({ success: false, error: `No environment matching "${environment_match}" found.` });
    await useEnvironmentStore.getState().addVariable(env.id, key, value, 'global', is_secret || false);
    notifyView('environments');
    return JSON.stringify({ success: true, environmentId: env.id, environmentName: env.name, variable: { key, isSecret: is_secret || false } });
  },
});

const updateVariableTool = tool({
  description: 'Update an existing variable in an environment. Find the variable by key name within the specified environment.',
  inputSchema: z.object({
    environment_match: z.string().describe('Environment name or ID'),
    key: z.string().describe('Variable key to update'),
    new_value: z.string().optional().describe('New value'),
    new_key: z.string().optional().describe('New key name (rename)'),
    is_secret: z.boolean().optional().describe('Change secret status'),
  }),
  execute: async ({ environment_match, key, new_value, new_key, is_secret }) => {
    const env = findEnvironment(environment_match);
    if (!env) return JSON.stringify({ success: false, error: `No environment matching "${environment_match}" found.` });
    const vars = useEnvironmentStore.getState().getEnvironmentVariables(env.id);
    const v = vars.find(va => va.key.toLowerCase() === key.toLowerCase());
    if (!v) return JSON.stringify({ success: false, error: `No variable "${key}" in environment "${env.name}".` });
    const updates: Record<string, unknown> = {};
    if (new_value !== undefined) updates.value = new_value;
    if (new_key !== undefined) updates.key = new_key;
    if (is_secret !== undefined) updates.isSecret = is_secret;
    await useEnvironmentStore.getState().updateVariable(v.id, updates);
    notifyView('environments');
    return JSON.stringify({ success: true, environmentId: env.id, variableId: v.id, updated: Object.keys(updates) });
  },
});

const deleteVariableTool = tool({
  description: 'Delete a variable from an environment by key name.',
  inputSchema: z.object({
    environment_match: z.string().describe('Environment name or ID'),
    key: z.string().describe('Variable key to delete'),
  }),
  execute: async ({ environment_match, key }) => {
    const env = findEnvironment(environment_match);
    if (!env) return JSON.stringify({ success: false, error: `No environment matching "${environment_match}" found.` });
    const vars = useEnvironmentStore.getState().getEnvironmentVariables(env.id);
    const v = vars.find(va => va.key.toLowerCase() === key.toLowerCase());
    if (!v) return JSON.stringify({ success: false, error: `No variable "${key}" in environment "${env.name}".` });
    await useEnvironmentStore.getState().deleteVariable(v.id, env.id);
    notifyView('environments');
    return JSON.stringify({ success: true, deleted: { key: v.key, environmentId: env.id } });
  },
});

// ── P0: Connection Management ──

const deleteConnectionTool = tool({
  description: 'Delete a connected API by name or ID.',
  inputSchema: z.object({ match: z.string().describe('Connection name or ID') }),
  execute: async ({ match }) => {
    const conn = findConnection(match);
    if (!conn) return JSON.stringify({ success: false, error: `No connection matching "${match}" found.` });
    useConnectionStore.getState().deleteConnection(conn.id);
    notifyView('connections');
    return JSON.stringify({ success: true, deleted: { id: conn.id, name: conn.name } });
  },
});

const updateConnectionTool = tool({
  description: 'Update a connection\'s name, base URL, or description.',
  inputSchema: z.object({
    match: z.string().describe('Connection name or ID'),
    name: z.string().optional().describe('New name'),
    base_url: z.string().optional().describe('New base URL'),
    description: z.string().optional().describe('New description'),
  }),
  execute: async ({ match, name, base_url, description }) => {
    const conn = findConnection(match);
    if (!conn) return JSON.stringify({ success: false, error: `No connection matching "${match}" found.` });
    const updates: Record<string, unknown> = {};
    const changed: string[] = [];
    if (name) { updates.name = name; changed.push('name'); }
    if (base_url) { updates.baseUrl = base_url; changed.push('baseUrl'); }
    if (description) { updates.description = description; changed.push('description'); }
    useConnectionStore.getState().updateConnection(conn.id, updates);
    notifyView('connections');
    return JSON.stringify({ success: true, connectionId: conn.id, changed });
  },
});

const reimportSpecTool = tool({
  description: 'Re-import an API\'s OpenAPI specification to update its endpoints.',
  inputSchema: z.object({ match: z.string().describe('Connection name or ID') }),
  execute: async ({ match }) => {
    const conn = findConnection(match);
    if (!conn) return JSON.stringify({ success: false, error: `No connection matching "${match}" found.` });
    if (!conn.specUrl) return JSON.stringify({ success: false, error: `Connection "${conn.name}" has no spec URL.` });
    const ok = await useConnectionStore.getState().reimportSpec(conn.id);
    if (!ok) return JSON.stringify({ success: false, error: 'Failed to reimport spec.' });
    const updated = useConnectionStore.getState().getConnection(conn.id);
    return JSON.stringify({ success: true, connectionId: conn.id, name: conn.name, endpointCount: updated?.endpoints.length || 0 });
  },
});

const importGraphQLTool = tool({
  description: 'Connect a GraphQL API by its endpoint URL. Performs introspection to discover queries and mutations.',
  inputSchema: z.object({
    url: z.string().describe('GraphQL endpoint URL'),
    name: z.string().optional().describe('Name for the connection'),
  }),
  execute: async ({ url, name }) => {
    try {
      const conn = await useConnectionStore.getState().importGraphQLEndpoint(url, name);
      if (!conn) return JSON.stringify({ success: false, error: 'GraphQL introspection failed.' });
      notifyView('connections');
      return JSON.stringify({ success: true, connectionId: conn.id, name: conn.name, baseUrl: conn.baseUrl, endpointCount: conn.endpoints.length });
    } catch (e: any) { return JSON.stringify({ success: false, error: e.message }); }
  },
});

const importGrpcProtoTool = tool({
  description: 'Connect a gRPC service by loading a .proto file.',
  inputSchema: z.object({
    server_url: z.string().describe('gRPC server address (e.g. "localhost:50051")'),
    file_path: z.string().describe('Path to the .proto file'),
    name: z.string().optional().describe('Name for the connection'),
  }),
  execute: async ({ server_url, file_path, name }) => {
    try {
      const conn = await useConnectionStore.getState().importGrpcProto(server_url, file_path, name);
      if (!conn) return JSON.stringify({ success: false, error: 'Failed to load proto file.' });
      notifyView('connections');
      return JSON.stringify({ success: true, connectionId: conn.id, name: conn.name, endpointCount: conn.endpoints.length });
    } catch (e: any) { return JSON.stringify({ success: false, error: e.message }); }
  },
});

const importGrpcReflectionTool = tool({
  description: 'Connect a gRPC service via server reflection.',
  inputSchema: z.object({
    server_url: z.string().describe('gRPC server address'),
    tls_enabled: z.boolean().optional().describe('Use TLS (default false)'),
    name: z.string().optional().describe('Name for the connection'),
  }),
  execute: async ({ server_url, tls_enabled, name }) => {
    try {
      const conn = await useConnectionStore.getState().importGrpcReflection(server_url, tls_enabled || false, name);
      if (!conn) return JSON.stringify({ success: false, error: 'gRPC server reflection failed.' });
      notifyView('connections');
      return JSON.stringify({ success: true, connectionId: conn.id, name: conn.name, endpointCount: conn.endpoints.length });
    } catch (e: any) { return JSON.stringify({ success: false, error: e.message }); }
  },
});

// ── P1: History Access ──

const searchHistoryTool = tool({
  description: 'Search request history by URL, method, or keyword. Returns recent history entries.',
  inputSchema: z.object({
    query: z.string().optional().describe('Search keyword. Leave empty for recent history.'),
    limit: z.number().optional().describe('Max results (default 20)'),
  }),
  execute: async ({ query, limit }) => {
    const store = useRequestStore.getState();
    if (query) { await store.searchHistory(query); } else { await store.loadHistory(); }
    const { history } = useRequestStore.getState();
    return JSON.stringify({
      results: history.slice(0, limit || 20).map(h => ({
        id: h.id, method: h.method, url: h.url, status: h.status,
        duration: h.duration, responseSize: h.responseSize, timestamp: h.timestamp, requestId: h.requestId,
      })),
      total: history.length,
    });
  },
});

const getHistoryEntryTool = tool({
  description: 'Get full details of a history entry including request and response data.',
  inputSchema: z.object({ history_id: z.string().describe('History entry ID') }),
  execute: async ({ history_id }) => {
    const { history } = useRequestStore.getState();
    const entry = history.find(h => h.id === history_id);
    if (!entry) return JSON.stringify({ success: false, error: `No history entry "${history_id}" found.` });
    return JSON.stringify({
      success: true,
      request: { name: entry.request.name, method: entry.request.method, url: entry.request.url, headers: entry.request.headers?.filter(h => h.key), body: entry.request.body },
      response: { status: entry.response.status, statusText: entry.response.statusText, duration: entry.response.duration, size: entry.response.size, headers: entry.response.headers, body: truncateBody(entry.response.body) },
    });
  },
});

const replayRequestTool = tool({
  description: 'Replay a request from history — loads the historical request config and sends it.',
  inputSchema: z.object({ history_id: z.string().describe('History entry ID to replay') }),
  execute: async ({ history_id }) => {
    const { history } = useRequestStore.getState();
    const entry = history.find(h => h.id === history_id);
    if (!entry) return JSON.stringify({ success: false, error: `No history entry "${history_id}" found.` });
    useRequestStore.getState().selectRequest(entry.request);
    const variables = useEnvironmentStore.getState().resolveVariables();
    await useRequestStore.getState().sendRequest(variables);
    const { response } = useRequestStore.getState();
    if (!response) return JSON.stringify({ success: false, error: 'Replay failed.' });
    return JSON.stringify({ success: true, replayed: { method: entry.request.method, url: entry.request.url }, status: response.status, statusText: response.statusText, duration: response.duration, body: truncateBody(response.body) });
  },
});

const clearHistoryTool = tool({
  description: 'Clear all request history.',
  inputSchema: z.object({}),
  execute: async () => { await useRequestStore.getState().clearHistory(); return JSON.stringify({ success: true }); },
});

// ── P1: gRPC Tools ──

const createGrpcRequestTool = tool({
  description: 'Create a new gRPC request with server URL, service, method, and message body.',
  inputSchema: z.object({
    name: z.string().optional().describe('Name for the request'),
    server_url: z.string().describe('gRPC server address'),
    service_name: z.string().describe('Full service name'),
    method_name: z.string().describe('Method name'),
    message: z.string().optional().describe('JSON message body'),
    proto_file_path: z.string().optional().describe('Path to .proto file'),
    tls_enabled: z.boolean().optional(),
    deadline: z.number().optional().describe('Deadline in milliseconds'),
    metadata: z.array(kvItemSchema).optional(),
  }),
  execute: async (args) => {
    const store = useGrpcStore.getState();
    store.newRequest();
    store.updateActiveRequest({
      name: args.name || `${args.service_name}.${args.method_name}`,
      serverUrl: args.server_url, serviceName: args.service_name, methodName: args.method_name,
      message: args.message || '{}', protoFilePath: args.proto_file_path || '',
      tlsEnabled: args.tls_enabled || false, deadline: args.deadline,
      metadata: args.metadata ? args.metadata.map(m => ({ key: m.key, value: m.value, enabled: true })) : [{ key: '', value: '', enabled: true }],
    });
    if (args.proto_file_path) await store.loadProto(args.proto_file_path);
    useUiStore.getState().setActiveProtocol('grpc');
    notifyView('requests');
    return JSON.stringify({ success: true, requestId: useGrpcStore.getState().activeRequest.id, name: useGrpcStore.getState().activeRequest.name, serverUrl: args.server_url, service: args.service_name, method: args.method_name });
  },
});

const sendGrpcRequestTool = tool({
  description: 'Send the currently active gRPC request and return the response.',
  inputSchema: z.object({}),
  execute: async () => {
    const store = useGrpcStore.getState();
    const req = store.activeRequest;
    if (!req.serverUrl) return JSON.stringify({ success: false, error: 'No server URL set.' });
    if (!req.serviceName || !req.methodName) return JSON.stringify({ success: false, error: 'No service/method set.' });
    await store.sendRequest();
    const { response } = useGrpcStore.getState();
    if (!response) return JSON.stringify({ success: false, error: 'gRPC request failed.' });
    return JSON.stringify({
      success: true, status: response.status, statusMessage: response.statusMessage, duration: response.duration,
      metadata: response.metadata, trailers: response.trailers, body: truncateBody(response.body),
      messageCount: response.messages.length,
      messages: response.messages.slice(0, 10).map(m => ({ direction: m.direction, data: truncateBody(m.data, 1000), timestamp: m.timestamp })),
    });
  },
});

const listGrpcServicesTool = tool({
  description: 'List all gRPC services and methods from a connected gRPC API.',
  inputSchema: z.object({ connection_match: z.string().describe('Connection name or ID') }),
  execute: async ({ connection_match }) => {
    const conn = findConnection(connection_match);
    if (!conn) return JSON.stringify({ success: false, error: `No connection matching "${connection_match}" found.` });
    if (conn.specType !== 'grpc') return JSON.stringify({ success: false, error: `"${conn.name}" is not a gRPC connection.` });
    if (conn.protoDefinition) {
      return JSON.stringify({
        success: true, connectionId: conn.id,
        services: conn.protoDefinition.services.map(s => ({ name: s.name, fullName: s.fullName, methods: s.methods.map(m => ({ name: m.name, fullName: m.fullName, type: m.methodType, inputType: m.inputType, outputType: m.outputType })) })),
      });
    }
    return JSON.stringify({ success: true, connectionId: conn.id, endpoints: conn.endpoints.map(ep => ({ path: ep.path, summary: ep.summary })) });
  },
});

// ── P1: Batch Edit ──

const updateRequestsTool = tool({
  description: 'Batch-update multiple requests by name/ID. Apply per-request changes.',
  inputSchema: z.object({
    updates: z.array(z.object({
      match: z.string().describe('Request name or ID'),
      name: z.string().optional(), method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']).optional(),
      url: z.string().optional(), headers: z.array(kvItemSchema).optional(), params: z.array(kvItemSchema).optional(),
      body_type: z.enum(['none', 'json', 'form-data', 'raw']).optional(), body_content: z.string().optional(),
      connection_id: z.string().optional(), endpoint_id: z.string().optional(),
    })).min(1),
  }),
  execute: async ({ updates }) => {
    const results: Array<{ match: string; success: boolean; requestId?: string; error?: string }> = [];
    for (const u of updates) {
      const found = findRequest(u.match);
      if (!found) { results.push({ match: u.match, success: false, error: `Not found` }); continue; }
      const changes: Record<string, unknown> = {};
      if (u.name) changes.name = u.name;
      if (u.method) changes.method = u.method;
      if (u.url) changes.url = u.url;
      if (u.headers) changes.headers = kv(u.headers);
      if (u.params) changes.params = kv(u.params);
      if (u.body_type || u.body_content) changes.body = { type: u.body_type || 'none', raw: compactJson(u.body_content) };
      if (u.connection_id) changes.connectionId = u.connection_id;
      if (u.endpoint_id) changes.endpointId = u.endpoint_id;
      changes.updatedAt = new Date().toISOString();
      try { await window.ruke.db.query('updateRequest', found.id, changes); results.push({ match: u.match, success: true, requestId: found.id }); }
      catch (e: any) { results.push({ match: u.match, success: false, requestId: found.id, error: e.message }); }
    }
    await useRequestStore.getState().loadUncollectedRequests();
    await useRequestStore.getState().loadArchivedRequests();
    for (const c of useCollectionStore.getState().collections) await useCollectionStore.getState().loadRequests(c.id);
    notifyView('requests');
    return JSON.stringify({ results, updated: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length });
  },
});

const unarchiveRequestTool = tool({
  description: 'Restore an archived request back to the main list.',
  inputSchema: z.object({ match: z.string().describe('Request name or ID') }),
  execute: async ({ match }) => {
    const matchStr = match.toLowerCase();
    const found = useRequestStore.getState().archivedRequests.find(r => r.id === match || (r.name || '').toLowerCase().includes(matchStr));
    if (!found) return JSON.stringify({ success: false, error: `No archived request matching "${match}" found.` });
    await useRequestStore.getState().unarchiveRequest(found.id);
    notifyView('requests');
    return JSON.stringify({ success: true, restored: { id: found.id, name: found.name } });
  },
});

// ── P1: Testing and Assertions ──

interface TestAssertion {
  id: string; description: string;
  type: 'status' | 'header' | 'body_contains' | 'body_json_path' | 'response_time' | 'body_schema';
  expected: string;
  operator?: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'matches_regex' | 'exists';
  json_path?: string;
}

interface TestDefinition {
  id: string; name: string; requestId: string; requestName: string;
  assertions: TestAssertion[]; createdAt: string;
}

const TEST_STORAGE_KEY = 'ruke:tests';
function loadTests(): TestDefinition[] { try { return JSON.parse(localStorage.getItem(TEST_STORAGE_KEY) || '[]'); } catch { return []; } }
function saveTests(tests: TestDefinition[]) { localStorage.setItem(TEST_STORAGE_KEY, JSON.stringify(tests)); }

function evaluateAssertion(assertion: TestAssertion, response: { status: number; statusText: string; headers: Record<string, string>; body: string; duration: number }): { pass: boolean; actual: string; message: string } {
  const op = assertion.operator || 'equals';
  function compare(actual: string, expected: string, operator: string): { pass: boolean; message: string } {
    switch (operator) {
      case 'equals': return { pass: actual === expected, message: `Expected "${expected}", got "${actual}"` };
      case 'not_equals': return { pass: actual !== expected, message: `Expected not "${expected}", got "${actual}"` };
      case 'contains': return { pass: actual.includes(expected), message: `Expected to contain "${expected}"` };
      case 'not_contains': return { pass: !actual.includes(expected), message: `Expected not to contain "${expected}"` };
      case 'greater_than': return { pass: Number(actual) > Number(expected), message: `Expected > ${expected}, got ${actual}` };
      case 'less_than': return { pass: Number(actual) < Number(expected), message: `Expected < ${expected}, got ${actual}` };
      case 'matches_regex': { try { return { pass: new RegExp(expected).test(actual), message: `Regex /${expected}/ ${new RegExp(expected).test(actual) ? 'matched' : 'did not match'}` }; } catch { return { pass: false, message: `Invalid regex: ${expected}` }; } }
      case 'exists': return { pass: actual !== '' && actual !== 'undefined', message: actual ? 'Value exists' : 'Value missing' };
      default: return { pass: actual === expected, message: `Expected "${expected}", got "${actual}"` };
    }
  }
  switch (assertion.type) {
    case 'status': { const actual = String(response.status); return { ...compare(actual, assertion.expected, op), actual }; }
    case 'header': { const hName = assertion.json_path || ''; const actual = response.headers[hName.toLowerCase()] || response.headers[hName] || ''; return { ...compare(actual, assertion.expected, op), actual }; }
    case 'body_contains': { return { ...compare(response.body, assertion.expected, 'contains'), actual: `(body length: ${response.body.length})` }; }
    case 'body_json_path': {
      try {
        const parsed = JSON.parse(response.body);
        const parts = (assertion.json_path || '').replace(/\[(\d+)\]/g, '.$1').split('.');
        let val: unknown = parsed;
        for (const p of parts) { if (val == null || typeof val !== 'object') { val = undefined; break; } val = (val as Record<string, unknown>)[p]; }
        const actual = val === undefined ? 'undefined' : (typeof val === 'object' ? JSON.stringify(val) : String(val));
        return { ...compare(actual, assertion.expected, op), actual };
      } catch { return { pass: false, actual: '(parse error)', message: 'Response body is not valid JSON' }; }
    }
    case 'response_time': { const actual = String(response.duration); return { ...compare(actual, assertion.expected, op || 'less_than'), actual: `${response.duration}ms` }; }
    default: return { pass: false, actual: '', message: `Unknown assertion type: ${assertion.type}` };
  }
}

const createTestTool = tool({
  description: 'Create a test with assertions for a request. Tests can check status codes, headers, body content, JSON paths, and response times.',
  inputSchema: z.object({
    request_match: z.string().describe('Request name or ID to test'),
    name: z.string().describe('Test name'),
    assertions: z.array(z.object({
      description: z.string().describe('Human-readable description'),
      type: z.enum(['status', 'header', 'body_contains', 'body_json_path', 'response_time']),
      expected: z.string().describe('Expected value'),
      operator: z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'matches_regex', 'exists']).optional(),
      json_path: z.string().optional().describe('For body_json_path: dot-notation path. For header: header name.'),
    })).min(1),
  }),
  execute: async ({ request_match, name, assertions }) => {
    const req = findRequest(request_match);
    if (!req) return JSON.stringify({ success: false, error: `No request matching "${request_match}" found.` });
    const { nanoid } = await import('nanoid');
    const test: TestDefinition = {
      id: nanoid(), name, requestId: req.id, requestName: req.name,
      assertions: assertions.map(a => ({ id: nanoid(), description: a.description, type: a.type, expected: a.expected, operator: a.operator, json_path: a.json_path })),
      createdAt: new Date().toISOString(),
    };
    const tests = loadTests(); tests.push(test); saveTests(tests);
    return JSON.stringify({ success: true, testId: test.id, name: test.name, assertionCount: test.assertions.length, requestName: req.name });
  },
});

const runTestsTool = tool({
  description: 'Run tests for a request. Sends the request and evaluates all assertions.',
  inputSchema: z.object({
    request_match: z.string().optional().describe('Request name or ID. If omitted, uses active request.'),
    test_id: z.string().optional().describe('Specific test ID. If omitted, runs all tests for the request.'),
  }),
  execute: async ({ request_match, test_id }) => {
    const tests = loadTests();
    let targetRequestId: string;
    if (request_match) {
      const req = findRequest(request_match);
      if (!req) return JSON.stringify({ success: false, error: `No request matching "${request_match}" found.` });
      targetRequestId = req.id;
      const allRequests = [...useRequestStore.getState().uncollectedRequests, ...useRequestStore.getState().archivedRequests];
      for (const reqs of Object.values(useCollectionStore.getState().requests)) allRequests.push(...reqs);
      const fullReq = allRequests.find(r => r.id === req.id);
      if (fullReq) useRequestStore.getState().selectRequest(fullReq);
    } else { targetRequestId = useRequestStore.getState().activeRequest.id; }
    let matchedTests = tests.filter(t => t.requestId === targetRequestId);
    if (test_id) matchedTests = matchedTests.filter(t => t.id === test_id);
    if (matchedTests.length === 0) return JSON.stringify({ success: false, error: 'No tests found for this request.' });
    await useRequestStore.getState().sendRequest(useEnvironmentStore.getState().resolveVariables());
    const { response } = useRequestStore.getState();
    if (!response) return JSON.stringify({ success: false, error: 'Request failed — cannot run tests.' });
    const testResults = matchedTests.map(test => ({
      testId: test.id, testName: test.name,
      assertions: test.assertions.map(a => { const result = evaluateAssertion(a, response); return { description: a.description, type: a.type, expected: a.expected, ...result }; }),
    }));
    const totalAssertions = testResults.reduce((s, t) => s + t.assertions.length, 0);
    const passed = testResults.reduce((s, t) => s + t.assertions.filter(a => a.pass).length, 0);
    return JSON.stringify({ success: true, summary: { total: totalAssertions, passed, failed: totalAssertions - passed }, status: response.status, duration: response.duration, tests: testResults });
  },
});

const listTestsTool = tool({
  description: 'List all defined tests, optionally filtered by request.',
  inputSchema: z.object({ request_match: z.string().optional() }),
  execute: async ({ request_match }) => {
    let tests = loadTests();
    if (request_match) { const req = findRequest(request_match); if (req) tests = tests.filter(t => t.requestId === req.id); }
    return JSON.stringify({ tests: tests.map(t => ({ id: t.id, name: t.name, requestId: t.requestId, requestName: t.requestName, assertionCount: t.assertions.length, createdAt: t.createdAt })), total: tests.length });
  },
});

const deleteTestTool = tool({
  description: 'Delete a test by ID or name.',
  inputSchema: z.object({ match: z.string().describe('Test ID or name') }),
  execute: async ({ match }) => {
    const tests = loadTests();
    const matchStr = match.toLowerCase();
    const idx = tests.findIndex(t => t.id === match || t.name.toLowerCase().includes(matchStr));
    if (idx === -1) return JSON.stringify({ success: false, error: `No test matching "${match}" found.` });
    const removed = tests.splice(idx, 1)[0]; saveTests(tests);
    return JSON.stringify({ success: true, deleted: { id: removed.id, name: removed.name } });
  },
});

const runCollectionTestsTool = tool({
  description: 'Run all tests for all requests in a collection.',
  inputSchema: z.object({ collection_match: z.string().describe('Collection name or ID') }),
  execute: async ({ collection_match }) => {
    const col = findCollection(collection_match);
    if (!col) return JSON.stringify({ success: false, error: `No collection matching "${collection_match}" found.` });
    const colRequests = useCollectionStore.getState().requests[col.id] || [];
    if (colRequests.length === 0) return JSON.stringify({ success: false, error: `Collection "${col.name}" has no requests.` });
    const tests = loadTests();
    const allResults: Array<{ requestName: string; method: string; url: string; status: number; testsRun: number; passed: number; failed: number }> = [];
    for (const req of colRequests) {
      const reqTests = tests.filter(t => t.requestId === req.id);
      useRequestStore.getState().selectRequest(req);
      await useRequestStore.getState().sendRequest(useEnvironmentStore.getState().resolveVariables());
      const { response } = useRequestStore.getState();
      if (!response) { allResults.push({ requestName: req.name, method: req.method, url: req.url, status: 0, testsRun: 0, passed: 0, failed: reqTests.reduce((s, t) => s + t.assertions.length, 0) }); continue; }
      let passed = 0; let total = 0;
      for (const test of reqTests) { for (const a of test.assertions) { total++; if (evaluateAssertion(a, response).pass) passed++; } }
      allResults.push({ requestName: req.name, method: req.method, url: req.url, status: response.status, testsRun: total, passed, failed: total - passed });
    }
    const totalPassed = allResults.reduce((s, r) => s + r.passed, 0);
    const totalFailed = allResults.reduce((s, r) => s + r.failed, 0);
    return JSON.stringify({ success: true, collection: col.name, summary: { requests: allResults.length, totalAssertions: totalPassed + totalFailed, passed: totalPassed, failed: totalFailed }, results: allResults });
  },
});

// ── P1: Workflows / Request Chaining ──

interface WorkflowStep { requestMatch: string; extractVariables?: Array<{ name: string; jsonPath: string }>; condition?: { jsonPath: string; operator: 'equals' | 'not_equals' | 'exists'; value?: string }; delay?: number; }
interface WorkflowDefinition { id: string; name: string; steps: WorkflowStep[]; createdAt: string; }

const WORKFLOW_STORAGE_KEY = 'ruke:workflows';
function loadWorkflows(): WorkflowDefinition[] { try { return JSON.parse(localStorage.getItem(WORKFLOW_STORAGE_KEY) || '[]'); } catch { return []; } }
function saveWorkflows(workflows: WorkflowDefinition[]) { localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(workflows)); }

function extractJsonPath(body: string, path: string): string | undefined {
  try {
    const parsed = JSON.parse(body);
    const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let val: unknown = parsed;
    for (const p of parts) { if (val == null || typeof val !== 'object') return undefined; val = (val as Record<string, unknown>)[p]; }
    return val === undefined ? undefined : (typeof val === 'object' ? JSON.stringify(val) : String(val));
  } catch { return undefined; }
}

const createWorkflowTool = tool({
  description: 'Create a workflow (request chain). Steps execute sequentially; each step can extract response data into variables for subsequent steps via {{variable}} interpolation.',
  inputSchema: z.object({
    name: z.string().describe('Workflow name'),
    steps: z.array(z.object({
      request_match: z.string().describe('Request name or ID to execute'),
      extract_variables: z.array(z.object({
        name: z.string().describe('Variable name to set'),
        json_path: z.string().describe('JSON path to extract from response body'),
      })).optional(),
      condition: z.object({
        json_path: z.string(), operator: z.enum(['equals', 'not_equals', 'exists']),
        value: z.string().optional(),
      }).optional(),
      delay: z.number().optional().describe('Ms to wait before next step'),
    })).min(1),
  }),
  execute: async ({ name, steps }) => {
    const { nanoid } = await import('nanoid');
    const workflow: WorkflowDefinition = {
      id: nanoid(), name,
      steps: steps.map(s => ({
        requestMatch: s.request_match,
        extractVariables: s.extract_variables?.map(v => ({ name: v.name, jsonPath: v.json_path })),
        condition: s.condition ? { jsonPath: s.condition.json_path, operator: s.condition.operator, value: s.condition.value } : undefined,
        delay: s.delay,
      })),
      createdAt: new Date().toISOString(),
    };
    const workflows = loadWorkflows(); workflows.push(workflow); saveWorkflows(workflows);
    return JSON.stringify({ success: true, workflowId: workflow.id, name: workflow.name, stepCount: workflow.steps.length });
  },
});

const runWorkflowTool = tool({
  description: 'Run a workflow (request chain). Executes steps sequentially, passing extracted variables between steps.',
  inputSchema: z.object({
    match: z.string().describe('Workflow name or ID'),
    initial_variables: z.record(z.string(), z.string()).optional().describe('Initial variables for all steps'),
  }),
  execute: async ({ match, initial_variables }) => {
    const workflows = loadWorkflows();
    const matchStr = match.toLowerCase();
    const workflow = workflows.find(w => w.id === match || w.name.toLowerCase().includes(matchStr));
    if (!workflow) return JSON.stringify({ success: false, error: `No workflow matching "${match}" found.` });
    const runtimeVars: Record<string, string> = Object.assign({}, initial_variables || {});
    const stepResults: Array<{ step: number; requestName: string; status: number; duration: number; extracted?: Record<string, string>; skipped?: boolean; skipReason?: string }> = [];
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      let requestMatchStr = step.requestMatch;
      for (const [k, v] of Object.entries(runtimeVars)) requestMatchStr = requestMatchStr.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
      const req = findRequest(requestMatchStr);
      if (!req) { stepResults.push({ step: i + 1, requestName: requestMatchStr, status: 0, duration: 0, skipped: true, skipReason: `Request not found` }); continue; }
      const allRequests = [...useRequestStore.getState().uncollectedRequests, ...useRequestStore.getState().archivedRequests];
      for (const reqs of Object.values(useCollectionStore.getState().requests)) allRequests.push(...reqs);
      const fullReq = allRequests.find(r => r.id === req.id);
      if (!fullReq) { stepResults.push({ step: i + 1, requestName: req.name, status: 0, duration: 0, skipped: true, skipReason: 'Could not load request' }); continue; }
      const interpolated = { ...fullReq };
      for (const [k, v] of Object.entries(runtimeVars)) {
        interpolated.url = interpolated.url.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
        if (interpolated.body?.raw) interpolated.body = { ...interpolated.body, raw: interpolated.body.raw.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v) };
      }
      useRequestStore.getState().selectRequest(interpolated);
      await useRequestStore.getState().sendRequest({ ...useEnvironmentStore.getState().resolveVariables(), ...runtimeVars });
      const { response } = useRequestStore.getState();
      if (!response) { stepResults.push({ step: i + 1, requestName: req.name, status: 0, duration: 0, skipped: true, skipReason: 'Request failed' }); continue; }
      const extracted: Record<string, string> = {};
      if (step.extractVariables) { for (const ev of step.extractVariables) { const val = extractJsonPath(response.body, ev.jsonPath); if (val !== undefined) { runtimeVars[ev.name] = val; extracted[ev.name] = val; } } }
      stepResults.push({ step: i + 1, requestName: req.name, status: response.status, duration: response.duration, extracted: Object.keys(extracted).length > 0 ? extracted : undefined });
      if (step.condition) {
        const condVal = extractJsonPath(response.body, step.condition.jsonPath);
        let condMet = false;
        switch (step.condition.operator) { case 'equals': condMet = condVal === step.condition.value; break; case 'not_equals': condMet = condVal !== step.condition.value; break; case 'exists': condMet = condVal !== undefined && condVal !== ''; break; }
        if (!condMet) { stepResults.push({ step: i + 2, requestName: '(skipped)', status: 0, duration: 0, skipped: true, skipReason: `Condition not met` }); break; }
      }
      if (step.delay && step.delay > 0) await new Promise(resolve => setTimeout(resolve, Math.min(step.delay ?? 0, 10000)));
    }
    return JSON.stringify({ success: true, workflow: workflow.name, summary: { totalSteps: workflow.steps.length, executed: stepResults.filter(s => !s.skipped).length, skipped: stepResults.filter(s => s.skipped).length }, variables: runtimeVars, steps: stepResults });
  },
});

const listWorkflowsTool = tool({
  description: 'List all defined workflows.',
  inputSchema: z.object({}),
  execute: async () => {
    const workflows = loadWorkflows();
    return JSON.stringify({ workflows: workflows.map(w => ({ id: w.id, name: w.name, stepCount: w.steps.length, createdAt: w.createdAt })), total: workflows.length });
  },
});

const deleteWorkflowTool = tool({
  description: 'Delete a workflow by name or ID.',
  inputSchema: z.object({ match: z.string().describe('Workflow name or ID') }),
  execute: async ({ match }) => {
    const workflows = loadWorkflows();
    const matchStr = match.toLowerCase();
    const idx = workflows.findIndex(w => w.id === match || w.name.toLowerCase().includes(matchStr));
    if (idx === -1) return JSON.stringify({ success: false, error: `No workflow matching "${match}" found.` });
    const removed = workflows.splice(idx, 1)[0]; saveWorkflows(workflows);
    return JSON.stringify({ success: true, deleted: { id: removed.id, name: removed.name } });
  },
});

// ── P2: AI Documentation Generation ──

const generateDocsTool = tool({
  description: 'Generate API documentation for a connection. Produces markdown with endpoints, parameters, examples, and auth details.',
  inputSchema: z.object({
    connection_match: z.string().describe('Connection name or ID'),
    include_examples: z.boolean().optional().describe('Include examples from history (default true)'),
  }),
  execute: async ({ connection_match, include_examples }) => {
    const conn = findConnection(connection_match);
    if (!conn) return JSON.stringify({ success: false, error: `No connection matching "${connection_match}" found.` });
    const lines: string[] = [`# ${conn.name} API Documentation`, ''];
    if (conn.description) lines.push(conn.description, '');
    lines.push(`**Base URL:** \`${conn.baseUrl}\``, `**Type:** ${conn.specType}`);
    if (conn.auth.type !== 'none') lines.push(`**Auth:** ${conn.auth.type}`);
    lines.push('', '---', '');
    const grouped = new Map<string, typeof conn.endpoints>();
    for (const ep of conn.endpoints) { const tag = ep.tags?.[0] || 'General'; if (!grouped.has(tag)) grouped.set(tag, []); grouped.get(tag)!.push(ep); }
    for (const [tag, endpoints] of grouped) {
      lines.push(`## ${tag}`, '');
      for (const ep of endpoints) {
        lines.push(`### ${ep.method} \`${ep.path}\``);
        if (ep.summary) lines.push(`> ${ep.summary}`);
        if (ep.description) lines.push(`\n${ep.description}`);
        lines.push('');
        if (ep.parameters?.length) {
          lines.push('**Parameters:**', '| Name | In | Type | Required | Description |', '|------|-----|------|----------|-------------|');
          for (const p of ep.parameters) lines.push(`| \`${p.name}\` | ${p.in} | ${p.type} | ${p.required ? 'Yes' : 'No'} | ${p.description || ''} |`);
          lines.push('');
        }
        if (ep.requestBody) {
          lines.push(`**Request Body** (${ep.requestBody.type}):`);
          if (ep.requestBody.example) lines.push('```json', ep.requestBody.example.slice(0, 500), '```');
          lines.push('');
        }
      }
    }
    if (include_examples !== false) {
      await useRequestStore.getState().loadHistory();
      const connHistory = useRequestStore.getState().history.filter(h => (h.url || '').includes(conn.baseUrl) || h.request?.connectionId === conn.id).slice(0, 5);
      if (connHistory.length > 0) {
        lines.push('---', '', '## Recent Examples', '');
        for (const h of connHistory) {
          lines.push(`### ${h.method} \`${h.url}\` — ${h.status}`, `Duration: ${h.duration}ms`);
          if (h.response?.body) lines.push('```json', truncateBody(h.response.body, 500), '```');
          lines.push('');
        }
      }
    }
    return JSON.stringify({ success: true, markdown: lines.join('\n'), endpointCount: conn.endpoints.length });
  },
});

// ── P2: Proactive Agent ──

const analyzeWorkspaceTool = tool({
  description: 'Analyze the workspace and suggest improvements. Checks for uncollected requests, missing auth, hardcoded URLs, missing tests, and organization issues. Use this proactively when the user asks "what should I do?" or "any suggestions?".',
  inputSchema: z.object({}),
  execute: async () => {
    const connStore = useConnectionStore.getState();
    const reqStore = useRequestStore.getState();
    const colStore = useCollectionStore.getState();
    const envStore = useEnvironmentStore.getState();
    const tests = loadTests();
    const workflows = loadWorkflows();

    await reqStore.loadUncollectedRequests();
    await reqStore.loadArchivedRequests();

    const suggestions: Array<{ priority: 'high' | 'medium' | 'low'; category: string; suggestion: string }> = [];

    if (reqStore.uncollectedRequests.length > 5) {
      suggestions.push({ priority: 'high', category: 'organization', suggestion: `You have ${reqStore.uncollectedRequests.length} uncollected requests. Consider organizing them into collections.` });
    }

    const unauthConns = connStore.connections.filter(c => c.auth.type === 'none' && c.endpoints.length > 0);
    for (const c of unauthConns) {
      suggestions.push({ priority: 'high', category: 'auth', suggestion: `Connection "${c.name}" has no auth configured. Most APIs require authentication.` });
    }

    if (envStore.environments.length === 0 && connStore.connections.length > 0) {
      suggestions.push({ priority: 'medium', category: 'environments', suggestion: 'No environments configured. Consider creating dev/staging/production environments.' });
    }

    const requestsWithTests = new Set(tests.map(t => t.requestId));
    const allRequestIds = [...reqStore.uncollectedRequests.map(r => r.id)];
    for (const reqs of Object.values(colStore.requests)) allRequestIds.push(...reqs.map(r => r.id));
    const untestedCount = allRequestIds.filter(id => !requestsWithTests.has(id)).length;
    if (untestedCount > 0 && allRequestIds.length > 0) {
      suggestions.push({ priority: 'medium', category: 'testing', suggestion: `${untestedCount} of ${allRequestIds.length} requests have no tests. Consider adding assertions.` });
    }

    const hardcodedUrls = reqStore.uncollectedRequests.filter(r => r.url.startsWith('http') && !r.connectionId);
    if (hardcodedUrls.length > 0) {
      suggestions.push({ priority: 'medium', category: 'connections', suggestion: `${hardcodedUrls.length} requests have hardcoded URLs without connections. Consider connecting these APIs.` });
    }

    if (reqStore.archivedRequests.length > 10) {
      suggestions.push({ priority: 'low', category: 'cleanup', suggestion: `${reqStore.archivedRequests.length} archived requests. Consider deleting old ones.` });
    }

    if (workflows.length === 0 && allRequestIds.length > 3) {
      suggestions.push({ priority: 'low', category: 'automation', suggestion: 'No workflows defined. Consider creating request chains for common flows.' });
    }

    return JSON.stringify({
      summary: {
        connections: connStore.connections.length,
        requests: allRequestIds.length,
        uncollected: reqStore.uncollectedRequests.length,
        environments: envStore.environments.length,
        tests: tests.length,
        workflows: workflows.length,
      },
      suggestions,
    });
  },
});

// ── P2: Agent Memory ──

interface MemoryEntry {
  id: string;
  type: 'preference' | 'correction' | 'knowledge';
  content: string;
  createdAt: string;
}

const MEMORY_STORAGE_KEY = 'ruke:agent_memory';
function loadMemory(): MemoryEntry[] { try { return JSON.parse(localStorage.getItem(MEMORY_STORAGE_KEY) || '[]'); } catch { return []; } }
function saveMemory(entries: MemoryEntry[]) { localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(entries)); }

const saveMemoryTool = tool({
  description: 'Save a preference, correction, or piece of knowledge to persistent memory. Use this when the user tells you a preference (e.g. "I prefer snake_case"), corrects you, or when you learn something important about their APIs.',
  inputSchema: z.object({
    type: z.enum(['preference', 'correction', 'knowledge']).describe('Type of memory'),
    content: z.string().describe('What to remember'),
  }),
  execute: async ({ type, content }) => {
    const { nanoid } = await import('nanoid');
    const entries = loadMemory();
    const existing = entries.find(e => e.content.toLowerCase() === content.toLowerCase());
    if (existing) return JSON.stringify({ success: true, note: 'Already remembered.' });
    entries.push({ id: nanoid(), type, content, createdAt: new Date().toISOString() });
    if (entries.length > 100) entries.splice(0, entries.length - 100);
    saveMemory(entries);
    return JSON.stringify({ success: true, memorized: { type, content } });
  },
});

const recallMemoryTool = tool({
  description: 'Recall all saved memories (preferences, corrections, knowledge). Use this at the start of complex tasks to check for user preferences.',
  inputSchema: z.object({
    type: z.enum(['preference', 'correction', 'knowledge', 'all']).optional().describe('Filter by type'),
  }),
  execute: async ({ type }) => {
    let entries = loadMemory();
    if (type && type !== 'all') entries = entries.filter(e => e.type === type);
    return JSON.stringify({ memories: entries.map(e => ({ type: e.type, content: e.content, createdAt: e.createdAt })), total: entries.length });
  },
});

const clearMemoryTool = tool({
  description: 'Clear all or specific agent memories.',
  inputSchema: z.object({
    type: z.enum(['preference', 'correction', 'knowledge', 'all']).optional().describe('Clear specific type or all'),
  }),
  execute: async ({ type }) => {
    if (!type || type === 'all') { saveMemory([]); return JSON.stringify({ success: true, cleared: 'all' }); }
    const entries = loadMemory().filter(e => e.type !== type);
    saveMemory(entries);
    return JSON.stringify({ success: true, cleared: type, remaining: entries.length });
  },
});

// ── Exported tools object (keyed by name for streamText) ──

export const AGENT_TOOLS = {
  // Connections
  list_connections: listConnectionsTool,
  search_endpoints: searchEndpointsTool,
  connect_api: connectApiTool,
  import_spec: importSpecTool,
  import_graphql: importGraphQLTool,
  import_grpc_proto: importGrpcProtoTool,
  import_grpc_reflection: importGrpcReflectionTool,
  set_connection_auth: setConnectionAuthTool,
  update_connection: updateConnectionTool,
  delete_connection: deleteConnectionTool,
  reimport_spec: reimportSpecTool,
  // Requests
  create_request: createRequestTool,
  create_requests: createRequestsTool,
  update_requests: updateRequestsTool,
  edit_current_request: editCurrentRequestTool,
  select_request: selectRequestTool,
  send_request: sendRequestTool,
  send_request_by_id: sendRequestByIdTool,
  list_requests: listRequestsTool,
  search_requests: searchRequestsTool,
  delete_request: deleteRequestTool,
  archive_request: archiveRequestTool,
  unarchive_request: unarchiveRequestTool,
  move_request_to_collection: moveRequestToCollectionTool,
  // Response
  get_response: getResponseTool,
  get_response_body: getResponseBodyTool,
  get_response_headers: getResponseHeadersTool,
  // Collections
  create_collection: createCollectionTool,
  list_collections: listCollectionsTool,
  rename_collection: renameCollectionTool,
  delete_collection: deleteCollectionTool,
  // Environments
  create_environment: createEnvironmentTool,
  list_environments: listEnvironmentsTool,
  update_environment: updateEnvironmentTool,
  delete_environment: deleteEnvironmentTool,
  set_active_environment: setActiveEnvironmentTool,
  add_variable: addVariableTool,
  update_variable: updateVariableTool,
  delete_variable: deleteVariableTool,
  // History
  search_history: searchHistoryTool,
  get_history_entry: getHistoryEntryTool,
  replay_request: replayRequestTool,
  clear_history: clearHistoryTool,
  // gRPC
  create_grpc_request: createGrpcRequestTool,
  send_grpc_request: sendGrpcRequestTool,
  list_grpc_services: listGrpcServicesTool,
  // Testing
  create_test: createTestTool,
  run_tests: runTestsTool,
  list_tests: listTestsTool,
  delete_test: deleteTestTool,
  run_collection_tests: runCollectionTestsTool,
  // Workflows
  create_workflow: createWorkflowTool,
  run_workflow: runWorkflowTool,
  list_workflows: listWorkflowsTool,
  delete_workflow: deleteWorkflowTool,
  // Documentation
  generate_docs: generateDocsTool,
  // Curl
  import_curl: importCurlTool,
  export_curl: exportCurlTool,
  // Scripts
  generate_script: generateScriptTool,
  // Proactive
  analyze_workspace: analyzeWorkspaceTool,
  // Memory
  save_memory: saveMemoryTool,
  recall_memory: recallMemoryTool,
  clear_memory: clearMemoryTool,
  // App
  set_api_key: setApiKeyTool,
  configure_ai: configureAiTool,
  toggle_theme: toggleThemeTool,
  get_app_info: getAppInfoTool,
};

export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  list_connections: 'Listing connected APIs',
  search_endpoints: 'Searching endpoints',
  connect_api: 'Connecting API',
  import_spec: 'Importing spec',
  import_graphql: 'Connecting GraphQL API',
  import_grpc_proto: 'Loading gRPC proto',
  import_grpc_reflection: 'gRPC server reflection',
  set_connection_auth: 'Configuring auth',
  update_connection: 'Updating connection',
  delete_connection: 'Deleting connection',
  reimport_spec: 'Re-importing spec',
  create_request: 'Creating request',
  create_requests: 'Creating requests',
  update_requests: 'Updating requests',
  edit_current_request: 'Editing request',
  select_request: 'Selecting request',
  send_request: 'Sending request',
  send_request_by_id: 'Sending request',
  list_requests: 'Listing requests',
  search_requests: 'Searching requests',
  delete_request: 'Deleting request',
  archive_request: 'Archiving request',
  unarchive_request: 'Restoring request',
  move_request_to_collection: 'Moving request',
  get_response: 'Reading response',
  get_response_body: 'Reading response body',
  get_response_headers: 'Reading response headers',
  create_collection: 'Creating collection',
  list_collections: 'Listing collections',
  rename_collection: 'Renaming collection',
  delete_collection: 'Deleting collection',
  create_environment: 'Creating environment',
  list_environments: 'Listing environments',
  update_environment: 'Updating environment',
  delete_environment: 'Deleting environment',
  set_active_environment: 'Activating environment',
  add_variable: 'Adding variable',
  update_variable: 'Updating variable',
  delete_variable: 'Deleting variable',
  search_history: 'Searching history',
  get_history_entry: 'Reading history entry',
  replay_request: 'Replaying request',
  clear_history: 'Clearing history',
  create_grpc_request: 'Creating gRPC request',
  send_grpc_request: 'Sending gRPC request',
  list_grpc_services: 'Listing gRPC services',
  create_test: 'Creating test',
  run_tests: 'Running tests',
  list_tests: 'Listing tests',
  delete_test: 'Deleting test',
  run_collection_tests: 'Running collection tests',
  create_workflow: 'Creating workflow',
  run_workflow: 'Running workflow',
  list_workflows: 'Listing workflows',
  delete_workflow: 'Deleting workflow',
  generate_docs: 'Generating documentation',
  import_curl: 'Importing cURL',
  export_curl: 'Exporting cURL',
  generate_script: 'Generating script',
  analyze_workspace: 'Analyzing workspace',
  save_memory: 'Remembering preference',
  recall_memory: 'Recalling memories',
  clear_memory: 'Clearing memories',
  set_api_key: 'Saving API key',
  configure_ai: 'Configuring AI provider',
  toggle_theme: 'Switching theme',
  get_app_info: 'Getting app info',
};
