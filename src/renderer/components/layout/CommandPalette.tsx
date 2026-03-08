import { useState, useEffect, useRef, useMemo } from 'react';
import { useUiStore } from '../../stores/uiStore';
import { useRequestStore } from '../../stores/requestStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import {
  Search, Send, Plus, Sparkles, Plug,
  Settings, Play, FileText, Layers, FolderOpen,
} from 'lucide-react';
import { useCollectionStore } from '../../stores/collectionStore';
import { METHOD_COLORS } from '@shared/constants';

interface CommandItem {
  id: string;
  label: string;
  detail?: string;
  icon: typeof Search;
  iconColor?: string;
  action: () => void;
  category: string;
  searchOnly?: boolean;
}

export function CommandPalette() {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const newRequest = useRequestStore((s) => s.newRequest);
  const selectRequest = useRequestStore((s) => s.selectRequest);
  const uncollectedRequests = useRequestStore((s) => s.uncollectedRequests);
  const connections = useConnectionStore((s) => s.connections);
  const { environments, activeEnvironmentId, setActiveEnvironment, createEnvironment } = useEnvironmentStore();
  const collections = useCollectionStore((s) => s.collections);
  const collectionRequests = useCollectionStore((s) => s.requests);
  const activeWorkspaceId = useCollectionStore((s) => s.activeWorkspaceId);
  const toggleExpanded = useCollectionStore((s) => s.toggleExpanded);

  const close = () => setCommandPaletteOpen(false);

  const commands = useMemo((): CommandItem[] => {
    const items: CommandItem[] = [
      { id: 'send', label: 'Send Current Request', icon: Send, action: () => {
        const { sendRequest } = useRequestStore.getState();
        const vars = useEnvironmentStore.getState().resolveVariables();
        sendRequest(vars);
        close();
      }, category: 'Actions' },
      { id: 'new-request', label: 'New Request', icon: Plus, action: () => { newRequest(); setActiveView('requests'); close(); }, category: 'Actions' },
      { id: 'ai-panel', label: 'Toggle AI Assist', icon: Sparkles, action: () => { useUiStore.getState().toggleAiPanel(); close(); }, category: 'Actions' },
      { id: 'new-env', label: 'Create Environment', icon: Plus, action: async () => {
        if (activeWorkspaceId) {
          await createEnvironment(activeWorkspaceId, 'New Environment');
          setActiveView('environments');
        }
        close();
      }, category: 'Actions' },
      { id: 'nav-requests', label: 'Requests', icon: FileText, action: () => { setActiveView('requests'); close(); }, category: 'Go to' },
      { id: 'nav-connections', label: 'Connected APIs', icon: Plug, action: () => { setActiveView('connections'); close(); }, category: 'Go to' },
      { id: 'nav-environments', label: 'Environments', icon: Layers, action: () => { setActiveView('environments'); close(); }, category: 'Go to' },
      { id: 'nav-settings', label: 'Settings', icon: Settings, action: () => { setActiveView('settings'); close(); }, category: 'Go to' },
    ];

    for (const req of uncollectedRequests) {
      items.push({
        id: `req-${req.id}`,
        label: req.name || 'Untitled',
        detail: req.url || req.method,
        icon: FileText,
        iconColor: METHOD_COLORS[req.method],
        action: () => { selectRequest(req); setActiveView('requests'); close(); },
        category: 'Requests',
        searchOnly: true,
      });
    }

    for (const col of collections) {
      const colRequests = collectionRequests[col.id] || [];
      items.push({
        id: `col-${col.id}`,
        label: col.name,
        detail: `${colRequests.length} request${colRequests.length !== 1 ? 's' : ''}`,
        icon: FolderOpen,
        action: () => { toggleExpanded(col.id); setActiveView('requests'); close(); },
        category: 'Collections',
        searchOnly: true,
      });

      for (const req of colRequests) {
        items.push({
          id: `col-req-${req.id}`,
          label: req.name || 'Untitled',
          detail: col.name,
          icon: FileText,
          iconColor: METHOD_COLORS[req.method],
          action: () => { selectRequest(req); setActiveView('requests'); close(); },
          category: 'Requests',
          searchOnly: true,
        });
      }
    }

    for (const env of environments) {
      items.push({
        id: `env-${env.id}`,
        label: `Switch to ${env.name}`,
        detail: env.id === activeEnvironmentId ? 'Active' : undefined,
        icon: Layers,
        action: () => {
          if (activeWorkspaceId) setActiveEnvironment(activeWorkspaceId, env.id);
          close();
        },
        category: 'Environments',
        searchOnly: true,
      });
    }

    for (const conn of connections) {
      items.push({
        id: `api-${conn.id}`,
        label: conn.name,
        detail: `${conn.endpoints.length} endpoint${conn.endpoints.length !== 1 ? 's' : ''}`,
        icon: Plug,
        action: () => { setActiveView('connections'); close(); },
        category: 'APIs',
        searchOnly: true,
      });

      for (const ep of conn.endpoints) {
        items.push({
          id: `ep-${conn.id}-${ep.id}`,
          label: `${ep.method} ${ep.path}`,
          detail: conn.name,
          icon: Play,
          iconColor: METHOD_COLORS[ep.method],
          action: () => {
            const store = useRequestStore.getState();
            store.updateActiveRequest({
              method: ep.method,
              url: conn.baseUrl + ep.path,
              name: ep.summary || `${ep.method} ${ep.path}`,
            });
            setActiveView('requests');
            close();
          },
          category: 'Endpoints',
          searchOnly: true,
        });
      }
    }

    return items;
  }, [uncollectedRequests, collections, collectionRequests, environments, connections, activeEnvironmentId, activeWorkspaceId]);

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return commands.filter(c => !c.searchOnly).slice(0, 15);
    }
    const q = query.toLowerCase();
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      c.detail?.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [query, commands]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setSelectedIndex(0); }, [query]);

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[selectedIndex]?.action(); }
  };

  const grouped = useMemo(() => {
    const groups: { label: string; items: (CommandItem & { idx: number })[] }[] = [];
    const map = new Map<string, (CommandItem & { idx: number })[]>();
    filtered.forEach((cmd, idx) => {
      if (!map.has(cmd.category)) map.set(cmd.category, []);
      map.get(cmd.category)!.push({ ...cmd, idx });
    });
    for (const [label, items] of map) {
      groups.push({ label, items });
    }
    return groups;
  }, [filtered]);

  let flatIdx = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]" onClick={close}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-[500px] bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <Search size={15} className="text-text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, requests, APIs, environments..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-bg-tertiary border border-border rounded text-text-muted">ESC</kbd>
        </div>
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {grouped.map(group => (
            <div key={group.label}>
              <p className="text-[9px] text-text-muted/50 font-semibold uppercase tracking-wider px-4 pt-2 pb-1">
                {group.label}
              </p>
              {group.items.map(cmd => {
                flatIdx++;
                const i = flatIdx;
                return (
                  <button
                    key={cmd.id}
                    onClick={cmd.action}
                    className={`w-full flex items-center justify-between px-4 py-2 text-xs transition-colors ${
                      i === selectedIndex ? 'bg-accent/15 text-text-primary' : 'text-text-secondary hover:bg-bg-hover'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <cmd.icon size={14} className="shrink-0" style={cmd.iconColor ? { color: cmd.iconColor } : undefined} />
                      <span className="truncate">{cmd.label}</span>
                    </div>
                    {cmd.detail && <span className="text-[10px] text-text-muted shrink-0 ml-3">{cmd.detail}</span>}
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-text-muted text-center py-6">No results</p>
          )}
        </div>
      </div>
    </div>
  );
}
