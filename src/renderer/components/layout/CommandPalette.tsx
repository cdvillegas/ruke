import { useState, useEffect, useRef } from 'react';
import { useUiStore } from '../../stores/uiStore';
import { useRequestStore } from '../../stores/requestStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import {
  Search, Send, Plus, Home, Plug,
  Settings, Globe, Play,
} from 'lucide-react';
import { METHOD_COLORS } from '@shared/constants';

interface CommandItem {
  id: string;
  label: string;
  detail?: string;
  icon: typeof Search;
  action: () => void;
  category: string;
}

export function CommandPalette() {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { setCommandPaletteOpen, setActiveView } = useUiStore();
  const { newRequest } = useRequestStore();
  const connections = useConnectionStore((s) => s.connections);

  const close = () => setCommandPaletteOpen(false);

  const commands: CommandItem[] = [
    { id: 'home', label: 'Go Home', icon: Home, action: () => { setActiveView('home'); close(); }, category: 'Navigation' },
    { id: 'new-request', label: 'New Request', icon: Plus, action: () => { newRequest(); setActiveView('request'); close(); }, category: 'Request' },
    { id: 'send', label: 'Send Current Request', icon: Send, action: () => {
      const { sendRequest } = useRequestStore.getState();
      const vars = useEnvironmentStore.getState().resolveVariables();
      sendRequest(vars);
      close();
    }, category: 'Request' },
    { id: 'connections', label: 'View Connected APIs', icon: Plug, action: () => { setActiveView('connections'); close(); }, category: 'Navigation' },
    { id: 'settings', label: 'Settings', icon: Settings, action: () => { setActiveView('settings'); close(); }, category: 'Navigation' },
    ...connections.flatMap(conn =>
      conn.endpoints.slice(0, 10).map(ep => ({
        id: `${conn.id}-${ep.id}`,
        label: `${ep.method} ${ep.path}`,
        detail: conn.name,
        icon: Play,
        action: () => {
          const store = useRequestStore.getState();
          store.updateActiveRequest({
            method: ep.method,
            url: conn.baseUrl + ep.path,
            name: ep.summary || `${ep.method} ${ep.path}`,
          });
          setActiveView('request');
          close();
        },
        category: conn.name,
      }))
    ),
  ];

  const filtered = query
    ? commands.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.category.toLowerCase().includes(query.toLowerCase()) ||
        c.detail?.toLowerCase().includes(query.toLowerCase())
      )
    : commands.slice(0, 15);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setSelectedIndex(0); }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[selectedIndex]?.action(); }
  };

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
            placeholder="Search commands, endpoints..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-bg-tertiary border border-border rounded text-text-muted">ESC</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onClick={cmd.action}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-xs transition-colors ${
                i === selectedIndex ? 'bg-accent/15 text-text-primary' : 'text-text-secondary hover:bg-bg-hover'
              }`}
            >
              <div className="flex items-center gap-3">
                <cmd.icon size={14} />
                <span>{cmd.label}</span>
              </div>
              {cmd.detail && <span className="text-[10px] text-text-muted">{cmd.detail}</span>}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-text-muted text-center py-6">No results</p>
          )}
        </div>
      </div>
    </div>
  );
}
