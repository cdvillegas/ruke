import { useState, useEffect, useRef, useCallback } from 'react';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { useUiStore } from '../../stores/uiStore';
import {
  Plus, Trash2, Eye, EyeOff, MoreHorizontal,
  Layers, Search, FileText, Copy, Pencil, Check,
  Archive, ArchiveRestore, ChevronDown, ChevronRight, Variable,
} from 'lucide-react';
import type { Environment } from '@shared/types';

export function EnvironmentsSidebar() {
  const {
    environments, archivedEnvironments, activeEnvironmentId, createEnvironment,
    archiveEnvironment, unarchiveEnvironment, deleteEnvironment,
    duplicateEnvironment, renameEnvironment,
    reorderEnvironments,
  } = useEnvironmentStore();
  const activeWorkspaceId = useCollectionStore((s) => s.activeWorkspaceId);

  const selectedEnvId = useEnvironmentStore((s) => s.selectedEnvironmentId);
  const setSelectedEnvId = useEnvironmentStore((s) => s.setSelectedEnvironmentId);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'above' | 'below' | null>(null);
  const [archiveExpanded, setArchiveExpanded] = useState(false);

  useEffect(() => {
    if (activeEnvironmentId && !selectedEnvId) {
      setSelectedEnvId(activeEnvironmentId);
    }
  }, [activeEnvironmentId]);

  const filtered = sidebarSearch.trim()
    ? environments.filter((e) => e.name.toLowerCase().includes(sidebarSearch.toLowerCase()))
    : environments;

  const isSearching = sidebarSearch.trim().length > 0;

  const handleCreate = async () => {
    if (!activeWorkspaceId) return;
    const env = await createEnvironment(activeWorkspaceId, 'New Environment');
    setSelectedEnvId(env.id);
    setEditingName(env.id);
    setEditNameValue('New Environment');
  };

  const startRename = (env: Environment) => {
    setEditingName(env.id);
    setEditNameValue(env.name);
  };

  const commitRename = (envId: string) => {
    if (editNameValue.trim()) renameEnvironment(envId, editNameValue.trim());
    setEditingName(null);
  };

  const handleDuplicate = async (envId: string) => {
    const newEnv = await duplicateEnvironment(envId);
    setSelectedEnvId(newEnv.id);
    setEditingName(newEnv.id);
    setEditNameValue(newEnv.name);
  };

  const handleDragStart = useCallback((envId: string) => {
    setDraggedId(envId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    if (!draggedId || draggedId === targetId || isSearching) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    setDropTargetId(targetId);
    setDropPosition(e.clientY < midY ? 'above' : 'below');
  }, [draggedId, isSearching]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDropTargetId(null);
      setDropPosition(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedId || !dropTargetId || !dropPosition || isSearching) {
      setDraggedId(null);
      setDropTargetId(null);
      setDropPosition(null);
      return;
    }

    const ordered = environments.map((env) => env.id);
    const fromIdx = ordered.indexOf(draggedId);
    const toIdx = ordered.indexOf(dropTargetId);
    if (fromIdx < 0 || toIdx < 0) return;

    ordered.splice(fromIdx, 1);
    const insertIdx = ordered.indexOf(dropTargetId);
    ordered.splice(dropPosition === 'above' ? insertIdx : insertIdx + 1, 0, draggedId);

    reorderEnvironments(ordered);
    setDraggedId(null);
    setDropTargetId(null);
    setDropPosition(null);
  }, [draggedId, dropTargetId, dropPosition, environments, reorderEnvironments, isSearching]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDropTargetId(null);
    setDropPosition(null);
  }, []);

  return (
    <>
      <div className="px-3 pt-3 pb-2 space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Environments</h2>
          <button
            onClick={handleCreate}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            title="New environment"
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
        {filtered.map((env) => (
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
            onDuplicate={() => handleDuplicate(env.id)}
            onArchive={() => archiveEnvironment(env.id)}
            isDragging={draggedId === env.id}
            isDropTarget={dropTargetId === env.id}
            dropPosition={dropTargetId === env.id ? dropPosition : null}
            onDragStart={() => handleDragStart(env.id)}
            onDragOver={(e) => handleDragOver(e, env.id)}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            draggable={!isSearching && editingName !== env.id}
          />
        ))}
        {filtered.length === 0 && !sidebarSearch.trim() && archivedEnvironments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Layers size={20} className="text-text-muted mb-2" />
            <p className="text-xs text-text-muted">No environments yet</p>
          </div>
        )}
        {filtered.length === 0 && sidebarSearch.trim() && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-xs text-text-muted">No matches</p>
          </div>
        )}

        {archivedEnvironments.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/60">
            <button
              onClick={() => setArchiveExpanded(!archiveExpanded)}
              className="flex items-center gap-1.5 w-full px-3 py-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider hover:text-text-secondary transition-colors"
            >
              {archiveExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              <Archive size={10} />
              Archive ({archivedEnvironments.length})
            </button>
            {archiveExpanded && (
              <div className="space-y-0.5 mt-1">
                {archivedEnvironments.map(env => (
                  <ArchivedEnvItem
                    key={env.id}
                    env={env}
                    isSelected={env.id === selectedEnvId}
                    onSelect={() => setSelectedEnvId(env.id)}
                    onRestore={() => unarchiveEnvironment(env.id)}
                    onDelete={() => deleteEnvironment(env.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export function EnvironmentsMain() {
  const {
    environments, archivedEnvironments, activeEnvironmentId, createEnvironment,
    addVariable, updateVariable, deleteVariable,
    getEnvironmentVariables, setActiveEnvironment,
  } = useEnvironmentStore();
  const activeWorkspaceId = useCollectionStore((s) => s.activeWorkspaceId);

  const selectedEnvId = useEnvironmentStore((s) => s.selectedEnvironmentId);
  const setSelectedEnvId = useEnvironmentStore((s) => s.setSelectedEnvironmentId);

  const selectedEnv = [...environments, ...archivedEnvironments].find((e) => e.id === selectedEnvId);
  const variables = selectedEnvId ? getEnvironmentVariables(selectedEnvId) : [];

  const handleCreate = async () => {
    if (!activeWorkspaceId) return;
    const env = await createEnvironment(activeWorkspaceId, 'New Environment');
    setSelectedEnvId(env.id);
  };

  const handleCreateTemplate = async () => {
    if (!activeWorkspaceId) return;
    const env = await createEnvironment(activeWorkspaceId, 'Development');
    setSelectedEnvId(env.id);
    await addVariable(env.id, 'base_url', 'https://api.example.com');
    await addVariable(env.id, 'api_key', '', undefined, true);
    await addVariable(env.id, 'token', '', undefined, true);
  };

  const handleAddVariable = async () => {
    if (selectedEnvId) {
      await addVariable(selectedEnvId, '', '');
    }
  };

  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const { renameEnvironment } = useEnvironmentStore();

  return (
    <div className="h-full overflow-y-auto">
      {selectedEnv ? (
        <div className="p-5 pb-2">
          {/* Row 1: Environment name (like request/workflow) */}
          <div className="flex items-center gap-2 mb-2 min-w-0">
            <Layers size={16} className="text-text-muted shrink-0" />
            <div className="flex-1 min-w-0">
              {editingName ? (
                <input
                  ref={nameInputRef}
                  type="text"
                  value={selectedEnv.name}
                  onChange={(e) => renameEnvironment(selectedEnv.id, e.target.value)}
                  onBlur={() => setEditingName(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false);
                  }}
                  placeholder="Environment name"
                  className="w-full px-1.5 py-0.5 text-sm font-semibold text-text-primary bg-bg-tertiary border border-accent/50 rounded-md focus:outline-none focus:border-accent"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => {
                    setEditingName(true);
                    setTimeout(() => nameInputRef.current?.select(), 10);
                  }}
                  className="group flex items-center gap-1 text-sm font-semibold text-text-primary hover:text-accent truncate max-w-full transition-colors"
                  title="Click to rename"
                >
                  <span className="truncate">{selectedEnv.name}</span>
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Active/Set Active on left, variable count + Add variable on right (like requests) */}
          <div className="flex items-center gap-2 mb-3">
            {selectedEnv.id === activeEnvironmentId ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium bg-success/10 border-success/20 text-success shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-success" />
                Active
              </span>
            ) : activeWorkspaceId ? (
              <button
                onClick={() => setActiveEnvironment(activeWorkspaceId, selectedEnv.id)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium bg-bg-tertiary border-border text-text-muted hover:bg-success/10 hover:border-success/20 hover:text-success transition-all shrink-0"
              >
                <Check size={12} />
                Set Active
              </button>
            ) : null}

            <div className="flex-1" />

            <span className="text-xs text-text-muted shrink-0">
              {variables.length} variable{variables.length !== 1 ? 's' : ''}
            </span>

            <button
              onClick={handleAddVariable}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-white font-medium text-sm transition-all shrink-0 bg-accent hover:bg-accent-hover"
            >
              <Plus size={15} />
              Add variable
            </button>
          </div>

          <div className="mt-4 border-t border-border pt-3">
            <div className="space-y-2">
              <div className="rounded-lg border border-border overflow-hidden bg-bg-secondary">
                <div className="flex items-center gap-2 px-3 py-2 bg-bg-tertiary/50 border-b border-border/50">
                  <Variable size={12} className="text-text-muted" />
                  <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Variables</span>
                  {variables.length > 0 && (
                    <span className="text-[9px] text-text-muted/50 font-mono">{variables.length}</span>
                  )}
                </div>
                <div className="grid grid-cols-[1fr_1fr_28px_28px] gap-0 border-b border-border/50 bg-bg-tertiary/30">
                  <div className="px-3 py-1 text-[10px] text-text-muted/60 uppercase tracking-wider font-semibold">Key</div>
                  <div className="px-3 py-1 text-[10px] text-text-muted/60 uppercase tracking-wider font-semibold border-l border-border/50">Value</div>
                  <div className="flex items-center justify-center border-l border-border/50">
                    <Eye size={10} className="text-text-muted/40" />
                  </div>
                  <div />
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
                  <div className="px-3 py-4 text-center">
                    <p className="text-[11px] text-text-muted/50">
                      No variables yet — use <code className="px-1 py-0.5 rounded bg-bg-tertiary font-mono text-accent/70 text-[10px]">{'{{key}}'}</code> in requests
                    </p>
                  </div>
                )}
                <div className="border-t border-border/50">
                  <button
                    onClick={handleAddVariable}
                    className="flex items-center gap-1.5 w-full px-3 py-2 text-[11px] text-text-muted hover:text-text-primary hover:bg-bg-hover/50 transition-colors"
                  >
                    <Plus size={12} />
                    <span>Add variable</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="w-full max-w-md px-8">
            <div className="flex flex-col items-center mb-6">
              <div className="w-10 h-10 rounded-xl bg-bg-secondary border border-border/60 flex items-center justify-center mb-3">
                <Layers size={18} className="text-text-muted" />
              </div>
              <h3 className="text-base font-semibold text-text-primary mb-1">Environments</h3>
              <p className="text-[11px] text-text-muted/70 text-center">
                Manage variables like API keys and base URLs across dev, staging, and production
              </p>
            </div>

            {activeWorkspaceId && (
              <>
                <button
                  onClick={() => handleCreate()}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-bg-secondary border border-border hover:border-accent/30 hover:bg-bg-hover transition-all text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent/10 group-hover:bg-accent/15 flex items-center justify-center shrink-0 transition-colors">
                    <Plus size={14} className="text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary">Create environment</p>
                    <p className="text-[10px] text-text-muted/60 mt-0.5">Start with a blank environment and add variables</p>
                  </div>
                </button>

                <button
                  onClick={() => handleCreateTemplate()}
                  className="w-full flex items-center gap-3 px-4 py-3 mt-2 rounded-xl bg-bg-secondary border border-border hover:border-accent/30 hover:bg-bg-hover transition-all text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-bg-tertiary/60 group-hover:bg-accent/10 flex items-center justify-center shrink-0 transition-colors">
                    <FileText size={14} className="text-text-muted/50 group-hover:text-accent/70 transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary">Quick start template</p>
                    <p className="text-[10px] text-text-muted/60 mt-0.5">Create with base_url, api_key, and token variables</p>
                  </div>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function EnvironmentsView() {
  return (
    <div className="flex-1 flex overflow-hidden h-full">
      <div className="w-64 h-full border-r border-border bg-bg-secondary flex flex-col shrink-0">
        <EnvironmentsSidebar />
      </div>
      <div className="flex-1 overflow-y-auto">
        <EnvironmentsMain />
      </div>
    </div>
  );
}

function ArchivedEnvItem({ env, isSelected, onSelect, onRestore, onDelete }: {
  env: Environment;
  isSelected: boolean;
  onSelect: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div className="relative group">
      <button
        onClick={onSelect}
        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
          isSelected ? 'bg-accent/10 text-text-primary' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-text-muted/20" />
          <span className="text-xs font-medium truncate opacity-60">{env.name}</span>
        </div>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
        className={`absolute right-1.5 top-1.5 p-1 rounded-md transition-all ${
          menuOpen ? 'opacity-100 bg-bg-hover' : 'opacity-0 group-hover:opacity-100 hover:bg-bg-hover'
        }`}
      >
        <MoreHorizontal size={12} className="text-text-muted" />
      </button>
      {menuOpen && (
        <div ref={menuRef} className="absolute right-0 top-full mt-1 z-50 w-40 py-1 rounded-lg bg-bg-secondary border border-border shadow-xl">
          <button
            onClick={async (e) => { e.stopPropagation(); await onRestore(); setMenuOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
          >
            <ArchiveRestore size={12} /> Restore
          </button>
          <button
            onClick={async (e) => { e.stopPropagation(); await onDelete(); setMenuOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={12} /> Delete permanently
          </button>
        </div>
      )}
    </div>
  );
}

function EnvListItem({ env, isSelected, isActive, isEditing, editNameValue, onSelect, onStartRename, onEditNameChange, onCommitRename, onCancelRename, onDuplicate, onArchive, isDragging, isDropTarget, dropPosition, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd, draggable }: {
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
  onDuplicate: () => void;
  onArchive: () => void;
  isDragging: boolean;
  isDropTarget: boolean;
  dropPosition: 'above' | 'below' | null;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  draggable: boolean;
}) {
  const isAiCreated = useUiStore(s => s.aiCreatedItems.includes(env.id));
  const clearAiCreated = useUiStore(s => s.clearAiCreated);
  const varCount = useEnvironmentStore(s => (s.variables.get(env.id) || []).length);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleSelect = () => {
    if (isAiCreated) clearAiCreated(env.id);
    onSelect();
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/ruke-env-id', env.id);
    e.dataTransfer.setData('application/ruke-context', JSON.stringify({ type: 'environment', id: env.id, label: env.name, meta: subtitle }));
    e.dataTransfer.effectAllowed = 'move';
    onDragStart();
  };

  const subtitle = varCount > 0 ? `${varCount} variable${varCount !== 1 ? 's' : ''}` : 'No variables';

  return (
    <div
      className={`relative group ${isDragging ? 'opacity-30' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {isDropTarget && dropPosition === 'above' && (
        <div className="absolute top-0 left-2 right-2 h-0.5 bg-accent rounded-full z-10" />
      )}
      <button
        onClick={handleSelect}
        draggable={draggable}
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
          isSelected
            ? 'bg-accent/10 text-text-primary'
            : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
        }`}
      >
        <div className="flex items-center gap-2">
          {isAiCreated ? (
            <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_4px_rgba(59,130,246,0.6)] animate-pulse shrink-0" />
          ) : (
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-success' : 'bg-text-muted/30'}`} />
          )}
          <div className="flex-1 min-w-0">
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
                className="w-full text-xs bg-bg-tertiary border border-accent px-1.5 py-0.5 rounded text-text-primary focus:outline-none"
              />
            ) : (
              <>
                <span className="text-xs font-medium truncate block">{env.name}</span>
                <p className="text-[10px] text-text-muted truncate mt-0.5">{subtitle}</p>
              </>
            )}
          </div>
        </div>
      </button>
      {isDropTarget && dropPosition === 'below' && (
        <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full z-10" />
      )}
      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
        className={`absolute right-1.5 top-1.5 p-1 rounded-md transition-all ${
          menuOpen
            ? 'opacity-100 bg-bg-hover'
            : 'opacity-0 group-hover:opacity-100 hover:bg-bg-hover'
        }`}
      >
        <MoreHorizontal size={12} className="text-text-muted" />
      </button>
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1 z-50 w-36 py-1 rounded-lg bg-bg-secondary border border-border shadow-xl"
        >
          <button
            onClick={(e) => { e.stopPropagation(); onStartRename(); setMenuOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
          >
            <Pencil size={12} /> Rename
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate(); setMenuOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
          >
            <Copy size={12} /> Duplicate
          </button>
          <button
            onClick={async (e) => { e.stopPropagation(); await onArchive(); setMenuOpen(false); }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
          >
            <Archive size={12} /> Archive
          </button>
        </div>
      )}
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
    <div className="group grid grid-cols-[1fr_1fr_28px_28px] gap-0 items-stretch border-b border-border/50 last:border-b-0 transition-colors hover:bg-bg-hover/30">
      <div className="relative">
        <input
          type="text"
          value={v.key}
          onChange={(e) => onUpdate({ key: e.target.value })}
          placeholder="variable_name"
          spellCheck={false}
          className="w-full px-3 py-2 text-xs font-mono text-text-primary bg-transparent border-none outline-none placeholder:text-text-muted/30"
        />
      </div>
      <div className="relative border-l border-border/50">
        <input
          type={v.isSecret && !showSecret ? 'password' : 'text'}
          value={v.value}
          onChange={(e) => onUpdate({ value: e.target.value })}
          placeholder="value"
          spellCheck={false}
          className="w-full px-3 py-2 text-xs font-mono text-text-primary bg-transparent border-none outline-none placeholder:text-text-muted/30"
        />
      </div>
      <div className="flex items-center justify-center border-l border-border/50">
        {v.isSecret ? (
          <button
            onClick={() => setShowSecret(!showSecret)}
            className="p-1 rounded text-accent/60 hover:text-accent transition-colors"
          >
            {showSecret ? <EyeOff size={11} /> : <Eye size={11} />}
          </button>
        ) : (
          <input
            type="checkbox"
            checked={v.isSecret}
            onChange={(e) => onUpdate({ isSecret: e.target.checked })}
            className="w-3.5 h-3.5 rounded border-border accent-accent cursor-pointer"
          />
        )}
      </div>
      <div className="flex items-center justify-center">
        <button
          onClick={onDelete}
          className="p-1 rounded text-text-muted/20 hover:text-error hover:bg-error/10 opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
