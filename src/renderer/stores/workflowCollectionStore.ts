import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { WorkflowCollection, Workflow, WorkflowCollectionTreeNode } from '@shared/types';
import { useCollectionStore } from './collectionStore';

interface WorkflowCollectionState {
  workflowCollections: WorkflowCollection[];
  workflows: Record<string, Workflow[]>;
  expandedIds: string[];

  loadWorkflowCollections: (workspaceId: string) => Promise<void>;
  loadWorkflows: (collectionId: string) => Promise<void>;
  createWorkflowCollection: (name: string, parentId?: string | null) => Promise<WorkflowCollection>;
  renameWorkflowCollection: (id: string, name: string) => Promise<void>;
  deleteWorkflowCollection: (id: string) => Promise<void>;
  moveWorkflowCollection: (id: string, newParentId: string | null) => Promise<void>;
  reorderWorkflowCollections: (orderedIds: string[]) => Promise<void>;
  reorderWorkflows: (collectionId: string, orderedIds: string[]) => Promise<void>;
  moveWorkflowToCollection: (workflowId: string, collectionId: string, insertIndex?: number) => Promise<void>;
  toggleExpanded: (id: string) => void;
  getTree: () => WorkflowCollectionTreeNode[];
}

export const useWorkflowCollectionStore = create<WorkflowCollectionState>((set, get) => ({
  workflowCollections: [],
  workflows: {},
  expandedIds: [],

  loadWorkflowCollections: async (workspaceId) => {
    try {
      const cols = await window.ruke.db.query('getWorkflowCollections', workspaceId);
      set({ workflowCollections: Array.isArray(cols) ? cols : [] });
      const collections = Array.isArray(cols) ? cols : [];
      for (const c of collections) {
        get().loadWorkflows(c.id);
      }
    } catch { /* db not ready */ }
  },

  loadWorkflows: async (collectionId) => {
    try {
      const list = await window.ruke.db.query('getWorkflowsByCollection', collectionId);
      set((s) => ({
        workflows: { ...s.workflows, [collectionId]: Array.isArray(list) ? list : [] },
      }));
    } catch {
      set((s) => ({ workflows: { ...s.workflows, [collectionId]: [] } }));
    }
  },

  createWorkflowCollection: async (name, parentId = null) => {
    const wsId = useCollectionStore.getState().activeWorkspaceId;
    if (!wsId) throw new Error('No active workspace');
    const id = nanoid();
    const cols = get().workflowCollections;
    const sortOrder = cols.length;
    await window.ruke.db.query('createWorkflowCollection', id, wsId, name, parentId, sortOrder);
    const collection: WorkflowCollection = {
      id,
      workspaceId: wsId,
      name,
      parentId,
      sortOrder,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((s) => ({ workflowCollections: [...s.workflowCollections, collection] }));
    return collection;
  },

  renameWorkflowCollection: async (id, name) => {
    await window.ruke.db.query('updateWorkflowCollection', id, { name });
    set((s) => ({
      workflowCollections: s.workflowCollections.map((c) => (c.id === id ? { ...c, name } : c)),
    }));
  },

  deleteWorkflowCollection: async (id) => {
    await window.ruke.db.query('deleteWorkflowCollection', id);
    set((s) => {
      const { [id]: _, ...rest } = s.workflows;
      return {
        workflowCollections: s.workflowCollections.filter((c) => c.id !== id && c.parentId !== id),
        workflows: rest,
      };
    });
  },

  moveWorkflowCollection: async (id, newParentId) => {
    await window.ruke.db.query('updateWorkflowCollection', id, { parentId: newParentId });
    set((s) => ({
      workflowCollections: s.workflowCollections.map((c) =>
        c.id === id ? { ...c, parentId: newParentId } : c
      ),
    }));
  },

  reorderWorkflowCollections: async (orderedIds) => {
    await Promise.all(
      orderedIds.map((id, i) => window.ruke.db.query('updateWorkflowCollection', id, { sortOrder: i }))
    );
    set((s) => ({
      workflowCollections: s.workflowCollections.map((c) => {
        const idx = orderedIds.indexOf(c.id);
        return idx >= 0 ? { ...c, sortOrder: idx } : c;
      }),
    }));
  },

  reorderWorkflows: async (collectionId, orderedIds) => {
    await Promise.all(
      orderedIds.map((id, i) => window.ruke.db.query('updateWorkflow', id, { sortOrder: i }))
    );
    await get().loadWorkflows(collectionId);
  },

  moveWorkflowToCollection: async (workflowId, collectionId, insertIndex) => {
    const wfs = get().workflows[collectionId] || [];
    const idx = insertIndex ?? wfs.length;
    await window.ruke.db.query('updateWorkflow', workflowId, { collectionId, sortOrder: idx });
    await get().loadWorkflows(collectionId);
    const wsId = useCollectionStore.getState().activeWorkspaceId;
    if (wsId) {
      const { useWorkflowStore } = await import('./workflowStore');
      useWorkflowStore.getState().loadWorkflows(wsId);
    }
  },

  toggleExpanded: (id) => {
    set((s) => ({
      expandedIds: s.expandedIds.includes(id)
        ? s.expandedIds.filter((eid) => eid !== id)
        : [...s.expandedIds, id],
    }));
  },

  getTree: () => {
    const { workflowCollections, workflows } = get();
    const buildNode = (col: WorkflowCollection): WorkflowCollectionTreeNode => ({
      collection: col,
      children: workflowCollections
        .filter((c) => c.parentId === col.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(buildNode),
      workflows: workflows[col.id] || [],
    });
    return workflowCollections
      .filter((c) => !c.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(buildNode);
  },
}));
