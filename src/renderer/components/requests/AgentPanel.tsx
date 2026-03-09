import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Send, Plus, AlertCircle,
  Plug, Sparkles, Key, ArrowRight, FileUp, X,
  Clock, Trash2, Square, Search, Archive, ArchiveRestore,
  SlidersHorizontal, Layers, Terminal, FolderOpen, ChevronRight, MessageSquare, CheckCircle2,
  ChevronUp, ChevronDown, Check, Bot, Eye, Infinity, Circle, Pencil, ArrowUp, Paperclip,
  ListChecks, Loader2, XCircle, SkipForward,
} from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { useRequestStore } from '../../stores/requestStore';
import { useUiStore } from '../../stores/uiStore';
import { usePlanStore } from '../../stores/planStore';
import { ConversationTurn } from '../shared/MessageBubble';
import { ThinkingIndicator } from '../shared/ThinkingIndicator';
import { AttachmentChip } from '../shared/AttachmentChip';
import {
  getModelConfig, selectModel, getConfiguredProviders,
  MANAGED_PROVIDERS, PROVIDER_META, PROVIDER_MODELS,
  type ManagedProvider, type AgentMode,
} from '../../lib/agentRunner';
import type { ChatAttachment, ContextMention, ContextMentionType, Plan } from '@shared/types';

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

function PlanStepIcon({ status }: { status: string }) {
  switch (status) {
    case 'done': return <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />;
    case 'in_progress': return <Loader2 size={13} className="text-amber-400 shrink-0 animate-spin" />;
    case 'failed': return <XCircle size={13} className="text-red-400 shrink-0" />;
    case 'skipped': return <SkipForward size={13} className="text-text-muted shrink-0" />;
    default: return <Circle size={13} className="text-text-muted/40 shrink-0" />;
  }
}

