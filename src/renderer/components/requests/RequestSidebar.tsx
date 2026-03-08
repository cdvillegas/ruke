import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useRequestStore } from '../../stores/requestStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { useUiStore } from '../../stores/uiStore';
import {
  Plus, Search, Archive, ChevronDown, ChevronRight,
  MoreHorizontal, Trash2, ArchiveRestore, Pencil, Send,
  FolderPlus, FolderOpen, Loader2, FolderInput,
} from 'lucide-react';
import { groupByTime } from '../../lib/timeGroups';
import { METHOD_COLORS } from '@shared/constants';
import type { ApiRequest, CollectionTreeNode } from '@shared/types';

const RECENT_LIMIT = 15;

function RequestItemMenu({
  req,
  isArchived,
  collections,
  onClose,
}: {
  req: ApiRequest;
  isArchived: boolean;
  collections: { id: string; name: string }[];
  onClose: () => void;
}) {
  const { archiveRequest, unarchiveRequest, deleteRequest, moveToCollection } = useRequestStore();
  const menuRef = useRef<HTMLDivElement>(null);
  const [showMoveMenu, setShowMoveMenu] = useState(false);

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
      {!isArchived && collections.length > 0 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setShowMoveMenu(!showMoveMenu); }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
          >
            <FolderInput size={12} /> Move to Collection
            <ChevronRight size={10} className={`ml-auto transition-transform ${showMoveMenu ? 'rotate-90' : ''}`} />
          </button>
          {showMoveMenu && collections.map(c => (
            <button
              key={c.id}
              onClick={(e) => { e.stopPropagation(); moveToCollection(req.id, c.id); onClose(); }}
              className="flex items-center gap-2 w-full pl-7 pr-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors truncate"
            >
              <FolderOpen size={11} className="shrink-0" /> {c.name}
            </button>
          ))}
        </>
      )}
      {isArchived ? (
        <button
          onClick={(e) => { e.stopPropagation(); unarchiveRequest(req.id); onClose(); }}
          className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
        >
          <ArchiveRestore size={12} /> Unarchive
        </button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); archiveRequest(req.id); onClose(); }}
          className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
        >
          <Archive size={12} /> Archive
        </button>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); deleteRequest(req.id); onClose(); }}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
      >
        <Trash2 size={12} /> Delete
      </button>
    </div>
  );
}

