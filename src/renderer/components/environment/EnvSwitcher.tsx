import { useEnvironmentStore } from '../../stores/environmentStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { Layers, Check, Plus, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export function EnvSwitcher() {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { environments, activeEnvironmentId, setActiveEnvironment, createEnvironment } = useEnvironmentStore();
  const activeWorkspaceId = useCollectionStore((s) => s.activeWorkspaceId);

  const activeEnv = environments.find((e) => e.id === activeEnvironmentId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (name && activeWorkspaceId) {
      const env = await createEnvironment(activeWorkspaceId, name);
      await setActiveEnvironment(activeWorkspaceId, env.id);
    }
    setCreating(false);
    setNewName('');
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
          activeEnv
            ? 'bg-accent/10 border-accent/20 text-accent hover:bg-accent/15'
            : 'bg-bg-tertiary border-border text-text-muted hover:bg-bg-hover hover:text-text-primary'
        }`}
      >
        <Layers size={14} />
        <span className="max-w-28 truncate">{activeEnv ? activeEnv.name : 'No Environment'}</span>
        <ChevronDown size={12} className="text-text-muted" />
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 w-56 bg-bg-secondary border border-border rounded-xl shadow-2xl z-50 py-1 animate-fade-in">
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

          <div className="border-t border-border mt-1 pt-1">
            {creating ? (
              <div className="px-3 py-1.5">
                <input
                  ref={inputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                  }}
                  onBlur={() => { setCreating(false); setNewName(''); }}
                  placeholder="Environment name..."
                  className="w-full px-2 py-1 text-xs bg-bg-tertiary border border-accent rounded text-text-primary placeholder:text-text-muted focus:outline-none"
                />
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                <Plus size={13} />
                <span>New Environment</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
