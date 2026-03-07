import { useEnvironmentStore } from '../../stores/environmentStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { Globe, Check, Plus, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export function EnvSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { environments, activeEnvironmentId, setActiveEnvironment, createEnvironment } = useEnvironmentStore();
  const activeWorkspaceId = useCollectionStore((s) => s.activeWorkspaceId);

  const activeEnv = environments.find((e) => e.id === activeEnvironmentId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCreate = async () => {
    const name = prompt('Environment name:');
    if (name && activeWorkspaceId) {
      const env = await createEnvironment(activeWorkspaceId, name);
      await setActiveEnvironment(activeWorkspaceId, env.id);
    }
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border hover:bg-bg-hover text-xs transition-colors"
      >
        <Globe size={14} className={activeEnv ? 'text-success' : 'text-text-muted'} />
        <span className={activeEnv ? 'text-text-primary' : 'text-text-muted'}>
          {activeEnv ? activeEnv.name : 'No Environment'}
        </span>
        <ChevronDown size={12} className="text-text-muted" />
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 w-56 bg-bg-secondary border border-border rounded-xl shadow-2xl z-50 py-1 animate-fade-in">
          <div className="px-3 py-1.5 text-[10px] text-text-muted uppercase tracking-wider font-semibold">
            Environments
          </div>

          <button
            onClick={() => {
              if (activeWorkspaceId) {
                setActiveEnvironment(activeWorkspaceId, '');
                useEnvironmentStore.setState({ activeEnvironmentId: null });
              }
              setOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-bg-hover transition-colors ${
              !activeEnvironmentId ? 'text-text-primary' : 'text-text-secondary'
            }`}
          >
            <span>No Environment</span>
            {!activeEnvironmentId && <Check size={13} className="text-success" />}
          </button>

          {environments.map((env) => (
            <button
              key={env.id}
              onClick={() => {
                if (activeWorkspaceId) {
                  setActiveEnvironment(activeWorkspaceId, env.id);
                }
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-bg-hover transition-colors ${
                env.id === activeEnvironmentId ? 'text-text-primary' : 'text-text-secondary'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    env.id === activeEnvironmentId ? 'bg-success' : 'bg-text-muted'
                  }`}
                />
                <span>{env.name}</span>
              </div>
              {env.id === activeEnvironmentId && <Check size={13} className="text-success" />}
            </button>
          ))}

          <div className="border-t border-border mt-1 pt-1">
            <button
              onClick={handleCreate}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              <Plus size={13} />
              <span>New Environment</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
