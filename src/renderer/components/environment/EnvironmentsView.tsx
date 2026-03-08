import { useState, useEffect } from 'react';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { useUiStore } from '../../stores/uiStore';
import { ConnectionIcon } from '../connections/ConnectionsView';
import {
  Plus, Trash2, Eye, EyeOff, Globe, Edit3, Check, X,
  Layers, Link, ExternalLink, Search,
} from 'lucide-react';
import type { Environment, ApiConnection } from '@shared/types';

export function EnvironmentsView() {
  const {
    environments, activeEnvironmentId, createEnvironment,
    deleteEnvironment, renameEnvironment, updateEnvironmentBaseUrl,
    addVariable, updateVariable, deleteVariable,
    getEnvironmentVariables, setActiveEnvironment,
    getGlobalEnvironments, getEnvironmentsByConnection,
  } = useEnvironmentStore();
  const connections = useConnectionStore((s) => s.connections);
  const activeWorkspaceId = useCollectionStore((s) => s.activeWorkspaceId);
  const setActiveView = useUiStore((s) => s.setActiveView);

  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(activeEnvironmentId);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [sidebarSearch, setSidebarSearch] = useState('');

  useEffect(() => {
    if (activeEnvironmentId && !selectedEnvId) {
      setSelectedEnvId(activeEnvironmentId);
    }
  }, [activeEnvironmentId]);

  const selectedEnv = environments.find((e) => e.id === selectedEnvId);
  const variables = selectedEnvId ? getEnvironmentVariables(selectedEnvId) : [];

  const globalEnvs = getGlobalEnvironments();
  const connectionsWithEnvs = connections.map((conn) => ({
    connection: conn,
    environments: getEnvironmentsByConnection(conn.id),
  }));

  const filteredGlobalEnvs = sidebarSearch.trim()
    ? globalEnvs.filter((e) => e.name.toLowerCase().includes(sidebarSearch.toLowerCase()))
    : globalEnvs;

  const filteredConnectionGroups = connectionsWithEnvs
    .map((group) => ({
      ...group,
      environments: sidebarSearch.trim()
        ? group.environments.filter((e) =>
            e.name.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
            group.connection.name.toLowerCase().includes(sidebarSearch.toLowerCase())
          )
        : group.environments,
    }))
    .filter((group) => group.environments.length > 0 || !sidebarSearch.trim());

  const handleCreate = async (connectionId?: string, connection?: ApiConnection) => {
    if (!activeWorkspaceId) return;
    const defaultName = connectionId
      ? `${connection?.name || 'API'} - New Env`
      : 'New Environment';
    const env = await createEnvironment(activeWorkspaceId, defaultName, connectionId, connection?.baseUrl);
    setSelectedEnvId(env.id);
    setEditingName(env.id);
    setEditNameValue(defaultName);
  };

  const handleAddVariable = async () => {
    if (selectedEnvId) {
      await addVariable(selectedEnvId, '', '', 'global', false);
    }
  };

  const startRename = (env: Environment) => {
    setEditingName(env.id);
    setEditNameValue(env.name);
  };

  const commitRename = (envId: string) => {
    if (editNameValue.trim()) renameEnvironment(envId, editNameValue.trim());
    setEditingName(null);
  };

  const linkedConnection = selectedEnv?.connectionId
    ? connections.find((c) => c.id === selectedEnv.connectionId)
    : null;

  return (
    <div className="flex-1 flex overflow-hidden h-full">
      {/* Sidebar: environment list */}
      <div className="w-64 h-full border-r border-border bg-bg-secondary flex flex-col shrink-0">
        <div className="px-3 pt-3 pb-2 space-y-2 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Environments</h2>
            <button
              onClick={() => handleCreate()}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              title="New global environment"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              placeholder="Search environments..."
              className="w-full pl-7 pr-3 py-1.5 text-xs bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
          {/* Global environments */}
          <div className="mb-1">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-3 py-1.5 flex items-center gap-1.5">
              <Globe size={10} />
              Global
            </p>
            {filteredGlobalEnvs.map((env) => (
              <EnvListItem
                key={env.id}
                env={env}
                isSelected={env.id === selectedEnvId}
                isActive={env.id === activeEnvironmentId}
                isEditing={editingName === env.id}
                editNameValue={editNameValue}
                onSelect={() => setSelectedEnvId(env.id)}
                onStartRename={() => startRename(env)}
                onEditNameChange={setEditNameValue}
                onCommitRename={() => commitRename(env.id)}
                onCancelRename={() => setEditingName(null)}
                onDelete={() => deleteEnvironment(env.id)}
              />
            ))}
            {filteredGlobalEnvs.length === 0 && !sidebarSearch.trim() && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Layers size={20} className="text-text-muted mb-2" />
                <p className="text-xs text-text-muted">No environments yet</p>
              </div>
            )}
          </div>

          {/* Per-connection environments */}
          {filteredConnectionGroups.map(({ connection, environments: connEnvs }) => (
            <div key={connection.id} className="mt-2 pt-2 border-t border-border/60">
              <div className="px-3 py-1.5 flex items-center gap-2">
                <ConnectionIcon conn={connection} size="xs" />
                <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider truncate flex-1">
                  {connection.name}
                </span>
                <button
                  onClick={() => handleCreate(connection.id, connection)}
                  className="p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary opacity-0 group-hover:opacity-100 transition-all"
                  title={`Add environment for ${connection.name}`}
                >
                  <Plus size={10} />
                </button>
              </div>
              {connEnvs.map((env) => (
                <EnvListItem
                  key={env.id}
                  env={env}
                  isSelected={env.id === selectedEnvId}
                  isActive={env.id === activeEnvironmentId}
                  isEditing={editingName === env.id}
                  editNameValue={editNameValue}
                  onSelect={() => setSelectedEnvId(env.id)}
                  onStartRename={() => startRename(env)}
                  onEditNameChange={setEditNameValue}
                  onCommitRename={() => commitRename(env.id)}
                  onCancelRename={() => setEditingName(null)}
                  onDelete={() => deleteEnvironment(env.id)}
                />
              ))}
              {connEnvs.length === 0 && (
                <button
                  onClick={() => handleCreate(connection.id, connection)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
                >
                  <Plus size={11} />
                  Add environment
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main: variable editor */}
      <div className="flex-1 overflow-y-auto">
        {selectedEnv ? (
          <div className="max-w-3xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-text-primary">{selectedEnv.name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-text-muted">
                    {variables.length} variable{variables.length !== 1 ? 's' : ''}
                  </span>
                  {selectedEnv.id === activeEnvironmentId && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-success/15 text-success font-medium">
                      Active
                    </span>
                  )}
                  {linkedConnection && (
                    <button
                      onClick={() => {
                        useConnectionStore.getState().setActiveConnection(linkedConnection.id);
                        setActiveView('connections');
                      }}
                      className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                    >
                      <Link size={9} />
                      {linkedConnection.name}
                      <ExternalLink size={8} />
                    </button>
                  )}
                </div>
              </div>
              {selectedEnv.id !== activeEnvironmentId && activeWorkspaceId && (
                <button
                  onClick={() => setActiveEnvironment(activeWorkspaceId, selectedEnv.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-success/20 text-success hover:bg-success/30 transition-colors"
                >
                  <Check size={13} /> Set Active
                </button>
              )}
            </div>

            {/* Base URL override */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-text-muted font-medium uppercase tracking-wider">
                Base URL {linkedConnection && <span className="normal-case tracking-normal text-text-muted/60">(overrides {linkedConnection.baseUrl})</span>}
              </label>
              <input
                type="text"
                value={selectedEnv.baseUrl || ''}
                onChange={(e) => updateEnvironmentBaseUrl(selectedEnv.id, e.target.value)}
                placeholder={linkedConnection?.baseUrl || 'https://api.example.com'}
                className="w-full px-3 py-2 text-sm font-mono bg-bg-secondary border border-border rounded-lg text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            {/* Variables table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Variables</h3>
                <button
                  onClick={handleAddVariable}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-bg-tertiary hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors border border-border"
                >
                  <Plus size={12} /> Add
                </button>
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_40px_40px] gap-0 bg-bg-tertiary border-b border-border text-[10px] text-text-muted uppercase tracking-wider font-semibold">
                  <div className="px-3 py-2">Variable</div>
                  <div className="px-3 py-2">Value</div>
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
                    <p className="text-[11px] text-text-muted/60 mt-1">
                      Add variables like <code className="px-1 py-0.5 rounded bg-bg-tertiary font-mono text-accent">{'{{api_key}}'}</code> to use in your requests
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Layers size={28} className="text-accent" />
              </div>
              <h3 className="text-base font-semibold text-text-primary mb-2">Environments</h3>
              <p className="text-sm text-text-muted leading-relaxed">
                Create environments to manage variables like API keys, base URLs, and tokens across your requests. Switch between development, staging, and production with one click.
              </p>
              {activeWorkspaceId && (
                <button
                  onClick={() => handleCreate()}
                  className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors mx-auto"
                >
                  <Plus size={14} /> Create Environment
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EnvListItem({ env, isSelected, isActive, isEditing, editNameValue, onSelect, onStartRename, onEditNameChange, onCommitRename, onCancelRename, onDelete }: {
  env: Environment;
  isSelected: boolean;
  isActive: boolean;
  isEditing: boolean;
  editNameValue: string;
  onSelect: () => void;
  onStartRename: () => void;
  onEditNameChange: (v: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? 'bg-accent/10 text-text-primary'
          : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
      }`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div
          className={`w-2 h-2 rounded-full shrink-0 ${
            isActive ? 'bg-success' : 'bg-text-muted/30'
          }`}
        />
        {isEditing ? (
          <input
            autoFocus
            value={editNameValue}
            onChange={(e) => onEditNameChange(e.target.value)}
            onBlur={onCommitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitRename();
              if (e.key === 'Escape') onCancelRename();
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
          onClick={(e) => { e.stopPropagation(); onStartRename(); }}
          className="p-0.5 rounded hover:bg-bg-active text-text-muted"
        >
          <Edit3 size={11} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-0.5 rounded hover:bg-error/20 text-text-muted hover:text-error"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

function VariableRow({ variable: v, onUpdate, onDelete }: {
  variable: any;
  onUpdate: (updates: any) => void;
  onDelete: () => void;
}) {
  const [showSecret, setShowSecret] = useState(false);

  return (
    <div className="grid grid-cols-[1fr_1fr_40px_40px] gap-0 border-b border-border last:border-b-0 hover:bg-bg-hover/50 transition-colors group">
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
