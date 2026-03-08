import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRequestStore } from '../../stores/requestStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { Plus, Trash2, Code2, Table, Eye, EyeOff, ChevronDown, Info } from 'lucide-react';
import { TooltipMarkdown } from '../shared/markdownComponents';
import * as Tooltip from '@radix-ui/react-tooltip';
import type { KeyValue } from '@shared/types';

const COMMON_HEADERS: Record<string, { description: string; values?: string[] }> = {
  'Accept': { description: 'Media types the client can process', values: ['application/json', 'text/html', 'text/plain', 'application/xml', '*/*'] },
  'Accept-Encoding': { description: 'Compression algorithms the client supports', values: ['gzip', 'deflate', 'br', 'gzip, deflate, br'] },
  'Accept-Language': { description: 'Preferred languages for the response', values: ['en-US', 'en-US,en;q=0.9', 'en'] },
  'Authorization': { description: 'Credentials for authenticating with the server', values: ['Bearer ', 'Basic '] },
  'Cache-Control': { description: 'Caching directives for request/response', values: ['no-cache', 'no-store', 'max-age=0', 'no-cache, no-store'] },
  'Content-Type': { description: 'Media type of the request body', values: ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain', 'application/xml'] },
  'Cookie': { description: 'HTTP cookies previously sent by the server' },
  'If-None-Match': { description: 'Conditional request based on ETag' },
  'If-Modified-Since': { description: 'Conditional request based on last modified date' },
  'Origin': { description: 'Initiator of the request (for CORS)' },
  'Referer': { description: 'Address of the previous page' },
  'User-Agent': { description: 'Client software identification string' },
  'X-Request-ID': { description: 'Unique identifier for request tracing' },
  'X-Api-Key': { description: 'API key for authentication' },
  'X-Forwarded-For': { description: 'Originating IP of a client through a proxy' },
  'X-Correlation-ID': { description: 'ID used to correlate requests across services' },
};

const HEADER_NAMES = Object.keys(COMMON_HEADERS);

function HeaderKeySuggestions({
  query,
  onSelect,
  visible,
  selectedIndex,
}: {
  query: string;
  onSelect: (name: string) => void;
  visible: boolean;
  selectedIndex: number;
}) {
  const filtered = useMemo(() => {
    if (!query.trim()) return HEADER_NAMES.slice(0, 10);
    const q = query.toLowerCase();
    return HEADER_NAMES.filter((h) => h.toLowerCase().includes(q)).slice(0, 8);
  }, [query]);

  if (!visible || filtered.length === 0) return null;

  return (
    <div className="absolute top-full left-0 mt-1 w-72 bg-bg-secondary border border-border/60 rounded-lg shadow-2xl z-50 py-1 animate-fade-in max-h-52 overflow-y-auto">
      {filtered.map((name, i) => (
        <button
          key={name}
          onMouseDown={(e) => { e.preventDefault(); onSelect(name); }}
          className={`w-full flex items-start gap-2 px-3 py-1.5 text-left transition-colors ${
            i === selectedIndex ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
          }`}
        >
          <span className="text-xs font-mono font-medium shrink-0">{name}</span>
          <span className="text-[10px] text-text-muted truncate">{COMMON_HEADERS[name]?.description}</span>
        </button>
      ))}
    </div>
  );
}

function HeaderValueSuggestions({
  headerKey,
  query,
  onSelect,
  visible,
  selectedIndex,
}: {
  headerKey: string;
  query: string;
  onSelect: (value: string) => void;
  visible: boolean;
  selectedIndex: number;
}) {
  const suggestions = useMemo(() => {
    const known = COMMON_HEADERS[headerKey]?.values;
    if (!known) return [];
    if (!query.trim()) return known;
    const q = query.toLowerCase();
    return known.filter((v) => v.toLowerCase().includes(q));
  }, [headerKey, query]);

  if (!visible || suggestions.length === 0) return null;

  return (
    <div className="absolute top-full left-0 mt-1 w-64 bg-bg-secondary border border-border/60 rounded-lg shadow-2xl z-50 py-1 animate-fade-in max-h-40 overflow-y-auto">
      {suggestions.map((val, i) => (
        <button
          key={val}
          onMouseDown={(e) => { e.preventDefault(); onSelect(val); }}
          className={`w-full px-3 py-1.5 text-xs font-mono text-left transition-colors ${
            i === selectedIndex ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
          }`}
        >
          {val}
        </button>
      ))}
    </div>
  );
}

function HeaderRow({
  pair,
  index,
  onUpdate,
  onRemove,
  autoFocusKey,
}: {
  pair: KeyValue;
  index: number;
  onUpdate: (index: number, field: keyof KeyValue, val: string | boolean) => void;
  onRemove: (index: number) => void;
  autoFocusKey: boolean;
}) {
  const resolveString = useEnvironmentStore((s) => s.resolveString);
  const [keyFocused, setKeyFocused] = useState(false);
  const [valueFocused, setValueFocused] = useState(false);
  const [keySuggestionIdx, setKeySuggestionIdx] = useState(0);
  const [valueSuggestionIdx, setValueSuggestionIdx] = useState(0);
  const keyRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocusKey) keyRef.current?.focus();
  }, [autoFocusKey]);

  const resolvedValue = pair.value.includes('{{') ? resolveString(pair.value) : null;
  const headerInfo = COMMON_HEADERS[pair.key];
  const isDisabled = !pair.enabled;

  const handleKeySelect = (name: string) => {
    onUpdate(index, 'key', name);
    setKeyFocused(false);
    setKeySuggestionIdx(0);
    valueRef.current?.focus();
  };

  const handleValueSelect = (value: string) => {
    onUpdate(index, 'value', value);
    setValueFocused(false);
    setValueSuggestionIdx(0);
  };

  const handleKeyKeyDown = (e: React.KeyboardEvent) => {
    if (keyFocused) {
      const filtered = pair.key.trim()
        ? HEADER_NAMES.filter((h) => h.toLowerCase().includes(pair.key.toLowerCase())).slice(0, 8)
        : HEADER_NAMES.slice(0, 10);
      if (e.key === 'ArrowDown') { e.preventDefault(); setKeySuggestionIdx((i) => Math.min(i + 1, filtered.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setKeySuggestionIdx((i) => Math.max(i - 1, 0)); return; }
      if ((e.key === 'Tab' || e.key === 'Enter') && filtered[keySuggestionIdx]) {
        e.preventDefault();
        handleKeySelect(filtered[keySuggestionIdx]);
        return;
      }
      if (e.key === 'Escape') { setKeyFocused(false); return; }
    }
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      valueRef.current?.focus();
    }
  };

  const handleValueKeyDown = (e: React.KeyboardEvent) => {
    if (valueFocused) {
      const vals = COMMON_HEADERS[pair.key]?.values || [];
      const filtered = pair.value.trim() ? vals.filter((v) => v.toLowerCase().includes(pair.value.toLowerCase())) : vals;
      if (e.key === 'ArrowDown') { e.preventDefault(); setValueSuggestionIdx((i) => Math.min(i + 1, filtered.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setValueSuggestionIdx((i) => Math.max(i - 1, 0)); return; }
      if ((e.key === 'Tab' || e.key === 'Enter') && filtered[valueSuggestionIdx]) {
        e.preventDefault();
        handleValueSelect(filtered[valueSuggestionIdx]);
        return;
      }
      if (e.key === 'Escape') { setValueFocused(false); return; }
    }
  };

  return (
    <div className={`group grid grid-cols-[28px_1fr_1fr_28px] gap-0 items-stretch border-b border-border/50 last:border-b-0 transition-colors ${
      isDisabled ? 'opacity-40' : 'hover:bg-bg-hover/30'
    }`}>
      <div className="flex items-center justify-center border-r border-border/50">
        <input
          type="checkbox"
          checked={pair.enabled}
          onChange={(e) => onUpdate(index, 'enabled', e.target.checked)}
          className="w-3.5 h-3.5 rounded border-border accent-accent cursor-pointer"
        />
      </div>

      <div className="relative border-r border-border/50">
        <div className="flex items-center">
          <input
            ref={keyRef}
            type="text"
            value={pair.key}
            onChange={(e) => { onUpdate(index, 'key', e.target.value); setKeySuggestionIdx(0); }}
            onFocus={() => setKeyFocused(true)}
            onBlur={() => setTimeout(() => setKeyFocused(false), 150)}
            onKeyDown={handleKeyKeyDown}
            placeholder="Header name"
            spellCheck={false}
            disabled={isDisabled}
            className="w-full px-3 py-2 text-xs font-mono text-text-primary bg-transparent border-none outline-none placeholder:text-text-muted/30 disabled:cursor-not-allowed"
          />
          {headerInfo && !keyFocused && (
            <Tooltip.Provider delayDuration={200}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button className="pr-2 text-text-muted/25 hover:text-text-muted transition-colors">
                    <Info size={11} />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="top"
                    sideOffset={4}
                    className="max-w-xs px-3 py-2 rounded-lg bg-bg-secondary border border-border text-[11px] text-text-secondary leading-relaxed shadow-xl z-[100]"
                  >
                    <TooltipMarkdown content={headerInfo.description} />
                    <Tooltip.Arrow className="fill-border" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
          )}
        </div>
        <HeaderKeySuggestions
          query={pair.key}
          onSelect={handleKeySelect}
          visible={keyFocused}
          selectedIndex={keySuggestionIdx}
        />
      </div>

      <div className="relative">
        <input
          ref={valueRef}
          type="text"
          value={pair.value}
          onChange={(e) => { onUpdate(index, 'value', e.target.value); setValueSuggestionIdx(0); }}
          onFocus={() => setValueFocused(true)}
          onBlur={() => setTimeout(() => setValueFocused(false), 150)}
          onKeyDown={handleValueKeyDown}
          placeholder="Value"
          spellCheck={false}
          disabled={isDisabled}
          className="w-full px-3 py-2 text-xs font-mono text-text-primary bg-transparent border-none outline-none placeholder:text-text-muted/30 disabled:cursor-not-allowed"
        />
        {resolvedValue && resolvedValue !== pair.value && (
          <div className="absolute bottom-0.5 left-3 text-[9px] text-accent/70 font-mono truncate max-w-[calc(100%-24px)]">
            = {resolvedValue}
          </div>
        )}
        <HeaderValueSuggestions
          headerKey={pair.key}
          query={pair.value}
          onSelect={handleValueSelect}
          visible={valueFocused}
          selectedIndex={valueSuggestionIdx}
        />
      </div>

      <div className="flex items-center justify-center">
        <button
          onClick={() => onRemove(index)}
          className="p-1 rounded text-text-muted/20 hover:text-error hover:bg-error/10 opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function BulkEditor({
  headers,
  onChange,
}: {
  headers: KeyValue[];
  onChange: (headers: KeyValue[]) => void;
}) {
  const [text, setText] = useState(() =>
    headers
      .filter((h) => h.key.trim())
      .map((h) => `${h.enabled ? '' : '// '}${h.key}: ${h.value}`)
      .join('\n')
  );

  const handleBlur = () => {
    const parsed: KeyValue[] = text
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const disabled = line.trimStart().startsWith('//');
        const clean = disabled ? line.replace(/^\s*\/\/\s*/, '') : line;
        const colonIdx = clean.indexOf(':');
        if (colonIdx === -1) return { key: clean.trim(), value: '', enabled: !disabled };
        return {
          key: clean.slice(0, colonIdx).trim(),
          value: clean.slice(colonIdx + 1).trim(),
          enabled: !disabled,
        };
      });
    if (parsed.length === 0) parsed.push({ key: '', value: '', enabled: true });
    onChange(parsed);
  };

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden bg-bg-secondary">
      <div className="px-3 py-1.5 border-b border-border/50 bg-bg-tertiary/50">
        <span className="text-[10px] text-text-muted">
          One header per line as <code className="text-accent/80">Key: Value</code> — prefix with <code className="text-accent/80">//</code> to disable
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        rows={Math.max(headers.length + 1, 5)}
        spellCheck={false}
        className="w-full px-3 py-2 text-xs font-mono text-text-primary bg-transparent border-none outline-none resize-y placeholder:text-text-muted/30 min-h-[100px]"
        placeholder={'Content-Type: application/json\nAuthorization: Bearer {{token}}\n// X-Debug: true'}
      />
    </div>
  );
}

