import { create } from 'zustand';
import { nanoid } from 'nanoid';
import yaml from 'js-yaml';
import type { ApiConnection, ApiEndpoint, HttpMethod, ProtoDefinition } from '@shared/types';

function parseSpec(text: string): any {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed);
  }
  return yaml.load(trimmed);
}

const ICON_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#06b6d4', '#f97316'];

function loadConnections(): ApiConnection[] {
  try {
    return JSON.parse(localStorage.getItem('ruke:connections') || '[]');
  } catch { return []; }
}

function saveConnections(conns: ApiConnection[]) {
  localStorage.setItem('ruke:connections', JSON.stringify(conns));
}

interface ConnectionState {
  connections: ApiConnection[];
  activeConnectionId: string | null;

  loadConnections: () => void;
  addConnection: (conn: Partial<ApiConnection> & { name: string; baseUrl: string }) => ApiConnection;
  updateConnection: (id: string, updates: Partial<ApiConnection>) => void;
  deleteConnection: (id: string) => void;
  setActiveConnection: (id: string | null) => void;
  addEndpoints: (connectionId: string, endpoints: ApiEndpoint[]) => void;
  importOpenApiSpec: (specText: string, sourceUrl?: string) => ApiConnection | null;
  importGraphQLEndpoint: (url: string, name?: string) => Promise<ApiConnection | null>;
  importGrpcProto: (serverUrl: string, filePath: string, name?: string) => Promise<ApiConnection | null>;
  importGrpcReflection: (serverUrl: string, tlsEnabled: boolean, name?: string) => Promise<ApiConnection | null>;
  getConnection: (id: string) => ApiConnection | undefined;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connections: loadConnections(),
  activeConnectionId: null,

  loadConnections: () => {
    set({ connections: loadConnections() });
  },

  addConnection: (partial) => {
    const conn: ApiConnection = {
      id: nanoid(),
      name: partial.name,
      baseUrl: partial.baseUrl.replace(/\/+$/, ''),
      specUrl: partial.specUrl,
      specType: partial.specType || 'manual',
      auth: partial.auth || { type: 'none' },
      endpoints: partial.endpoints || [],
      description: partial.description,
      iconColor: ICON_COLORS[get().connections.length % ICON_COLORS.length],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...get().connections, conn];
    set({ connections: updated });
    saveConnections(updated);
    return conn;
  },

  updateConnection: (id, updates) => {
    const updated = get().connections.map(c =>
      c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
    );
    set({ connections: updated });
    saveConnections(updated);
  },

  deleteConnection: (id) => {
    const updated = get().connections.filter(c => c.id !== id);
    set({
      connections: updated,
      activeConnectionId: get().activeConnectionId === id ? null : get().activeConnectionId,
    });
    saveConnections(updated);
  },

  setActiveConnection: (id) => set({ activeConnectionId: id }),

  addEndpoints: (connectionId, endpoints) => {
    const updated = get().connections.map(c =>
      c.id === connectionId
        ? { ...c, endpoints: [...c.endpoints, ...endpoints], updatedAt: new Date().toISOString() }
        : c
    );
    set({ connections: updated });
    saveConnections(updated);
  },

