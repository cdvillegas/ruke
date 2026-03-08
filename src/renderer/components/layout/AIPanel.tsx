import { useState, useRef, useEffect } from 'react';
import { useRequestStore } from '../../stores/requestStore';
import { useUiStore } from '../../stores/uiStore';
import { X, Send, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import type { AiMessage } from '@shared/types';

export function AIPanel() {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const setAiPanelOpen = useUiStore((s) => s.setAiPanelOpen);
  const activeRequest = useRequestStore((s) => s.activeRequest);
  const response = useRequestStore((s) => s.response);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    setError(null);

    const userMessage: AiMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const context = [
        `Current request: ${activeRequest.method} ${activeRequest.url}`,
        activeRequest.headers.filter(h => h.enabled && h.key).length > 0
          ? `Headers: ${JSON.stringify(activeRequest.headers.filter(h => h.enabled && h.key))}`
          : '',
        response ? `Last response: ${response.status} ${response.statusText} (${response.duration}ms)` : '',
      ].filter(Boolean).join('\n');

      const result = await window.ruke.ai.chat(newMessages, context);

      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      const assistantMessage: AiMessage = {
        role: 'assistant',
        content: result.content,
        timestamp: new Date().toISOString(),
      };

      setMessages([...newMessages, assistantMessage]);

      tryApplyAiSuggestion(result.content);
    } catch (err: any) {
      setError(err.message || 'AI request failed');
    }

    setLoading(false);
  };

  const tryApplyAiSuggestion = (content: string) => {
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) || content.match(/\{[\s\S]*"action"\s*:\s*"create_request"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        if (parsed.action === 'create_request' && parsed.request) {
          const store = useRequestStore.getState();
          store.updateActiveRequest({
            method: parsed.request.method || 'GET',
            url: parsed.request.url || '',
            headers: parsed.request.headers || [],
            params: parsed.request.params || [],
            body: parsed.request.body || { type: 'none' },
            auth: parsed.request.auth || { type: 'none' },
            name: parsed.request.name || 'AI Generated Request',
          });
        }
      }
    } catch {
      // not a structured response
    }
  };

  const suggestions = [
    'Create a GET request to fetch users',
    'Help me debug this API error',
    'Generate tests for this response',
    'Import an OpenAPI spec',
  ];

  return (
    <div className="w-[360px] border-l border-border bg-bg-secondary flex flex-col shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-accent" />
          <span className="text-sm font-semibold text-text-primary">AI Assistant</span>
        </div>
        <button
          onClick={() => setAiPanelOpen(false)}
          className="p-1 rounded hover:bg-bg-hover text-text-secondary transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-text-muted text-center py-4">
              Ask me anything about your API requests
            </p>
            <div className="space-y-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="w-full text-left px-3 py-2 text-xs rounded-lg bg-bg-tertiary hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors border border-border"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
          >
            <div
              className={`max-w-[85%] px-3 py-2 rounded-lg text-xs whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-accent text-white'
                  : 'bg-bg-tertiary text-text-primary border border-border'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-bg-tertiary border border-border rounded-lg px-3 py-2">
              <Loader2 size={14} className="animate-spin text-accent" />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 px-3 py-2 bg-error/10 border border-error/30 rounded-lg animate-fade-in">
            <AlertCircle size={14} className="text-error shrink-0 mt-0.5" />
            <p className="text-xs text-error">{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask AI anything..."
            className="flex-1 px-3 py-2 text-xs rounded-lg bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="p-2 rounded-lg bg-accent hover:bg-accent-hover text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
