import { nanoid } from 'nanoid';
import type { ChatMessage, ChatToolCall } from '@shared/types';
import { TOOL_SCHEMAS, getToolExecutor } from './agentTools';
import { AGENT_SYSTEM_PROMPT } from '../../main/ai/prompts';
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

export interface AgentCallbacks {
  onMessage: (msg: ChatMessage) => void;
  onToolStart: (messageId: string, toolCall: ChatToolCall) => void;
  onToolEnd: (messageId: string, toolCallId: string, result: string) => void;
  onError: (error: string) => void;
  onDone: () => void;
}

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

  const openaiMessages: OpenAIMessage[] = [
    { role: 'system', content: AGENT_SYSTEM_PROMPT },
    { role: 'system', content: `Current workspace context:\n${buildContextMessage()}` },
    ...chatToOpenAI(sessionMessages),
  ];

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    let data: any;
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: openaiMessages,
          tools: TOOL_SCHEMAS,
          tool_choice: 'auto',
          temperature: 0.3,
          max_tokens: 4096,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        callbacks.onError(`API error (${res.status}): ${errText.slice(0, 200)}`);
        callbacks.onDone();
        return;
      }

      data = await res.json();
    } catch (e: any) {
      callbacks.onError(`Network error: ${e.message}`);
      callbacks.onDone();
      return;
    }

    const choice = data.choices?.[0];
    if (!choice) {
      callbacks.onError('Empty response from AI.');
      callbacks.onDone();
      return;
    }

    const msg = choice.message;

    if (msg.tool_calls?.length) {
      const toolCalls: ChatToolCall[] = msg.tool_calls.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
        status: 'pending' as const,
      }));

      const assistantMsg: ChatMessage = {
        id: nanoid(),
        role: 'assistant',
        content: msg.content || null,
        toolCalls,
        timestamp: new Date().toISOString(),
      };

      callbacks.onMessage(assistantMsg);

      openaiMessages.push({
        role: 'assistant',
        content: msg.content || null,
        tool_calls: msg.tool_calls,
      });

      for (const tc of toolCalls) {
        callbacks.onToolStart(assistantMsg.id, tc);

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

        callbacks.onToolEnd(assistantMsg.id, tc.id, result);

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

    if (msg.content) {
      const assistantMsg: ChatMessage = {
        id: nanoid(),
        role: 'assistant',
        content: msg.content,
        timestamp: new Date().toISOString(),
      };
      callbacks.onMessage(assistantMsg);
    }

    callbacks.onDone();
    return;
  }

  callbacks.onError('Agent reached maximum iterations. Please try again with a simpler request.');
  callbacks.onDone();
}
