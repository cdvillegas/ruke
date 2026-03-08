import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useRequestStore } from '../../stores/requestStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { Plus, Trash2, Info } from 'lucide-react';
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
        enabled: existing?.enabled ?? true,
        source: ep.in === 'path' ? 'path' : ep.in === 'header' ? 'header' : 'query',
        required: ep.required,
        type: ep.type || 'string',
        description: ep.description,
        enumValues: ep.enumValues,
      });
    }
  }

  for (const p of params) {
    if (!usedKeys.has(p.key) && p.key.trim()) {
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
  const isCustom = row.source === 'custom';
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
        {isCustom ? (
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={(e) => onUpdate(row.value, e.target.checked)}
            className="w-3.5 h-3.5 rounded border-border accent-accent cursor-pointer"
          />
        ) : (
          <div className="w-3.5 h-3.5" />
        )}
      </div>

      <div className="relative border-r border-border/50">
        <div className="flex items-center">
          {isCustom ? (
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
                        {row.description.slice(0, 500)}{row.description.length > 500 ? '...' : ''}
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

interface ParameterEditorProps {
  paramRefs?: React.MutableRefObject<Record<string, HTMLElement | null>>;
  simpleMode?: boolean;
}

export function ParameterEditor({ paramRefs, simpleMode }: ParameterEditorProps) {
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

  const updateParam = useCallback((key: string, value: string, enabled: boolean, source: string) => {
    if (source === 'header') {
      const updated = activeRequest.headers.map((h) =>
        h.key === key ? { ...h, value, enabled } : h
      );
      if (!activeRequest.headers.some((h) => h.key === key)) {
        updated.push({ key, value, enabled });
      }
      setHeaders(updated);
    } else {
      const updated = activeRequest.params.map((p) =>
        p.key === key ? { ...p, value, enabled } : p
      );
      if (!activeRequest.params.some((p) => p.key === key)) {
        updated.push({ key, value, enabled });
      }
      setParams(updated);
    }
  }, [activeRequest.headers, activeRequest.params, setHeaders, setParams]);

  const addCustomParam = useCallback(() => {
    const newParams = [...activeRequest.params, { key: '', value: '', enabled: true }];
    setParams(newParams);
    setLastAddedIdx(rows.length);
  }, [activeRequest.params, setParams, rows.length]);

  const removeParam = useCallback((key: string) => {
    setParams(activeRequest.params.filter((p) => p.key !== key));
  }, [activeRequest.params, setParams]);

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
  const allQueryRows = rows.filter(r => r.source === 'query');
  const customRows = rows.filter(r => r.source === 'custom');

  const visibleQueryRows = simpleMode
    ? allQueryRows.filter(r => r.required)
    : allQueryRows;

  const allVisibleRows = [...pathRows, ...visibleQueryRows, ...customRows];

  let customIndex = -1;

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border overflow-hidden bg-bg-secondary">
        <div className="grid grid-cols-[28px_1fr_1fr_28px] gap-0 border-b border-border bg-bg-tertiary/50">
          <div className="py-1.5" />
          <div className="px-3 py-1.5 text-[10px] text-text-muted uppercase tracking-wider font-semibold border-l border-r border-border/50">
            Key
          </div>
          <div className="px-3 py-1.5 text-[10px] text-text-muted uppercase tracking-wider font-semibold">
            Value
          </div>
          <div />
        </div>

        {allVisibleRows.map((row, idx) => {
          const isCustom = row.source === 'custom';
          if (isCustom) customIndex++;
          const cidx = customIndex;

          return (
            <ParamRow
              key={`${row.source}-${row.key}-${idx}`}
              row={row}
              onUpdate={(value, enabled) => updateParam(row.key, value, enabled, row.source)}
              onRemove={isCustom ? () => removeParam(row.key) : undefined}
              onKeyChange={isCustom ? (k) => updateCustomKey(cidx, k) : undefined}
              autoFocusKey={idx === lastAddedIdx}
            />
          );
        })}

        <div className="border-t border-border/50">
          <button
            onClick={addCustomParam}
            className="flex items-center gap-1.5 w-full px-3 py-2 text-[11px] text-text-muted hover:text-text-primary hover:bg-bg-hover/50 transition-colors"
          >
            <Plus size={12} />
            <span>Add parameter</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export { typeColor, type ParamRow };
export type { ParameterEditorProps };
