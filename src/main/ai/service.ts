import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import OpenAI from 'openai';
import { SYSTEM_PROMPT } from './prompts';
import type { AiMessage } from '../../shared/types';

export class AiService {
  private provider: ReturnType<typeof createOpenAI> | null = null;
  private rawClient: OpenAI | null = null;

  setApiKey(key: string) {
    this.provider = createOpenAI({ apiKey: key });
    this.rawClient = new OpenAI({ apiKey: key });
  }

  /** Raw OpenAI client for modules that need it directly (e.g. DiscoveryAgent). */
  getClient(): OpenAI | null {
    return this.rawClient;
  }

  async chat(messages: AiMessage[], context?: string): Promise<{ content: string; error?: string }> {
    if (!this.provider) {
      return {
        content: '',
        error: 'No API key configured. Add your OpenAI API key in Settings to use AI features.',
      };
    }

    try {
      const systemContent = context
        ? `${SYSTEM_PROMPT}\n\nCurrent context:\n${context}`
        : SYSTEM_PROMPT;

      const { text } = await generateText({
        model: this.provider('gpt-5'),
        system: systemContent,
        messages: messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        maxOutputTokens: 4000,
      });

      return { content: text || 'No response generated.' };
    } catch (error: any) {
      return {
        content: '',
        error: error.message || 'AI request failed.',
      };
    }
  }
}