  importOpenApiSpec: (specText, sourceUrl) => {
    try {
      const spec = parseSpec(specText);
      const title = spec.info?.title || 'Imported API';
      const description = spec.info?.description;
      const version = spec.info?.version;

      let baseUrl = '';
      if (spec.servers?.[0]?.url) {
        baseUrl = spec.servers[0].url;
      } else if (spec.host) {
        const scheme = spec.schemes?.[0] || 'https';
        baseUrl = `${scheme}://${spec.host}${spec.basePath || ''}`;
      }

      const endpoints: ApiEndpoint[] = [];
      const paths = spec.paths || {};

      for (const [path, methods] of Object.entries(paths) as [string, any][]) {
        for (const [method, details] of Object.entries(methods) as [string, any][]) {
          if (['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)) {
            const params: ApiEndpoint['parameters'] = (details.parameters || []).map((p: any) => ({
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
              parameters: params && params.length > 0 ? params : undefined,
              requestBody,
              tags: details.tags,
            });
          }
        }
      }

      const conn = get().addConnection({
        name: version ? `${title} v${version}` : title,
        baseUrl,
        specUrl: sourceUrl,
        specType: 'openapi',
        description,
        endpoints: endpoints.map(e => ({ ...e, connectionId: '' })),
      });

      const withIds = get().connections.map(c =>
        c.id === conn.id
          ? { ...c, endpoints: c.endpoints.map(e => ({ ...e, connectionId: conn.id })) }
          : c
      );
      set({ connections: withIds });
      saveConnections(withIds);

      return conn;
    } catch (e) {
      console.error('Failed to parse OpenAPI spec:', e);
      return null;
    }
  },

  importGraphQLEndpoint: async (url, name) => {
    const introspectionQuery = `{ __schema { queryType { name } mutationType { name } types { name kind fields { name args { name type { name kind ofType { name } } } } } } }`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: introspectionQuery }),
      });
      const json = await res.json();
      const schema = json.data?.__schema;
      if (!schema) return null;

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
            method: isMutation ? 'POST' : 'POST',
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

      const conn = get().addConnection({
        name: name || new URL(url).hostname,
        baseUrl: url,
        specType: 'graphql',
        description: `GraphQL API — ${endpoints.length} operations`,
        endpoints,
      });

      const withIds = get().connections.map(c =>
        c.id === conn.id
          ? { ...c, endpoints: c.endpoints.map(e => ({ ...e, connectionId: conn.id })) }
          : c
      );
      set({ connections: withIds });
      saveConnections(withIds);
      return conn;
    } catch (e) {
      console.error('GraphQL introspection failed:', e);
      return null;
    }
  },

  importGrpcProto: async (serverUrl, filePath, name) => {
    try {
      const protoDef: ProtoDefinition = await window.ruke.grpc.loadProto(filePath);
      if (!protoDef || protoDef.services.length === 0) return null;

      const endpoints: ApiEndpoint[] = [];
      for (const service of protoDef.services) {
        for (const method of service.methods) {
          endpoints.push({
            id: nanoid(),
            connectionId: '',
            method: 'POST' as HttpMethod,
            path: `${service.name}/${method.name}`,
            summary: `${method.methodType === 'unary' ? '' : `[${method.methodType}] `}${service.name}.${method.name}`,
            description: method.comment,
            tags: [service.name],
            parameters: (method.inputFields || []).map(f => ({
              name: f.name,
              in: 'query' as const,
              required: false,
              type: f.repeated ? `repeated ${f.type}` : f.type,
              description: f.comment,
            })),
            requestBody: {
              type: 'json',
              schema: JSON.stringify({ inputType: method.inputType, outputType: method.outputType, methodType: method.methodType }, null, 2),
            },
          });
        }
      }

      const conn = get().addConnection({
        name: name || protoDef.packageName || filePath.split('/').pop()?.replace('.proto', '') || 'gRPC Service',
        baseUrl: serverUrl,
        specType: 'grpc',
        description: `gRPC — ${protoDef.services.length} service(s), ${endpoints.length} method(s)`,
        endpoints,
        protoDefinition: protoDef,
      });

      const withIds = get().connections.map(c =>
        c.id === conn.id
          ? { ...c, endpoints: c.endpoints.map(e => ({ ...e, connectionId: conn.id })) }
          : c
      );
      set({ connections: withIds });
      saveConnections(withIds);
      return conn;
    } catch (e) {
      console.error('Failed to import gRPC proto:', e);
      return null;
    }
  },

  importGrpcReflection: async (serverUrl, tlsEnabled, name) => {
    try {
      const protoDef: ProtoDefinition = await window.ruke.grpc.serverReflection(serverUrl, tlsEnabled);
      if (!protoDef || protoDef.services.length === 0) return null;

      const endpoints: ApiEndpoint[] = [];
      for (const service of protoDef.services) {
        for (const method of service.methods) {
          endpoints.push({
            id: nanoid(),
            connectionId: '',
            method: 'POST' as HttpMethod,
            path: `${service.name}/${method.name}`,
            summary: `${method.methodType ? `[${method.methodType}] ` : ''}${service.fullName}.${method.name}`,
            tags: [service.name],
          });
        }
      }

      const conn = get().addConnection({
        name: name || new URL(`http://${serverUrl}`).hostname,
        baseUrl: serverUrl,
        specType: 'grpc',
        description: `gRPC (reflection) — ${protoDef.services.length} service(s)`,
        endpoints,
        protoDefinition: protoDef,
      });

      const withIds = get().connections.map(c =>
        c.id === conn.id
          ? { ...c, endpoints: c.endpoints.map(e => ({ ...e, connectionId: conn.id })) }
          : c
      );
      set({ connections: withIds });
      saveConnections(withIds);
      return conn;
    } catch (e) {
      console.error('gRPC reflection failed:', e);
      return null;
    }
  },

  getConnection: (id) => get().connections.find(c => c.id === id),
}));
