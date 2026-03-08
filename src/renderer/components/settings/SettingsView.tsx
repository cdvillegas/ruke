import { useRef, useState } from 'react';
import { useUiStore } from '../../stores/uiStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useRequestStore } from '../../stores/requestStore';
import { Settings, Lock, Moon, Sun, Info, Plug, Check, AlertTriangle, History, Unplug, Globe, Timer, ExternalLink } from 'lucide-react';
import { ConnectionIcon } from '../connections/ConnectionsView';
import { ProviderKeyCard, KEY_URLS } from '../shared/ProviderKeyCard';
import { MANAGED_PROVIDERS, PROVIDER_META, removeProviderKey, getProviderKey, type ManagedProvider } from '../../lib/agentRunner';
const PROXY_STORAGE = 'ruke:proxy';
const TIMEOUT_STORAGE = 'ruke:default_timeout';

function ProxySettings() {
  const [proxy, setProxy] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PROXY_STORAGE) || '{}'); } catch { return {}; }
  });
  const [enabled, setEnabled] = useState(!!proxy.host);

  const save = (updates: Record<string, any>) => {
    const next = { ...proxy, ...updates };
    setProxy(next);
    localStorage.setItem(PROXY_STORAGE, JSON.stringify(next));
  };

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Proxy</h3>
      <div className="p-4 rounded-2xl bg-bg-secondary border border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe size={14} className="text-accent" />
            <span className="text-sm text-text-primary">HTTP Proxy</span>
          </div>
          <button
            onClick={() => {
              const next = !enabled;
              setEnabled(next);
              if (!next) {
                localStorage.removeItem(PROXY_STORAGE);
                setProxy({});
              }
            }}
            className={`relative w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-accent' : 'bg-bg-tertiary border border-border'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {enabled && (
          <div className="space-y-2 pt-1">
            <div className="flex gap-2">
              <input
                value={proxy.host || ''}
                onChange={(e) => save({ host: e.target.value })}
                placeholder="Proxy host (e.g. 127.0.0.1)"
                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent font-mono"
              />
              <input
                value={proxy.port || ''}
                onChange={(e) => save({ port: e.target.value })}
                placeholder="Port"
                className="w-20 px-3 py-1.5 text-xs rounded-lg bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent font-mono"
              />
            </div>
            <div className="flex gap-2">
              <input
                value={proxy.username || ''}
                onChange={(e) => save({ username: e.target.value })}
                placeholder="Username (optional)"
                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent font-mono"
              />
              <input
                type="password"
                value={proxy.password || ''}
                onChange={(e) => save({ password: e.target.value })}
                placeholder="Password (optional)"
                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent font-mono"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function RequestDefaults() {
  const [timeout, setTimeout_] = useState(() => {
    return localStorage.getItem(TIMEOUT_STORAGE) || '30000';
  });

  const saveTimeout = (v: string) => {
    setTimeout_(v);
    localStorage.setItem(TIMEOUT_STORAGE, v);
  };

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Request Defaults</h3>
      <div className="p-4 rounded-2xl bg-bg-secondary border border-border">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Timer size={14} className="text-accent" />
            <span className="text-sm text-text-primary">Timeout</span>
          </div>
          <input
            value={timeout}
            onChange={(e) => saveTimeout(e.target.value)}
            className="w-24 px-3 py-1.5 text-xs rounded-lg bg-bg-tertiary border border-border text-text-primary focus:outline-none focus:border-accent font-mono text-right"
          />
          <span className="text-xs text-text-muted">ms</span>
        </div>
      </div>
    </section>
  );
}

function ClearDataSection() {
  const resetOnboarding = useUiStore((s) => s.resetOnboarding);
  const connections = useConnectionStore((s) => s.connections);
  const deleteConnection = useConnectionStore((s) => s.deleteConnection);
  const clearHistory = useRequestStore((s) => s.clearHistory);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [cleared, setCleared] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function flash(label: string) {
    setCleared(label);
    clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setCleared(null), 2000);
  }

  async function handleClearHistory() {
    await clearHistory();
    flash('history');
  }

  function handleClearConnections() {
    const ids = connections.map(c => c.id);
    ids.forEach(id => deleteConnection(id));
    flash('connections');
  }

  function handleClearApiKeys() {
    for (const p of MANAGED_PROVIDERS) removeProviderKey(p);
    flash('apikey');
  }

  function handleClearAll() {
    if (!confirmingAll) {
      setConfirmingAll(true);
      clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmingAll(false), 4000);
      return;
    }
    const ids = connections.map(c => c.id);
    ids.forEach(id => deleteConnection(id));
    clearHistory();
    for (const p of MANAGED_PROVIDERS) removeProviderKey(p);
    resetOnboarding();
    window.location.reload();
  }

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Data</h3>
      <div className="p-4 rounded-2xl bg-bg-secondary border border-border space-y-2">
        <button
          onClick={handleClearHistory}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-xs rounded-xl hover:bg-bg-hover text-text-secondary transition-colors text-left"
        >
          <History size={13} className="text-text-muted shrink-0" />
          <div className="flex-1">
            <span className="text-text-primary">Clear request history</span>
            <span className="block text-[10px] text-text-muted">Removes all saved request/response history</span>
          </div>
          {cleared === 'history' && <Check size={13} className="text-success shrink-0" />}
        </button>

        <button
          onClick={handleClearConnections}
          disabled={connections.length === 0}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-xs rounded-xl hover:bg-bg-hover text-text-secondary transition-colors text-left disabled:opacity-40 disabled:cursor-default"
        >
          <Unplug size={13} className="text-text-muted shrink-0" />
          <div className="flex-1">
            <span className="text-text-primary">Clear all connections</span>
            <span className="block text-[10px] text-text-muted">{connections.length} connection{connections.length !== 1 ? 's' : ''} stored</span>
          </div>
          {cleared === 'connections' && <Check size={13} className="text-success shrink-0" />}
        </button>

        <button
          onClick={handleClearApiKeys}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-xs rounded-xl hover:bg-bg-hover text-text-secondary transition-colors text-left"
        >
          <Lock size={13} className="text-text-muted shrink-0" />
          <div className="flex-1">
            <span className="text-text-primary">Remove all AI keys</span>
            <span className="block text-[10px] text-text-muted">Deletes all stored provider keys</span>
          </div>
          {cleared === 'apikey' && <Check size={13} className="text-success shrink-0" />}
        </button>

        <div className="border-t border-border pt-2 mt-1">
          <button
            onClick={handleClearAll}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs rounded-xl transition-colors text-left ${
              confirmingAll
                ? 'bg-error/10 border border-error/20 text-error'
                : 'hover:bg-error/5 text-text-muted hover:text-error'
            }`}
          >
            <AlertTriangle size={13} className="shrink-0" />
            <div className="flex-1">
              <span>{confirmingAll ? 'Click again to confirm' : 'Clear all data and reset'}</span>
              {!confirmingAll && (
                <span className="block text-[10px] opacity-70">Removes everything and restarts onboarding</span>
              )}
            </div>
          </button>
        </div>
      </div>
    </section>
  );
}

