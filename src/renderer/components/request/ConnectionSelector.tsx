import { useState, useRef, useEffect } from 'react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useRequestStore } from '../../stores/requestStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { ConnectionIcon } from '../connections/ConnectionsView';
import {
  ChevronDown, X, Plug, Globe, Search, Check, Layers,
} from 'lucide-react';
import type { ApiConnection } from '@shared/types';

export function ConnectionSelector() {
  const connections = useConnectionStore((s) => s.connections);
  const activeRequest = useRequestStore((s) => s.activeRequest);
  const linkConnection = useRequestStore((s) => s.linkConnection);
  const linkEndpoint = useRequestStore((s) => s.linkEndpoint);
  const updateActiveRequest = useRequestStore((s) => s.updateActiveRequest);
  const environments = useEnvironmentStore((s) => s.environments);
  const activeEnvironmentId = useEnvironmentStore((s) => s.activeEnvironmentId);
  const setActiveEnvironment = useEnvironmentStore((s) => s.setActiveEnvironment);
  const getGlobalEnvironments = useEnvironmentStore((s) => s.getGlobalEnvironments);
  const getEnvironmentsByConnection = useEnvironmentStore((s) => s.getEnvironmentsByConnection);
  const resolveBaseUrl = useEnvironmentStore((s) => s.resolveBaseUrl);
  const activeWorkspaceId = useCollectionStore((s) => s.activeWorkspaceId);

  const [showConnDropdown, setShowConnDropdown] = useState(false);
  const [showEnvDropdown, setShowEnvDropdown] = useState(false);
  const [connSearch, setConnSearch] = useState('');
  const connRef = useRef<HTMLDivElement>(null);
  const envRef = useRef<HTMLDivElement>(null);

  const linkedConnection = activeRequest.connectionId
    ? connections.find((c) => c.id === activeRequest.connectionId)
    : null;

  const activeEnv = environments.find((e) => e.id === activeEnvironmentId);

  const relevantEnvs = linkedConnection
    ? [...getGlobalEnvironments(), ...getEnvironmentsByConnection(linkedConnection.id)]
    : environments;

  const effectiveBaseUrl = linkedConnection
    ? resolveBaseUrl(linkedConnection.id, linkedConnection.baseUrl)
    : null;
  const baseUrlOverridden = effectiveBaseUrl && linkedConnection && effectiveBaseUrl !== linkedConnection.baseUrl;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (connRef.current && !connRef.current.contains(e.target as Node)) setShowConnDropdown(false);
      if (envRef.current && !envRef.current.contains(e.target as Node)) setShowEnvDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelectConnection = (conn: ApiConnection) => {
    linkConnection(conn.id);
    updateActiveRequest({ auth: { type: 'none' } });
    setShowConnDropdown(false);
    setConnSearch('');
  };

  const handleUnlink = () => {
    linkConnection(undefined);
    linkEndpoint(undefined);
  };

  const filteredConnections = connSearch.trim()
    ? connections.filter((c) =>
        c.name.toLowerCase().includes(connSearch.toLowerCase()) ||
        c.baseUrl.toLowerCase().includes(connSearch.toLowerCase())
      )
    : connections;

  return (
    <div className="flex items-center gap-2">
      {/* Connection selector */}
      <div ref={connRef} className="relative flex-1">
        <button
          onClick={() => setShowConnDropdown(!showConnDropdown)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all text-left ${
            linkedConnection
              ? 'bg-bg-secondary border-border hover:border-border-light'
              : 'bg-bg-tertiary/50 border-dashed border-border hover:border-accent/40 hover:bg-accent/5'
          }`}
        >
          {linkedConnection ? (
            <>
              <ConnectionIcon conn={linkedConnection} size="sm" className="!w-6 !h-6 !rounded-lg" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">{linkedConnection.name}</p>
                <p className="text-[10px] text-text-muted font-mono truncate">
                  {baseUrlOverridden ? (
                    <span className="text-accent">{effectiveBaseUrl}</span>
                  ) : (
                    linkedConnection.baseUrl
                  )}
                </p>
              </div>
              {linkedConnection.auth.type !== 'none' && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-success/15 text-success font-medium">
                  {linkedConnection.auth.type === 'bearer' ? 'Bearer' :
                   linkedConnection.auth.type === 'basic' ? 'Basic' :
                   linkedConnection.auth.type === 'api-key' ? 'API Key' : ''}
                </span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleUnlink(); }}
                className="p-1 rounded-md hover:bg-bg-active text-text-muted hover:text-text-primary transition-colors"
              >
                <X size={12} />
              </button>
            </>
          ) : (
            <>
              <div className="w-6 h-6 rounded-lg bg-bg-tertiary flex items-center justify-center">
                <Plug size={12} className="text-text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-text-muted">Link to API</p>
                <p className="text-[10px] text-text-muted">
                  {connections.length > 0 ? 'Inherit base URL & auth' : 'Connect an API first'}
                </p>
              </div>
            </>
          )}
          <ChevronDown size={14} className="text-text-muted shrink-0" />
        </button>

        {showConnDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-bg-secondary border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
            {connections.length > 3 && (
              <div className="px-2 py-2 border-b border-border">
                <div className="relative">
                  <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    autoFocus
                    type="text"
                    value={connSearch}
                    onChange={(e) => setConnSearch(e.target.value)}
                    placeholder="Search APIs..."
                    className="w-full pl-7 pr-2 py-1.5 text-xs rounded-lg bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
              </div>
            )}
            <div className="max-h-56 overflow-y-auto py-1">
              <button
                onClick={() => { handleUnlink(); setShowConnDropdown(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  !linkedConnection ? 'bg-accent/10' : 'hover:bg-bg-hover'
                }`}
              >
                <div className="w-6 h-6 rounded-lg bg-bg-tertiary flex items-center justify-center">
                  <Globe size={12} className="text-text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary">Freeform Request</p>
                  <p className="text-[10px] text-text-muted">Enter full URL manually</p>
                </div>
                {!linkedConnection && <Check size={14} className="text-accent shrink-0" />}
              </button>

              {filteredConnections.map((conn) => (
                <button
                  key={conn.id}
                  onClick={() => handleSelectConnection(conn)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                    activeRequest.connectionId === conn.id ? 'bg-accent/10' : 'hover:bg-bg-hover'
                  }`}
                >
                  <ConnectionIcon conn={conn} size="sm" className="!w-6 !h-6 !rounded-lg" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate">{conn.name}</p>
                    <p className="text-[10px] text-text-muted font-mono truncate">{conn.baseUrl}</p>
                  </div>
                  <span className="text-[9px] text-text-muted">{conn.endpoints.length} endpoints</span>
                  {activeRequest.connectionId === conn.id && <Check size={14} className="text-accent shrink-0" />}
                </button>
              ))}

              {filteredConnections.length === 0 && connSearch.trim() && (
                <p className="text-xs text-text-muted text-center py-4">No APIs matching "{connSearch}"</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Environment switcher */}
      {relevantEnvs.length > 0 && (
        <div ref={envRef} className="relative">
          <button
            onClick={() => setShowEnvDropdown(!showEnvDropdown)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
              activeEnv
                ? 'bg-accent/10 border-accent/20 text-accent hover:bg-accent/15'
                : 'bg-bg-tertiary border-border text-text-muted hover:bg-bg-hover hover:text-text-primary'
            }`}
          >
            <Layers size={12} />
            <span className="max-w-24 truncate">{activeEnv?.name || 'No Env'}</span>
            <ChevronDown size={12} />
          </button>

          {showEnvDropdown && (
            <div className="absolute top-full right-0 mt-1 w-56 bg-bg-secondary border border-border rounded-xl shadow-2xl z-50 py-1 animate-fade-in">
              {/* "No Environment" option */}
              <button
                onClick={() => {
                  if (activeWorkspaceId) {
                    setActiveEnvironment(activeWorkspaceId, '');
                    useEnvironmentStore.setState({ activeEnvironmentId: null });
                  }
                  setShowEnvDropdown(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                  !activeEnvironmentId ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                }`}
              >
                <span>No Environment</span>
                {!activeEnvironmentId && <Check size={12} />}
              </button>

              {/* Global environments */}
              {getGlobalEnvironments().length > 0 && (
                <>
                  <div className="px-3 py-1 text-[9px] text-text-muted uppercase tracking-wider font-semibold border-t border-border mt-1 pt-1">
                    Global
                  </div>
                  {getGlobalEnvironments().map((env) => (
                    <button
                      key={env.id}
                      onClick={() => {
                        if (activeWorkspaceId) setActiveEnvironment(activeWorkspaceId, env.id);
                        setShowEnvDropdown(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                        env.id === activeEnvironmentId ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${env.id === activeEnvironmentId ? 'bg-success' : 'bg-text-muted/30'}`} />
                        <span className="truncate">{env.name}</span>
                      </div>
                      {env.id === activeEnvironmentId && <Check size={12} />}
                    </button>
                  ))}
                </>
              )}

              {/* Connection-scoped environments */}
              {linkedConnection && getEnvironmentsByConnection(linkedConnection.id).length > 0 && (
                <>
                  <div className="px-3 py-1 text-[9px] text-text-muted uppercase tracking-wider font-semibold border-t border-border mt-1 pt-1">
                    {linkedConnection.name}
                  </div>
                  {getEnvironmentsByConnection(linkedConnection.id).map((env) => (
                    <button
                      key={env.id}
                      onClick={() => {
                        if (activeWorkspaceId) setActiveEnvironment(activeWorkspaceId, env.id);
                        setShowEnvDropdown(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                        env.id === activeEnvironmentId ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`w-2 h-2 rounded-full ${env.id === activeEnvironmentId ? 'bg-success' : 'bg-text-muted/30'}`} />
                        <span className="truncate">{env.name}</span>
                        {env.baseUrl && (
                          <span className="text-[9px] text-text-muted font-mono truncate max-w-24">{env.baseUrl}</span>
                        )}
                      </div>
                      {env.id === activeEnvironmentId && <Check size={12} />}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
