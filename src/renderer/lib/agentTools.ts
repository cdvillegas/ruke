import { tool } from 'ai';
import { z } from 'zod';
import { useRequestStore } from '../stores/requestStore';
import { useConnectionStore } from '../stores/connectionStore';
import { useCollectionStore } from '../stores/collectionStore';
import { useEnvironmentStore } from '../stores/environmentStore';
import { useUiStore } from '../stores/uiStore';
import type { HttpMethod, KeyValue, AppView, AuthConfig } from '@shared/types';

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
  description: 'Create an environment with variables. Environments let users switch between different configurations (e.g. dev, staging, production).',
  inputSchema: z.object({
    name: z.string().describe('Environment name (e.g. "Production", "Staging")'),
    variables: z.array(z.object({
      key: z.string(),
      value: z.string(),
      is_secret: z.boolean().optional().describe('Whether this is a secret value'),
    })).optional().describe('Environment variables to create'),
    base_url: z.string().optional().describe('Optional base URL override for this environment'),
    connection_id: z.string().optional().describe('Optional connection ID to tie this environment to'),
  }),
  execute: async ({ name, variables, base_url, connection_id }) => {
    const envStore = useEnvironmentStore.getState();
    const collStore = useCollectionStore.getState();
    const wsId = collStore.activeWorkspaceId;
    if (!wsId) return JSON.stringify({ success: false, error: 'No active workspace' });

    const env = await envStore.createEnvironment(wsId, name, connection_id, base_url);

    const vars = variables || [];
    for (const v of vars) {
      await envStore.addVariable(env.id, v.key, v.value, 'global', v.is_secret || false);
    }

    notifyView('environments');
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
        baseUrl: env.baseUrl,
        connectionId: env.connectionId,
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

// ── Exported tools object (keyed by name for streamText) ──

export const AGENT_TOOLS = {
  list_connections: listConnectionsTool,
  search_endpoints: searchEndpointsTool,
  create_request: createRequestTool,
  create_requests: createRequestsTool,
  create_collection: createCollectionTool,
  connect_api: connectApiTool,
  import_spec: importSpecTool,
  create_environment: createEnvironmentTool,
  list_environments: listEnvironmentsTool,
  list_requests: listRequestsTool,
  search_requests: searchRequestsTool,
  delete_request: deleteRequestTool,
  archive_request: archiveRequestTool,
  move_request_to_collection: moveRequestToCollectionTool,
  list_collections: listCollectionsTool,
  rename_collection: renameCollectionTool,
  delete_collection: deleteCollectionTool,
  set_connection_auth: setConnectionAuthTool,
  edit_current_request: editCurrentRequestTool,
  select_request: selectRequestTool,
};

export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  list_connections: 'Listing connected APIs',
  search_endpoints: 'Searching endpoints',
  create_request: 'Creating request',
  create_requests: 'Creating requests',
  create_collection: 'Creating collection',
  connect_api: 'Connecting API',
  import_spec: 'Importing spec',
  create_environment: 'Creating environment',
  list_environments: 'Listing environments',
  list_requests: 'Listing requests',
  search_requests: 'Searching requests',
  delete_request: 'Deleting request',
  archive_request: 'Archiving request',
  move_request_to_collection: 'Moving request',
  list_collections: 'Listing collections',
  rename_collection: 'Renaming collection',
  delete_collection: 'Deleting collection',
  set_connection_auth: 'Configuring auth',
  edit_current_request: 'Editing request',
  select_request: 'Selecting request',
};
