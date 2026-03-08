import { useRequestStore } from '../stores/requestStore';
import { useConnectionStore } from '../stores/connectionStore';
import { useCollectionStore } from '../stores/collectionStore';
import { useEnvironmentStore } from '../stores/environmentStore';
import { useUiStore } from '../stores/uiStore';
import type { HttpMethod, KeyValue, AppView } from '@shared/types';

function notifyView(view: AppView) {
  useUiStore.getState().incrementBadge(view);
}

export interface ToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolDef {
  schema: ToolSchema;
  execute: (args: Record<string, unknown>) => Promise<string>;
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

export const AGENT_TOOLS: ToolDef[] = [
  // ── list_connections ──
  {
    schema: {
      type: 'function',
      function: {
        name: 'list_connections',
        description: 'List all currently connected APIs with their endpoint counts. Use this first to understand what APIs are available before creating requests.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
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
        })),
      });
    },
  },

  // ── search_endpoints ──
  {
    schema: {
      type: 'function',
      function: {
        name: 'search_endpoints',
        description: 'Search connected API endpoints by keyword. Returns matching endpoints with their method, path, summary, parameters, and body info. Use this to find the right endpoint before creating a request.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search keyword (e.g. "chat", "users", "completions")' },
            connection_id: { type: 'string', description: 'Optional: limit search to a specific connection ID' },
          },
          required: ['query'],
        },
      },
    },
    execute: async (args) => {
      const query = (args.query as string).toLowerCase();
      const connId = args.connection_id as string | undefined;
      const conns = useConnectionStore.getState().connections;
      const filtered = connId ? conns.filter(c => c.id === connId) : conns;
      const results: Array<Record<string, unknown>> = [];

      for (const conn of filtered) {
        for (const ep of conn.endpoints) {
          const searchable = `${ep.method} ${ep.path} ${ep.summary || ''} ${ep.description || ''} ${(ep.tags || []).join(' ')}`.toLowerCase();
          if (searchable.includes(query)) {
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

      if (results.length === 0) return JSON.stringify({ results: [], message: `No endpoints matching "${args.query}" found.` });
      return JSON.stringify({ results });
    },
  },

  // ── create_request ──
  {
    schema: {
      type: 'function',
      function: {
        name: 'create_request',
        description: 'Create a new API request and open it in the request builder. Use search_endpoints first to find the correct endpoint.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Descriptive name for the request' },
            method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] },
            url: { type: 'string', description: 'Full URL, or just the path (e.g. /v1/chat/completions) when connection_id is provided' },
            headers: {
              type: 'array',
              items: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'] },
              description: 'Request headers',
            },
            params: {
              type: 'array',
              items: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'] },
              description: 'Query parameters',
            },
            body_type: { type: 'string', enum: ['none', 'json', 'form-data', 'raw'], description: 'Body type' },
            body_content: { type: 'string', description: 'Body content as a compact single-line JSON string (no newlines or extra whitespace)' },
            connection_id: { type: 'string', description: 'Connection ID to link this request to' },
            endpoint_id: { type: 'string', description: 'Endpoint ID to link this request to' },
            collection_id: { type: 'string', description: 'Collection ID to add this request to' },
          },
          required: ['name', 'method', 'url'],
        },
      },
    },
    execute: async (args) => {
      const store = useRequestStore.getState();
      const method = (args.method as string || 'GET') as HttpMethod;
      const collectionId = (args.collection_id as string) || null;
      const connectionId = args.connection_id as string | undefined;
      const endpointId = args.endpoint_id as string | undefined;

      let url = args.url as string;

      // When linked to a connection, strip the base URL so only the path is stored
      if (connectionId) {
        const conn = useConnectionStore.getState().getConnection(connectionId);
        if (conn) {
          const base = conn.baseUrl.replace(/\/+$/, '');
          if (url.startsWith(base)) {
            url = url.slice(base.length) || '/';
          }
        }
      }

      const bodyRaw = compactJson(args.body_content as string);

      store.newRequest(collectionId);
      const req = useRequestStore.getState().activeRequest;

      const updates: Partial<typeof req> = {
        method,
        url,
        name: args.name as string,
        headers: kv(args.headers as Array<{ key: string; value: string }>),
        params: kv(args.params as Array<{ key: string; value: string }>),
        body: { type: (args.body_type as string) || 'none', raw: bodyRaw } as any,
        auth: { type: 'none' as const },
        connectionId,
        endpointId,
        collectionId,
      };

      store.updateActiveRequest(updates);

      try {
        const updated = useRequestStore.getState().activeRequest;
        await window.ruke.db.query('updateRequest', updated.id, updated);
      } catch {}

      if (collectionId) {
        await useCollectionStore.getState().loadRequests(collectionId);
      }

      store.loadUncollectedRequests();
      notifyView('requests');

      return JSON.stringify({ success: true, requestId: req.id, name: args.name, method, url });
    },
  },

  // ── create_collection ──
  {
    schema: {
      type: 'function',
      function: {
        name: 'create_collection',
        description: 'Create a named collection to organize requests. Returns the collection ID which can be passed to create_request.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Collection name' },
          },
          required: ['name'],
        },
      },
    },
    execute: async (args) => {
      const store = useCollectionStore.getState();
      const collection = await store.createCollection(args.name as string);
      store.toggleExpanded(collection.id);
      notifyView('requests');
      return JSON.stringify({ success: true, collectionId: collection.id, name: collection.name });
    },
  },

  // ── connect_api ──
  {
    schema: {
      type: 'function',
      function: {
        name: 'connect_api',
        description: 'Connect an API by name using the discovery system. Searches the built-in registry and online sources to find and import the API spec.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'API name to search for (e.g. "OpenAI", "Stripe", "GitHub")' },
          },
          required: ['query'],
        },
      },
    },
    execute: async (args) => {
      try {
        const existing = useConnectionStore.getState().connections;
        const queryLower = (args.query as string).toLowerCase();
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

        const results = await window.ruke.agent.discover(args.query as string);
        if (!results.length) return JSON.stringify({ success: false, error: `No API found for "${args.query}"` });

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
  },

  // ── import_spec ──
  {
    schema: {
      type: 'function',
      function: {
        name: 'import_spec',
        description: 'Import an OpenAPI specification from a URL. Fetches the spec, parses it, and creates a connection with all endpoints.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to the OpenAPI spec (JSON or YAML)' },
          },
          required: ['url'],
        },
      },
    },
    execute: async (args) => {
      try {
        const res = await fetch(args.url as string);
        if (!res.ok) return JSON.stringify({ success: false, error: `Failed to fetch spec: ${res.status} ${res.statusText}` });
        const text = await res.text();
        const conn = useConnectionStore.getState().importOpenApiSpec(text, args.url as string);
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
  },

  // ── create_environment ──
  {
    schema: {
      type: 'function',
      function: {
        name: 'create_environment',
        description: 'Create an environment with variables. Environments let users switch between different configurations (e.g. dev, staging, production).',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Environment name (e.g. "Production", "Staging")' },
            variables: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  value: { type: 'string' },
                  is_secret: { type: 'boolean', description: 'Whether this is a secret value' },
                },
                required: ['key', 'value'],
              },
              description: 'Environment variables to create',
            },
            base_url: { type: 'string', description: 'Optional base URL override for this environment' },
            connection_id: { type: 'string', description: 'Optional connection ID to tie this environment to' },
          },
          required: ['name'],
        },
      },
    },
    execute: async (args) => {
      const envStore = useEnvironmentStore.getState();
      const collStore = useCollectionStore.getState();
      const wsId = collStore.activeWorkspaceId;
      if (!wsId) return JSON.stringify({ success: false, error: 'No active workspace' });

      const env = await envStore.createEnvironment(
        wsId,
        args.name as string,
        args.connection_id as string | undefined,
        args.base_url as string | undefined,
      );

      const variables = (args.variables as Array<{ key: string; value: string; is_secret?: boolean }>) || [];
      for (const v of variables) {
        await envStore.addVariable(env.id, v.key, v.value, 'global', v.is_secret || false);
      }

      notifyView('environments');
      return JSON.stringify({
        success: true,
        environmentId: env.id,
        name: env.name,
        variableCount: variables.length,
      });
    },
  },

  // ── list_environments ──
  {
    schema: {
      type: 'function',
      function: {
        name: 'list_environments',
        description: 'List all environments and their variables.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
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
  },
  // ── list_requests ──
  {
    schema: {
      type: 'function',
      function: {
        name: 'list_requests',
        description: 'List all requests (uncollected and within collections). Use this to find requests before editing, deleting, or moving them.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    execute: async () => {
      const reqStore = useRequestStore.getState();
      const colStore = useCollectionStore.getState();
      const uncollected = reqStore.uncollectedRequests;
      const collectionRequests: Array<Record<string, unknown>> = [];
      for (const [colId, reqs] of Object.entries(colStore.requests)) {
        const col = colStore.collections.find(c => c.id === colId);
        for (const r of reqs) {
          collectionRequests.push({
            id: r.id, name: r.name || 'Untitled', method: r.method, url: r.url,
            collectionId: colId, collectionName: col?.name,
          });
        }
      }
      return JSON.stringify({
        uncollected: uncollected.map(r => ({
          id: r.id, name: r.name || 'Untitled', method: r.method, url: r.url,
          connectionId: r.connectionId,
        })),
        inCollections: collectionRequests,
        archived: reqStore.archivedRequests.map(r => ({
          id: r.id, name: r.name || 'Untitled', method: r.method, url: r.url,
        })),
      });
    },
  },

  // ── search_requests ──
  {
    schema: {
      type: 'function',
      function: {
        name: 'search_requests',
        description: 'Search requests by name, method, or URL keyword. Searches across uncollected, collection, and archived requests.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search keyword (case-insensitive)' },
          },
          required: ['query'],
        },
      },
    },
    execute: async (args) => {
      const q = (args.query as string).toLowerCase();
      const reqStore = useRequestStore.getState();
      const colStore = useCollectionStore.getState();

      const all: Array<{ req: any; source: string; collectionName?: string }> = [];
      for (const r of reqStore.uncollectedRequests) all.push({ req: r, source: 'uncollected' });
      for (const r of reqStore.archivedRequests) all.push({ req: r, source: 'archived' });
      for (const [colId, reqs] of Object.entries(colStore.requests)) {
        const col = colStore.collections.find(c => c.id === colId);
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
  },

  // ── delete_request ──
  {
    schema: {
      type: 'function',
      function: {
        name: 'delete_request',
        description: 'Permanently delete a request by name or ID. Searches across all requests (uncollected, collections, archived). Use search_requests first if unsure.',
        parameters: {
          type: 'object',
          properties: {
            match: { type: 'string', description: 'Request name or ID (case-insensitive partial match)' },
          },
          required: ['match'],
        },
      },
    },
    execute: async (args) => {
      const matchStr = (args.match as string).toLowerCase();
      const reqStore = useRequestStore.getState();
      const colStore = useCollectionStore.getState();

      const all: Array<{ id: string; name: string; collectionId?: string | null }> = [];
      for (const r of reqStore.uncollectedRequests) all.push({ id: r.id, name: r.name, collectionId: r.collectionId });
      for (const r of reqStore.archivedRequests) all.push({ id: r.id, name: r.name, collectionId: r.collectionId });
      for (const [colId, reqs] of Object.entries(colStore.requests)) {
        for (const r of reqs) all.push({ id: r.id, name: r.name, collectionId: colId });
      }

      const found = all.find(r =>
        r.id === args.match ||
        (r.name || '').toLowerCase() === matchStr ||
        (r.name || '').toLowerCase().includes(matchStr)
      );

      if (!found) return JSON.stringify({ success: false, error: `No request matching "${args.match}" found.` });

      await reqStore.deleteRequest(found.id);

      if (found.collectionId) {
        await colStore.loadRequests(found.collectionId);
      }

      return JSON.stringify({ success: true, deleted: { id: found.id, name: found.name } });
    },
  },

  // ── archive_request ──
  {
    schema: {
      type: 'function',
      function: {
        name: 'archive_request',
        description: 'Archive a request by name or ID. Archived requests are hidden from the main list but can be restored.',
        parameters: {
          type: 'object',
          properties: {
            match: { type: 'string', description: 'Request name or ID' },
          },
          required: ['match'],
        },
      },
    },
    execute: async (args) => {
      const matchStr = (args.match as string).toLowerCase();
      const reqStore = useRequestStore.getState();
      const found = reqStore.uncollectedRequests.find(r =>
        r.id === args.match ||
        (r.name || '').toLowerCase() === matchStr ||
        (r.name || '').toLowerCase().includes(matchStr)
      );
      if (!found) return JSON.stringify({ success: false, error: `No request matching "${args.match}" found.` });

      await reqStore.archiveRequest(found.id);
      return JSON.stringify({ success: true, archived: { id: found.id, name: found.name } });
    },
  },

  // ── move_request_to_collection ──
  {
    schema: {
      type: 'function',
      function: {
        name: 'move_request_to_collection',
        description: 'Move a request into a collection. Use list_requests or search_requests to find the request and collection IDs.',
        parameters: {
          type: 'object',
          properties: {
            request_match: { type: 'string', description: 'Request name or ID' },
            collection_match: { type: 'string', description: 'Collection name or ID' },
          },
          required: ['request_match', 'collection_match'],
        },
      },
    },
    execute: async (args) => {
      const reqStr = (args.request_match as string).toLowerCase();
      const colStr = (args.collection_match as string).toLowerCase();
      const reqStore = useRequestStore.getState();
      const colStore = useCollectionStore.getState();

      const allReqs = [...reqStore.uncollectedRequests];
      for (const reqs of Object.values(colStore.requests)) allReqs.push(...reqs);

      const req = allReqs.find(r =>
        r.id === args.request_match ||
        (r.name || '').toLowerCase() === reqStr ||
        (r.name || '').toLowerCase().includes(reqStr)
      );
      if (!req) return JSON.stringify({ success: false, error: `No request matching "${args.request_match}" found.` });

      const col = colStore.collections.find(c =>
        c.id === args.collection_match ||
        c.name.toLowerCase() === colStr ||
        c.name.toLowerCase().includes(colStr)
      );
      if (!col) return JSON.stringify({ success: false, error: `No collection matching "${args.collection_match}" found.` });

      await reqStore.moveToCollection(req.id, col.id);
      return JSON.stringify({ success: true, moved: { requestId: req.id, requestName: req.name, collectionId: col.id, collectionName: col.name } });
    },
  },

  // ── list_collections ──
  {
    schema: {
      type: 'function',
      function: {
        name: 'list_collections',
        description: 'List all collections with their request counts.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
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
  },

  // ── rename_collection ──
  {
    schema: {
      type: 'function',
      function: {
        name: 'rename_collection',
        description: 'Rename a collection by name or ID.',
        parameters: {
          type: 'object',
          properties: {
            match: { type: 'string', description: 'Collection name or ID' },
            new_name: { type: 'string', description: 'New collection name' },
          },
          required: ['match', 'new_name'],
        },
      },
    },
    execute: async (args) => {
      const colStore = useCollectionStore.getState();
      const matchStr = (args.match as string).toLowerCase();
      const col = colStore.collections.find(c =>
        c.id === args.match || c.name.toLowerCase() === matchStr || c.name.toLowerCase().includes(matchStr)
      );
      if (!col) return JSON.stringify({ success: false, error: `No collection matching "${args.match}" found.` });

      await colStore.renameCollection(col.id, args.new_name as string);
      return JSON.stringify({ success: true, collection: { id: col.id, oldName: col.name, newName: args.new_name } });
    },
  },

  // ── delete_collection ──
  {
    schema: {
      type: 'function',
      function: {
        name: 'delete_collection',
        description: 'Delete a collection by name or ID. This deletes the collection but not the requests inside it (they become uncollected).',
        parameters: {
          type: 'object',
          properties: {
            match: { type: 'string', description: 'Collection name or ID' },
          },
          required: ['match'],
        },
      },
    },
    execute: async (args) => {
      const colStore = useCollectionStore.getState();
      const matchStr = (args.match as string).toLowerCase();
      const col = colStore.collections.find(c =>
        c.id === args.match || c.name.toLowerCase() === matchStr || c.name.toLowerCase().includes(matchStr)
      );
      if (!col) return JSON.stringify({ success: false, error: `No collection matching "${args.match}" found.` });

      await colStore.deleteCollection(col.id);
      useRequestStore.getState().loadUncollectedRequests();
      return JSON.stringify({ success: true, deleted: { id: col.id, name: col.name } });
    },
  },

  // ── edit_current_request ──
  {
    schema: {
      type: 'function',
      function: {
        name: 'edit_current_request',
        description: 'Edit fields of the currently active request. Can change method, URL, name, headers, query params, body, and auth. Only specify the fields you want to change.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'New name for the request' },
            method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] },
            url: { type: 'string', description: 'New URL or path' },
            headers: {
              type: 'array',
              items: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'] },
              description: 'Replace all headers',
            },
            params: {
              type: 'array',
              items: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'] },
              description: 'Replace all query parameters',
            },
            body_type: { type: 'string', enum: ['none', 'json', 'form-data', 'raw'] },
            body_content: { type: 'string', description: 'Body content (compact JSON string for json type)' },
            connection_id: { type: 'string', description: 'Connection ID to link' },
            endpoint_id: { type: 'string', description: 'Endpoint ID to link' },
          },
          required: [],
        },
      },
    },
    execute: async (args) => {
      const store = useRequestStore.getState();
      const req = store.activeRequest;
      const changes: Partial<typeof req> = {};
      const changed: string[] = [];

      if (args.name) { changes.name = args.name as string; changed.push('name'); }
      if (args.method) { changes.method = args.method as HttpMethod; changed.push('method'); }
      if (args.url) { changes.url = args.url as string; changed.push('url'); }
      if (args.headers) { changes.headers = kv(args.headers as Array<{ key: string; value: string }>); changed.push('headers'); }
      if (args.params) { changes.params = kv(args.params as Array<{ key: string; value: string }>); changed.push('params'); }
      if (args.body_type || args.body_content) {
        changes.body = {
          type: args.body_type || req.body?.type || 'none',
          raw: compactJson(args.body_content as string) || req.body?.raw || '',
        } as any;
        changed.push('body');
      }
      if (args.connection_id) { changes.connectionId = args.connection_id as string; changed.push('connection'); }
      if (args.endpoint_id) { changes.endpointId = args.endpoint_id as string; changed.push('endpoint'); }

      store.updateActiveRequest(changes);

      try {
        const updated = useRequestStore.getState().activeRequest;
        await window.ruke.db.query('updateRequest', updated.id, updated);
      } catch {}

      store.loadUncollectedRequests();

      return JSON.stringify({
        success: true,
        requestId: req.id,
        changed,
        current: {
          name: useRequestStore.getState().activeRequest.name,
          method: useRequestStore.getState().activeRequest.method,
          url: useRequestStore.getState().activeRequest.url,
        },
      });
    },
  },

  // ── select_request ──
  {
    schema: {
      type: 'function',
      function: {
        name: 'select_request',
        description: 'Select and switch to a different request by name or ID. Searches across uncollected requests and collection requests.',
        parameters: {
          type: 'object',
          properties: {
            match: { type: 'string', description: 'Request name or ID to search for (case-insensitive partial match)' },
          },
          required: ['match'],
        },
      },
    },
    execute: async (args) => {
      const store = useRequestStore.getState();
      const colStore = useCollectionStore.getState();
      const matchStr = (args.match as string).toLowerCase();

      const allRequests = [...store.uncollectedRequests, ...store.archivedRequests];
      for (const reqs of Object.values(colStore.requests)) allRequests.push(...reqs);

      const found = allRequests.find(r =>
        r.id === args.match ||
        (r.name || '').toLowerCase() === matchStr ||
        (r.name || '').toLowerCase().includes(matchStr)
      );

      if (!found) {
        return JSON.stringify({ success: false, error: `No request matching "${args.match}" found.` });
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
  },
];

export const TOOL_SCHEMAS = AGENT_TOOLS.map(t => t.schema);

export function getToolExecutor(name: string): ToolDef['execute'] | null {
  const tool = AGENT_TOOLS.find(t => t.schema.function.name === name);
  return tool?.execute ?? null;
}

export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  list_connections: 'Listing connected APIs',
  search_endpoints: 'Searching endpoints',
  create_request: 'Creating request',
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
  edit_current_request: 'Editing request',
  select_request: 'Selecting request',
};
