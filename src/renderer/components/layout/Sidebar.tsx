import { useState } from 'react';
import { useUiStore } from '../../stores/uiStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { useRequestStore } from '../../stores/requestStore';
import { CollectionTree } from '../collections/CollectionTree';
import {
  FolderPlus, History, Settings, Globe, Search,
  ChevronRight, ChevronDown,
} from 'lucide-react';
import type { AppView } from '@shared/types';

const NAV_ITEMS: { id: AppView; label: string; icon: typeof History }[] = [
  { id: 'history', label: 'History', icon: History },
  { id: 'environments', label: 'Environments', icon: Globe },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const { sidebarWidth, activeView, setActiveView } = useUiStore();
  const { createCollection } = useCollectionStore();
  const { history } = useRequestStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [collectionsExpanded, setCollectionsExpanded] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const handleNewCollection = async () => {
    const name = prompt('Collection name:');
    if (name) {
      await createCollection(name);
    }
  };

  return (
    <div
      className="flex flex-col border-r border-border bg-bg-secondary shrink-0 overflow-hidden"
      style={{ width: sidebarWidth }}
    >
      <div className="p-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-1">
          <button
            onClick={() => setCollectionsExpanded(!collectionsExpanded)}
            className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wider hover:text-text-primary transition-colors"
          >
            <span>Collections</span>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNewCollection();
                }}
                className="p-0.5 rounded hover:bg-bg-hover transition-colors"
                title="New Collection"
              >
                <FolderPlus size={13} />
              </button>
              {collectionsExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </div>
          </button>
          {collectionsExpanded && (
            <div className="animate-fade-in">
              <CollectionTree searchQuery={searchQuery} />
            </div>
          )}
        </div>

        <div className="px-1 mt-2">
          <button
            onClick={() => {
              setHistoryExpanded(!historyExpanded);
              setActiveView('history');
            }}
            className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wider hover:text-text-primary transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <History size={13} />
              <span>History</span>
            </div>
            <span className="text-text-muted font-normal normal-case">{history.length}</span>
          </button>
          {historyExpanded && (
            <div className="animate-fade-in max-h-64 overflow-y-auto">
              {history.slice(0, 20).map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => {
                    if (entry.request) {
                      useRequestStore.getState().openTab(entry.request);
                    }
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-bg-hover rounded-md transition-colors"
                >
                  <MethodBadge method={entry.method} />
                  <span className="truncate text-text-secondary flex-1 text-left">
                    {entry.url.replace(/^https?:\/\//, '').slice(0, 40)}
                  </span>
                  <StatusBadge status={entry.status} />
                </button>
              ))}
              {history.length === 0 && (
                <p className="text-xs text-text-muted px-3 py-2">No history yet</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border p-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-colors ${
              activeView === item.id
                ? 'bg-bg-active text-text-primary'
                : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            }`}
          >
            <item.icon size={14} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'text-method-get',
    POST: 'text-method-post',
    PUT: 'text-method-put',
    PATCH: 'text-method-patch',
    DELETE: 'text-method-delete',
  };
  return (
    <span className={`font-mono font-bold text-[10px] w-10 text-left ${colors[method] || 'text-text-muted'}`}>
      {method}
    </span>
  );
}

function StatusBadge({ status }: { status: number }) {
  const color = status >= 200 && status < 300
    ? 'text-success'
    : status >= 400
    ? 'text-error'
    : 'text-warning';
  return <span className={`font-mono text-[10px] ${color}`}>{status || 'ERR'}</span>;
}
