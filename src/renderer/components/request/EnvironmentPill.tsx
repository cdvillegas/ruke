import { useState, useRef, useEffect } from 'react';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { useUiStore } from '../../stores/uiStore';
import { ChevronDown, Check, Layers, Plus } from 'lucide-react';

export function EnvironmentPill() {
  const environments = useEnvironmentStore((s) => s.environments);
  const activeEnvironmentId = useEnvironmentStore((s) => s.activeEnvironmentId);
  const setActiveEnvironment = useEnvironmentStore((s) => s.setActiveEnvironment);
  const activeWorkspaceId = useCollectionStore((s) => s.activeWorkspaceId);
  const setActiveView = useUiStore((s) => s.setActiveView);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeEnv = environments.find((e) => e.id === activeEnvironmentId);

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
        <span className="max-w-[200px] truncate">{activeEnv?.name || 'No Env'}</span>
        <ChevronDown size={11} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-56 bg-bg-secondary border border-border rounded-xl shadow-2xl z-50 py-1 animate-fade-in">
          <button
            onClick={() => {
              if (activeWorkspaceId) setActiveEnvironment(activeWorkspaceId, '');
              setOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${
              !activeEnvironmentId ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            }`}
          >
            <span>No Environment</span>
            {!activeEnvironmentId && <Check size={12} />}
          </button>

          {environments.length > 0 && (
            <div className="border-t border-border mt-1 pt-1">
              {environments.map((env) => (
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
            </div>
          )}

          {environments.length === 0 && (
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
