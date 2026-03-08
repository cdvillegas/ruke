import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRequestStore } from '../../stores/requestStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { useUiStore } from '../../stores/uiStore';
import {
  Sparkles, Send, Plug, Loader2, Globe,
  Plus, ChevronRight, Upload, Check, X, AlertCircle, Search,
  ToggleLeft, ToggleRight, Key, ArrowRight,
} from 'lucide-react';
import { METHOD_COLORS } from '@shared/constants';
import type { HttpMethod, DiscoveryResult, ApiEndpoint, ApiConnection } from '@shared/types';
import { ConnectionIcon } from '../connections/ConnectionsView';
import { nanoid } from 'nanoid';

interface AgentMessage {
  id: string;
  type: 'thinking' | 'action' | 'result' | 'error';
  text: string;
  detail?: string;
  onClick?: () => void;
}

const AI_KEY_STORAGE = 'ruke:ai_key';

function hasAiKey(): boolean {
  return (localStorage.getItem(AI_KEY_STORAGE) || '').length >= 10;
}

// --- Fuzzy search ---

interface SearchResult {
  endpoint: ApiEndpoint;
  connection: ApiConnection;
  score: number;
  matchRanges: Array<[number, number]>;
}

function fuzzyMatch(query: string, text: string): { score: number; ranges: Array<[number, number]> } | null {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  let score = 0;
  const ranges: Array<[number, number]> = [];
  let rangeStart = -1;

  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) {
      if (rangeStart === -1) rangeStart = i;
      score += 1;
      if (i > 0 && lower[i - 1] === '/' || lower[i - 1] === ' ' || lower[i - 1] === '-' || lower[i - 1] === '_') {
        score += 5;
      }
      if (i === 0) score += 3;
      qi++;
    } else {
      if (rangeStart !== -1) {
        ranges.push([rangeStart, i]);
        rangeStart = -1;
      }
    }
  }
  if (rangeStart !== -1) ranges.push([rangeStart, ranges.length > 0 ? ranges[ranges.length - 1][1] : query.length]);
  if (qi < q.length) return null;

  const consecutiveBonus = ranges.reduce((sum, [s, e]) => sum + (e - s - 1) * 3, 0);
  return { score: score + consecutiveBonus, ranges };
}

