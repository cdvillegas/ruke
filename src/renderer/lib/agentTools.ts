import { useRequestStore } from '../stores/requestStore';
import { useConnectionStore } from '../stores/connectionStore';
import { useCollectionStore } from '../stores/collectionStore';
import { useEnvironmentStore } from '../stores/environmentStore';
import { useUiStore } from '../stores/uiStore';
import type { HttpMethod, KeyValue } from '@shared/types';

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
            url: { type: 'string', description: 'Full URL for the request' },
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
            body_content: { type: 'string', description: 'Body content (JSON string for json type)' },
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

      const tabId = store.addPendingTab({
        name: args.name as string,
        method,
        collectionId,
      });

      const resolved = {
        method,
        url: args.url as string,
        name: args.name as string,
        headers: kv(args.headers as Array<{ key: string; value: string }>),
        params: kv(args.params as Array<{ key: string; value: string }>),
        body: { type: (args.body_type as string) || 'none', raw: args.body_content as string } as any,
        auth: { type: 'none' as const },
        connectionId: args.connection_id as string | undefined,
        endpointId: args.endpoint_id as string | undefined,
        collectionId,
      };

      store.resolvePendingTab(tabId, resolved);

      if (collectionId) {
        const savedReq = useRequestStore.getState().openTabs.find(t => t.id === tabId);
        if (savedReq) {
          try { await window.ruke.db.query('createRequest', { ...savedReq, collectionId }); } catch {}
        }
        await useCollectionStore.getState().loadRequests(collectionId);
      }

      store.switchTab(tabId);
      useUiStore.getState().setActiveView('requests');

      return JSON.stringify({ success: true, requestId: tabId, name: args.name, method, url: args.url });
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
        description: 'List all open request tabs with their names, methods, URLs, and IDs. Use this to find requests before editing or renaming them.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    execute: async () => {
      const { openTabs } = useRequestStore.getState();
      return JSON.stringify({
        requests: openTabs.map(t => ({
          id: t.id,
          name: t.name || 'Untitled',
          method: t.method,
          url: t.url,
          connectionId: t.connectionId,
          collectionId: t.collectionId,
        })),
      });
    },
  },

  // ── update_requests ──
  {
    schema: {
      type: 'function',
      function: {
        name: 'update_requests',
        description: 'Update one or more existing requests by name or ID. Can rename, change method, URL, headers, body, etc. Use list_requests first to find request names/IDs.',
        parameters: {
          type: 'object',
          properties: {
            updates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  match: { type: 'string', description: 'Request name or ID to find and update' },
                  name: { type: 'string', description: 'New name' },
                  method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] },
                  url: { type: 'string', description: 'New URL' },
                  headers: {
                    type: 'array',
                    items: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'] },
                  },
                  body_type: { type: 'string', enum: ['none', 'json', 'form-data', 'raw'] },
                  body_content: { type: 'string' },
                },
                required: ['match'],
              },
            },
          },
          required: ['updates'],
        },
      },
    },
    execute: async (args) => {
      const store = useRequestStore.getState();
      const updates = args.updates as Array<{
        match: string;
        name?: string;
        method?: string;
        url?: string;
        headers?: Array<{ key: string; value: string }>;
        body_type?: string;
        body_content?: string;
      }>;

      const results: Array<{ match: string; success: boolean; error?: string }> = [];

      for (const update of updates) {
        const tab = store.openTabs.find(t =>
          t.id === update.match ||
          (t.name || '').toLowerCase() === update.match.toLowerCase() ||
          (t.name || '').toLowerCase().includes(update.match.toLowerCase())
        );

        if (!tab) {
          results.push({ match: update.match, success: false, error: 'Request not found' });
          continue;
        }

        const changes: Partial<typeof tab> = {};
        if (update.name) changes.name = update.name;
        if (update.method) changes.method = update.method as HttpMethod;
        if (update.url) changes.url = update.url;
        if (update.headers) changes.headers = kv(update.headers);
        if (update.body_type || update.body_content) {
          changes.body = {
            type: update.body_type || tab.body?.type || 'none',
            raw: update.body_content || tab.body?.raw || '',
          } as any;
        }

        const currentActive = store.activeTabId;
        store.switchTab(tab.id);
        store.updateActiveRequest({ ...changes, updatedAt: new Date().toISOString() });
        if (currentActive !== tab.id) store.switchTab(currentActive);

        try {
          const updated = useRequestStore.getState().openTabs.find(t => t.id === tab.id);
          if (updated && tab.collectionId) {
            await window.ruke.db.query('updateRequest', updated.id, updated);
          }
        } catch {}

        results.push({ match: update.match, success: true });
      }

      return JSON.stringify({ results, updated: results.filter(r => r.success).length });
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
  update_requests: 'Updating requests',
};
