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
import { Info, Lock, Plus, Plug, Trash2 } from 'lucide-react';
import { TooltipMarkdown } from '../shared/markdownComponents';
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

function typeBadgeStyle(type: string): string {
  switch (type) {
    case 'string': return 'bg-blue-500/10 text-blue-400';
    case 'integer': case 'number': return 'bg-amber-500/10 text-amber-400';
    case 'boolean': return 'bg-purple-500/10 text-purple-400';
    case 'object': return 'bg-emerald-500/10 text-emerald-400';
    case 'array': return 'bg-cyan-500/10 text-cyan-400';
    default:
      if (type.endsWith('[]')) return 'bg-cyan-500/10 text-cyan-400';
      return 'bg-text-muted/8 text-text-muted/70';
  }
}

interface BodyFieldRow {
  key: string;
  value: string;
  required: boolean;
  type: string;
  description?: string;
  enumValues?: string[];
  source: 'api' | 'custom';
}

function buildBodyFieldRows(
  bodyRaw: string | undefined,
  bodyParams: EndpointParam[],
  customKeys: string[]
): BodyFieldRow[] {
  let bodyObj: Record<string, any> = {};
  if (bodyRaw) {
    try { bodyObj = JSON.parse(bodyRaw); } catch {}
  }

  const rows: BodyFieldRow[] = bodyParams.map((ep) => {
    const bodyVal = bodyObj[ep.name];
    return {
      key: ep.name,
      value: bodyVal !== undefined ? (typeof bodyVal === 'object' ? JSON.stringify(bodyVal) : String(bodyVal)) : '',
      required: ep.required,
      type: ep.type || 'string',
      description: ep.description,
      enumValues: ep.enumValues,
      source: 'api' as const,
    };
  });

  const apiKeys = new Set(bodyParams.map(p => p.name));
  for (const ck of customKeys) {
    if (apiKeys.has(ck)) continue;
    const bodyVal = bodyObj[ck];
    rows.push({
      key: ck,
      value: bodyVal !== undefined ? (typeof bodyVal === 'object' ? JSON.stringify(bodyVal) : String(bodyVal)) : '',
      required: false,
      type: 'string',
      source: 'custom',
    });
  }

  return rows;
}

