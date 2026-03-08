import { nanoid } from 'nanoid';
import type { ChatMessage, ChatToolCall } from '@shared/types';
import { TOOL_SCHEMAS, getToolExecutor } from './agentTools';
import { useConnectionStore } from '../stores/connectionStore';
import { useEnvironmentStore } from '../stores/environmentStore';

const MAX_ITERATIONS = 10;
const AI_KEY_STORAGE = 'ruke:ai_key';

function getApiKey(): string | null {
  return localStorage.getItem(AI_KEY_STORAGE) || null;
}

function buildContextMessage(): string {
  const conns = useConnectionStore.getState().connections;
  const envs = useEnvironmentStore.getState().environments;
  const activeEnvId = useEnvironmentStore.getState().activeEnvironmentId;

  const parts: string[] = [];

  if (conns.length > 0) {
    parts.push(`Connected APIs (${conns.length}):`);
    for (const c of conns) {
      parts.push(`- ${c.name}: ${c.baseUrl} (${c.endpoints.length} endpoints, type: ${c.specType})`);
    }
  } else {
    parts.push('No APIs connected yet.');
  }

  if (envs.length > 0) {
    const active = envs.find(e => e.id === activeEnvId);
    parts.push(`\nEnvironments (${envs.length}): ${envs.map(e => e.name).join(', ')}`);
    if (active) parts.push(`Active environment: ${active.name}`);
  }

  return parts.join('\n');
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

function chatToOpenAI(messages: ChatMessage[]): OpenAIMessage[] {
  return messages.map(m => {
    const msg: OpenAIMessage = { role: m.role as OpenAIMessage['role'], content: m.content };
    if (m.toolCalls?.length) {
      msg.tool_calls = m.toolCalls.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: tc.arguments },
      }));
    }
    if (m.toolCallId) msg.tool_call_id = m.toolCallId;
    return msg;
  });
}

// --- SSE stream parser ---

interface StreamDelta {
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: string;
    function?: { name?: string; arguments?: string };
  }>;
  role?: string;
}

async function* parseSSEStream(response: Response): AsyncGenerator<StreamDelta> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (trimmed === 'data: [DONE]') return;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const delta = json.choices?.[0]?.delta;
          if (delta) yield delta;
        } catch {}
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// --- Streaming accumulator ---

interface ToolCallAccumulator {
  id: string;
  name: string;
  arguments: string;
}

interface StreamAccumulator {
  content: string;
  toolCalls: Map<number, ToolCallAccumulator>;
}

function createAccumulator(): StreamAccumulator {
  return { content: '', toolCalls: new Map() };
}

function accumulateDelta(acc: StreamAccumulator, delta: StreamDelta): {
  contentToken?: string;
  newToolCall?: { index: number; id: string; name: string };
  toolCallArgDelta?: { index: number; delta: string };
} {
  const result: ReturnType<typeof accumulateDelta> = {};

  if (delta.content) {
    acc.content += delta.content;
    result.contentToken = delta.content;
  }

  if (delta.tool_calls) {
    for (const tc of delta.tool_calls) {
      const existing = acc.toolCalls.get(tc.index);
      if (!existing) {
        const entry: ToolCallAccumulator = {
          id: tc.id || nanoid(),
          name: tc.function?.name || '',
          arguments: tc.function?.arguments || '',
        };
        acc.toolCalls.set(tc.index, entry);
        result.newToolCall = { index: tc.index, id: entry.id, name: entry.name };
      } else {
        if (tc.function?.name) existing.name += tc.function.name;
        if (tc.function?.arguments) {
          existing.arguments += tc.function.arguments;
          result.toolCallArgDelta = { index: tc.index, delta: tc.function.arguments };
        }
      }
    }
  }

  return result;
}

function finalizeToolCalls(acc: StreamAccumulator): ChatToolCall[] {
  const sorted = [...acc.toolCalls.entries()].sort((a, b) => a[0] - b[0]);
  return sorted.map(([, tc]) => ({
    id: tc.id,
    name: tc.name,
    arguments: tc.arguments,
    status: 'pending' as const,
  }));
}

function finalizeOpenAIToolCalls(acc: StreamAccumulator) {
  const sorted = [...acc.toolCalls.entries()].sort((a, b) => a[0] - b[0]);
  return sorted.map(([, tc]) => ({
    id: tc.id,
    type: 'function' as const,
    function: { name: tc.name, arguments: tc.arguments },
  }));
}

// --- Callbacks ---

export interface AgentCallbacks {
  onMessage: (msg: ChatMessage) => void;
  onContentDelta: (messageId: string, delta: string) => void;
  onToolCallDelta: (messageId: string, toolCall: ChatToolCall) => void;
  onToolStart: (messageId: string, toolCall: ChatToolCall) => void;
  onToolEnd: (messageId: string, toolCallId: string, result: string) => void;
  onError: (error: string) => void;
  onDone: () => void;
}

// --- Agent runner ---

