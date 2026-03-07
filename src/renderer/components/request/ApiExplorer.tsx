import { useState, useMemo } from 'react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useRequestStore } from '../../stores/requestStore';
import { useUiStore } from '../../stores/uiStore';
import {
  Search, ChevronRight, ChevronDown, Play, Plus,
  Plug, X,
} from 'lucide-react';
import { METHOD_COLORS } from '@shared/constants';
import type { ApiConnection, ApiEndpoint } from '@shared/types';
import { ConnectionIcon } from '../connections/ConnectionsView';

export function ApiExplorer({ onClose }: { onClose: () => void }) {
  const connections = useConnectionStore((s) => s.connections);
  const [search, setSearch] = useState('');
  const [expandedConns, setExpandedConns] = useState<Set<string>>(
    () => new Set(connections.slice(0, 3).map(c => c.id))
  );
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());

  const toggleConn = (id: string) => {
    setExpandedConns(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleTag = (key: string) => {
    setExpandedTags(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return connections;
    const q = search.toLowerCase();
    return connections.map(conn => {
      const matchingEndpoints = conn.endpoints.filter(ep =>
        ep.path.toLowerCase().includes(q) ||
        ep.summary.toLowerCase().includes(q) ||
        ep.method.toLowerCase().includes(q) ||
        (ep.tags || []).some(t => t.toLowerCase().includes(q))
      );
      if (matchingEndpoints.length > 0 || conn.name.toLowerCase().includes(q)) {
        return { ...conn, endpoints: matchingEndpoints.length > 0 ? matchingEndpoints : conn.endpoints };
      }
      return null;
    }).filter(Boolean) as ApiConnection[];
  }, [connections, search]);

  const openEndpoint = (conn: ApiConnection, ep: ApiEndpoint) => {
    const store = useRequestStore.getState();
    const isGraphQL = conn.specType === 'graphql';
    const url = isGraphQL ? conn.baseUrl : conn.baseUrl.replace(/\/+$/, '') + ep.path;

    store.newRequest();
    store.updateActiveRequest({
      method: ep.method,
      url,
      name: ep.summary || `${ep.method} ${ep.path}`,
      headers: isGraphQL
        ? [{ key: 'Content-Type', value: 'application/json', enabled: true }]
        : [{ key: '', value: '', enabled: true }],
      params: (ep.parameters || [])
        .filter(p => p.in === 'query')
        .map(p => ({ key: p.name, value: '', enabled: true })),
      body: isGraphQL
        ? { type: 'graphql' as any, raw: `{\n  ${ep.path} {\n    \n  }\n}` }
        : ep.requestBody
          ? { type: ep.requestBody.type, raw: ep.requestBody.example || ep.requestBody.schema || '' }
          : { type: 'none' },
      auth: conn.auth,
    });

    useUiStore.getState().setActiveProtocol(isGraphQL ? 'graphql' : 'rest');
  };

  const openAllEndpoints = (conn: ApiConnection) => {
    const eps = conn.endpoints.slice(0, 20);
    for (const ep of eps) {
      openEndpoint(conn, ep);
    }
  };

  if (connections.length === 0) {
    return (
      <div className="w-64 border-r border-border bg-bg-secondary flex flex-col shrink-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <div className="flex items-center gap-1.5">
            <Plug size={12} className="text-accent" />
            <span className="text-[11px] font-semibold text-text-primary">APIs</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-bg-hover text-text-muted transition-colors">
            <X size={12} />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <Plug size={20} className="text-text-muted opacity-30 mb-2" />
          <p className="text-[11px] text-text-muted mb-3">No APIs connected yet</p>
          <button
            onClick={() => useUiStore.getState().setActiveView('connections')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors"
          >
            <Plus size={11} /> Connect API
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 border-r border-border bg-bg-secondary flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Plug size={12} className="text-accent" />
          <span className="text-[11px] font-semibold text-text-primary">APIs</span>
          <span className="text-[9px] text-text-muted">{connections.length}</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-bg-hover text-text-muted transition-colors">
          <X size={12} />
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-2 border-b border-border">
        <div className="relative">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search endpoints..."
            className="w-full pl-6 pr-2 py-1.5 text-[11px] rounded-lg bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      {/* Connection tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {filtered.map(conn => {
          const isExpanded = expandedConns.has(conn.id) || search.trim().length > 0;
          const tags = Array.from(new Set(conn.endpoints.flatMap(ep => ep.tags || ['Other']))).sort();
          const hasTags = tags.length > 1 || (tags.length === 1 && tags[0] !== 'Other');

          return (
            <div key={conn.id}>
              {/* Connection header */}
              <button
                onClick={() => toggleConn(conn.id)}
                className="w-full flex items-center gap-2 px-2 py-2 hover:bg-bg-hover transition-colors group text-left"
              >
                <span className="text-text-muted">
                  {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                </span>
                <ConnectionIcon conn={conn} size="xs" />
                <span className="text-[11px] font-medium text-text-primary truncate flex-1">{conn.name}</span>
                <span className="text-[9px] text-text-muted shrink-0">{conn.endpoints.length}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); openAllEndpoints(conn); }}
                  className="p-0.5 rounded text-text-muted opacity-0 group-hover:opacity-100 hover:text-accent transition-all"
                  title="Open all as tabs"
                >
                  <Plus size={10} />
                </button>
              </button>

              {/* Endpoints */}
              {isExpanded && (
                <div className="ml-2">
                  {hasTags ? (
                    tags.map(tag => {
                      const tagKey = `${conn.id}:${tag}`;
                      const tagExpanded = expandedTags.has(tagKey) || search.trim().length > 0;
                      const tagEndpoints = conn.endpoints.filter(ep => (ep.tags || ['Other']).includes(tag));
                      return (
                        <div key={tagKey}>
                          <button
                            onClick={() => toggleTag(tagKey)}
                            className="w-full flex items-center gap-1.5 px-2 py-1 hover:bg-bg-hover transition-colors text-left"
                          >
                            <span className="text-text-muted">
                              {tagExpanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
                            </span>
                            <span className="text-[10px] text-text-muted font-medium truncate">{tag}</span>
                            <span className="text-[9px] text-text-muted ml-auto">{tagEndpoints.length}</span>
                          </button>
                          {tagExpanded && tagEndpoints.map(ep => (
                            <EndpointItem key={ep.id} conn={conn} ep={ep} onOpen={openEndpoint} />
                          ))}
                        </div>
                      );
                    })
                  ) : (
                    conn.endpoints.map(ep => (
                      <EndpointItem key={ep.id} conn={conn} ep={ep} onOpen={openEndpoint} />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && search.trim() && (
          <div className="px-4 py-6 text-center">
            <p className="text-[10px] text-text-muted">No endpoints match "{search}"</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-2 py-2 border-t border-border">
        <button
          onClick={() => useUiStore.getState().setActiveView('connections')}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <Plus size={10} /> Add API
        </button>
      </div>
    </div>
  );
}

function EndpointItem({ conn, ep, onOpen }: {
  conn: ApiConnection;
  ep: ApiEndpoint;
  onOpen: (conn: ApiConnection, ep: ApiEndpoint) => void;
}) {
  return (
    <button
      onClick={() => onOpen(conn, ep)}
      className="w-full flex items-center gap-2 pl-6 pr-2 py-1 hover:bg-bg-hover transition-colors group text-left"
    >
      <span
        className="font-mono font-bold text-[8px] w-8 shrink-0"
        style={{ color: METHOD_COLORS[ep.method] || '#6b7280' }}
      >
        {ep.method}
      </span>
      <span className="text-[10px] text-text-secondary font-mono truncate flex-1">
        {ep.path}
      </span>
      <Play
        size={9}
        className="text-text-muted opacity-0 group-hover:opacity-100 hover:text-accent transition-all shrink-0"
      />
    </button>
  );
}
