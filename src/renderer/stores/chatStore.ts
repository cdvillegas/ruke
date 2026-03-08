import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { ChatMessage, ChatSession, ChatToolCall } from '@shared/types';
import { runAgent } from '../lib/agentRunner';

const STORAGE_KEY = 'ruke:chat_session';

function loadSession(): ChatSession | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

function saveSession(session: ChatSession | null) {
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function createSession(): ChatSession {
  return {
    id: nanoid(),
    title: 'New Chat',
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

interface ChatState {
  session: ChatSession;
  isRunning: boolean;
  error: string | null;

  newChat: () => void;
  sendMessage: (content: string) => Promise<void>;
  appendMessage: (msg: ChatMessage) => void;
  updateToolCall: (messageId: string, toolCallId: string, updates: Partial<ChatToolCall>) => void;
  setError: (error: string | null) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  session: loadSession() || createSession(),
  isRunning: false,
  error: null,

  newChat: () => {
    const session = createSession();
    set({ session, error: null, isRunning: false });
    saveSession(session);
  },

  sendMessage: async (content: string) => {
    const { session, isRunning } = get();
    if (isRunning) return;

    const userMsg: ChatMessage = {
      id: nanoid(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    const updated = {
      ...session,
      messages: [...session.messages, userMsg],
      updatedAt: new Date().toISOString(),
    };

    if (session.messages.length === 0) {
      updated.title = content.slice(0, 60) + (content.length > 60 ? '...' : '');
    }

    set({ session: updated, isRunning: true, error: null });
    saveSession(updated);

    await runAgent(updated.messages, {
      onMessage: (msg) => {
        get().appendMessage(msg);
      },
      onToolStart: (messageId, toolCall) => {
        get().updateToolCall(messageId, toolCall.id, { status: 'running' });
      },
      onToolEnd: (messageId, toolCallId, result) => {
        get().updateToolCall(messageId, toolCallId, { status: 'done', result });
      },
      onError: (error) => {
        set({ error });
      },
      onDone: () => {
        set({ isRunning: false });
        saveSession(get().session);
      },
    });
  },

  appendMessage: (msg) => {
    set((s) => {
      const updated = {
        ...s.session,
        messages: [...s.session.messages, msg],
        updatedAt: new Date().toISOString(),
      };
      saveSession(updated);
      return { session: updated };
    });
  },

  updateToolCall: (messageId, toolCallId, updates) => {
    set((s) => {
      const messages = s.session.messages.map(m => {
        if (m.id !== messageId || !m.toolCalls) return m;
        return {
          ...m,
          toolCalls: m.toolCalls.map(tc =>
            tc.id === toolCallId ? { ...tc, ...updates } : tc
          ),
        };
      });
      const updated = { ...s.session, messages, updatedAt: new Date().toISOString() };
      saveSession(updated);
      return { session: updated };
    });
  },

  setError: (error) => set({ error }),
}));
