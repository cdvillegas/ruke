import React, { useMemo } from 'react';
import { ToolCallCard } from './ToolCallCard';
import { AssistantMessage } from './markdownComponents';
import { AttachmentChip } from './AttachmentChip';
import type { ChatMessage } from '@shared/types';
import { Send, Plug, Layers, FolderOpen } from 'lucide-react';

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

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming: boolean;
  maxWidth?: string;
  userMaxWidth?: string;
}

export const MessageBubble = React.memo(function MessageBubble({
  message,
  isStreaming,
  maxWidth = 'max-w-[85%]',
  userMaxWidth = 'max-w-[80%]',
}: MessageBubbleProps) {
  if (message.role === 'tool') return null;

  if (message.role === 'user') {
    const raw = message.attachments?.length
      ? (message.content || '').replace(/<file[\s\S]*?<\/file>/g, '').trim()
      : message.content || '';
    const { text: displayContent, contexts } = useMemo(() => parseUserContent(raw), [raw]);

    return (
      <div className="flex justify-end">
        <div className={`${userMaxWidth} overflow-hidden bg-accent/15 border border-accent/20 rounded-2xl rounded-br-md px-4 py-2.5 space-y-2`}>
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {message.attachments.map((a, i) => (
                <AttachmentChip key={i} attachment={a} />
              ))}
            </div>
          )}
          {displayContent && (
            <p className="text-sm text-text-primary whitespace-pre-wrap break-words">{displayContent}</p>
          )}
          {contexts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {contexts.map((ctx, i) => (
                <ContextChip key={i} ctx={ctx} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className={`${maxWidth} space-y-2`}>
        {message.content && (
          isStreaming
            ? <StreamingText content={message.content} />
            : <AssistantMessage content={message.content} />
        )}
        {message.toolCalls?.map(tc => (
          <ToolCallCard key={tc.id} toolCall={tc} />
        ))}
      </div>
    </div>
  );
}, (prev, next) => {
  if (prev.isStreaming !== next.isStreaming) return false;
  if (prev.message !== next.message) return false;
  return true;
});
