import { useState, useMemo, useCallback } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useRequestStore } from '../../stores/requestStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { Plus, Trash2, Lock, Info } from 'lucide-react';
import { TooltipMarkdown } from '../shared/markdownComponents';
import { InlineEditor } from '../shared/InlineEditor';
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

function typeColor(type: string): string {
  return typeBadgeStyle(type);
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
  const isEditable = row.source === 'custom';
  const isDisabled = !row.enabled;
  const resolvedValue = row.value.includes('{{') ? resolveString(row.value) : null;
  const isEnum = row.enumValues && row.enumValues.length > 0;

  const renderValue = () => {
    if (isEnum) {
      return (
        <select
          value={row.value}
          onChange={(e) => onUpdate(e.target.value, row.enabled)}
          disabled={isDisabled}
          className="w-full px-3 py-2 text-xs font-mono text-text-primary bg-transparent border-none outline-none cursor-pointer disabled:cursor-not-allowed appearance-none"
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
          onChange={(e) => onUpdate(e.target.value, row.enabled)}
          disabled={isDisabled}
          className="w-full px-3 py-2 text-xs font-mono text-text-primary bg-transparent border-none outline-none cursor-pointer disabled:cursor-not-allowed appearance-none"
        >
          <option value="">—</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }

    return (
      <InlineEditor
        value={row.value}
        onChange={(v) => onUpdate(v, row.enabled)}
        disabled={isDisabled}
        bare
      />
    );
  };

  return (
    <div className={`group grid grid-cols-subgrid col-span-5 gap-0 items-stretch border-b border-border/50 last:border-b-0 transition-colors ${
      isDisabled ? 'opacity-40' : 'hover:bg-bg-hover/30'
    }`}>
      <div className="flex items-center justify-center border-r border-border/50">
        {row.source === 'path' ? (
          <div className="w-4 h-4 rounded bg-accent flex items-center justify-center">
            <Lock size={8} className="text-white" strokeWidth={2.5} />
          </div>
        ) : (
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={(e) => onUpdate(row.value, e.target.checked)}
            className="w-3.5 h-3.5 rounded border-border accent-accent cursor-pointer"
          />
        )}
      </div>

      <div className="flex items-center border-r border-border/50">
        {isEditable ? (
          <InlineEditor
            value={row.key}
            onChange={(v) => onKeyChange?.(v)}
            disabled={isDisabled}
            placeholder="Parameter name"
            bare
          />
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-2.5">
            <span className="text-xs font-mono font-medium text-text-primary whitespace-nowrap">{row.key}</span>
            {row.required && row.source !== 'path' && (
              <span className="text-[9px] text-error font-semibold shrink-0">*</span>
            )}
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
          </div>
        )}
      </div>

      <div className="flex items-center justify-center px-2.5 border-r border-border/50">
        <span className={`text-[10px] font-mono leading-none px-1.5 py-0.5 rounded shrink-0 ${typeBadgeStyle(row.type)}`}>
          {row.type}
        </span>
      </div>

      <div className="relative min-w-0">
        {renderValue()}
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
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-bg-tertiary/50">
      <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">{label}</span>
      {badge && (
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-medium">{badge}</span>
      )}
      {count !== undefined && count > 0 && (
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-text-muted/10 text-text-muted font-mono">{count}</span>
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
        <div className="rounded-lg border border-border/60 overflow-hidden bg-bg-secondary">
          <SectionHeader label="Path Parameters" badge="required" />
          <div className="grid grid-cols-[28px_auto_auto_1fr_28px]">
            <div className="grid grid-cols-subgrid col-span-5 border-b border-border bg-bg-tertiary/50">
              <div className="py-1.5" />
              <div className="px-3 py-1.5 text-[10px] text-text-muted uppercase tracking-wider font-semibold border-r border-border/50">Name</div>
              <div className="px-2.5 py-1.5 text-[10px] text-text-muted uppercase tracking-wider font-semibold border-r border-border/50 text-center">Type</div>
              <div className="px-3 py-1.5 text-[10px] text-text-muted uppercase tracking-wider font-semibold">Value</div>
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
        </div>
      )}

      <div className="rounded-lg border border-border/60 overflow-hidden bg-bg-secondary">
        <SectionHeader label="Query Parameters" count={queryAndCustomRows.filter(r => r.enabled).length} />

        {queryAndCustomRows.length > 0 && (
          <div className="grid grid-cols-[28px_auto_auto_1fr_28px]">
            <div className="grid grid-cols-subgrid col-span-5 border-b border-border bg-bg-tertiary/50">
              <div className="py-1.5" />
              <div className="px-3 py-1.5 text-[10px] text-text-muted uppercase tracking-wider font-semibold border-r border-border/50">Name</div>
              <div className="px-2.5 py-1.5 text-[10px] text-text-muted uppercase tracking-wider font-semibold border-r border-border/50 text-center">Type</div>
              <div className="px-3 py-1.5 text-[10px] text-text-muted uppercase tracking-wider font-semibold">Value</div>
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
          </div>
        )}

        <div className={queryAndCustomRows.length > 0 ? 'border-t border-border/50' : ''}>
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
