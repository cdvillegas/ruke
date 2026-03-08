import { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Check, ExternalLink, Trash2, Copy } from 'lucide-react';
import {
  type ManagedProvider,
  PROVIDER_META,
  getProviderKey,
  setProviderKey,
  removeProviderKey,
  activateProvider,
  getConfiguredProviders,
} from '../../lib/agentRunner';

function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••';
  return key.slice(0, 4) + '••••••••' + key.slice(-4);
}

export const KEY_URLS: Record<ManagedProvider, string> = {
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
  google: 'https://aistudio.google.com/apikey',
};

interface ProviderKeyCardProps {
  provider: ManagedProvider;
  onKeyChange?: () => void;
}

export function ProviderKeyCard({ provider, onKeyChange }: ProviderKeyCardProps) {
  const meta = PROVIDER_META[provider];
  const [storedKey, setStoredKey] = useState(() => getProviderKey(provider) || '');
  const [connected, setConnected] = useState(() => !!storedKey);
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const key = getProviderKey(provider) || '';
    setStoredKey(key);
    setConnected(!!key);
    setRevealed(false);
    setDraft('');
    setCopied(false);
  }, [provider]);

  useEffect(() => {
    if (!connected) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [provider, connected]);

  const canSave = draft.trim().length >= 10;

  function handleSave() {
    if (!canSave) return;
    const key = draft.trim();
    setProviderKey(provider, key);
    if (getConfiguredProviders().length === 1) activateProvider(provider);
    setStoredKey(key);
    setDraft('');
    setRevealed(false);
    setConnected(true);
    onKeyChange?.();
  }

  function handleRemove() {
    removeProviderKey(provider);
    setStoredKey('');
    setDraft('');
    setRevealed(false);
    setCopied(false);
    setConnected(false);
    onKeyChange?.();
  }

  function handleCopy() {
    navigator.clipboard.writeText(storedKey);
    setCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1500);
  }

  const inputStyles = 'flex-1 h-10 px-3.5 text-[13px] font-mono rounded-xl bg-bg-tertiary border border-border text-text-secondary tracking-wide transition-colors focus:outline-none';
  const btnStyles = 'h-10 w-10 flex items-center justify-center rounded-xl transition-colors shrink-0';

  if (connected) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type={revealed ? 'text' : 'password'}
            value={storedKey}
            readOnly
            tabIndex={-1}
            className={`${inputStyles} w-full pr-16 cursor-default`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {revealed && (
              <button
                onClick={handleCopy}
                className="text-text-muted hover:text-text-primary transition-colors"
                title={copied ? 'Copied!' : 'Copy key'}
              >
                {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              </button>
            )}
            <button
              onClick={() => setRevealed(r => !r)}
              className="text-text-muted hover:text-text-primary transition-colors"
              title={revealed ? 'Hide' : 'Reveal'}
            >
              {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </span>
        </div>
        <button
          onClick={handleRemove}
          className={`${btnStyles} bg-bg-tertiary border border-border text-text-muted hover:text-error hover:border-error/30`}
          title="Remove key"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="password"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
        placeholder={meta.placeholder}
        spellCheck={false}
        autoComplete="off"
        className={`${inputStyles} w-full placeholder:text-text-muted/50 focus:border-accent/40`}
      />
      <button
        onClick={handleSave}
        disabled={!canSave}
        className={`${btnStyles} ${
          canSave
            ? 'bg-accent text-white hover:bg-accent-hover'
            : 'bg-bg-tertiary border border-border text-text-muted/40 cursor-default'
        }`}
        title="Save key"
      >
        <Check size={14} strokeWidth={2.5} />
      </button>
    </div>
  );
}
