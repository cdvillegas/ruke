import { useState, useMemo, useCallback } from 'react';
import { useRequestStore } from '../../stores/requestStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import type { KeyValue, EndpointParam } from '@shared/types';

interface ParamRow {
  key: string;
  value: string;
  enabled: boolean;
  source: 'path' | 'query' | 'header' | 'body' | 'custom';
  required: boolean;
  type: string;
  description?: string;
  enumValues?: string[];
}

function buildParamRows(
  params: KeyValue[],
  body: { type: string; raw?: string },
  endpointParams?: EndpointParam[]
): ParamRow[] {
  const rows: ParamRow[] = [];
  const usedKeys = new Set<string>();

  let bodyObj: Record<string, any> = {};
  if (body.type === 'json' && body.raw) {
    try { bodyObj = JSON.parse(body.raw); } catch {}
  }

  if (endpointParams) {
    for (const ep of endpointParams) {
      usedKeys.add(ep.name);
      if (ep.in === 'body') {
        const bodyVal = bodyObj[ep.name];
        rows.push({
          key: ep.name,
          value: bodyVal !== undefined ? (typeof bodyVal === 'object' ? JSON.stringify(bodyVal) : String(bodyVal)) : '',
          enabled: true,
          source: 'body',
          required: ep.required,
          type: ep.type || 'string',
          description: ep.description,
          enumValues: ep.enumValues,
        });
      } else {
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

function FieldInput({ row, onUpdate }: { row: ParamRow; onUpdate: (value: string) => void }) {
  const isEnum = row.enumValues && row.enumValues.length > 0;

  if (isEnum) {
    return (
      <select
        value={row.value}
        onChange={(e) => onUpdate(e.target.value)}
        className="w-full px-2.5 py-1.5 text-xs rounded-md bg-bg-tertiary border border-border font-mono text-text-primary focus:outline-none focus:border-accent transition-colors cursor-pointer"
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
        className="w-full px-2.5 py-1.5 text-xs rounded-md bg-bg-tertiary border border-border font-mono text-text-primary focus:outline-none focus:border-accent transition-colors cursor-pointer"
      >
        <option value="">—</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  return (
    <input
      type="text"
      value={row.value}
      onChange={(e) => onUpdate(e.target.value)}
      placeholder={
        row.type === 'integer' || row.type === 'number' ? '0' :
        row.type.endsWith('[]') ? '[]' :
        row.type === 'object' ? '{}' :
        ''
      }
      className="w-full px-2.5 py-1.5 text-xs rounded-md bg-bg-tertiary border border-border font-mono text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent transition-colors"
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
  const [showDesc, setShowDesc] = useState(false);
  const resolvedValue = row.value.includes('{{') ? resolveString(row.value) : null;
  const isCustom = row.source === 'custom';

  return (
    <div className="group">
      <div className="flex items-center gap-2">
        {/* Name + type */}
        <div className="w-[140px] shrink-0">
          {isCustom ? (
            <input
              type="text"
              value={row.key}
              onChange={(e) => onKeyChange?.(e.target.value)}
              placeholder="key"
              className="w-full px-2.5 py-1.5 text-xs rounded-md bg-bg-tertiary border border-border font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
          ) : (
            <button
              onClick={() => row.description && setShowDesc(!showDesc)}
              className={`flex items-center gap-1.5 w-full text-left min-w-0 ${row.description ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span className="text-xs font-mono font-medium text-text-primary truncate">{row.key}</span>
              {row.required && <span className="text-[9px] font-bold text-error shrink-0">*</span>}
              {row.description && (
                <span className="shrink-0 text-text-muted">
                  {showDesc ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Type badge */}
        {!isCustom && (
          <span className="text-[10px] text-text-muted font-mono shrink-0 w-[60px] truncate" title={row.type}>
            {row.type}
          </span>
        )}

        {/* Value input */}
        <div className="flex-1 min-w-0 relative">
          <FieldInput row={row} onUpdate={(v) => onUpdate(v, row.enabled)} />
          {resolvedValue && resolvedValue !== row.value && (
            <div className="absolute -bottom-3 left-0 text-[8px] text-accent font-mono truncate max-w-full">
              = {resolvedValue}
            </div>
          )}
        </div>

        {/* Remove button for custom params */}
        <div className="w-5 shrink-0">
          {isCustom && (
            <button
              onClick={onRemove}
              className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-error/15 text-text-muted hover:text-error transition-all"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded description */}
      {showDesc && row.description && (
        <div className="ml-[140px] pl-2 mt-1 mb-1 text-[11px] text-text-muted leading-relaxed border-l-2 border-border">
          {row.description.replace(/\n{2,}/g, ' ').slice(0, 300)}
          {row.description.length > 300 && '...'}
        </div>
      )}
    </div>
  );
}

export function ParameterEditor() {
  const activeRequest = useRequestStore((s) => s.activeRequest);
  const setParams = useRequestStore((s) => s.setParams);
  const setHeaders = useRequestStore((s) => s.setHeaders);
  const setBody = useRequestStore((s) => s.setBody);
  const connections = useConnectionStore((s) => s.connections);
  const resolveString = useEnvironmentStore((s) => s.resolveString);
  const [showOptional, setShowOptional] = useState(false);

  const linkedEndpoint = useMemo(() => {
    if (!activeRequest.connectionId || !activeRequest.endpointId) return null;
    const conn = connections.find((c) => c.id === activeRequest.connectionId);
    if (!conn) return null;
    return conn.endpoints.find((e) => e.id === activeRequest.endpointId) || null;
  }, [activeRequest.connectionId, activeRequest.endpointId, connections]);

  const rows = useMemo(
    () => buildParamRows(activeRequest.params, activeRequest.body, linkedEndpoint?.parameters),
    [activeRequest.params, activeRequest.body, linkedEndpoint]
  );

  const updateBodyFromParams = useCallback((key: string, rawValue: string) => {
    let currentBody: Record<string, any> = {};
    if (activeRequest.body.type === 'json' && activeRequest.body.raw) {
      try { currentBody = JSON.parse(activeRequest.body.raw); } catch {}
    }

    const paramDef = linkedEndpoint?.parameters?.find(p => p.name === key);
    const paramType = paramDef?.type || 'string';

    if (rawValue === '') {
      delete currentBody[key];
    } else if (paramType === 'integer' || paramType === 'number') {
      const num = Number(rawValue);
      currentBody[key] = isNaN(num) ? rawValue : num;
    } else if (paramType === 'boolean') {
      currentBody[key] = rawValue === 'true';
    } else if (paramType.endsWith('[]') || paramType === 'array') {
      try { currentBody[key] = JSON.parse(rawValue); } catch { currentBody[key] = rawValue; }
    } else if (paramType === 'object') {
      try { currentBody[key] = JSON.parse(rawValue); } catch { currentBody[key] = rawValue; }
    } else {
      currentBody[key] = rawValue;
    }

    setBody({ ...activeRequest.body, type: 'json', raw: JSON.stringify(currentBody, null, 2) });
  }, [activeRequest.body, linkedEndpoint, setBody]);

  const updateParam = (key: string, value: string, enabled: boolean, source: string) => {
    if (source === 'body') {
      updateBodyFromParams(key, value);
      return;
    }
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
  };

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

  const bodyRows = rows.filter(r => r.source === 'body');
  const pathQueryRows = rows.filter(r => r.source === 'path' || r.source === 'query');
  const customRows = rows.filter(r => r.source === 'custom');
  const headerRows = rows.filter(r => r.source === 'header');

  const requiredBodyRows = bodyRows.filter(r => r.required);
  const optionalBodyRows = bodyRows.filter(r => !r.required);
  const filledOptionalBody = optionalBodyRows.filter(r => r.value !== '');
  const emptyOptionalBody = optionalBodyRows.filter(r => r.value === '');

  const visibleOptionalBody = showOptional ? optionalBodyRows : filledOptionalBody;

  const hasPathQuery = pathQueryRows.length > 0;
  const hasCustom = customRows.length > 0;

  let customIndex = -1;

  const renderFieldRow = (row: ParamRow) => {
    const isCustom = row.source === 'custom';
    if (isCustom) customIndex++;
    const idx = customIndex;

    return (
      <FieldRow
        key={`${row.source}-${row.key}-${idx}`}
        row={row}
        onUpdate={(value, enabled) => updateParam(row.key, value, enabled, row.source)}
        onRemove={isCustom ? () => removeParam(row.key) : undefined}
        onKeyChange={isCustom ? (k) => updateCustomKey(idx, k) : undefined}
        resolveString={resolveString}
      />
    );
  };

  const hasAnyContent = bodyRows.length > 0 || pathQueryRows.length > 0 || customRows.length > 0;

  if (!hasAnyContent && !linkedEndpoint) return null;

  return (
    <div className="space-y-4">
      {/* Path + query params (only shown when they exist) */}
      {(hasPathQuery || hasCustom) && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Parameters</h3>
            <button
              onClick={addCustomParam}
              className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              <Plus size={10} />
              Add
            </button>
          </div>
          <div className="space-y-1.5">
            {pathQueryRows.map(renderFieldRow)}
            {customRows.map(renderFieldRow)}
          </div>
        </div>
      )}

      {/* Body fields */}
      {bodyRows.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Body Fields</h3>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-method-post/10 text-method-post/70 font-mono">JSON</span>
          </div>

          {/* Required fields -- always shown */}
          {requiredBodyRows.length > 0 && (
            <div className="space-y-1.5">
              {requiredBodyRows.map(renderFieldRow)}
            </div>
          )}

          {/* Filled optional fields + optionally all optional */}
          {visibleOptionalBody.length > 0 && (
            <div className={`space-y-1.5 ${requiredBodyRows.length > 0 ? 'mt-1.5' : ''}`}>
              {visibleOptionalBody.map(renderFieldRow)}
            </div>
          )}

          {/* Toggle for remaining optional fields */}
          {emptyOptionalBody.length > 0 && (
            <button
              onClick={() => setShowOptional(!showOptional)}
              className="flex items-center gap-1.5 mt-2 px-1 py-1 text-[10px] text-text-muted hover:text-text-primary transition-colors"
            >
              {showOptional ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              <span>
                {showOptional
                  ? 'Hide optional fields'
                  : `${emptyOptionalBody.length} more optional field${emptyOptionalBody.length !== 1 ? 's' : ''}`
                }
              </span>
            </button>
          )}
        </div>
      )}

      {/* Headers from endpoint spec go in advanced -- not shown here */}
    </div>
  );
}
