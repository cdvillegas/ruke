import { streamText, stepCountIs, type ModelMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { nanoid } from 'nanoid';
import type { ChatMessage, ChatToolCall } from '@shared/types';
import { AGENT_TOOLS, ASK_TOOLS, PLAN_TOOLS } from './agentTools';

export type AgentMode = 'agent' | 'ask' | 'plan';
import { useConnectionStore } from '../stores/connectionStore';
import { useEnvironmentStore } from '../stores/environmentStore';

const MAX_STEPS = 25;
const AI_KEY_STORAGE = 'ruke:ai_key';
const AI_PROVIDER_STORAGE = 'ruke:ai_provider';
const AI_MODEL_STORAGE = 'ruke:ai_model';
const AI_BASE_URL_STORAGE = 'ruke:ai_base_url';

export type AiProvider = 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom';

export interface AiModelConfig {
  provider: AiProvider;
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export const MANAGED_PROVIDERS = ['openai', 'anthropic', 'google'] as const;
export type ManagedProvider = (typeof MANAGED_PROVIDERS)[number];

export const DEFAULT_MODELS: Record<ManagedProvider, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  google: 'gemini-2.0-flash',
};

export interface ModelOption {
  id: string;
  label: string;
  description?: string;
}

export const PROVIDER_MODELS: Record<ManagedProvider, ModelOption[]> = {
  openai: [
    { id: 'gpt-5.4', label: 'GPT-5.4', description: 'Flagship' },
    { id: 'gpt-4o', label: 'GPT-4o', description: 'Fast & capable' },
    { id: 'gpt-4.1', label: 'GPT-4.1', description: 'Balanced' },
    { id: 'o3', label: 'o3', description: 'Deep reasoning' },
    { id: 'o4-mini', label: 'o4 Mini', description: 'Fast reasoning' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', description: 'Balanced' },
    { id: 'claude-opus-4-20250514', label: 'Claude Opus 4', description: 'Most capable' },
    { id: 'claude-3-5-haiku-20241022', label: 'Claude Haiku 3.5', description: 'Fast & light' },
  ],
  google: [
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', description: 'Fast & efficient' },
    { id: 'gemini-2.5-pro-preview-05-06', label: 'Gemini 2.5 Pro', description: 'Most capable' },
    { id: 'gemini-2.5-flash-preview-04-17', label: 'Gemini 2.5 Flash', description: 'Latest flash' },
  ],
};

export const PROVIDER_META: Record<ManagedProvider, { label: string; description: string; placeholder: string }> = {
  openai: { label: 'OpenAI', description: 'GPT-5.4, GPT-4o, o3', placeholder: 'sk-...' },
  anthropic: { label: 'Anthropic', description: 'Claude Sonnet, Opus', placeholder: 'sk-ant-...' },
  google: { label: 'Google AI', description: 'Gemini 2.0 Flash, Pro', placeholder: 'AIza...' },
};

function providerKeySlot(provider: ManagedProvider): string {
  return `ruke:ai_key:${provider}`;
}

export function getProviderKey(provider: ManagedProvider): string | null {
  return localStorage.getItem(providerKeySlot(provider)) || null;
}

export function setProviderKey(provider: ManagedProvider, key: string) {
  if (key) {
    localStorage.setItem(providerKeySlot(provider), key);
  } else {
    localStorage.removeItem(providerKeySlot(provider));
  }

  const activeProvider = localStorage.getItem(AI_PROVIDER_STORAGE) || 'openai';
  if (provider === activeProvider) {
    if (key) {
      localStorage.setItem(AI_KEY_STORAGE, key);
      window.ruke?.ai?.setKey?.(key);
    } else {
      localStorage.removeItem(AI_KEY_STORAGE);
      window.ruke?.ai?.setKey?.('');
    }
  }
}

export function removeProviderKey(provider: ManagedProvider) {
  localStorage.removeItem(providerKeySlot(provider));

  const activeProvider = localStorage.getItem(AI_PROVIDER_STORAGE) || 'openai';
  if (provider === activeProvider) {
    localStorage.removeItem(AI_KEY_STORAGE);
    window.ruke?.ai?.setKey?.('');

    const fallback = MANAGED_PROVIDERS.find(p => p !== provider && getProviderKey(p));
    if (fallback) {
      activateProvider(fallback);
    }
  }
}

export function getConfiguredProviders(): ManagedProvider[] {
  return MANAGED_PROVIDERS.filter(p => {
    const key = localStorage.getItem(providerKeySlot(p));
    return key && key.length >= 10;
  });
}

export function activateProvider(provider: ManagedProvider, model?: string) {
  const key = getProviderKey(provider);
  if (!key) return;
  localStorage.setItem(AI_PROVIDER_STORAGE, provider);
  localStorage.setItem(AI_MODEL_STORAGE, model || DEFAULT_MODELS[provider]);
  localStorage.setItem(AI_KEY_STORAGE, key);
  localStorage.removeItem(AI_BASE_URL_STORAGE);
  window.ruke?.ai?.setKey?.(key);
}

export function selectModel(provider: ManagedProvider, modelId: string) {
  activateProvider(provider, modelId);
}

export function getModelConfig(): AiModelConfig | null {
  const apiKey = localStorage.getItem(AI_KEY_STORAGE);
  if (apiKey) {
    return {
      provider: (localStorage.getItem(AI_PROVIDER_STORAGE) as AiProvider) || 'openai',
      model: localStorage.getItem(AI_MODEL_STORAGE) || 'gpt-4o',
      apiKey,
      baseUrl: localStorage.getItem(AI_BASE_URL_STORAGE) || undefined,
    };
  }

  const configured = getConfiguredProviders();
  if (configured.length > 0) {
    activateProvider(configured[0]);
    return getModelConfig();
  }

  return null;
}

export function setModelConfig(config: Partial<AiModelConfig>) {
  if (config.provider) localStorage.setItem(AI_PROVIDER_STORAGE, config.provider);
  if (config.model) localStorage.setItem(AI_MODEL_STORAGE, config.model);
  if (config.apiKey) {
    localStorage.setItem(AI_KEY_STORAGE, config.apiKey);
    const provider = (config.provider || localStorage.getItem(AI_PROVIDER_STORAGE) || 'openai') as string;
    if (MANAGED_PROVIDERS.includes(provider as ManagedProvider)) {
      localStorage.setItem(providerKeySlot(provider as ManagedProvider), config.apiKey);
    }
  }
  if (config.baseUrl !== undefined) {
    if (config.baseUrl) localStorage.setItem(AI_BASE_URL_STORAGE, config.baseUrl);
    else localStorage.removeItem(AI_BASE_URL_STORAGE);
  }
}

export function createModelProvider(config: AiModelConfig) {
  const providerOpts: Record<string, unknown> = { apiKey: config.apiKey };

  switch (config.provider) {
    case 'anthropic':
      providerOpts.baseURL = config.baseUrl || 'https://api.anthropic.com/v1';
      break;
    case 'google':
      providerOpts.baseURL = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/openai/';
      break;
    case 'ollama':
      providerOpts.baseURL = config.baseUrl || 'http://localhost:11434/v1';
      providerOpts.apiKey = config.apiKey || 'ollama';
      break;
    case 'custom':
      if (config.baseUrl) providerOpts.baseURL = config.baseUrl;
      break;
    default:
      if (config.baseUrl) providerOpts.baseURL = config.baseUrl;
      break;
  }

  const provider = createOpenAI(providerOpts as any);
  return provider(config.model);
}

function getApiKey(): string | null {
  return localStorage.getItem(AI_KEY_STORAGE) || null;
}

const MEMORY_STORAGE_KEY = 'ruke:agent_memory';

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

  try {
    const memories = JSON.parse(localStorage.getItem(MEMORY_STORAGE_KEY) || '[]');
    if (memories.length > 0) {
      parts.push(`\nRemembered preferences and knowledge (${memories.length}):`);
      for (const m of memories.slice(-20)) {
        parts.push(`- [${m.type}] ${m.content}`);
      }
    }
  } catch {}

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
  mode?: AgentMode;
}

const DEFAULT_AGENT_INSTRUCTIONS = `You are Rüke, an expert API development assistant. You help users build, test, debug, and automate API workflows through natural conversation.

CRITICAL RULE: ALWAYS ACT. When the user asks you to do something, DO IT immediately by calling tools. NEVER just describe what you would do — actually call the tools.

Be conversational. Keep text brief (1-2 sentences). Your text message appears BEFORE your tool calls in the UI, so write it as a plan of what you're about to do, not a recap of what you did. After all tools complete, summarize what you did.

Core behaviors:
- Before connecting an API, check list_connections first — the API may already be connected.
- Before creating requests, use search_endpoints to find the right endpoint data.
- When creating requests for a connected API, always include connection_id and endpoint_id.
- When the user asks to edit, rename, or modify multiple requests, use update_requests (batch edit) to change them all at once.
- Use realistic sample data in request bodies.
- Don't add Authorization headers manually — use set_connection_auth for connection-level auth, or auth_type on create_request/edit_current_request for per-request auth.
- Use list_connections to check if auth is already configured before adding auth.
- Group related requests into collections.
- ALWAYS use create_requests (plural) to create multiple requests in a single tool call.

Request execution and debugging:
- Use send_request to execute the active request and get the full response.
- Use send_request_by_id to select and send any request in one step.
- After sending, use get_response, get_response_body, or get_response_headers to inspect results.
- When a request fails (4xx/5xx), diagnose the error from the response body, fix the request with edit_current_request, and retry with send_request. Repeat up to 3 times before giving up.
- Common fixes: 401/403 = auth issue (check set_connection_auth), 400 = malformed body/params, 404 = wrong URL/path, 422 = validation error in body.

Testing:
- Use create_test to define assertions for requests (status codes, JSON paths, headers, response time).
- Use run_tests to execute and validate assertions. Use run_collection_tests to test an entire collection.
- When creating tests, include meaningful descriptions and cover status, body content, and timing.

Workflows:
- Use create_workflow to chain requests together with variable extraction between steps.
- Use run_workflow to execute chains. Variables extracted from one step's response are available in subsequent steps via {{variable}} syntax.

Environments:
- Use set_active_environment, update_environment, add_variable, update_variable, delete_variable for full environment management.
- Suggest creating environments when you see hardcoded base URLs or API keys.

gRPC:
- Use create_grpc_request and send_grpc_request for gRPC workflows.
- Use import_grpc_proto or import_grpc_reflection to connect gRPC services.
- Use list_grpc_services to explore available services and methods.

History and replay:
- Use search_history to find past requests. Use replay_request to re-execute a historical request.

Documentation:
- Use generate_docs to create markdown API documentation from a connection's spec and history.

Connections:
- Use import_graphql for GraphQL APIs, import_grpc_proto/import_grpc_reflection for gRPC.
- Use update_connection, delete_connection, reimport_spec for connection management.

Plan Execution:
- When given a plan to execute (with plan ID and step IDs), work through each step sequentially.
- Before starting a step, call update_plan_step to mark it in_progress.
- After completing a step, call update_plan_step to mark it done (or failed).
- If a step fails, report the error and continue to the next step unless the failure is blocking.

Plans:
- If the user asks you to create a plan, outline, or breakdown of a task, use the create_plan tool.
- Only create a plan when explicitly asked — do not proactively create plans.
- After calling create_plan, briefly confirm ("Here's the plan.") — do NOT repeat the plan contents in your text.

Tokens and credentials:
- When the user provides API keys, tokens, or credentials, USE THEM immediately with the appropriate tools (set_connection_auth, add_variable, etc.).
- NEVER refuse to handle tokens. NEVER tell the user to add them manually. You have the tools — use them.
- Store tokens as environment variables or connection auth, not in request headers directly.`;

const ASK_INSTRUCTIONS = `You are Rüke, an expert API development assistant in read-only mode. You can explore, analyze, and answer questions about the user's workspace, requests, collections, environments, history, and connections — but you CANNOT make any changes.

You have access to read-only tools: listing, searching, inspecting responses, analyzing the workspace, and exporting cURL. Use these tools to give thorough, well-informed answers.

If the user asks you to create, edit, delete, send, or modify anything, politely explain that you're in Ask mode (read-only) and suggest they switch to Agent mode to make changes.

If the user asks you to create a plan or breakdown, use the create_plan tool. After calling it, briefly confirm — do NOT repeat the plan contents.

Be conversational. Keep answers concise but thorough. Use the available tools to back up your answers with real data from the workspace.`;

const PLAN_INSTRUCTIONS = `You are Rüke, an expert API development assistant in planning mode.

YOU MUST CALL THE create_plan TOOL. This is not optional. Do NOT write plans as text. Do NOT write lesson plans as text. Do NOT write outlines as text. You MUST use the create_plan tool to create a structured plan object.

EVERY response where the user describes a task MUST include a create_plan tool call. If you respond with only text and no create_plan call, you have failed.

Workflow:
1. Optionally use 1-2 read-only tools to gather quick context.
2. Call create_plan with a title and steps array. This is MANDATORY.
3. After calling create_plan, output only a brief sentence like "Here's the plan." — nothing else.

Rules:
- ALWAYS call create_plan. No exceptions. No text-only responses for tasks.
- Steps should cover everything: connecting APIs, setting auth, creating requests, configuring environments, etc.
- If the user provides API keys or tokens, include steps that use them.
- Each step is a brief, actionable sentence.
- NEVER write the plan as markdown text. ALWAYS use the create_plan tool.
- NEVER refuse to handle tokens or credentials — include them in plan steps.
- NEVER explain limitations. Just call create_plan.
- Your text response MUST be under 15 words. The plan tool call IS your output.`;

const DELTA_BATCH_MS = 40;

export async function runAgent(
  sessionMessages: ChatMessage[],
  callbacks: AgentCallbacks,
  options?: AgentRunOptions,
): Promise<void> {
  const config = getModelConfig();
  if (!config) {
    callbacks.onError('No API key configured. Add your AI provider key in Settings.');
    callbacks.onDone();
    return;
  }

  const mode = options?.mode || 'agent';
  const model = createModelProvider(config);
  const defaultPrompt = mode === 'ask' ? ASK_INSTRUCTIONS : mode === 'plan' ? PLAN_INSTRUCTIONS : DEFAULT_AGENT_INSTRUCTIONS;
  const systemPrompt = options?.systemPrompt || defaultPrompt;

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

  const tools = mode === 'ask' ? ASK_TOOLS : mode === 'plan' ? PLAN_TOOLS : AGENT_TOOLS;
  const planStepLimit = mode === 'plan' ? 5 : MAX_STEPS;
  let planCreated = false;
  const planAbort = new AbortController();

  try {

    const combinedSignal = options?.abortSignal
      ? AbortSignal.any([options.abortSignal, planAbort.signal])
      : planAbort.signal;

    const result = streamText({
      model,
      system: fullSystem,
      messages: convertMessages(sessionMessages),
      tools,
      toolChoice: 'auto',
      stopWhen: stepCountIs(planStepLimit),
      maxOutputTokens: 4096,
      abortSignal: combinedSignal,

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

        if (mode === 'plan' && event.toolCall.toolName === 'create_plan') {
          planCreated = true;
          planAbort.abort();
        }
      },
    });

    for await (const part of result.fullStream) {
      if (options?.abortSignal?.aborted || planCreated) break;

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
      try {
        const text = await result.text;
        if (text) {
          callbacks.onMessage({
            id: currentMsgId,
            role: 'assistant',
            content: text,
            timestamp: new Date().toISOString(),
          });
        } else {
          callbacks.onError('The model returned an empty response. Try a different model or simplify your request.');
        }
      } catch {
        callbacks.onError('The model returned an empty response. Try a different model or simplify your request.');
      }
    }
  } catch (e: any) {
    if (batchTimer !== null) clearTimeout(batchTimer);
    if (options?.abortSignal?.aborted || planCreated) {
      // Aborted by user or plan completed -- not an error
    } else {
      const msg = e.message || 'Agent error';
      if (msg.includes('No output generated')) {
        callbacks.onError('The model returned an empty response. Try a different model or simplify your request.');
      } else {
        callbacks.onError(msg);
      }
    }
  }

  callbacks.onDone();
}
