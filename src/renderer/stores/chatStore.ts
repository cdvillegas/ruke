import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { ChatMessage, ChatSession, ChatToolCall, ChatAttachment } from '@shared/types';
import { runAgent } from '../lib/agentRunner';
import { useRequestStore } from './requestStore';
import { useConnectionStore } from './connectionStore';

const STORAGE_KEY = 'ruke:chat_sessions';

function loadSessions(): ChatSession[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const sessions: ChatSession[] = JSON.parse(saved);
    return sessions.map(session => ({
      ...session,
      archived: session.archived ?? false,
      messages: session.messages.map(m => {
        if (!m.toolCalls) return m;
        return {
          ...m,
          toolCalls: m.toolCalls.map(tc =>
            tc.status === 'running' || tc.status === 'pending'
              ? { ...tc, status: 'done' as const, result: tc.result || '{"note":"interrupted"}' }
              : tc
          ),
        };
      }),
    }));
  } catch {}
  return [];
}

function migrateLegacy(): ChatSession[] {
  const results: ChatSession[] = [];
  try {
    const old = localStorage.getItem('ruke:chat_session');
    if (old) {
      const session: ChatSession = JSON.parse(old);
      session.archived = false;
      results.push(session);
      localStorage.removeItem('ruke:chat_session');
    }
  } catch {}
  try {
    const oldAgent = localStorage.getItem('ruke:agent_sessions');
    if (oldAgent) {
      const agentSessions: ChatSession[] = JSON.parse(oldAgent);
      for (const s of agentSessions) {
        if (!results.some(r => r.id === s.id)) {
          results.push({ ...s, archived: s.archived ?? false });
        }
      }
      localStorage.removeItem('ruke:agent_sessions');
    }
  } catch {}
  return results;
}

