import { useState, useMemo } from 'react';
import { useCollectionStore } from '../../stores/collectionStore';
import { useRequestStore } from '../../stores/requestStore';
import {
  ChevronRight, ChevronDown, Folder, FolderOpen,
  MoreHorizontal, Plus, Trash2, Edit3,
} from 'lucide-react';
import { METHOD_COLORS } from '@shared/constants';
import type { CollectionTreeNode, ApiRequest } from '@shared/types';
import { nanoid } from 'nanoid';

interface Props {
  searchQuery: string;
}

export function CollectionTree({ searchQuery }: Props) {
  const collections = useCollectionStore((s) => s.collections);
  const requests = useCollectionStore((s) => s.requests);
  const expandedIds = useCollectionStore((s) => s.expandedIds);
  const toggleExpanded = useCollectionStore((s) => s.toggleExpanded);
  const deleteCollection = useCollectionStore((s) => s.deleteCollection);
  const renameCollection = useCollectionStore((s) => s.renameCollection);

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

  const filtered = searchQuery
    ? tree.filter(
        (node) =>
          node.collection.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          node.requests.some((r) =>
            r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.url.toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    : tree;

  if (filtered.length === 0) {
    return (
      <div className="px-3 py-4 text-center">
        <p className="text-xs text-text-muted">
          {searchQuery ? 'No matching collections' : 'No collections yet'}
        </p>
        {!searchQuery && (
          <p className="text-[10px] text-text-muted mt-1">
            Create one to organize your requests
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {filtered.map((node) => (
        <CollectionNode
          key={node.collection.id}
          node={node}
          depth={0}
          expandedIds={expandedIds}
          toggleExpanded={toggleExpanded}
          deleteCollection={deleteCollection}
          renameCollection={renameCollection}
        />
      ))}
    </div>
  );
}

function CollectionNode({
  node, depth, expandedIds, toggleExpanded, deleteCollection, renameCollection,
}: {
  node: CollectionTreeNode;
  depth: number;
  expandedIds: string[];
  toggleExpanded: (id: string) => void;
  deleteCollection: (id: string) => Promise<void>;
  renameCollection: (id: string, name: string) => Promise<void>;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(node.collection.name);
  const openTab = useRequestStore((s) => s.openTab);
  const expanded = expandedIds.includes(node.collection.id);

  const handleRename = async () => {
    if (editName.trim() && editName !== node.collection.name) {
      await renameCollection(node.collection.id, editName.trim());
    }
    setEditing(false);
  };

  const handleNewRequest = () => {
    const { newRequest } = useRequestStore.getState();
    newRequest(node.collection.id);
    if (!expanded) toggleExpanded(node.collection.id);
    setShowMenu(false);
  };

  return (
    <div>
      <div
        className="group flex items-center gap-1 px-2 py-1 rounded-md hover:bg-bg-hover cursor-pointer transition-colors"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => toggleExpanded(node.collection.id)}
      >
        {expanded ? (
          <ChevronDown size={13} className="text-text-muted shrink-0" />
        ) : (
          <ChevronRight size={13} className="text-text-muted shrink-0" />
        )}
        {expanded ? (
          <FolderOpen size={14} className="text-accent shrink-0" />
        ) : (
          <Folder size={14} className="text-text-muted shrink-0" />
        )}
        {editing ? (
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') setEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 px-1 py-0 text-xs bg-bg-tertiary border border-accent rounded text-text-primary focus:outline-none"
          />
        ) : (
          <span className="text-xs text-text-primary truncate flex-1">{node.collection.name}</span>
        )}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNewRequest();
            }}
            className="p-0.5 rounded hover:bg-bg-active text-text-muted hover:text-text-primary transition-colors"
            title="Add request"
          >
            <Plus size={12} />
          </button>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-0.5 rounded hover:bg-bg-active text-text-muted hover:text-text-primary transition-colors"
            >
              <MoreHorizontal size={12} />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-32 bg-bg-secondary border border-border rounded-lg shadow-lg z-10 py-1 animate-fade-in">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(true);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
                >
                  <Edit3 size={12} /> Rename
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteCollection(node.collection.id);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-error hover:bg-error/10 transition-colors"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="animate-fade-in">
          {node.requests.map((req) => (
            <RequestItem key={req.id} request={req} depth={depth + 1} />
          ))}
          {node.children.map((child) => (
            <CollectionNode
              key={child.collection.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
              deleteCollection={deleteCollection}
              renameCollection={renameCollection}
            />
          ))}
          {node.requests.length === 0 && node.children.length === 0 && (
            <p
              className="text-[10px] text-text-muted py-1"
              style={{ paddingLeft: `${24 + (depth + 1) * 16}px` }}
            >
              Empty collection
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function RequestItem({ request, depth }: { request: ApiRequest; depth: number }) {
  const openTab = useRequestStore((s) => s.openTab);

  return (
    <button
      onClick={() => openTab(request)}
      className="w-full flex items-center gap-2 px-2 py-1 rounded-md hover:bg-bg-hover transition-colors"
      style={{ paddingLeft: `${24 + depth * 16}px` }}
    >
      <span
        className="font-mono font-bold text-[10px] w-9 text-left shrink-0"
        style={{ color: METHOD_COLORS[request.method] || '#6b7280' }}
      >
        {request.method}
      </span>
      <span className="text-xs text-text-secondary truncate text-left">
        {request.name || request.url || 'Untitled'}
      </span>
    </button>
  );
}
