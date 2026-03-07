import { useState } from 'react';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { EnvDiff } from './EnvDiff';
import { VarInheritance } from './VarInheritance';
import {
  Plus, Trash2, Eye, EyeOff, Globe, ArrowLeftRight,
  GitBranch, Edit3, Check, X,
} from 'lucide-react';

export function EnvEditor() {
  const {
    environments, activeEnvironmentId, createEnvironment,
    deleteEnvironment, renameEnvironment, addVariable,
    updateVariable, deleteVariable, getEnvironmentVariables,
    setActiveEnvironment,
  } = useEnvironmentStore();
  const activeWorkspaceId = useCollectionStore((s) => s.activeWorkspaceId);
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(activeEnvironmentId);
  const [showDiff, setShowDiff] = useState(false);
  const [showInheritance, setShowInheritance] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  const selectedEnv = environments.find((e) => e.id === selectedEnvId);
  const variables = selectedEnvId ? getEnvironmentVariables(selectedEnvId) : [];

  const handleCreate = async () => {
    const name = prompt('Environment name:');
    if (name && activeWorkspaceId) {
      const env = await createEnvironment(activeWorkspaceId, name);
      setSelectedEnvId(env.id);
    }
  };

  const handleAddVariable = async () => {
    if (selectedEnvId) {
      await addVariable(selectedEnvId, '', '', 'global', false);
    }
  };

  if (showDiff) {
    return <EnvDiff onClose={() => setShowDiff(false)} />;
  }

  if (showInheritance) {
    return <VarInheritance onClose={() => setShowInheritance(false)} />;
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Environment list */}
      <div className="w-56 border-r border-border bg-bg-secondary flex flex-col shrink-0">
        <div className="px-3 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Globe size={16} className="text-accent" />
            Environments
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {environments.map((env) => (
            <div
              key={env.id}
              onClick={() => setSelectedEnvId(env.id)}
              className={`group flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                env.id === selectedEnvId
                  ? 'bg-bg-active text-text-primary'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    env.id === activeEnvironmentId ? 'bg-success' : 'bg-text-muted'
                  }`}
                />
                {editingName === env.id ? (
                  <input
                    autoFocus
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    onBlur={() => {
                      if (editNameValue.trim()) renameEnvironment(env.id, editNameValue.trim());
                      setEditingName(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (editNameValue.trim()) renameEnvironment(env.id, editNameValue.trim());
                        setEditingName(null);
                      }
                      if (e.key === 'Escape') setEditingName(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 px-1 text-xs bg-bg-tertiary border border-accent rounded text-text-primary focus:outline-none"
                  />
                ) : (
                  <span className="text-xs truncate">{env.name}</span>
                )}
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingName(env.id);
                    setEditNameValue(env.name);
                  }}
                  className="p-0.5 rounded hover:bg-bg-active text-text-muted"
                >
                  <Edit3 size={11} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteEnvironment(env.id);
                  }}
                  className="p-0.5 rounded hover:bg-error/20 text-text-muted hover:text-error"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border p-2 space-y-1">
          <button
            onClick={handleCreate}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <Plus size={13} /> New Environment
          </button>
          <button
            onClick={() => setShowDiff(true)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <ArrowLeftRight size={13} /> Compare Environments
          </button>
          <button
            onClick={() => setShowInheritance(true)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <GitBranch size={13} /> Variable Inheritance
          </button>
        </div>
      </div>

      {/* Variable editor */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedEnv ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{selectedEnv.name}</h2>
                <p className="text-xs text-text-muted mt-0.5">
                  {variables.length} variable{variables.length !== 1 ? 's' : ''}
                  {selectedEnv.id === activeEnvironmentId && (
                    <span className="ml-2 text-success">Active</span>
                  )}
                </p>
              </div>
              {selectedEnv.id !== activeEnvironmentId && activeWorkspaceId && (
                <button
                  onClick={() => setActiveEnvironment(activeWorkspaceId, selectedEnv.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-success/20 text-success hover:bg-success/30 transition-colors"
                >
                  <Check size={13} /> Set Active
                </button>
              )}
            </div>

            {/* Variables table */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_80px_40px_40px] gap-0 bg-bg-tertiary border-b border-border text-[10px] text-text-muted uppercase tracking-wider font-semibold">
                <div className="px-3 py-2">Variable</div>
                <div className="px-3 py-2">Value</div>
                <div className="px-3 py-2">Scope</div>
                <div className="px-3 py-2 text-center">Secret</div>
                <div className="px-3 py-2" />
              </div>
              {variables.map((v) => (
                <VariableRow
                  key={v.id}
                  variable={v}
                  onUpdate={(updates) => updateVariable(v.id, updates)}
                  onDelete={() => deleteVariable(v.id, selectedEnvId!)}
                />
              ))}
              {variables.length === 0 && (
                <div className="px-3 py-8 text-center">
                  <p className="text-xs text-text-muted">No variables yet</p>
                </div>
              )}
            </div>

            <button
              onClick={handleAddVariable}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-bg-tertiary hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors border border-border"
            >
              <Plus size={13} /> Add Variable
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Globe size={32} className="mx-auto text-text-muted opacity-30 mb-3" />
              <p className="text-sm text-text-muted">Select an environment to edit</p>
              <p className="text-xs text-text-muted mt-1">or create a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function VariableRow({
  variable: v, onUpdate, onDelete,
}: {
  variable: any;
  onUpdate: (updates: any) => void;
  onDelete: () => void;
}) {
  const [showSecret, setShowSecret] = useState(false);

  return (
    <div className="grid grid-cols-[1fr_1fr_80px_40px_40px] gap-0 border-b border-border last:border-b-0 hover:bg-bg-hover/50 transition-colors group">
      <div className="px-2 py-1.5">
        <input
          type="text"
          value={v.key}
          onChange={(e) => onUpdate({ key: e.target.value })}
          placeholder="KEY"
          className="w-full px-2 py-1 text-xs font-mono bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none focus:bg-bg-tertiary rounded transition-colors"
        />
      </div>
      <div className="px-2 py-1.5 relative">
        <input
          type={v.isSecret && !showSecret ? 'password' : 'text'}
          value={v.value}
          onChange={(e) => onUpdate({ value: e.target.value })}
          placeholder="value"
          className="w-full px-2 py-1 text-xs font-mono bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none focus:bg-bg-tertiary rounded transition-colors"
        />
        {v.isSecret && (
          <button
            onClick={() => setShowSecret(!showSecret)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-text-muted hover:text-text-primary"
          >
            {showSecret ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        )}
      </div>
      <div className="px-2 py-1.5">
        <select
          value={v.scope}
          onChange={(e) => onUpdate({ scope: e.target.value })}
          className="w-full px-1 py-1 text-[10px] bg-transparent text-text-secondary focus:outline-none cursor-pointer"
        >
          <option value="global">Global</option>
          <option value="collection">Collection</option>
          <option value="folder">Folder</option>
          <option value="request">Request</option>
        </select>
      </div>
      <div className="px-2 py-1.5 flex items-center justify-center">
        <input
          type="checkbox"
          checked={v.isSecret}
          onChange={(e) => onUpdate({ isSecret: e.target.checked })}
          className="w-3.5 h-3.5 rounded border-border accent-accent cursor-pointer"
        />
      </div>
      <div className="px-2 py-1.5 flex items-center justify-center">
        <button
          onClick={onDelete}
          className="p-0.5 rounded text-text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
