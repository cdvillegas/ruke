import { useState, useRef, useEffect } from 'react';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useRequestStore } from '../../stores/requestStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { useUiStore } from '../../stores/uiStore';
import { ChevronDown, Check, Layers, Plus } from 'lucide-react';

export function EnvironmentPill() {
  const environments = useEnvironmentStore((s) => s.environments);
  const activeEnvironmentId = useEnvironmentStore((s) => s.activeEnvironmentId);
  const setActiveEnvironment = useEnvironmentStore((s) => s.setActiveEnvironment);
  const getGlobalEnvironments = useEnvironmentStore((s) => s.getGlobalEnvironments);
  const getEnvironmentsByConnection = useEnvironmentStore((s) => s.getEnvironmentsByConnection);
  const activeWorkspaceId = useCollectionStore((s) => s.activeWorkspaceId);
  const setActiveView = useUiStore((s) => s.setActiveView);

  const connections = useConnectionStore((s) => s.connections);
  const activeRequest = useRequestStore((s) => s.activeRequest);
  const linkedConnection = activeRequest.connectionId
    ? connections.find((c) => c.id === activeRequest.connectionId)
    : null;

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeEnv = environments.find((e) => e.id === activeEnvironmentId);

  const globalEnvs = getGlobalEnvironments();
  const connectionEnvs = linkedConnection
    ? getEnvironmentsByConnection(linkedConnection.id)
    : [];
  const hasEnvs = globalEnvs.length + connectionEnvs.length > 0;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
          activeEnv
            ? 'bg-accent/10 border-accent/20 text-accent hover:bg-accent/15'
            : 'bg-bg-tertiary border-border text-text-muted hover:bg-bg-hover hover:text-text-primary'
        }`}
      >
        <Layers size={12} />
        <span className="max-w-24 truncate">{activeEnv?.name || 'No Env'}</span>
        <ChevronDown size={11} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-56 bg-bg-secondary border border-border rounded-xl shadow-2xl z-50 py-1 animate-fade-in">
          <button
            onClick={() => {
              if (activeWorkspaceId) {
                setActiveEnvironment(activeWorkspaceId, '');
                useEnvironmentStore.setState({ activeEnvironmentId: null });
              }
              setOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${
              !activeEnvironmentId ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            }`}
          >
            <span>No Environment</span>
            {!activeEnvironmentId && <Check size={12} />}
          </button>

          {globalEnvs.length > 0 && (
            <>
              <div className="px-3 py-1 text-[9px] text-text-muted uppercase tracking-wider font-semibold border-t border-border mt-1 pt-1">
                Global
              </div>
              {globalEnvs.map((env) => (
                <button
                  key={env.id}
                  onClick={() => {
                    if (activeWorkspaceId) setActiveEnvironment(activeWorkspaceId, env.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                    env.id === activeEnvironmentId ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${env.id === activeEnvironmentId ? 'bg-success' : 'bg-text-muted/30'}`} />
                    <span className="truncate">{env.name}</span>
                  </div>
                  {env.id === activeEnvironmentId && <Check size={12} />}
                </button>
              ))}
            </>
          )}

          {linkedConnection && connectionEnvs.length > 0 && (
            <>
              <div className="px-3 py-1 text-[9px] text-text-muted uppercase tracking-wider font-semibold border-t border-border mt-1 pt-1">
                {linkedConnection.name}
              </div>
              {connectionEnvs.map((env) => (
                <button
                  key={env.id}
                  onClick={() => {
                    if (activeWorkspaceId) setActiveEnvironment(activeWorkspaceId, env.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                    env.id === activeEnvironmentId ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${env.id === activeEnvironmentId ? 'bg-success' : 'bg-text-muted/30'}`} />
                    <span className="truncate">{env.name}</span>
                    {env.baseUrl && (
                      <span className="text-[9px] text-text-muted font-mono truncate">{env.baseUrl}</span>
                    )}
                  </div>
                  {env.id === activeEnvironmentId && <Check size={12} className="shrink-0" />}
                </button>
              ))}
            </>
          )}

          {!hasEnvs && (
            <div className="border-t border-border mt-1 pt-1">
              <button
                onClick={() => {
                  setOpen(false);
                  setActiveView('environments');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                <Plus size={12} />
                <span>Create environment</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
