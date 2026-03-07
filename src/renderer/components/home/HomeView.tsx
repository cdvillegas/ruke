import { useState, useRef, useEffect, useMemo } from 'react';
import { useRequestStore } from '../../stores/requestStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useUiStore } from '../../stores/uiStore';
import {
  Sparkles, Send, Plug, Clock, Loader2, Globe,
  Plus, ChevronRight, Upload, Check, X, AlertCircle, Search,
} from 'lucide-react';
import { METHOD_COLORS } from '@shared/constants';
import type { HttpMethod, DiscoveryResult } from '@shared/types';

const PLACEHOLDERS = [
  'GET /users',
  'Test the login endpoint...',
  'https://api.example.com/v1/health',
  'POST /orders with a sample body',
  'Connect the OpenAI API',
  'Paste an OpenAPI spec URL...',
  'DELETE /users/42',
  'Latest Stripe and GitHub APIs',
];

type Phase = 'entering' | 'visible' | 'exiting';

function useWavePlaceholder(items: string[], displayMs = 3200) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('entering');
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimeouts = () => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
  };

  useEffect(() => {
    clearTimeouts();
    const text = items[index];
    const enterDuration = Math.min(text.length * 30, 600);

    if (phase === 'entering') {
      timeouts.current.push(setTimeout(() => setPhase('visible'), enterDuration + 100));
    } else if (phase === 'visible') {
      timeouts.current.push(setTimeout(() => setPhase('exiting'), displayMs));
    } else if (phase === 'exiting') {
      timeouts.current.push(setTimeout(() => {
        setIndex((i) => (i + 1) % items.length);
        setPhase('entering');
      }, 350));
    }
    return clearTimeouts;
  }, [index, phase, items, displayMs]);

  return { text: items[index], phase };
}

function WavePlaceholder({ text, phase }: { text: string; phase: Phase }) {
  const chars = useMemo(() => text.split(''), [text]);
  return (
    <span className="absolute left-11 text-sm pointer-events-none select-none flex z-[2]" aria-hidden>
      {chars.map((char, i) => (
        <span
          key={`${text}-${i}`}
          className={phase === 'exiting' ? 'placeholder-char-exit' : 'placeholder-char-enter'}
          style={{
            animationDelay: phase === 'exiting' ? `${i * 12}ms` : `${i * 25}ms`,
            color: 'var(--color-text-secondary)',
            whiteSpace: 'pre',
          }}
        >
          {char}
        </span>
      ))}
    </span>
  );
}

const DISCOVERY_KEYWORDS = [
  'api', 'apis', 'client', 'clients', 'connect', 'import', 'latest',
  'find', 'discover', 'add', 'setup', 'integrate', 'fetch',
];

function isDiscoveryQuery(input: string): boolean {
  const lower = input.toLowerCase();
  const words = lower.split(/\s+/);
  const hasKeyword = words.some(w => DISCOVERY_KEYWORDS.includes(w));
  const hasServiceName = /[A-Z]/.test(input) || /\b(openai|anthropic|stripe|github|twilio|sendgrid|slack|discord|spotify|google|aws|azure|firebase|supabase|vercel|cloudflare|shopify|paypal|twitter|reddit)\b/i.test(lower);
  return hasKeyword && hasServiceName;
}

