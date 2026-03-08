import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { Collection, ApiRequest, Workspace, CollectionTreeNode } from '@shared/types';

interface CollectionState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  collections: Collection[];
  requests: Record<string, ApiRequest[]>;
  expandedIds: string[];

  loadWorkspaces: () => Promise<void>;
  setActiveWorkspace: (id: string) => void;
  loadCollections: () => Promise<void>;
  loadRequests: (collectionId: string) => Promise<void>;
  createCollection: (name: string, parentId?: string | null) => Promise<Collection>;
  renameCollection: (id: string, name: string) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  moveCollection: (id: string, newParentId: string | null) => Promise<void>;
  toggleExpanded: (id: string) => void;
  getTree: () => CollectionTreeNode[];
}

export const useCollectionStore = create<CollectionState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  collections: [],
  requests: {},
  expandedIds: [],

  loadWorkspaces: async () => {
    try {
      const workspaces = await window.ruke.db.query('getWorkspaces');
      set({ workspaces });
      if (workspaces.length > 0 && !get().activeWorkspaceId) {
        set({ activeWorkspaceId: workspaces[0].id });
        get().loadCollections();
      }
    } catch { /* db not ready */ }
  },

  setActiveWorkspace: (id) => {
    set({ activeWorkspaceId: id, collections: [], requests: {} });
    get().loadCollections();
  },

  loadCollections: async () => {
    const wsId = get().activeWorkspaceId;
    if (!wsId) return;
    try {
      const collections = await window.ruke.db.query('getCollections', wsId);
      set({ collections });
      for (const c of collections) {
        get().loadRequests(c.id);
      }
    } catch { /* db not ready */ }
  },

  loadRequests: async (collectionId) => {
    try {
      const reqs = await window.ruke.db.query('getRequests', collectionId);
      set((s) => ({
        requests: { ...s.requests, [collectionId]: reqs },
      }));
    } catch { /* db not ready */ }
  },

  createCollection: async (name, parentId = null) => {
    const wsId = get().activeWorkspaceId;
    if (!wsId) throw new Error('No active workspace');
    const id = nanoid();
    const sortOrder = get().collections.length;
    await window.ruke.db.query('createCollection', id, wsId, name, parentId, sortOrder);
    const collection: Collection = {
      id, workspaceId: wsId, name, parentId, sortOrder,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    set((s) => ({ collections: [...s.collections, collection] }));
    return collection;
  },

  renameCollection: async (id, name) => {
    await window.ruke.db.query('updateCollection', id, { name });
    set((s) => ({
      collections: s.collections.map((c) => (c.id === id ? { ...c, name } : c)),
    }));
  },

  deleteCollection: async (id) => {
    await window.ruke.db.query('deleteCollection', id);
    set((s) => ({
      collections: s.collections.filter((c) => c.id !== id && c.parentId !== id),
    }));
  },

  moveCollection: async (id, newParentId) => {
    await window.ruke.db.query('updateCollection', id, { parentId: newParentId });
    set((s) => ({
      collections: s.collections.map((c) =>
        c.id === id ? { ...c, parentId: newParentId } : c
      ),
    }));
  },

  toggleExpanded: (id) => {
    set((s) => ({
      expandedIds: s.expandedIds.includes(id)
        ? s.expandedIds.filter((eid) => eid !== id)
        : [...s.expandedIds, id],
    }));
  },

  getTree: () => {
    const { collections, requests } = get();
    const buildNode = (collection: Collection): CollectionTreeNode => ({
      collection,
      children: collections
        .filter((c) => c.parentId === collection.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(buildNode),
      requests: requests[collection.id] || [],
    });
    return collections
      .filter((c) => !c.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(buildNode);
  },
}));
