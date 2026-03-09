import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Check, AlertCircle, ChevronDown, ChevronRight,
  ListChecks, CheckCircle2, Loader2, XCircle, SkipForward, Circle,
  Plus, Trash2, Pencil, GripVertical,
} from 'lucide-react';
import { TOOL_DISPLAY_NAMES } from '../../lib/agentTools';
import { usePlanStore } from '../../stores/planStore';
import { useChatStore } from '../../stores/chatStore';
import type { ChatToolCall, Plan } from '@shared/types';

function PlanStepIcon({ status }: { status: string }) {
  switch (status) {
    case 'done': return <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />;
    case 'in_progress': return <Loader2 size={13} className="text-amber-400 shrink-0 animate-spin" />;
    case 'failed': return <XCircle size={13} className="text-red-400 shrink-0" />;
    case 'skipped': return <SkipForward size={13} className="text-text-muted shrink-0" />;
    default: return <Circle size={13} className="text-text-muted/40 shrink-0" />;
  }
}

function EditableStepRow({
  step, planId, isDraft,
}: {
  step: { id: string; description: string; status: string };
  planId: string;
  isDraft: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(step.description);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setValue(step.description); }, [step.description]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== step.description) {
      usePlanStore.getState().updateStepDescription(planId, step.id, trimmed);
    } else {
      setValue(step.description);
    }
    setEditing(false);
  };

  return (
    <div className="group/step flex items-start gap-2.5 py-1">
      <PlanStepIcon status={step.status} />
      {editing ? (
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setValue(step.description); setEditing(false); } }}
          className="flex-1 text-xs leading-snug bg-bg-tertiary/60 text-text-primary border border-border/60 rounded px-1.5 py-0.5 outline-none focus:border-accent/40"
        />
      ) : (
        <span
          className={`flex-1 text-xs leading-snug ${
            step.status === 'done' ? 'text-text-muted line-through' :
            step.status === 'in_progress' ? 'text-text-primary font-medium' :
            step.status === 'failed' ? 'text-red-400' :
            step.status === 'skipped' ? 'text-text-muted' :
            'text-text-secondary'
          } ${isDraft ? 'cursor-text' : ''}`}
          onClick={() => isDraft && setEditing(true)}
        >
          {step.description}
        </span>
      )}
      {isDraft && !editing && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover/step:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <Pencil size={10} />
          </button>
          <button
            onClick={() => usePlanStore.getState().removePlanStep(planId, step.id)}
            className="p-0.5 rounded hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
          >
            <Trash2 size={10} />
          </button>
        </div>
      )}
    </div>
  );
}

