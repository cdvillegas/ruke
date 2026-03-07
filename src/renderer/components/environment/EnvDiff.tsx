import { useState } from 'react';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { ArrowLeft, ArrowLeftRight } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function EnvDiff({ onClose }: Props) {
  const { environments, getEnvironmentVariables } = useEnvironmentStore();
  const [leftEnvId, setLeftEnvId] = useState<string>(environments[0]?.id || '');
  const [rightEnvId, setRightEnvId] = useState<string>(environments[1]?.id || environments[0]?.id || '');

  const leftVars = leftEnvId ? getEnvironmentVariables(leftEnvId) : [];
  const rightVars = rightEnvId ? getEnvironmentVariables(rightEnvId) : [];
  const leftEnv = environments.find((e) => e.id === leftEnvId);
  const rightEnv = environments.find((e) => e.id === rightEnvId);

  const allKeys = Array.from(
    new Set([...leftVars.map((v) => v.key), ...rightVars.map((v) => v.key)])
  ).sort();

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-bg-hover text-text-secondary transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <ArrowLeftRight size={18} className="text-accent" />
        <h2 className="text-lg font-semibold text-text-primary">Compare Environments</h2>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <select
          value={leftEnvId}
          onChange={(e) => setLeftEnvId(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg bg-bg-tertiary border border-border text-text-primary focus:outline-none focus:border-accent cursor-pointer"
        >
          {environments.map((env) => (
            <option key={env.id} value={env.id}>{env.name}</option>
          ))}
        </select>
        <select
          value={rightEnvId}
          onChange={(e) => setRightEnvId(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg bg-bg-tertiary border border-border text-text-primary focus:outline-none focus:border-accent cursor-pointer"
        >
          {environments.map((env) => (
            <option key={env.id} value={env.id}>{env.name}</option>
          ))}
        </select>
      </div>

      {allKeys.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">
          No variables to compare. Add variables to your environments first.
        </p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_1fr] bg-bg-tertiary border-b border-border text-[10px] text-text-muted uppercase tracking-wider font-semibold">
            <div className="px-4 py-2.5">Variable</div>
            <div className="px-4 py-2.5">{leftEnv?.name || 'Left'}</div>
            <div className="px-4 py-2.5">{rightEnv?.name || 'Right'}</div>
          </div>
          {allKeys.map((key) => {
            const leftVar = leftVars.find((v) => v.key === key);
            const rightVar = rightVars.find((v) => v.key === key);
            const isDifferent = leftVar?.value !== rightVar?.value;
            const leftMissing = !leftVar;
            const rightMissing = !rightVar;

            return (
              <div
                key={key}
                className={`grid grid-cols-[1fr_1fr_1fr] border-b border-border last:border-b-0 ${
                  isDifferent ? 'bg-warning/5' : ''
                }`}
              >
                <div className="px-4 py-2.5 text-xs font-mono font-semibold text-text-primary">
                  {key}
                </div>
                <div
                  className={`px-4 py-2.5 text-xs font-mono ${
                    leftMissing ? 'text-error italic' : 'text-text-secondary'
                  }`}
                >
                  {leftMissing ? 'missing' : leftVar.isSecret ? '••••••••' : leftVar.value || '(empty)'}
                </div>
                <div
                  className={`px-4 py-2.5 text-xs font-mono ${
                    rightMissing ? 'text-error italic' : 'text-text-secondary'
                  }`}
                >
                  {rightMissing ? 'missing' : rightVar.isSecret ? '••••••••' : rightVar.value || '(empty)'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
