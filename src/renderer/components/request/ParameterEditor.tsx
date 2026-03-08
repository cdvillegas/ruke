import { useState, useMemo, useCallback } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useRequestStore } from '../../stores/requestStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { Plus, Trash2, Info, X } from 'lucide-react';
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

function isComplexType(type: string): boolean {
  return type === 'object' || type === 'array' || type.endsWith('[]') || type.startsWith('object');
}

function tryPrettifyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function isJsonLike(value: string): boolean {
  const t = value.trim();
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'));
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

function ValueInput({
  row,
  onUpdate,
}: {
  row: ParamRow;
  onUpdate: (value: string) => void;
}) {
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

  const displayValue = isMultiline && row.value ? tryPrettifyJson(row.value) : row.value;
  const placeholder =
    row.source === 'path' ? row.key :
    row.type === 'integer' || row.type === 'number' ? '0' :
    '';

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

function FieldRow({
  row,
  onUpdate,
  onRemove,
  onKeyChange,
  resolveString,
}: {
  row: ParamRow;
  onUpdate: (value: string, enabled: boolean) => void;
  onRemove?: () => void;
  onKeyChange?: (key: string) => void;
  resolveString: (s: string) => string;
}) {
  const resolvedValue = row.value.includes('{{') ? resolveString(row.value) : null;
  const isCustom = row.source === 'custom';

  return (
    <div className="group param-field-row">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {isCustom ? (
            <input
              type="text"
              value={row.key}
              onChange={(e) => onKeyChange?.(e.target.value)}
              placeholder="key"
              spellCheck={false}
              className="text-xs font-mono font-medium text-text-primary bg-transparent border-none outline-none placeholder:text-text-muted/30 border-b border-b-transparent focus:border-b-accent/40 pb-px"
            />
          ) : (
            <>
              <span className="text-xs font-mono font-medium text-text-primary truncate">{row.key}</span>
              {row.required && <span className="text-[9px] font-bold text-error shrink-0">*</span>}
            </>
          )}
          {!isCustom && (
            <>
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
            </>
          )}
        </div>
        <div className="w-5 shrink-0 flex items-center justify-center">
          {onRemove && (
            <button
              onClick={onRemove}
              className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-error/10 text-text-muted/30 hover:text-error transition-all"
            >
              {isCustom ? <Trash2 size={12} /> : <X size={12} />}
            </button>
          )}
        </div>
      </div>
      <ValueInput
        row={row}
        onUpdate={(v) => onUpdate(v, row.enabled)}
      />
      {resolvedValue && resolvedValue !== row.value && (
        <div className="mt-0.5 text-[10px] text-accent/70 font-mono">
          = {resolvedValue}
        </div>
      )}
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
  const resolveString = useEnvironmentStore((s) => s.resolveString);

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

  const addCustomParam = () => {
    setParams([...activeRequest.params, { key: '', value: '', enabled: true }]);
  };

  const removeParam = (key: string) => {
    setParams(activeRequest.params.filter((p) => p.key !== key));
  };

  const updateCustomKey = (index: number, newKey: string) => {
    const customParams = activeRequest.params.filter(
      (p) => !linkedEndpoint?.parameters?.some((ep) => ep.name === p.key)
    );
    const paramIndex = activeRequest.params.indexOf(customParams[index]);
    if (paramIndex >= 0) {
      const updated = [...activeRequest.params];
      updated[paramIndex] = { ...updated[paramIndex], key: newKey };
      setParams(updated);
    }
  };

  const pathRows = rows.filter(r => r.source === 'path');
  const allQueryRows = rows.filter(r => r.source === 'query');
  const customRows = rows.filter(r => r.source === 'custom');

  const requiredQueryRows = allQueryRows.filter(r => r.required);
  const optionalQueryRows = allQueryRows.filter(r => !r.required);

  const visibleQueryRows = simpleMode
    ? requiredQueryRows
    : allQueryRows;

  const hasAnyContent = pathRows.length > 0 || allQueryRows.length > 0 || customRows.length > 0;

  if (!hasAnyContent && !linkedEndpoint) return null;

  let customIndex = -1;

  const renderRow = (row: ParamRow, idx?: number) => {
    const isCustom = row.source === 'custom';
    if (isCustom) customIndex++;
    const cidx = customIndex;

    return (
      <FieldRow
        key={`${row.source}-${row.key}-${idx ?? cidx}`}
        row={row}
        onUpdate={(value, enabled) => updateParam(row.key, value, enabled, row.source)}
        onRemove={isCustom ? () => removeParam(row.key) : undefined}
        onKeyChange={isCustom ? (k) => updateCustomKey(cidx, k) : undefined}
        resolveString={resolveString}
      />
    );
  };

  const hasAnyRows = pathRows.length > 0 || visibleQueryRows.length > 0 || customRows.length > 0;

  return (
    <div className="space-y-1.5">
      {pathRows.map((r, i) => renderRow(r, i))}
      {visibleQueryRows.map((r, i) => renderRow(r, i))}
      {customRows.map((r, i) => renderRow(r, i))}

      <button
        onClick={addCustomParam}
        className="flex items-center gap-1 px-1.5 py-1 text-[10px] rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
      >
        <Plus size={10} />
        {hasAnyRows ? 'Add parameter' : 'Add parameter'}
      </button>
    </div>
  );
}

export { typeColor, type ParamRow };
export type { ParameterEditorProps };