function PlanToolCallCard({ toolCall }: { toolCall: ChatToolCall }) {
  let planId: string | null = null;
  if (toolCall.result) {
    try {
      const parsed = JSON.parse(toolCall.result);
      planId = parsed.plan_id || null;
    } catch {}
  }

  const plan = usePlanStore(s => planId ? s.plans.find(p => p.id === planId) || null : null);
  const [collapsed, setCollapsed] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [addingStep, setAddingStep] = useState(false);
  const [newStepValue, setNewStepValue] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const newStepRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (plan?.status === 'completed') setCollapsed(true);
  }, [plan?.status]);

  useEffect(() => { if (editingTitle) titleRef.current?.focus(); }, [editingTitle]);
  useEffect(() => { if (addingStep) newStepRef.current?.focus(); }, [addingStep]);

  const executePlan = useCallback((p: Plan) => {
    const currentSessionId = useChatStore.getState().activeSessionId;
    if (currentSessionId && p.chatSessionId !== currentSessionId) {
      usePlanStore.getState().updatePlanSession(p.id, currentSessionId);
    }
    usePlanStore.getState().updatePlanStatus(p.id, 'in_progress');
    const stepsList = p.steps.map((s, i) => `${i + 1}. [step_id:${s.id}] ${s.description}`).join('\n');
    const msg = `Execute plan "${p.title}" (plan_id: ${p.id}).\n\nWork through each step sequentially:\n${stepsList}`;
    useChatStore.getState().sendMessage(msg, undefined, 'agent');
  }, []);

  const stopPlan = useCallback((p: Plan) => {
    useChatStore.getState().stopGeneration();
    usePlanStore.getState().updatePlanStatus(p.id, 'draft');
  }, []);

  const commitTitle = () => {
    if (plan && titleValue.trim() && titleValue.trim() !== plan.title) {
      usePlanStore.getState().updatePlanTitle(plan.id, titleValue.trim());
    }
    setEditingTitle(false);
  };

  const commitNewStep = () => {
    if (plan && newStepValue.trim()) {
      usePlanStore.getState().addPlanStep(plan.id, newStepValue.trim());
      setNewStepValue('');
    }
    setAddingStep(false);
  };

  if (!plan) {
    return (
      <div className="rounded-lg border border-border/60 bg-bg-tertiary/40 px-3 py-2 text-xs text-text-muted flex items-center gap-2">
        <ListChecks size={12} />
        <span>Plan created</span>
      </div>
    );
  }

  const isDraft = plan.status === 'draft';
  const done = plan.steps.filter(s => s.status === 'done' || s.status === 'skipped').length;
  const total = plan.steps.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const borderClass = plan.status === 'in_progress'
    ? 'border-accent/30'
    : plan.status === 'completed'
      ? 'border-emerald-400/20'
      : plan.status === 'failed'
        ? 'border-red-400/20'
        : 'border-border/60';

  const statusBadge = plan.status === 'completed'
    ? <span className="text-[10px] font-medium text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">Completed</span>
    : plan.status === 'failed'
      ? <span className="text-[10px] font-medium text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full">Failed</span>
      : plan.status === 'in_progress'
        ? <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">Running</span>
        : null;

  return (
    <div className={`rounded-xl border bg-bg-secondary/50 transition-all ${borderClass} ${
      plan.status === 'in_progress' ? 'plan-glow' : ''
    }`}>
      <div className="flex items-center gap-2 px-3.5 py-2.5">
        <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-2 flex-1 min-w-0 hover:bg-bg-hover/30 transition-colors rounded-lg -ml-1 pl-1 py-0.5">
          <ListChecks size={14} className={`shrink-0 ${
            plan.status === 'completed' ? 'text-emerald-400' :
            plan.status === 'in_progress' ? 'text-accent' :
            'text-text-muted'
          }`} />
          {editingTitle ? (
            <input
              ref={titleRef}
              value={titleValue}
              onChange={e => setTitleValue(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
              onClick={e => e.stopPropagation()}
              className="flex-1 text-sm font-medium bg-bg-tertiary/60 text-text-primary border border-border/60 rounded px-1.5 py-0.5 outline-none focus:border-accent/40"
            />
          ) : (
            <span className="text-sm font-medium text-text-primary flex-1 text-left truncate">{plan.title}</span>
          )}
        </button>
        {isDraft && !editingTitle && (
          <button
            onClick={() => { setTitleValue(plan.title); setEditingTitle(true); }}
            className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors shrink-0"
          >
            <Pencil size={11} />
          </button>
        )}
        {statusBadge}
        <span className="text-[10px] text-text-muted shrink-0 tabular-nums">{done}/{total}</span>
        <button onClick={() => setCollapsed(!collapsed)} className="shrink-0 p-0.5">
          <ChevronRight size={12} className={`text-text-muted transition-transform ${collapsed ? '' : 'rotate-90'}`} />
        </button>
      </div>

      {plan.status !== 'draft' && plan.status !== 'completed' && (
        <div className="mx-3.5 h-0.5 rounded-full bg-bg-tertiary overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              plan.status === 'failed' ? 'bg-red-400' : 'bg-accent'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {!collapsed && (
        <div className="px-3.5 pt-2 pb-1 space-y-0.5">
          {plan.steps.map(step => (
            <EditableStepRow key={step.id} step={step} planId={plan.id} isDraft={isDraft} />
          ))}
          {isDraft && (
            addingStep ? (
              <div className="flex items-center gap-2.5 py-1">
                <Plus size={13} className="text-text-muted/40 shrink-0" />
                <input
                  ref={newStepRef}
                  value={newStepValue}
                  onChange={e => setNewStepValue(e.target.value)}
                  onBlur={commitNewStep}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { commitNewStep(); setTimeout(() => { setAddingStep(true); setNewStepValue(''); }, 0); }
                    if (e.key === 'Escape') { setNewStepValue(''); setAddingStep(false); }
                  }}
                  placeholder="Add a step"
                  className="flex-1 text-xs leading-snug bg-bg-tertiary/60 text-text-primary border border-border/60 rounded px-1.5 py-0.5 outline-none focus:border-accent/40 placeholder:text-text-muted/40"
                />
              </div>
            ) : (
              <button
                onClick={() => setAddingStep(true)}
                className="flex items-center gap-2.5 py-1 w-full text-text-muted/50 hover:text-text-muted transition-colors"
              >
                <Plus size={13} className="shrink-0" />
                <span className="text-xs">Add step</span>
              </button>
            )
          )}
        </div>
      )}

      {isDraft && (
        <div className="px-3.5 pb-3 pt-2">
          <button
            onClick={() => executePlan(plan)}
            className="w-full py-2 rounded-lg text-sm font-medium text-white bg-accent hover:bg-accent-hover transition-all"
            style={{ boxShadow: '0 0 16px rgba(99,102,241,0.4), 0 0 32px rgba(99,102,241,0.15)' }}
          >
            Execute Plan
          </button>
        </div>
      )}
      {plan.status === 'in_progress' && (
        <div className="px-3.5 pb-3 pt-2">
          <button
            onClick={() => stopPlan(plan)}
            className="w-full py-1.5 rounded-lg text-xs font-medium text-text-secondary bg-bg-tertiary hover:bg-bg-hover border border-border transition-all"
          >
            Stop Execution
          </button>
        </div>
      )}
    </div>
  );
}

