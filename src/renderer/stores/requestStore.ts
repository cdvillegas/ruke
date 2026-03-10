import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { ApiRequest, ApiResponse, HttpMethod, KeyValue, RequestBody, AuthConfig, HistoryEntry, DiscoveryResult } from '@shared/types';
import { useConnectionStore } from './connectionStore';
import { useEnvironmentStore } from './environmentStore';

declare global {
  interface Window {
    ruke: {
      sendRequest: (req: any) => Promise<ApiResponse>;
      db: { query: (method: string, ...args: any[]) => Promise<any> };
      ai: { chat: (messages: any[], context?: any) => Promise<any>; setKey: (key: string) => Promise<any> };
      agent: { discover: (query: string) => Promise<DiscoveryResult[]> };
      grpc: {
        loadProto: (filePath: string) => Promise<any>;
        sendRequest: (request: any) => Promise<any>;
        serverReflection: (serverUrl: string, tlsEnabled: boolean) => Promise<any>;
        cancelStream: (streamId: string) => Promise<any>;
      };
      file: { export: (data: string) => Promise<any>; import: (filters?: any) => Promise<any> };
      getAppPath: () => Promise<string>;
    };
  }
}

function createEmptyRequest(collectionId: string | null = null): ApiRequest {
  return {
    id: nanoid(),
    collectionId,
    name: 'New Request',
    method: 'GET',
    url: '',
    headers: [{ key: '', value: '', enabled: true }],
    params: [{ key: '', value: '', enabled: true }],
    body: { type: 'none' },
    auth: { type: 'none' },
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved';

interface RequestState {
  activeRequest: ApiRequest;
  hasSelection: boolean;
  response: ApiResponse | null;
  loading: boolean;
  history: HistoryEntry[];
  requestHistory: HistoryEntry[];
  saveStatus: SaveStatus;

  uncollectedRequests: ApiRequest[];
  archivedRequests: ApiRequest[];

  /** @deprecated kept for agent compatibility — maps to uncollectedRequests */
  openTabs: ApiRequest[];
  /** @deprecated kept for agent compatibility */
  activeTabId: string;
  pendingTabIds: string[];
  newRequestIds: string[];

  setActiveRequest: (req: ApiRequest) => void;
  updateActiveRequest: (updates: Partial<ApiRequest>) => void;
  setMethod: (method: HttpMethod) => void;
  setUrl: (url: string) => void;
  setHeaders: (headers: KeyValue[]) => void;
  setParams: (params: KeyValue[]) => void;
  setBody: (body: RequestBody) => void;
  setAuth: (auth: AuthConfig) => void;
  setName: (name: string) => void;
  linkConnection: (connectionId: string | undefined) => void;
  linkEndpoint: (endpointId: string | undefined) => void;
  getResolvedUrl: () => string;
  getEffectiveAuth: () => AuthConfig;
  sendRequest: (resolvedVariables?: Record<string, string>) => Promise<void>;

  selectRequest: (req: ApiRequest) => void;
  newRequest: (collectionId?: string | null) => Promise<void>;
  /** Create and persist a new request without switching to it. Used by workflows to add steps. */
  createAndSaveRequest: (collectionId?: string | null) => Promise<ApiRequest>;
  /** Update a request by ID (DB + in-memory cache). Used by workflow inline editor. */
  updateRequestById: (id: string, updates: Partial<ApiRequest>) => Promise<void>;

  loadUncollectedRequests: () => Promise<void>;
  loadArchivedRequests: () => Promise<void>;
  reorderRequests: (orderedIds: string[]) => Promise<void>;
  archiveRequest: (id: string) => Promise<void>;
  unarchiveRequest: (id: string) => Promise<void>;
  clearArchivedRequests: () => Promise<void>;
  moveToCollection: (id: string, collectionId: string) => Promise<void>;

  openTab: (req: ApiRequest) => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  addPendingTab: (partial?: Partial<ApiRequest>) => string;
  resolvePendingTab: (id: string, updates: Partial<ApiRequest>) => void;
  markSeen: (id: string) => void;
  isPending: (id: string) => boolean;

  loadHistory: () => Promise<void>;
  clearHistory: () => Promise<void>;
  searchHistory: (query: string) => Promise<void>;
  loadRequestHistory: (requestId: string) => Promise<void>;
  viewHistoryResponse: (historyId: string) => void;
  saveRequest: () => Promise<void>;
  loadRequest: (id: string) => Promise<void>;
  deleteRequest: (id: string) => Promise<void>;
}

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let savedResetTimer: ReturnType<typeof setTimeout> | null = null;
const AUTO_SAVE_DELAY = 800;

async function fetchLastResponse(requestId: string): Promise<{ response: ApiResponse | null; history: HistoryEntry[] }> {
  try {
    const entries: HistoryEntry[] = await window.ruke.db.query('getHistoryForRequest', requestId, 20);
    return {
      response: entries.length > 0 ? entries[0].response : null,
      history: entries,
    };
  } catch {
    return { response: null, history: [] };
  }
}

export const useRequestStore = create<RequestState>((set, get) => {
  const initial = createEmptyRequest();

  const scheduleAutoSave = () => {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    if (savedResetTimer) clearTimeout(savedResetTimer);
    set({ saveStatus: 'unsaved' });
    autoSaveTimer = setTimeout(() => {
      autoSaveTimer = null;
      get().saveRequest();
    }, AUTO_SAVE_DELAY);
  };

  return {
    activeRequest: initial,
    hasSelection: false,
    response: null,
    loading: false,
    history: [],
    requestHistory: [],
    saveStatus: 'idle' as SaveStatus,

    uncollectedRequests: [],
    archivedRequests: [],

    openTabs: [initial],
    activeTabId: initial.id,
    pendingTabIds: [],
    newRequestIds: [],

    setActiveRequest: (req) => set({ activeRequest: req, activeTabId: req.id, hasSelection: true }),

    updateActiveRequest: (updates) => {
      set((s) => {
        const updated = { ...s.activeRequest, ...updates, updatedAt: new Date().toISOString() };
        localStorage.setItem('ruke:lastActiveRequestId', updated.id);
        return {
          activeRequest: updated,
          openTabs: s.openTabs.map((t) => (t.id === updated.id ? updated : t)),
          uncollectedRequests: s.uncollectedRequests.map((r) => (r.id === updated.id ? updated : r)),
        };
      });
      if (get().hasSelection) {
        scheduleAutoSave();
      }
    },

    setMethod: (method) => {
      const updates: Partial<ApiRequest> = { method };
      const noBodyMethods: HttpMethod[] = ['GET', 'HEAD', 'OPTIONS'];
      if (noBodyMethods.includes(method)) {
        updates.body = { type: 'none' };
      }
      get().updateActiveRequest(updates);
    },
    setUrl: (url) => get().updateActiveRequest({ url }),
    setHeaders: (headers) => get().updateActiveRequest({ headers }),
    setParams: (params) => get().updateActiveRequest({ params }),
    setBody: (body) => get().updateActiveRequest({ body }),
    setAuth: (auth) => get().updateActiveRequest({ auth }),
    setName: (name) => get().updateActiveRequest({ name }),

    linkConnection: (connectionId) => get().updateActiveRequest({ connectionId }),
    linkEndpoint: (endpointId) => get().updateActiveRequest({ endpointId }),

    getResolvedUrl: () => {
      const req = get().activeRequest;
      let resolved = req.url;
      if (req.connectionId) {
        const conn = useConnectionStore.getState().getConnection(req.connectionId);
        if (conn) {
          const resolvedBaseUrl = useEnvironmentStore.getState().resolveString(conn.baseUrl);
          const base = resolvedBaseUrl.replace(/\/+$/, '');
          const path = req.url.startsWith('/') ? req.url : `/${req.url}`;
          resolved = req.url.startsWith('http') ? req.url : `${base}${path}`;
        }
      }
      for (const p of req.params) {
        if (p.enabled && p.key && p.value) {
          resolved = resolved.replace(`{${p.key}}`, encodeURIComponent(p.value));
        }
      }
      return resolved;
    },

    getEffectiveAuth: () => {
      const req = get().activeRequest;
      if (req.auth.type !== 'none') return req.auth;
      if (req.connectionId) {
        const conn = useConnectionStore.getState().getConnection(req.connectionId);
        if (conn && conn.auth.type !== 'none') return conn.auth;
      }
      return req.auth;
    },

    sendRequest: async (resolvedVariables) => {
      set({ loading: true, response: null });
      try {
        const req = get().activeRequest;
        const resolvedUrl = get().getResolvedUrl();
        const effectiveAuth = get().getEffectiveAuth();
        const response = await window.ruke.sendRequest({
          ...req,
          url: resolvedUrl,
          auth: effectiveAuth,
          resolvedVariables,
        });
        set({ response, loading: false });

        // Auto-rename if still default name
        if (req.name === 'New Request' && req.url) {
          const pathPart = req.url.startsWith('http')
            ? new URL(req.url).pathname
            : req.url.startsWith('/') ? req.url : `/${req.url}`;
          const autoName = `${req.method} ${pathPart}`;
          get().updateActiveRequest({ name: autoName });
          try { await window.ruke.db.query('updateRequest', req.id, { name: autoName }); } catch {}
        }

        const historyId = nanoid();
        await window.ruke.db.query('addHistory', {
          id: historyId,
          requestId: req.id,
          method: req.method,
          url: req.url,
          status: response.status,
          duration: response.duration,
          responseSize: response.size,
          request: req,
          response,
        });

        get().loadHistory();
        get().loadRequestHistory(req.id);
        get().saveRequest();
        get().loadUncollectedRequests();
      } catch (err) {
        set({
          loading: false,
          response: {
            status: 0,
            statusText: 'Request failed',
            headers: {},
            body: String(err),
            size: 0,
            duration: 0,
            timestamp: new Date().toISOString(),
          },
        });
      }
    },

    selectRequest: (req) => {
      set({ activeRequest: req, activeTabId: req.id, response: null, requestHistory: [], hasSelection: true });
      localStorage.setItem('ruke:lastActiveRequestId', req.id);
      fetchLastResponse(req.id).then(({ response, history }) => {
        if (get().activeRequest.id === req.id) {
          set({ response, requestHistory: history });
        }
      });
    },

    newRequest: async (collectionId = null) => {
      const req = createEmptyRequest(collectionId);
      set((s) => ({
        activeRequest: req,
        hasSelection: true,
        response: null,
        requestHistory: [],
        openTabs: [...s.openTabs, req],
        activeTabId: req.id,
      }));
      try {
        await window.ruke.db.query('createRequest', req);
      } catch {}
      await get().loadUncollectedRequests();
    },

    createAndSaveRequest: async (collectionId = null) => {
      const req = createEmptyRequest(collectionId);
      try {
        await window.ruke.db.query('createRequest', req);
      } catch {}
      await get().loadUncollectedRequests();
      return req;
    },

    updateRequestById: async (id, updates) => {
      try {
        const req = await window.ruke.db.query('getRequestById', id);
        if (!req) return;
        const merged = { ...req, ...updates, updatedAt: new Date().toISOString() };
        await window.ruke.db.query('updateRequest', id, merged);
      } catch {}
      set((s) => ({
        uncollectedRequests: s.uncollectedRequests.map((r) =>
          r.id === id ? { ...r, ...updates } : r
        ),
      }));
      try {
        const { useCollectionStore } = await import('./collectionStore');
        const state = useCollectionStore.getState();
        for (const [colId, reqs] of Object.entries(state.requests)) {
          if (reqs.some((r) => r.id === id)) {
            useCollectionStore.setState((s) => ({
              requests: {
                ...s.requests,
                [colId]: (s.requests[colId] || []).map((r) =>
                  r.id === id ? { ...r, ...updates } : r
                ),
              },
            }));
            break;
          }
        }
      } catch {}
    },

    loadUncollectedRequests: async () => {
      try {
        const reqs = await window.ruke.db.query('getUncollectedRequests');
        const list = Array.isArray(reqs) ? reqs : [];
        set({ uncollectedRequests: list });

        const lastId = localStorage.getItem('ruke:lastActiveRequestId');
        if (lastId && get().activeRequest.url === '' && !get().activeRequest.connectionId) {
          const match = list.find((r: ApiRequest) => r.id === lastId);
          if (match) {
            get().selectRequest(match);
          } else {
            try {
              const req = await window.ruke.db.query('getRequestById', lastId);
              if (req) get().selectRequest(req);
            } catch {}
          }
        }
      } catch {}
    },

    loadArchivedRequests: async () => {
      try {
        const reqs = await window.ruke.db.query('getArchivedRequests');
        set({ archivedRequests: Array.isArray(reqs) ? reqs : [] });
      } catch {}
    },

    reorderRequests: async (orderedIds) => {
      if (!orderedIds.length) return;
      try {
        await Promise.all(
          orderedIds.map((id, i) => window.ruke.db.query('updateRequest', id, { sortOrder: i }))
        );
        await get().loadUncollectedRequests();
      } catch {
        await get().loadUncollectedRequests();
      }
    },

    archiveRequest: async (id) => {
      try {
        await window.ruke.db.query('archiveRequest', id);
      } catch {}
      if (localStorage.getItem('ruke:lastActiveRequestId') === id) {
        localStorage.removeItem('ruke:lastActiveRequestId');
      }
      get().closeTab(id);
      await get().loadUncollectedRequests();
      await get().loadArchivedRequests();
      try {
        const { useCollectionStore } = await import('./collectionStore');
        const cols = useCollectionStore.getState().collections;
        for (const c of cols) {
          useCollectionStore.getState().loadRequests(c.id);
        }
      } catch {}
    },

    unarchiveRequest: async (id) => {
      try {
        await window.ruke.db.query('unarchiveRequest', id);
      } catch {}
      await get().loadUncollectedRequests();
      await get().loadArchivedRequests();
    },

    clearArchivedRequests: async () => {
      try {
        await window.ruke.db.query('clearArchivedRequests');
      } catch {}
      await get().loadArchivedRequests();
    },

    moveToCollection: async (id, collectionId) => {
      try {
        await window.ruke.db.query('updateRequest', id, { collectionId });
      } catch {}
      get().loadUncollectedRequests();
      try {
        const { useCollectionStore } = await import('./collectionStore');
        useCollectionStore.getState().loadRequests(collectionId);
      } catch {}
    },

    // Legacy tab methods kept for agent/HomeView compatibility
    openTab: (req) => {
      set((s) => {
        const exists = s.openTabs.find((t) => t.id === req.id);
        if (exists) {
          return { activeRequest: req, activeTabId: req.id, hasSelection: true, response: null, requestHistory: [] };
        }
        return {
          activeRequest: req,
          openTabs: [...s.openTabs, req],
          activeTabId: req.id,
          hasSelection: true,
          response: null,
          requestHistory: [],
        };
      });
      fetchLastResponse(req.id).then(({ response, history }) => {
        if (get().activeRequest.id === req.id) {
          set({ response, requestHistory: history });
        }
      });
    },

    closeTab: (id) => {
      let newActiveId: string | null = null;
      set((s) => {
        const tabs = s.openTabs.filter((t) => t.id !== id);
        if (tabs.length === 0) {
          const newReq = createEmptyRequest();
          return {
            openTabs: [newReq],
            activeRequest: newReq,
            activeTabId: newReq.id,
            hasSelection: false,
            response: null,
            requestHistory: [],
          };
        }
        if (s.activeTabId === id) {
          const idx = s.openTabs.findIndex((t) => t.id === id);
          const newActive = tabs[Math.min(idx, tabs.length - 1)];
          newActiveId = newActive.id;
          return {
            openTabs: tabs,
            activeRequest: newActive,
            activeTabId: newActive.id,
            response: null,
            requestHistory: [],
          };
        }
        return { openTabs: tabs };
      });
      if (newActiveId) {
        fetchLastResponse(newActiveId).then(({ response, history }) => {
          if (get().activeTabId === newActiveId) {
            set({ response, requestHistory: history });
          }
        });
      }
    },

    switchTab: (id) => {
      set((s) => {
        const tab = s.openTabs.find((t) => t.id === id);
        if (tab) {
          return { activeRequest: tab, activeTabId: id, response: null, requestHistory: [] };
        }
        return {};
      });
      fetchLastResponse(id).then(({ response, history }) => {
        if (get().activeTabId === id) {
          set({ response, requestHistory: history });
        }
      });
    },

    addPendingTab: (partial = {}) => {
      const req = createEmptyRequest(partial.collectionId || null);
      const merged = { ...req, ...partial, id: req.id };
      set((s) => ({
        openTabs: [...s.openTabs, merged],
        pendingTabIds: [...s.pendingTabIds, merged.id],
        newRequestIds: [...s.newRequestIds, merged.id],
      }));
      return merged.id;
    },

    resolvePendingTab: (id, updates) => {
      set((s) => {
        const updated = s.openTabs.map((t) =>
          t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
        );
        const resolvedTab = updated.find((t) => t.id === id);
        const isActive = s.activeTabId === id;
        return {
          openTabs: updated,
          pendingTabIds: s.pendingTabIds.filter((pid) => pid !== id),
          ...(isActive && resolvedTab ? { activeRequest: resolvedTab } : {}),
        };
      });
    },

    markSeen: (id) => {
      set((s) => ({
        newRequestIds: s.newRequestIds.filter(nid => nid !== id),
      }));
    },

    isPending: (id) => get().pendingTabIds.includes(id),

    loadHistory: async () => {
      try {
        const history = await window.ruke.db.query('getHistory', 50, 0);
        set({ history });
      } catch {}
    },

    clearHistory: async () => {
      await window.ruke.db.query('clearHistory');
      set({ history: [] });
    },

    searchHistory: async (query) => {
      if (!query) {
        get().loadHistory();
        return;
      }
      const history = await window.ruke.db.query('searchHistory', query);
      set({ history });
    },

    loadRequestHistory: async (requestId) => {
      try {
        const entries: HistoryEntry[] = await window.ruke.db.query('getHistoryForRequest', requestId, 20);
        if (get().activeRequest.id === requestId) {
          set({ requestHistory: entries });
        }
      } catch {}
    },

    viewHistoryResponse: (historyId) => {
      const entry = get().requestHistory.find(h => h.id === historyId);
      if (entry) {
        set({ response: entry.response });
      }
    },

    saveRequest: async () => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = null;
      }
      const req = get().activeRequest;
      set({ saveStatus: 'saving' });
      try {
        const existing = await window.ruke.db.query('getRequestById', req.id);
        if (existing) {
          await window.ruke.db.query('updateRequest', req.id, req);
        } else {
          await window.ruke.db.query('createRequest', req);
        }
      } catch {
        try { await window.ruke.db.query('createRequest', req); } catch {}
      }
      set({ saveStatus: 'saved' });
      if (savedResetTimer) clearTimeout(savedResetTimer);
      savedResetTimer = setTimeout(() => {
        savedResetTimer = null;
        if (get().saveStatus === 'saved') set({ saveStatus: 'idle' });
      }, 2000);
      if (req.collectionId) {
        try {
          const { useCollectionStore } = await import('./collectionStore');
          useCollectionStore.getState().loadRequests(req.collectionId);
        } catch {}
      }
      get().loadUncollectedRequests();
    },

    loadRequest: async (id) => {
      const req = await window.ruke.db.query('getRequestById', id);
      if (req) {
        get().selectRequest(req);
      }
    },

    deleteRequest: async (id) => {
      try { await window.ruke.db.query('deleteRequest', id); } catch {}
      if (localStorage.getItem('ruke:lastActiveRequestId') === id) {
        localStorage.removeItem('ruke:lastActiveRequestId');
      }
      get().closeTab(id);
      await get().loadUncollectedRequests();
      await get().loadArchivedRequests();
      try {
        const { useCollectionStore } = await import('./collectionStore');
        const cols = useCollectionStore.getState().collections;
        for (const c of cols) {
          useCollectionStore.getState().loadRequests(c.id);
        }
      } catch {}
    },
  };
});
