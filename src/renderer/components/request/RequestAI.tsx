import { useState, useRef, useEffect } from 'react';
import { useRequestStore } from '../../stores/requestStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { X, Send, Sparkles, Loader2, AlertCircle, Zap } from 'lucide-react';
import type { AiMessage } from '@shared/types';

interface Props {
  onClose: () => void;
}

export function RequestAI({ onClose }: Props) {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeRequest = useRequestStore((s) => s.activeRequest);
  const response = useRequestStore((s) => s.response);
  const connections = useConnectionStore((s) => s.connections);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    setError(null);

    const userMessage: AiMessage = { role: 'user', content: input.trim(), timestamp: new Date().toISOString() };
    const updated = [...messages, userMessage];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      const context = [
        `Current request: ${activeRequest.method} ${activeRequest.url}`,
        activeRequest.headers.filter(h => h.enabled && h.key).length > 0
          ? `Headers: ${JSON.stringify(activeRequest.headers.filter(h => h.enabled && h.key))}` : '',
        response ? `Last response: ${response.status} ${response.statusText} (${response.duration}ms)\nBody preview: ${response.body.slice(0, 500)}` : '',
        connections.length > 0 ? `Connected APIs: ${connections.map(c => `${c.name} (${c.baseUrl}, ${c.endpoints.length} endpoints)`).join('; ')}` : '',
      ].filter(Boolean).join('\n');

      const result = await window.ruke.ai.chat(updated, context);
      if (result.error) { setError(result.error); setLoading(false); return; }

      setMessages([...updated, { role: 'assistant', content: result.content, timestamp: new Date().toISOString() }]);

      try {
        const jsonMatch = result.content.match(/\{[\s\S]*"action"\s*:\s*"create_request"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.request) {
            useRequestStore.getState().updateActiveRequest({
              method: parsed.request.method || activeRequest.method,
              url: parsed.request.url || activeRequest.url,
              headers: parsed.request.headers || activeRequest.headers,
              params: parsed.request.params || activeRequest.params,
              body: parsed.request.body || activeRequest.body,
              auth: parsed.request.auth || activeRequest.auth,
              name: parsed.request.name || activeRequest.name,
            });
          }
        }
      } catch {}
    } catch (err: any) {
      setError(err.message || 'AI request failed');
    }
    setLoading(false);
  };

  const quickActions = response ? [
    { label: 'Explain this response', action: 'Explain the response I just got — what does it mean and is it correct?' },
    { label: 'Generate tests', action: 'Generate test assertions for this API response' },
    { label: 'What went wrong?', action: `Why did this request return ${response.status}? How do I fix it?` },
  ] : [
    { label: 'Add auth header', action: 'Add a Bearer token authorization header to this request' },
    { label: 'Add query params', action: 'What query parameters should I add to this endpoint?' },
    { label: 'Generate body', action: 'Generate a sample JSON request body for this endpoint' },
  ];

  return (
    <div className="w-80 border-l border-border bg-bg-secondary flex flex-col shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-accent" />
          <span className="text-xs font-semibold text-text-primary">AI Assist</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-bg-hover text-text-muted transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-[10px] text-text-muted text-center mb-3">Quick actions for this request</p>
            {quickActions.map((q) => (
              <button
                key={q.label}
                onClick={() => { setInput(q.action); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[11px] rounded-lg bg-bg-tertiary hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors border border-border text-left"
              >
                <Zap size={11} className="text-accent shrink-0" />
                {q.label}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            <div className={`max-w-[90%] px-3 py-2 rounded-xl text-[11px] leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-accent text-white'
                : 'bg-bg-tertiary text-text-primary border border-border'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-bg-tertiary border border-border rounded-xl px-3 py-2">
              <Loader2 size={12} className="animate-spin text-accent" />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 px-3 py-2 bg-error/10 border border-error/30 rounded-xl animate-fade-in">
            <AlertCircle size={12} className="text-error shrink-0 mt-0.5" />
            <p className="text-[10px] text-error">{error}</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-border">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about this request..."
            className="flex-1 px-3 py-2 text-[11px] rounded-xl bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="p-2 rounded-xl bg-accent hover:bg-accent-hover text-white disabled:opacity-30 transition-colors"
          >
            <Send size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