function saveSessions(sessions: ChatSession[]) {
  const toSave = sessions.map(session => ({
    ...session,
    messages: session.messages.map(m =>
      m.attachments
        ? { ...m, attachments: m.attachments.map(({ name, size }) => ({ name, size, content: '' })) }
        : m
    ),
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

function createSession(): ChatSession {
  return {
    id: nanoid(),
    title: 'New Chat',
    messages: [],
    archived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const AGENT_SYSTEM_PROMPT = `You are Rüke, an expert API development assistant embedded inside a request builder. You help users create, organize, and manage API requests through natural conversation.

You have direct access to the currently active request and can edit it in real-time using edit_current_request. You can also switch to other requests using select_request.

CRITICAL RULE: ALWAYS ACT. When the user asks you to do something, DO IT immediately by calling tools. NEVER just describe what you would do — actually call the tools.

Be conversational. Keep text brief (1-2 sentences). Your text message appears BEFORE your tool calls in the UI, so write it as a plan of what you're about to do, not a recap of what you did. After all tools complete, summarize what you did.

Key behaviors:
- Use edit_current_request to modify the active request's method, URL, name, headers, params, body, auth, connection, and endpoint.
- Use select_request to switch between requests.
- Before connecting an API, check list_connections first.
- Before creating requests, use search_endpoints to find the right endpoint data.
- When creating requests for a connected API, always include connection_id and endpoint_id.
- Use realistic sample data in request bodies.
- Don't add Authorization headers if the connection already handles auth.`;

function buildRequestContext(): string {
  const store = useRequestStore.getState();
  const req = store.activeRequest;
  const resp = store.response;
  const parts: string[] = ['Active request:'];

  parts.push(`  Name: ${req.name}`);
  parts.push(`  Method: ${req.method}`);
  parts.push(`  URL: ${req.url || '(empty)'}`);

  if (req.connectionId) {
    const conn = useConnectionStore.getState().getConnection(req.connectionId);
    if (conn) parts.push(`  Connection: ${conn.name} (${conn.baseUrl})`);
  }

  const activeHeaders = (req.headers || []).filter(h => h.key);
  if (activeHeaders.length > 0) {
    parts.push(`  Headers: ${activeHeaders.map(h => `${h.key}: ${h.value}`).join(', ')}`);
  }

  const activeParams = (req.params || []).filter(p => p.key);
  if (activeParams.length > 0) {
    parts.push(`  Params: ${activeParams.map(p => `${p.key}=${p.value}`).join('&')}`);
  }

  if (req.body?.type !== 'none' && req.body?.raw) {
    const bodyPreview = req.body.raw.length > 500 ? req.body.raw.slice(0, 500) + '...' : req.body.raw;
    parts.push(`  Body (${req.body.type}): ${bodyPreview}`);
  }

  if (resp) {
    parts.push(`\nLast response:`);
    parts.push(`  Status: ${resp.status} ${resp.statusText}`);
    parts.push(`  Duration: ${resp.duration}ms, Size: ${resp.size} bytes`);
    const bodyPreview = (resp.body || '').slice(0, 300);
    if (bodyPreview) parts.push(`  Body preview: ${bodyPreview}`);
  }

  return parts.join('\n');
}

function initSessions(): { sessions: ChatSession[]; activeId: string } {
  let sessions = loadSessions();

  const legacy = migrateLegacy();
  if (legacy.length > 0) {
    const existingIds = new Set(sessions.map(s => s.id));
    const newOnes = legacy.filter(s => !existingIds.has(s.id) && s.messages.length > 0);
    if (newOnes.length > 0) {
      sessions = [...newOnes, ...sessions];
      saveSessions(sessions);
    }
  }

  if (sessions.length === 0) {
    const fresh = createSession();
    sessions = [fresh];
    saveSessions(sessions);
    return { sessions, activeId: fresh.id };
  }

  const active = sessions.find(s => !s.archived) || sessions[0];
  return { sessions, activeId: active.id };
}

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string;
  isRunning: boolean;
  error: string | null;
  streamingMessageId: string | null;
  streamTick: number;
  abortController: AbortController | null;

  getActiveSession: () => ChatSession;
  setActiveSession: (id: string) => void;
  newChat: () => void;
  deleteSession: (id: string) => void;
  archiveSession: (id: string) => void;
  unarchiveSession: (id: string) => void;
  sendMessage: (content: string, attachments?: ChatAttachment[]) => Promise<void>;
  stopGeneration: () => void;
  appendMessage: (msg: ChatMessage) => void;
  updateMessageContent: (messageId: string, delta: string) => void;
  upsertToolCall: (messageId: string, toolCall: ChatToolCall) => void;
  updateToolCall: (messageId: string, toolCallId: string, updates: Partial<ChatToolCall>) => void;
  setStreamingMessage: (id: string | null) => void;
  setError: (error: string | null) => void;
}

const { sessions: initialSessions, activeId: initialActiveId } = initSessions();

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: initialSessions,
  activeSessionId: initialActiveId,
  isRunning: false,
  error: null,
  streamingMessageId: null,
  streamTick: 0,
  abortController: null,

  getActiveSession: () => {
    const { sessions, activeSessionId } = get();
    return sessions.find(s => s.id === activeSessionId) || sessions[0];
  },

  setActiveSession: (id) => {
    set({ activeSessionId: id, error: null });
  },

  newChat: () => {
    const { sessions } = get();
    const emptyUnarchived = sessions.find(s => !s.archived && s.messages.length === 0);
    if (emptyUnarchived) {
      set({ activeSessionId: emptyUnarchived.id, error: null, isRunning: false });
      return;
    }
    const session = createSession();
    const updated = [session, ...sessions];
    set({ sessions: updated, activeSessionId: session.id, error: null, isRunning: false });
    saveSessions(updated);
  },

  deleteSession: (id) => {
    const { sessions, activeSessionId } = get();
    const remaining = sessions.filter(s => s.id !== id);
    if (remaining.length === 0) {
      const fresh = createSession();
      set({ sessions: [fresh], activeSessionId: fresh.id, error: null });
      saveSessions([fresh]);
      return;
    }
    const newActive = id === activeSessionId
      ? (remaining.find(s => !s.archived) || remaining[0]).id
      : activeSessionId;
    set({ sessions: remaining, activeSessionId: newActive });
    saveSessions(remaining);
  },

  archiveSession: (id) => {
    const { sessions, activeSessionId } = get();
    const updated = sessions.map(s => s.id === id ? { ...s, archived: true } : s);
    let newActive = activeSessionId;
    if (id === activeSessionId) {
      const next = updated.find(s => !s.archived && s.id !== id);
      if (next) {
        newActive = next.id;
      } else {
        const fresh = createSession();
        updated.unshift(fresh);
        newActive = fresh.id;
      }
    }
    set({ sessions: updated, activeSessionId: newActive });
    saveSessions(updated);
  },

  unarchiveSession: (id) => {
    const { sessions } = get();
    const updated = sessions.map(s => s.id === id ? { ...s, archived: false } : s);
    set({ sessions: updated, activeSessionId: id });
    saveSessions(updated);
  },

  sendMessage: async (content: string, attachments?: ChatAttachment[]) => {
    const { isRunning, activeSessionId, sessions } = get();
    if (isRunning) return;

    const session = sessions.find(s => s.id === activeSessionId);
    if (!session) return;

    const userMsg: ChatMessage = {
      id: nanoid(),
      role: 'user',
      content,
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
      timestamp: new Date().toISOString(),
    };

    const updatedSession = {
      ...session,
      messages: [...session.messages, userMsg],
      updatedAt: new Date().toISOString(),
    };

    if (session.messages.length === 0) {
      const titleSource = content.replace(/<file[\s\S]*?<\/file>/g, '').trim();
      const fileNames = attachments?.map(a => a.name).join(', ');
      updatedSession.title = titleSource
        ? titleSource.slice(0, 60) + (titleSource.length > 60 ? '...' : '')
        : fileNames
          ? `Files: ${fileNames.slice(0, 50)}`
          : 'New Chat';
    }

    const updatedSessions = sessions.map(s => s.id === activeSessionId ? updatedSession : s);
    const controller = new AbortController();
    set({ sessions: updatedSessions, isRunning: true, error: null, abortController: controller });
    saveSessions(updatedSessions);

    await runAgent(
      updatedSession.messages,
      {
        onMessage: (msg) => {
          if (msg.role === 'assistant') {
            get().setStreamingMessage(msg.id);
          }
          get().appendMessage(msg);
        },
        onContentDelta: (messageId, delta) => {
          get().updateMessageContent(messageId, delta);
        },
        onToolCallDelta: (messageId, toolCall) => {
          get().upsertToolCall(messageId, toolCall);
        },
        onToolStart: (_messageId, toolCall) => {
          get().upsertToolCall(_messageId, toolCall);
        },
        onToolEnd: (messageId, toolCallId, result) => {
          get().updateToolCall(messageId, toolCallId, { status: 'done', result });
        },
        onError: (error) => {
          set({ error });
        },
        onDone: () => {
          get().setStreamingMessage(null);
          set({ isRunning: false, abortController: null });
          saveSessions(get().sessions);
        },
      },
      {
        systemPrompt: AGENT_SYSTEM_PROMPT,
        extraContext: buildRequestContext(),
        abortSignal: controller.signal,
      },
    );
  },

  stopGeneration: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
  },

  appendMessage: (msg) => {
    set((s) => {
      const sessions = s.sessions.map(sess => {
        if (sess.id !== s.activeSessionId) return sess;
        return { ...sess, messages: [...sess.messages, msg], updatedAt: new Date().toISOString() };
      });
      return { sessions };
    });
  },

  updateMessageContent: (messageId, delta) => {
    set((s) => {
      const sessions = s.sessions.map(sess => {
        if (sess.id !== s.activeSessionId) return sess;
        const messages = sess.messages.map(m =>
          m.id === messageId ? { ...m, content: (m.content || '') + delta } : m
        );
        return { ...sess, messages, updatedAt: new Date().toISOString() };
      });
      return { sessions, streamTick: s.streamTick + 1 };
    });
  },

  upsertToolCall: (messageId, toolCall) => {
    set((s) => {
      const sessions = s.sessions.map(sess => {
        if (sess.id !== s.activeSessionId) return sess;
        const messages = sess.messages.map(m => {
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
        return { ...sess, messages, updatedAt: new Date().toISOString() };
      });
      return { sessions, streamTick: s.streamTick + 1 };
    });
  },

  updateToolCall: (_messageId, toolCallId, updates) => {
    set((s) => {
      const sessions = s.sessions.map(sess => {
        if (sess.id !== s.activeSessionId) return sess;
        const messages = sess.messages.map(m => {
          if (!m.toolCalls?.some(tc => tc.id === toolCallId)) return m;
          return {
            ...m,
            toolCalls: m.toolCalls.map(tc =>
              tc.id === toolCallId ? { ...tc, ...updates } : tc
            ),
          };
        });
        return { ...sess, messages, updatedAt: new Date().toISOString() };
      });
      return { sessions, streamTick: s.streamTick + 1 };
    });
  },

  setStreamingMessage: (id) => set({ streamingMessageId: id }),

  setError: (error) => set({ error }),
}));
