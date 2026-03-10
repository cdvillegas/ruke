import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
  History,
  ArrowDown,
} from 'lucide-react';
import { METHOD_COLORS } from '@shared/constants';
import type { WorkflowRunEntry, WorkflowRunResult, WorkflowRun } from '@shared/types';
import { useWorkflowStore } from '../../stores/workflowStore';

interface Props {
  result: WorkflowRunResult | null;
  running: boolean;
  onRun: () => void;
  canRun: boolean;
  workflowName: string;
  workflowId: string | null;
  availableVariables: Record<string, string>;
  outputKeysSet: Set<string>;
  onOutputToggle: (key: string, checked: boolean) => void;
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'success'
      ? 'text-success'
      : status === 'failed'
        ? 'text-error'
        : 'text-amber-500';
  return <span className={`text-xs font-medium ${cls}`}>{status}</span>;
}

export function WorkflowRunner({
  result,
  running,
  onRun,
  canRun,
  workflowName,
  workflowId,
  availableVariables,
  outputKeysSet,
  onOutputToggle,
}: Props) {
  const { runHistory, loadRunHistory } = useWorkflowStore();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const handleViewHistory = () => {
    if (!historyOpen && workflowId) loadRunHistory(workflowId);
    setHistoryOpen((v) => !v);
  };

  if (!workflowId) return null;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
      {running && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Loader2 size={14} className="animate-spin" />
          Running {workflowName}…
        </div>
      )}

      {!result && !running && (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted">
          <ArrowDown size={24} className="opacity-30" />
          <p className="text-xs">Run the workflow to see output</p>
          <p className="text-[10px]">Use the Run button above or in the header</p>
          <button
            onClick={handleViewHistory}
            className="mt-2 flex items-center gap-1.5 text-[11px] text-accent hover:text-accent/80 transition-colors"
          >
            <History size={12} />
            View history{runHistory.length > 0 ? ` (${runHistory.length})` : ''}
          </button>
        </div>
      )}

      {result && !running && (
        <>
          <div className="flex items-center gap-4 px-3 py-2 rounded-lg bg-bg-secondary border border-border flex-wrap">
            <span className="flex items-center gap-1.5 text-text-primary">
              <Clock size={14} />
              {result.duration}ms
            </span>
            {workflowId && (
              <button
                onClick={handleViewHistory}
                className="flex items-center gap-1.5 ml-auto text-[11px] text-text-muted hover:text-text-primary transition-colors"
              >
                <History size={12} />
                History{runHistory.length > 0 ? ` (${runHistory.length})` : ''}
              </button>
            )}
            <span className="text-text-primary">Total: {result.total}</span>
            <span className="flex items-center gap-1.5 text-success">
              <CheckCircle2 size={14} />
              {result.passed}
            </span>
            <span className="flex items-center gap-1.5 text-error">
              <XCircle size={14} />
              {result.failed}
            </span>
          </div>

          <div className="space-y-1.5">
            {result.results.map((entry: WorkflowRunEntry) => (
              <div
                key={entry.requestId}
                className="rounded-lg border border-border bg-bg-secondary overflow-hidden"
              >
                <div className="flex items-center gap-3 px-3 py-2">
                  <span
                    className="font-mono font-bold text-[10px] w-10 shrink-0"
                    style={{
                      color: METHOD_COLORS[entry.method] || '#6b7280',
                    }}
                  >
                    {entry.method}
                  </span>
                  <span className="text-sm text-text-primary truncate flex-1">
                    {entry.requestName}
                  </span>
                  <span
                    className={`flex items-center gap-1 text-xs ${
                      entry.passed ? 'text-success' : 'text-error'
                    }`}
                  >
                    {entry.passed ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <XCircle size={14} />
                    )}
                    {entry.status} {entry.statusText}
                  </span>
                  <span className="text-xs text-text-muted">
                    {entry.duration}ms
                  </span>
                </div>
                {entry.error && (
                  <div className="px-3 pb-3">
                    <p className="text-xs text-error">{entry.error}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {Object.keys(availableVariables).length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Variables</p>
              <div className="space-y-1.5">
                {Object.entries(availableVariables).map(([k, v]) => (
                  <label
                    key={k}
                    className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-bg-hover/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={outputKeysSet.has(k)}
                      onChange={(e) => onOutputToggle(k, e.target.checked)}
                      className="rounded border-border"
                    />
                    <span className="text-xs font-mono text-accent/90 shrink-0">{k}</span>
                    <span className="text-text-muted text-xs">=</span>
                    <span className="text-xs text-text-primary truncate min-w-0" title={v}>
                      {v.length > 60 ? v.slice(0, 60) + '…' : v}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {historyOpen && runHistory.length > 0 && (
        <div className="rounded-lg border border-border bg-bg-secondary overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-bg-tertiary/50 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
            Run history
          </div>
          <div className="divide-y divide-border/50 max-h-60 overflow-y-auto">
            {runHistory.map((run) => (
              <div key={run.id} className="border-b border-border/50 last:border-b-0">
                <button
                  onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}
                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-bg-hover/50 text-left"
                >
                  {expandedRunId === run.id ? (
                    <ChevronDown size={14} className="text-text-muted shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-text-muted shrink-0" />
                  )}
                  <span className="text-xs text-text-muted flex-1">{formatTime(run.startedAt)}</span>
                  <StatusBadge status={run.status} />
                  <span className="text-xs text-text-muted">{run.durationMs}ms</span>
                </button>
                {expandedRunId === run.id && (
                  <RunLogDetail run={run} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function RunLogDetail({ run }: { run: WorkflowRun }) {
  return (
    <div className="px-3 pb-3 pt-0 space-y-2 bg-bg-tertiary/30">
      {Object.keys(run.inputs).length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Inputs</p>
          <div className="font-mono text-xs space-y-0.5">
            {Object.entries(run.inputs).map(([k, v]) => (
              <div key={k}>
                <span className="text-accent/90">{k}</span>
                <span className="text-text-muted"> = </span>
                <span className="text-text-primary truncate max-w-[200px] inline-block align-bottom" title={v}>
                  {v.length > 40 ? v.slice(0, 40) + '…' : v}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {run.steps && run.steps.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Steps</p>
          <div className="space-y-1">
            {run.steps.map((s) => (
              <div key={s.index} className="flex items-center gap-2 text-xs">
                <span
                  className="font-mono font-bold w-10 shrink-0"
                  style={{ color: METHOD_COLORS[s.method] || '#6b7280' }}
                >
                  {s.method}
                </span>
                <span className="text-text-primary truncate flex-1">{s.requestName}</span>
                <span className={s.passed ? 'text-success' : 'text-error'}>
                  {s.passed ? '✓' : '✗'} {s.statusCode ?? s.status} {s.duration}ms
                </span>
                {s.error && <span className="text-error text-[10px] truncate max-w-[120px]" title={s.error}>{s.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {Object.keys(run.outputs).length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1">Outputs</p>
          <div className="font-mono text-xs space-y-0.5">
            {Object.entries(run.outputs).map(([k, v]) => (
              <div key={k}>
                <span className="text-accent/90">{k}</span>
                <span className="text-text-muted"> = </span>
                <span className="text-text-primary truncate max-w-[200px] inline-block align-bottom" title={v}>
                  {v.length > 40 ? v.slice(0, 40) + '…' : v}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
