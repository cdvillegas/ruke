import { useState, useMemo, useRef, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import {
  Plus, Search,
  MoreHorizontal, Trash2, MessageSquare,
} from 'lucide-react';
import { groupByTime } from '../../lib/timeGroups';
import type { ChatSession } from '@shared/types';

const RECENT_LIMIT = 15;

function ChatItemMenu({ session, onClose }: {
  session: ChatSession;
  onClose: () => void;
}) {
  const deleteSession = useChatStore(s => s.deleteSession);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-1 z-50 w-36 py-1 rounded-lg bg-bg-secondary border border-border shadow-xl"
    >
      <button
        onClick={() => { deleteSession(session.id); onClose(); }}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
      >
        <Trash2 size={12} /> Delete
      </button>
    </div>
  );
}

function ChatItem({ session, isActive }: { session: ChatSession; isActive: boolean }) {
  const setActiveSession = useChatStore(s => s.setActiveSession);
  const loadFromHistory = useChatStore(s => s.loadFromHistory);
  const [menuOpen, setMenuOpen] = useState(false);

  const preview = useMemo(() => {
    const last = [...session.messages].reverse().find(m => m.role === 'assistant' && m.content);
    if (last?.content) return last.content.slice(0, 60).replace(/\n/g, ' ');
    const lastUser = [...session.messages].reverse().find(m => m.role === 'user' && m.content);
    if (lastUser?.content) return lastUser.content.replace(/<file[\s\S]*?<\/file>/g, '').trim().slice(0, 60);
    return null;
  }, [session.messages]);

  return (
    <div className="relative group">
      <button
        onClick={() => loadFromHistory(session.id)}
        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
          isActive
            ? 'bg-accent/10 text-text-primary'
            : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
        }`}
      >
        <p className={`text-xs font-medium truncate ${isActive ? 'text-text-primary' : ''}`}>
          {session.title}
        </p>
        {preview && (
          <p className="text-[10px] text-text-muted truncate mt-0.5">{preview}</p>
        )}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
        className={`absolute right-1.5 top-1.5 p-1 rounded-md transition-all ${
          menuOpen
            ? 'opacity-100 bg-bg-hover'
            : 'opacity-0 group-hover:opacity-100 hover:bg-bg-hover'
        }`}
      >
        <MoreHorizontal size={12} className="text-text-muted" />
      </button>
      {menuOpen && <ChatItemMenu session={session} onClose={() => setMenuOpen(false)} />}
    </div>
  );
}

export function ChatSidebar() {
  const sessions = useChatStore(s => s.sessions);
  const activeSessionId = useChatStore(s => s.activeSessionId);
  const newChat = useChatStore(s => s.newChat);
  const [search, setSearch] = useState('');
  const [showAllRecent, setShowAllRecent] = useState(false);

  const allSessions = useMemo(() =>
    sessions
      .filter(s => s.messages.length > 0)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [sessions]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return allSessions;
    const q = search.toLowerCase();
    return allSessions.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.messages.some(m => m.content?.toLowerCase().includes(q))
    );
  }, [allSessions, search]);

  const groups = useMemo(() => groupByTime(filtered, s => s.updatedAt), [filtered]);

  const truncatedGroups = useMemo(() => {
    if (showAllRecent) return groups;
    let count = 0;
    const result: typeof groups = [];
    for (const group of groups) {
      if (count >= RECENT_LIMIT) break;
      const remaining = RECENT_LIMIT - count;
      if (group.items.length <= remaining) {
        result.push(group);
        count += group.items.length;
      } else {
        result.push({ label: group.label, items: group.items.slice(0, remaining) });
        count = RECENT_LIMIT;
      }
    }
    return result;
  }, [groups, showAllRecent]);

  const totalActive = filtered.length;
  const hiddenCount = showAllRecent ? 0 : Math.max(0, totalActive - RECENT_LIMIT);

  return (
    <div className="w-64 h-full flex flex-col border-r border-border bg-bg-secondary shrink-0">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Chats</h2>
          <button
            onClick={newChat}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            title="New Chat"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats..."
            className="w-full pl-7 pr-3 py-1.5 text-xs bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
          />
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
        {totalActive === 0 && !search && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageSquare size={20} className="text-text-muted mb-2" />
            <p className="text-xs text-text-muted">No chats yet</p>
          </div>
        )}

        {totalActive === 0 && search && (
          <p className="text-xs text-text-muted text-center py-4">No results</p>
        )}

        {truncatedGroups.map(group => (
          <div key={group.label} className="mb-1">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-3 py-1.5">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(s => (
                <ChatItem key={s.id} session={s} isActive={s.id === activeSessionId} />
              ))}
            </div>
          </div>
        ))}

        {hiddenCount > 0 && (
          <button
            onClick={() => setShowAllRecent(true)}
            className="w-full text-center py-2 text-[10px] text-accent hover:text-accent-hover transition-colors"
          >
            Show {hiddenCount} older chat{hiddenCount !== 1 ? 's' : ''}
          </button>
        )}

        {showAllRecent && totalActive > RECENT_LIMIT && (
          <button
            onClick={() => setShowAllRecent(false)}
            className="w-full text-center py-2 text-[10px] text-text-muted hover:text-text-primary transition-colors"
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
}