export function ToolCallCard({ toolCall }: { toolCall: ChatToolCall }) {
  if (toolCall.name === 'create_plan') {
    return <PlanToolCallCard toolCall={toolCall} />;
  }

  const [expanded, setExpanded] = useState(false);
  const displayName = TOOL_DISPLAY_NAMES[toolCall.name] || toolCall.name;

  let parsedResult: any = null;
  if (toolCall.result) {
    try { parsedResult = JSON.parse(toolCall.result); } catch {}
  }

  const hasResult = !!toolCall.result;
  const isError = toolCall.status === 'error' || (parsedResult && parsedResult.error);
  const isDone = toolCall.status === 'done' || hasResult;
  const isLoading = !isDone && !isError;

  const resultSummary = parsedResult
    ? parsedResult.error
      ? `Error: ${parsedResult.error}`
      : parsedResult.name
        ? `${parsedResult.name}${parsedResult.endpointCount != null ? ` (${parsedResult.endpointCount} endpoints)` : ''}`
        : parsedResult.connections
          ? `${parsedResult.connections.length} API${parsedResult.connections.length !== 1 ? 's' : ''} connected`
          : parsedResult.results
            ? `${parsedResult.results.length} result${parsedResult.results.length !== 1 ? 's' : ''} found`
            : parsedResult.environmentId
              ? `Created "${parsedResult.name}"`
              : parsedResult.collectionId
                ? `Created "${parsedResult.name}"`
                : parsedResult.success
                  ? 'Done'
                  : null
    : null;

  return (
    <div className="rounded-lg border border-border/60 bg-bg-tertiary/40 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-bg-hover/50 transition-colors"
      >
        {isLoading ? (
          <span className="flex items-center gap-[3px] shrink-0 w-3 justify-center">
            <span className="w-[3px] h-[3px] rounded-full bg-accent animate-bounce [animation-delay:0ms]" />
            <span className="w-[3px] h-[3px] rounded-full bg-accent animate-bounce [animation-delay:150ms]" />
            <span className="w-[3px] h-[3px] rounded-full bg-accent animate-bounce [animation-delay:300ms]" />
          </span>
        ) : isError ? (
          <AlertCircle size={12} className="text-red-400 shrink-0" />
        ) : (
          <Check size={12} className="text-green-400 shrink-0" />
        )}
        <span className="text-text-secondary font-medium">{displayName}</span>
        {resultSummary && isDone && (
          <span className="text-text-muted truncate flex-1 text-left">{resultSummary}</span>
        )}
        <span className="text-text-muted shrink-0 ml-auto">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
      </button>
      {expanded && toolCall.result && (
        <div className="px-3 py-2 border-t border-border/40 max-h-48 overflow-auto">
          <pre className="text-[10px] text-text-muted font-mono whitespace-pre-wrap break-all">
            {JSON.stringify(parsedResult || toolCall.result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
