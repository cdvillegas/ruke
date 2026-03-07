import { useState } from 'react';
import { useUiStore } from '../../stores/uiStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { Settings, Key, Moon, Sun, Info, RotateCcw, Plug } from 'lucide-react';

export function SettingsView() {
  const { theme, toggleTheme, resetOnboarding } = useUiStore();
  const connections = useConnectionStore((s) => s.connections);
  const [apiKey, setApiKey] = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);

  const handleSaveApiKey = async () => {
    if (apiKey.trim()) {
      await window.ruke.ai.setKey(apiKey.trim());
      setApiKeySaved(true);
      setTimeout(() => setApiKeySaved(false), 2000);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-lg mx-auto p-8 space-y-8">
        <div className="flex items-center gap-3">
          <Settings size={18} className="text-accent" />
          <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
        </div>

        {/* AI */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">AI Assistant</h3>
          <div className="p-4 rounded-2xl bg-bg-secondary border border-border space-y-3">
            <div className="flex items-start gap-3">
              <Key size={14} className="text-accent mt-0.5" />
              <div>
                <p className="text-sm text-text-primary">OpenAI API Key</p>
                <p className="text-[10px] text-text-muted mt-0.5">Stored locally. Never sent to our servers.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="flex-1 px-3 py-2 text-xs font-mono rounded-xl bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              />
              <button
                onClick={handleSaveApiKey}
                className={`px-4 py-2 text-xs rounded-xl font-medium transition-colors ${
                  apiKeySaved ? 'bg-success text-white' : 'bg-accent hover:bg-accent-hover text-white'
                }`}
              >
                {apiKeySaved ? 'Saved!' : 'Save'}
              </button>
            </div>
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
                    <div className="w-2 h-2 rounded-full" style={{ background: c.iconColor }} />
                    <span>{c.name}</span>
                    <span className="text-text-muted">({c.endpoints.length} endpoints)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Data */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Data</h3>
          <button
            onClick={() => {
              resetOnboarding();
              window.location.reload();
            }}
            className="flex items-center gap-2 px-4 py-2.5 text-xs rounded-2xl bg-bg-secondary border border-border hover:bg-bg-hover text-text-secondary transition-colors"
          >
            <RotateCcw size={13} />
            <span>Reset onboarding</span>
          </button>
        </section>

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
