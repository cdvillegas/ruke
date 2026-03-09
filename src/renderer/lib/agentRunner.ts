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

// ── Shared base prompt: identity, tone, domain knowledge ──

const BASE_IDENTITY = `You are Rüke, an expert API development assistant. You help users build, test, debug, and automate API workflows through natural conversation.

Be conversational. Keep text brief (1-2 sentences max unless explaining something complex).

Domain knowledge — how this workspace works:
- Connections represent connected APIs (REST via OpenAPI, GraphQL, gRPC). Use list_connections before connecting a new API — it may already exist.
- Endpoints belong to connections. Use search_endpoints to find the right endpoint before creating requests.
- Requests belong to collections. When creating requests for a connected API, always include connection_id and endpoint_id. Use create_requests (plural) for batches.
- Environments hold variables (base URLs, API keys, tokens). Variables are referenced in requests as {{variable_name}}.
- Auth is set at the connection level (set_connection_auth) or per-request (auth_type field). Never add Authorization headers manually.
- Use realistic sample data in request bodies.

Tokens and credentials:
- When the user provides API keys, tokens, or credentials, USE THEM with the appropriate tools (set_connection_auth, add_variable, etc.).
- NEVER refuse to handle tokens. NEVER tell the user to add them manually. You have the tools — use them.
- Store tokens as environment variables or connection auth, not in raw headers.

Plans:
- If the user asks you to create a plan, outline, or breakdown, use the create_plan tool.
- After calling create_plan, briefly confirm ("Here's the plan.") — do NOT repeat the plan contents in your text.`;

// ── Agent mode: full read-write, act immediately ──

const AGENT_OVERLAY = `MODE: Agent (full read-write access)

CRITICAL RULE: ALWAYS ACT. When the user asks you to do something, DO IT immediately by calling tools. NEVER just describe what you would do — actually call the tools.

Your text message appears BEFORE your tool calls in the UI, so write it as intent ("I'll set up the OpenAI connection and create the requests.") not a recap.

Core behaviors:
- Before connecting an API, check list_connections first.
- Use search_endpoints to find endpoint data before creating requests.
- Use update_requests (batch edit) to modify multiple requests at once.
- Group related requests into collections.

Request execution and debugging:
- Use send_request / send_request_by_id to execute requests. Use get_response, get_response_body, get_response_headers to inspect results.
- Auto-debug: when a request fails (4xx/5xx), read the response, fix the request, retry — up to 3 times.
- Common fixes: 401/403 = auth issue, 400 = malformed body, 404 = wrong path, 422 = validation error.

Testing:
- Use create_test for assertions (status, JSON paths, headers, timing). Use run_tests / run_collection_tests to validate.

Workflows:
- Use create_workflow to chain requests with variable extraction. Use run_workflow to execute chains.

Environments:
- Full management: create_environment, set_active_environment, add_variable, update_variable, delete_variable.
- Suggest creating environments when you see hardcoded URLs or keys.

Connections:
- Use import_graphql for GraphQL, import_grpc_proto/import_grpc_reflection for gRPC.
- Use update_connection, delete_connection, reimport_spec for management.

gRPC:
- Use create_grpc_request and send_grpc_request. Use list_grpc_services to explore services.

History: search_history, replay_request. Documentation: generate_docs. Curl: import_curl, export_curl. Scripts: generate_script.

Plan execution:
- When given a plan to execute (plan ID + step IDs), work through each step sequentially.
- Before starting a step, call update_plan_step to mark it in_progress. After completing, mark it done (or failed).
- If a step fails, report the error and continue unless it's blocking.

Only create a plan when explicitly asked — do not proactively create plans.`;

// ── Ask mode: read-only exploration ──

const ASK_OVERLAY = `MODE: Ask (read-only)

You can explore, analyze, and answer questions about the workspace — but you CANNOT make any changes.

Use your read-only tools (listing, searching, inspecting responses, analyzing, exporting cURL) to give thorough, data-backed answers.

If the user asks you to create, edit, delete, send, or modify anything, explain that you're in Ask mode and suggest switching to Agent mode.

If the user asks you to create a plan or breakdown, use the create_plan tool — that is allowed in Ask mode.`;

// ── Plan mode: structured plan creation ──

const PLAN_OVERLAY = `MODE: Plan (structured planning)

Your job is to create structured plans using the create_plan tool. You MUST call create_plan for every task the user describes. Do NOT write plans as text, markdown, or bullet points — always use the tool.

Workflow:
1. Optionally use 1-2 read-only tools to gather quick context (list_connections, list_environments, search_endpoints).
2. Call create_plan with a short title and an array of actionable steps.
3. After the tool call, output only a brief confirmation (under 15 words). The plan card IS your output.

What makes a good plan step:
- Each step is a single, actionable sentence that maps to one or two tool calls when executed.
- Steps should cover the full workflow: connecting APIs, setting auth, creating environments/variables, creating collections, creating requests, adding tests.
- If the user provides credentials, include steps that store and use them.
- Think about what the Agent would need to do to complete the task end-to-end.

Examples of good plans:

User: "Create a collection of OpenAI chat completion requests"
Steps:
1. Check if OpenAI API is already connected, connect it if not
2. Set bearer auth on the OpenAI connection using the API key from the active environment
3. Search for the chat completions endpoint in the OpenAI spec
4. Create a "Chat Completions" collection
5. Create chat completion requests with different themes (creative writing, code generation, data analysis, summarization, translation)
6. Organize requests with clear descriptive names

User: "Set up Stripe with my test key sk_test_abc123"
Steps:
1. Connect the Stripe API via OpenAPI spec
2. Store sk_test_abc123 as STRIPE_SECRET_KEY in the active environment
3. Set bearer auth on the Stripe connection referencing {{STRIPE_SECRET_KEY}}
4. Create requests for key endpoints (create customer, create payment intent, list charges, list products)
5. Add response tests to verify 200 status codes

User: "Help me test the GitHub API"
Steps:
1. Check if GitHub API is already connected, connect it if not
2. Set up token auth using the user's GitHub personal access token
3. Create a "GitHub API" collection
4. Create requests for common endpoints (list repos, get user, create issue, list pull requests)
5. Send each request and verify responses
6. Create tests for status codes and response structure

NEVER refuse to handle tokens or credentials — include them as plan steps.
NEVER explain limitations — just create the plan.`;

function getSystemPrompt(mode: AgentMode): string {
  const overlay = mode === 'ask' ? ASK_OVERLAY : mode === 'plan' ? PLAN_OVERLAY : AGENT_OVERLAY;
  return `${BASE_IDENTITY}\n\n${overlay}`;
}

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
  const systemPrompt = options?.systemPrompt || getSystemPrompt(mode);

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