function searchEndpoints(query: string, connections: ApiConnection[], limit = 20): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.trim();

  const methodMatch = q.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+/i);
  const methodFilter = methodMatch ? methodMatch[1].toUpperCase() : null;
  const textQuery = methodFilter ? q.slice(methodMatch![0].length) : q;

  const results: SearchResult[] = [];

  for (const conn of connections) {
    for (const ep of conn.endpoints) {
      if (methodFilter && ep.method !== methodFilter) continue;

      const searchText = `${ep.method} ${ep.path} ${ep.summary || ''} ${(ep.tags || []).join(' ')}`;
      const match = textQuery ? fuzzyMatch(textQuery, searchText) : { score: 100, ranges: [] };
      if (!match) continue;

      results.push({ endpoint: ep, connection: conn, score: match.score, matchRanges: match.ranges });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

// --- Placeholder animation ---

const PLACEHOLDERS_AI = [
  'Create a POST request to add a new user...',
  'What endpoints does the Stripe API have?',
  'GET /users with pagination params',
  'Test the login endpoint with sample data',
  'Connect the OpenAI API',
  'Help me debug this 401 error',
];

const PLACEHOLDERS_SEARCH = [
  'Search across all connected endpoints...',
  'GET /users',
  'POST /orders',
  'Filter by method or path...',
  'payments create',
  '/auth/login',
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

// --- Discovery ---

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

function DiscoveryResults({ results, query, loading, onConnect, onConnectAndExplore, onDismiss }: {
  results: DiscoveryResult[];
  query: string;
  loading: boolean;
  onConnect: (results: DiscoveryResult[]) => void;
  onConnectAndExplore: (results: DiscoveryResult[]) => void;
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
                    result.specType === 'graphql' ? 'bg-method-patch/20 text-method-patch' : result.specType === 'grpc' ? 'bg-method-put/20 text-method-put' : 'bg-accent/20 text-accent'
                  }`}>
                    {result.specType === 'graphql' ? 'GraphQL' : result.specType === 'grpc' ? 'gRPC' : 'REST'}
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
        <div className="flex gap-2">
          <button
            onClick={() => onConnectAndExplore(connectable)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs rounded-xl bg-accent hover:bg-accent-hover text-white transition-colors shadow-[0_0_12px_rgba(59,130,246,0.3)]"
          >
            <Plug size={14} />
            Connect {connectable.length === 1 ? connectable[0].name : `${connectable.length} APIs`}
          </button>
          <button
            onClick={() => onConnect(connectable)}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs rounded-xl bg-bg-tertiary border border-border hover:bg-bg-hover text-text-primary transition-colors"
            title="Connect and view in API manager"
          >
            <ArrowRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

// --- Search Results ---

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const q = query.toLowerCase();
  const parts: Array<{ text: string; highlight: boolean }> = [];
  let lastEnd = 0;
  let qi = 0;
  let matchStart = -1;

  for (let i = 0; i < text.length && qi < q.length; i++) {
    if (text[i].toLowerCase() === q[qi]) {
      if (matchStart === -1) {
        if (i > lastEnd) parts.push({ text: text.slice(lastEnd, i), highlight: false });
        matchStart = i;
      }
      qi++;
      if (qi === q.length || i === text.length - 1 || text[i + 1]?.toLowerCase() !== q[qi]) {
        parts.push({ text: text.slice(matchStart, i + 1), highlight: true });
        lastEnd = i + 1;
        matchStart = -1;
      }
    } else if (matchStart !== -1) {
      parts.push({ text: text.slice(matchStart, i + 1), highlight: true });
      lastEnd = i + 1;
      matchStart = -1;
    }
  }
  if (lastEnd < text.length) parts.push({ text: text.slice(lastEnd), highlight: false });

  return (
    <>
      {parts.map((p, i) =>
        p.highlight
          ? <mark key={i} className="bg-accent/20 text-accent rounded-sm px-0.5">{p.text}</mark>
          : <span key={i}>{p.text}</span>
      )}
    </>
  );
}

function EndpointSearchResults({ results, query, onSelect }: {
  results: SearchResult[];
  query: string;
  onSelect: (result: SearchResult) => void;
}) {
  const grouped = useMemo(() => {
    const groups = new Map<string, SearchResult[]>();
    for (const r of results) {
      const key = r.connection.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return groups;
  }, [results]);

  if (results.length === 0 && query.trim()) {
    return (
      <div className="w-full px-4 py-6 text-center animate-fade-in">
        <Search size={20} className="mx-auto text-text-muted mb-2 opacity-40" />
        <p className="text-xs text-text-muted">No endpoints matching "{query}"</p>
        <p className="text-[10px] text-text-muted mt-1">Try a different search or connect more APIs</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-1 animate-fade-in max-h-80 overflow-y-auto">
      {Array.from(grouped.entries()).map(([connId, group]) => (
        <div key={connId}>
          <div className="flex items-center gap-2 px-2 py-1.5 sticky top-0 bg-bg-primary/90 backdrop-blur-sm z-10">
            <ConnectionIcon conn={group[0].connection} size="xs" />
            <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
              {group[0].connection.name}
            </span>
            <span className="text-[9px] text-text-muted font-mono">
              {group[0].connection.baseUrl}
            </span>
          </div>
          {group.map((r) => (
            <button
              key={r.endpoint.id}
              onClick={() => onSelect(r)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-secondary transition-colors group text-left"
            >
              <span
                className="font-mono font-bold text-[10px] w-14 text-left shrink-0"
                style={{ color: METHOD_COLORS[r.endpoint.method] || '#6b7280' }}
              >
                {r.endpoint.method}
              </span>
              <span className="text-xs text-text-secondary font-mono truncate flex-1">
                <HighlightedText text={r.endpoint.path} query={query} />
              </span>
              {r.endpoint.summary && r.endpoint.summary !== `${r.endpoint.method} ${r.endpoint.path}` && (
                <span className="text-[10px] text-text-muted truncate max-w-[200px] hidden sm:inline">
                  {r.endpoint.summary}
                </span>
              )}
              <ArrowRight size={12} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// --- AI Mode Toggle ---

function AiModeToggle({ enabled, onToggle, hasKey }: { enabled: boolean; onToggle: () => void; hasKey: boolean }) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
        enabled
          ? 'bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25'
          : 'bg-bg-tertiary text-text-muted border border-border hover:bg-bg-hover hover:text-text-secondary'
      }`}
      title={enabled ? 'AI mode on — natural language & discovery' : 'Search mode — browse connected endpoints'}
    >
      {enabled ? (
        <>
          <Sparkles size={12} />
          <span>AI</span>
          <ToggleRight size={14} className="text-accent" />
        </>
      ) : (
        <>
          <Search size={12} />
          <span>Search</span>
          <ToggleLeft size={14} />
        </>
      )}
    </button>
  );
}

// --- AI CTA banner ---

function AiCallToAction({ onEnable }: { onEnable: () => void }) {
  const keyExists = hasAiKey();
  const setActiveView = useUiStore((s) => s.setActiveView);

  return (
    <div className="w-full rounded-xl border border-dashed border-accent/30 bg-accent/5 p-4 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
          <Sparkles size={16} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary mb-1">Supercharge with AI</p>
          <p className="text-[11px] text-text-muted leading-relaxed mb-3">
            {keyExists
              ? 'AI mode lets you discover APIs, generate requests from natural language, and get intelligent suggestions.'
              : 'Connect an AI provider to unlock AI-powered discovery, natural language request generation, and smart suggestions.'}
          </p>
          <div className="flex items-center gap-2">
            {keyExists ? (
              <button
                onClick={onEnable}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors"
              >
                <Sparkles size={12} />
                Enable AI Mode
              </button>
            ) : (
              <button
                onClick={() => setActiveView('settings')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors"
              >
                <Key size={12} />
                Add API Key
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main HomeView ---

export function HomeView() {
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [discoveryResults, setDiscoveryResults] = useState<DiscoveryResult[] | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryQuery, setDiscoveryQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const connections = useConnectionStore((s) => s.connections);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const aiModeEnabled = useUiStore((s) => s.aiModeEnabled);
  const toggleAiMode = useUiStore((s) => s.toggleAiMode);
  const setAiMode = useUiStore((s) => s.setAiMode);
  const aiPlaceholder = useWavePlaceholder(PLACEHOLDERS_AI);
  const searchPlaceholder = useWavePlaceholder(PLACEHOLDERS_SEARCH);
  const placeholder = aiModeEnabled ? aiPlaceholder : searchPlaceholder;

  const setStatus = useCallback((msg: Omit<AgentMessage, 'id'>) => {
    setAgentMessages(prev => {
      const logs = prev.filter(m => m.type !== 'thinking' && m.type !== 'action');
      return [...logs, { ...msg, id: nanoid() }];
    });
  }, []);

  const clearMessages = useCallback(() => setAgentMessages([]), []);

  const searchResults = useMemo(() => {
    if (aiModeEnabled || !input.trim()) return [];
    return searchEndpoints(input, connections);
  }, [input, connections, aiModeEnabled]);

  const showSearchResults = !aiModeEnabled && input.trim().length > 0;
  const showDiscovery = discoveryResults !== null || discoveryLoading;
  const showAgent = agentMessages.length > 0;
  const totalEndpoints = connections.reduce((sum, c) => sum + c.endpoints.length, 0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSelectEndpoint = useCallback((result: SearchResult) => {
    const store = useRequestStore.getState();
    const ep = result.endpoint;
    const conn = result.connection;
    const url = conn.baseUrl + ep.path;

    let body: any = { type: 'none' };
    if (ep.requestBody) {
      if (ep.requestBody.example) {
        body = { type: 'json', raw: ep.requestBody.example };
      } else {
        const bodyParams = (ep.parameters || []).filter(p => p.in === 'body');
        if (bodyParams.length > 0) {
          const template: Record<string, any> = {};
          for (const bp of bodyParams) {
            if (bp.type === 'integer' || bp.type === 'number') template[bp.name] = 0;
            else if (bp.type === 'boolean') template[bp.name] = false;
            else if (bp.type.endsWith('[]')) template[bp.name] = [];
            else if (bp.type === 'object') template[bp.name] = {};
            else template[bp.name] = '';
          }
          body = { type: 'json', raw: JSON.stringify(template, null, 2) };
        }
      }
    }

    store.updateActiveRequest({
      url,
      method: ep.method,
      connectionId: conn.id,
      endpointId: ep.id,
      name: ep.summary || `${ep.method} ${ep.path}`,
      headers: [{ key: '', value: '', enabled: true }],
      params: (ep.parameters || []).filter(p => p.in === 'query').map(p => ({
        key: p.name,
        value: '',
        enabled: true,
      })),
      body,
    });
    setActiveView('requests');
    setInput('');
  }, [setActiveView]);

  const handleSubmit = async () => {
    if (!input.trim() || processing || discoveryLoading) return;

    if (!aiModeEnabled) {
      if (searchResults.length > 0) {
        handleSelectEndpoint(searchResults[0]);
        return;
      }
      const trimmed = input.trim();
      if (isUrl(trimmed)) {
        handleUrlInput(trimmed);
        return;
      }
      if (isMethodPath(trimmed)) {
        handleMethodPath(trimmed);
        return;
      }
      return;
    }

    setProcessing(true);
    clearMessages();
    const trimmed = input.trim();

    if (isUrl(trimmed)) {
      handleUrlInput(trimmed);
      setProcessing(false);
    } else if (isMethodPath(trimmed)) {
      handleMethodPath(trimmed);
      setProcessing(false);
    } else if (isDiscoveryQuery(trimmed)) {
      await handleDiscovery(trimmed);
      setProcessing(false);
    } else {
      await handleAiInput(trimmed);
    }
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
      setActiveView('requests');
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
    setActiveView('requests');
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
      setActiveView('requests');
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
        description: 'Discovery failed. Make sure an AI provider key is configured in Settings.',
        baseUrl: '',
        specType: 'openapi',
        endpointCount: 0,
        endpoints: [],
        error: 'Discovery failed',
      }]);
    }
    setDiscoveryLoading(false);
  };

  const connectResults = (results: DiscoveryResult[]) => {
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
  };

  const handleConnectDiscovered = (results: DiscoveryResult[]) => {
    connectResults(results);
    setActiveView('connections');
  };

  const handleConnectAndExplore = (results: DiscoveryResult[]) => {
    connectResults(results);
    localStorage.setItem('ruke:explorer_open', 'true');
    setActiveView('requests');
  };

  const buildApiContext = (): string => {
    if (connections.length === 0) return 'No APIs connected yet. The user needs to connect an API first before you can create requests for it.';

    const parts: string[] = ['# Connected APIs\n'];
    for (const conn of connections) {
      parts.push(`## ${conn.name}`);
      parts.push(`connectionId: "${conn.id}"`);
      parts.push(`Base URL: ${conn.baseUrl}`);
      if (conn.description) parts.push(`Description: ${conn.description}`);

      const authType = conn.auth?.type;
      if (authType && authType !== 'none') {
        parts.push(`Auth: ${authType} (already configured — do NOT add Authorization headers)`);
      } else {
        parts.push(`Auth: none (you should include Authorization headers if needed)`);
      }

      if (conn.endpoints.length === 0) {
        parts.push('(no endpoints loaded)\n');
        continue;
      }
      parts.push(`\nEndpoints (${conn.endpoints.length} total):`);
      for (const ep of conn.endpoints.slice(0, 80)) {
        let line = `  ${ep.method} ${ep.path} [endpointId: "${ep.id}"]`;
        if (ep.summary && ep.summary !== `${ep.method} ${ep.path}`) line += ` — ${ep.summary}`;
        if (ep.requestBody) {
          line += ` [body: ${ep.requestBody.type || 'json'}`;
          if (ep.requestBody.example) line += `, example available`;
          line += ']';
        }
        if (ep.parameters?.length) {
          const params = ep.parameters.filter(p => p.in === 'query' || p.in === 'path');
          if (params.length) line += ` (params: ${params.map(p => `${p.name}:${p.in}${p.required ? '*' : ''}`).join(', ')})`;
        }
        parts.push(line);
      }
      if (conn.endpoints.length > 80) {
        parts.push(`  ... and ${conn.endpoints.length - 80} more`);
      }
      parts.push('');
    }
    return parts.join('\n');
  };

  const parseAiResponse = (content: string): { action: string; request?: any; collection?: any; updates?: any[]; message?: string } | null => {
    const raw = content.trim();

    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonSource = fenceMatch ? fenceMatch[1].trim() : raw;
    const textBeforeFence = fenceMatch ? raw.slice(0, raw.indexOf('```')).trim() : '';

    const braceStart = jsonSource.indexOf('{');
    if (braceStart === -1) return null;
    let depth = 0;
    let braceEnd = -1;
    for (let i = braceStart; i < jsonSource.length; i++) {
      if (jsonSource[i] === '{') depth++;
      else if (jsonSource[i] === '}') { depth--; if (depth === 0) { braceEnd = i; break; } }
    }
    if (braceEnd === -1) return null;

    try {
      const obj = JSON.parse(jsonSource.slice(braceStart, braceEnd + 1));
      const message = textBeforeFence || undefined;
      if (obj.action === 'update_requests' && obj.updates) return { ...obj, message };
      if (obj.action === 'create_request' && obj.request) return { ...obj, message };
      if (obj.action === 'create_collection' && obj.collection) return { ...obj, message };
      if (obj.request) return { action: 'create_request', request: obj.request, message };
      if (obj.collection) return { action: 'create_collection', collection: obj.collection, message };
      if (obj.method && obj.url) return { action: 'create_request', request: obj, message };
    } catch {}
    return null;
  };

  const enrichRequestFromSpec = (request: any): any => {
    if (!request.url) return request;
    const enriched = { ...request };
    const url = request.url;
    const method = (request.method || 'GET').toUpperCase();
    const norm = (s: string) => s.replace(/\/+$/, '').replace(/\/+/g, '/');

    if (enriched.connectionId && enriched.endpointId) {
      const conn = connections.find(c => c.id === enriched.connectionId);
      if (conn) {
        const ep = conn.endpoints.find(e => e.id === enriched.endpointId);
        if (ep) {
          if (!url.startsWith('http')) {
            enriched.url = ep.path;
          }
          if (ep.parameters?.length) {
            const queryParams = ep.parameters.filter(p => p.in === 'query').map(p => ({
              key: p.name, value: '', enabled: true,
            }));
            if (queryParams.length && !enriched.params?.length) enriched.params = queryParams;
            for (const p of ep.parameters.filter(p => p.in === 'path')) {
              enriched.url = enriched.url.replace(`{${p.name}}`, `{{${p.name}}}`);
            }
          }
          if (ep.requestBody?.example && (!enriched.body || enriched.body.type === 'none')) {
            enriched.body = { type: 'json', raw: ep.requestBody.example };
          }
          return enriched;
        }
      }
    }

    for (const conn of connections) {
      let extractedPath: string | null = null;
      if (url.startsWith('/')) {
        extractedPath = url;
      } else if (url.includes(conn.baseUrl)) {
        extractedPath = url.slice(url.indexOf(conn.baseUrl) + conn.baseUrl.length);
      } else {
        try {
          const urlObj = new URL(url);
          const baseObj = new URL(conn.baseUrl);
          if (urlObj.hostname === baseObj.hostname) {
            const basePath = norm(baseObj.pathname);
            const fullPath = norm(urlObj.pathname);
            extractedPath = fullPath.startsWith(basePath)
              ? fullPath.slice(basePath.length)
              : fullPath;
          }
        } catch {}
      }
      if (extractedPath === null) continue;

      if (!extractedPath.startsWith('/')) extractedPath = '/' + extractedPath;
      extractedPath = norm(extractedPath);

      const ep = conn.endpoints.find(e =>
        e.method.toUpperCase() === method && norm(e.path) === extractedPath
      );
      if (!ep) continue;

      enriched.connectionId = conn.id;
      enriched.endpointId = ep.id;
      enriched.url = ep.path;

      if (ep.parameters?.length) {
        const queryParams = ep.parameters.filter(p => p.in === 'query').map(p => ({
          key: p.name, value: '', enabled: true,
        }));
        if (queryParams.length && !enriched.params?.length) enriched.params = queryParams;
        for (const p of ep.parameters.filter(p => p.in === 'path')) {
          enriched.url = enriched.url.replace(`{${p.name}}`, `{{${p.name}}}`);
        }
      }
      if (ep.requestBody?.example && (!enriched.body || enriched.body.type === 'none')) {
        enriched.body = { type: 'json', raw: ep.requestBody.example };
      }
      break;
    }
    return enriched;
  };

  const handleAiInput = async (prompt: string) => {
    clearMessages();
    setInput('');
    setStatus({ type: 'thinking', text: 'Understanding your request...' });

    try {
      if (connections.length === 0) {
        setStatus({ type: 'error', text: 'No APIs connected. Connect an API first, then ask me to create requests.' });
        setProcessing(false);
        return;
      }

      const apiNames = connections.map(c => c.name).join(', ');
      setStatus({ type: 'action', text: `Exploring ${connections.length} API${connections.length !== 1 ? 's' : ''}: ${apiNames}` });

      const context = buildApiContext();
      const result = await window.ruke.ai.chat(
        [{ role: 'user', content: prompt, timestamp: new Date().toISOString() }],
        context
      );

      if (result.error) {
        setStatus({ type: 'error', text: result.error });
        setProcessing(false);
        return;
      }

      if (result.content) {
        const parsed = parseAiResponse(result.content);

        if (parsed?.message) {
          setStatus({ type: 'action', text: parsed.message });
        }

        if (parsed?.action === 'create_collection' && parsed.collection) {
          await handleCreateCollection(parsed.collection, prompt);
          return;
        }

        if (parsed?.action === 'create_request' && parsed.request) {
          await handleCreateRequest(parsed.request, prompt);
          return;
        }

        if (parsed?.action === 'update_requests' && parsed.updates) {
          await handleUpdateRequests(parsed.updates, prompt);
          return;
        }

        setStatus({ type: 'error', text: 'Could not understand the response. Try being more specific, e.g. "Create a POST request to chat completions".' });
      } else {
        setStatus({ type: 'error', text: 'No response from AI. Check your API key in Settings.' });
      }
    } catch {
      setStatus({ type: 'error', text: 'Something went wrong. Check your API key in Settings.' });
    }
    setProcessing(false);
  };

  const handleCreateRequest = async (request: any, prompt: string) => {
    const store = useRequestStore.getState();
    const enriched = enrichRequestFromSpec(request);
    const method = enriched.method || 'GET';
    const url = enriched.url || '';
    const name = enriched.name || prompt;

    setStatus({ type: 'action', text: `Creating ${method} ${name}...` });

    const tabId = store.addPendingTab({ name, method });

    await new Promise(r => setTimeout(r, 400));

    store.resolvePendingTab(tabId, {
      method,
      url,
      headers: enriched.headers || [{ key: '', value: '', enabled: true }],
      params: enriched.params || [{ key: '', value: '', enabled: true }],
      body: enriched.body || { type: 'none' },
      auth: enriched.auth || { type: 'none' },
      connectionId: enriched.connectionId,
      endpointId: enriched.endpointId,
      name,
    });

    setStatus({
      type: 'result',
      text: `Created ${method} request`,
      detail: name,
      onClick: () => {
        store.switchTab(tabId);
        setActiveView('requests');
      },
    });

    setProcessing(false);
  };

  const handleCreateCollection = async (collection: any, prompt: string) => {
    const collectionName = collection.name || prompt;
    const requests = collection.requests || [];

    setStatus({ type: 'action', text: `Creating collection "${collectionName}"...` });

    const collStore = useCollectionStore.getState();
    const newCollection = await collStore.createCollection(collectionName);
    collStore.toggleExpanded(newCollection.id);

    const reqStore = useRequestStore.getState();

    for (let i = 0; i < requests.length; i++) {
      const req = requests[i];
      const enriched = enrichRequestFromSpec(req);
      const method = enriched.method || 'GET';
      const name = enriched.name || `${method} request`;

      setStatus({ type: 'action', text: `Creating request ${i + 1}/${requests.length}: ${name}` });

      const tabId = reqStore.addPendingTab({
        name,
        method,
        collectionId: newCollection.id,
      });

      await new Promise(r => setTimeout(r, 250));

      const resolved = {
        method,
        url: enriched.url || '',
        headers: enriched.headers || [{ key: '', value: '', enabled: true }],
        params: enriched.params || [{ key: '', value: '', enabled: true }],
        body: enriched.body || { type: 'none' },
        auth: enriched.auth || { type: 'none' },
        connectionId: enriched.connectionId,
        endpointId: enriched.endpointId,
        name,
        collectionId: newCollection.id,
      };

      reqStore.resolvePendingTab(tabId, resolved);

      const savedReq = useRequestStore.getState().openTabs.find(t => t.id === tabId);
      if (savedReq) {
        try {
          await window.ruke.db.query('createRequest', { ...savedReq, collectionId: newCollection.id });
        } catch (e) {
          console.error('[agent] failed to persist request:', e);
        }
      }
    }

    await collStore.loadRequests(newCollection.id);

    setStatus({
      type: 'result',
      text: `Created "${collectionName}" with ${requests.length} request${requests.length !== 1 ? 's' : ''}`,
      onClick: () => setActiveView('requests'),
    });

    setProcessing(false);
  };

  const handleUpdateRequests = async (updates: any[], prompt: string) => {
    const store = useRequestStore.getState();
    let updated = 0;

    for (const update of updates) {
      const match = update.match;
      const tab = store.openTabs.find(t =>
        (t.name || '').toLowerCase() === match.toLowerCase() ||
        (t.name || '').toLowerCase().includes(match.toLowerCase()) ||
        t.id === match
      );

      if (!tab) continue;

      setStatus({ type: 'action', text: `Updating "${tab.name}"...` });

      const changes: Record<string, any> = {};
      if (update.changes?.name) changes.name = update.changes.name;
      if (update.changes?.method) changes.method = update.changes.method;
      if (update.changes?.url) changes.url = update.changes.url;
      if (update.changes?.headers) changes.headers = update.changes.headers;
      if (update.changes?.body) changes.body = update.changes.body;
      if (update.changes?.params) changes.params = update.changes.params;

      const currentActive = store.activeTabId;
      store.switchTab(tab.id);
      store.updateActiveRequest({ ...changes, updatedAt: new Date().toISOString() });
      if (currentActive !== tab.id) store.switchTab(currentActive);

      try {
        const savedTab = useRequestStore.getState().openTabs.find(t => t.id === tab.id);
        if (savedTab && tab.collectionId) {
          await window.ruke.db.query('updateRequest', savedTab.id, savedTab);
        }
      } catch {}

      updated++;
      await new Promise(r => setTimeout(r, 200));
    }

    setStatus({
      type: 'result',
      text: `Updated ${updated} request${updated !== 1 ? 's' : ''}`,
      onClick: () => setActiveView('requests'),
    });

    setProcessing(false);
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
      { name: 'API Specs & Schemas', extensions: ['json', 'yaml', 'yml', 'graphql', 'gql', 'proto'] },
    ]);
    if (result.success) {
      if (result.path?.endsWith('.proto')) {
        setActiveView('connections');
        return;
      }
      if (result.content) {
        const conn = useConnectionStore.getState().importOpenApiSpec(result.content, result.path);
        if (conn) {
          setActiveView('connections');
        }
      }
    }
  };

  return (
    <div
      className="h-full flex flex-col items-center justify-center overflow-y-auto"
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={handleFileDrop}
    >
      <div className="w-full max-w-2xl px-6 py-6 flex flex-col items-center">

        {/* Mode Toggle + Stats Bar */}
        <div className="w-full flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <AiModeToggle
              enabled={aiModeEnabled}
              onToggle={() => {
                if (!aiModeEnabled && !hasAiKey()) {
                  setActiveView('settings');
                  return;
                }
                toggleAiMode();
              }}
              hasKey={hasAiKey()}
            />
            {connections.length > 0 && (
              <span className="text-[10px] text-text-muted">
                {totalEndpoints} endpoints across {connections.length} API{connections.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleFileClick}
              className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              <Upload size={11} /> Import
            </button>
            <button
              onClick={() => setActiveView('connections')}
              className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              <Plus size={11} /> Add API
            </button>
          </div>
        </div>

        {/* Command Bar */}
        <div className={`w-full relative ${showAgent ? 'mb-2' : 'mb-5'} transition-all`}>
          <div className={`relative flex items-center rounded-2xl ${aiModeEnabled ? 'command-bar-glow' : 'command-bar-search'}`}>
            {processing ? (
              <Loader2 size={16} className="absolute left-4 text-accent z-10 animate-spin" />
            ) : aiModeEnabled ? (
              <Sparkles size={16} className="absolute left-4 text-accent z-10" />
            ) : (
              <Search size={16} className="absolute left-4 text-text-muted z-10" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); if (agentMessages.length > 0 && !processing) clearMessages(); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
                if (e.key === 'Escape') {
                  setInput('');
                  clearMessages();
                  setDiscoveryResults(null);
                  setDiscoveryQuery('');
                }
              }}
              placeholder=""
              disabled={processing || discoveryLoading}
              className="w-full pl-11 pr-14 py-4 text-sm rounded-2xl bg-bg-secondary border border-transparent text-text-primary focus:outline-none transition-all disabled:opacity-60 relative"
            />
            {!input && processing && (
              <span className="absolute left-11 text-sm text-accent pointer-events-none select-none z-[2] flex items-center gap-2">
                <span className="agent-working-dots">Working on it</span>
              </span>
            )}
            {!input && !processing && !showDiscovery && (
              <WavePlaceholder text={placeholder.text} phase={placeholder.phase} />
            )}
            {!input && !processing && showDiscovery && (
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
              {processing || discoveryLoading
                ? <Loader2 size={16} className="animate-spin" />
                : aiModeEnabled
                  ? <Send size={16} />
                  : <ArrowRight size={16} />
              }
            </button>
          </div>
        </div>

        {/* Search Results (non-AI mode) */}
        {showSearchResults && (
          <div className="w-full mb-3 rounded-xl bg-bg-secondary/50 border border-border overflow-hidden">
            <EndpointSearchResults
              results={searchResults}
              query={input}
              onSelect={handleSelectEndpoint}
            />
          </div>
        )}

        {/* Agent Status */}
        {showAgent && (
          <div className="w-full mb-3">
            {agentMessages.map((msg) => (
              <div
                key={msg.id}
                className="discovery-result-enter flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
              >
                {(msg.type === 'thinking' || msg.type === 'action') && <Loader2 size={13} className="text-accent animate-spin shrink-0" />}
                {msg.type === 'result' && <Check size={13} className="text-green-400 shrink-0" />}
                {msg.type === 'error' && <AlertCircle size={13} className="text-red-400 shrink-0" />}
                <span className={`text-xs ${
                  msg.type === 'result' ? 'text-text-primary' :
                  msg.type === 'error' ? 'text-red-400' :
                  'text-text-muted'
                }`}>
                  {msg.text}
                </span>
                {msg.detail && (
                  <span
                    className={`text-[11px] font-mono ${msg.onClick ? 'text-accent cursor-pointer hover:underline' : 'text-text-muted'}`}
                    onClick={msg.onClick}
                  >
                    {msg.detail}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Discovery Results */}
        {showDiscovery && (
          <div className="w-full mb-4">
            <DiscoveryResults
              results={discoveryResults || []}
              query={discoveryQuery}
              loading={discoveryLoading}
              onConnect={handleConnectDiscovered}
              onConnectAndExplore={handleConnectAndExplore}
              onDismiss={() => {
                setDiscoveryResults(null);
                setDiscoveryQuery('');
                inputRef.current?.focus();
              }}
            />
          </div>
        )}

        {/* Main content when not searching */}
        {!showDiscovery && !showSearchResults && !showAgent && !input.trim() && (
          <>
            {/* AI CTA when AI is off */}
            {!aiModeEnabled && connections.length > 0 && (
              <div className="w-full mb-4">
                <AiCallToAction onEnable={() => {
                  if (hasAiKey()) {
                    setAiMode(true);
                  } else {
                    setActiveView('settings');
                  }
                }} />
              </div>
            )}

            {/* Quick Actions */}
            <div className="w-full">
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => { useRequestStore.getState().newRequest(); setActiveView('requests'); }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-bg-secondary border border-border hover:border-accent/30 hover:bg-accent/5 transition-all text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
                    <Plus size={16} className="text-accent" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-text-primary">New Request</p>
                    <p className="text-[10px] text-text-muted">Cmd+N</p>
                  </div>
                </button>
                <button
                  onClick={() => setActiveView('requests')}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-bg-secondary border border-border hover:border-border-light hover:bg-bg-tertiary transition-all text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
                    <Send size={14} className="text-accent" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-text-primary">Saved Requests</p>
                    <p className="text-[10px] text-text-muted">Collections</p>
                  </div>
                </button>
                {connections.length > 0 ? (
                  <button
                    onClick={() => setActiveView('connections')}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-bg-secondary border border-border hover:border-border-light hover:bg-bg-tertiary transition-all text-left group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
                      <Plug size={14} className="text-accent" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-text-primary">Connected APIs</p>
                      <p className="text-[10px] text-text-muted">{connections.length} connected</p>
                    </div>
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveView('connections')}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-accent/40 bg-accent/5 hover:bg-accent/10 hover:border-accent/60 transition-all text-left group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
                      <Globe size={14} className="text-accent" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-accent">Connect API</p>
                      <p className="text-[10px] text-text-muted">Add a spec</p>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
