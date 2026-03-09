import { useState, useRef, useEffect } from 'react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useRequestStore } from '../../stores/requestStore';
import { ConnectionIcon } from '../connections/ConnectionsView';
import {
  ChevronDown, Plug, Globe, Search, Check,
} from 'lucide-react';
import type { ApiConnection } from '@shared/types';

export function ConnectionSelector() {
  const connections = useConnectionStore((s) => s.connections);
  const activeRequest = useRequestStore((s) => s.activeRequest);
  const linkConnection = useRequestStore((s) => s.linkConnection);
  const linkEndpoint = useRequestStore((s) => s.linkEndpoint);
  const updateActiveRequest = useRequestStore((s) => s.updateActiveRequest);

  const [showDropdown, setShowDropdown] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const linkedConnection = activeRequest.connectionId
    ? connections.find((c) => c.id === activeRequest.connectionId)
    : null;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelectConnection = (conn: ApiConnection) => {
    linkConnection(conn.id);
    if (conn.auth.type !== 'none' && activeRequest.auth.type === 'none') {
      updateActiveRequest({ auth: { ...conn.auth } });
    }
    setShowDropdown(false);
    setSearch('');
  };

  const handleUnlink = () => {
    linkConnection(undefined);
    linkEndpoint(undefined);
  };

  const filteredConnections = search.trim()
    ? connections.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.baseUrl.toLowerCase().includes(search.toLowerCase())
      )
    : connections;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
          linkedConnection
            ? 'bg-bg-secondary border-border hover:border-border-light'
            : 'bg-bg-tertiary/50 border-dashed border-border hover:border-accent/40'
        }`}
      >
        {linkedConnection ? (
          <>
            <ConnectionIcon conn={linkedConnection} size="sm" className="!w-4 !h-4 !rounded shrink-0" />
            <span className="font-medium text-text-primary truncate max-w-[120px]">{linkedConnection.name}</span>
          </>
        ) : (
          <>
            <Plug size={12} className="text-text-muted" />
            <span className="text-text-muted">API</span>
          </>
        )}
        <ChevronDown size={11} className="text-text-muted" />
      </button>

      {showDropdown && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-bg-secondary border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
          {connections.length > 3 && (
            <div className="px-2 py-2 border-b border-border">
              <div className="relative">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search APIs..."
                  className="w-full pl-7 pr-2 py-1.5 text-xs rounded-lg bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>
          )}
          <div className="max-h-56 overflow-y-auto py-1">
            <button
              onClick={() => { handleUnlink(); setShowDropdown(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                !linkedConnection ? 'bg-accent/10' : 'hover:bg-bg-hover'
              }`}
            >
              <div className="w-5 h-5 rounded bg-bg-tertiary flex items-center justify-center">
                <Globe size={11} className="text-text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary">Freeform Request</p>
                <p className="text-[10px] text-text-muted">Enter full URL manually</p>
              </div>
              {!linkedConnection && <Check size={12} className="text-accent shrink-0" />}
            </button>

            {filteredConnections.map((conn) => (
              <button
                key={conn.id}
                onClick={() => handleSelectConnection(conn)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  activeRequest.connectionId === conn.id ? 'bg-accent/10' : 'hover:bg-bg-hover'
                }`}
              >
                <ConnectionIcon conn={conn} size="sm" className="!w-5 !h-5 !rounded" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{conn.name}</p>
                  <p className="text-[10px] text-text-muted font-mono truncate">{conn.baseUrl}</p>
                </div>
                <span className="text-[9px] text-text-muted shrink-0">{conn.endpoints.length} ep</span>
                {activeRequest.connectionId === conn.id && <Check size={12} className="text-accent shrink-0" />}
              </button>
            ))}

            {filteredConnections.length === 0 && search.trim() && (
              <p className="text-xs text-text-muted text-center py-4">No APIs matching "{search}"</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