export async function runAgent(
  sessionMessages: ChatMessage[],
  callbacks: AgentCallbacks,
): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) {
    callbacks.onError('No API key configured. Add your OpenAI API key in Settings.');
    callbacks.onDone();
    return;
  }

  const agentInstructions = `You are Rüke, an expert API development assistant. You help users create, organize, and manage API requests through natural conversation.

CRITICAL RULE: ALWAYS ACT. When the user asks you to do something, DO IT immediately by calling tools. NEVER just describe what you would do — actually call the tools. If the user says "create requests", call create_request for each one. Do not stop after creating a collection — populate it with requests by calling create_request multiple times.

Be conversational. Keep text brief (1-2 sentences). Your text message appears BEFORE your tool calls in the UI, so write it as a plan of what you're about to do, not a recap of what you did. After all tools complete, summarize what you did.

Key behaviors:
- Before connecting an API, check list_connections first — the API may already be connected. NEVER call connect_api more than once for the same API.
- Before creating requests, use search_endpoints to find the right endpoint data.
- When creating requests for a connected API, always include connection_id and endpoint_id.
- When the user asks to edit, rename, or modify requests, use list_requests to find them, then update_requests to change them.
- Use realistic sample data in request bodies — real model names, plausible messages, etc.
- Don't add Authorization headers if the connection already handles auth.
- Group related requests into collections.
- When asked to create "a bunch" or "several" requests, create at least 5-8 varied examples.`;

  const openaiMessages: OpenAIMessage[] = [
    { role: 'system', content: agentInstructions },
    { role: 'system', content: `Current workspace context:\n${buildContextMessage()}` },
    ...chatToOpenAI(sessionMessages),
  ];

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    let res: Response;
    try {
      res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-5',
          messages: openaiMessages,
          tools: TOOL_SCHEMAS,
          tool_choice: 'auto',
          max_completion_tokens: 4096,
          stream: true,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        callbacks.onError(`API error (${res.status}): ${errText.slice(0, 200)}`);
        callbacks.onDone();
        return;
      }
    } catch (e: any) {
      callbacks.onError(`Network error: ${e.message}`);
      callbacks.onDone();
      return;
    }

    const msgId = nanoid();
    const acc = createAccumulator();
    let messageEmitted = false;

    const emitMessage = () => {
      if (messageEmitted) return;
      messageEmitted = true;
      callbacks.onMessage({
        id: msgId,
        role: 'assistant',
        content: '',
        toolCalls: [],
        timestamp: new Date().toISOString(),
      });
    };

    for await (const delta of parseSSEStream(res)) {
      const result = accumulateDelta(acc, delta);

      if (result.contentToken) {
        emitMessage();
        callbacks.onContentDelta(msgId, result.contentToken);
      }

      if (result.newToolCall) {
        emitMessage();
        const tc: ChatToolCall = {
          id: acc.toolCalls.get(result.newToolCall.index)!.id,
          name: result.newToolCall.name,
          arguments: '',
          status: 'pending',
        };
        callbacks.onToolCallDelta(msgId, tc);
      }

      if (result.toolCallArgDelta) {
        const entry = acc.toolCalls.get(result.toolCallArgDelta.index);
        if (entry) {
          callbacks.onToolCallDelta(msgId, {
            id: entry.id,
            name: entry.name,
            arguments: entry.arguments,
            status: 'pending',
          });
        }
      }
    }

    const hasToolCalls = acc.toolCalls.size > 0;
    const hasContent = acc.content.length > 0;

    if (!hasToolCalls && !hasContent) {
      if (!messageEmitted) {
        callbacks.onDone();
        return;
      }
    }

    if (!hasToolCalls) {
      if (!messageEmitted && hasContent) {
        callbacks.onMessage({
          id: msgId,
          role: 'assistant',
          content: acc.content,
          timestamp: new Date().toISOString(),
        });
      }
      callbacks.onDone();
      return;
    }

    openaiMessages.push({
      role: 'assistant',
      content: acc.content || null,
      tool_calls: finalizeOpenAIToolCalls(acc),
    });

    const toolCalls = finalizeToolCalls(acc);

    for (const tc of toolCalls) {
      callbacks.onToolStart(msgId, tc);

      let result: string;
      const executor = getToolExecutor(tc.name);
      if (!executor) {
        result = JSON.stringify({ error: `Unknown tool: ${tc.name}` });
      } else {
        try {
          const parsedArgs = JSON.parse(tc.arguments);
          result = await executor(parsedArgs);
        } catch (e: any) {
          result = JSON.stringify({ error: e.message });
        }
      }

      callbacks.onToolEnd(msgId, tc.id, result);

      const toolMsg: ChatMessage = {
        id: nanoid(),
        role: 'tool',
        content: result,
        toolCallId: tc.id,
        timestamp: new Date().toISOString(),
      };

      callbacks.onMessage(toolMsg);

      openaiMessages.push({
        role: 'tool',
        content: result,
        tool_call_id: tc.id,
      });
    }

    continue;
  }

  callbacks.onError('Agent reached maximum iterations. Please try again with a simpler request.');
  callbacks.onDone();
}
