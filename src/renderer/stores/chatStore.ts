import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { ChatMessage, ChatSession, ChatToolCall, ChatAttachment } from '@shared/types';
import { runAgent } from '../lib/agentRunner';

const STORAGE_KEY = 'ruke:chat_session';

function loadSession(): ChatSession | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const session: ChatSession = JSON.parse(saved);
    session.messages = session.messages.map(m => {
      if (!m.toolCalls) return m;
      return {
        ...m,
        toolCalls: m.toolCalls.map(tc =>
          tc.status === 'running' || tc.status === 'pending'
            ? { ...tc, status: 'done' as const, result: tc.result || '{"note":"interrupted"}' }
            : tc
        ),
      };
    });
    return session;
  } catch {}
  return null;
}

function saveSession(session: ChatSession | null) {
  if (session) {
    const toSave = {
      ...session,
      messages: session.messages.map(m =>
        m.attachments
          ? { ...m, attachments: m.attachments.map(({ name, size }) => ({ name, size, content: '' })) }
          : m
      ),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
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
  sendMessage: (content: string, attachments?: ChatAttachment[]) => Promise<void>;
  appendMessage: (msg: ChatMessage) => void;
  updateMessageContent: (messageId: string, delta: string) => void;
  upsertToolCall: (messageId: string, toolCall: ChatToolCall) => void;
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

  sendMessage: async (content: string, attachments?: ChatAttachment[]) => {
    const { session, isRunning } = get();
    if (isRunning) return;

    const userMsg: ChatMessage = {
      id: nanoid(),
      role: 'user',
      content,
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
      timestamp: new Date().toISOString(),
    };

    const updated = {
      ...session,
      messages: [...session.messages, userMsg],
      updatedAt: new Date().toISOString(),
    };

    if (session.messages.length === 0) {
      const titleSource = content.replace(/<file[\s\S]*?<\/file>/g, '').trim();
      const fileNames = attachments?.map(a => a.name).join(', ');
      updated.title = titleSource
        ? titleSource.slice(0, 60) + (titleSource.length > 60 ? '...' : '')
        : fileNames
          ? `Files: ${fileNames.slice(0, 50)}`
          : 'New Chat';
    }

    set({ session: updated, isRunning: true, error: null });
    saveSession(updated);

    await runAgent(updated.messages, {
      onMessage: (msg) => {
        get().appendMessage(msg);
      },
      onContentDelta: (messageId, delta) => {
        get().updateMessageContent(messageId, delta);
      },
      onToolCallDelta: (messageId, toolCall) => {
        get().upsertToolCall(messageId, toolCall);
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
      return { session: updated };
    });
  },

  updateMessageContent: (messageId, delta) => {
    set((s) => {
      const messages = s.session.messages.map(m => {
        if (m.id !== messageId) return m;
        return { ...m, content: (m.content || '') + delta };
      });
      return { session: { ...s.session, messages, updatedAt: new Date().toISOString() } };
    });
  },

  upsertToolCall: (messageId, toolCall) => {
    set((s) => {
      const messages = s.session.messages.map(m => {
        if (m.id !== messageId) return m;
        const existing = (m.toolCalls || []).find(tc => tc.id === toolCall.id);
        if (existing) {
          return {
            ...m,
            toolCalls: (m.toolCalls || []).map(tc =>
              tc.id === toolCall.id ? { ...tc, ...toolCall } : tc
            ),
          };
        }
        return { ...m, toolCalls: [...(m.toolCalls || []), toolCall] };
      });
      return { session: { ...s.session, messages, updatedAt: new Date().toISOString() } };
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
