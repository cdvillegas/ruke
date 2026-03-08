import { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from 'react';
import {
  Send, Plus, AlertCircle,
  Plug, Sparkles, Key, ArrowRight, FileUp, X,
  Clock, Trash2, Square,
} from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useUiStore } from '../../stores/uiStore';
import { MessageBubble } from '../shared/MessageBubble';
import { ThinkingIndicator } from '../shared/ThinkingIndicator';
import { AttachmentChip } from '../shared/AttachmentChip';
import type { ChatAttachment } from '@shared/types';

const AI_KEY_STORAGE = 'ruke:ai_key';

function hasAiKey(): boolean {
  return (localStorage.getItem(AI_KEY_STORAGE) || '').length >= 10;
}

const SUGGESTIONS = [
  { label: 'Set up a request', prompt: 'Help me set up this API request with the right parameters' },
  { label: 'Create from API', prompt: 'Show me what endpoints are available and create requests for the most useful ones' },
  { label: 'Import requests', prompt: 'I have some curl commands I want to convert to requests' },
  { label: 'Organize requests', prompt: 'Help me organize my requests into collections' },
];

function SessionTab({ id, title, isActive, onClick, onClose }: {
  id: string;
  title: string;
  isActive: boolean;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
}) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const el = textRef.current;
    if (el) setIsOverflowing(el.scrollWidth > el.clientWidth);
  }, [title]);

  const bg = isActive ? 'var(--color-bg-hover)' : 'var(--color-bg-primary)';
  const fadeMask = isOverflowing
    ? { maskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent)', WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent)' }
    : undefined;

  return (
    <button
      onClick={onClick}
      title={title}
      className={`group relative flex items-center shrink-0 rounded-md transition-colors pl-3 pr-2 py-1.5 text-xs max-w-[180px] ${
        isActive
          ? 'bg-bg-hover/70 text-text-primary'
          : 'text-text-muted hover:text-text-secondary'
      }`}
    >
      <span
        ref={textRef}
        className="min-w-0 overflow-hidden whitespace-nowrap"
        style={fadeMask}
      >
        {title}
      </span>
      <span
        className="absolute right-0 top-0 bottom-0 flex items-center pr-1 pl-3 rounded-r-md opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: `linear-gradient(to right, transparent, ${bg} 60%)`,
        }}
      >
        <span
          onClick={onClose}
          className="p-0.5 rounded hover:bg-bg-active transition-colors text-text-muted hover:text-text-primary"
        >
          <X size={11} />
        </span>
      </span>
    </button>
  );
}

