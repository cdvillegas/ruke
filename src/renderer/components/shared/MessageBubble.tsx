import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ToolCallCard } from './ToolCallCard';
import { AssistantMessage } from './markdownComponents';
import { AttachmentChip } from './AttachmentChip';
import type { ChatMessage } from '@shared/types';
import { Send, Plug, Layers, FolderOpen, ArrowUp, Infinity, Eye, ListChecks, CheckCircle2, Loader2, XCircle, SkipForward, Circle, ChevronRight, Square } from 'lucide-react';
import { usePlanStore } from '../../stores/planStore';
import { useChatStore } from '../../stores/chatStore';

interface ParsedContext {
  type: string;
  label: string;
  meta?: string;
}

function parseUserContent(content: string): { text: string; contexts: ParsedContext[] } {
  const contexts: ParsedContext[] = [];
  let text = content;

  text = text.replace(/<context\s+type="([^"]+)"\s+id="[^"]+"\s+label="([^"]+)"(?:\s+meta="([^"]+)")?\s*\/>/g,
    (_match, type, label, meta) => {
      contexts.push({ type, label, meta });
      return '';
    }
  );

  text = text.replace(/\[(?:Request|Collection|Environment|Connection|Api):\s[^\]]+\]/gi, '');
  text = text.replace(/Attached context:\s*/gi, '');
  text = text.trim();

  return { text, contexts };
}

function ContextChip({ ctx }: { ctx: ParsedContext }) {
  const Icon = ctx.type === 'request' ? Send
    : ctx.type === 'connection' ? Plug
    : ctx.type === 'environment' ? Layers
    : FolderOpen;
  const typeLabel = ctx.type.charAt(0).toUpperCase() + ctx.type.slice(1);

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-accent/10 border border-accent/20 text-[11px] text-accent font-medium">
      <Icon size={10} className="shrink-0" />
      <span>{typeLabel}: {ctx.label}</span>
      {ctx.meta && <span className="text-accent/50">{ctx.meta}</span>}
    </span>
  );
}

export function StreamingText({ content }: { content: string }) {
  return (
    <div className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
      {content}
      <span className="inline-block w-[2px] h-[1em] bg-accent/70 align-text-bottom ml-0.5 animate-pulse" />
    </div>
  );
}

function AssistantBubble({ message, isStreaming }: { message: ChatMessage; isStreaming: boolean }) {
  return (
    <div className="space-y-2">
      {message.content && (
        isStreaming
          ? <StreamingText content={message.content} />
          : <AssistantMessage content={message.content} />
      )}
      {message.toolCalls?.map(tc => (
        <ToolCallCard key={tc.id} toolCall={tc} />
      ))}
    </div>
  );
}

function PlanStepStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'done': return <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />;
    case 'in_progress': return <Loader2 size={13} className="text-amber-400 shrink-0 animate-spin" />;
    case 'failed': return <XCircle size={13} className="text-red-400 shrink-0" />;
    case 'skipped': return <SkipForward size={13} className="text-text-muted shrink-0" />;
    default: return <Circle size={13} className="text-text-muted/40 shrink-0" />;
  }
}

function StickyPlanHeader({ planId }: { planId: string }) {
  const plan = usePlanStore(s => s.plans.find(p => p.id === planId) || null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (plan?.status === 'completed') setCollapsed(true);
  }, [plan?.status]);

  if (!plan) return null;

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
    <div className={`rounded-xl border bg-bg-secondary/80 transition-all ${borderClass} ${
      plan.status === 'in_progress' ? 'plan-glow' : ''
    }`}>
      <div className="flex items-center gap-2 px-3.5 py-2.5">
        <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-2 flex-1 min-w-0 hover:bg-bg-hover/30 transition-colors rounded-lg -ml-1 pl-1 py-0.5">
          <ListChecks size={14} className={`shrink-0 ${
            plan.status === 'completed' ? 'text-emerald-400' :
            plan.status === 'in_progress' ? 'text-accent' :
            'text-text-muted'
          }`} />
          <span className="text-sm font-medium text-text-primary flex-1 text-left truncate">{plan.title}</span>
        </button>
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
            <div key={step.id} className="flex items-start gap-2.5 py-1">
              <PlanStepStatusIcon status={step.status} />
              <span className={`flex-1 text-xs leading-snug ${
                step.status === 'done' ? 'text-text-muted line-through' :
                step.status === 'in_progress' ? 'text-text-primary font-medium' :
                step.status === 'failed' ? 'text-red-400' :
                step.status === 'skipped' ? 'text-text-muted' :
                'text-text-secondary'
              }`}>
                {step.description}
              </span>
            </div>
          ))}
        </div>
      )}

      {plan.status === 'in_progress' && (
        <div className="px-3.5 pb-3 pt-2">
          <button
            onClick={() => {
              useChatStore.getState().stopGeneration();
              usePlanStore.getState().updatePlanStatus(plan.id, 'draft');
            }}
            className="w-full py-1.5 rounded-lg text-xs font-medium text-text-secondary bg-bg-tertiary hover:bg-bg-hover border border-border transition-all"
          >
            Stop Execution
          </button>
        </div>
      )}
    </div>
  );
}

