import { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from 'react';
import {
  Send, Plus, AlertCircle,
  Plug, Sparkles, Key, ArrowRight, FileUp, X,
  Clock, Trash2, Square, Search, Archive, ArchiveRestore,
  SlidersHorizontal, Layers, Terminal, FolderOpen, ChevronRight, MessageSquare, CheckCircle2,
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
  { icon: SlidersHorizontal, label: 'Set up a request', desc: 'Configure parameters, headers, and auth', prompt: 'Help me set up this API request with the right parameters' },
  { icon: Layers, label: 'Create from API', desc: 'Generate requests from connected endpoints', prompt: 'Show me what endpoints are available and create requests for the most useful ones' },
  { icon: Terminal, label: 'Import cURL', desc: 'Paste cURL commands to convert to requests', prompt: 'I have some curl commands I want to convert to requests' },
  { icon: FolderOpen, label: 'Organize requests', desc: 'Group requests into collections', prompt: 'Help me organize my requests into collections' },
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
  const [displayTitle, setDisplayTitle] = useState(title);
  const [titleAnimating, setTitleAnimating] = useState(false);
  const prevTitleRef = useRef(title);

  useEffect(() => {
    const prev = prevTitleRef.current;
    prevTitleRef.current = title;
    if (prev === title) return;

    const isAiRename = prev !== 'New Chat' && title !== 'New Chat' && prev !== title;
    const isFirstRename = prev.length > 0 && title !== 'New Chat';

    if (isAiRename || isFirstRename) {
      setTitleAnimating(true);
      const timer = setTimeout(() => {
        setDisplayTitle(title);
        requestAnimationFrame(() => setTitleAnimating(false));
      }, 150);
      return () => clearTimeout(timer);
    }
    setDisplayTitle(title);
  }, [title]);

  useEffect(() => {
    const el = textRef.current;
    if (el) setIsOverflowing(el.scrollWidth > el.clientWidth);
  }, [displayTitle]);

  const bg = isActive ? 'var(--color-bg-hover)' : 'var(--color-bg-secondary)';
  const fadeMask = isOverflowing
    ? { maskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent)', WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 24px), transparent)' }
    : undefined;

  return (
    <button
      onClick={onClick}
      title={title}
      className={`group relative flex items-center shrink-0 rounded-md transition-colors px-2.5 py-1.5 text-xs max-w-[180px] ${
        isActive
          ? 'bg-bg-hover/70 text-text-primary'
          : 'text-text-muted hover:text-text-secondary'
      }`}
    >
      <span
        ref={textRef}
        className="min-w-0 overflow-hidden whitespace-nowrap"
        style={{
          ...fadeMask,
          transition: 'opacity 300ms ease, transform 300ms ease',
          opacity: titleAnimating ? 0 : 1,
          transform: titleAnimating ? 'translateY(4px)' : 'translateY(0)',
        }}
      >
        {displayTitle}
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

function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOf7Days = new Date(startOfToday);
  startOf7Days.setDate(startOf7Days.getDate() - 7);
  const startOf30Days = new Date(startOfToday);
  startOf30Days.setDate(startOf30Days.getDate() - 30);

  if (date >= startOfToday) return 'Today';
  if (date >= startOfYesterday) return 'Yesterday';
  if (date >= startOf7Days) return 'Previous 7 Days';
  if (date >= startOf30Days) return 'Previous 30 Days';
  return 'Older';
}

type ChatSession = {
  id: string;
  title: string;
  messages: { role: string }[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

function HistoryPopover({ onClose }: { onClose: () => void }) {
  const sessions = useChatStore(s => s.sessions);
  const openTabIds = useChatStore(s => s.openTabIds);
  const loadFromHistory = useChatStore(s => s.loadFromHistory);
  const deleteSession = useChatStore(s => s.deleteSession);
  const archiveSession = useChatStore(s => s.archiveSession);
  const unarchiveSession = useChatStore(s => s.unarchiveSession);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const activeSessions = useMemo(() => {
    return sessions
      .filter(s => s.messages.length > 0 && !s.archived)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [sessions]);

  const archivedSessions = useMemo(() => {
    return sessions
      .filter(s => s.messages.length > 0 && s.archived)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [sessions]);

  const filteredActive = useMemo(() => {
    if (!search.trim()) return activeSessions;
    const q = search.toLowerCase();
    return activeSessions.filter(s => s.title.toLowerCase().includes(q));
  }, [activeSessions, search]);

  const filteredArchived = useMemo(() => {
    if (!search.trim()) return archivedSessions;
    const q = search.toLowerCase();
    return archivedSessions.filter(s => s.title.toLowerCase().includes(q));
  }, [archivedSessions, search]);

  const grouped = useMemo(() => {
    const groups: { label: string; sessions: ChatSession[] }[] = [];
    const order = ['Today', 'Yesterday', 'Previous 7 Days', 'Previous 30 Days', 'Older'];
    const map = new Map<string, ChatSession[]>();
    for (const s of filteredActive) {
      const group = getDateGroup(s.updatedAt);
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(s);
    }
    for (const label of order) {
      const items = map.get(label);
      if (items && items.length > 0) groups.push({ label, sessions: items });
    }
    return groups;
  }, [filteredActive]);

  const handleSelect = useCallback((id: string) => {
    loadFromHistory(id);
    onClose();
  }, [loadFromHistory, onClose]);

  const isOpen = (id: string) => openTabIds.includes(id);

  return (
    <div
      ref={popoverRef}
      className="absolute top-full right-0 mt-1 w-72 max-h-[420px] flex flex-col bg-bg-primary rounded-xl border border-border shadow-xl shadow-black/20 z-50 overflow-hidden"
      style={{ animation: 'popover-in 150ms ease-out' }}
    >
      <style>{`
        @keyframes popover-in {
          from { opacity: 0; transform: translateY(-4px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Search */}
      <div className="px-2.5 pt-2.5 pb-1.5 shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted/40" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search chats..."
            className="w-full bg-bg-secondary/80 border border-border/60 rounded-lg pl-7 pr-2.5 py-1.5 text-[11px] text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent/40 transition-colors"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-1.5 scrollbar-none">
        {grouped.length === 0 && filteredArchived.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-text-muted/40">
            <MessageSquare size={16} className="mb-1.5" />
            <p className="text-[11px]">{search ? 'No matching chats' : 'No chat history'}</p>
          </div>
        )}

        {grouped.map(group => (
          <div key={group.label}>
            <p className="text-[9px] text-text-muted/50 font-semibold uppercase tracking-wider px-2 pt-2 pb-0.5">
              {group.label}
            </p>
            {group.sessions.map(s => (
              <HistoryItem
                key={s.id}
                session={s}
                isOpen={isOpen(s.id)}
                onSelect={() => handleSelect(s.id)}
                onArchive={() => archiveSession(s.id)}
                onDelete={() => deleteSession(s.id)}
              />
            ))}
          </div>
        ))}

        {archivedSessions.length > 0 && (
          <div className="mt-0.5">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-1 w-full text-[9px] text-text-muted/50 font-semibold uppercase tracking-wider px-2 pt-2 pb-0.5 hover:text-text-muted transition-colors"
            >
              <ChevronRight
                size={9}
                className={`transition-transform ${showArchived ? 'rotate-90' : ''}`}
              />
              Archived ({archivedSessions.length})
            </button>
            {showArchived && filteredArchived.map(s => (
              <HistoryItem
                key={s.id}
                session={s}
                isOpen={isOpen(s.id)}
                onSelect={() => handleSelect(s.id)}
                onUnarchive={() => unarchiveSession(s.id)}
                onDelete={() => deleteSession(s.id)}
                archived
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryItem({ session, isOpen, onSelect, onArchive, onUnarchive, onDelete, archived }: {
  session: ChatSession;
  isOpen: boolean;
  onSelect: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
  onDelete: () => void;
  archived?: boolean;
}) {
  return (
    <div
      onClick={onSelect}
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
        isOpen ? 'bg-accent/8 text-text-primary' : 'text-text-secondary hover:bg-bg-hover'
      }`}
    >
      <CheckCircle2 size={13} className={`shrink-0 ${isOpen ? 'text-accent' : 'text-text-muted/30'}`} />
      <span className="flex-1 text-xs truncate min-w-0">{session.title}</span>
      <span className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {archived && onUnarchive ? (
          <button
            onClick={e => { e.stopPropagation(); onUnarchive(); }}
            className="p-1 rounded text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
            title="Unarchive"
          >
            <ArchiveRestore size={12} />
          </button>
        ) : onArchive ? (
          <button
            onClick={e => { e.stopPropagation(); onArchive(); }}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-active transition-colors"
            title="Archive"
          >
            <Archive size={12} />
          </button>
        ) : null}
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
          title="Delete"
        >
          <Trash2 size={12} />
        </button>
      </span>
    </div>
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

  const hasHistory = useMemo(
    () => sessions.some(s => s.messages.length > 0),
    [sessions]
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
      className="h-full flex flex-col bg-bg-secondary relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleFileDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg-secondary/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed border-accent/50 bg-accent/5">
            <FileUp size={32} className="text-accent" />
            <p className="text-sm font-medium text-text-primary">Drop files here</p>
          </div>
        </div>
      )}

      {/* Session tabs */}
      <div className="flex items-center gap-1 px-1.5 py-1 border-b border-border shrink-0 bg-bg-secondary/40">
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
          {hasHistory && (
            <div className="relative">
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
              {showHistory && <HistoryPopover onClose={() => setShowHistory(false)} />}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {!hasActiveTab ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="w-10 h-10 rounded-xl bg-bg-secondary border border-border/60 flex items-center justify-center mb-3">
            <Sparkles size={18} className="text-text-muted" />
          </div>
          <h2 className="text-sm font-semibold text-text-primary mb-1">Ruke</h2>
          <p className="text-[11px] text-text-muted/70 text-center max-w-xs mb-4">
            Start a new chat or open one from history
          </p>
          <button
            onClick={newChat}
            className="flex items-center gap-2 px-3.5 py-2 text-xs rounded-xl bg-accent hover:bg-accent-hover text-white transition-colors font-medium"
          >
            <Plus size={13} /> New Chat
          </button>
        </div>
      ) : isEmpty && !hasKey ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center mb-3">
            <Key size={20} className="text-accent" />
          </div>
          <h2 className="text-sm font-semibold text-text-primary mb-1">Connect a provider</h2>
          <p className="text-xs text-text-muted text-center max-w-xs mb-3">
            Add an API key for OpenAI, Anthropic, or Google in Settings to start using the AI assistant.
          </p>
          <button
            onClick={() => useUiStore.getState().setActiveView('settings')}
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors"
          >
            <ArrowRight size={12} /> Settings
          </button>
        </div>
      ) : isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="w-10 h-10 rounded-xl bg-bg-secondary border border-border/60 flex items-center justify-center mb-3">
            <Sparkles size={18} className="text-text-muted" />
          </div>
          <h2 className="text-sm font-semibold text-text-primary mb-1">Ruke</h2>
          <p className="text-[11px] text-text-muted/70 text-center max-w-[220px] mb-4">
            Your API assistant for requests, connections, collections, and more
          </p>
          {connections.length > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-bg-secondary/60 border border-border/40 mb-4">
              <Plug size={10} className="text-text-muted/50" />
              <span className="text-[10px] text-text-muted/60">
                {connections.length} API{connections.length !== 1 ? 's' : ''} &middot;{' '}
                {connections.reduce((sum, c) => sum + c.endpoints.length, 0)} endpoints
              </span>
            </div>
          )}
          <div className="w-full max-w-xs space-y-1.5">
            {SUGGESTIONS.map(s => (
              <button
                key={s.label}
                onClick={() => handleSuggestion(s.prompt)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-bg-secondary border border-border hover:border-accent/30 hover:bg-bg-hover transition-all text-left group"
              >
                <div className="w-7 h-7 rounded-lg bg-bg-tertiary/60 group-hover:bg-accent/10 flex items-center justify-center shrink-0 transition-colors">
                  <s.icon size={13} className="text-text-muted/50 group-hover:text-accent/70 transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-text-primary">{s.label}</p>
                  <p className="text-[10px] text-text-muted/50 mt-0.5">{s.desc}</p>
                </div>
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
      {hasActiveTab && (
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
