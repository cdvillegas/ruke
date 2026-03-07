import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useRequestStore } from '../../stores/requestStore';
import { useUiStore } from '../../stores/uiStore';
import {
  Plug, Plus, Trash2, Globe, ChevronRight, ChevronDown,
  Search, Play, Upload, Loader2, Check, AlertCircle, Sparkles,
  FileJson, Send,
} from 'lucide-react';
import { METHOD_COLORS } from '@shared/constants';
import type { ApiConnection, ApiEndpoint, DiscoveryResult } from '@shared/types';
import yaml from 'js-yaml';

const SPEC_SUFFIXES = [
  '/openapi.json', '/openapi.yaml', '/swagger.json',
  '/swagger/v1/swagger.json', '/api-docs',
  '/v1/openapi.json', '/v2/openapi.json', '/docs/openapi.json',
];

function parseSpec(text: string): any {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return JSON.parse(trimmed);
  return yaml.load(trimmed);
}

function isUrl(s: string): boolean {
  try { new URL(s); return true; } catch { return false; }
}

function isSpecContent(s: string): boolean {
  const t = s.trim();
  return t.startsWith('{') || t.startsWith('[') || /^(openapi|swagger)\s*:/m.test(t);
}

function isSpecUrl(s: string): boolean {
  const lower = s.toLowerCase();
  return lower.includes('swagger') || lower.includes('openapi') || lower.includes('api-docs') ||
    lower.endsWith('.json') || lower.endsWith('.yaml') || lower.endsWith('.yml');
}

async function tryProbeSpec(baseUrl: string): Promise<{ spec: any; url: string } | null> {
  const base = baseUrl.replace(/\/+$/, '');
  for (const suffix of SPEC_SUFFIXES) {
    try {
      const url = base + suffix;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const text = await res.text();
      const spec = parseSpec(text);
      if (spec?.openapi || spec?.swagger || spec?.paths) return { spec, url };
    } catch {}
  }
  return null;
}

