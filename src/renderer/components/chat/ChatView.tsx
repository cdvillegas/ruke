import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChatStore } from '../../stores/chatStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useUiStore } from '../../stores/uiStore';
import {
  Send, Plus, Loader2, Check, AlertCircle, ChevronDown, ChevronRight,
  Plug, Sparkles, Key, ArrowRight,
} from 'lucide-react';
import { TOOL_DISPLAY_NAMES } from '../../lib/agentTools';
import type { ChatMessage, ChatToolCall } from '@shared/types';

const AI_KEY_STORAGE = 'ruke:ai_key';
function hasAiKey(): boolean {
  return (localStorage.getItem(AI_KEY_STORAGE) || '').length >= 10;
}

const SUGGESTIONS = [
  { label: 'Connect an API', prompt: 'Help me connect the OpenAI API' },
  { label: 'Set up my backend', prompt: 'I want to set up API requests for my backend server. Can you help?' },
  { label: 'Create a collection', prompt: 'Create a collection of common REST API requests for testing' },
  { label: 'Set up environments', prompt: 'Help me set up dev and production environments with different API keys' },
];

function ToolCallCard({ toolCall }: { toolCall: ChatToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const displayName = TOOL_DISPLAY_NAMES[toolCall.name] || toolCall.name;

  let parsedResult: any = null;
  if (toolCall.result) {
    try { parsedResult = JSON.parse(toolCall.result); } catch {}
  }

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
        {toolCall.status === 'running' || toolCall.status === 'pending' ? (
          <Loader2 size={12} className="text-accent animate-spin shrink-0" />
        ) : toolCall.status === 'error' ? (
          <AlertCircle size={12} className="text-red-400 shrink-0" />
        ) : (
          <Check size={12} className="text-green-400 shrink-0" />
        )}
        <span className="text-text-secondary font-medium">{displayName}</span>
        {resultSummary && toolCall.status === 'done' && (
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

const markdownComponents: Record<string, React.ComponentType<any>> = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>,
  em: ({ children }) => <em className="italic text-text-secondary">{children}</em>,
  h1: ({ children }) => <h1 className="text-lg font-bold text-text-primary mt-4 mb-2 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-semibold text-text-primary mt-3 mb-1.5 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold text-text-primary mt-2.5 mb-1 first:mt-0">{children}</h3>,
  ul: ({ children }) => <ul className="list-disc list-outside pl-5 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-outside pl-5 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="text-sm text-text-primary pl-0.5">{children}</li>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
      {children}
    </a>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <code className="text-[13px] font-mono text-text-primary" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="bg-bg-tertiary px-1.5 py-0.5 rounded text-[13px] font-mono text-accent" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-bg-tertiary rounded-lg p-3 text-xs font-mono overflow-x-auto mb-2 border border-border/40">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-accent/40 pl-3 text-text-secondary italic mb-2">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-border my-3" />,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2 rounded-lg border border-border/60">
      <table className="w-full text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-bg-tertiary/60">{children}</thead>,
  th: ({ children }) => (
    <th className="text-left px-3 py-1.5 text-text-secondary font-medium border-b border-border/40">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-1.5 text-text-primary border-b border-border/20">{children}</td>
  ),
};

function AssistantMessage({ content }: { content: string }) {
  return (
    <div className="text-sm text-text-primary leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'tool') return null;

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-accent/15 border border-accent/20 rounded-2xl rounded-br-md px-4 py-2.5">
          <p className="text-sm text-text-primary whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-2">
        {message.toolCalls?.map(tc => (
          <ToolCallCard key={tc.id} toolCall={tc} />
        ))}
        {message.content && <AssistantMessage content={message.content} />}
      </div>
    </div>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion: (prompt: string) => void }) {
  const connections = useConnectionStore(s => s.connections);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const hasKey = hasAiKey();

  if (!hasKey) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-12 h-12 rounded-2xl bg-accent/15 flex items-center justify-center mb-4">
          <Key size={24} className="text-accent" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">Set up AI</h2>
        <p className="text-sm text-text-muted text-center max-w-sm mb-4">
          Add your OpenAI API key in Settings to start chatting with Ruke.
        </p>
        <button
          onClick={() => setActiveView('settings')}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-accent hover:bg-accent-hover text-white transition-colors"
        >
          <ArrowRight size={14} /> Go to Settings
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <div className="w-12 h-12 rounded-2xl bg-accent/15 flex items-center justify-center mb-4">
        <Sparkles size={24} className="text-accent" />
      </div>
      <h2 className="text-lg font-semibold text-text-primary mb-1">Ruke</h2>
      <p className="text-sm text-text-muted text-center max-w-sm mb-6">
        Your API development assistant. I can connect APIs, create requests, set up environments, and more.
      </p>

      {connections.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-secondary border border-border mb-6">
          <Plug size={12} className="text-accent" />
          <span className="text-xs text-text-muted">
            {connections.length} API{connections.length !== 1 ? 's' : ''} connected &middot;{' '}
            {connections.reduce((sum, c) => sum + c.endpoints.length, 0)} endpoints
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 max-w-md w-full">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            onClick={() => onSuggestion(s.prompt)}
            className="text-left px-4 py-3 rounded-xl border border-border bg-bg-secondary hover:bg-bg-hover hover:border-accent/30 transition-all"
          >
            <p className="text-xs font-medium text-text-primary">{s.label}</p>
            <p className="text-[10px] text-text-muted mt-0.5 line-clamp-2">{s.prompt}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChatView() {
  const { session, isRunning, error, sendMessage, newChat } = useChatStore();
  const connections = useConnectionStore(s => s.connections);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const visibleMessages = session.messages.filter(m => m.role !== 'tool');
  const isEmpty = visibleMessages.length === 0 && !isRunning;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session.messages, isRunning]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isRunning) return;
    setInput('');
    await sendMessage(trimmed);
    inputRef.current?.focus();
  }, [input, isRunning, sendMessage]);

  const handleSuggestion = useCallback((prompt: string) => {
    setInput('');
    sendMessage(prompt);
  }, [sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const text = await file.text();
    const name = file.name.toLowerCase();

    if (name.endsWith('.json') || name.endsWith('.yaml') || name.endsWith('.yml')) {
      const conn = useConnectionStore.getState().importOpenApiSpec(text, file.name);
      if (conn) {
        sendMessage(`I just imported a spec file (${file.name}). It's now connected as "${conn.name}" with ${conn.endpoints.length} endpoints. What would you like to do with it?`);
      }
    }
  }, [sendMessage]);

  return (
    <div
      className="h-full flex flex-col bg-bg-primary"
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={handleFileDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-accent" />
          <h1 className="text-sm font-semibold text-text-primary">
            {session.messages.length > 0 ? session.title : 'New Chat'}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          {connections.length > 0 && (
            <span className="text-[10px] text-text-muted mr-2">
              {connections.length} API{connections.length !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={newChat}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            title="New Chat"
          >
            <Plus size={13} /> New
          </button>
          <button
            onClick={() => useUiStore.getState().setActiveView('connections')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <Plug size={13} /> APIs
          </button>
        </div>
      </div>

      {/* Messages or Empty State */}
      {isEmpty ? (
        <EmptyState onSuggestion={handleSuggestion} />
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          <div className="max-w-2xl mx-auto space-y-4">
            {visibleMessages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {isRunning && !visibleMessages.some(m => m.role === 'assistant' && m.toolCalls?.some(tc => tc.status === 'running' || tc.status === 'pending')) && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 px-3 py-2">
                  <Loader2 size={14} className="text-accent animate-spin" />
                  <span className="text-xs text-text-muted">Thinking...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                  <AlertCircle size={14} className="text-red-400 shrink-0" />
                  <span className="text-xs text-red-400">{error}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="shrink-0 border-t border-border p-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end gap-2 bg-bg-secondary rounded-2xl border border-border focus-within:border-accent/40 transition-colors px-4 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRunning ? 'Waiting for response...' : 'Ask Ruke anything about APIs...'}
              disabled={isRunning}
              rows={1}
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none resize-none min-h-[24px] max-h-32 py-1 disabled:opacity-50"
              style={{ height: 'auto', overflow: 'hidden' }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 128) + 'px';
              }}
            />
            <button
              onClick={handleSend}
              disabled={isRunning || !input.trim()}
              className={`shrink-0 p-2 rounded-xl transition-all ${
                input.trim()
                  ? 'bg-accent hover:bg-accent-hover text-white shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                  : 'bg-accent/20 text-white/30 cursor-not-allowed'
              }`}
            >
              {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          <p className="text-[10px] text-text-muted text-center mt-2 opacity-60">
            Ruke can make mistakes. Verify important API configurations.
          </p>
        </div>
      </div>
    </div>
  );
}