function InlinePlanView({ plan, onExecute, onStop }: { plan: Plan; onExecute: () => void; onStop: () => void }) {
  const [collapsed, setCollapsed] = useState(plan.status === 'completed');
  const done = plan.steps.filter(s => s.status === 'done' || s.status === 'skipped').length;
  const total = plan.steps.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  useEffect(() => {
    if (plan.status === 'completed') setCollapsed(true);
  }, [plan.status]);

  const borderClass = plan.status === 'in_progress'
    ? 'border-accent/30'
    : plan.status === 'completed'
      ? 'border-emerald-400/20'
      : plan.status === 'failed'
        ? 'border-red-400/20'
        : 'border-amber-400/20';

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
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 hover:bg-bg-hover/30 transition-colors rounded-t-xl"
      >
        <ListChecks size={14} className={`shrink-0 ${
          plan.status === 'completed' ? 'text-emerald-400' :
          plan.status === 'in_progress' ? 'text-accent' :
          'text-amber-400'
        }`} />
        <span className="text-sm font-medium text-text-primary flex-1 text-left truncate">{plan.title}</span>
        {statusBadge}
        <span className="text-[10px] text-text-muted shrink-0 tabular-nums">{done}/{total}</span>
        <ChevronRight size={12} className={`text-text-muted shrink-0 transition-transform ${collapsed ? '' : 'rotate-90'}`} />
      </button>

      {/* Progress bar */}
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

      {/* Steps */}
      {!collapsed && (
        <div className="px-3.5 pt-2 pb-1 space-y-0.5">
          {plan.steps.map(step => (
            <div key={step.id} className="flex items-start gap-2.5 py-1">
              <PlanStepIcon status={step.status} />
              <span className={`text-xs leading-snug ${
                step.status === 'done' ? 'text-text-muted line-through' :
                step.status === 'in_progress' ? 'text-text-primary font-medium' :
                step.status === 'failed' ? 'text-red-400' :
                step.status === 'skipped' ? 'text-text-muted' :
                'text-text-secondary'
              }`}>{step.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer actions */}
      {plan.status === 'draft' && (
        <div className="px-3.5 pb-3 pt-2">
          <button
            onClick={onExecute}
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
            onClick={onStop}
            className="w-full py-1.5 rounded-lg text-xs font-medium text-text-secondary bg-bg-tertiary hover:bg-bg-hover border border-border transition-all"
          >
            Stop Execution
          </button>
        </div>
      )}
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
  const messageQueue = useChatStore(s => s.messageQueue);
  const removeQueuedMessage = useChatStore(s => s.removeQueuedMessage);
  const setAiPanelOpen = useUiStore(s => s.setAiPanelOpen);

  const plans = usePlanStore(s => s.plans);
  const activePlanId = usePlanStore(s => s.activePlanId);

  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<ChatAttachment[]>([]);
  const [mentions, setMentions] = useState<ContextMention[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showModePicker, setShowModePicker] = useState(false);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [modelTick, setModelTick] = useState(0);
  const [agentMode, setAgentMode] = useState<AgentMode>('agent');
  const [queueExpanded, setQueueExpanded] = useState(true);
  const [filesExpanded, setFilesExpanded] = useState(false);
  const dragCounter = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRafRef = useRef<number | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const modePickerRef = useRef<HTMLDivElement>(null);
  const mentionMenuRef = useRef<HTMLDivElement>(null);

  const streamingMessageId = useChatStore(s => s.streamingMessageId);
  const streamTick = useChatStore(s => s.streamTick);
  const connections = useConnectionStore(s => s.connections);
  const environments = useEnvironmentStore(s => s.environments);
  const collections = useCollectionStore(s => s.collections);
  const uncollectedRequests = useRequestStore(s => s.uncollectedRequests);
  const collectionRequests = useCollectionStore(s => s.requests);

  const openTabs = useMemo(
    () => openTabIds.map(id => sessions.find(s => s.id === id)).filter(Boolean) as typeof sessions,
    [openTabIds, sessions]
  );

  const activeSession = useMemo(
    () => sessions.find(s => s.id === activeSessionId),
    [sessions, activeSessionId]
  );

  const activePlan = useMemo(() => {
    if (activePlanId) {
      const p = plans.find(pl => pl.id === activePlanId && pl.chatSessionId === activeSessionId);
      if (p) return p;
    }
    return plans.find(p => p.chatSessionId === activeSessionId) || null;
  }, [activePlanId, plans, activeSessionId]);

  const hasHistory = useMemo(
    () => sessions.some(s => s.messages.length > 0),
    [sessions]
  );

  const visibleMessages = useMemo(
    () => activeSession ? activeSession.messages.filter(m => m.role !== 'tool') : [],
    [activeSession]
  );
  const conversationTurns = useMemo(() => {
    const turns: { userMessage: typeof visibleMessages[0]; assistantMessages: typeof visibleMessages }[] = [];
    let currentTurn: typeof turns[0] | null = null;
    for (const msg of visibleMessages) {
      if (msg.role === 'user') {
        currentTurn = { userMessage: msg, assistantMessages: [] };
        turns.push(currentTurn);
      } else if (msg.role === 'assistant' && currentTurn) {
        currentTurn.assistantMessages.push(msg);
      } else if (msg.role === 'assistant') {
        turns.push({ userMessage: msg, assistantMessages: [] });
      }
    }
    return turns;
  }, [visibleMessages]);

  const hasActiveTab = !!activeSession && openTabIds.includes(activeSessionId);
  const isEmpty = visibleMessages.length === 0 && !isRunning && !activePlan;
  const canSend = hasActiveTab && (input.trim() || attachedFiles.length > 0);

  const mentionItems = useMemo(() => {
    const items: { type: ContextMentionType; id: string; label: string; meta?: string }[] = [];
    const seenRequestIds = new Set<string>();
    for (const r of uncollectedRequests) {
      seenRequestIds.add(r.id);
      items.push({ type: 'request', id: r.id, label: r.name || r.url || 'Untitled', meta: r.method });
    }
    for (const reqs of Object.values(collectionRequests)) {
      for (const r of reqs) {
        if (seenRequestIds.has(r.id)) continue;
        seenRequestIds.add(r.id);
        items.push({ type: 'request', id: r.id, label: r.name || r.url || 'Untitled', meta: r.method });
      }
    }
    for (const c of collections) {
      items.push({ type: 'collection', id: c.id, label: c.name });
    }
    for (const e of environments) {
      items.push({ type: 'environment', id: e.id, label: e.name });
    }
    for (const c of connections) {
      items.push({ type: 'connection', id: c.id, label: c.name, meta: c.baseUrl });
    }
    if (!mentionQuery) return items;
    const q = mentionQuery.toLowerCase();
    return items.filter(i => i.label.toLowerCase().includes(q) || i.meta?.toLowerCase().includes(q) || i.type.includes(q));
  }, [uncollectedRequests, collectionRequests, collections, environments, connections, mentionQuery]);

  const showThinking = isRunning && !streamingMessageId;

  const currentConfig = useMemo(() => {
    void modelTick;
    return getModelConfig();
  }, [modelTick]);

  const configuredProviders = useMemo(() => {
    void modelTick;
    return getConfiguredProviders();
  }, [modelTick]);

  const activeProviderLabel = useMemo(() => {
    if (!currentConfig) return 'No AI';
    const managed = MANAGED_PROVIDERS.find(p => p === currentConfig.provider);
    if (managed) return PROVIDER_META[managed].label;
    return currentConfig.provider;
  }, [currentConfig]);

  const activeModelShort = useMemo(() => {
    if (!currentConfig) return '';
    const provider = MANAGED_PROVIDERS.find(p => p === currentConfig.provider);
    if (provider) {
      const models = PROVIDER_MODELS[provider];
      const match = models.find(m => m.id === currentConfig.model);
      if (match) return match.label;
    }
    const m = currentConfig.model;
    if (m.length > 16) return m.slice(0, 14) + '…';
    return m;
  }, [currentConfig]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false);
      }
      if (modePickerRef.current && !modePickerRef.current.contains(e.target as Node)) {
        setShowModePicker(false);
      }
      if (mentionMenuRef.current && !mentionMenuRef.current.contains(e.target as Node)) {
        setShowMentionMenu(false);
        setMentionQuery('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      setShowMentionMenu(true);
      setMentionQuery(atMatch[1]);
    } else {
      setShowMentionMenu(false);
      setMentionQuery('');
    }
  }, []);

  const handleSelectModel = useCallback((provider: ManagedProvider, modelId: string) => {
    selectModel(provider, modelId);
    setModelTick(t => t + 1);
    setShowModelPicker(false);
  }, []);

  useEffect(() => {
    if (openTabIds.length === 0) {
      setAiPanelOpen(false);
    }
  }, [openTabIds.length, setAiPanelOpen]);

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

  const userAtBottom = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      userAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (userAtBottom.current) {
      bottomRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [visibleMessages.length, streamTick, showThinking]);

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    const text = input.trim();
    const files = [...attachedFiles];
    const currentMentions = [...mentions];
    setInput('');
    setAttachedFiles([]);
    setMentions([]);

    let messageContent = text;
    if (files.length > 0) {
      const fileParts = files.map(f =>
        `<file name="${f.name}" size="${f.size}">\n${f.content}\n</file>`
      );
      messageContent = text ? `${text}\n\n${fileParts.join('\n\n')}` : fileParts.join('\n\n');
    }

    await sendMessage(
      messageContent,
      files.length > 0 ? files : undefined,
      agentMode,
      currentMentions.length > 0 ? currentMentions : undefined,
    );
    inputRef.current?.focus();
  }, [canSend, input, attachedFiles, mentions, sendMessage, agentMode]);

  const handleSuggestion = useCallback((prompt: string) => {
    sendMessage(prompt, undefined, agentMode);
  }, [sendMessage, agentMode]);

  const handleResend = useCallback((content: string) => {
    sendMessage(content, undefined, agentMode);
  }, [sendMessage, agentMode]);

  const executePlan = useCallback((plan: Plan) => {
    const currentSessionId = useChatStore.getState().activeSessionId;
    if (currentSessionId && plan.chatSessionId !== currentSessionId) {
      usePlanStore.getState().updatePlanSession(plan.id, currentSessionId);
    }
    usePlanStore.getState().updatePlanStatus(plan.id, 'in_progress');
    const stepsList = plan.steps.map((s, i) => `${i + 1}. [step_id:${s.id}] ${s.description}`).join('\n');
    const msg = `Execute plan "${plan.title}" (plan_id: ${plan.id}).\n\nWork through each step sequentially:\n${stepsList}`;
    sendMessage(msg, undefined, 'agent');
  }, [sendMessage]);

  const addMention = useCallback((item: { type: ContextMentionType; id: string; label: string; meta?: string }) => {
    if (mentions.some(m => m.id === item.id && m.type === item.type)) return;
    setMentions(prev => [...prev, { type: item.type, id: item.id, label: item.label, meta: item.meta }]);
    setShowMentionMenu(false);
    setMentionQuery('');

    if (inputRef.current) {
      const val = inputRef.current.value;
      const atIdx = val.lastIndexOf('@');
      if (atIdx >= 0) {
        const before = val.slice(0, atIdx);
        setInput(before);
      }
    }
    inputRef.current?.focus();
  }, [mentions]);

  const removeMention = useCallback((id: string) => {
    setMentions(prev => prev.filter(m => m.id !== id));
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && showMentionMenu) {
      setShowMentionMenu(false);
      setMentionQuery('');
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      if (showMentionMenu) {
        setShowMentionMenu(false);
        setMentionQuery('');
        return;
      }
      e.preventDefault();
      handleSend();
    }
  }, [handleSend, showMentionMenu]);

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

    const contextData = e.dataTransfer.getData('application/ruke-context');
    if (contextData) {
      try {
        const ctx = JSON.parse(contextData);
        if (ctx.type && ctx.id && ctx.label) {
          if (!mentions.some(m => m.id === ctx.id && m.type === ctx.type)) {
            setMentions(prev => [...prev, { type: ctx.type, id: ctx.id, label: ctx.label, meta: ctx.meta }]);
          }
          inputRef.current?.focus();
          return;
        }
      } catch {}
    }

    if (isRunning) return;
    await addFiles(e.dataTransfer.files);
  }, [isRunning, addFiles, mentions]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('application/ruke-context')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current <= 0) { dragCounter.current = 0; setIsDragging(false); }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('application/ruke-context')) {
      e.dataTransfer.dropEffect = 'move';
    } else {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleCloseTab = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    closeTab(id);
  }, [closeTab]);

  const hasKey = hasAiKey();

  return (
    <div className="h-full flex flex-col bg-bg-secondary relative"
    >

      {/* Session tabs */}
      <div className="flex items-center gap-1 px-1.5 py-1.5 shrink-0 bg-bg-secondary/40">
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
        <div className="flex items-center shrink-0 gap-1 ml-1.5">
          <button
            onClick={newChat}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            title="New Chat"
          >
            <Plus size={15} />
          </button>
          {hasHistory && (
            <div className="relative">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`p-1.5 rounded-lg transition-colors ${
                  showHistory
                    ? 'text-accent bg-accent/10'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
                }`}
                title="Chat history"
              >
                <Clock size={15} />
              </button>
              {showHistory && <HistoryPopover onClose={() => setShowHistory(false)} />}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {!hasActiveTab ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-12 h-12 rounded-xl bg-bg-secondary border border-border/60 flex items-center justify-center mb-4">
            <Sparkles size={22} className="text-text-muted" />
          </div>
          <h2 className="text-base font-semibold text-text-primary mb-1.5">Ruke</h2>
          <p className="text-xs text-text-muted/70 text-center max-w-xs mb-5">
            Start a new chat or open one from history
          </p>
          <button
            onClick={newChat}
            className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-xl bg-accent hover:bg-accent-hover text-white transition-colors font-medium"
          >
            <Plus size={15} /> New Chat
          </button>
        </div>
      ) : isEmpty && !hasKey ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center mb-4">
            <Key size={22} className="text-accent" />
          </div>
          <h2 className="text-base font-semibold text-text-primary mb-1.5">Connect a provider</h2>
          <p className="text-sm text-text-muted text-center max-w-xs mb-4">
            Add an API key for OpenAI, Anthropic, or Google in Settings to start using the AI assistant.
          </p>
          <button
            onClick={() => useUiStore.getState().setActiveView('settings')}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors"
          >
            <ArrowRight size={14} /> Settings
          </button>
        </div>
      ) : isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-12 h-12 rounded-xl bg-bg-secondary border border-border/60 flex items-center justify-center mb-4">
            <Sparkles size={22} className="text-text-muted" />
          </div>
          <h2 className="text-base font-semibold text-text-primary mb-1.5">Ruke</h2>
          <p className="text-xs text-text-muted/70 text-center max-w-[240px] mb-5">
            Your API assistant for requests, connections, collections, and more
          </p>
          {connections.length > 0 && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-bg-secondary/60 border border-border/40 mb-5">
              <Plug size={12} className="text-text-muted/50" />
              <span className="text-[11px] text-text-muted/60">
                {connections.length} API{connections.length !== 1 ? 's' : ''} &middot;{' '}
                {connections.reduce((sum, c) => sum + c.endpoints.length, 0)} endpoints
              </span>
            </div>
          )}
          <div className="w-full max-w-sm space-y-2">
            {SUGGESTIONS.map(s => (
              <button
                key={s.label}
                onClick={() => handleSuggestion(s.prompt)}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-bg-secondary border border-border hover:border-accent/30 hover:bg-bg-hover transition-all text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-bg-tertiary/60 group-hover:bg-accent/10 flex items-center justify-center shrink-0 transition-colors">
                  <s.icon size={15} className="text-text-muted/50 group-hover:text-accent/70 transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary">{s.label}</p>
                  <p className="text-[11px] text-text-muted/50 mt-0.5">{s.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Pinned plan banner */}
          {activePlan && (
            <div className="shrink-0 z-10 border-b border-border shadow-sm">
              <InlinePlanView
                plan={activePlan}
                onExecute={() => executePlan(activePlan)}
                onStop={() => {
                  stopGeneration();
                  usePlanStore.getState().updatePlanStatus(activePlan.id, 'draft');
                }}
              />
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto relative z-0">
            <div>
              {conversationTurns.map((turn, i) => (
                <ConversationTurn
                  key={turn.userMessage.id}
                  userMessage={turn.userMessage}
                  assistantMessages={turn.assistantMessages}
                  streamingMessageId={streamingMessageId}
                  onResend={turn.userMessage.role === 'user' ? handleResend : undefined}
                  isLast={i === conversationTurns.length - 1}
                />
              ))}
              {showThinking && (
                <div className="flex justify-start px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center gap-[3px]">
                      <span className="w-[5px] h-[5px] rounded-full bg-accent animate-bounce [animation-delay:0ms]" />
                      <span className="w-[5px] h-[5px] rounded-full bg-accent animate-bounce [animation-delay:150ms]" />
                      <span className="w-[5px] h-[5px] rounded-full bg-accent animate-bounce [animation-delay:300ms]" />
                    </span>
                  </div>
                </div>
              )}
              {error && (
                <div className="flex justify-start px-3 py-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                    <AlertCircle size={14} className="text-red-400 shrink-0" />
                    <span className="text-xs text-red-400">{error}</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      {hasActiveTab && (
        <div
          className="shrink-0 border-t border-border p-2.5 relative z-20"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleFileDrop}
        >
          {isDragging && (
            <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl bg-bg-secondary/90 backdrop-blur-sm m-1">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-accent/50 bg-accent/5">
                <FileUp size={16} className="text-accent" />
                <p className="text-xs font-medium text-text-primary">Drop to add as context</p>
              </div>
            </div>
          )}
          {/* Queued messages — stacked above input */}
          {messageQueue.length > 0 && (
            <div className="mb-2 rounded-xl border border-border bg-bg-secondary px-3 py-2">
              <button
                onClick={() => setQueueExpanded(!queueExpanded)}
                className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-primary transition-colors w-full"
              >
                {queueExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                <span className="font-medium">{messageQueue.length} Queued</span>
              </button>
              {queueExpanded && (
                <div className="space-y-0.5 mt-1.5">
                  {messageQueue.map((q, i) => (
                    <div key={i} className="group/q flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-bg-hover/50 text-xs transition-colors">
                      <Circle size={8} className="text-text-muted/40 shrink-0" />
                      <span className="flex-1 truncate text-text-secondary">{q.content.slice(0, 80)}{q.content.length > 80 ? '…' : ''}</span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover/q:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => { removeQueuedMessage(i); setInput(q.content); }}
                          className="p-0.5 rounded text-text-muted hover:text-text-primary transition-colors"
                          title="Edit"
                        >
                          <Pencil size={10} />
                        </button>
                        {i > 0 && (
                          <button
                            onClick={() => {
                              const queue = [...messageQueue];
                              [queue[i - 1], queue[i]] = [queue[i], queue[i - 1]];
                              useChatStore.getState().reorderQueue(queue);
                            }}
                            className="p-0.5 rounded text-text-muted hover:text-text-primary transition-colors"
                            title="Move up"
                          >
                            <ArrowUp size={10} />
                          </button>
                        )}
                        <button
                          onClick={() => removeQueuedMessage(i)}
                          className="p-0.5 rounded text-text-muted hover:text-error transition-colors"
                          title="Remove"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className={`bg-bg-secondary rounded-xl border transition-all duration-300 px-3 ${
            isRunning
              ? 'input-glow-waiting border-accent/30'
              : agentMode === 'ask'
                ? 'border-border focus-within:border-emerald-400/40 focus-within:shadow-[0_0_12px_rgba(52,211,153,0.08)]'
                : agentMode === 'plan'
                  ? 'border-border focus-within:border-amber-400/40 focus-within:shadow-[0_0_12px_rgba(251,191,36,0.08)]'
                  : 'border-border focus-within:border-accent/40 focus-within:shadow-[0_0_12px_rgba(99,102,241,0.08)]'
          }`}>

            {/* Attachments & context mentions */}
            {(attachedFiles.length > 0 || mentions.length > 0) && (
              <div className={messageQueue.length > 0 ? '' : 'pt-2'}>
                {attachedFiles.length > 0 && (
                  <button
                    onClick={() => setFilesExpanded(!filesExpanded)}
                    className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-primary transition-colors w-full mb-1"
                  >
                    {filesExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                    <span className="font-medium">{attachedFiles.length} File{attachedFiles.length !== 1 ? 's' : ''}</span>
                  </button>
                )}
                {(filesExpanded || attachedFiles.length === 0) && attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pb-0.5">
                    {attachedFiles.map(f => (
                      <AttachmentChip key={f.name} attachment={f} removable onRemove={() => removeFile(f.name)} />
                    ))}
                  </div>
                )}
                {mentions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pb-0.5 pt-1">
                    {mentions.map(m => (
                      <span key={`${m.type}-${m.id}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/10 border border-accent/20 text-[11px] text-accent font-medium">
                        {m.type === 'request' && <Send size={10} />}
                        {m.type === 'connection' && <Plug size={10} />}
                        {m.type === 'environment' && <Layers size={10} />}
                        {m.type === 'collection' && <FolderOpen size={10} />}
                        <span className="max-w-[120px] truncate">{m.label}</span>
                        <button onClick={() => removeMention(m.id)} className="text-accent/60 hover:text-accent transition-colors">
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Textarea */}
            <div className="py-1.5 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  isRunning
                    ? 'Add a follow-up'
                    : agentMode === 'ask'
                      ? 'What would you like to know?  @ to add context'
                      : agentMode === 'plan'
                        ? 'Describe what you want to plan  @ to add context'
                        : 'What can I help you build?  @ to add context'
                }
                rows={1}
                className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none resize-none min-h-[24px] max-h-28"
                style={{ height: 'auto', overflow: 'hidden' }}
                onInput={e => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = 'auto';
                  t.style.height = Math.min(t.scrollHeight, 112) + 'px';
                }}
              />

              {/* @ Mention popup */}
              {showMentionMenu && mentionItems.length > 0 && (
                <div ref={mentionMenuRef} className="absolute bottom-full left-0 mb-1.5 w-64 bg-bg-secondary border border-border rounded-xl shadow-2xl z-50 py-1 animate-fade-in max-h-56 overflow-y-auto">
                  {['request', 'connection', 'environment', 'collection'].map(type => {
                    const typeItems = mentionItems.filter(i => i.type === type);
                    if (typeItems.length === 0) return null;
                    const typeLabel = type === 'request' ? 'Requests' : type === 'connection' ? 'APIs' : type === 'environment' ? 'Environments' : 'Collections';
                    return (
                      <div key={type}>
                        <div className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                          {typeLabel}
                        </div>
                        {typeItems.slice(0, 8).map(item => (
                          <button
                            key={`${item.type}-${item.id}`}
                            onClick={() => addMention(item)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
                          >
                            {item.type === 'request' && <Send size={11} className="text-text-muted shrink-0" />}
                            {item.type === 'connection' && <Plug size={11} className="text-text-muted shrink-0" />}
                            {item.type === 'environment' && <Layers size={11} className="text-text-muted shrink-0" />}
                            {item.type === 'collection' && <FolderOpen size={11} className="text-text-muted shrink-0" />}
                            <span className="font-medium truncate">{item.label}</span>
                            {item.meta && <span className="text-[10px] text-text-muted ml-auto shrink-0">{item.meta}</span>}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Toolbar: mode picker, model picker, send/stop */}
            <div className="flex items-center justify-between pb-2.5 pt-1.5">
              {/* Left: mode picker + model picker */}
              <div className="flex items-center gap-1">
                <div ref={modePickerRef}>
                  {(() => {
                    const modeStyles = {
                      agent: { bg: 'bg-accent/8', border: 'border-accent/15', text: 'text-accent/80', hover: 'hover:bg-accent/12', shadow: 'shadow-[0_0_8px_rgba(99,102,241,0.12)]' },
                      ask: { bg: 'bg-emerald-500/8', border: 'border-emerald-500/15', text: 'text-emerald-400/80', hover: 'hover:bg-emerald-500/12', shadow: 'shadow-[0_0_8px_rgba(52,211,153,0.12)]' },
                      plan: { bg: 'bg-amber-500/8', border: 'border-amber-500/15', text: 'text-amber-400/80', hover: 'hover:bg-amber-500/12', shadow: 'shadow-[0_0_8px_rgba(251,191,36,0.12)]' },
                    };
                    const s = modeStyles[agentMode];
                    return (
                      <button
                        onClick={() => { setShowModePicker(!showModePicker); setShowModelPicker(false); }}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${s.bg} ${s.border} ${s.text} ${s.hover} ${s.shadow}`}
                        title={agentMode === 'agent' ? 'Agent mode — can read and modify' : agentMode === 'plan' ? 'Plan mode — creates plans' : 'Ask mode — read-only'}
                      >
                        {agentMode === 'agent' && <Infinity size={12} className="shrink-0" />}
                        {agentMode === 'ask' && <Eye size={12} className="shrink-0" />}
                        {agentMode === 'plan' && <ListChecks size={12} className="shrink-0" />}
                        <span>{agentMode === 'agent' ? 'Agent' : agentMode === 'plan' ? 'Plan' : 'Ask'}</span>
                        <ChevronDown size={10} className="shrink-0 opacity-60" />
                      </button>
                    );
                  })()}

                  {showModePicker && (
                    <div
                      className="fixed w-52 bg-bg-secondary border border-border rounded-xl shadow-2xl z-[100] py-1 animate-fade-in"
                      style={{
                        bottom: window.innerHeight - (modePickerRef.current?.getBoundingClientRect().top ?? 0) + 4,
                        left: modePickerRef.current?.getBoundingClientRect().left ?? 0,
                      }}
                    >
                      {([
                        { mode: 'agent' as const, icon: Bot, label: 'Agent', desc: 'Can modify your workspace', color: 'text-accent/80', activeBg: 'bg-accent/8' },
                        { mode: 'ask' as const, icon: Eye, label: 'Ask', desc: 'Read-only, answers questions', color: 'text-emerald-400/80', activeBg: 'bg-emerald-500/8' },
                        { mode: 'plan' as const, icon: ListChecks, label: 'Plan', desc: 'Creates plans, no execution', color: 'text-amber-400/80', activeBg: 'bg-amber-500/8' },
                      ]).map(opt => {
                        const isActive = agentMode === opt.mode;
                        return (
                          <button
                            key={opt.mode}
                            onClick={() => { setAgentMode(opt.mode); setShowModePicker(false); }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                              isActive ? `${opt.activeBg} ${opt.color}` : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <opt.icon size={13} className={isActive ? opt.color : 'text-text-muted'} />
                              <div className="flex flex-col items-start">
                                <span className="font-medium">{opt.label}</span>
                                <span className="text-[10px] text-text-muted">{opt.desc}</span>
                              </div>
                            </div>
                            {isActive && <Check size={11} className="shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div ref={modelPickerRef}>
                  <button
                    onClick={() => { setShowModelPicker(!showModelPicker); setShowModePicker(false); }}
                    className="flex items-center gap-1 px-1.5 py-1 text-xs font-medium transition-all text-text-muted hover:text-text-primary"
                    title={currentConfig ? `${activeProviderLabel} · ${currentConfig.model}` : 'Select AI model'}
                  >
                    <span className="max-w-[100px] truncate">{activeModelShort || 'Model'}</span>
                    <ChevronDown size={10} className="shrink-0" />
                  </button>

                  {showModelPicker && (
                    <div
                      className="fixed w-64 bg-bg-secondary border border-border rounded-xl shadow-2xl z-[100] py-1 animate-fade-in max-h-72 overflow-y-auto"
                      style={{
                        bottom: window.innerHeight - (modelPickerRef.current?.getBoundingClientRect().top ?? 0) + 4,
                        left: modelPickerRef.current?.getBoundingClientRect().left ?? 0,
                      }}
                    >
                      {configuredProviders.length === 0 ? (
                        <div className="px-3 py-2.5 text-xs text-text-muted">
                          No API keys configured. Add keys in Settings.
                        </div>
                      ) : (
                        configuredProviders.map((provider, idx) => {
                          const meta = PROVIDER_META[provider];
                          const models = PROVIDER_MODELS[provider];
                          return (
                            <div key={provider}>
                              {idx > 0 && <div className="border-t border-border my-1" />}
                              <div className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                                {meta.label}
                              </div>
                              {models.map(model => {
                                const isActive = currentConfig?.provider === provider && currentConfig?.model === model.id;
                                return (
                                  <button
                                    key={model.id}
                                    onClick={() => handleSelectModel(provider, model.id)}
                                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors ${
                                      isActive ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{model.label}</span>
                                      {model.description && (
                                        <span className="text-[10px] text-text-muted">{model.description}</span>
                                      )}
                                    </div>
                                    {isActive && <Check size={11} className="shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: send/stop */}
              <div className="flex items-center gap-1.5">
                {isRunning ? (
                  <>
                    <button
                      onClick={stopGeneration}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all text-text-muted hover:text-text-primary hover:bg-bg-hover"
                      title="Stop generation (⌃C)"
                    >
                      Stop <kbd className="text-[10px] text-text-muted/60 ml-0.5">⌃c</kbd>
                    </button>
                    {messageQueue.length > 0 && (
                      <button
                        onClick={() => { stopGeneration(); }}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-bg-tertiary hover:bg-bg-hover text-text-primary border border-border transition-all"
                      >
                        Review
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!canSend}
                    className={`shrink-0 p-2 rounded-lg transition-all ${
                      canSend
                        ? agentMode === 'ask'
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                          : agentMode === 'plan'
                            ? 'bg-amber-500 hover:bg-amber-600 text-white'
                            : 'bg-accent hover:bg-accent-hover text-white'
                        : agentMode === 'ask'
                          ? 'bg-emerald-500/20 text-white/30 cursor-not-allowed'
                          : agentMode === 'plan'
                            ? 'bg-amber-500/20 text-white/30 cursor-not-allowed'
                            : 'bg-accent/20 text-white/30 cursor-not-allowed'
                    }`}
                    style={canSend ? {
                      boxShadow: agentMode === 'ask'
                        ? '0 0 16px rgba(52,211,153,0.5), 0 0 32px rgba(52,211,153,0.2)'
                        : agentMode === 'plan'
                          ? '0 0 16px rgba(251,191,36,0.5), 0 0 32px rgba(251,191,36,0.2)'
                          : '0 0 16px rgba(99,102,241,0.5), 0 0 32px rgba(99,102,241,0.2)',
                    } : undefined}
                  >
                    <ArrowUp size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
