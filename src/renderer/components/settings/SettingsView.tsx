import { useEffect, useRef, useState } from 'react';
import { useUiStore } from '../../stores/uiStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useRequestStore } from '../../stores/requestStore';
import { Settings, Lock, Unlock, Moon, Sun, Info, Plug, Eye, EyeOff, Pencil, Trash2, Check, AlertTriangle, History, Unplug } from 'lucide-react';
import { ConnectionIcon } from '../connections/ConnectionsView';

const AI_KEY_STORAGE = 'ruke:ai_key';

function maskKey(key: string): string {
  if (key.length <= 8) return '\u2022'.repeat(key.length);
  return key.slice(0, 3) + '\u2022'.repeat(Math.min(key.length - 7, 24)) + key.slice(-4);
}

type KeyMode = 'empty' | 'locked' | 'editing';

function ApiKeyCard() {
  const [storedKey, setStoredKey] = useState(() => localStorage.getItem(AI_KEY_STORAGE) || '');
  const [mode, setMode] = useState<KeyMode>(() => storedKey ? 'locked' : 'empty');
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [flash, setFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const key = localStorage.getItem(AI_KEY_STORAGE) || '';
    setStoredKey(key);
    setMode(key ? 'locked' : 'empty');
  }, []);

  const canSave = draft.trim().length >= 10;

  async function handleSave() {
    if (!canSave) return;
    const key = draft.trim();
    await window.ruke.ai.setKey(key);
    setStoredKey(key);
    setDraft('');
    setRevealed(false);
    setMode('locked');
    setFlash(true);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 2500);
  }

  function handleRemove() {
    localStorage.removeItem(AI_KEY_STORAGE);
    window.ruke.ai.setKey('');
    setStoredKey('');
    setDraft('');
    setRevealed(false);
    setMode('empty');
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleEdit() {
    setDraft('');
    setRevealed(false);
    setMode('editing');
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  const showInput = mode === 'empty' || mode === 'editing';

  return (
    <div className="p-4 rounded-2xl bg-bg-secondary border border-border space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        {mode === 'locked' ? (
          <Lock size={14} className="text-success mt-0.5" />
        ) : (
          <Unlock size={14} className="text-accent mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-primary">OpenAI API Key</p>
          <p className="text-[10px] text-text-muted mt-0.5">
            {mode === 'locked'
              ? 'Key configured and stored locally'
              : mode === 'editing'
                ? 'Enter a new key to replace the current one'
                : 'Required for AI features. Stored locally only.'}
          </p>
        </div>
      </div>

      {/* Locked: show masked key + actions */}
      {mode === 'locked' && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 text-xs font-mono rounded-xl bg-bg-tertiary border border-border text-text-secondary overflow-hidden text-ellipsis whitespace-nowrap select-none">
              {revealed ? storedKey : maskKey(storedKey)}
            </div>
            <button
              onClick={() => setRevealed(r => !r)}
              className="p-2 rounded-lg bg-bg-tertiary border border-border text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              title={revealed ? 'Hide key' : 'Reveal key'}
            >
              {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-lg bg-bg-tertiary border border-border text-text-secondary hover:text-text-primary hover:border-text-muted transition-colors"
            >
              <Pencil size={11} />
              Change key
            </button>
            <button
              onClick={handleRemove}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-colors"
            >
              <Trash2 size={11} />
              Remove
            </button>
          </div>
        </>
      )}

      {/* Input: empty or editing */}
      {showInput && (
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape' && mode === 'editing') { setDraft(''); setMode('locked'); }
            }}
            placeholder="sk-..."
            spellCheck={false}
            autoComplete="off"
            autoFocus
            className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="px-4 py-1.5 text-xs rounded-xl font-medium bg-accent hover:bg-accent-hover text-white transition-colors disabled:opacity-40 disabled:cursor-default"
            >
              Save key
            </button>
            {mode === 'editing' && (
              <button
                onClick={() => { setDraft(''); setMode('locked'); }}
                className="px-3 py-1.5 text-xs rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Flash confirmation */}
      {flash && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-success/10 border border-success/20 text-success text-xs font-medium animate-in fade-in slide-in-from-top-1 duration-200">
          <Check size={12} />
          API key saved securely
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-border">
        <Lock size={9} className="text-text-muted" />
        <span className="text-[10px] text-text-muted">Stored locally in your browser. Never sent to our servers.</span>
      </div>
    </div>
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

  function handleClearApiKey() {
    localStorage.removeItem('ruke:ai_key');
    window.ruke.ai.setKey('');
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
    localStorage.removeItem('ruke:ai_key');
    window.ruke.ai.setKey('');
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
          onClick={handleClearApiKey}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-xs rounded-xl hover:bg-bg-hover text-text-secondary transition-colors text-left"
        >
          <Lock size={13} className="text-text-muted shrink-0" />
          <div className="flex-1">
            <span className="text-text-primary">Remove API key</span>
            <span className="block text-[10px] text-text-muted">Deletes the stored OpenAI key</span>
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

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-lg mx-auto p-8 space-y-8">
        <div className="flex items-center gap-3">
          <Settings size={18} className="text-accent" />
          <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
        </div>

        {/* AI */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">AI Assistant</h3>
          <ApiKeyCard />
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
