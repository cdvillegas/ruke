import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ToolCallCard } from './ToolCallCard';
import { AssistantMessage } from './markdownComponents';
import { AttachmentChip } from './AttachmentChip';
import type { ChatMessage } from '@shared/types';
import { Send, Plug, Layers, FolderOpen, ArrowUp, X } from 'lucide-react';

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

export interface ConversationTurnProps {
  userMessage: ChatMessage;
  assistantMessages: ChatMessage[];
  streamingMessageId: string | null;
  onResend?: (content: string) => void;
  isLast?: boolean;
}

export const ConversationTurn = React.memo(function ConversationTurn({
  userMessage,
  assistantMessages,
  streamingMessageId,
  onResend,
  isLast,
}: ConversationTurnProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const turnRef = useRef<HTMLDivElement>(null);

  const raw = userMessage.attachments?.length
    ? (userMessage.content || '').replace(/<file[\s\S]*?<\/file>/g, '').trim()
    : userMessage.content || '';
  const { text: displayContent, contexts } = useMemo(() => parseUserContent(raw), [raw]);

  useEffect(() => {
    if (isLast && turnRef.current) {
      turnRef.current.scrollIntoView({ block: 'start' });
    }
  }, [userMessage.id, isLast]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      const ta = textareaRef.current;
      ta.focus();
      ta.selectionStart = ta.value.length;
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
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

  return (
    <div ref={turnRef} className={isLast ? 'min-h-full' : ''}>
      {/* Sticky user message header */}
      <div className="sticky top-0 z-10">
        <div className="bg-bg-secondary px-2.5 pt-1.5 pb-1">
          <div
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
                <div className="flex items-center justify-end gap-1.5 pb-1">
                  <button
                    onClick={cancelEdit}
                    className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                    title="Cancel (Esc)"
                  >
                    <X size={12} />
                  </button>
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
        </div>
        </div>
        <div className="h-6 bg-gradient-to-b from-bg-secondary to-transparent pointer-events-none" />
      </div>

      {/* Assistant response content */}
      {assistantMessages.length > 0 && (
        <div className="px-3 pb-3 space-y-2">
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
});