function BodyFieldRowView({
  row,
  onUpdate,
  onRemove,
  onKeyChange,
  enabled,
  onToggle,
}: {
  row: BodyFieldRow;
  onUpdate: (value: string) => void;
  onRemove?: () => void;
  onKeyChange?: (key: string) => void;
  enabled?: boolean;
  onToggle?: (enabled: boolean) => void;
}) {
  const isLocked = row.required;
  const isDisabled = enabled === false;
  const isCustom = row.source === 'custom';
  const isEnum = row.enumValues && row.enumValues.length > 0;
  const complex = isComplexType(row.type);
  const jsonLike = isJsonLike(row.value);
  const isMultiline = complex || jsonLike;

  const renderValue = () => {
    if (isEnum) {
      return (
        <select
          value={row.value}
          onChange={(e) => onUpdate(e.target.value)}
          disabled={isDisabled}
          className="w-full px-3 py-2 text-xs font-mono text-text-primary bg-transparent border-none outline-none cursor-pointer appearance-none disabled:cursor-not-allowed"
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
          disabled={isDisabled}
          className="w-full px-3 py-2 text-xs font-mono text-text-primary bg-transparent border-none outline-none cursor-pointer appearance-none disabled:cursor-not-allowed"
        >
          <option value="">—</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }

    const displayValue = isMultiline && row.value ? (tryPrettifyJson(row.value) ?? row.value) : row.value;
    return (
      <InlineEditor
        value={displayValue}
        onChange={onUpdate}
        multiline={isMultiline}
        jsonMode={isMultiline}
        disabled={isDisabled}
        bare
      />
    );
  };

  return (
    <div className={`group grid grid-cols-subgrid col-span-5 gap-0 items-stretch border-b border-border/30 last:border-b-0 transition-colors ${
      isDisabled ? 'opacity-40' : 'hover:bg-bg-hover/20'
    }`}>
      <div className="flex items-center justify-center">
        {isLocked ? (
          <div className="w-4 h-4 rounded bg-accent flex items-center justify-center">
            <Lock size={8} className="text-white" strokeWidth={2.5} />
          </div>
        ) : (
          <input
            type="checkbox"
            checked={enabled !== false}
            onChange={(e) => onToggle?.(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-border accent-accent cursor-pointer"
          />
        )}
      </div>

      <div className="flex items-center border-l border-border/30">
        <div className="flex items-center gap-1.5 px-3 py-2.5">
          {isCustom ? (
            <input
              type="text"
              value={row.key}
              onChange={(e) => onKeyChange?.(e.target.value)}
              placeholder="Field name"
              spellCheck={false}
              className="text-xs font-mono font-medium text-text-primary bg-transparent border-none outline-none placeholder:text-text-muted/30 w-full"
            />
          ) : (
            <>
              <span className="text-xs font-mono font-medium text-text-primary whitespace-nowrap">{row.key}</span>
              {row.description && (
                <Tooltip.Provider delayDuration={150}>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button className="text-text-muted/40 hover:text-text-secondary transition-colors shrink-0">
                        <Info size={11} />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        side="top"
                        align="start"
                        sideOffset={4}
                        className="max-w-sm px-3 py-2 rounded-lg bg-bg-secondary border border-border text-[11px] text-text-secondary leading-relaxed shadow-xl z-[100]"
                      >
                        <TooltipMarkdown content={row.description} />
                        <Tooltip.Arrow className="fill-border" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
              )}
              <Plug size={10} className="text-text-muted/30 shrink-0" />
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center px-2.5 border-l border-border/30">
        <span className={`text-[10px] font-mono leading-none px-1.5 py-0.5 rounded shrink-0 ${typeBadgeStyle(row.type)}`}>
          {row.type}
        </span>
      </div>

      <div className="relative border-l border-border/30 min-w-0">
        {renderValue()}
      </div>

      <div className="flex items-center justify-center">
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-1 rounded text-text-muted/20 hover:text-error hover:bg-error/10 opacity-0 group-hover:opacity-100 transition-all"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function Toggle({ enabled, onChange, label }: { enabled: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className="flex items-center gap-1.5 text-[10px] text-text-muted/60 hover:text-text-secondary transition-colors"
    >
      <span>{label}</span>
      <div className={`relative w-5 h-3 rounded-full transition-colors ${enabled ? 'bg-text-secondary' : 'bg-text-muted/15'}`}>
        <div className={`absolute top-[2px] w-2 h-2 rounded-full bg-white/80 shadow-sm transition-transform ${enabled ? 'translate-x-[10px]' : 'translate-x-[2px]'}`} />
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

  const [customBodyKeys, setCustomBodyKeys] = useState<string[]>([]);

  const bodyFieldRows = useMemo(
    () => buildBodyFieldRows(body.raw, bodyParams, customBodyKeys),
    [body.raw, bodyParams, customBodyKeys]
  );

  const [enabledOptionalKeys, setEnabledOptionalKeys] = useState<Set<string>>(() => {
    if (!body.raw) return new Set<string>();
    try {
      const parsed = JSON.parse(body.raw);
      const optKeys = bodyParams.filter(p => p.in === 'body' && !p.required).map(p => p.name);
      return new Set(optKeys.filter(k => k in parsed));
    } catch { return new Set<string>(); }
  });

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

  const toggleOptionalField = useCallback((key: string, enabled: boolean) => {
    setEnabledOptionalKeys(prev => {
      const next = new Set(prev);
      if (enabled) next.add(key);
      else next.delete(key);
      return next;
    });
    if (!enabled) updateBodyField(key, '');
  }, [updateBodyField]);

  const addCustomBodyField = useCallback(() => {
    setCustomBodyKeys(prev => [...prev, '']);
  }, []);

  const removeCustomBodyField = useCallback((index: number) => {
    const key = customBodyKeys[index];
    if (key) updateBodyField(key, '');
    setCustomBodyKeys(prev => prev.filter((_, i) => i !== index));
  }, [customBodyKeys, updateBodyField]);

  const updateCustomBodyKey = useCallback((index: number, newKey: string) => {
    const oldKey = customBodyKeys[index];
    setCustomBodyKeys(prev => {
      const next = [...prev];
      next[index] = newKey;
      return next;
    });
    if (oldKey && oldKey !== newKey) {
      let currentBody: Record<string, any> = {};
      if (body.type === 'json' && body.raw) {
        try { currentBody = JSON.parse(body.raw); } catch {}
      }
      if (oldKey in currentBody) {
        const val = currentBody[oldKey];
        delete currentBody[oldKey];
        if (newKey) currentBody[newKey] = val;
        setBody({ ...body, type: 'json', raw: JSON.stringify(currentBody, null, 2) });
      }
    }
  }, [customBodyKeys, body, setBody]);

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
      <div className="flex items-center justify-between">
        <div className="flex gap-0.5 p-0.5 rounded-lg bg-bg-secondary/60 w-fit">
          {BODY_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setBody({ ...body, type: t.id })}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-150 ${
                body.type === t.id
                  ? 'bg-bg-tertiary text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {(body.type === 'json' || body.type === 'raw') && (
          <div className="flex items-center gap-3">
            {body.type === 'json' && (
              <div className="flex gap-0.5 p-0.5 rounded-md bg-bg-secondary/60">
                <button
                  onClick={() => handleToggleRaw(false)}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all duration-150 ${
                    !showRaw ? 'bg-bg-tertiary text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  Fields
                </button>
                <button
                  onClick={() => handleToggleRaw(true)}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all duration-150 ${
                    showRaw ? 'bg-bg-tertiary text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  Raw
                </button>
              </div>
            )}
            <Toggle enabled={autoPrettify} onChange={handleTogglePrettify} label="Prettify" />
          </div>
        )}
      </div>

      {body.type === 'none' && (
        <p className="text-xs text-text-muted py-4 text-center">
          This request does not have a body
        </p>
      )}

      {(body.type === 'json' || body.type === 'raw') && (
        <div className="space-y-3">
          {/* Structured fields for required + added optional params */}
          {body.type === 'json' && !showRaw && (
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
                <span className="text-[10.5px] text-text-secondary uppercase tracking-wider font-semibold">Body Fields</span>
                {bodyFieldRows.length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-text-muted/10 text-text-muted font-mono">{bodyFieldRows.length}</span>
                )}
              </div>
              {bodyFieldRows.length > 0 && (
                <div className="grid grid-cols-[28px_auto_auto_1fr_28px]">
                  <div className="grid grid-cols-subgrid col-span-5 border-b border-border/30">
                    <div className="py-1.5" />
                    <div className="px-3 py-1.5 text-[10px] text-text-muted/50 uppercase tracking-wider font-medium border-l border-border/30">Name</div>
                    <div className="px-2.5 py-1.5 text-[10px] text-text-muted/50 uppercase tracking-wider font-medium border-l border-border/30 text-center">Type</div>
                    <div className="px-3 py-1.5 text-[10px] text-text-muted/50 uppercase tracking-wider font-medium border-l border-border/30">Value</div>
                    <div />
                  </div>
                  {bodyFieldRows.map((r, idx) => {
                    const isOptional = !r.required;
                    const isCustom = r.source === 'custom';
                    const isEnabled = r.required || (isCustom ? true : enabledOptionalKeys.has(r.key));
                    const customIdx = isCustom ? customBodyKeys.indexOf(r.key !== '' ? r.key : customBodyKeys[idx - bodyParams.filter(p => p.in === 'body').length]) : -1;

                    return (
                      <BodyFieldRowView
                        key={isCustom ? `custom-${idx}` : r.key}
                        row={r}
                        enabled={isEnabled}
                        onUpdate={(v) => {
                          if (isCustom && r.key) updateBodyField(r.key, v);
                          else if (!isCustom) updateBodyField(r.key, v);
                        }}
                        onToggle={isOptional && !isCustom ? (en) => toggleOptionalField(r.key, en) : undefined}
                        onRemove={isCustom ? () => {
                          const ci = idx - bodyFieldRows.filter(fr => fr.source === 'api').length;
                          removeCustomBodyField(ci);
                        } : undefined}
                        onKeyChange={isCustom ? (k) => {
                          const ci = idx - bodyFieldRows.filter(fr => fr.source === 'api').length;
                          updateCustomBodyKey(ci, k);
                        } : undefined}
                      />
                    );
                  })}
                </div>
              )}
              <div className={bodyFieldRows.length > 0 ? 'border-t border-border/30' : ''}>
                <button
                  onClick={addCustomBodyField}
                  className="flex items-center gap-1.5 w-full px-3 py-2.5 text-[11px] text-text-muted hover:text-accent hover:bg-accent/5 transition-colors"
                >
                  <Plus size={12} />
                  <span>Add field</span>
                </button>
              </div>
            </div>
          )}

          {(body.type !== 'json' || showRaw) && (
            <div className="rounded-lg bg-bg-secondary border border-border/60 overflow-hidden focus-within:border-border-light transition-colors">
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
            <div className="rounded-lg bg-bg-secondary border border-border/60 overflow-hidden focus-within:border-border-light transition-colors">
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
            <div className="rounded-lg bg-bg-secondary border border-border/60 overflow-hidden focus-within:border-border-light transition-colors">
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
              className="w-full px-3 py-2 text-[11px] rounded-lg bg-bg-secondary border border-border/60 font-mono text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-border-light transition-colors"
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
