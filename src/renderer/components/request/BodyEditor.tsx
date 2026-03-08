import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useRequestStore } from '../../stores/requestStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { KeyValueEditor } from './KeyValueEditor';
import { InlineEditor } from '../shared/InlineEditor';
import type { BodyType, EndpointParam } from '@shared/types';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import { appEditorTheme, blockEditorExtensions } from '../shared/editorTheme';
import { Info, Plus, X } from 'lucide-react';
import yaml from 'js-yaml';

const RAW_PREF_KEY = 'ruke:body_show_raw';
const PRETTIFY_PREF_KEY = 'ruke:body_auto_prettify';

const BODY_TYPES: { id: BodyType; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'json', label: 'JSON' },
  { id: 'graphql', label: 'GraphQL' },
  { id: 'form-data', label: 'Form Data' },
  { id: 'x-www-form-urlencoded', label: 'URL Encoded' },
  { id: 'raw', label: 'Raw' },
];

function tryPrettifyJson(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return null;
  try {
    const parsed = JSON.parse(trimmed);
    const pretty = JSON.stringify(parsed, null, 2);
    return pretty !== trimmed ? pretty : null;
  } catch {
    return null;
  }
}

function tryPrettifyYaml(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('{') || trimmed.startsWith('[')) return null;
  try {
    const parsed = yaml.load(trimmed);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const pretty = yaml.dump(parsed, { indent: 2, lineWidth: 120, noRefs: true });
    return pretty.trim() !== trimmed ? pretty : null;
  } catch {
    return null;
  }
}

function detectFormat(raw: string): 'json' | 'yaml' | 'unknown' {
  const trimmed = raw.trim();
  if (!trimmed) return 'unknown';
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try { JSON.parse(trimmed); return 'json'; } catch {}
  }
  try {
    const parsed = yaml.load(trimmed);
    if (typeof parsed === 'object' && parsed !== null) return 'yaml';
  } catch {}
  return 'unknown';
}

function isComplexType(type: string): boolean {
  return type === 'object' || type === 'array' || type.endsWith('[]') || type.startsWith('object');
}

function isJsonLike(value: string): boolean {
  const t = value.trim();
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'));
}

function typeColor(type: string): string {
  switch (type) {
    case 'string': return 'text-emerald-400/70';
    case 'integer': case 'number': return 'text-orange-400/70';
    case 'boolean': return 'text-purple-400/70';
    case 'object': return 'text-blue-400/70';
    case 'array': return 'text-cyan-400/70';
    default:
      if (type.endsWith('[]')) return 'text-cyan-400/70';
      return 'text-text-muted/50';
  }
}

interface BodyFieldRow {
  key: string;
  value: string;
  required: boolean;
  type: string;
  description?: string;
  enumValues?: string[];
}

function buildBodyFieldRows(
  bodyRaw: string | undefined,
  bodyParams: EndpointParam[]
): BodyFieldRow[] {
  let bodyObj: Record<string, any> = {};
  if (bodyRaw) {
    try { bodyObj = JSON.parse(bodyRaw); } catch {}
  }

  return bodyParams.map((ep) => {
    const bodyVal = bodyObj[ep.name];
    return {
      key: ep.name,
      value: bodyVal !== undefined ? (typeof bodyVal === 'object' ? JSON.stringify(bodyVal) : String(bodyVal)) : '',
      required: ep.required,
      type: ep.type || 'string',
      description: ep.description,
      enumValues: ep.enumValues,
    };
  });
}

