import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useWorkflowStore } from '../../stores/workflowStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { useWorkflowCollectionStore } from '../../stores/workflowCollectionStore';
import { useRequestStore } from '../../stores/requestStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useUiStore } from '../../stores/uiStore';
import {
  Plus,
  Search,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  GitBranch,
  GripVertical,
  MoreHorizontal,
  Trash2,
  Play,
  X,
  Variable,
  Pencil,
  Eye,
  Lightbulb,
  Copy,
  Check,
  Loader2,
  FolderPlus,
} from 'lucide-react';
import { METHOD_COLORS } from '@shared/constants';
import type { Workflow, WorkflowStep, WorkflowInput, ApiRequest, WorkflowCollectionTreeNode } from '@shared/types';
import { WorkflowRunner } from './WorkflowRunner';
import { RequestBuilder } from '../request/RequestBuilder';
import { EnvironmentPill } from '../request/EnvironmentPill';
import { toCurl } from '@shared/curl';

function WorkflowSidebarItem({
  workflow,
  isSelected,
  isArchived,
  isSearching,
  draggedId,
  dropTargetId,
  sourceCollectionId,
  onSelect,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: {
  workflow: Workflow;
  isSelected: boolean;
  isArchived: boolean;
  isSearching: boolean;
  draggedId: string | null;
  dropTargetId: string | null;
  sourceCollectionId?: string | null;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const showDropAbove = dropTargetId === workflow.id;
  const dropPosition = useWorkflowStore.getState?.() ? null : null; // Will use parent's dropPosition
  // Use a sentinel: parent passes dropPosition via context or we derive from dropTargetId
  const isDropAbove = dropTargetId === workflow.id; // Parent will need to pass position

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/ruke-workflow-id', workflow.id);
    e.dataTransfer.setData('text/plain', workflow.id);
    if (sourceCollectionId) {
      e.dataTransfer.setData('application/ruke-workflow-source-collection', sourceCollectionId);
    }
    e.dataTransfer.effectAllowed = 'move';
    onDragStart(e);
  };

  return (
    <div
      draggable={!isSearching && !isArchived}
      onDragStart={handleDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`relative group rounded-lg transition-colors min-h-[36px] ${
        draggedId === workflow.id ? 'opacity-50' : ''
      } ${dropTargetId === workflow.id ? 'ring-1 ring-accent/50' : ''}`}
    >
      {/* Drop indicator above - shown when this item is drop target and position is above */}
      <button
        onClick={onSelect}
        className={`w-full text-left rounded-lg transition-colors flex items-center gap-2 px-3 py-2.5 group/btn ${
          isSelected ? 'bg-accent/10 text-text-primary ring-1 ring-accent/30 ring-inset' : isArchived
            ? 'text-text-muted hover:bg-bg-hover hover:text-text-primary'
            : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
        }`}
      >
        <GitBranch size={15} className={`shrink-0 ${isSelected ? 'text-accent' : 'text-text-muted'}`} />
        <span className={`text-[13px] truncate flex-1 ${isArchived ? 'font-normal' : 'font-medium'}`}>
          {workflow.name}
        </span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
        className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md transition-all ${
          menuOpen ? 'opacity-100 bg-bg-hover' : 'opacity-0 group-hover:opacity-100 hover:bg-bg-hover'
        }`}
      >
        <MoreHorizontal size={12} className="text-text-muted" />
      </button>
      {menuOpen && (
        <WorkflowItemMenu
          workflow={workflow}
          isArchived={isArchived}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}

function ArchiveMenu({ onEmptyArchive }: { onEmptyArchive: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  return (
    <div className="relative group/arch" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1 rounded opacity-0 group-hover/arch:opacity-100 hover:bg-bg-hover text-text-muted transition-all"
        title="Archive options"
      >
        <MoreHorizontal size={12} />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 w-40 py-1 bg-bg-secondary border border-border rounded-lg shadow-xl z-50">
          <button
            onClick={async () => { setOpen(false); await onEmptyArchive(); }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={12} /> Empty Archive
          </button>
        </div>
      )}
    </div>
  );
}

function WorkflowItemMenu({
  workflow,
  isArchived,
  onClose,
}: {
  workflow: Workflow;
  isArchived: boolean;
  onClose: () => void;
}) {
  const { archiveWorkflow, unarchiveWorkflow, deleteWorkflow } = useWorkflowStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-1 z-50 w-44 py-1 rounded-lg bg-bg-secondary border border-border shadow-xl"
    >
      {isArchived ? (
        <>
          <button
            onClick={async (e) => { e.stopPropagation(); await unarchiveWorkflow(workflow.id); onClose(); }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
          >
            <ArchiveRestore size={12} /> Restore
          </button>
          <button
            onClick={async (e) => { e.stopPropagation(); await deleteWorkflow(workflow.id); onClose(); }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={12} /> Delete permanently
          </button>
        </>
      ) : (
        <button
          onClick={async (e) => { e.stopPropagation(); await archiveWorkflow(workflow.id); onClose(); }}
          className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
        >
          <Archive size={12} /> Archive
        </button>
      )}
    </div>
  );
}

function nodeContainsWorkflow(n: WorkflowCollectionTreeNode, wfId: string): boolean {
  if (n.workflows.some((w) => w.id === wfId)) return true;
  return n.children.some((child) => nodeContainsWorkflow(child, wfId));
}

function WorkflowCollectionNode({
  node,
  depth,
  selectedWorkflowId,
  draggedId,
  onSelectWorkflow,
  onNewWorkflow,
  onDragOverCollection,
  onWorkflowDragStart,
  onWorkflowDragEnd,
  collectionDropPosition,
}: {
  node: WorkflowCollectionTreeNode;
  depth: number;
  selectedWorkflowId: string | null;
  draggedId: string | null;
  onSelectWorkflow: (w: Workflow) => void;
  onNewWorkflow: (collectionId: string) => void;
  onDragOverCollection?: (colId: string, position: 'above' | 'below') => void;
  onWorkflowDragStart: (id: string) => void;
  onWorkflowDragEnd: () => void;
  collectionDropPosition?: 'above' | 'below' | null;
}) {
  const toggleExpanded = useWorkflowCollectionStore((s) => s.toggleExpanded);
  const expandedIds = useWorkflowCollectionStore((s) => s.expandedIds);
  const deleteWorkflowCollection = useWorkflowCollectionStore((s) => s.deleteWorkflowCollection);
  const renameWorkflowCollection = useWorkflowCollectionStore((s) => s.renameWorkflowCollection);
  const reorderWorkflows = useWorkflowCollectionStore((s) => s.reorderWorkflows);
  const moveWorkflowToCollection = useWorkflowCollectionStore((s) => s.moveWorkflowToCollection);
  const archiveWorkflow = useWorkflowStore((s) => s.archiveWorkflow);
  const isExpanded = expandedIds.includes(node.collection.id);
  const containsSelected = selectedWorkflowId ? nodeContainsWorkflow(node, selectedWorkflowId) : false;
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.collection.name);
  const [showMenu, setShowMenu] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dropTarget, setDropTarget] = useState<{ wfId: string; position: 'above' | 'below' } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  const handleRename = () => {
    if (renameValue.trim()) {
      renameWorkflowCollection(node.collection.id, renameValue.trim());
    }
    setIsRenaming(false);
  };

  const handleCollectionDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/ruke-workflow-collection-id', node.collection.id);
    e.dataTransfer.setData('application/ruke-context', JSON.stringify({ type: 'workflow-collection', id: node.collection.id, label: node.collection.name, meta: `${node.workflows.length} workflow${node.workflows.length !== 1 ? 's' : ''}` }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const headerRef = useRef<HTMLDivElement>(null);

  const handleHeaderDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (e.dataTransfer.types.includes('application/ruke-workflow-collection-id')) {
      if (onDragOverCollection && headerRef.current) {
        const rect = headerRef.current.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        onDragOverCollection(node.collection.id, e.clientY < midY ? 'above' : 'below');
      }
    } else if (e.dataTransfer.types.includes('application/ruke-workflow-id')) {
      setDragOver(true);
      setDropTarget(null);
    }
  };

  const handleHeaderDragLeave = (e: React.DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  };

  const handleContainerDragLeave = (e: React.DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDropTarget(null);
      setDragOver(false);
    }
  };

  const handleDragOverItem = useCallback((wfId: string, position: 'above' | 'below') => {
    setDropTarget((prev) => {
      if (prev?.wfId === wfId && prev?.position === position) return prev;
      return { wfId, position };
    });
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/ruke-workflow-collection-id')) {
      setDragOver(false);
      setDropTarget(null);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const workflowId = e.dataTransfer.getData('application/ruke-workflow-id') || e.dataTransfer.getData('text/plain');
    const sourceCollection = e.dataTransfer.getData('application/ruke-workflow-source-collection');
    setDragOver(false);
    const currentDropTarget = dropTarget;
    setDropTarget(null);

    if (!workflowId) return;

    const collectionId = node.collection.id;
    const workflows = node.workflows;
    const isSameCollection = sourceCollection === collectionId;

    if (currentDropTarget) {
      const targetIdx = workflows.findIndex((w) => w.id === currentDropTarget.wfId);
      if (targetIdx < 0) return;
      const insertIdx = currentDropTarget.position === 'below' ? targetIdx + 1 : targetIdx;

      if (isSameCollection) {
        const ordered = workflows.map((w) => w.id);
        const fromIdx = ordered.indexOf(workflowId);
        if (fromIdx >= 0) {
          ordered.splice(fromIdx, 1);
          const adjustedIdx = insertIdx > fromIdx ? insertIdx - 1 : insertIdx;
          ordered.splice(adjustedIdx, 0, workflowId);
          await reorderWorkflows(collectionId, ordered);
        }
      } else {
        await moveWorkflowToCollection(workflowId, collectionId, insertIdx);
        if (sourceCollection) {
          useWorkflowCollectionStore.getState().loadWorkflows(sourceCollection);
        }
      }
    } else {
      if (!isSameCollection) {
        await moveWorkflowToCollection(workflowId, collectionId);
        if (sourceCollection) {
          useWorkflowCollectionStore.getState().loadWorkflows(sourceCollection);
        }
      }
    }
  }, [dropTarget, node.collection.id, node.workflows, reorderWorkflows, moveWorkflowToCollection]);

  return (
    <div onDragLeave={handleContainerDragLeave} onDrop={handleDrop} className="relative">
      {collectionDropPosition === 'above' && (
        <div className="absolute top-0 left-2 right-2 h-0.5 bg-accent rounded-full z-10 -translate-y-px" />
      )}
      <div
        ref={headerRef}
        draggable={!isRenaming}
        onDragStart={handleCollectionDragStart}
        className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors cursor-pointer min-h-[36px] ${
          dragOver ? 'bg-accent/15 ring-1 ring-accent/40 ring-inset' : containsSelected && !isExpanded ? 'bg-accent/10 ring-1 ring-accent/30 ring-inset' : 'hover:bg-bg-hover'
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => toggleExpanded(node.collection.id)}
        onDragOver={handleHeaderDragOver}
        onDragLeave={handleHeaderDragLeave}
      >
        <span className="text-text-muted shrink-0">
          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') setIsRenaming(false);
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-[13px] bg-bg-tertiary border border-accent px-1.5 py-0.5 rounded text-text-primary focus:outline-none"
          />
        ) : (
          <span
            className="text-[13px] font-medium text-text-primary truncate flex-1"
            onDoubleClick={(e) => { e.stopPropagation(); setRenameValue(node.collection.name); setIsRenaming(true); }}
          >
            {node.collection.name}
          </span>
        )}
        <span className="text-[10px] text-text-muted shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {node.workflows.length > 0 ? node.workflows.length : 'Empty'}
        </span>
        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-bg-active text-text-muted transition-all"
          >
            <MoreHorizontal size={12} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-bg-secondary border border-border rounded-lg shadow-xl z-50 py-1 animate-fade-in">
              <button
                onClick={(e) => { e.stopPropagation(); onNewWorkflow(node.collection.id); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
              >
                <Plus size={12} /> New Workflow
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setIsRenaming(true); setRenameValue(node.collection.name); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
              >
                <Pencil size={12} /> Rename
              </button>
              <button
                onClick={async (e) => { e.stopPropagation(); await deleteWorkflowCollection(node.collection.id); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
      {isExpanded && (
        <div className="pl-2 space-y-1">
          {node.workflows.map((w) => (
            <div
              key={w.id}
              className="relative pl-1.5"
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes('application/ruke-workflow-id') && !e.dataTransfer.types.includes('text/plain')) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                handleDragOverItem(w.id, e.clientY < midY ? 'above' : 'below');
              }}
              onDragLeave={(e) => {
                if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDropTarget(null);
              }}
              onDrop={(e) => {
                const pos = dropTarget?.wfId === w.id ? dropTarget.position : 'below';
                handleDrop(e);
              }}
            >
              {dropTarget?.wfId === w.id && dropTarget?.position === 'above' && (
                <div className="absolute top-0 left-4 right-2 h-0.5 bg-accent rounded-full z-10 -translate-y-px pointer-events-none" />
              )}
              <WorkflowSidebarItem
                workflow={w}
                isSelected={selectedWorkflowId === w.id}
                isArchived={false}
                isSearching={false}
                draggedId={draggedId}
                dropTargetId={dropTarget?.wfId === w.id ? w.id : null}
                sourceCollectionId={node.collection.id}
                onSelect={() => onSelectWorkflow(w)}
                onDragStart={() => onWorkflowDragStart(w.id)}
                onDragOver={() => {}}
                onDragLeave={() => {}}
                onDrop={() => {}}
                onDragEnd={onWorkflowDragEnd}
              />
              {dropTarget?.wfId === w.id && dropTarget?.position === 'below' && (
                <div className="absolute bottom-0 left-4 right-2 h-0.5 bg-accent rounded-full z-10 translate-y-px pointer-events-none" />
              )}
            </div>
          ))}
          {node.children.map((child) => (
            <WorkflowCollectionNode
              key={child.collection.id}
              node={child}
              depth={depth + 1}
              selectedWorkflowId={selectedWorkflowId}
              draggedId={draggedId}
              onSelectWorkflow={onSelectWorkflow}
              onNewWorkflow={onNewWorkflow}
              onDragOverCollection={onDragOverCollection}
              onWorkflowDragStart={onWorkflowDragStart}
              onWorkflowDragEnd={onWorkflowDragEnd}
              collectionDropPosition={collectionDropPosition}
            />
          ))}
        </div>
      )}
      {collectionDropPosition === 'below' && (
        <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full z-10 translate-y-px" />
      )}
    </div>
  );
}

export function WorkflowsSidebar() {
  const {
    workflows,
    archivedWorkflows,
    createWorkflow,
    selectWorkflow,
    reorderWorkflows,
  } = useWorkflowStore();
  const workflowCollections = useWorkflowCollectionStore((s) => s.workflowCollections);
  const workflowsByCollection = useWorkflowCollectionStore((s) => s.workflows);
  const createWorkflowCollection = useWorkflowCollectionStore((s) => s.createWorkflowCollection);
  const loadWorkflowCollections = useWorkflowCollectionStore((s) => s.loadWorkflowCollections);
  const loadWorkflows = useWorkflowCollectionStore((s) => s.loadWorkflows);
  const reorderWorkflowCollections = useWorkflowCollectionStore((s) => s.reorderWorkflowCollections);
  const toggleExpanded = useWorkflowCollectionStore((s) => s.toggleExpanded);
  const activeWorkspaceId = useCollectionStore((s) => s.activeWorkspaceId);
  const selectedWorkflowId = useWorkflowStore((s) => s.selectedWorkflowId);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [wfDropTarget, setWfDropTarget] = useState<{ wfId: string; position: 'above' | 'below' } | null>(null);
  const [colDropTarget, setColDropTarget] = useState<{ colId: string; position: 'above' | 'below' } | null>(null);

  const tree = useMemo(() => {
    const cols = workflowCollections;
    const buildNode = (col: (typeof cols)[number]): WorkflowCollectionTreeNode => ({
      collection: col,
      children: cols
        .filter((c) => c.parentId === col.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(buildNode),
      workflows: workflowsByCollection[col.id] || [],
    });
    return cols
      .filter((c) => !c.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(buildNode);
  }, [workflowCollections, workflowsByCollection]);

  const filteredUncollected = useMemo(() => {
    if (!sidebarSearch.trim()) return workflows;
    const q = sidebarSearch.toLowerCase();
    return workflows.filter((w) => w.name.toLowerCase().includes(q));
  }, [workflows, sidebarSearch]);

  const filteredArchived = useMemo(() => {
    if (!sidebarSearch.trim()) return archivedWorkflows;
    const q = sidebarSearch.toLowerCase();
    return archivedWorkflows.filter((w) => w.name.toLowerCase().includes(q));
  }, [archivedWorkflows, sidebarSearch]);

  const filteredTree = useMemo(() => {
    if (!sidebarSearch.trim()) return tree;
    const q = sidebarSearch.toLowerCase();
    const filterNode = (node: WorkflowCollectionTreeNode): WorkflowCollectionTreeNode | null => {
      const matchingWorkflows = node.workflows.filter((w) => w.name.toLowerCase().includes(q));
      const matchingChildren = node.children.map(filterNode).filter(Boolean) as WorkflowCollectionTreeNode[];
      if (matchingWorkflows.length > 0 || matchingChildren.length > 0 || node.collection.name.toLowerCase().includes(q)) {
        return { ...node, workflows: matchingWorkflows, children: matchingChildren };
      }
      return null;
    };
    return tree.map(filterNode).filter(Boolean) as WorkflowCollectionTreeNode[];
  }, [tree, sidebarSearch]);

  const isSearching = sidebarSearch.trim().length > 0;

  const handleCreate = async () => {
    if (!activeWorkspaceId) return;
    const w = await createWorkflow(activeWorkspaceId, 'New Workflow');
    await selectWorkflow(w.id);
  };

  const handleCreateWorkflowCollection = useCallback(async () => {
    const col = await createWorkflowCollection('New Collection');
    if (!useWorkflowCollectionStore.getState().expandedIds.includes(col.id)) {
      toggleExpanded(col.id);
    }
  }, [createWorkflowCollection, toggleExpanded]);

  const handleNewWorkflowInCollection = useCallback(async (collectionId: string) => {
    if (!activeWorkspaceId) return;
    const w = await createWorkflow(activeWorkspaceId, 'New Workflow', collectionId);
    await selectWorkflow(w.id);
  }, [activeWorkspaceId, createWorkflow, selectWorkflow]);

  const handleDragStart = useCallback((id: string) => {
    setDraggedId(id);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetId: string) => {
      const hasWorkflow = e.dataTransfer.types.includes('application/ruke-workflow-id') || e.dataTransfer.types.includes('text/plain');
      if (!hasWorkflow || draggedId === targetId || isSearching) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      setWfDropTarget({ wfId: targetId, position: e.clientY < midY ? 'above' : 'below' });
    },
    [draggedId, isSearching]
  );

  const handleUncollectedDrop = useCallback(async (e: React.DragEvent, targetWfId: string, position: 'above' | 'below') => {
    e.preventDefault();
    setWfDropTarget(null);
    const workflowId = e.dataTransfer.getData('application/ruke-workflow-id') || e.dataTransfer.getData('text/plain');
    const sourceCollection = e.dataTransfer.getData('application/ruke-workflow-source-collection');
    if (!workflowId || !activeWorkspaceId) return;

    const ids = filteredUncollected.map((w) => w.id);
    const targetIdx = ids.indexOf(targetWfId);
    if (targetIdx < 0) return;
    const insertIdx = position === 'below' ? targetIdx + 1 : targetIdx;

    if (sourceCollection) {
      try {
        await window.ruke.db.query('updateWorkflow', workflowId, { collectionId: null });
        useWorkflowStore.getState().loadWorkflows(activeWorkspaceId);
        loadWorkflows(sourceCollection);
      } catch {}
      const fresh = useWorkflowStore.getState().workflows;
      const freshIds = fresh.map((w) => w.id);
      const movedIdx = freshIds.indexOf(workflowId);
      if (movedIdx >= 0) {
        const reordered = [...freshIds];
        reordered.splice(movedIdx, 1);
        const newIdx = reordered.indexOf(targetWfId);
        const insertAt = position === 'below' ? newIdx + 1 : newIdx;
        reordered.splice(Math.max(0, insertAt), 0, workflowId);
        await reorderWorkflows(activeWorkspaceId, reordered);
      }
    } else {
      const fromIdx = ids.indexOf(workflowId);
      if (fromIdx < 0) return;
      const reordered = [...ids];
      reordered.splice(fromIdx, 1);
      reordered.splice(insertIdx, 0, workflowId);
      await reorderWorkflows(activeWorkspaceId, reordered);
    }
  }, [filteredUncollected, activeWorkspaceId, reorderWorkflows, loadWorkflows]);

  const handleDragOverUncollected = useCallback((wfId: string, position: 'above' | 'below') => {
    setWfDropTarget((prev) => (prev?.wfId === wfId && prev?.position === position ? prev : { wfId, position }));
  }, []);

  const handleDragOverCollection = useCallback((colId: string, position: 'above' | 'below') => {
    setColDropTarget((prev) => (prev?.colId === colId && prev?.position === position ? prev : { colId, position }));
  }, []);

  useEffect(() => {
    if (activeWorkspaceId) {
      useWorkflowStore.getState().loadWorkflows(activeWorkspaceId);
      loadWorkflowCollections(activeWorkspaceId);
    }
  }, [activeWorkspaceId, loadWorkflowCollections]);

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="px-3 pt-3 pb-2 space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Workflows</h2>
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleCreate}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              title="New Workflow"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={handleCreateWorkflowCollection}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              title="New Collection"
            >
              <FolderPlus size={14} />
            </button>
          </div>
        </div>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
            placeholder="Search workflows..."
            className="w-full pl-7 pr-3 py-1.5 text-xs bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
          />
        </div>
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-1"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('application/ruke-workflow-id') || e.dataTransfer.types.includes('application/ruke-workflow-source-collection')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }
        }}
        onDrop={async (e) => {
          const workflowId = e.dataTransfer.getData('application/ruke-workflow-id') || e.dataTransfer.getData('text/plain');
          const sourceCollection = e.dataTransfer.getData('application/ruke-workflow-source-collection');
          if (workflowId && sourceCollection && activeWorkspaceId) {
            e.preventDefault();
            try {
              await window.ruke.db.query('updateWorkflow', workflowId, { collectionId: null });
              useWorkflowStore.getState().loadWorkflows(activeWorkspaceId);
              loadWorkflows(sourceCollection);
            } catch {}
          }
        }}
      >
        {filteredUncollected.length === 0 && !sidebarSearch && workflowCollections.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <GitBranch size={20} className="text-text-muted mb-2" />
            <p className="text-xs text-text-muted">No workflows yet</p>
          </div>
        )}

        {filteredUncollected.length === 0 && sidebarSearch && filteredTree.length === 0 && filteredArchived.length === 0 && (
          <p className="text-xs text-text-muted text-center py-4">No results</p>
        )}

        <div className="space-y-0.5">
        {filteredUncollected.map((w) => (
          <div
            key={w.id}
            className="relative"
            onDragOver={(e) => {
              const hasWorkflow = e.dataTransfer.types.includes('application/ruke-workflow-id') || e.dataTransfer.types.includes('text/plain');
              if (!hasWorkflow) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const midY = rect.top + rect.height / 2;
              handleDragOverUncollected(w.id, e.clientY < midY ? 'above' : 'below');
            }}
            onDragLeave={(e) => {
              if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setWfDropTarget(null);
            }}
            onDrop={(e) => {
              const pos = wfDropTarget?.wfId === w.id ? wfDropTarget.position : 'below';
              handleUncollectedDrop(e, w.id, pos);
            }}
          >
            {wfDropTarget?.wfId === w.id && wfDropTarget?.position === 'above' && (
              <div className="absolute top-0 left-4 right-2 h-0.5 bg-accent rounded-full z-10 -translate-y-px pointer-events-none" />
            )}
            <WorkflowSidebarItem
              workflow={w}
              isSelected={selectedWorkflowId === w.id}
              isArchived={false}
              isSearching={isSearching}
              draggedId={draggedId}
              dropTargetId={wfDropTarget?.wfId === w.id ? w.id : null}
              onSelect={() => selectWorkflow(w.id)}
              onDragStart={() => handleDragStart(w.id)}
              onDragOver={() => {}}
              onDragLeave={() => { setWfDropTarget(null); }}
              onDrop={() => {}}
              onDragEnd={() => { setDraggedId(null); setWfDropTarget(null); }}
            />
            {wfDropTarget?.wfId === w.id && wfDropTarget?.position === 'below' && (
              <div className="absolute bottom-0 left-4 right-2 h-0.5 bg-accent rounded-full z-10 translate-y-px pointer-events-none" />
            )}
          </div>
        ))}
        </div>

        <div
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('application/ruke-workflow-collection-id')) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }
          }}
          onDragLeave={(e) => {
            if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setColDropTarget(null);
          }}
          onDrop={async (e) => {
            e.preventDefault();
            const draggedColId = e.dataTransfer.getData('application/ruke-workflow-collection-id');
            if (!draggedColId || !colDropTarget) { setColDropTarget(null); return; }
            const ordered = filteredTree.map((n) => n.collection.id);
            const fromIdx = ordered.indexOf(draggedColId);
            if (fromIdx < 0) { setColDropTarget(null); return; }
            ordered.splice(fromIdx, 1);
            const targetIdx = ordered.indexOf(colDropTarget.colId);
            const insertIdx = colDropTarget.position === 'below' ? targetIdx + 1 : targetIdx;
            ordered.splice(insertIdx, 0, draggedColId);
            setColDropTarget(null);
            await reorderWorkflowCollections(ordered);
          }}
        >
          {filteredTree.map((node) => (
            <WorkflowCollectionNode
              key={node.collection.id}
              node={node}
              depth={0}
              selectedWorkflowId={selectedWorkflowId}
              draggedId={draggedId}
              onSelectWorkflow={(w) => selectWorkflow(w.id)}
              onNewWorkflow={handleNewWorkflowInCollection}
              onDragOverCollection={handleDragOverCollection}
              onWorkflowDragStart={handleDragStart}
              onWorkflowDragEnd={() => { setDraggedId(null); setWfDropTarget(null); }}
              collectionDropPosition={colDropTarget?.colId === node.collection.id ? colDropTarget.position : null}
            />
          ))}
        </div>
      </div>

        {archivedWorkflows.length > 0 && (
          <div className="shrink-0 border-t border-border/60 bg-bg-secondary/50 flex flex-col">
            <div className="flex items-center group/arch">
              <button
                onClick={() => setArchiveExpanded(!archiveExpanded)}
                className="flex items-center gap-1.5 flex-1 px-3 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider hover:text-text-secondary transition-colors"
              >
                {archiveExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                <Archive size={10} />
                Archive ({filteredArchived.length})
              </button>
              <ArchiveMenu
                onEmptyArchive={async () => {
                  if (activeWorkspaceId && confirm(`Permanently delete all ${filteredArchived.length} archived workflows? This cannot be undone.`)) {
                    await useWorkflowStore.getState().clearArchivedWorkflows(activeWorkspaceId);
                    setArchiveExpanded(false);
                  }
                }}
              />
            </div>
          {archiveExpanded && (
            <div
              className="overflow-y-auto px-2 pb-2"
              style={{ maxHeight: '50vh' }}
            >
              {filteredArchived.map((w) => (
                <div key={w.id} className="py-1.5">
                  <WorkflowSidebarItem
                    workflow={w}
                    isSelected={selectedWorkflowId === w.id}
                    isArchived={true}
                    isSearching={false}
                    draggedId={null}
                    dropTargetId={null}
                    onSelect={() => selectWorkflow(w.id)}
                    onDragStart={() => {}}
                    onDragOver={() => {}}
                    onDragLeave={() => {}}
                    onDrop={() => {}}
                    onDragEnd={() => {}}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RequestPickerModal({
  onPick,
  onClose,
}: {
  onPick: (requestId: string) => void;
  onClose: () => void;
}) {
  const collections = useCollectionStore((s) => s.collections);
  const requestsMap = useCollectionStore((s) => s.requests);
  const uncollectedRequests = useRequestStore((s) => s.uncollectedRequests);
  const createAndSaveRequest = useRequestStore((s) => s.createAndSaveRequest);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateNew = async () => {
    setCreating(true);
    try {
      const req = await createAndSaveRequest(null);
      onPick(req.id);
      onClose();
    } finally {
      setCreating(false);
    }
  };

  const topLevelCollections = collections.filter((c) => !c.parentId).sort((a, b) => a.sortOrder - b.sortOrder);

  const filteredUncollected = search.trim()
    ? uncollectedRequests.filter(
        (r) =>
          r.name.toLowerCase().includes(search.toLowerCase()) ||
          r.method.toLowerCase().includes(search.toLowerCase())
      )
    : uncollectedRequests;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-bg-secondary border border-border rounded-xl shadow-xl w-full max-w-md max-h-[70vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary">Add request</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-bg-hover text-text-muted">
            <X size={18} />
          </button>
        </div>
        <div className="px-4 py-2 border-b border-border">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search requests..."
            className="w-full px-3 py-1.5 text-sm bg-bg-primary border border-border rounded-lg focus:outline-none focus:border-accent/40"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <button
            onClick={handleCreateNew}
            disabled={creating}
            className="flex items-center gap-2 w-full px-3 py-2 mb-2 rounded-lg border border-dashed border-border hover:border-accent/50 hover:bg-bg-hover text-text-muted hover:text-accent transition-colors disabled:opacity-50"
          >
            <Plus size={14} />
            <span className="text-sm">{creating ? 'Creating...' : 'Create new request'}</span>
          </button>
          {filteredUncollected.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-2 py-1" title="Saved requests that aren’t in any collection">
                Uncollected
              </p>
              {filteredUncollected.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    onPick(r.id);
                    onClose();
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-bg-hover text-left"
                >
                  <span
                    className="font-mono text-[10px] w-10 shrink-0"
                    style={{ color: METHOD_COLORS[r.method] || '#6b7280' }}
                  >
                    {r.method}
                  </span>
                  <span className="text-sm text-text-primary truncate flex-1">{r.name}</span>
                </button>
              ))}
            </div>
          )}
          {topLevelCollections.map((col) => {
            const reqs = (requestsMap[col.id] || []).filter(
              (r) =>
                !search.trim() ||
                r.name.toLowerCase().includes(search.toLowerCase()) ||
                r.method.toLowerCase().includes(search.toLowerCase())
            );
            if (reqs.length === 0) return null;
            return (
              <div key={col.id} className="mb-3">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-2 py-1">
                  {col.name}
                </p>
                {reqs.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      onPick(r.id);
                      onClose();
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-bg-hover text-left"
                  >
                    <span
                      className="font-mono text-[10px] w-10 shrink-0"
                      style={{ color: METHOD_COLORS[r.method] || '#6b7280' }}
                    >
                      {r.method}
                    </span>
                    <span className="text-sm text-text-primary truncate flex-1">{r.name}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function extractVarsFromText(text: string | undefined): Set<string> {
  const vars = new Set<string>();
  if (!text || typeof text !== 'string') return vars;
  const re = /\{\{([^}]+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    vars.add(m[1].trim());
  }
  return vars;
}

function ExtractAddForm({
  onAdd,
  onCancel,
}: {
  onAdd: (varName: string, jsonPath: string) => void;
  onCancel: () => void;
}) {
  const [varName, setVarName] = useState('');
  const [jsonPath, setJsonPath] = useState('');
  return (
    <div className="flex items-center gap-2 mt-2">
      <input
        type="text"
        value={varName}
        onChange={(e) => setVarName(e.target.value)}
        placeholder="variable"
        className="flex-1 min-w-0 max-w-[120px] px-2.5 py-1.5 text-xs font-mono bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
      />
      <span className="text-text-muted text-xs shrink-0">←</span>
      <input
        type="text"
        value={jsonPath}
        onChange={(e) => setJsonPath(e.target.value)}
        placeholder="access_token or data.id"
        className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
      />
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => onAdd(varName, jsonPath)}
          className="px-2.5 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors"
        >
          Add
        </button>
        <button
          onClick={onCancel}
          className="px-2.5 py-1.5 text-xs text-text-muted rounded-lg hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function suggestInputsFromSteps(stepsWithRequest: { step: WorkflowStep; request: ApiRequest | undefined }[]): string[] {
  const vars = new Set<string>();
  for (const { request } of stepsWithRequest) {
    if (!request) continue;
    extractVarsFromText(request.url).forEach((v) => vars.add(v));
    for (const h of request.headers || []) {
      if (h.enabled && h.key) extractVarsFromText(h.key).forEach((v) => vars.add(v));
      if (h.enabled && h.value) extractVarsFromText(h.value).forEach((v) => vars.add(v));
    }
    if (request.body?.raw) extractVarsFromText(request.body.raw).forEach((v) => vars.add(v));
    if (request.body?.graphql?.query) extractVarsFromText(request.body.graphql.query).forEach((v) => vars.add(v));
  }
  return Array.from(vars).sort();
}

export function WorkflowsMain() {
  const {
    workflows,
    selectedWorkflowId,
    steps,
    stepExtractions,
    inputs,
    lastRunResult,
    running,
    addStep,
    removeStep,
    reorderSteps,
    addInput,
    removeInput,
    updateWorkflowInput,
    reorderWorkflowInputs,
    addExtraction,
    removeExtraction,
    runWorkflow,
    updateWorkflow,
    deleteWorkflow,
    archiveWorkflow,
    loadSteps,
  } = useWorkflowStore();
  const activeWorkspaceId = useCollectionStore((s) => s.activeWorkspaceId);
  const archivedWorkflows = useWorkflowStore((s) => s.archivedWorkflows);
  const workflowsByCollection = useWorkflowCollectionStore((s) => s.workflows);
  const allWorkflows = useMemo(
    () => [
      ...workflows,
      ...archivedWorkflows,
      ...Object.values(workflowsByCollection).flat(),
    ],
    [workflows, archivedWorkflows, workflowsByCollection]
  );
  const selectedWorkflow = useMemo(
    () => allWorkflows.find((w) => w.id === selectedWorkflowId),
    [allWorkflows, selectedWorkflowId]
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [dragStepId, setDragStepId] = useState<string | null>(null);
  const [dropTargetStepId, setDropTargetStepId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'above' | 'below' | null>(null);
  const [dragInputId, setDragInputId] = useState<string | null>(null);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [newExtractionStepId, setNewExtractionStepId] = useState<string | null>(null);
  const [runFormValues, setRunFormValues] = useState<Record<string, string>>({});
  const [curlCopied, setCurlCopied] = useState(false);

  const uncollectedRequests = useRequestStore((s) => s.uncollectedRequests);
  const selectRequest = useRequestStore((s) => s.selectRequest);
  const requestsMap = useCollectionStore((s) => s.requests);
  const requestMap = useMemo(() => {
    const map = new Map<string, ApiRequest>();
    for (const r of uncollectedRequests) map.set(r.id, r);
    for (const reqs of Object.values(requestsMap)) {
      for (const r of reqs) map.set(r.id, r);
    }
    return map;
  }, [uncollectedRequests, requestsMap]);
  const stepsWithRequest = steps.map((st) => ({
    step: st,
    request: requestMap.get(st.requestId),
  }));

  useEffect(() => {
    if (selectedWorkflowId) loadSteps(selectedWorkflowId);
  }, [selectedWorkflowId, loadSteps]);

  // When a workflow step is expanded, select that request so RequestBuilder shows the full interface
  useEffect(() => {
    if (editMode && expandedStepId) {
      const step = steps.find((s) => s.id === expandedStepId);
      if (step) {
        const req = requestMap.get(step.requestId);
        if (req) selectRequest(req);
      }
    }
  }, [editMode, expandedStepId, steps, requestMap, selectRequest]);

  useEffect(() => {
    const defaults: Record<string, string> = {};
    for (const inp of inputs) {
      defaults[inp.key] = inp.defaultValue ?? '';
    }
    setRunFormValues(defaults);
  }, [inputs]);

  const buildInputVarsRecord = useCallback((): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const inp of inputs) {
      const v = runFormValues[inp.key];
      if (v !== undefined) out[inp.key] = v;
    }
    return out;
  }, [inputs, runFormValues]);

  const handleRunFormChange = useCallback((key: string, value: string) => {
    setRunFormValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const suggestedVars = useMemo(() => suggestInputsFromSteps(stepsWithRequest), [stepsWithRequest]);
  const missingInputKeys = suggestedVars.filter((v) => !inputs.some((inp) => inp.key === v));

  const [topRatio, setTopRatio] = useState(0.55);
  const containerRef = useRef<HTMLDivElement>(null);
  const handleResizeDrag = useCallback((deltaY: number) => {
    if (!containerRef.current) return;
    const h = containerRef.current.getBoundingClientRect().height;
    if (h === 0) return;
    setTopRatio((prev) => Math.max(0.25, Math.min(0.85, prev + deltaY / h)));
  }, []);

  const availableVariables = lastRunResult?.finalVariables ?? {};
  const outputKeysSet = new Set(selectedWorkflow?.outputKeys ?? []);
  const firstStepRequest = stepsWithRequest[0]?.request;
  const handleCopyCurl = useCallback(() => {
    if (!firstStepRequest) return;
    const curl = toCurl(firstStepRequest);
    navigator.clipboard.writeText(curl);
    setCurlCopied(true);
    setTimeout(() => setCurlCopied(false), 2000);
  }, [firstStepRequest]);

  const handleOutputToggle = useCallback(
    (key: string, checked: boolean) => {
      if (!selectedWorkflow) return;
      const current = selectedWorkflow.outputKeys ?? [];
      const next = checked ? [...current, key] : current.filter((k) => k !== key);
      updateWorkflow(selectedWorkflow.id, { outputKeys: next });
    },
    [selectedWorkflow, updateWorkflow]
  );

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      let lastY = e.clientY;
      const onMove = (ev: MouseEvent) => {
        handleResizeDrag(ev.clientY - lastY);
        lastY = ev.clientY;
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [handleResizeDrag]
  );

  if (!selectedWorkflow) {
    return (
      <div className="h-full overflow-y-auto flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-md text-center">
          <div className="w-12 h-12 rounded-xl bg-bg-secondary border border-border flex items-center justify-center mx-auto mb-4">
            <GitBranch size={24} className="text-text-muted" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">Workflows</h3>
          <p className="text-sm text-text-muted mb-6">
            Chain existing requests into runnable workflows. Variables from one step can be used in the next via{' '}
            <code className="px-1 py-0.5 rounded bg-bg-tertiary text-accent/80 text-xs">{'{{variable}}'}</code>.
            Select a workflow from the sidebar to edit it, or create a new one.
          </p>
        </div>
      </div>
    );
  }

  const handleAddStep = () => setPickerOpen(true);
  const handlePickRequest = async (requestId: string) => {
    if (selectedWorkflowId) await addStep(selectedWorkflowId, requestId);
    setPickerOpen(false);
  };

  const handleRemoveStep = async (stepId: string) => {
    if (selectedWorkflowId) await removeStep(selectedWorkflowId, stepId);
  };

  const handleReorder = async (fromIndex: number, toIndex: number) => {
    if (!selectedWorkflowId || toIndex < 0 || toIndex >= steps.length) return;
    const ids = steps.map((s) => s.id);
    const [removed] = ids.splice(fromIndex, 1);
    ids.splice(toIndex, 0, removed);
    await reorderSteps(selectedWorkflowId, ids);
  };

  const handleSuggestInputs = async () => {
    if (!selectedWorkflowId) return;
    for (const key of missingInputKeys) {
      await addInput(selectedWorkflowId, key);
    }
  };

  const handleReorderInputs = async (fromIndex: number, toIndex: number) => {
    if (!selectedWorkflowId || toIndex < 0 || toIndex >= inputs.length) return;
    const ids = inputs.map((i) => i.id);
    const [removed] = ids.splice(fromIndex, 1);
    ids.splice(toIndex, 0, removed);
    await reorderWorkflowInputs(selectedWorkflowId, ids);
  };

  return (
    <div ref={containerRef} className="h-full flex flex-col overflow-hidden">
      <div className="overflow-y-auto overflow-x-hidden" style={{ height: `${topRatio * 100}%` }}>
        <div className="p-5 pb-2">
          {/* Row 1: Workflow name (like request name) */}
          <div className="flex items-center gap-2 mb-2 min-w-0">
            <GitBranch size={16} className="text-text-muted shrink-0" />
            <div className="flex-1 min-w-0">
              {editingName ? (
                <input
                  type="text"
                  defaultValue={selectedWorkflow.name}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v) updateWorkflow(selectedWorkflow.id, { name: v });
                    setEditingName(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                  className="w-full px-1.5 py-0.5 text-sm font-semibold text-text-primary bg-bg-tertiary border border-accent/50 rounded-md focus:outline-none focus:border-accent"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => setEditingName(true)}
                  className="group flex items-center gap-1 text-sm font-semibold text-text-primary hover:text-accent truncate max-w-full transition-colors"
                  title="Click to rename"
                >
                  <span className="truncate">{selectedWorkflow.name}</span>
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Run/Edit + Env on left, cURL + Run on right (like requests) */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
              <button
                onClick={() => setEditMode(false)}
                className={`px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 rounded-l-lg transition-all shrink-0 ${
                  !editMode ? 'bg-bg-secondary border-border text-text-primary' : 'bg-bg-tertiary/50 border-border text-text-muted hover:text-text-primary'
                }`}
              >
                <Eye size={12} />
                Run
              </button>
              <button
                onClick={() => setEditMode(true)}
                className={`px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 rounded-r-lg transition-all shrink-0 ${
                  editMode ? 'bg-bg-secondary border-border text-text-primary' : 'bg-bg-tertiary/50 border-border text-text-muted hover:text-text-primary'
                }`}
              >
                <Pencil size={12} />
                Edit
              </button>
            </div>
            <EnvironmentPill />

            <div className="flex-1" />

            {steps.length > 0 && (
              <button
                onClick={handleCopyCurl}
                title="Copy first step as cURL"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all bg-bg-tertiary border-border text-text-muted hover:bg-bg-hover hover:text-text-primary shrink-0"
              >
                {curlCopied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                <span className="hidden sm:inline">{curlCopied ? 'Copied' : 'cURL'}</span>
              </button>
            )}

            <button
              onClick={() => selectedWorkflowId && runWorkflow(selectedWorkflowId, buildInputVarsRecord())}
              disabled={steps.length === 0 || running}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-white font-medium text-sm transition-all shrink-0 ${
                running
                  ? 'bg-accent send-btn-waiting cursor-wait'
                  : steps.length === 0
                    ? 'bg-accent/50 cursor-not-allowed opacity-50'
                    : 'bg-accent hover:bg-accent-hover'
              }`}
            >
              {running ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Running
                </>
              ) : (
                <>
                  <Play size={15} />
                  Run
                </>
              )}
            </button>
          </div>

          {!editMode && inputs.length > 0 && (
            <div className="rounded-lg border border-border bg-bg-secondary overflow-hidden mb-3">
              <div className="px-3 py-2 border-b border-border bg-bg-tertiary/50">
                <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                  <Variable size={12} />
                  Run parameters
                </span>
              </div>
              <p className="px-3 py-1.5 text-[11px] text-text-muted border-b border-border/50">
                These are merged with your environment and available as <code className="px-0.5 rounded bg-bg-tertiary text-accent/80">{'{{key}}'}</code> in every step.
              </p>
              <div className="divide-y divide-border/50">
                {inputs.map((inp) => (
                  <div key={inp.id} className="flex items-center gap-2 px-3 py-2">
                    <label className="text-xs text-text-secondary shrink-0 w-24 truncate" title={inp.key}>
                      {inp.label || inp.key}
                    </label>
                    <input
                      type={inp.isSecret ? 'password' : 'text'}
                      value={runFormValues[inp.key] ?? inp.defaultValue ?? ''}
                      onChange={(e) => handleRunFormChange(inp.key, e.target.value)}
                      placeholder={inp.defaultValue || ''}
                      className="flex-1 min-w-0 px-2 py-1.5 text-xs font-mono bg-bg-primary border border-border rounded focus:outline-none focus:border-accent/40"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {editMode && (
            <div className="rounded-lg border border-border bg-bg-secondary overflow-hidden mb-3">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-tertiary/50">
                <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                  <Variable size={12} />
                  Inputs
                </span>
                <div className="flex items-center gap-2">
                  {missingInputKeys.length > 0 && (
                    <button
                      onClick={handleSuggestInputs}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs text-accent hover:bg-accent/10 rounded transition-colors"
                    >
                      <Lightbulb size={12} />
                      Suggest from steps ({missingInputKeys.length})
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (selectedWorkflowId) addInput(selectedWorkflowId, `param_${Date.now().toString(36)}`);
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
                  >
                    <Plus size={12} />
                    Add input
                  </button>
                </div>
              </div>
              <div className="divide-y divide-border/50">
                {inputs.length === 0 ? (
                  <div className="px-3 py-3 text-center text-xs text-text-muted">
                    No inputs. Add manually or use &quot;Suggest from steps&quot; to scan for {'{{var}}'} usage.
                  </div>
                ) : (
                  inputs.map((inp, idx) => (
                    <div
                      key={inp.id}
                      draggable
                      onDragStart={() => setDragInputId(inp.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (!dragInputId || dragInputId === inp.id || !selectedWorkflowId) return;
                        const fromIdx = inputs.findIndex((i) => i.id === dragInputId);
                        if (fromIdx >= 0) handleReorderInputs(fromIdx, idx);
                        setDragInputId(null);
                      }}
                      onDragEnd={() => setDragInputId(null)}
                      className={`flex items-center gap-2 px-3 py-2 hover:bg-bg-hover/50 group ${
                        dragInputId === inp.id ? 'opacity-50' : ''
                      }`}
                    >
                      <GripVertical size={14} className="text-text-muted shrink-0" />
                      <input
                        type="text"
                        value={inp.key}
                        onChange={(e) => updateWorkflowInput(inp.id, { key: e.target.value.trim() || inp.key })}
                        placeholder="key"
                        className="flex-1 min-w-0 max-w-[120px] px-2 py-1 text-xs font-mono bg-bg-primary border border-border rounded"
                      />
                      <input
                        type="text"
                        value={inp.label ?? ''}
                        onChange={(e) => updateWorkflowInput(inp.id, { label: e.target.value || undefined })}
                        placeholder="label (optional)"
                        className="flex-1 min-w-0 max-w-[100px] px-2 py-1 text-xs bg-bg-primary border border-border rounded"
                      />
                      <input
                        type="text"
                        value={inp.defaultValue ?? ''}
                        onChange={(e) => updateWorkflowInput(inp.id, { defaultValue: e.target.value || undefined })}
                        placeholder="default"
                        className="flex-1 min-w-0 max-w-[100px] px-2 py-1 text-xs bg-bg-primary border border-border rounded"
                      />
                      <label className="flex items-center gap-1.5 text-xs text-text-muted shrink-0">
                        <input
                          type="checkbox"
                          checked={!!inp.isSecret}
                          onChange={(e) => updateWorkflowInput(inp.id, { isSecret: e.target.checked })}
                          className="rounded"
                        />
                        Secret
                      </label>
                      <button
                        onClick={() => removeInput(selectedWorkflowId!, inp.id)}
                        className="p-1 rounded text-text-muted hover:text-error hover:bg-error/10 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border bg-bg-secondary overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-tertiary/50">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                Steps
              </span>
              {editMode && (
                <button
                  onClick={handleAddStep}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
                >
                  <Plus size={12} />
                  Add step
                </button>
              )}
            </div>
            {stepsWithRequest.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-text-muted">No steps yet — add a request</p>
                <button
                  onClick={handleAddStep}
                  className="mt-2 text-xs text-accent hover:underline"
                >
                  Add step
                </button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {stepsWithRequest.map(({ step, request }, idx) => {
                  const exts = stepExtractions[step.id] ?? [];
                  const isExpanded = expandedStepId === step.id;
                  const isAddingNew = newExtractionStepId === step.id;
                  const isDropTarget = dropTargetStepId === step.id;
                  const stepDropPosition = isDropTarget ? dropPosition : null;
                  return (
                    <div key={step.id} className="relative">
                      {isDropTarget && stepDropPosition === 'above' && (
                        <div className="absolute top-0 left-2 right-2 h-0.5 bg-accent rounded-full z-10" />
                      )}
                      <div
                        draggable={editMode}
                        onDragStart={() => editMode && setDragStepId(step.id)}
                        onDragOver={(e) => {
                          if (!editMode || !dragStepId || dragStepId === step.id) return;
                          e.preventDefault();
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const midY = rect.top + rect.height / 2;
                          setDropTargetStepId(step.id);
                          setDropPosition(e.clientY < midY ? 'above' : 'below');
                        }}
                        onDragLeave={(e) => {
                          if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
                            setDropTargetStepId(null);
                            setDropPosition(null);
                          }
                        }}
                        onDrop={(e) => {
                          if (!editMode) return;
                          e.preventDefault();
                          const fromId = dragStepId;
                          if (!fromId || fromId === step.id || !dropTargetStepId || !dropPosition) {
                            setDragStepId(null);
                            setDropTargetStepId(null);
                            setDropPosition(null);
                            return;
                          }
                          const fromIdx = steps.findIndex((s) => s.id === fromId);
                          const toIdx = steps.findIndex((s) => s.id === dropTargetStepId);
                          if (fromIdx >= 0 && toIdx >= 0) {
                            const insertIdx = dropPosition === 'above' ? toIdx : toIdx + 1;
                            const finalToIndex = fromIdx < insertIdx ? insertIdx - 1 : insertIdx;
                            handleReorder(fromIdx, finalToIndex);
                          }
                          setDragStepId(null);
                          setDropTargetStepId(null);
                          setDropPosition(null);
                        }}
                        onDragEnd={() => {
                          setDragStepId(null);
                          setDropTargetStepId(null);
                          setDropPosition(null);
                        }}
                        className={`flex items-center gap-2 px-3 py-2 hover:bg-bg-hover/50 transition-colors group ${
                          dragStepId === step.id ? 'opacity-50' : ''
                        }`}
                      >
                        {editMode && (
                          <span className="w-5 h-5 rounded bg-bg-tertiary border border-border flex items-center justify-center text-[10px] font-semibold text-text-muted shrink-0">
                            {idx + 1}
                          </span>
                        )}
                        {editMode && <GripVertical size={14} className="text-text-muted shrink-0" />}
                        {editMode && (
                          <button
                            onClick={() => setExpandedStepId(isExpanded ? null : step.id)}
                            className="p-0.5 rounded text-text-muted hover:text-text-primary shrink-0"
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        )}
                        <span
                          className="font-mono text-[10px] w-10 shrink-0 font-bold"
                          style={{
                            color: request
                              ? METHOD_COLORS[request.method] || '#6b7280'
                              : '#6b7280',
                          }}
                        >
                          {request ? request.method : '?'}
                        </span>
                        <span className="text-sm text-text-primary truncate flex-1">
                          {request ? request.name : '(deleted request)'}
                        </span>
                        {request && (() => {
                          const availableToStep = [
                            ...inputs.map((i) => i.key),
                            ...steps
                              .slice(0, idx)
                              .flatMap((s) => (stepExtractions[s.id] ?? []).map((e) => e.variableName)),
                          ];
                          const usedInRequest = new Set<string>();
                          extractVarsFromText(request.url).forEach((v) => usedInRequest.add(v));
                          (request.headers || []).forEach((h) => {
                            extractVarsFromText(h.key).forEach((v) => usedInRequest.add(v));
                            extractVarsFromText(h.value).forEach((v) => usedInRequest.add(v));
                          });
                          extractVarsFromText(request.body?.raw).forEach((v) => usedInRequest.add(v));
                          const usedFromWorkflow = [...usedInRequest].filter((v) => availableToStep.includes(v));
                          if (usedFromWorkflow.length === 0) return null;
                          return (
                            <span className="text-[10px] text-text-muted shrink-0" title={`Uses: ${usedFromWorkflow.join(', ')}`}>
                              uses {usedFromWorkflow.slice(0, 2).map((v) => `{{${v}}}`).join(', ')}
                              {usedFromWorkflow.length > 2 && '…'}
                            </span>
                          );
                        })()}
                        {editMode && (
                          <button
                            onClick={() => handleRemoveStep(step.id)}
                            className="p-1 rounded text-text-muted hover:text-error hover:bg-error/10 opacity-0 group-hover:opacity-100 transition-all"
                            title="Remove step"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      {editMode && isExpanded && (
                        <div className="px-3 pb-3 pt-1 space-y-4 border-b border-border/50">
                          {request && (
                            <div className="space-y-2">
                              {(() => {
                                const avail = [
                                  ...inputs.map((i) => i.key),
                                  ...steps
                                    .slice(0, idx)
                                    .flatMap((s) => (stepExtractions[s.id] ?? []).map((e) => e.variableName)),
                                ];
                                return avail.length > 0 ? (
                                  <p className="text-[10px] text-text-muted flex flex-wrap items-center gap-1">
                                    <span>Available:</span>
                                    {avail.map((k) => (
                                      <code key={k} className="px-1 py-0.5 rounded bg-bg-tertiary text-accent/80 font-mono">
                                        {`{{${k}}}`}
                                      </code>
                                    ))}
                                  </p>
                                ) : null;
                              })()}
                              <RequestBuilder embeddedInWorkflow />
                            </div>
                          )}
                          <div>
                            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Extract</p>
                          <p className="text-[11px] text-text-muted mb-2">
                            Extract values from this step&apos;s JSON response into variables for later steps. Use dot notation (e.g. <code className="px-1 py-0.5 rounded bg-bg-tertiary text-accent/80 font-mono text-[10px]">access_token</code> or <code className="px-1 py-0.5 rounded bg-bg-tertiary text-accent/80 font-mono text-[10px]">data.id</code>). These variables are available to later steps as <code className="px-0.5 rounded bg-bg-tertiary text-accent/80 font-mono text-[10px]">{'{{var}}'}</code>.
                          </p>
                          {exts.map((ext) => (
                            <div key={ext.id} className="flex items-center gap-2 py-1.5 group">
                              <span className="text-xs font-mono text-accent/90 shrink-0 w-24">{ext.variableName}</span>
                              <span className="text-text-muted text-xs shrink-0">←</span>
                              <span className="text-xs font-mono text-text-secondary flex-1 truncate">{ext.jsonPath}</span>
                              <button
                                onClick={() => removeExtraction(ext.id)}
                                className="p-1 rounded-lg text-text-muted hover:text-error hover:bg-error/10 opacity-0 group-hover:opacity-100 transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                          {isAddingNew ? (
                            <ExtractAddForm
                              onAdd={(varName, jsonPath) => {
                                if (varName && jsonPath) addExtraction(step.id, varName.trim(), jsonPath.trim());
                                setNewExtractionStepId(null);
                              }}
                              onCancel={() => setNewExtractionStepId(null)}
                            />
                          ) : (
                            <button
                              onClick={() => setNewExtractionStepId(step.id)}
                              className="flex items-center gap-1.5 px-2 py-1 mt-1 text-xs text-accent hover:bg-accent/10 rounded-lg transition-colors"
                            >
                              <Plus size={12} />
                              Add extract
                            </button>
                          )}
                          </div>
                        </div>
                      )}
                      {isDropTarget && stepDropPosition === 'below' && (
                        <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full z-10" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        onMouseDown={handleResizeMouseDown}
        className="h-1 bg-border hover:bg-accent/40 cursor-row-resize shrink-0 group flex items-center justify-center transition-colors"
      >
        <div className="w-8 h-0.5 rounded-full bg-text-muted/20 group-hover:bg-accent/60 transition-colors" />
      </div>

      <div className="flex-1 overflow-hidden min-h-0 flex flex-col bg-bg-primary border-t border-border">
        <WorkflowRunner
          result={lastRunResult}
          running={running}
          onRun={() => selectedWorkflowId && runWorkflow(selectedWorkflowId, buildInputVarsRecord())}
          canRun={steps.length > 0}
          workflowName={selectedWorkflow?.name ?? ''}
          workflowId={selectedWorkflowId}
          availableVariables={availableVariables}
          outputKeysSet={outputKeysSet}
          onOutputToggle={handleOutputToggle}
        />
      </div>

      {pickerOpen && (
        <RequestPickerModal
          onPick={handlePickRequest}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