function DiscoveryResults({ results, query, loading, onConnect, onDismiss }: {
  results: DiscoveryResult[];
  query: string;
  loading: boolean;
  onConnect: (results: DiscoveryResult[]) => void;
  onDismiss: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set(results.map((_, i) => i)));

  useEffect(() => {
    setSelected(new Set(results.filter(r => !r.error).map((_, i) => i)));
  }, [results]);

  const connectable = results.filter((r, i) => !r.error && selected.has(i));

  return (
    <div className="w-full animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Search size={14} className="text-accent" />
          <span className="text-xs font-semibold text-text-primary">
            {loading ? 'Searching for APIs...' : `Found ${results.length} API${results.length !== 1 ? 's' : ''}`}
          </span>
          {loading && <Loader2 size={12} className="animate-spin text-accent" />}
        </div>
        <button onClick={onDismiss} className="p-1 rounded hover:bg-bg-hover text-text-muted transition-colors">
          <X size={14} />
        </button>
      </div>

      {loading && results.length === 0 && (
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-xl bg-bg-secondary border border-border p-4 discovery-shimmer">
              <div className="h-4 w-40 bg-bg-tertiary rounded mb-2" />
              <div className="h-3 w-64 bg-bg-tertiary rounded" />
            </div>
          ))}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2 mb-3">
          {results.map((result, i) => (
            <button
              key={i}
              onClick={() => {
                if (result.error) return;
                const next = new Set(selected);
                if (next.has(i)) next.delete(i); else next.add(i);
                setSelected(next);
              }}
              className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all animate-fade-in ${
                result.error
                  ? 'bg-bg-secondary border-border opacity-60'
                  : selected.has(i)
                    ? 'bg-accent/5 border-accent/30'
                    : 'bg-bg-secondary border-border hover:border-border-light'
              }`}
            >
              <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                result.error ? 'bg-error/20' : selected.has(i) ? 'bg-accent' : 'bg-bg-tertiary border border-border'
              }`}>
                {result.error ? <AlertCircle size={11} className="text-error" /> :
                 selected.has(i) ? <Check size={11} className="text-white" /> : null}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-text-primary">{result.name}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                    result.specType === 'graphql' ? 'bg-method-patch/20 text-method-patch' : 'bg-accent/20 text-accent'
                  }`}>
                    {result.specType === 'graphql' ? 'GraphQL' : 'REST'}
                  </span>
                  {result.endpointCount > 0 && (
                    <span className="text-[9px] text-text-muted">{result.endpointCount} endpoints</span>
                  )}
                </div>
                <p className="text-[11px] text-text-muted truncate">{result.error || result.description}</p>
                {result.baseUrl && !result.error && (
                  <p className="text-[9px] text-text-muted font-mono mt-0.5 truncate">{result.baseUrl}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {!loading && connectable.length > 0 && (
        <button
          onClick={() => onConnect(connectable)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs rounded-xl bg-accent hover:bg-accent-hover text-white transition-colors shadow-[0_0_12px_rgba(59,130,246,0.3)]"
        >
          <Plug size={14} />
          Connect {connectable.length === 1 ? connectable[0].name : `${connectable.length} APIs`}
        </button>
      )}
    </div>
  );
}

export function HomeView() {
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [discoveryResults, setDiscoveryResults] = useState<DiscoveryResult[] | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryQuery, setDiscoveryQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const connections = useConnectionStore((s) => s.connections);
  const history = useRequestStore((s) => s.history);
  const { setActiveView } = useUiStore();
  const placeholder = useWavePlaceholder(PLACEHOLDERS);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (!input.trim() || processing || discoveryLoading) return;
    setProcessing(true);

    const trimmed = input.trim();

    if (isUrl(trimmed)) {
      handleUrlInput(trimmed);
    } else if (isMethodPath(trimmed)) {
      handleMethodPath(trimmed);
    } else if (isDiscoveryQuery(trimmed)) {
      await handleDiscovery(trimmed);
    } else {
      await handleAiInput(trimmed);
    }

    setProcessing(false);
  };

  const isUrl = (s: string) => {
    try { new URL(s); return true; } catch { return false; }
  };

  const isMethodPath = (s: string) => {
    return /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+/i.test(s);
  };

  const isSpecUrl = (s: string) => {
    const lower = s.toLowerCase();
    return lower.includes('swagger') || lower.includes('openapi') ||
           lower.endsWith('.json') || lower.endsWith('.yaml') || lower.endsWith('.yml');
  };

  const handleUrlInput = (url: string) => {
    if (isSpecUrl(url)) {
      handleSpecUrl(url);
    } else {
      const store = useRequestStore.getState();
      store.updateActiveRequest({ url, method: 'GET', name: url });
      setActiveView('request');
    }
    setInput('');
  };

  const handleMethodPath = (input: string) => {
    const match = input.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.+)/i)!;
    const method = match[1].toUpperCase() as HttpMethod;
    let url = match[2].trim();
    if (!url.startsWith('http')) {
      const activeConn = connections.length > 0 ? connections[0] : null;
      if (activeConn) {
        url = activeConn.baseUrl + (url.startsWith('/') ? '' : '/') + url;
      }
    }
    const store = useRequestStore.getState();
    store.updateActiveRequest({ url, method, name: `${method} ${url}` });
    setActiveView('request');
    setInput('');
  };

  const handleSpecUrl = async (url: string) => {
    try {
      const res = await fetch(url);
      const text = await res.text();
      const conn = useConnectionStore.getState().importOpenApiSpec(text, url);
      if (conn) {
        setActiveView('connections');
        setInput('');
      }
    } catch {
      const store = useRequestStore.getState();
      store.updateActiveRequest({ url, method: 'GET', name: url });
      setActiveView('request');
      setInput('');
    }
  };

  const handleDiscovery = async (query: string) => {
    setDiscoveryQuery(query);
    setDiscoveryLoading(true);
    setDiscoveryResults([]);
    setInput('');

    try {
      const results: DiscoveryResult[] = await window.ruke.agent.discover(query);
      setDiscoveryResults(results);
    } catch {
      setDiscoveryResults([{
        name: 'Error',
        description: 'Discovery failed. Make sure your OpenAI API key is configured in Settings.',
        baseUrl: '',
        specType: 'openapi',
        endpointCount: 0,
        endpoints: [],
        error: 'Discovery failed',
      }]);
    }
    setDiscoveryLoading(false);
  };

  const handleConnectDiscovered = (results: DiscoveryResult[]) => {
    const store = useConnectionStore.getState();
    for (const result of results) {
      if (result.endpoints.length > 0) {
        store.addConnection({
          name: result.name,
          baseUrl: result.baseUrl,
          specUrl: result.specUrl,
          specType: result.specType,
          description: result.description,
          endpoints: result.endpoints,
        });
      } else {
        store.addConnection({
          name: result.name,
          baseUrl: result.baseUrl,
          specType: 'manual',
          description: result.description,
        });
      }
    }
    setDiscoveryResults(null);
    setDiscoveryQuery('');
    setActiveView('connections');
  };

  const handleAiInput = async (prompt: string) => {
    try {
      const context = connections.length > 0
        ? `Connected APIs: ${connections.map(c => `${c.name} (${c.baseUrl})`).join(', ')}`
        : '';

      const result = await window.ruke.ai.chat(
        [{ role: 'user', content: prompt, timestamp: new Date().toISOString() }],
        context
      );

      if (result.content) {
        try {
          const jsonMatch = result.content.match(/\{[\s\S]*"action"\s*:\s*"create_request"[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.request) {
              const store = useRequestStore.getState();
              store.updateActiveRequest({
                method: parsed.request.method || 'GET',
                url: parsed.request.url || '',
                headers: parsed.request.headers || [],
                params: parsed.request.params || [],
                body: parsed.request.body || { type: 'none' },
                auth: parsed.request.auth || { type: 'none' },
                name: parsed.request.name || prompt,
              });
              setActiveView('request');
              setInput('');
              return;
            }
          }
        } catch {}
      }

      const store = useRequestStore.getState();
      store.updateActiveRequest({ name: prompt });
      setActiveView('request');
      setInput('');
    } catch {
      setActiveView('request');
      setInput('');
    }
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setProcessing(true);
    try {
      const text = await file.text();
      const name = file.name.toLowerCase();

      if (name.endsWith('.graphql') || name.endsWith('.gql')) {
        // GraphQL schema file — prompt for endpoint URL via manual connection
        setActiveView('connections');
      } else {
        let parsed: any;
        try { parsed = JSON.parse(text); } catch {
          const yaml = await import('js-yaml');
          parsed = yaml.load(text);
        }

        if (parsed?.info?._postman_id || parsed?.info?.schema?.includes('postman')) {
          useConnectionStore.getState().importOpenApiSpec(text, file.name);
          setActiveView('connections');
        } else if (parsed?.openapi || parsed?.swagger || parsed?.paths) {
          const conn = useConnectionStore.getState().importOpenApiSpec(text, file.name);
          if (conn) setActiveView('connections');
        }
      }
    } catch {}
    setProcessing(false);
  };

  const handleFileClick = async () => {
    const result = await window.ruke.file.import([
      { name: 'API Specs & Schemas', extensions: ['json', 'yaml', 'yml', 'graphql', 'gql'] },
    ]);
    if (result.success && result.content) {
      const conn = useConnectionStore.getState().importOpenApiSpec(result.content, result.path);
      if (conn) {
        setActiveView('connections');
      }
    }
  };

  const recentHistory = history.slice(0, 6);
  const showDiscovery = discoveryResults !== null || discoveryLoading;

  return (
    <div
      className="h-full flex flex-col items-center overflow-y-auto"
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={handleFileDrop}
    >
      <div className="w-full max-w-2xl px-6 pt-20 pb-8 flex flex-col items-center">
        {/* Command Bar */}
        <div className="w-full relative mb-6">
          <div className="relative flex items-center command-bar-glow rounded-2xl">
            <Sparkles size={16} className="absolute left-4 text-accent z-10" />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder=""
              disabled={processing || discoveryLoading}
              className="w-full pl-11 pr-14 py-4 text-sm rounded-2xl bg-bg-secondary border border-transparent text-text-primary focus:outline-none transition-all disabled:opacity-50 relative"
            />
            {!input && !showDiscovery && (
              <WavePlaceholder text={placeholder.text} phase={placeholder.phase} />
            )}
            {!input && showDiscovery && (
              <span className="absolute left-11 text-sm text-text-muted pointer-events-none select-none z-[2]">
                {discoveryQuery}
              </span>
            )}
            <button
              onClick={handleSubmit}
              disabled={processing || discoveryLoading || !input.trim()}
              className={`absolute right-2 p-2.5 rounded-xl text-white transition-all duration-300 z-10 ${
                input.trim()
                  ? 'bg-accent hover:bg-accent-hover shadow-[0_0_12px_rgba(59,130,246,0.4)] hover:shadow-[0_0_20px_rgba(59,130,246,0.6)] cursor-pointer'
                  : 'bg-accent/20 opacity-30 cursor-not-allowed'
              }`}
            >
              {processing || discoveryLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>

        {/* Discovery Results */}
        {showDiscovery && (
          <div className="w-full mb-6">
            <DiscoveryResults
              results={discoveryResults || []}
              query={discoveryQuery}
              loading={discoveryLoading}
              onConnect={handleConnectDiscovered}
              onDismiss={() => {
                setDiscoveryResults(null);
                setDiscoveryQuery('');
                inputRef.current?.focus();
              }}
            />
          </div>
        )}

        {/* Connected APIs */}
        {!showDiscovery && (
          <>
            <div className="w-full mb-8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Plug size={14} className="text-text-muted" />
                  <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Connected APIs</h2>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleFileClick}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                  >
                    <Upload size={11} /> Import Spec
                  </button>
                  <button
                    onClick={() => setActiveView('connections')}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                  >
                    <Plus size={11} /> Add API
                  </button>
                </div>
              </div>

              {connections.length === 0 ? (
                <div
                  onClick={handleFileClick}
                  className="border-2 border-dashed border-border rounded-2xl p-8 text-center cursor-pointer hover:border-accent/40 hover:bg-accent/5 transition-all"
                >
                  <Globe size={24} className="mx-auto text-text-muted mb-3 opacity-50" />
                  <p className="text-sm text-text-muted mb-1">No APIs connected yet</p>
                  <p className="text-xs text-text-muted">
                    Drop a spec file, paste a URL, or type "connect Stripe API"
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {connections.map((conn) => (
                    <button
                      key={conn.id}
                      onClick={() => {
                        useConnectionStore.getState().setActiveConnection(conn.id);
                        setActiveView('connections');
                      }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-bg-secondary border border-border hover:border-border-light hover:bg-bg-tertiary transition-all group text-left"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white text-xs font-bold"
                        style={{ background: conn.iconColor }}
                      >
                        {conn.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{conn.name}</p>
                        <p className="text-[10px] text-text-muted font-mono truncate">{conn.baseUrl}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {conn.specType === 'graphql' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-method-patch/20 text-method-patch">GQL</span>
                        )}
                        <span className="text-[10px] text-text-muted px-1.5 py-0.5 rounded bg-bg-tertiary">
                          {conn.endpoints.length} endpoints
                        </span>
                        <ChevronRight size={14} className="text-text-muted group-hover:text-text-primary transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Activity */}
            {recentHistory.length > 0 && (
              <div className="w-full">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={14} className="text-text-muted" />
                  <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Recent</h2>
                </div>
                <div className="space-y-1">
                  {recentHistory.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => {
                        if (entry.request) {
                          useRequestStore.getState().openTab(entry.request);
                          setActiveView('request');
                        }
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-bg-secondary transition-colors group"
                    >
                      <span
                        className="font-mono font-bold text-[10px] w-12 text-left shrink-0"
                        style={{ color: METHOD_COLORS[entry.method] || '#6b7280' }}
                      >
                        {entry.method}
                      </span>
                      <span className="text-xs text-text-secondary font-mono truncate flex-1 text-left">
                        {entry.url}
                      </span>
                      <span className={`font-mono text-[10px] shrink-0 ${
                        entry.status >= 200 && entry.status < 300 ? 'text-success' :
                        entry.status >= 400 ? 'text-error' : 'text-warning'
                      }`}>
                        {entry.status || 'ERR'}
                      </span>
                      <span className="text-[10px] text-text-muted shrink-0">{entry.duration}ms</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
