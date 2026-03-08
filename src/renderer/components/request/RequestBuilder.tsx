import { useState, useMemo, useRef, useEffect } from 'react';
import { useRequestStore } from '../../stores/requestStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { ConnectionSelector } from './ConnectionSelector';
import { ParameterEditor } from './ParameterEditor';
import { HeadersEditor } from './HeadersEditor';
import { BodyEditor } from './BodyEditor';
import { AuthEditor } from './AuthEditor';
import { HTTP_METHODS, METHOD_COLORS } from '@shared/constants';
import type { HttpMethod, ApiEndpoint, ApiConnection } from '@shared/types';
import {
  Send, Loader2, Save, ChevronDown, ChevronRight,
  Search, Settings2, Shield, FileText, Braces, Check, Globe,
} from 'lucide-react';
import { VariableInput, VariableHighlight } from '../shared/VariableInput';

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
}: {
  connection: ApiConnection;
  onSelect: (ep: ApiEndpoint) => void;
  selectedEndpointId?: string;
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

  const selectedEndpoint = connection.endpoints.find((e) => e.id === selectedEndpointId);

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
    <div ref={ref} className="relative flex-1">
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

export function RequestBuilder() {
  const activeRequest = useRequestStore((s) => s.activeRequest);
  const setMethod = useRequestStore((s) => s.setMethod);
  const setUrl = useRequestStore((s) => s.setUrl);
  const loading = useRequestStore((s) => s.loading);
  const sendRequest = useRequestStore((s) => s.sendRequest);
  const saveRequest = useRequestStore((s) => s.saveRequest);
  const updateActiveRequest = useRequestStore((s) => s.updateActiveRequest);
  const linkEndpoint = useRequestStore((s) => s.linkEndpoint);
  const getResolvedUrl = useRequestStore((s) => s.getResolvedUrl);
  const isPending = useRequestStore((s) => s.isPending);
  const resolveVariables = useEnvironmentStore((s) => s.resolveVariables);
  const connections = useConnectionStore((s) => s.connections);
  const pending = isPending(activeRequest.id);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedTab, setAdvancedTab] = useState<'headers' | 'body' | 'auth'>('headers');

  const linkedConnection = activeRequest.connectionId
    ? connections.find((c) => c.id === activeRequest.connectionId)
    : null;

  const isLinked = !!linkedConnection;
  const resolvedUrl = getResolvedUrl();

  const handleSend = () => {
    const vars = resolveVariables();
    sendRequest(vars);
  };

  const handleSelectEndpoint = (ep: ApiEndpoint) => {
    linkEndpoint(ep.id);

    let body = activeRequest.body;
    if (ep.requestBody) {
      const example = ep.requestBody.example;
      if (example) {
        body = { type: ep.requestBody.type, raw: example };
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
        } else {
          body = { type: ep.requestBody.type, raw: ep.requestBody.schema || '{}' };
        }
      }
    }

    updateActiveRequest({
      method: ep.method,
      url: ep.path,
      name: ep.summary || `${ep.method} ${ep.path}`,
      params: (ep.parameters || [])
        .filter((p) => p.in === 'query')
        .map((p) => ({ key: p.name, value: '', enabled: true })),
      body,
    });
  };

  const headerCount = activeRequest.headers.filter((h) => h.enabled && h.key).length;
  const hasBody = activeRequest.body.type !== 'none';
  const hasAuth = activeRequest.auth.type !== 'none' || (linkedConnection?.auth.type !== 'none' && !!linkedConnection);

  const advancedTabs = [
    {
      id: 'headers' as const,
      label: 'Headers',
      icon: FileText,
      count: headerCount,
    },
    {
      id: 'body' as const,
      label: 'Body',
      icon: Braces,
      badge: hasBody ? activeRequest.body.type : undefined,
    },
    {
      id: 'auth' as const,
      label: 'Auth',
      icon: Shield,
      badge: activeRequest.auth.type !== 'none' ? activeRequest.auth.type :
             (linkedConnection?.auth.type !== 'none' ? `${linkedConnection?.auth.type} (via ${linkedConnection?.name})` : undefined),
    },
  ];

  return (
    <div className="space-y-3 relative">
      {pending && (
        <div className="absolute inset-0 z-30 rounded-xl bg-bg-primary/60 ghost-builder-overlay flex flex-col items-center justify-center gap-2 pointer-events-auto">
          <Loader2 size={20} className="text-accent animate-spin" />
          <span className="text-xs text-text-muted">AI is building this request...</span>
        </div>
      )}
      {/* Connection selector */}
      <ConnectionSelector />

      {/* Endpoint / URL bar + Send */}
      <div className="flex gap-2">
        {isLinked ? (
          <EndpointPicker
            connection={linkedConnection}
            onSelect={handleSelectEndpoint}
            selectedEndpointId={activeRequest.endpointId}
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
              className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </>
        )}

        <button
          onClick={() => saveRequest()}
          className="px-2.5 py-2 rounded-lg bg-bg-tertiary border border-border hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
          title="Save (Cmd+S)"
        >
          <Save size={14} />
        </button>

        <button
          onClick={handleSend}
          disabled={loading || pending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          <span>Send</span>
        </button>
      </div>

      {/* Resolved URL (when linked) */}
      {isLinked && activeRequest.url && (
        <div className="flex items-center gap-2 px-1 -mt-1">
          <Globe size={10} className="text-text-muted shrink-0" />
          <span className="text-[10px] text-text-muted truncate">
            <VariableHighlight text={resolvedUrl} />
          </span>
        </div>
      )}

      {/* Parameters + Body fields */}
      <ParameterEditor />

      {/* Advanced */}
      <div className="border-t border-border pt-1.5">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 px-1 py-1 text-xs text-text-muted hover:text-text-primary transition-colors w-full"
        >
          {showAdvanced ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <Settings2 size={12} />
          <span className="font-medium">Advanced</span>

          {!showAdvanced && (
            <div className="flex items-center gap-1.5 ml-auto">
              {headerCount > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted">
                  {headerCount} header{headerCount !== 1 ? 's' : ''}
                </span>
              )}
              {hasBody && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-warning/15 text-warning">
                  {activeRequest.body.type}
                </span>
              )}
              {hasAuth && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-success/15 text-success">
                  {activeRequest.auth.type !== 'none'
                    ? activeRequest.auth.type
                    : `${linkedConnection?.auth.type} ↗`}
                </span>
              )}
            </div>
          )}
        </button>

        {showAdvanced && (
          <div className="mt-2 animate-fade-in">
            <div className="flex gap-0.5 border-b border-border mb-3">
              {advancedTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setAdvancedTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors relative ${
                    advancedTab === tab.id
                      ? 'text-text-primary'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <tab.icon size={12} />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-accent/20 text-accent text-[9px]">
                      {tab.count}
                    </span>
                  )}
                  {tab.badge && (
                    <span className="px-1.5 py-0.5 rounded-full bg-warning/20 text-warning text-[9px]">
                      {tab.badge}
                    </span>
                  )}
                  {advancedTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
                  )}
                </button>
              ))}
            </div>

            <div className="pb-2">
              {advancedTab === 'headers' && <HeadersEditor />}
              {advancedTab === 'body' && <BodyEditor />}
              {advancedTab === 'auth' && (
                <div>
                  {linkedConnection?.auth.type !== 'none' && linkedConnection && activeRequest.auth.type === 'none' && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/5 border border-success/20 mb-3">
                      <Shield size={13} className="text-success shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-text-primary">
                          Using <span className="font-medium text-success">{linkedConnection.auth.type}</span> auth from {linkedConnection.name}
                        </p>
                        <p className="text-[10px] text-text-muted">Override below if this request needs different auth</p>
                      </div>
                    </div>
                  )}
                  <AuthEditor />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