const CONNECTION_PLACEHOLDERS = [
  'https://api.example.com',
  'Drop an openapi.yaml file...',
  'Stripe',
  'Paste a Swagger spec URL...',
  'I\'m using the GitHub API',
  'https://petstore.swagger.io/v2/swagger.json',
  'Connect the OpenAI API',
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

type ResolveStatus = 'idle' | 'resolving' | 'resolved' | 'error';

interface ResolveResult {
  name: string;
  description?: string;
  baseUrl: string;
  specUrl?: string;
  endpointCount: number;
  specType: 'openapi' | 'graphql' | 'manual';
  specText?: string;
  discoveryResults?: DiscoveryResult[];
}

export function ConnectionsView() {
  const { connections, activeConnectionId, setActiveConnection, deleteConnection } = useConnectionStore();
  const [searchQuery, setSearchQuery] = useState('');

  const activeConn = connections.find(c => c.id === activeConnectionId);

  const handleRunEndpoint = (conn: ApiConnection, endpoint: ApiEndpoint) => {
    const url = conn.baseUrl + endpoint.path;
    const store = useRequestStore.getState();
    store.updateActiveRequest({
      method: endpoint.method,
      url,
      name: endpoint.summary || `${endpoint.method} ${endpoint.path}`,
      headers: [{ key: '', value: '', enabled: true }],
      params: (endpoint.parameters || [])
        .filter(p => p.in === 'query')
        .map(p => ({ key: p.name, value: '', enabled: true })),
      body: endpoint.requestBody
        ? { type: endpoint.requestBody.type, raw: endpoint.requestBody.example || endpoint.requestBody.schema || '' }
        : { type: 'none' },
      auth: conn.auth,
    });
    useUiStore.getState().setActiveView('request');
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* Connection List */}
      <div className="w-64 border-r border-border bg-bg-secondary flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Plug size={16} className="text-accent" />
              <h2 className="text-sm font-semibold text-text-primary">APIs</h2>
            </div>
            <button
              onClick={() => setActiveConnection(null)}
              className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {connections.map((conn) => (
            <button
              key={conn.id}
              onClick={() => setActiveConnection(conn.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left group ${
                conn.id === activeConnectionId
                  ? 'bg-bg-active'
                  : 'hover:bg-bg-hover'
              }`}
            >
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-white text-[10px] font-bold"
                style={{ background: conn.iconColor }}
              >
                {conn.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">{conn.name}</p>
                <p className="text-[9px] text-text-muted font-mono truncate">{conn.baseUrl}</p>
              </div>
              <span className="text-[9px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                {conn.endpoints.length}
              </span>
            </button>
          ))}

          {connections.length === 0 && (
            <div className="px-4 py-8 text-center">
              <Globe size={20} className="mx-auto text-text-muted opacity-30 mb-2" />
              <p className="text-[10px] text-text-muted">No APIs connected</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      <div className="flex-1 overflow-y-auto">
        {activeConn ? (
          <ConnectionDetail
            conn={activeConn}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onRunEndpoint={handleRunEndpoint}
            onDelete={() => deleteConnection(activeConn.id)}
          />
        ) : (
          <SmartAddPanel />
        )}
      </div>
    </div>
  );
}

function SmartAddPanel() {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<ResolveStatus>('idle');
  const [statusText, setStatusText] = useState('');
  const [result, setResult] = useState<ResolveResult | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [showManual, setShowManual] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const { importOpenApiSpec, addConnection, setActiveConnection } = useConnectionStore();
  const placeholder = useWavePlaceholder(CONNECTION_PLACEHOLDERS);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const reset = () => {
    setStatus('idle');
    setStatusText('');
    setResult(null);
    setError('');
    setShowManual(false);
  };

  const resolveSpecText = (text: string, sourceUrl?: string) => {
    try {
      const conn = importOpenApiSpec(text, sourceUrl);
      if (conn) {
        setResult({
          name: conn.name,
          description: conn.description,
          baseUrl: conn.baseUrl,
          specUrl: sourceUrl,
          endpointCount: conn.endpoints.length,
          specType: 'openapi',
        });
        setStatus('resolved');
        return true;
      }
    } catch {}
    return false;
  };

  const resolveInput = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    reset();
    setStatus('resolving');

    if (isSpecContent(trimmed)) {
      setStatusText('Parsing spec...');
      await new Promise(r => setTimeout(r, 100));
      if (resolveSpecText(trimmed)) return;
      setStatus('error');
      setError('Could not parse spec. Check the format and try again.');
      return;
    }

    if (isUrl(trimmed)) {
      if (isSpecUrl(trimmed)) {
        setStatusText('Fetching spec...');
        try {
          const res = await fetch(trimmed, { signal: AbortSignal.timeout(10000) });
          const text = await res.text();
          if (resolveSpecText(text, trimmed)) return;
        } catch {}
      }

      setStatusText('Probing for API spec...');
      const probed = await tryProbeSpec(trimmed);
      if (probed) {
        if (resolveSpecText(JSON.stringify(probed.spec), probed.url)) return;
      }

      setStatusText('Asking AI to find this API...');
      try {
        let hostname: string;
        try { hostname = new URL(trimmed).hostname; } catch { hostname = trimmed; }
        const results: DiscoveryResult[] = await window.ruke.agent.discover(
          `Find the API for ${hostname}. The website is ${trimmed}`
        );
        const valid = results.filter(r => !r.error && r.endpointCount > 0);
        if (valid.length > 0) {
          setResult({
            name: valid[0].name,
            description: valid[0].description,
            baseUrl: valid[0].baseUrl,
            specUrl: valid[0].specUrl,
            endpointCount: valid[0].endpointCount,
            specType: valid[0].specType,
            discoveryResults: valid,
          });
          setStatus('resolved');
          return;
        }

        const anyResult = results.filter(r => !r.error);
        if (anyResult.length > 0) {
          setResult({
            name: anyResult[0].name,
            description: anyResult[0].description,
            baseUrl: anyResult[0].baseUrl || trimmed,
            specType: 'manual',
            endpointCount: 0,
          });
          setStatus('resolved');
          return;
        }
      } catch {}

      setManualUrl(trimmed);
      try { setManualName(new URL(trimmed).hostname.replace(/^(www|api)\./, '')); } catch { setManualName(trimmed); }
      setShowManual(true);
      setStatus('error');
      setError('Could not find an API spec. You can add it manually.');
      return;
    }

    setStatusText('Searching for API...');
    try {
      const results: DiscoveryResult[] = await window.ruke.agent.discover(trimmed);
      const valid = results.filter(r => !r.error);
      if (valid.length > 0) {
        const withEndpoints = valid.filter(r => r.endpointCount > 0);
        if (withEndpoints.length > 0) {
          setResult({
            name: withEndpoints[0].name,
            description: withEndpoints[0].description,
            baseUrl: withEndpoints[0].baseUrl,
            specUrl: withEndpoints[0].specUrl,
            endpointCount: withEndpoints[0].endpointCount,
            specType: withEndpoints[0].specType,
            discoveryResults: withEndpoints.length > 1 ? withEndpoints : undefined,
          });
          setStatus('resolved');
          return;
        }

        setResult({
          name: valid[0].name,
          description: valid[0].description,
          baseUrl: valid[0].baseUrl,
          specType: 'manual',
          endpointCount: 0,
          discoveryResults: valid.length > 1 ? valid : undefined,
        });
        setStatus('resolved');
        return;
      }
    } catch {}

    setShowManual(true);
    setStatus('error');
    setError('Could not find that API. Try pasting a spec URL or adding manually.');
  }, [importOpenApiSpec]);

  const handleSubmit = () => {
    if (status === 'resolving') return;
    resolveInput(input);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (text && isSpecContent(text) && text.length > 200) {
      e.preventDefault();
      setInput(text.slice(0, 100) + '...');
      resolveInput(text);
    }
  };

  const handleFileContent = async (file: File) => {
    reset();
    setStatus('resolving');
    setStatusText(`Reading ${file.name}...`);
    try {
      const text = await file.text();
      if (resolveSpecText(text, file.name)) return;
      setStatus('error');
      setError(`Could not parse ${file.name}. Make sure it's a valid OpenAPI/Swagger spec.`);
    } catch {
      setStatus('error');
      setError(`Failed to read ${file.name}.`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileContent(file);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragging(false);
    }
  };

  const handleBrowse = async () => {
    const result = await window.ruke.file.import([
      { name: 'API Specs', extensions: ['json', 'yaml', 'yml', 'graphql', 'gql'] },
    ]);
    if (result.success && result.content) {
      reset();
      setStatus('resolving');
      setStatusText('Parsing spec...');
      if (resolveSpecText(result.content, result.path)) return;
      setStatus('error');
      setError('Could not parse the file. Make sure it\'s a valid OpenAPI/Swagger spec.');
    }
  };

  const selectLatest = () => {
    const conns = useConnectionStore.getState().connections;
    if (conns.length > 0) setActiveConnection(conns[conns.length - 1].id);
  };

  const handleConnect = (r: ResolveResult) => {
    if (r.discoveryResults && r.discoveryResults.length > 0) {
      const match = r.discoveryResults.find(d => d.name === r.name);
      if (match && match.endpoints.length > 0) {
        const conn = addConnection({
          name: match.name,
          baseUrl: match.baseUrl,
          specUrl: match.specUrl,
          specType: match.specType,
          description: match.description,
          endpoints: match.endpoints,
        });
        setActiveConnection(conn.id);
        return;
      }
    }

    if (r.endpointCount > 0) {
      selectLatest();
      return;
    }

    const conn = addConnection({
      name: r.name,
      baseUrl: r.baseUrl,
      specUrl: r.specUrl,
      specType: r.specType === 'manual' ? 'manual' : r.specType,
      description: r.description,
    });
    setActiveConnection(conn.id);
  };

  const handleManualSubmit = () => {
    if (!manualName.trim() || !manualUrl.trim()) return;
    const conn = addConnection({ name: manualName.trim(), baseUrl: manualUrl.trim(), specType: 'manual' });
    setActiveConnection(conn.id);
  };

  return (
    <div
      className="h-full flex flex-col items-center justify-center"
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="w-full max-w-lg px-8">

        {/* Drop Zone */}
        <div
          className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 ${
            dragging
              ? 'border-accent bg-accent/5 scale-[1.01]'
              : 'border-border hover:border-border-light'
          }`}
        >
          <div className={`${status === 'idle' ? 'p-6 pb-4' : 'p-6'}`}>
            {/* Icon + helper text */}
            {status === 'idle' && (
              <div className="text-center mb-5">
                <div className="w-12 h-12 rounded-2xl bg-bg-tertiary flex items-center justify-center mx-auto mb-3">
                  {dragging ? (
                    <Upload size={20} className="text-accent" />
                  ) : (
                    <Globe size={20} className="text-text-muted" />
                  )}
                </div>
                <p className="text-sm text-text-primary font-medium mb-1">
                  {dragging ? 'Drop your spec file' : 'Drop a file, paste a URL, or just type'}
                </p>
                <p className="text-xs text-text-muted">
                  OpenAPI specs, Swagger files, URLs, or just an API name like "Stripe"
                </p>
              </div>
            )}

            {/* Input with glow */}
            {status !== 'resolved' && (
              <div className="relative">
                <div className="relative flex items-center command-bar-glow rounded-2xl">
                  <Sparkles size={16} className="absolute left-4 text-accent z-10" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => { setInput(e.target.value); if (status === 'error') reset(); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    onPaste={handlePaste}
                    placeholder=""
                    disabled={status === 'resolving'}
                    className="w-full pl-11 pr-14 py-4 text-sm rounded-2xl bg-bg-secondary border border-transparent text-text-primary focus:outline-none transition-all disabled:opacity-50 relative"
                  />
                  {!input && status === 'idle' && (
                    <WavePlaceholder text={placeholder.text} phase={placeholder.phase} />
                  )}
                  {!input && status === 'resolving' && statusText && (
                    <span className="absolute left-11 text-sm text-text-muted pointer-events-none select-none z-[2]">
                      {statusText}
                    </span>
                  )}
                  <button
                    onClick={handleSubmit}
                    disabled={status === 'resolving' || !input.trim()}
                    className={`absolute right-2 p-2.5 rounded-xl text-white transition-all duration-300 z-10 ${
                      input.trim() && status !== 'resolving'
                        ? 'bg-accent hover:bg-accent-hover shadow-[0_0_12px_rgba(59,130,246,0.4)] hover:shadow-[0_0_20px_rgba(59,130,246,0.6)] cursor-pointer'
                        : status === 'resolving'
                          ? 'bg-accent/40 cursor-wait'
                          : 'bg-accent/20 opacity-30 cursor-not-allowed'
                    }`}
                  >
                    {status === 'resolving' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* Result card */}
            {status === 'resolved' && result && (
              <div className="animate-fade-in">
                <div className="rounded-xl bg-bg-secondary border border-accent/20 p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <Check size={16} className="text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-text-primary">{result.name}</h3>
                      {result.description && (
                        <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{result.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-text-muted mb-4">
                    {result.baseUrl && (
                      <span className="font-mono truncate">{result.baseUrl}</span>
                    )}
                    {result.endpointCount > 0 && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                        {result.endpointCount} endpoints
                      </span>
                    )}
                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-bg-tertiary">
                      {result.specType === 'graphql' ? 'GraphQL' : result.specType === 'manual' ? 'Manual' : 'REST'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleConnect(result)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs rounded-xl bg-accent hover:bg-accent-hover text-white transition-colors font-medium"
                    >
                      <Plug size={14} /> Connect
                    </button>
                    <button
                      onClick={() => { reset(); setInput(''); inputRef.current?.focus(); }}
                      className="px-4 py-2.5 text-xs rounded-xl bg-bg-tertiary border border-border hover:bg-bg-hover text-text-primary transition-colors"
                    >
                      Try another
                    </button>
                  </div>
                </div>

                {/* Additional discovery results */}
                {result.discoveryResults && result.discoveryResults.length > 1 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Also found</p>
                    {result.discoveryResults.filter(r => r.name !== result.name).map((r, i) => (
                      <button
                        key={i}
                        onClick={() => setResult({
                          name: r.name,
                          description: r.description,
                          baseUrl: r.baseUrl,
                          specUrl: r.specUrl,
                          endpointCount: r.endpointCount,
                          specType: r.specType,
                          discoveryResults: result.discoveryResults,
                        })}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-secondary text-left transition-colors"
                      >
                        <Globe size={12} className="text-text-muted shrink-0" />
                        <span className="text-xs text-text-primary flex-1 truncate">{r.name}</span>
                        {r.endpointCount > 0 && (
                          <span className="text-[9px] text-text-muted">{r.endpointCount} endpoints</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {status === 'error' && error && (
              <div className="flex items-start gap-2 mt-3 animate-fade-in">
                <AlertCircle size={14} className="text-warning shrink-0 mt-0.5" />
                <span className="text-xs text-text-muted">{error}</span>
              </div>
            )}

            {/* Manual fallback */}
            {showManual && (
              <div className="mt-4 pt-4 border-t border-border space-y-3 animate-fade-in">
                <p className="text-xs text-text-secondary font-medium">Add manually</p>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="API name"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                />
                <input
                  type="text"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="Base URL"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                />
                <button
                  onClick={handleManualSubmit}
                  disabled={!manualName.trim() || !manualUrl.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs rounded-xl bg-accent hover:bg-accent-hover text-white disabled:opacity-50 transition-colors"
                >
                  <Plus size={14} /> Connect
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Secondary actions */}
        {status === 'idle' && (
          <div className="flex items-center justify-center gap-4 mt-4">
            <button
              onClick={handleBrowse}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              <FileJson size={12} /> Browse spec file
            </button>
            <span className="text-border">|</span>
            <button
              onClick={() => setShowManual(true)}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              <Plus size={12} /> Add manually
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

function ConnectionDetail({ conn, searchQuery, setSearchQuery, onRunEndpoint, onDelete }: {
  conn: ApiConnection;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onRunEndpoint: (conn: ApiConnection, ep: ApiEndpoint) => void;
  onDelete: () => void;
}) {
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set(['all']));

  const filtered = searchQuery
    ? conn.endpoints.filter(ep =>
        ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ep.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ep.method.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conn.endpoints;

  const tags = Array.from(new Set(filtered.flatMap(ep => ep.tags || ['Other']))).sort();
  const byTag = tags.length > 0
    ? tags.map(tag => ({
        tag,
        endpoints: filtered.filter(ep => (ep.tags || ['Other']).includes(tag)),
      }))
    : [{ tag: 'Endpoints', endpoints: filtered }];

  const toggleTag = (tag: string) => {
    const next = new Set(expandedTags);
    if (next.has(tag)) next.delete(tag); else next.add(tag);
    setExpandedTags(next);
  };

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold"
            style={{ background: conn.iconColor }}
          >
            {conn.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{conn.name}</h2>
            <p className="text-xs text-text-muted font-mono">{conn.baseUrl}</p>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="p-2 rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-colors"
          title="Remove connection"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {conn.description && (
        <p className="text-xs text-text-secondary mb-6 leading-relaxed">{conn.description}</p>
      )}

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search endpoints..."
          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      <div className="space-y-2">
        {byTag.map(({ tag, endpoints }) => (
          <div key={tag} className="rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => toggleTag(tag)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-bg-secondary hover:bg-bg-tertiary transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                {expandedTags.has(tag) ? <ChevronDown size={13} className="text-text-muted" /> : <ChevronRight size={13} className="text-text-muted" />}
                <span className="text-xs font-semibold text-text-primary">{tag}</span>
              </div>
              <span className="text-[10px] text-text-muted">{endpoints.length}</span>
            </button>
            {expandedTags.has(tag) && (
              <div>
                {endpoints.map((ep) => (
                  <button
                    key={ep.id}
                    onClick={() => onRunEndpoint(conn, ep)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 border-t border-border hover:bg-bg-hover transition-colors group text-left"
                  >
                    <span
                      className="font-mono font-bold text-[10px] w-14 text-left shrink-0"
                      style={{ color: METHOD_COLORS[ep.method] || '#6b7280' }}
                    >
                      {ep.method}
                    </span>
                    <span className="text-xs font-mono text-text-secondary flex-1 truncate">{ep.path}</span>
                    <span className="text-[10px] text-text-muted truncate max-w-[200px] hidden sm:block">{ep.summary}</span>
                    <Play size={12} className="text-text-muted opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-text-muted">
              {searchQuery ? 'No matching endpoints' : 'No endpoints defined. Add them manually or import a spec.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
