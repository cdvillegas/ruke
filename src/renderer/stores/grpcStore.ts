import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { GrpcRequest, GrpcResponse, GrpcMethodType, ProtoDefinition, GrpcMetadata } from '@shared/types';

function createEmptyGrpcRequest(collectionId: string | null = null): GrpcRequest {
  return {
    id: nanoid(),
    collectionId,
    name: 'New gRPC Request',
    protocol: 'grpc',
    serverUrl: '',
    protoFilePath: '',
    serviceName: '',
    methodName: '',
    methodType: 'unary',
    message: '{}',
    metadata: [{ key: '', value: '', enabled: true }],
    tlsEnabled: false,
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

interface GrpcState {
  activeRequest: GrpcRequest;
  response: GrpcResponse | null;
  loading: boolean;
  protoDefinitions: Map<string, ProtoDefinition>;
  openTabs: GrpcRequest[];
  activeTabId: string;

  setActiveRequest: (req: GrpcRequest) => void;
  updateActiveRequest: (updates: Partial<GrpcRequest>) => void;
  sendRequest: () => Promise<void>;
  newRequest: (collectionId?: string | null) => void;
  openTab: (req: GrpcRequest) => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  loadProto: (filePath: string) => Promise<ProtoDefinition | null>;
  loadProtoFromDialog: () => Promise<ProtoDefinition | null>;
  setProtoForRequest: (filePath: string, definition: ProtoDefinition) => void;
  getProtoDefinition: () => ProtoDefinition | undefined;
}

export const useGrpcStore = create<GrpcState>((set, get) => {
  const initial = createEmptyGrpcRequest();
  return {
    activeRequest: initial,
    response: null,
    loading: false,
    protoDefinitions: new Map(),
    openTabs: [initial],
    activeTabId: initial.id,

    setActiveRequest: (req) => set({ activeRequest: req, activeTabId: req.id }),

    updateActiveRequest: (updates) =>
      set((s) => {
        const updated = { ...s.activeRequest, ...updates, updatedAt: new Date().toISOString() };
        return {
          activeRequest: updated,
          openTabs: s.openTabs.map((t) => (t.id === updated.id ? updated : t)),
        };
      }),

    sendRequest: async () => {
      set({ loading: true, response: null });
      const req = get().activeRequest;

      try {
        const response = await window.ruke.grpc.sendRequest({
          serverUrl: req.serverUrl,
          protoFilePath: req.protoFilePath,
          serviceName: req.serviceName,
          methodName: req.methodName,
          message: req.message,
          metadata: req.metadata.filter(m => m.enabled && m.key),
          tlsEnabled: req.tlsEnabled,
          deadline: req.deadline,
        });
        set({ response, loading: false });
      } catch (err: any) {
        set({
          loading: false,
          response: {
            status: 2,
            statusMessage: err.message || 'Request failed',
            metadata: {},
            trailers: {},
            body: JSON.stringify({ error: err.message }, null, 2),
            messages: [],
            duration: 0,
            timestamp: new Date().toISOString(),
          },
        });
      }
    },

    newRequest: (collectionId = null) => {
      const req = createEmptyGrpcRequest(collectionId);
      set((s) => ({
        activeRequest: req,
        response: null,
        openTabs: [...s.openTabs, req],
        activeTabId: req.id,
      }));
    },

    openTab: (req) => {
      set((s) => {
        const exists = s.openTabs.find((t) => t.id === req.id);
        if (exists) {
          return { activeRequest: req, activeTabId: req.id, response: null };
        }
        return {
          activeRequest: req,
          openTabs: [...s.openTabs, req],
          activeTabId: req.id,
          response: null,
        };
      });
    },

    closeTab: (id) => {
      set((s) => {
        const tabs = s.openTabs.filter((t) => t.id !== id);
        if (tabs.length === 0) {
          const newReq = createEmptyGrpcRequest();
          return {
            openTabs: [newReq],
            activeRequest: newReq,
            activeTabId: newReq.id,
            response: null,
          };
        }
        if (s.activeTabId === id) {
          const idx = s.openTabs.findIndex((t) => t.id === id);
          const newActive = tabs[Math.min(idx, tabs.length - 1)];
          return {
            openTabs: tabs,
            activeRequest: newActive,
            activeTabId: newActive.id,
            response: null,
          };
        }
        return { openTabs: tabs };
      });
    },

    switchTab: (id) => {
      set((s) => {
        const tab = s.openTabs.find((t) => t.id === id);
        if (tab) {
          return { activeRequest: tab, activeTabId: id, response: null };
        }
        return {};
      });
    },

    loadProto: async (filePath: string) => {
      try {
        const definition = await window.ruke.grpc.loadProto(filePath);
        if (definition) {
          set((s) => {
            const newMap = new Map(s.protoDefinitions);
            newMap.set(filePath, definition);
            return { protoDefinitions: newMap };
          });
          get().updateActiveRequest({ protoFilePath: filePath });
        }
        return definition;
      } catch (e) {
        console.error('Failed to load proto:', e);
        return null;
      }
    },

    loadProtoFromDialog: async () => {
      try {
        const result = await window.ruke.file.import([
          { name: 'Protocol Buffer', extensions: ['proto'] },
        ]);
        if (result?.success && result.path) {
          return get().loadProto(result.path);
        }
        return null;
      } catch (e) {
        console.error('Failed to import proto file:', e);
        return null;
      }
    },

    setProtoForRequest: (filePath, definition) => {
      set((s) => {
        const newMap = new Map(s.protoDefinitions);
        newMap.set(filePath, definition);
        return {
          protoDefinitions: newMap,
          activeRequest: { ...s.activeRequest, protoFilePath: filePath },
        };
      });
    },

    getProtoDefinition: () => {
      const req = get().activeRequest;
      if (!req.protoFilePath) return undefined;
      return get().protoDefinitions.get(req.protoFilePath);
    },
  };
});