function BodyFieldInput({ row, onUpdate }: { row: BodyFieldRow; onUpdate: (value: string) => void }) {
  const isEnum = row.enumValues && row.enumValues.length > 0;
  const complex = isComplexType(row.type);
  const jsonLike = isJsonLike(row.value);
  const isMultiline = complex || jsonLike;

  if (isEnum) {
    return (
      <select
        value={row.value}
        onChange={(e) => onUpdate(e.target.value)}
        className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-bg-secondary border border-border font-mono text-text-primary focus:outline-none focus:border-accent/40 transition-colors cursor-pointer"
      >
        <option value="">Select...</option>
        {row.enumValues!.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
    );
  }

  if (row.type === 'boolean') {
    return (
      <select
        value={row.value}
        onChange={(e) => onUpdate(e.target.value)}
        className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-bg-secondary border border-border font-mono text-text-primary focus:outline-none focus:border-accent/40 transition-colors cursor-pointer"
      >
        <option value="">—</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  const displayValue = isMultiline && row.value ? (tryPrettifyJson(row.value) ?? row.value) : row.value;
  const placeholder = row.type === 'integer' || row.type === 'number' ? '0' : '';

  return (
    <InlineEditor
      value={displayValue}
      onChange={onUpdate}
      multiline={isMultiline}
      jsonMode={isMultiline}
      placeholder={placeholder}
    />
  );
}

function BodyFieldRowView({
  row,
  onUpdate,
  onRemove,
}: {
  row: BodyFieldRow;
  onUpdate: (value: string) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="group param-field-row">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-mono font-medium text-text-primary truncate">{row.key}</span>
          {row.required && <span className="text-[9px] font-bold text-error shrink-0">*</span>}
          <span className={`text-[10px] font-mono leading-none ${typeColor(row.type)}`}>{row.type}</span>
          {row.description && (
            <Tooltip.Provider delayDuration={150}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button className="text-text-muted/30 hover:text-text-muted transition-colors">
                    <Info size={10} />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="top"
                    align="start"
                    sideOffset={4}
                    className="max-w-sm px-3 py-2 rounded-lg bg-bg-secondary border border-border text-[11px] text-text-secondary leading-relaxed shadow-xl z-[100]"
                  >
                    {row.description.slice(0, 500)}{row.description.length > 500 ? '...' : ''}
                    <Tooltip.Arrow className="fill-border" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
          )}
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-error/10 text-text-muted/30 hover:text-error transition-all"
          >
            <X size={12} />
          </button>
        )}
      </div>
      <BodyFieldInput row={row} onUpdate={onUpdate} />
    </div>
  );
}

function AddOptionalFieldPicker({
  fields,
  onAdd,
}: {
  fields: BodyFieldRow[];
  onAdd: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (fields.length === 0) return null;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-dashed border-border/60 text-text-muted hover:text-text-primary hover:border-border-light hover:bg-bg-hover transition-colors"
      >
        <Plus size={12} />
        Add optional field
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-bg-secondary border border-border rounded-xl shadow-2xl z-50 py-1 animate-fade-in max-h-56 overflow-y-auto">
          {fields.map((f) => (
            <button
              key={f.key}
              onClick={() => { onAdd(f.key); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-hover transition-colors"
            >
              <span className="text-xs font-mono text-text-primary flex-1 truncate">{f.key}</span>
              <span className={`text-[10px] font-mono ${typeColor(f.type)}`}>{f.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Toggle({ enabled, onChange, label }: { enabled: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-secondary transition-colors"
    >
      <span>{label}</span>
      <div className={`relative w-6 h-3.5 rounded-full transition-colors ${enabled ? 'bg-accent' : 'bg-text-muted/20'}`}>
        <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-2.5' : 'translate-x-0.5'}`} />
      </div>
    </button>
  );
}

export function BodyEditor() {
  const activeRequest = useRequestStore((s) => s.activeRequest);
  const setBody = useRequestStore((s) => s.setBody);
  const connections = useConnectionStore((s) => s.connections);
  const body = activeRequest.body;
  const gql = body.graphql || { query: '', variables: '{}' };
  const lastPrettifiedId = useRef<string | null>(null);
  const [addedOptionalKeys, setAddedOptionalKeys] = useState<Set<string>>(new Set());
  const [showRaw, setShowRaw] = useState(() => localStorage.getItem(RAW_PREF_KEY) !== 'false');
  const [autoPrettify, setAutoPrettify] = useState(() => localStorage.getItem(PRETTIFY_PREF_KEY) !== 'false');

  const linkedEndpoint = useMemo(() => {
    if (!activeRequest.connectionId || !activeRequest.endpointId) return null;
    const conn = connections.find((c) => c.id === activeRequest.connectionId);
    if (!conn) return null;
    return conn.endpoints.find((e) => e.id === activeRequest.endpointId) || null;
  }, [activeRequest.connectionId, activeRequest.endpointId, connections]);

  const bodyParams = useMemo(
    () => linkedEndpoint?.parameters?.filter(p => p.in === 'body') || [],
    [linkedEndpoint]
  );

  const hasBodyFields = bodyParams.length > 0;

  const bodyFieldRows = useMemo(
    () => hasBodyFields ? buildBodyFieldRows(body.raw, bodyParams) : [],
    [body.raw, bodyParams, hasBodyFields]
  );

  const requiredRows = bodyFieldRows.filter(r => r.required);
  const optionalRows = bodyFieldRows.filter(r => !r.required);
  const visibleOptionalRows = optionalRows.filter(r => addedOptionalKeys.has(r.key));
  const hiddenOptionalRows = optionalRows.filter(r => !addedOptionalKeys.has(r.key));

  const updateBodyField = useCallback((key: string, rawValue: string) => {
    let currentBody: Record<string, any> = {};
    if (body.type === 'json' && body.raw) {
      try { currentBody = JSON.parse(body.raw); } catch {}
    }

    const paramDef = bodyParams.find(p => p.name === key);
    const paramType = paramDef?.type || 'string';

    if (rawValue === '') {
      delete currentBody[key];
    } else if (paramType === 'integer' || paramType === 'number') {
      const num = Number(rawValue);
      currentBody[key] = isNaN(num) ? rawValue : num;
    } else if (paramType === 'boolean') {
      currentBody[key] = rawValue === 'true';
    } else if (paramType.endsWith('[]') || paramType === 'array' || paramType === 'object') {
      try { currentBody[key] = JSON.parse(rawValue); } catch { currentBody[key] = rawValue; }
    } else {
      currentBody[key] = rawValue;
    }

    setBody({ ...body, type: 'json', raw: JSON.stringify(currentBody, null, 2) });
  }, [body, bodyParams, setBody]);

  const removeOptionalField = useCallback((key: string) => {
    setAddedOptionalKeys(prev => { const next = new Set(prev); next.delete(key); return next; });
    updateBodyField(key, '');
  }, [updateBodyField]);

  const handleToggleRaw = useCallback((v: boolean) => {
    setShowRaw(v);
    localStorage.setItem(RAW_PREF_KEY, String(v));
  }, []);

  const handleTogglePrettify = useCallback((v: boolean) => {
    setAutoPrettify(v);
    localStorage.setItem(PRETTIFY_PREF_KEY, String(v));
    if (v) prettifyNow();
  }, []);

  const prettifyNow = useCallback(() => {
    if (!body.raw) return;
    if (body.type === 'json') {
      const pretty = tryPrettifyJson(body.raw);
      if (pretty) setBody({ ...body, raw: pretty });
    } else if (body.type === 'raw') {
      const format = detectFormat(body.raw);
      if (format === 'json') {
        const pretty = tryPrettifyJson(body.raw);
        if (pretty) setBody({ ...body, raw: pretty });
      } else if (format === 'yaml') {
        const pretty = tryPrettifyYaml(body.raw);
        if (pretty) setBody({ ...body, raw: pretty });
      }
    }
  }, [body, setBody]);

  const prettifyGqlVars = useCallback(() => {
    const pretty = tryPrettifyJson(gql.variables);
    if (pretty) setBody({ ...body, graphql: { ...gql, variables: pretty } });
  }, [body, gql, setBody]);

  useEffect(() => {
    if (!autoPrettify) return;
    if (lastPrettifiedId.current === activeRequest.id) return;
    lastPrettifiedId.current = activeRequest.id;

    if ((body.type === 'json' || body.type === 'raw') && body.raw) {
      const format = body.type === 'json' ? 'json' : detectFormat(body.raw);
      if (format === 'json') {
        const pretty = tryPrettifyJson(body.raw);
        if (pretty) setBody({ ...body, raw: pretty });
      } else if (format === 'yaml') {
        const pretty = tryPrettifyYaml(body.raw);
        if (pretty) setBody({ ...body, raw: pretty });
      }
    }

    if (body.type === 'graphql' && gql.variables) {
      const pretty = tryPrettifyJson(gql.variables);
      if (pretty) setBody({ ...body, graphql: { ...gql, variables: pretty } });
    }
  }, [activeRequest.id, autoPrettify]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 flex-wrap">
        {BODY_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setBody({ ...body, type: t.id })}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              body.type === t.id
                ? 'bg-accent text-white'
                : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {body.type === 'none' && (
        <p className="text-xs text-text-muted py-4 text-center">
          This request does not have a body
        </p>
      )}

      {(body.type === 'json' || body.type === 'raw') && (
        <div className="space-y-3">
          {/* Structured fields for required + added optional params */}
          {hasBodyFields && body.type === 'json' && (
            <div className="space-y-1.5">
              {requiredRows.map((r) => (
                <BodyFieldRowView
                  key={r.key}
                  row={r}
                  onUpdate={(v) => updateBodyField(r.key, v)}
                />
              ))}
              {visibleOptionalRows.map((r) => (
                <BodyFieldRowView
                  key={r.key}
                  row={r}
                  onUpdate={(v) => updateBodyField(r.key, v)}
                  onRemove={() => removeOptionalField(r.key)}
                />
              ))}
              <AddOptionalFieldPicker
                fields={hiddenOptionalRows}
                onAdd={(key) => setAddedOptionalKeys(prev => new Set(prev).add(key))}
              />
            </div>
          )}

          {/* Raw / Prettify toggles */}
          <div className="flex items-center gap-4">
            {hasBodyFields && body.type === 'json' && (
              <Toggle enabled={showRaw} onChange={handleToggleRaw} label="Raw" />
            )}
            <Toggle enabled={autoPrettify} onChange={handleTogglePrettify} label="Prettify" />
          </div>

          {/* Raw editor — toggled when fields exist, always shown for freeform */}
          {(!hasBodyFields || body.type !== 'json' || showRaw) && (
            <div className="rounded-xl bg-bg-secondary border border-border overflow-hidden focus-within:border-accent/40 transition-colors">
              <CodeMirror
                key={activeRequest.id}
                value={body.raw || ''}
                onChange={(val) => {
                  setBody({ ...body, raw: val });
                  if (autoPrettify) {
                    lastPrettifiedId.current = null;
                  }
                }}
                extensions={body.type === 'json' ? [json(), blockEditorExtensions, EditorView.lineWrapping] : [blockEditorExtensions, EditorView.lineWrapping]}
                theme={appEditorTheme}
                minHeight="80px"
                maxHeight="300px"
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  bracketMatching: true,
                  closeBrackets: true,
                }}
              />
            </div>
          )}
        </div>
      )}

      {body.type === 'graphql' && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-text-secondary font-medium">Query</label>
            </div>
            <div className="rounded-xl bg-bg-secondary border border-border overflow-hidden focus-within:border-accent/40 transition-colors">
              <CodeMirror
                value={gql.query}
                onChange={(val) => setBody({ ...body, graphql: { ...gql, query: val } })}
                extensions={[blockEditorExtensions]}
                theme={appEditorTheme}
                height="180px"
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  bracketMatching: true,
                  closeBrackets: true,
                }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-text-secondary font-medium">Variables</label>
              <Toggle enabled={autoPrettify} onChange={handleTogglePrettify} label="Prettify" />
            </div>
            <div className="rounded-xl bg-bg-secondary border border-border overflow-hidden focus-within:border-accent/40 transition-colors">
              <CodeMirror
                value={gql.variables}
                onChange={(val) => setBody({ ...body, graphql: { ...gql, variables: val } })}
                extensions={[json(), blockEditorExtensions]}
                theme={appEditorTheme}
                height="80px"
                basicSetup={{
                  lineNumbers: true,
                  bracketMatching: true,
                  closeBrackets: true,
                }}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-text-secondary font-medium block mb-1.5">Operation Name (optional)</label>
            <input
              type="text"
              value={gql.operationName || ''}
              onChange={(e) => setBody({ ...body, graphql: { ...gql, operationName: e.target.value || undefined } })}
              placeholder="e.g. GetUsers"
              className="w-full px-3 py-2 text-xs rounded-xl bg-bg-secondary border border-border font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
            />
          </div>
        </div>
      )}

      {body.type === 'form-data' && (
        <KeyValueEditor
          pairs={body.formData || [{ key: '', value: '', enabled: true }]}
          onChange={(formData) => setBody({ ...body, formData })}
          keyPlaceholder="Field name"
          valuePlaceholder="Value"
        />
      )}

      {body.type === 'x-www-form-urlencoded' && (
        <KeyValueEditor
          pairs={body.urlEncoded || [{ key: '', value: '', enabled: true }]}
          onChange={(urlEncoded) => setBody({ ...body, urlEncoded })}
          keyPlaceholder="Field name"
          valuePlaceholder="Value"
        />
      )}
    </div>
  );
}