function PresetMenu({ onSelect }: { onSelect: (headers: KeyValue[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const presets = [
    {
      label: 'JSON API',
      headers: [
        { key: 'Content-Type', value: 'application/json', enabled: true },
        { key: 'Accept', value: 'application/json', enabled: true },
      ],
    },
    {
      label: 'Form POST',
      headers: [
        { key: 'Content-Type', value: 'application/x-www-form-urlencoded', enabled: true },
      ],
    },
    {
      label: 'CORS Preflight',
      headers: [
        { key: 'Origin', value: '', enabled: true },
        { key: 'Access-Control-Request-Method', value: 'POST', enabled: true },
        { key: 'Access-Control-Request-Headers', value: 'Content-Type', enabled: true },
      ],
    },
    {
      label: 'No Cache',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store', enabled: true },
        { key: 'Pragma', value: 'no-cache', enabled: true },
      ],
    },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 text-[10px] text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
      >
        Presets
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-44 bg-bg-secondary border border-border/60 rounded-lg shadow-2xl z-50 py-1 animate-fade-in">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => { onSelect(p.headers); setOpen(false); }}
              className="w-full px-3 py-1.5 text-xs text-left text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function HeadersEditor() {
  const activeRequest = useRequestStore((s) => s.activeRequest);
  const setHeaders = useRequestStore((s) => s.setHeaders);
  const [bulkMode, setBulkMode] = useState(false);
  const [lastAddedIdx, setLastAddedIdx] = useState(-1);

  const headers = activeRequest.headers;
  const activeCount = headers.filter((h) => h.enabled && h.key.trim()).length;
  const disabledCount = headers.filter((h) => !h.enabled && h.key.trim()).length;

  const update = useCallback((index: number, field: keyof KeyValue, val: string | boolean) => {
    const updated = headers.map((p, i) =>
      i === index ? { ...p, [field]: val } : p
    );
    setHeaders(updated);
  }, [headers, setHeaders]);

  const add = useCallback(() => {
    const newHeaders = [...headers, { key: '', value: '', enabled: true }];
    setHeaders(newHeaders);
    setLastAddedIdx(newHeaders.length - 1);
  }, [headers, setHeaders]);

  const remove = useCallback((index: number) => {
    const updated = headers.filter((_, i) => i !== index);
    if (updated.length === 0) {
      setHeaders([{ key: '', value: '', enabled: true }]);
    } else {
      setHeaders(updated);
    }
  }, [headers, setHeaders]);

  const addPreset = useCallback((preset: KeyValue[]) => {
    const existingKeys = new Set(headers.map((h) => h.key.toLowerCase()));
    const newHeaders = preset.filter((p) => !existingKeys.has(p.key.toLowerCase()));
    if (newHeaders.length > 0) {
      setHeaders([...headers.filter((h) => h.key.trim()), ...newHeaders, { key: '', value: '', enabled: true }]);
    }
  }, [headers, setHeaders]);

  const toggleAll = useCallback(() => {
    const allEnabled = headers.every((h) => h.enabled);
    setHeaders(headers.map((h) => ({ ...h, enabled: !allEnabled })));
  }, [headers, setHeaders]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <span className="text-[10px] text-text-muted tabular-nums">
              {activeCount} header{activeCount !== 1 ? 's' : ''}
              {disabledCount > 0 && <span className="text-text-muted/50"> ({disabledCount} disabled)</span>}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {headers.some((h) => h.key.trim()) && (
            <button
              onClick={toggleAll}
              className="flex items-center gap-1 px-2 py-1 text-[10px] text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
              title={headers.every((h) => h.enabled) ? 'Disable all' : 'Enable all'}
            >
              {headers.every((h) => h.enabled) ? <EyeOff size={11} /> : <Eye size={11} />}
            </button>
          )}
          <PresetMenu onSelect={addPreset} />
          <div className="flex gap-0.5 p-0.5 rounded-md bg-bg-secondary/60">
            <button
              onClick={() => setBulkMode(false)}
              className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all duration-150 ${
                !bulkMode ? 'bg-bg-tertiary text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <Table size={11} />
            </button>
            <button
              onClick={() => setBulkMode(true)}
              className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all duration-150 ${
                bulkMode ? 'bg-bg-tertiary text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <Code2 size={11} />
            </button>
          </div>
        </div>
      </div>

      {bulkMode ? (
        <BulkEditor headers={headers} onChange={setHeaders} />
      ) : (
        <div className="rounded-lg border border-border/60 overflow-hidden bg-bg-secondary">
          <div className="grid grid-cols-[28px_1fr_1fr_28px] gap-0 border-b border-border bg-bg-tertiary/50">
            <div className="flex items-center justify-center py-1.5">
              <input
                type="checkbox"
                checked={headers.length > 0 && headers.every((h) => h.enabled)}
                onChange={toggleAll}
                className="w-3 h-3 rounded border-border accent-accent cursor-pointer opacity-50"
                title="Toggle all"
              />
            </div>
            <div className="px-3 py-1.5 text-[10px] text-text-muted uppercase tracking-wider font-semibold border-l border-r border-border/50">
              Key
            </div>
            <div className="px-3 py-1.5 text-[10px] text-text-muted uppercase tracking-wider font-semibold">
              Value
            </div>
            <div />
          </div>

          {headers.map((pair, i) => (
            <HeaderRow
              key={i}
              pair={pair}
              index={i}
              onUpdate={update}
              onRemove={remove}
              autoFocusKey={i === lastAddedIdx}
            />
          ))}

          <div className="border-t border-border/50">
            <button
              onClick={add}
              className="flex items-center gap-1.5 w-full px-3 py-2 text-[11px] text-text-muted hover:text-text-primary hover:bg-bg-hover/50 transition-colors"
            >
              <Plus size={12} />
              <span>Add header</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
