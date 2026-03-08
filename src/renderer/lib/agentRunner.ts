import { streamText, stepCountIs, type ModelMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { nanoid } from 'nanoid';
import type { ChatMessage, ChatToolCall } from '@shared/types';
import { AGENT_TOOLS } from './agentTools';
import { useConnectionStore } from '../stores/connectionStore';
import { useEnvironmentStore } from '../stores/environmentStore';

const MAX_STEPS = 25;
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

function convertMessages(messages: ChatMessage[]): ModelMessage[] {
  const result: ModelMessage[] = [];

  for (const m of messages) {
    if (m.role === 'user') {
      result.push({ role: 'user', content: m.content || '' });
    } else if (m.role === 'assistant') {
      const parts: Array<
        | { type: 'text'; text: string }
        | { type: 'tool-call'; toolCallId: string; toolName: string; input: unknown }
      > = [];
      if (m.content) {
        parts.push({ type: 'text', text: m.content });
      }
      if (m.toolCalls?.length) {
        for (const tc of m.toolCalls) {
          let input: unknown;
          try { input = JSON.parse(tc.arguments); } catch { input = {}; }
          parts.push({
            type: 'tool-call',
            toolCallId: tc.id,
            toolName: tc.name,
            input,
          });
        }
      }
      if (parts.length > 0) {
        result.push({ role: 'assistant', content: parts });
      }
    } else if (m.role === 'tool') {
      result.push({
        role: 'tool',
        content: [{
          type: 'tool-result',
          toolCallId: m.toolCallId!,
          toolName: '',
          output: { type: 'text' as const, value: m.content || '' },
        }],
      });
    }
  }

  return result;
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

export interface AgentRunOptions {
  systemPrompt?: string;
  extraContext?: string;
  abortSignal?: AbortSignal;
}

const DEFAULT_AGENT_INSTRUCTIONS = `You are Rüke, an expert API development assistant. You help users create, organize, and manage API requests through natural conversation.

CRITICAL RULE: ALWAYS ACT. When the user asks you to do something, DO IT immediately by calling tools. NEVER just describe what you would do — actually call the tools. If the user says "create requests", call create_requests (plural) with all requests in a single batch. Do not stop after creating a collection — populate it with requests using create_requests.

Be conversational. Keep text brief (1-2 sentences). Your text message appears BEFORE your tool calls in the UI, so write it as a plan of what you're about to do, not a recap of what you did. After all tools complete, summarize what you did.

Key behaviors:
- Before connecting an API, check list_connections first — the API may already be connected. NEVER call connect_api more than once for the same API.
- Before creating requests, use search_endpoints to find the right endpoint data.
- When creating requests for a connected API, always include connection_id and endpoint_id.
- When the user asks to edit, rename, or modify requests, use list_requests to find them, then update_requests to change them.
- Use realistic sample data in request bodies — real model names, plausible messages, etc.
- Don't add Authorization headers manually. Instead, use set_connection_auth to configure auth on the connection (all linked requests inherit it), or set auth_type on create_request/edit_current_request for per-request auth.
- When the user provides an API key or token, use set_connection_auth to configure it on the connection so all requests use it automatically.
- Use list_connections to check if auth is already configured (authConfigured field) before adding auth.
- Group related requests into collections.
- When asked to create "a bunch" or "several" requests, create at least 5-8 varied examples.
- ALWAYS use create_requests (plural) to create multiple requests in a single tool call. NEVER call create_request multiple times in a row — batch them into one create_requests call.`;

const DELTA_BATCH_MS = 40;

export async function runAgent(
  sessionMessages: ChatMessage[],
  callbacks: AgentCallbacks,
  options?: AgentRunOptions,
): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) {
    callbacks.onError('No API key configured. Add your OpenAI API key in Settings.');
    callbacks.onDone();
    return;
  }

  const provider = createOpenAI({ apiKey });
  const systemPrompt = options?.systemPrompt || DEFAULT_AGENT_INSTRUCTIONS;

  let contextBlock = buildContextMessage();
  if (options?.extraContext) {
    contextBlock += `\n\n${options.extraContext}`;
  }

  const fullSystem = `${systemPrompt}\n\nCurrent workspace context:\n${contextBlock}`;

  let currentMsgId = nanoid();
  let currentMsgEmitted = false;
  let stepHasContent = false;

  let pendingDelta = '';
  let batchTimer: ReturnType<typeof setTimeout> | null = null;

  const flushDelta = () => {
    if (batchTimer !== null) {
      clearTimeout(batchTimer);
      batchTimer = null;
    }
    if (!pendingDelta) return;
    const delta = pendingDelta;
    pendingDelta = '';
    callbacks.onContentDelta(currentMsgId, delta);
  };

  const scheduleDeltaFlush = () => {
    if (batchTimer === null) {
      batchTimer = setTimeout(flushDelta, DELTA_BATCH_MS);
    }
  };

  const emitMessage = (initialContent?: string) => {
    if (currentMsgEmitted) return;
    currentMsgEmitted = true;
    callbacks.onMessage({
      id: currentMsgId,
      role: 'assistant',
      content: initialContent || '',
      toolCalls: [],
      timestamp: new Date().toISOString(),
    });
  };

  try {
    const result = streamText({
      model: provider('gpt-5'),
      system: fullSystem,
      messages: convertMessages(sessionMessages),
      tools: AGENT_TOOLS,
      toolChoice: 'auto',
      stopWhen: stepCountIs(MAX_STEPS),
      maxOutputTokens: 4096,
      abortSignal: options?.abortSignal,

      experimental_onToolCallStart(event) {
        flushDelta();
        callbacks.onToolStart(currentMsgId, {
          id: event.toolCall.toolCallId,
          name: event.toolCall.toolName as string,
          arguments: typeof event.toolCall.input === 'string'
            ? event.toolCall.input
            : JSON.stringify(event.toolCall.input),
          status: 'running',
        });
      },

      experimental_onToolCallFinish(event) {
        const output = event.success
          ? (typeof event.output === 'string' ? event.output : JSON.stringify(event.output))
          : JSON.stringify({ error: String(event.error) });

        callbacks.onToolEnd(currentMsgId, event.toolCall.toolCallId, output);

        callbacks.onMessage({
          id: nanoid(),
          role: 'tool',
          content: output,
          toolCallId: event.toolCall.toolCallId,
          timestamp: new Date().toISOString(),
        });
      },
    });

    for await (const part of result.fullStream) {
      if (options?.abortSignal?.aborted) break;

      switch (part.type) {
        case 'start-step':
          flushDelta();
          if (stepHasContent) {
            currentMsgId = nanoid();
            currentMsgEmitted = false;
            stepHasContent = false;
          }
          break;

        case 'text-delta':
          if (part.text) {
            stepHasContent = true;
            if (!currentMsgEmitted) {
              emitMessage(part.text);
            } else {
              pendingDelta += part.text;
              scheduleDeltaFlush();
            }
          }
          break;

        case 'tool-input-start':
          flushDelta();
          emitMessage();
          stepHasContent = true;
          callbacks.onToolCallDelta(currentMsgId, {
            id: part.id,
            name: part.toolName,
            arguments: '',
            status: 'pending',
          });
          break;

        case 'tool-call':
          flushDelta();
          emitMessage();
          stepHasContent = true;
          callbacks.onToolCallDelta(currentMsgId, {
            id: part.toolCallId,
            name: part.toolName,
            arguments: JSON.stringify(part.input),
            status: 'pending',
          });
          break;
      }
    }

    flushDelta();

    if (!currentMsgEmitted && !stepHasContent) {
      const text = await result.text;
      if (text) {
        callbacks.onMessage({
          id: currentMsgId,
          role: 'assistant',
          content: text,
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (e: any) {
    if (batchTimer !== null) clearTimeout(batchTimer);
    if (options?.abortSignal?.aborted) {
      // Aborted by user -- not an error
    } else {
      callbacks.onError(e.message || 'Agent error');
    }
  }

  callbacks.onDone();
}
