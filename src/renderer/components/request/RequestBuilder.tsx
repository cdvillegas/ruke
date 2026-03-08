import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useRequestStore } from '../../stores/requestStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { ConnectionSelector } from './ConnectionSelector';
import { EnvironmentPill } from './EnvironmentPill';
import { ParameterEditor } from './ParameterEditor';
import { HeadersEditor } from './HeadersEditor';
import { BodyEditor } from './BodyEditor';
import { AuthEditor } from './AuthEditor';
import { HTTP_METHODS, METHOD_COLORS } from '@shared/constants';
import type { HttpMethod, ApiEndpoint, ApiConnection } from '@shared/types';
import {
  Send, Loader2, ChevronDown, Search, Shield, Check,
  FileText, Braces, SlidersHorizontal, Cloud,
} from 'lucide-react';
import { VariableInput } from '../shared/VariableInput';

const MUTED_METHOD_COLORS: Record<string, string> = {
  GET: '#6bc98f',
  POST: '#d4a94a',
  PUT: '#6a9fd8',
  PATCH: '#a07dd4',
  DELETE: '#d47272',
  HEAD: '#8b8fa0',
  OPTIONS: '#8b8fa0',
};

function EndpointPicker({
  connection,
  onSelect,
  selectedEndpointId,
  requestMethod,
  requestUrl,
  onHealEndpointId,
}: {
  connection: ApiConnection;
  onSelect: (ep: ApiEndpoint) => void;
  selectedEndpointId?: string;
  requestMethod?: string;
  requestUrl?: string;
  onHealEndpointId?: (newId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  let selectedEndpoint = connection.endpoints.find((e) => e.id === selectedEndpointId);

  if (!selectedEndpoint && selectedEndpointId && requestMethod && requestUrl) {
    const normalize = (s: string) => s.replace(/\/+$/, '');
    selectedEndpoint = connection.endpoints.find(
      (e) => e.method === requestMethod && normalize(e.path) === normalize(requestUrl)
    );
    if (selectedEndpoint && onHealEndpointId) {
      onHealEndpointId(selectedEndpoint.id);
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return connection.endpoints;
    const q = search.toLowerCase();
    return connection.endpoints.filter(
      (ep) =>
        ep.path.toLowerCase().includes(q) ||
        ep.summary.toLowerCase().includes(q) ||
        ep.method.toLowerCase().includes(q) ||
        (ep.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }, [connection.endpoints, search]);

  const tags = useMemo(() => {
    const tagMap = new Map<string, ApiEndpoint[]>();
    for (const ep of filtered) {
      const tag = ep.tags?.[0] || 'Other';
      if (!tagMap.has(tag)) tagMap.set(tag, []);
      tagMap.get(tag)!.push(ep);
    }
    return tagMap;
  }, [filtered]);

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-tertiary border border-border text-left hover:border-border-light transition-colors"
      >
        {selectedEndpoint ? (
          <>
            <span
              className="font-mono font-bold text-[10px] shrink-0"
              style={{ color: METHOD_COLORS[selectedEndpoint.method] || '#6b7280' }}
            >
              {selectedEndpoint.method}
            </span>
            <span className="text-xs font-mono text-text-primary truncate flex-1">
              {selectedEndpoint.path}
            </span>
            {selectedEndpoint.summary && selectedEndpoint.summary !== `${selectedEndpoint.method} ${selectedEndpoint.path}` && (
              <span className="text-[10px] text-text-muted truncate max-w-48">
                {selectedEndpoint.summary}
              </span>
            )}
          </>
        ) : (
          <span className="text-xs text-text-muted flex-1">Select an endpoint...</span>
        )}
        <ChevronDown size={14} className="text-text-muted shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-bg-secondary border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
          <div className="px-2 py-2 border-b border-border">
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search endpoints..."
                className="w-full pl-7 pr-2 py-1.5 text-xs rounded-lg bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {tags.size > 1
              ? Array.from(tags.entries()).map(([tag, endpoints]) => (
                  <div key={tag}>
                    <div className="px-3 py-1 text-[9px] text-text-muted uppercase tracking-wider font-semibold sticky top-0 bg-bg-secondary">
                      {tag}
                    </div>
                    {endpoints.map((ep) => (
                      <EndpointOption
                        key={ep.id}
                        ep={ep}
                        selected={ep.id === selectedEndpointId}
                        onSelect={() => { onSelect(ep); setOpen(false); setSearch(''); }}
                      />
                    ))}
                  </div>
                ))
              : filtered.map((ep) => (
                  <EndpointOption
                    key={ep.id}
                    ep={ep}
                    selected={ep.id === selectedEndpointId}
                    onSelect={() => { onSelect(ep); setOpen(false); setSearch(''); }}
                  />
                ))}
            {filtered.length === 0 && (
              <p className="text-xs text-text-muted text-center py-4">No endpoints match "{search}"</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EndpointOption({
  ep,
  selected,
  onSelect,
}: {
  ep: ApiEndpoint;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
        selected ? 'bg-accent/10' : 'hover:bg-bg-hover'
      }`}
    >
      <span
        className="font-mono font-bold text-[9px] w-12 shrink-0"
        style={{ color: METHOD_COLORS[ep.method] || '#6b7280' }}
      >
        {ep.method}
      </span>
      <span className="text-xs font-mono text-text-primary truncate flex-1">{ep.path}</span>
      {ep.summary && ep.summary !== `${ep.method} ${ep.path}` && (
        <span className="text-[10px] text-text-muted truncate max-w-40">{ep.summary}</span>
      )}
      {selected && <Check size={12} className="text-accent shrink-0" />}
    </button>
  );
}

function MethodSelect({ value, onChange }: { value: HttpMethod; onChange: (m: HttpMethod) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 pr-2.5 py-2 rounded-lg bg-bg-tertiary border border-border text-sm font-mono font-bold focus:outline-none focus:border-accent transition-colors cursor-pointer hover:border-border-light"
        style={{ color: MUTED_METHOD_COLORS[value] || '#8b8fa0' }}
      >
        {value}
        <ChevronDown size={13} className="text-text-muted" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-bg-secondary border border-border rounded-lg shadow-xl z-50 overflow-hidden animate-fade-in min-w-[100px]">
          {HTTP_METHODS.map((m) => (
            <button
              key={m}
              onClick={() => { onChange(m); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm font-mono font-bold transition-colors ${
                m === value ? 'bg-bg-active' : 'hover:bg-bg-hover'
              }`}
              style={{ color: MUTED_METHOD_COLORS[m] || '#8b8fa0' }}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ResolvedUrlPreview({
  resolvedUrl,
  rawPath,
  onParamClick,
}: {
  resolvedUrl: string;
  rawPath: string;
  onParamClick: (paramName: string) => void;
}) {
  const segments = useMemo(() => {
    const parts: Array<{ text: string; isParam: boolean; paramName?: string }> = [];
    let baseUrl = resolvedUrl;

    try {
      const u = new URL(resolvedUrl);
      baseUrl = `${u.protocol}//${u.host}`;
    } catch {
      return [{ text: resolvedUrl, isParam: false }];
    }

    parts.push({ text: baseUrl, isParam: false });

    const regex = /(\{[^}]+\})|([^{]+)/g;
    let match;
    while ((match = regex.exec(rawPath)) !== null) {
      if (match[1]) {
        parts.push({ text: match[1], isParam: true, paramName: match[1].slice(1, -1) });
      } else {
        parts.push({ text: match[2], isParam: false });
      }
    }
    return parts;
  }, [resolvedUrl, rawPath]);

  return (
    <div className="flex items-center flex-wrap text-[11px] font-mono leading-relaxed">
      {segments.map((seg, i) =>
        seg.isParam ? (
          <button
            key={i}
            onClick={() => onParamClick(seg.paramName!)}
            className="px-1 rounded bg-accent/12 text-accent hover:bg-accent/20 transition-colors cursor-pointer"
          >
            {seg.text}
          </button>
        ) : (
          <span key={i} className="text-text-muted">{seg.text}</span>
        )
      )}
    </div>
  );
}

export function RequestBuilder() {
  const activeRequest = useRequestStore((s) => s.activeRequest);
  const setMethod = useRequestStore((s) => s.setMethod);
  const setUrl = useRequestStore((s) => s.setUrl);
  const setName = useRequestStore((s) => s.setName);
  const loading = useRequestStore((s) => s.loading);
  const sendRequest = useRequestStore((s) => s.sendRequest);
  const saveStatus = useRequestStore((s) => s.saveStatus);
  const updateActiveRequest = useRequestStore((s) => s.updateActiveRequest);
  const linkEndpoint = useRequestStore((s) => s.linkEndpoint);
  const pendingTabIds = useRequestStore((s) => s.pendingTabIds);
  const resolveVariables = useEnvironmentStore((s) => s.resolveVariables);
  const connections = useConnectionStore((s) => s.connections);
  const pending = pendingTabIds.includes(activeRequest.id);

  const [advancedTab, setAdvancedTab] = useState<'params' | 'headers' | 'body' | 'auth'>('params');
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const paramRefs = useRef<Record<string, HTMLElement | null>>({});

  const linkedConnection = activeRequest.connectionId
    ? connections.find((c) => c.id === activeRequest.connectionId)
    : null;

  const isLinked = !!linkedConnection;

  const resolvedUrl = useMemo(
    () => useRequestStore.getState().getResolvedUrl(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeRequest.url, activeRequest.connectionId, connections]
  );

  const handleSend = () => {
    const vars = resolveVariables();
    sendRequest(vars);
  };

  const handleSelectEndpoint = (ep: ApiEndpoint) => {
    const isSameEndpoint = activeRequest.endpointId === ep.id;
    linkEndpoint(ep.id);

    if (isSameEndpoint) return;

    const hasUserData =
      activeRequest.body.type !== 'none' ||
      activeRequest.params.some((p) => p.key && p.value);

    let body = activeRequest.body;
    if (!hasUserData && ep.requestBody) {
      const example = ep.requestBody.example;
      if (example) {
        body = { type: ep.requestBody.type, raw: example };
      } else {
        const bodyParams = (ep.parameters || []).filter(p => p.in === 'body');
        if (bodyParams.length > 0) {
          const template: Record<string, any> = {};
          for (const bp of bodyParams) {
            if (!bp.required) continue;
            if (bp.type === 'integer' || bp.type === 'number') template[bp.name] = 0;
            else if (bp.type === 'boolean') template[bp.name] = false;
            else if (bp.type.endsWith('[]')) template[bp.name] = [];
            else if (bp.type === 'object') template[bp.name] = {};
            else template[bp.name] = '';
          }
          body = { type: 'json', raw: JSON.stringify(template, null, 2) };
        } else {
          body = { type: ep.requestBody.type, raw: ep.requestBody.schema || '{}' };
        }
      }
    }

    const specParams = (ep.parameters || [])
      .filter((p) => p.in === 'query')
      .map((p) => {
        const existing = activeRequest.params.find((ap) => ap.key === p.name);
        const hasValue = !!(existing?.value);
        return { key: p.name, value: existing?.value || '', enabled: hasValue ? (existing?.enabled ?? true) : false };
      });

    const updates: Record<string, any> = {
      method: ep.method,
      url: ep.path,
      params: specParams,
      ...(!hasUserData ? { body } : {}),
    };

    if (!activeRequest.name || activeRequest.name === 'New Request') {
      updates.name = 'New Request';
    }

    updateActiveRequest(updates);
  };

  const handleParamChipClick = useCallback((paramName: string) => {
    const el = paramRefs.current[paramName];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const input = el.querySelector('input, select') as HTMLElement | null;
      input?.focus();
    }
  }, []);

  const endpointDef = linkedConnection?.endpoints.find(e => e.id === activeRequest.endpointId);
  const paramCount = activeRequest.params.filter((p) => p.enabled && p.key).length
    + (endpointDef?.parameters?.filter((p: { in: string }) => p.in !== 'body').length || 0);
  const headerCount = activeRequest.headers.filter((h) => h.enabled && h.key).length;
  const hasBody = activeRequest.body.type !== 'none';
  const hasAuth = activeRequest.auth.type !== 'none';

  return (
    <div className="relative">
      {pending && (
        <div className="absolute inset-0 z-30 rounded-xl bg-bg-primary/60 ghost-builder-overlay flex flex-col items-center justify-center gap-2 pointer-events-auto">
          <Loader2 size={20} className="text-accent animate-spin" />
          <span className="text-xs text-text-muted">AI is building this request...</span>
        </div>
      )}

      {/* Request name */}
      <div className="mb-2">
        {editingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={activeRequest.name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false);
            }}
            placeholder="Request name"
            className="w-full px-2 py-1.5 text-sm font-medium text-text-primary bg-bg-tertiary border border-accent/50 rounded-lg focus:outline-none focus:border-accent"
            autoFocus
          />
        ) : (
          <button
            onClick={() => {
              setEditingName(true);
              setTimeout(() => nameInputRef.current?.select(), 10);
            }}
            className="group flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary truncate max-w-full transition-colors"
            title="Click to rename"
          >
            <span className="truncate">{activeRequest.name || 'New Request'}</span>
          </button>
        )}
      </div>

      {/* Connection + Env on left, Save + Send on right */}
      <div className="flex items-center gap-2 mb-3">
        <ConnectionSelector />
        <EnvironmentPill />

        <div className="flex-1" />

        {saveStatus !== 'idle' && (
          <div className={`flex items-center gap-1.5 text-[11px] shrink-0 transition-opacity duration-300 ${
            saveStatus === 'saved' ? 'opacity-60' : 'opacity-100'
          }`}>
            {saveStatus === 'unsaved' && (
              <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
            )}
            {saveStatus === 'saving' && (
              <Loader2 size={11} className="text-text-muted animate-spin" />
            )}
            {saveStatus === 'saved' && (
              <Check size={11} className="text-success" />
            )}
            <span className={
              saveStatus === 'saved' ? 'text-success/80' : 'text-text-muted'
            }>
              {saveStatus === 'unsaved' ? 'Editing' : saveStatus === 'saving' ? 'Saving...' : 'Saved'}
            </span>
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={loading || pending}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium text-sm transition-all shrink-0 ${
            loading
              ? 'bg-accent send-btn-waiting cursor-wait'
              : pending
                ? 'bg-accent/50 cursor-not-allowed opacity-50'
                : 'bg-accent hover:bg-accent-hover'
          }`}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {loading ? 'Sending' : 'Send'}
        </button>
      </div>

      {/* Row 3: Endpoint / URL bar */}
      <div className="flex gap-2">
        {isLinked ? (
          <EndpointPicker
            connection={linkedConnection}
            onSelect={handleSelectEndpoint}
            selectedEndpointId={activeRequest.endpointId}
            requestMethod={activeRequest.method}
            requestUrl={activeRequest.url}
            onHealEndpointId={(newId) => linkEndpoint(newId)}
          />
        ) : (
          <>
            <MethodSelect
              value={activeRequest.method}
              onChange={(m) => setMethod(m)}
            />
            <VariableInput
              value={activeRequest.url}
              onChange={(v) => setUrl(v)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Enter URL or paste cURL..."
              className="w-full px-4 py-2 rounded-xl bg-bg-secondary border border-border text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
            />
          </>
        )}
      </div>

      {/* Resolved URL with clickable params */}
      {isLinked && activeRequest.url && (
        <div className="mt-1.5 mb-1 px-0.5">
          <ResolvedUrlPreview
            resolvedUrl={resolvedUrl}
            rawPath={activeRequest.url}
            onParamClick={handleParamChipClick}
          />
        </div>
      )}

      {/* Params / Headers / Body / Auth tabs */}
      <div className="mt-4 border-t border-border pt-3">
        <div className="flex gap-1 border-b border-border mb-3">
          {([
            { id: 'params' as const, label: 'Params', icon: SlidersHorizontal, active: paramCount > 0 },
            { id: 'headers' as const, label: 'Headers', icon: FileText, active: headerCount > 0 },
            { id: 'body' as const, label: 'Body', icon: Braces, active: hasBody },
            { id: 'auth' as const, label: 'Auth', icon: Shield, active: hasAuth },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setAdvancedTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors relative ${
                advancedTab === tab.id ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <tab.icon size={12} />
              <span>{tab.label}</span>
              <span className={`w-1.5 h-1.5 rounded-full ml-0.5 ${tab.active ? 'bg-success' : 'bg-text-muted/25'}`} />
              {advancedTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
              )}
            </button>
          ))}
        </div>

        <div className="pb-2">
          {advancedTab === 'params' && <ParameterEditor paramRefs={paramRefs} simpleMode={isLinked} />}
          {advancedTab === 'headers' && <HeadersEditor />}
          {advancedTab === 'body' && <BodyEditor />}
          {advancedTab === 'auth' && (
            <AuthEditor />
          )}
        </div>
      </div>
    </div>
  );
}
