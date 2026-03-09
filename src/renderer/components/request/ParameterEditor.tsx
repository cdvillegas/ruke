import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useRequestStore } from '../../stores/requestStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { Plus, Trash2, Info, Lock } from 'lucide-react';
import { TooltipMarkdown } from '../shared/markdownComponents';
import type { KeyValue, EndpointParam } from '@shared/types';

interface ParamRow {
  key: string;
  value: string;
  enabled: boolean;
  source: 'path' | 'query' | 'header' | 'custom';
  required: boolean;
  type: string;
  description?: string;
  enumValues?: string[];
}

function buildParamRows(
  params: KeyValue[],
  endpointParams?: EndpointParam[]
): ParamRow[] {
  const rows: ParamRow[] = [];
  const usedKeys = new Set<string>();

  if (endpointParams) {
    for (const ep of endpointParams) {
      if (ep.in === 'body') continue;
      usedKeys.add(ep.name);
      const existing = params.find((p) => p.key === ep.name);
      rows.push({
        key: ep.name,
        value: existing?.value || '',
        enabled: existing?.enabled ?? (ep.required || ep.in === 'path'),
        source: ep.in === 'path' ? 'path' : ep.in === 'header' ? 'header' : 'query',
        required: ep.required,
        type: ep.type || 'string',
        description: ep.description,
        enumValues: ep.enumValues,
      });
    }
  }

  for (const p of params) {
    if (!usedKeys.has(p.key)) {
      rows.push({
        key: p.key,
        value: p.value,
        enabled: p.enabled,
        source: 'custom',
        required: false,
        type: 'string',
      });
    }
  }

  return rows;
}

function typeColor(type: string): string {
  switch (type) {
    case 'string': return 'text-text-muted/70';
    case 'integer': case 'number': return 'text-text-muted/70';
    case 'boolean': return 'text-text-muted/70';
    case 'object': return 'text-text-muted/70';
    case 'array': return 'text-text-muted/70';
    default:
      if (type.endsWith('[]')) return 'text-text-muted/70';
      return 'text-text-muted/50';
  }
}

