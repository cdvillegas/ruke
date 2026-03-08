import { useState } from 'react';
import { Check, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { TOOL_DISPLAY_NAMES } from '../../lib/agentTools';
import type { ChatToolCall } from '@shared/types';

export function ToolCallCard({ toolCall }: { toolCall: ChatToolCall }) {
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
