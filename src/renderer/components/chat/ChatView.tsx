import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useUiStore } from '../../stores/uiStore';
import {
  Send, Plus, Loader2, AlertCircle,
  Plug, Sparkles, Key, ArrowRight, FileUp, PanelLeftClose, PanelLeft,
} from 'lucide-react';
import { ChatSidebar } from './ChatSidebar';
import { ToolCallCard } from '../shared/ToolCallCard';
import { AssistantMessage } from '../shared/markdownComponents';
import { AttachmentChip } from '../shared/AttachmentChip';
import type { ChatMessage, ChatAttachment } from '@shared/types';

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

function StreamingText({ content }: { content: string }) {
  return (
    <div className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
      {content}
      <span className="inline-block w-[2px] h-[1em] bg-accent/70 align-text-bottom ml-0.5 animate-pulse" />
    </div>
  );
}

function MessageBubble({ message, isStreaming }: { message: ChatMessage; isStreaming: boolean }) {
  if (message.role === 'tool') return null;

  if (message.role === 'user') {
    const displayContent = message.attachments?.length
      ? (message.content || '').replace(/<file[\s\S]*?<\/file>/g, '').trim()
      : message.content;

    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] overflow-hidden bg-accent/15 border border-accent/20 rounded-2xl rounded-br-md px-4 py-2.5 space-y-2">
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
      <div className="max-w-[85%] space-y-2">
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

function ChatPanel() {
  const session = useChatStore(s => s.getActiveSession());
  const { isRunning, error, sendMessage, newChat, activeSessionId } = useChatStore();
  const streamingMessageId = useChatStore(s => s.streamingMessageId);
  const streamTick = useChatStore(s => s.streamTick);
  const connections = useConnectionStore(s => s.connections);
  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<ChatAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const visibleMessages = session.messages.filter(m => m.role !== 'tool');
  const isEmpty = visibleMessages.length === 0 && !isRunning;
  const canSend = (!isRunning) && (input.trim() || attachedFiles.length > 0);

  useLayoutEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session.messages, isRunning, streamTick]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeSessionId]);

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    const text = input.trim();
    const files = [...attachedFiles];
    setInput('');
    setAttachedFiles([]);

    let messageContent = text;
    if (files.length > 0) {
      const fileParts = files.map(f =>
        `<file name="${f.name}" size="${f.size}">\n${f.content}\n</file>`
      );
      const fileBlock = fileParts.join('\n\n');
      messageContent = text
        ? `${text}\n\n${fileBlock}`
        : fileBlock;
    }

    await sendMessage(messageContent, files);
    inputRef.current?.focus();
  }, [canSend, input, attachedFiles, sendMessage]);

  const handleSuggestion = useCallback((prompt: string) => {
    setInput('');
    setAttachedFiles([]);
    sendMessage(prompt);
  }, [sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const newAttachments: ChatAttachment[] = [];

    for (const file of files) {
      const alreadyAttached = attachedFiles.some(a => a.name === file.name);
      if (alreadyAttached) continue;

      try {
        const content = await file.text();
        newAttachments.push({ name: file.name, size: file.size, content });
      } catch {
        // Binary or unreadable file -- skip silently
      }
    }

    if (newAttachments.length > 0) {
      setAttachedFiles(prev => [...prev, ...newAttachments]);
      inputRef.current?.focus();
    }
  }, [attachedFiles]);

  const removeFile = useCallback((name: string) => {
    setAttachedFiles(prev => prev.filter(f => f.name !== name));
  }, []);

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (isRunning) return;
    await addFiles(e.dataTransfer.files);
  }, [isRunning, addFiles]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  return (
    <div
      className="h-full flex flex-col bg-bg-primary relative flex-1 min-w-0"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleFileDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg-primary/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed border-accent/50 bg-accent/5">
            <FileUp size={32} className="text-accent" />
            <p className="text-sm font-medium text-text-primary">Drop files here</p>
            <p className="text-xs text-text-muted">Attach files to your message for Ruke to work with</p>
          </div>
        </div>
      )}
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
              <MessageBubble
                key={msg.id}
                message={msg}
                isStreaming={msg.id === streamingMessageId}
              />
            ))}

            {isRunning && !streamingMessageId && visibleMessages[visibleMessages.length - 1]?.role !== 'assistant' && (
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
          <div className={`bg-bg-secondary rounded-2xl border transition-colors px-4 py-2 ${
            isRunning
              ? 'input-glow-waiting border-accent/30'
              : 'border-border focus-within:border-accent/40'
          }`}>
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-2">
                {attachedFiles.map(f => (
                  <AttachmentChip key={f.name} attachment={f} removable onRemove={() => removeFile(f.name)} />
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isRunning
                    ? 'Thinking...'
                    : attachedFiles.length > 0
                      ? 'Add a message or press Enter to send...'
                      : 'Ask Ruke anything about APIs...'
                }
                disabled={isRunning}
                rows={1}
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none resize-none min-h-[24px] max-h-32 py-1 disabled:opacity-60"
                style={{ height: 'auto', overflow: 'hidden' }}
                onInput={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = 'auto';
                  t.style.height = Math.min(t.scrollHeight, 128) + 'px';
                }}
              />
              <button
                onClick={handleSend}
                disabled={!canSend}
                className={`shrink-0 p-2 rounded-xl transition-all ${
                  isRunning
                    ? 'bg-accent text-white send-btn-waiting'
                    : canSend
                      ? 'bg-accent hover:bg-accent-hover text-white shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                      : 'bg-accent/20 text-white/30 cursor-not-allowed'
                }`}
              >
                {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
          <p className="text-[10px] text-text-muted text-center mt-2 opacity-60">
            Ruke can make mistakes. Verify important API configurations.
          </p>
        </div>
      </div>
    </div>
  );
}

const SIDEBAR_PREF_KEY = 'ruke:chat_sidebar_open';

export function ChatView() {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_PREF_KEY);
    return stored !== null ? stored === 'true' : true;
  });

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_PREF_KEY, String(next));
      return next;
    });
  }, []);

  return (
    <div className="h-full flex overflow-hidden">
      {sidebarOpen && <ChatSidebar />}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <button
          onClick={toggleSidebar}
          className="absolute top-2.5 left-1.5 z-10 p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        >
          {sidebarOpen ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />}
        </button>
        <ChatPanel />
      </div>
    </div>
  );
}
