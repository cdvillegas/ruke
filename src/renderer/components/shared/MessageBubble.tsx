import React from 'react';
import { ToolCallCard } from './ToolCallCard';
import { AssistantMessage } from './markdownComponents';
import { AttachmentChip } from './AttachmentChip';
import type { ChatMessage } from '@shared/types';

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
    const displayContent = message.attachments?.length
      ? (message.content || '').replace(/<file[\s\S]*?<\/file>/g, '').trim()
      : message.content;

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
