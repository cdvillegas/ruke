import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { generateText } from 'ai';
import type { ChatMessage, ChatSession, ChatToolCall, ChatAttachment } from '@shared/types';
import { runAgent } from '../lib/agentRunner';
import { useRequestStore } from './requestStore';
import { useConnectionStore } from './connectionStore';
import { useUiStore } from './uiStore';

const AI_KEY_STORAGE = 'ruke:ai_key';

async function generateChatTitle(userMessage: string): Promise<string | null> {
  const { getModelConfig, createModelProvider } = await import('../lib/agentRunner');
  const config = getModelConfig();
  if (!config) return null;

  try {
    const model = createModelProvider({ ...config, model: config.provider === 'openai' ? 'gpt-4o-mini' : config.model });
    const cleanedMessage = userMessage.replace(/<file[\s\S]*?<\/file>/g, '').trim();
    if (!cleanedMessage) return null;

    const { text } = await generateText({
      model,
      maxOutputTokens: 30,
      messages: [
        {
          role: 'system',
          content: 'Generate a short, descriptive title (3-6 words) for a chat that starts with the following message. Return ONLY the title, no quotes, no punctuation at the end.',
        },
        { role: 'user', content: cleanedMessage.slice(0, 500) },
      ],
    });

    const title = text.trim().replace(/^["']|["']$/g, '').replace(/\.+$/, '');
    return title || null;
  } catch {
    return null;
  }
}

const STORAGE_KEY = 'ruke:chat_sessions';
const TABS_KEY = 'ruke:chat_open_tabs';
const ACTIVE_KEY = 'ruke:chat_active_id';

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

function saveTabState(openTabIds: string[], activeId: string) {
  localStorage.setItem(TABS_KEY, JSON.stringify(openTabIds));
  localStorage.setItem(ACTIVE_KEY, activeId);
}

function loadTabState(): { openTabIds: string[]; activeId: string } | null {
  try {
    const tabs = localStorage.getItem(TABS_KEY);
    const active = localStorage.getItem(ACTIVE_KEY);
    if (tabs) {
      return { openTabIds: JSON.parse(tabs), activeId: active || '' };
    }
  } catch {}
  return null;
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

const AGENT_SYSTEM_PROMPT = `You are Rüke, an expert API development assistant. You help users build, test, debug, and automate API workflows through natural conversation.

CRITICAL RULE: ALWAYS ACT. When the user asks you to do something, DO IT immediately by calling tools. NEVER just describe what you would do — actually call the tools.

Be conversational. Keep text brief (1-2 sentences). Your text message appears BEFORE your tool calls in the UI, so write it as a plan of what you're about to do, not a recap of what you did. After all tools complete, summarize what you did.

Core capabilities:
- Edit active request: edit_current_request (method, URL, headers, params, body, auth). Switch requests: select_request.
- Send requests: send_request (active) or send_request_by_id (any by name). Read results: get_response, get_response_body, get_response_headers.
- Batch edit: update_requests. Batch create: create_requests. Manage: archive_request, unarchive_request, delete_request.
- Connections: list_connections, connect_api, import_spec, import_graphql, import_grpc_proto, import_grpc_reflection, update_connection, delete_connection, set_connection_auth, reimport_spec.
- Environments: create_environment, list_environments, update_environment, delete_environment, set_active_environment, add_variable, update_variable, delete_variable.
- Testing: create_test, run_tests, run_collection_tests, list_tests, delete_test.
- Workflows: create_workflow, run_workflow, list_workflows, delete_workflow.
- History: search_history, get_history_entry, replay_request, clear_history.
- gRPC: create_grpc_request, send_grpc_request, list_grpc_services.
- Docs: generate_docs. Curl: import_curl, export_curl. Scripts: generate_script.
- App: set_api_key, toggle_theme, get_app_info.

Auto-debug pattern: When a request returns an error (4xx/5xx), read the response body, diagnose the issue, fix the request with edit_current_request, and retry with send_request — up to 3 attempts before reporting the failure.

Before connecting an API, check list_connections first. Before creating requests, use search_endpoints. Always include connection_id and endpoint_id when creating requests for connected APIs. Use realistic sample data. Don't add auth headers manually — use set_connection_auth or per-request auth_type.`;

function buildRequestContext(): string {
  const activeView = useUiStore.getState().activeView;
  const store = useRequestStore.getState();
  const req = store.activeRequest;
  const resp = store.response;
  const parts: string[] = [`Current view: ${activeView}`, '', 'Active request:'];

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

function initSessions(): { sessions: ChatSession[]; activeId: string; openTabIds: string[] } {
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
    saveTabState([fresh.id], fresh.id);
    return { sessions, activeId: fresh.id, openTabIds: [fresh.id] };
  }

  const savedTabs = loadTabState();
  if (savedTabs) {
    const sessionIds = new Set(sessions.map(s => s.id));
    const validTabs = savedTabs.openTabIds.filter(id => sessionIds.has(id));
    const activeId = validTabs.includes(savedTabs.activeId)
      ? savedTabs.activeId
      : validTabs[0] || sessions[0].id;
    return { sessions, activeId, openTabIds: validTabs };
  }

  const first = sessions.find(s => !s.archived) || sessions[0];
  return { sessions, activeId: first.id, openTabIds: [first.id] };
}

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string;
  openTabIds: string[];
  runningSessionId: string | null;
  error: string | null;
  streamingMessageId: string | null;
  streamTick: number;
  abortController: AbortController | null;

  isRunning: boolean;

  getActiveSession: () => ChatSession;
  setActiveSession: (id: string) => void;
  newChat: () => void;
  closeTab: (id: string) => void;
  deleteSession: (id: string) => void;
  archiveSession: (id: string) => void;
  unarchiveSession: (id: string) => void;
  loadFromHistory: (id: string) => void;
  sendMessage: (content: string, attachments?: ChatAttachment[]) => Promise<void>;
  stopGeneration: () => void;
  appendMessage: (sessionId: string, msg: ChatMessage) => void;
  updateMessageContent: (sessionId: string, messageId: string, delta: string) => void;
  upsertToolCall: (sessionId: string, messageId: string, toolCall: ChatToolCall) => void;
  updateToolCall: (sessionId: string, messageId: string, toolCallId: string, updates: Partial<ChatToolCall>) => void;
  setStreamingMessage: (id: string | null) => void;
  setError: (error: string | null) => void;
}

const { sessions: initialSessions, activeId: initialActiveId, openTabIds: initialOpenTabIds } = initSessions();

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: initialSessions,
  activeSessionId: initialActiveId,
  openTabIds: initialOpenTabIds,
  runningSessionId: null,
  isRunning: false,
  error: null,
  streamingMessageId: null,
  streamTick: 0,
  abortController: null,

  getActiveSession: () => {
    const { sessions, activeSessionId, openTabIds } = get();
    if (!activeSessionId || !openTabIds.includes(activeSessionId)) {
      return { id: '', title: 'New Chat', messages: [], archived: false, createdAt: '', updatedAt: '' } as ChatSession;
    }
    return sessions.find(s => s.id === activeSessionId) || sessions[0];
  },

  setActiveSession: (id) => {
    const { runningSessionId } = get();
    set({
      activeSessionId: id,
      error: null,
      isRunning: runningSessionId === id,
    });
    saveTabState(get().openTabIds, id);
  },

  newChat: () => {
    const { sessions, openTabIds, runningSessionId } = get();
    const emptyOpen = openTabIds
      .map(tid => sessions.find(s => s.id === tid))
      .find(s => s && s.messages.length === 0);
    if (emptyOpen) {
      set({ activeSessionId: emptyOpen.id, error: null, isRunning: runningSessionId === emptyOpen.id });
      saveTabState(openTabIds, emptyOpen.id);
      return;
    }
    const session = createSession();
    const updated = [...sessions, session];
    const newTabs = [...openTabIds, session.id];
    set({ sessions: updated, openTabIds: newTabs, activeSessionId: session.id, error: null, isRunning: false });
    saveSessions(updated);
    saveTabState(newTabs, session.id);
  },

  closeTab: (id) => {
    const { openTabIds, activeSessionId, runningSessionId, abortController } = get();
    if (id === runningSessionId && abortController) {
      abortController.abort();
    }
    const newTabs = openTabIds.filter(tid => tid !== id);
    let newActive = activeSessionId;
    if (id === activeSessionId) {
      const closedIdx = openTabIds.indexOf(id);
      newActive = newTabs[Math.min(closedIdx, newTabs.length - 1)] || '';
    }
    const nowRunning = id === runningSessionId ? null : runningSessionId;
    set({
      openTabIds: newTabs,
      activeSessionId: newActive,
      error: null,
      runningSessionId: nowRunning,
      isRunning: nowRunning === newActive,
      abortController: id === runningSessionId ? null : abortController,
      streamingMessageId: id === runningSessionId ? null : get().streamingMessageId,
    });
    saveTabState(newTabs, newActive);
  },

  deleteSession: (id) => {
    const { sessions, openTabIds, activeSessionId, runningSessionId, abortController } = get();
    if (id === runningSessionId && abortController) {
      abortController.abort();
    }
    const remaining = sessions.filter(s => s.id !== id);
    const newTabs = openTabIds.filter(tid => tid !== id);
    let newActive = activeSessionId;
    if (id === activeSessionId) {
      const closedIdx = openTabIds.indexOf(id);
      newActive = newTabs[Math.min(closedIdx, newTabs.length - 1)] || '';
    }
    const nowRunning = id === runningSessionId ? null : runningSessionId;
    set({
      sessions: remaining,
      openTabIds: newTabs,
      activeSessionId: newActive,
      error: null,
      runningSessionId: nowRunning,
      isRunning: nowRunning === newActive,
      abortController: id === runningSessionId ? null : abortController,
      streamingMessageId: id === runningSessionId ? null : get().streamingMessageId,
    });
    saveSessions(remaining);
    saveTabState(newTabs, newActive);
  },

  archiveSession: (id) => {
    const { sessions, openTabIds, activeSessionId, runningSessionId, abortController } = get();
    if (id === runningSessionId && abortController) {
      abortController.abort();
    }
    const updated = sessions.map(s => s.id === id ? { ...s, archived: true } : s);
    const newTabs = openTabIds.filter(tid => tid !== id);
    let newActive = activeSessionId;
    if (id === activeSessionId) {
      const closedIdx = openTabIds.indexOf(id);
      newActive = newTabs[Math.min(closedIdx, newTabs.length - 1)] || '';
    }
    const nowRunning = id === runningSessionId ? null : runningSessionId;
    set({
      sessions: updated,
      openTabIds: newTabs,
      activeSessionId: newActive,
      error: null,
      runningSessionId: nowRunning,
      isRunning: nowRunning === newActive,
      abortController: id === runningSessionId ? null : abortController,
      streamingMessageId: id === runningSessionId ? null : get().streamingMessageId,
    });
    saveSessions(updated);
    saveTabState(newTabs, newActive);
  },

  unarchiveSession: (id) => {
    const { sessions } = get();
    const updated = sessions.map(s => s.id === id ? { ...s, archived: false } : s);
    set({ sessions: updated });
    saveSessions(updated);
  },

  loadFromHistory: (id) => {
    const { openTabIds, sessions, runningSessionId } = get();
    const session = sessions.find(s => s.id === id);
    if (!session) return;
    if (openTabIds.includes(id)) {
      set({ activeSessionId: id, error: null, isRunning: runningSessionId === id });
      saveTabState(openTabIds, id);
      return;
    }
    const newTabs = [...openTabIds, id];
    set({ openTabIds: newTabs, activeSessionId: id, error: null, isRunning: runningSessionId === id });
    saveTabState(newTabs, id);
  },

  sendMessage: async (content: string, attachments?: ChatAttachment[]) => {
    const { runningSessionId, activeSessionId, sessions, openTabIds } = get();
    if (runningSessionId) return;
    if (!activeSessionId || !openTabIds.includes(activeSessionId)) return;

    const session = sessions.find(s => s.id === activeSessionId);
    if (!session) return;

    const apiKey = localStorage.getItem(AI_KEY_STORAGE);
    if (!apiKey || apiKey.length < 10) {
      set({ error: 'No API key found. Connect an AI provider in Settings.' });
      return;
    }

    const targetSessionId = activeSessionId;

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

    const isFirstMessage = session.messages.length === 0;
    if (isFirstMessage) {
      const titleSource = content.replace(/<file[\s\S]*?<\/file>/g, '').trim();
      const fileNames = attachments?.map(a => a.name).join(', ');
      updatedSession.title = titleSource
        ? titleSource.slice(0, 40) + (titleSource.length > 40 ? '...' : '')
        : fileNames
          ? `Files: ${fileNames.slice(0, 50)}`
          : 'New Chat';
    }

    const updatedSessions = sessions.map(s => s.id === targetSessionId ? updatedSession : s);
    const controller = new AbortController();
    set({
      sessions: updatedSessions,
      isRunning: true,
      runningSessionId: targetSessionId,
      error: null,
      abortController: controller,
    });
    saveSessions(updatedSessions);

    if (isFirstMessage) {
      generateChatTitle(content).then(title => {
        if (!title) return;
        set(s => {
          const sessions = s.sessions.map(sess =>
            sess.id === targetSessionId ? { ...sess, title } : sess
          );
          saveSessions(sessions);
          return { sessions };
        });
      });
    }

    await runAgent(
      updatedSession.messages,
      {
        onMessage: (msg) => {
          if (msg.role === 'assistant') {
            get().setStreamingMessage(msg.id);
          }
          get().appendMessage(targetSessionId, msg);
        },
        onContentDelta: (messageId, delta) => {
          get().updateMessageContent(targetSessionId, messageId, delta);
        },
        onToolCallDelta: (messageId, toolCall) => {
          get().upsertToolCall(targetSessionId, messageId, toolCall);
        },
        onToolStart: (_messageId, toolCall) => {
          get().upsertToolCall(targetSessionId, _messageId, toolCall);
        },
        onToolEnd: (messageId, toolCallId, result) => {
          get().updateToolCall(targetSessionId, messageId, toolCallId, { status: 'done', result });
        },
        onError: (error) => {
          if (get().runningSessionId === targetSessionId) {
            set({ error });
          }
        },
        onDone: () => {
          const wasRunning = get().runningSessionId === targetSessionId;
          get().setStreamingMessage(null);
          if (wasRunning) {
            set({
              runningSessionId: null,
              isRunning: false,
              abortController: null,
            });
          }
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
      set({
        runningSessionId: null,
        isRunning: false,
        abortController: null,
        streamingMessageId: null,
      });
    }
  },

  appendMessage: (sessionId, msg) => {
    set((s) => {
      const sessions = s.sessions.map(sess => {
        if (sess.id !== sessionId) return sess;
        return { ...sess, messages: [...sess.messages, msg], updatedAt: new Date().toISOString() };
      });
      return { sessions };
    });
  },

  updateMessageContent: (sessionId, messageId, delta) => {
    set((s) => {
      const sessions = s.sessions.map(sess => {
        if (sess.id !== sessionId) return sess;
        const messages = sess.messages.map(m =>
          m.id === messageId ? { ...m, content: (m.content || '') + delta } : m
        );
        return { ...sess, messages, updatedAt: new Date().toISOString() };
      });
      return { sessions, streamTick: s.streamTick + 1 };
    });
  },

  upsertToolCall: (sessionId, messageId, toolCall) => {
    set((s) => {
      const sessions = s.sessions.map(sess => {
        if (sess.id !== sessionId) return sess;
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

  updateToolCall: (sessionId, _messageId, toolCallId, updates) => {
    set((s) => {
      const sessions = s.sessions.map(sess => {
        if (sess.id !== sessionId) return sess;
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