export function AgentPanel() {
  const sessions = useChatStore(s => s.sessions);
  const activeSessionId = useChatStore(s => s.activeSessionId);
  const openTabIds = useChatStore(s => s.openTabIds);
  const isRunning = useChatStore(s => s.isRunning);
  const error = useChatStore(s => s.error);
  const setActiveSession = useChatStore(s => s.setActiveSession);
  const newChat = useChatStore(s => s.newChat);
  const closeTab = useChatStore(s => s.closeTab);
  const deleteSession = useChatStore(s => s.deleteSession);
  const loadFromHistory = useChatStore(s => s.loadFromHistory);
  const sendMessage = useChatStore(s => s.sendMessage);
  const stopGeneration = useChatStore(s => s.stopGeneration);
  const setError = useChatStore(s => s.setError);
  const setAiPanelOpen = useUiStore(s => s.setAiPanelOpen);

  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<ChatAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const dragCounter = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRafRef = useRef<number | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const streamingMessageId = useChatStore(s => s.streamingMessageId);
  const streamTick = useChatStore(s => s.streamTick);
  const connections = useConnectionStore(s => s.connections);

  const openTabs = useMemo(
    () => openTabIds.map(id => sessions.find(s => s.id === id)).filter(Boolean) as typeof sessions,
    [openTabIds, sessions]
  );

  const activeSession = useMemo(
    () => sessions.find(s => s.id === activeSessionId),
    [sessions, activeSessionId]
  );

  const historySessions = useMemo(
    () => sessions
      .filter(s => s.messages.length > 0 && !openTabIds.includes(s.id))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [sessions, openTabIds]
  );

  const visibleMessages = useMemo(
    () => activeSession ? activeSession.messages.filter(m => m.role !== 'tool') : [],
    [activeSession]
  );
  const hasActiveTab = !!activeSession && openTabIds.includes(activeSessionId);
  const isEmpty = visibleMessages.length === 0 && !isRunning;
  const canSend = hasActiveTab && !isRunning && (input.trim() || attachedFiles.length > 0);

  const showThinking = isRunning && !streamingMessageId;

  useEffect(() => {
    if (openTabIds.length === 0) {
      setAiPanelOpen(false);
    }
  }, [openTabIds.length, setAiPanelOpen]);

  useLayoutEffect(() => {
    if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, [activeSession?.messages, isRunning, streamTick]);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  useEffect(() => {
    if (tabsRef.current) {
      tabsRef.current.scrollLeft = tabsRef.current.scrollWidth;
    }
  }, [openTabIds.length]);

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
      messageContent = text ? `${text}\n\n${fileParts.join('\n\n')}` : fileParts.join('\n\n');
    }

    await sendMessage(messageContent, files.length > 0 ? files : undefined);
    inputRef.current?.focus();
  }, [canSend, input, attachedFiles, sendMessage]);

  const handleSuggestion = useCallback((prompt: string) => {
    setInput(prompt);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

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
      if (attachedFiles.some(a => a.name === file.name)) continue;
      try {
        const content = await file.text();
        newAttachments.push({ name: file.name, size: file.size, content });
      } catch {}
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
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current <= 0) { dragCounter.current = 0; setIsDragging(false); }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleCloseTab = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    closeTab(id);
  }, [closeTab]);

  const hasKey = hasAiKey();

  return (
    <div
      className="h-full flex flex-col bg-bg-primary border-l border-border relative"
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
          </div>
        </div>
      )}

      {/* Session tabs */}
      <div className="flex items-center gap-1 px-1.5 py-1 border-b border-border shrink-0">
        <div ref={tabsRef} className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto scrollbar-none">
          {openTabs.map(s => (
            <SessionTab
              key={s.id}
              id={s.id}
              title={s.title}
              isActive={s.id === activeSessionId}
              onClick={() => { setActiveSession(s.id); setError(null); }}
              onClose={(e) => handleCloseTab(e, s.id)}
            />
          ))}
        </div>
        <div className="flex items-center shrink-0 gap-0.5 ml-1">
          <button
            onClick={newChat}
            className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            title="New Chat"
          >
            <Plus size={13} />
          </button>
          {historySessions.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`p-1 rounded-md transition-colors ${
                showHistory
                  ? 'text-accent bg-accent/10'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
              }`}
              title="Chat history"
            >
              <Clock size={13} />
            </button>
          )}
        </div>
      </div>

      {/* History dropdown */}
      {showHistory && historySessions.length > 0 && (
        <div className="border-b border-border bg-bg-secondary/30 px-2 py-1.5 max-h-48 overflow-y-auto">
          <p className="text-[10px] text-text-muted font-medium uppercase tracking-wider px-1 mb-1">
            History ({historySessions.length})
          </p>
          {historySessions.map(s => (
            <div
              key={s.id}
              onClick={() => { loadFromHistory(s.id); setShowHistory(false); }}
              className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-bg-hover transition-colors group cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <span className="text-xs text-text-secondary truncate block">{s.title}</span>
                <span className="text-[10px] text-text-muted">{s.messages.length} messages</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                title="Delete"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {!hasKey ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center mb-3">
            <Key size={20} className="text-accent" />
          </div>
          <h2 className="text-sm font-semibold text-text-primary mb-1">Set up AI</h2>
          <p className="text-xs text-text-muted text-center max-w-xs mb-3">
            Add your OpenAI API key in Settings to start using the AI assistant.
          </p>
          <button
            onClick={() => useUiStore.getState().setActiveView('settings')}
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors"
          >
            <ArrowRight size={12} /> Settings
          </button>
        </div>
      ) : !hasActiveTab ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center mb-3">
            <Sparkles size={20} className="text-accent" />
          </div>
          <h2 className="text-sm font-semibold text-text-primary mb-0.5">Ruke</h2>
          <p className="text-xs text-text-muted text-center max-w-xs mb-4">
            Start a new chat or open one from history.
          </p>
          <button
            onClick={newChat}
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors"
          >
            <Plus size={12} /> New Chat
          </button>
        </div>
      ) : isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center mb-3">
            <Sparkles size={20} className="text-accent" />
          </div>
          <h2 className="text-sm font-semibold text-text-primary mb-0.5">Ruke</h2>
          <p className="text-xs text-text-muted text-center max-w-xs mb-4">
            Your API assistant. I can edit requests, connect APIs, create collections, and more.
          </p>
          {connections.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-bg-secondary border border-border mb-4">
              <Plug size={11} className="text-accent" />
              <span className="text-[10px] text-text-muted">
                {connections.length} API{connections.length !== 1 ? 's' : ''} &middot;{' '}
                {connections.reduce((sum, c) => sum + c.endpoints.length, 0)} endpoints
              </span>
            </div>
          )}
          <div className="grid grid-cols-1 gap-1.5 w-full max-w-xs">
            {SUGGESTIONS.map(s => (
              <button
                key={s.label}
                onClick={() => handleSuggestion(s.prompt)}
                className="text-left px-3 py-2 rounded-lg border border-border bg-bg-secondary hover:bg-bg-hover hover:border-accent/30 transition-all"
              >
                <p className="text-xs font-medium text-text-primary">{s.label}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-3">
            {visibleMessages.map(msg => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isStreaming={msg.id === streamingMessageId}
                maxWidth="max-w-[90%]"
                userMaxWidth="max-w-[85%]"
              />
            ))}
            {showThinking && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 px-3 py-2">
                  <span className="flex items-center gap-[3px]">
                    <span className="w-[5px] h-[5px] rounded-full bg-accent animate-bounce [animation-delay:0ms]" />
                    <span className="w-[5px] h-[5px] rounded-full bg-accent animate-bounce [animation-delay:150ms]" />
                    <span className="w-[5px] h-[5px] rounded-full bg-accent animate-bounce [animation-delay:300ms]" />
                  </span>
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

      {/* Input */}
      {hasKey && hasActiveTab && (
        <div className="shrink-0 border-t border-border p-2.5">
          <div className={`bg-bg-secondary rounded-xl border transition-colors px-3 py-1.5 ${
            isRunning
              ? 'input-glow-waiting border-accent/30'
              : 'border-border focus-within:border-accent/40'
          }`}>
            {!isRunning && attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-1.5">
                {attachedFiles.map(f => (
                  <AttachmentChip key={f.name} attachment={f} removable onRemove={() => removeFile(f.name)} />
                ))}
              </div>
            )}
            <div className={`flex gap-2 ${isRunning ? 'items-center' : 'items-end'}`}>
              {isRunning ? (
                <div className="flex-1">
                  <ThinkingIndicator />
                </div>
              ) : (
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about your request..."
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none resize-none min-h-[24px] max-h-28 py-1"
                  style={{ height: 'auto', overflow: 'hidden' }}
                  onInput={e => {
                    const t = e.target as HTMLTextAreaElement;
                    t.style.height = 'auto';
                    t.style.height = Math.min(t.scrollHeight, 112) + 'px';
                  }}
                />
              )}
              {isRunning ? (
                <button
                  onClick={stopGeneration}
                  className="shrink-0 p-1.5 rounded-lg transition-all bg-bg-tertiary hover:bg-bg-hover text-text-secondary hover:text-text-primary border border-border"
                  title="Stop generation"
                >
                  <Square size={14} />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  className={`shrink-0 p-1.5 rounded-lg transition-all ${
                    canSend
                      ? 'bg-accent hover:bg-accent-hover text-white shadow-[0_0_8px_rgba(59,130,246,0.3)]'
                      : 'bg-accent/20 text-white/30 cursor-not-allowed'
                  }`}
                >
                  <Send size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