function ParamRow({
  row,
  onUpdate,
  onRemove,
  onKeyChange,
  autoFocusKey,
}: {
  row: ParamRow;
  onUpdate: (value: string, enabled: boolean) => void;
  onRemove?: () => void;
  onKeyChange?: (key: string) => void;
  autoFocusKey: boolean;
}) {
  const resolveString = useEnvironmentStore((s) => s.resolveString);
  const keyRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef<HTMLInputElement>(null);
  const isEditable = row.source === 'custom';
  const isDisabled = !row.enabled;
  const resolvedValue = row.value.includes('{{') ? resolveString(row.value) : null;
  const isEnum = row.enumValues && row.enumValues.length > 0;

  useEffect(() => {
    if (autoFocusKey) keyRef.current?.focus();
  }, [autoFocusKey]);

  return (
    <div className={`group grid grid-cols-[28px_1fr_1fr_28px] gap-0 items-stretch border-b border-border/50 last:border-b-0 transition-colors ${
      isDisabled ? 'opacity-40' : 'hover:bg-bg-hover/30'
    }`}>
      <div className="flex items-center justify-center border-r border-border/50">
        {row.source === 'path' ? (
          <Lock size={10} className="text-text-muted/30" />
        ) : isEditable ? (
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={(e) => onUpdate(row.value, e.target.checked)}
            className="w-3.5 h-3.5 rounded border-border accent-accent cursor-pointer"
          />
        ) : (
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={(e) => onUpdate(row.value, e.target.checked)}
            className="w-3.5 h-3.5 rounded border-border accent-accent cursor-pointer"
          />
        )}
      </div>

      <div className="relative border-r border-border/50">
        <div className="flex items-center">
          {isEditable ? (
            <input
              ref={keyRef}
              type="text"
              value={row.key}
              onChange={(e) => onKeyChange?.(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); valueRef.current?.focus(); } }}
              placeholder="Parameter name"
              spellCheck={false}
              disabled={isDisabled}
              className="w-full px-3 py-2 text-xs font-mono text-text-primary bg-transparent border-none outline-none placeholder:text-text-muted/30 disabled:cursor-not-allowed"
            />
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 min-w-0 flex-1">
              <span className="text-xs font-mono font-medium text-text-primary truncate">{row.key}</span>
              <span className={`text-[10px] font-mono leading-none shrink-0 ${typeColor(row.type)}`}>{row.type}</span>
              {row.required && (
                <span className="text-[9px] text-error/60 font-medium shrink-0">*</span>
              )}
              {row.description && (
                <Tooltip.Provider delayDuration={150}>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button className="text-text-muted/25 hover:text-text-muted transition-colors shrink-0">
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
                        <TooltipMarkdown content={row.description} />
                        <Tooltip.Arrow className="fill-border" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="relative">
        {isEnum ? (
          <select
            value={row.value}
            onChange={(e) => onUpdate(e.target.value, row.enabled)}
            disabled={isDisabled}
            className="w-full px-3 py-2 text-xs font-mono text-text-primary bg-transparent border-none outline-none cursor-pointer disabled:cursor-not-allowed"
          >
            <option value="">Select...</option>
            {row.enumValues!.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        ) : row.type === 'boolean' ? (
          <select
            value={row.value}
            onChange={(e) => onUpdate(e.target.value, row.enabled)}
            disabled={isDisabled}
            className="w-full px-3 py-2 text-xs font-mono text-text-primary bg-transparent border-none outline-none cursor-pointer disabled:cursor-not-allowed"
          >
            <option value="">—</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : (
          <input
            ref={valueRef}
            type="text"
            value={row.value}
            onChange={(e) => onUpdate(e.target.value, row.enabled)}
            placeholder={row.source === 'path' ? row.key : 'Value'}
            spellCheck={false}
            disabled={isDisabled}
            className="w-full px-3 py-2 text-xs font-mono text-text-primary bg-transparent border-none outline-none placeholder:text-text-muted/30 disabled:cursor-not-allowed"
          />
        )}
        {resolvedValue && resolvedValue !== row.value && (
          <div className="absolute bottom-0.5 left-3 text-[9px] text-accent/70 font-mono truncate max-w-[calc(100%-24px)]">
            = {resolvedValue}
          </div>
        )}
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

function SectionHeader({ label, count, badge }: { label: string; count?: number; badge?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-tertiary/50 border-b border-border/50">
      <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">{label}</span>
      {badge && (
        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-accent/10 text-accent/70 font-medium">{badge}</span>
      )}
      {count !== undefined && count > 0 && (
        <span className="text-[9px] text-text-muted/50 font-mono">{count}</span>
      )}
    </div>
  );
}

interface ParameterEditorProps {
  paramRefs?: React.MutableRefObject<Record<string, HTMLElement | null>>;
  simpleMode?: boolean;
}

export function ParameterEditor({ paramRefs }: ParameterEditorProps) {
  const activeRequest = useRequestStore((s) => s.activeRequest);
  const setParams = useRequestStore((s) => s.setParams);
  const setHeaders = useRequestStore((s) => s.setHeaders);
  const connections = useConnectionStore((s) => s.connections);
  const [lastAddedIdx, setLastAddedIdx] = useState(-1);

  const linkedEndpoint = useMemo(() => {
    if (!activeRequest.connectionId || !activeRequest.endpointId) return null;
    const conn = connections.find((c) => c.id === activeRequest.connectionId);
    if (!conn) return null;
    return conn.endpoints.find((e) => e.id === activeRequest.endpointId) || null;
  }, [activeRequest.connectionId, activeRequest.endpointId, connections]);

  const rows = useMemo(
    () => buildParamRows(activeRequest.params, linkedEndpoint?.parameters),
    [activeRequest.params, linkedEndpoint]
  );

  const updateParam = useCallback((key: string, value: string, enabled: boolean, source: string, customIdx?: number) => {
    if (source === 'header') {
      const updated = activeRequest.headers.map((h) =>
        h.key === key ? { ...h, value, enabled } : h
      );
      if (!activeRequest.headers.some((h) => h.key === key)) {
        updated.push({ key, value, enabled });
      }
      setHeaders(updated);
    } else if (source === 'custom' && customIdx !== undefined) {
      const specKeys = new Set(linkedEndpoint?.parameters?.map((ep) => ep.name) || []);
      let ci = -1;
      const updated = activeRequest.params.map((p) => {
        if (!specKeys.has(p.key)) {
          ci++;
          if (ci === customIdx) return { ...p, value, enabled };
        }
        return p;
      });
      setParams(updated);
    } else {
      const updated = activeRequest.params.map((p) =>
        p.key === key ? { ...p, value, enabled } : p
      );
      if (!activeRequest.params.some((p) => p.key === key)) {
        updated.push({ key, value, enabled });
      }
      setParams(updated);
    }
  }, [activeRequest.headers, activeRequest.params, setHeaders, setParams, linkedEndpoint]);

  const addCustomParam = useCallback(() => {
    const newParams = [...activeRequest.params, { key: '', value: '', enabled: true }];
    setParams(newParams);
    const queryRows = rows.filter(r => r.source === 'query' || r.source === 'custom');
    setLastAddedIdx(queryRows.length);
  }, [activeRequest.params, setParams, rows]);

  const removeParam = useCallback((customIdx: number) => {
    const specKeys = new Set(linkedEndpoint?.parameters?.map((ep) => ep.name) || []);
    let ci = -1;
    const updated = activeRequest.params.filter((p) => {
      if (!specKeys.has(p.key)) {
        ci++;
        if (ci === customIdx) return false;
      }
      return true;
    });
    setParams(updated);
  }, [activeRequest.params, linkedEndpoint, setParams]);

  const updateCustomKey = useCallback((index: number, newKey: string) => {
    const customParams = activeRequest.params.filter(
      (p) => !linkedEndpoint?.parameters?.some((ep) => ep.name === p.key)
    );
    const paramIndex = activeRequest.params.indexOf(customParams[index]);
    if (paramIndex >= 0) {
      const updated = [...activeRequest.params];
      updated[paramIndex] = { ...updated[paramIndex], key: newKey };
      setParams(updated);
    }
  }, [activeRequest.params, linkedEndpoint, setParams]);

  const pathRows = rows.filter(r => r.source === 'path');
  const specQueryRows = rows.filter(r => r.source === 'query');
  const customRows = rows.filter(r => r.source === 'custom');

  const visibleSpecQueryRows = specQueryRows;

  const hasPathSection = pathRows.length > 0;
  const queryAndCustomRows = [...visibleSpecQueryRows, ...customRows];

  let customIndex = -1;

  return (
    <div className="space-y-4">
      {hasPathSection && (
        <div className="rounded-lg border border-border overflow-hidden bg-bg-secondary">
          <SectionHeader label="Path Parameters" badge="required" />
          <div className="grid grid-cols-[28px_1fr_1fr_28px] gap-0 border-b border-border/50 bg-bg-tertiary/30">
            <div className="py-1" />
            <div className="px-3 py-1 text-[10px] text-text-muted/60 uppercase tracking-wider font-semibold border-l border-r border-border/50">Key</div>
            <div className="px-3 py-1 text-[10px] text-text-muted/60 uppercase tracking-wider font-semibold">Value</div>
            <div />
          </div>
          {pathRows.map((row, idx) => (
            <ParamRow
              key={`path-${row.key}-${idx}`}
              row={row}
              onUpdate={(value, enabled) => updateParam(row.key, value, enabled, row.source)}
              autoFocusKey={false}
            />
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden bg-bg-secondary">
        <SectionHeader label="Query Parameters" count={queryAndCustomRows.filter(r => r.enabled).length} />
        <div className="grid grid-cols-[28px_1fr_1fr_28px] gap-0 border-b border-border/50 bg-bg-tertiary/30">
          <div className="py-1" />
          <div className="px-3 py-1 text-[10px] text-text-muted/60 uppercase tracking-wider font-semibold border-l border-r border-border/50">Key</div>
          <div className="px-3 py-1 text-[10px] text-text-muted/60 uppercase tracking-wider font-semibold">Value</div>
          <div />
        </div>

        {queryAndCustomRows.map((row, idx) => {
          const isCustom = row.source === 'custom';
          if (isCustom) customIndex++;
          const cidx = customIndex;

          return (
            <ParamRow
              key={`query-${row.key}-${idx}`}
              row={row}
              onUpdate={(value, enabled) => updateParam(row.key, value, enabled, row.source, isCustom ? cidx : undefined)}
              onRemove={isCustom ? () => removeParam(cidx) : undefined}
              onKeyChange={isCustom ? (k) => updateCustomKey(cidx, k) : undefined}
              autoFocusKey={idx === lastAddedIdx}
            />
          );
        })}

        {queryAndCustomRows.length === 0 && (
          <div className="px-3 py-4 text-center">
            <p className="text-[11px] text-text-muted/50">No query parameters</p>
          </div>
        )}

        <div className="border-t border-border/50">
          <button
            onClick={addCustomParam}
            className="flex items-center gap-1.5 w-full px-3 py-2 text-[11px] text-text-muted hover:text-text-primary hover:bg-bg-hover/50 transition-colors"
          >
            <Plus size={12} />
            <span>Add query parameter</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export { typeColor, type ParamRow };
export type { ParameterEditorProps };
