import { useEnvironmentStore } from '../../stores/environmentStore';
import { ArrowLeft, GitBranch, ArrowDown } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function VarInheritance({ onClose }: Props) {
  const { getResolvedVariableDetails, environments, activeEnvironmentId } = useEnvironmentStore();
  const details = getResolvedVariableDetails();
  const activeEnv = environments.find((e) => e.id === activeEnvironmentId);

  const scopes: Array<{ id: string; label: string; color: string }> = [
    { id: 'global', label: 'Global', color: 'text-accent' },
    { id: 'collection', label: 'Collection', color: 'text-method-put' },
    { id: 'folder', label: 'Folder', color: 'text-method-patch' },
    { id: 'request', label: 'Request', color: 'text-method-post' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-bg-hover text-text-secondary transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <GitBranch size={18} className="text-accent" />
        <h2 className="text-lg font-semibold text-text-primary">Variable Inheritance</h2>
      </div>

      <div className="mb-6 p-4 rounded-lg bg-bg-secondary border border-border">
        <h3 className="text-sm font-semibold text-text-primary mb-3">How Scoping Works</h3>
        <div className="flex items-center gap-3">
          {scopes.map((scope, i) => (
            <div key={scope.id} className="flex items-center gap-2">
              <div className={`px-2 py-1 rounded text-xs font-medium ${scope.color} bg-bg-tertiary border border-border`}>
                {scope.label}
              </div>
              {i < scopes.length - 1 && (
                <ArrowDown size={14} className="text-text-muted rotate-[-90deg]" />
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-text-muted mt-3">
          More specific scopes override less specific ones. A request-scoped variable overrides the same key at folder, collection, or global scope.
        </p>
      </div>

      {!activeEnv ? (
        <p className="text-sm text-text-muted text-center py-8">
          No active environment. Select one to see variable inheritance.
        </p>
      ) : (
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">
            Active: {activeEnv.name}
          </h3>
          {details.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-8">
              No variables defined in this environment.
            </p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_100px] bg-bg-tertiary border-b border-border text-[10px] text-text-muted uppercase tracking-wider font-semibold">
                <div className="px-4 py-2.5">Variable</div>
                <div className="px-4 py-2.5">Resolved Value</div>
                <div className="px-4 py-2.5">Scope</div>
              </div>
              {details.map((d) => {
                const scopeColor = scopes.find((s) => s.id === d.source.scope)?.color || 'text-text-muted';
                return (
                  <div key={d.key} className="grid grid-cols-[1fr_1fr_100px] border-b border-border last:border-b-0 hover:bg-bg-hover/50 transition-colors">
                    <div className="px-4 py-2.5 text-xs font-mono font-semibold text-text-primary">
                      {'{{'}
                      {d.key}
                      {'}}'}
                    </div>
                    <div className="px-4 py-2.5 text-xs font-mono text-text-secondary">
                      {d.value}
                    </div>
                    <div className={`px-4 py-2.5 text-xs font-medium capitalize ${scopeColor}`}>
                      {d.source.scope}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
