import OpenAI from 'openai';
import { SYSTEM_PROMPT } from './prompts';
import type { AiMessage } from '../../shared/types';

export class AiService {
  private client: OpenAI | null = null;

  setApiKey(key: string) {
    this.client = new OpenAI({ apiKey: key });
  }

  async chat(messages: AiMessage[], context?: string): Promise<{ content: string; error?: string }> {
    if (!this.client) {
      return {
        content: '',
        error: 'No API key configured. Add your OpenAI API key in Settings to use AI features.',
      };
    }

    try {
      const systemMessages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM_PROMPT },
      ];

      if (context) {
        systemMessages.push({
          role: 'system',
          content: `Current context:\n${context}`,
        });
      }

      const chatMessages: OpenAI.ChatCompletionMessageParam[] = messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [...systemMessages, ...chatMessages],
        temperature: 0.3,
        max_tokens: 2000,
      });

      return {
        content: response.choices[0]?.message?.content || 'No response generated.',
      };
    } catch (error: any) {
      return {
        content: '',
        error: error.message || 'AI request failed.',
      };
    }
  }
}