export interface ConversationTurnProps {
  userMessage: ChatMessage;
  assistantMessages: ChatMessage[];
  streamingMessageId: string | null;
  onResend?: (content: string) => void;
  isLast?: boolean;
  minHeight?: number;
}

export const ConversationTurn = React.memo(React.forwardRef<HTMLDivElement, ConversationTurnProps>(function ConversationTurn({
  userMessage,
  assistantMessages,
  streamingMessageId,
  onResend,
  isLast,
  minHeight,
}, forwardedRef) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const internalRef = useRef<HTMLDivElement>(null);
  const editContainerRef = useRef<HTMLDivElement>(null);

  const turnRef = useCallback((node: HTMLDivElement | null) => {
    internalRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }, [forwardedRef]);

  const raw = userMessage.attachments?.length
    ? (userMessage.content || '').replace(/<file[\s\S]*?<\/file>/g, '').trim()
    : userMessage.content || '';
  const { text: displayContent, contexts } = useMemo(() => parseUserContent(raw), [raw]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      const ta = textareaRef.current;
      ta.focus();
      ta.selectionStart = ta.value.length;
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (editContainerRef.current && !editContainerRef.current.contains(e.target as Node)) {
        cancelEdit();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editing]);

  const startEdit = () => {
    setEditText(displayContent);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditText('');
  };

  const handleResend = () => {
    const text = editText.trim();
    if (!text || !onResend) return;
    onResend(text);
    setEditing(false);
    setEditText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      cancelEdit();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleResend();
    }
  };

  const isPlanExecution = !!userMessage.planId;

  return (
    <div ref={turnRef} style={minHeight ? { minHeight } : undefined}>
      {/* Sticky header: plan card or user message */}
      <div className="sticky top-0 z-10">
        <div className="bg-bg-secondary px-2.5 pt-1.5 pb-1">
          {isPlanExecution ? (
            <StickyPlanHeader planId={userMessage.planId!} />
          ) : (
          <div
            ref={editContainerRef}
            className={`bg-bg-secondary rounded-xl border transition-all duration-300 px-3 ${
              editing
                ? 'border-accent/40 shadow-[0_0_12px_rgba(99,102,241,0.08)]'
                : 'border-border cursor-pointer hover:border-border-light'
            }`}
            onClick={!editing && onResend ? startEdit : undefined}
          >
            {editing ? (
              <div className="py-1.5">
                {userMessage.attachments && userMessage.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 pb-1">
                    {userMessage.attachments.map((a, i) => (
                      <AttachmentChip key={i} attachment={a} />
                    ))}
                  </div>
                )}
                {contexts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 pb-0.5">
                    {contexts.map((ctx, i) => (
                      <ContextChip key={i} ctx={ctx} />
                    ))}
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  value={editText}
                  onChange={e => {
                    setEditText(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none resize-none min-h-[24px] max-h-48 py-1"
                />
                <div className="flex items-center justify-between pb-1 pt-0.5">
                  <div className="flex items-center gap-1">
                    {(() => {
                      const m = userMessage.mode || 'agent';
                      const styles = m === 'ask'
                        ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-400/80'
                        : m === 'plan'
                          ? 'bg-amber-500/8 border-amber-500/15 text-amber-400/80'
                          : 'bg-accent/8 border-accent/15 text-accent/80';
                      return (
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${styles}`}>
                          {m === 'agent' && <Infinity size={12} className="shrink-0" />}
                          {m === 'ask' && <Eye size={12} className="shrink-0" />}
                          {m === 'plan' && <ListChecks size={12} className="shrink-0" />}
                          <span>{m === 'agent' ? 'Agent' : m === 'plan' ? 'Plan' : 'Ask'}</span>
                        </span>
                      );
                    })()}
                    {userMessage.model && (
                      <span className="px-1.5 py-1 text-xs font-medium text-text-muted">{userMessage.model}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleResend}
                      disabled={!editText.trim()}
                      className={`p-1.5 rounded-lg transition-all ${
                        editText.trim()
                          ? 'bg-accent hover:bg-accent-hover text-white'
                          : 'bg-accent/20 text-white/30 cursor-not-allowed'
                      }`}
                      title="Send as new message (Enter)"
                    >
                      <ArrowUp size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 py-2 min-h-[36px]">
                <p className="text-sm text-text-primary truncate flex-1">{displayContent}</p>
                {contexts.length > 0 && (
                  <div className="flex items-center gap-1 shrink-0">
                    {contexts.slice(0, 2).map((ctx, i) => (
                      <ContextChip key={i} ctx={ctx} />
                    ))}
                    {contexts.length > 2 && (
                      <span className="text-[10px] text-text-muted">+{contexts.length - 2}</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </div>
        <div className="h-6 bg-gradient-to-b from-bg-secondary to-transparent pointer-events-none" />
      </div>

      {/* Assistant response content */}
      {assistantMessages.length > 0 && (
        <div className="px-5 pb-3 space-y-2">
          {assistantMessages.map(msg => (
            <AssistantBubble
              key={msg.id}
              message={msg}
              isStreaming={msg.id === streamingMessageId}
            />
          ))}
        </div>
      )}
    </div>
  );
}));
