import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useCollectionStore } from '../../stores/collectionStore';
import { useRequestStore } from '../../stores/requestStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useUiStore } from '../../stores/uiStore';
import { RequestBuilder } from '../request/RequestBuilder';
import { GrpcRequestView } from '../request/GrpcRequestView';
import { ResponseViewer } from '../response/ResponseViewer';
import {
  Search, Plus, FolderPlus, ChevronRight, ChevronDown,
  MoreHorizontal, Send, Trash2, Copy, Pencil, X, FolderOpen, Loader2,
} from 'lucide-react';
import { METHOD_COLORS } from '@shared/constants';
import type { ApiRequest, Collection, CollectionTreeNode } from '@shared/types';

function ResizableSplit() {
  const [topRatio, setTopRatio] = useState(0.45);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDrag = useCallback((deltaY: number) => {
    if (!containerRef.current) return;
    const h = containerRef.current.getBoundingClientRect().height;
    if (h === 0) return;
    setTopRatio(prev => Math.max(0.15, Math.min(0.85, prev + deltaY / h)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    let lastY = e.clientY;
    const onMove = (ev: MouseEvent) => {
      handleDrag(ev.clientY - lastY);
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
  }, [handleDrag]);

  return (
    <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden">
      <div className="overflow-y-auto p-5 pb-2" style={{ height: `${topRatio * 100}%` }}>
        <RequestBuilder />
      </div>
      <div
        onMouseDown={handleMouseDown}
        className="h-1 bg-border hover:bg-accent/40 cursor-row-resize shrink-0 group flex items-center justify-center transition-colors"
      >
        <div className="w-8 h-0.5 rounded-full bg-text-muted/20 group-hover:bg-accent/60 transition-colors" />
      </div>
      <div className="flex-1 overflow-hidden min-h-0">
        <ResponseViewer />
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
  const connections = useConnectionStore((s) => s.connections);
  const isExpanded = expandedIds.includes(node.collection.id);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.collection.name);
  const [showMenu, setShowMenu] = useState(false);

  const handleRename = () => {
    if (renameValue.trim()) {
      renameCollection(node.collection.id, renameValue.trim());
    }
    setIsRenaming(false);
  };

  return (
    <div>
      <div
        className="group flex items-center gap-1.5 px-2 py-1.5 hover:bg-bg-hover rounded-lg transition-colors cursor-pointer"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => toggleExpanded(node.collection.id)}
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
        <div className="relative">
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

      {isExpanded && (() => {
        const { openTabs, pendingTabIds } = useRequestStore.getState();
        const pendingForCollection = openTabs.filter(
          t => pendingTabIds.includes(t.id) && t.collectionId === node.collection.id &&
            !node.requests.some(r => r.id === t.id)
        );
        return (
          <div>
            {node.requests.map((req) => {
              const conn = req.connectionId ? connections.find(c => c.id === req.connectionId) : null;
              return (
                <div
                  key={req.id}
                  onClick={() => onSelectRequest(req)}
                  className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${
                    selectedRequestId === req.id
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
                  <span className="text-xs truncate flex-1">{req.name || 'Untitled'}</span>
                  {conn && (
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: conn.iconColor }}
                      title={conn.name}
                    />
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteRequest(req.id); }}
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-error/20 text-text-muted hover:text-error transition-all"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              );
            })}
            {pendingForCollection.map((tab) => (
              <div
                key={tab.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg opacity-50 ghost-tab-shimmer cursor-wait"
                style={{ paddingLeft: `${24 + depth * 16}px` }}
              >
                <Loader2 size={10} className="text-accent animate-spin shrink-0 w-8" />
                <span className="text-xs truncate flex-1">{tab.name || 'Creating...'}</span>
              </div>
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
        );
      })()}
    </div>
  );
}

export function RequestsView() {
  const getTree = useCollectionStore((s) => s.getTree);
  const createCollection = useCollectionStore((s) => s.createCollection);
  const loadRequests = useCollectionStore((s) => s.loadRequests);
  const activeRequest = useRequestStore((s) => s.activeRequest);
  const openTab = useRequestStore((s) => s.openTab);
  const newRequest = useRequestStore((s) => s.newRequest);
  const saveRequest = useRequestStore((s) => s.saveRequest);
  const openTabs = useRequestStore((s) => s.openTabs);
  const pendingTabIds = useRequestStore((s) => s.pendingTabIds);
  const activeProtocol = useUiStore((s) => s.activeProtocol);
  const [search, setSearch] = useState('');
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);

  const pendingUncollectedTabs = useMemo(
    () => openTabs.filter(t => pendingTabIds.includes(t.id) && !t.collectionId),
    [openTabs, pendingTabIds]
  );

  useEffect(() => {
    if (activeRequest?.id && !selectedReqId) {
      setSelectedReqId(activeRequest.id);
    }
  }, [activeRequest?.id]);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const tree = getTree();

  const handleSelectRequest = (req: ApiRequest) => {
    openTab(req);
    setSelectedReqId(req.id);
  };

  const handleNewRequest = async (collectionId: string) => {
    newRequest(collectionId);
    const req = useRequestStore.getState().activeRequest;
    await saveRequest();
    setSelectedReqId(req.id);
    loadRequests(collectionId);
  };

  const handleCreateCollection = async () => {
    if (newCollectionName.trim()) {
      await createCollection(newCollectionName.trim());
      setNewCollectionName('');
      setIsCreatingCollection(false);
    }
  };

  const handleNewFreeRequest = () => {
    newRequest();
    const req = useRequestStore.getState().activeRequest;
    setSelectedReqId(req.id);
  };

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

  return (
    <div className="h-full flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 border-r border-border bg-bg-secondary flex flex-col shrink-0">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">Requests</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={handleNewFreeRequest}
              className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
              title="New Request"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={() => setIsCreatingCollection(true)}
              className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
              title="New Collection"
            >
              <FolderPlus size={14} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter requests..."
              className="w-full pl-7 pr-2 py-1.5 text-xs rounded-lg bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto px-1 py-1">
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

          {filteredTree.length === 0 && !isCreatingCollection && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <FolderOpen size={24} className="text-text-muted opacity-30 mb-3" />
              <p className="text-xs text-text-muted mb-1">No collections yet</p>
              <p className="text-[10px] text-text-muted mb-4">Create a collection to organize your requests</p>
              <button
                onClick={() => setIsCreatingCollection(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors"
              >
                <FolderPlus size={12} />
                New Collection
              </button>
            </div>
          )}

          {/* Pending ghost requests (not in a collection) */}
          {pendingUncollectedTabs.map((tab) => (
            <div
              key={tab.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg opacity-50 ghost-tab-shimmer cursor-wait"
              style={{ paddingLeft: '24px' }}
            >
              <Loader2 size={10} className="text-accent animate-spin shrink-0 w-8" />
              <span className="text-xs truncate flex-1">{tab.name || 'Creating...'}</span>
            </div>
          ))}

          {filteredTree.map((node) => (
            <CollectionNode
              key={node.collection.id}
              node={node}
              depth={0}
              selectedRequestId={selectedReqId}
              onSelectRequest={handleSelectRequest}
              onNewRequest={handleNewRequest}
            />
          ))}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedReqId && activeProtocol === 'grpc' ? (
          <GrpcRequestView />
        ) : selectedReqId ? (
          <ResizableSplit />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-text-muted">
              <Send size={32} className="opacity-20" />
              <p className="text-sm">Select a request or create a new one</p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={handleNewFreeRequest}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors"
                >
                  <Plus size={12} />
                  New Request
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