function RequestItem({
  req,
  isActive,
  isArchived,
  collections,
}: {
  req: ApiRequest;
  isActive: boolean;
  isArchived?: boolean;
  collections: { id: string; name: string }[];
}) {
  const selectRequest = useRequestStore(s => s.selectRequest);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(req.name);

  const handleRename = async () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== req.name) {
      try { await window.ruke.db.query('updateRequest', req.id, { name: trimmed }); } catch {}
      useRequestStore.getState().updateActiveRequest({ name: trimmed });
      useRequestStore.getState().loadUncollectedRequests();
      useRequestStore.getState().loadArchivedRequests();
    }
    setIsRenaming(false);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/ruke-request-id', req.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const preview = req.url || null;

  return (
    <div className="relative group" draggable={!isRenaming} onDragStart={handleDragStart}>
      <button
        onClick={() => selectRequest(req)}
        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
          isActive
            ? 'bg-accent/10 text-text-primary'
            : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className="font-mono font-bold text-[9px] w-7 shrink-0"
            style={{ color: METHOD_COLORS[req.method] || '#6b7280' }}
          >
            {req.method}
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
              className="flex-1 text-xs bg-bg-tertiary border border-accent px-1.5 py-0.5 rounded text-text-primary focus:outline-none min-w-0"
            />
          ) : (
            <span className="text-xs font-medium truncate flex-1">{req.name || 'Untitled'}</span>
          )}
        </div>
        {preview && !isRenaming && (
          <p className="text-[10px] text-text-muted truncate mt-0.5 ml-9">{preview}</p>
        )}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
        className={`absolute right-1.5 top-1.5 p-1 rounded-md transition-all ${
          menuOpen
            ? 'opacity-100 bg-bg-hover'
            : 'opacity-0 group-hover:opacity-100 hover:bg-bg-hover'
        }`}
      >
        <MoreHorizontal size={12} className="text-text-muted" />
      </button>
      {menuOpen && (
        <RequestItemMenu
          req={req}
          isArchived={!!isArchived}
          collections={collections}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}

function CollectionRequestRow({
  req,
  depth,
  isSelected,
  onSelect,
  onDelete,
}: {
  req: ApiRequest;
  depth: number;
  isSelected: boolean;
  onSelect: (req: ApiRequest) => void;
  onDelete: (id: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(req.name || '');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  const handleRename = async () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== req.name) {
      await window.ruke.db.query('updateRequest', req.id, { ...req, name: trimmed });
      if (req.collectionId) {
        useCollectionStore.getState().loadRequests(req.collectionId);
      }
      const { activeRequest } = useRequestStore.getState();
      if (activeRequest.id === req.id) {
        useRequestStore.getState().updateActiveRequest({ name: trimmed });
      }
    }
    setIsRenaming(false);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/ruke-request-id', req.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      onClick={() => onSelect(req)}
      draggable={!isRenaming}
      onDragStart={handleDragStart}
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
        isSelected
          ? 'bg-accent/10 text-text-primary cursor-pointer'
          : 'hover:bg-bg-hover text-text-secondary cursor-pointer'
      }`}
      style={{ paddingLeft: `${24 + depth * 16}px` }}
    >
      <span
        className="font-mono font-bold text-[9px] w-8 shrink-0"
        style={{ color: METHOD_COLORS[req.method] || '#6b7280' }}
      >
        {req.method}
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
          className="flex-1 text-xs bg-bg-tertiary border border-accent px-1.5 py-0.5 rounded text-text-primary focus:outline-none"
        />
      ) : (
        <span className="text-xs truncate flex-1">{req.name || 'Untitled'}</span>
      )}
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
              onClick={(e) => { e.stopPropagation(); setIsRenaming(true); setRenameValue(req.name || ''); setShowMenu(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
            >
              <Pencil size={12} /> Rename
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(req.id); setShowMenu(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-error hover:bg-error/10 transition-colors"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CollectionNode({
  node,
  depth,
  selectedRequestId,
  onSelectRequest,
  onNewRequest,
}: {
  node: CollectionTreeNode;
  depth: number;
  selectedRequestId: string | null;
  onSelectRequest: (req: ApiRequest) => void;
  onNewRequest: (collectionId: string) => void;
}) {
  const toggleExpanded = useCollectionStore((s) => s.toggleExpanded);
  const expandedIds = useCollectionStore((s) => s.expandedIds);
  const deleteCollection = useCollectionStore((s) => s.deleteCollection);
  const renameCollection = useCollectionStore((s) => s.renameCollection);
  const deleteRequest = useRequestStore((s) => s.deleteRequest);
  const moveToCollection = useRequestStore((s) => s.moveToCollection);
  const isExpanded = expandedIds.includes(node.collection.id);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.collection.name);
  const [showMenu, setShowMenu] = useState(false);
  const [dragOver, setDragOver] = useState(false);
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
      renameCollection(node.collection.id, renameValue.trim());
    }
    setIsRenaming(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/ruke-request-id')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const requestId = e.dataTransfer.getData('application/ruke-request-id');
    if (requestId) {
      moveToCollection(requestId, node.collection.id);
    }
  };

  return (
    <div>
      <div
        className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors cursor-pointer ${
          dragOver
            ? 'bg-accent/15 ring-1 ring-accent/40 ring-inset'
            : 'hover:bg-bg-hover'
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => toggleExpanded(node.collection.id)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="text-text-muted shrink-0">
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <FolderOpen size={13} className="text-text-muted shrink-0" />
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
            className="flex-1 text-xs bg-bg-tertiary border border-accent px-1.5 py-0.5 rounded text-text-primary focus:outline-none"
          />
        ) : (
          <span className="text-xs font-medium text-text-primary truncate flex-1">{node.collection.name}</span>
        )}
        <span className="text-[9px] text-text-muted shrink-0">{node.requests.length}</span>
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
                onClick={(e) => { e.stopPropagation(); onNewRequest(node.collection.id); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
              >
                <Plus size={12} /> New Request
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setIsRenaming(true); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
              >
                <Pencil size={12} /> Rename
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteCollection(node.collection.id); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-error hover:bg-error/10 transition-colors"
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {isExpanded && (
        <div>
          {node.requests.map((req) => (
            <CollectionRequestRow
              key={req.id}
              req={req}
              depth={depth}
              isSelected={selectedRequestId === req.id}
              onSelect={onSelectRequest}
              onDelete={deleteRequest}
            />
          ))}
          {node.children.map((child) => (
            <CollectionNode
              key={child.collection.id}
              node={child}
              depth={depth + 1}
              selectedRequestId={selectedRequestId}
              onSelectRequest={onSelectRequest}
              onNewRequest={onNewRequest}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function RequestSidebar() {
  const uncollectedRequests = useRequestStore((s) => s.uncollectedRequests);
  const archivedRequests = useRequestStore((s) => s.archivedRequests);
  const activeRequest = useRequestStore((s) => s.activeRequest);
  const newRequest = useRequestStore((s) => s.newRequest);
  const selectRequest = useRequestStore((s) => s.selectRequest);
  const loadUncollectedRequests = useRequestStore((s) => s.loadUncollectedRequests);
  const loadArchivedRequests = useRequestStore((s) => s.loadArchivedRequests);
  const saveRequest = useRequestStore((s) => s.saveRequest);
  const deleteRequest = useRequestStore((s) => s.deleteRequest);

  const collections = useCollectionStore((s) => s.collections);
  const requests = useCollectionStore((s) => s.requests);
  const createCollection = useCollectionStore((s) => s.createCollection);
  const loadRequests = useCollectionStore((s) => s.loadRequests);

  const [search, setSearch] = useState('');
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [archiveExpanded, setArchiveExpanded] = useState(false);
  const [collectionsExpanded, setCollectionsExpanded] = useState(true);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  useEffect(() => {
    loadUncollectedRequests();
    loadArchivedRequests();
  }, []);

  const collectionList = useMemo(() =>
    collections.map(c => ({ id: c.id, name: c.name })),
    [collections]
  );

  const tree = useMemo(() => {
    const buildNode = (col: typeof collections[number]): CollectionTreeNode => ({
      collection: col,
      children: collections
        .filter((c) => c.parentId === col.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(buildNode),
      requests: requests[col.id] || [],
    });
    return collections
      .filter((c) => !c.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(buildNode);
  }, [collections, requests]);

  const filteredUncollected = useMemo(() => {
    if (!search.trim()) return uncollectedRequests;
    const q = search.toLowerCase();
    return uncollectedRequests.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.url.toLowerCase().includes(q) ||
      r.method.toLowerCase().includes(q)
    );
  }, [uncollectedRequests, search]);

  const filteredArchived = useMemo(() => {
    if (!search.trim()) return archivedRequests;
    const q = search.toLowerCase();
    return archivedRequests.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.url.toLowerCase().includes(q) ||
      r.method.toLowerCase().includes(q)
    );
  }, [archivedRequests, search]);

  const filteredTree = useMemo(() => {
    if (!search.trim()) return tree;
    const q = search.toLowerCase();
    const filterNode = (node: CollectionTreeNode): CollectionTreeNode | null => {
      const matchingRequests = node.requests.filter(
        (r) => r.name.toLowerCase().includes(q) || r.url.toLowerCase().includes(q) || r.method.toLowerCase().includes(q)
      );
      const matchingChildren = node.children.map(filterNode).filter(Boolean) as CollectionTreeNode[];
      if (matchingRequests.length > 0 || matchingChildren.length > 0 || node.collection.name.toLowerCase().includes(q)) {
        return { ...node, requests: matchingRequests, children: matchingChildren };
      }
      return null;
    };
    return tree.map(filterNode).filter(Boolean) as CollectionTreeNode[];
  }, [tree, search]);

  const groups = useMemo(() => groupByTime(filteredUncollected, r => r.updatedAt), [filteredUncollected]);

  const truncatedGroups = useMemo(() => {
    if (showAllRecent) return groups;
    let count = 0;
    const result: typeof groups = [];
    for (const group of groups) {
      if (count >= RECENT_LIMIT) break;
      const remaining = RECENT_LIMIT - count;
      if (group.items.length <= remaining) {
        result.push(group);
        count += group.items.length;
      } else {
        result.push({ label: group.label, items: group.items.slice(0, remaining) });
        count = RECENT_LIMIT;
      }
    }
    return result;
  }, [groups, showAllRecent]);

  const totalUncollected = filteredUncollected.length;
  const hiddenCount = showAllRecent ? 0 : Math.max(0, totalUncollected - RECENT_LIMIT);

  const handleNewRequest = useCallback(() => {
    newRequest();
  }, [newRequest]);

  const handleNewCollectionRequest = useCallback(async (collectionId: string) => {
    newRequest(collectionId);
    const req = useRequestStore.getState().activeRequest;
    await saveRequest();
    loadRequests(collectionId);
  }, [newRequest, saveRequest, loadRequests]);

  const handleSelectCollectionRequest = useCallback((req: ApiRequest) => {
    selectRequest(req);
  }, [selectRequest]);

  const handleCreateCollection = useCallback(async () => {
    if (newCollectionName.trim()) {
      await createCollection(newCollectionName.trim());
      setNewCollectionName('');
      setIsCreatingCollection(false);
    }
  }, [newCollectionName, createCollection]);

  const totalCollectionRequests = useMemo(() => {
    let count = 0;
    for (const reqs of Object.values(requests)) count += reqs.length;
    return count;
  }, [requests]);

  return (
    <div className="flex-1 min-w-0 h-full flex flex-col bg-bg-secondary">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Requests</h2>
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleNewRequest}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              title="New Request"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={() => setIsCreatingCollection(true)}
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search requests..."
            className="w-full pl-7 pr-3 py-1.5 text-xs bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
        {/* Uncollected Requests - grouped by time */}
        {totalUncollected === 0 && !search && collections.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Send size={20} className="text-text-muted mb-2" />
            <p className="text-xs text-text-muted">No requests yet</p>
          </div>
        )}

        {totalUncollected === 0 && search && filteredTree.length === 0 && filteredArchived.length === 0 && (
          <p className="text-xs text-text-muted text-center py-4">No results</p>
        )}

        {truncatedGroups.map(group => (
          <div key={group.label} className="mb-1">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-3 py-1.5">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(r => (
                <RequestItem
                  key={r.id}
                  req={r}
                  isActive={activeRequest.id === r.id}
                  collections={collectionList}
                />
              ))}
            </div>
          </div>
        ))}

        {hiddenCount > 0 && (
          <button
            onClick={() => setShowAllRecent(true)}
            className="w-full text-center py-2 text-[10px] text-accent hover:text-accent-hover transition-colors"
          >
            Show {hiddenCount} older request{hiddenCount !== 1 ? 's' : ''}
          </button>
        )}

        {showAllRecent && totalUncollected > RECENT_LIMIT && (
          <button
            onClick={() => setShowAllRecent(false)}
            className="w-full text-center py-2 text-[10px] text-text-muted hover:text-text-primary transition-colors"
          >
            Show less
          </button>
        )}

        {/* Collections section */}
        {(collections.length > 0 || isCreatingCollection) && (
          <div className="mt-2 pt-2 border-t border-border/60">
            <button
              onClick={() => setCollectionsExpanded(!collectionsExpanded)}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes('application/ruke-request-id')) {
                  e.preventDefault();
                  if (!collectionsExpanded) setCollectionsExpanded(true);
                }
              }}
              className="flex items-center gap-1.5 w-full px-3 py-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider hover:text-text-secondary transition-colors"
            >
              {collectionsExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              <FolderOpen size={10} />
              Collections ({totalCollectionRequests})
            </button>
            {collectionsExpanded && (
              <div className="mt-1">
                {isCreatingCollection && (
                  <div className="flex items-center gap-1.5 px-2 py-1.5 mb-1">
                    <FolderPlus size={13} className="text-accent shrink-0" />
                    <input
                      autoFocus
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      onBlur={handleCreateCollection}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateCollection();
                        if (e.key === 'Escape') setIsCreatingCollection(false);
                      }}
                      placeholder="Collection name..."
                      className="flex-1 text-xs bg-bg-tertiary border border-accent px-2 py-1 rounded text-text-primary placeholder:text-text-muted focus:outline-none"
                    />
                  </div>
                )}
                {filteredTree.map((node) => (
                  <CollectionNode
                    key={node.collection.id}
                    node={node}
                    depth={0}
                    selectedRequestId={activeRequest.id}
                    onSelectRequest={handleSelectCollectionRequest}
                    onNewRequest={handleNewCollectionRequest}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Archive section */}
        {archivedRequests.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/60">
            <button
              onClick={() => setArchiveExpanded(!archiveExpanded)}
              className="flex items-center gap-1.5 w-full px-3 py-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider hover:text-text-secondary transition-colors"
            >
              {archiveExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              <Archive size={10} />
              Archive ({filteredArchived.length})
            </button>
            {archiveExpanded && (
              <div className="space-y-0.5 mt-1">
                {filteredArchived.map(r => (
                  <RequestItem
                    key={r.id}
                    req={r}
                    isActive={activeRequest.id === r.id}
                    isArchived
                    collections={collectionList}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