export function SettingsView() {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const connections = useConnectionStore((s) => s.connections);
  const [aiTab, setAiTab] = useState<ManagedProvider>('openai');

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[560px] mx-auto p-8 space-y-8">
        <div className="flex items-center gap-3">
          <Settings size={18} className="text-accent" />
          <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
        </div>

        {/* AI Providers */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">AI Providers</h3>
          <div className="rounded-2xl bg-bg-secondary border border-border overflow-hidden">
            <div className="flex border-b border-border">
              {MANAGED_PROVIDERS.map((provider) => {
                const connected = !!getProviderKey(provider);
                const active = aiTab === provider;
                return (
                  <button
                    key={provider}
                    onClick={() => setAiTab(provider)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 text-xs font-medium transition-all relative ${
                      active ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {connected && (
                      <span className="w-4 h-4 rounded-full bg-success/15 flex items-center justify-center shrink-0">
                        <Check size={9} className="text-success" strokeWidth={3} />
                      </span>
                    )}
                    <span>{PROVIDER_META[provider].label}</span>
                    {active && (
                      <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-accent" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <p className="text-[13px] text-text-secondary tracking-tight">
                    {PROVIDER_META[aiTab].description}
                  </p>
                  {!!getProviderKey(aiTab) && (
                    <span className="flex items-center gap-1 text-[11px] text-success/80 font-medium">
                      <Check size={10} strokeWidth={2.5} /> Connected
                    </span>
                  )}
                </div>
                <a
                  href={KEY_URLS[aiTab]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md text-text-muted hover:text-accent border border-border hover:border-accent/30 transition-colors"
                >
                  {getProviderKey(aiTab) ? 'Dashboard' : 'Get a key'} <ExternalLink size={9} />
                </a>
              </div>
              <ProviderKeyCard key={aiTab} provider={aiTab} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-1">
            <Lock size={9} className="text-text-muted" />
            <span className="text-[10px] text-text-muted">Stored locally. Never sent to our servers.</span>
          </div>
        </section>

        {/* Appearance */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Appearance</h3>
          <div className="flex items-center justify-between p-4 rounded-2xl bg-bg-secondary border border-border">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? <Moon size={14} className="text-accent" /> : <Sun size={14} className="text-warning" />}
              <span className="text-sm text-text-primary">{theme === 'dark' ? 'Dark' : 'Light'} mode</span>
            </div>
            <button
              onClick={toggleTheme}
              className="px-3 py-1.5 text-xs rounded-lg bg-bg-tertiary hover:bg-bg-hover text-text-primary border border-border transition-colors"
            >
              Switch to {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </section>

        {/* Proxy */}
        <ProxySettings />

        {/* Request Defaults */}
        <RequestDefaults />

        {/* Connections Summary */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Connected APIs</h3>
          <div className="p-4 rounded-2xl bg-bg-secondary border border-border">
            <div className="flex items-center gap-3">
              <Plug size={14} className="text-accent" />
              <span className="text-sm text-text-primary">{connections.length} API{connections.length !== 1 ? 's' : ''} connected</span>
            </div>
            {connections.length > 0 && (
              <div className="mt-2 space-y-1">
                {connections.map(c => (
                  <div key={c.id} className="flex items-center gap-2 text-xs text-text-muted">
                    <ConnectionIcon conn={c} size="xs" />
                    <span>{c.name}</span>
                    <span className="text-text-muted">({c.endpoints.length} endpoints)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Data */}
        <ClearDataSection />

        {/* About */}
        <section className="space-y-3">
          <div className="p-4 rounded-2xl bg-bg-secondary border border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                <span className="text-white text-sm font-bold">R</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">Rüke</p>
                <p className="text-[10px] text-text-muted">v0.1.0</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <Info size={10} className="text-text-muted" />
              <span className="text-[10px] text-text-muted">Local-first. Your data stays on your machine.</span>
            </div>
          </div>
        </section>

        {/* Shortcuts */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Keyboard Shortcuts</h3>
          <div className="rounded-2xl border border-border overflow-hidden">
            {[
              { keys: '⌘ + Enter', action: 'Send Request' },
              { keys: '⌘ + K', action: 'Command Palette' },
            ].map((s, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-b-0">
                <span className="text-xs text-text-secondary">{s.action}</span>
                <kbd className="px-2 py-0.5 text-[10px] font-mono bg-bg-tertiary border border-border rounded text-text-muted">{s.keys}</kbd>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
