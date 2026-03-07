import { useState, useRef, useEffect } from 'react';
import { useRequestStore } from '../../stores/requestStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useUiStore } from '../../stores/uiStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { nanoid } from 'nanoid';
import {
  Sparkles, Send, ArrowRight, Plug, Clock, Zap,
  Loader2, Globe, Plus, ChevronRight, Upload,
  Users, KeyRound, HeartPulse, PackagePlus,
  type LucideIcon,
} from 'lucide-react';
import { METHOD_COLORS } from '@shared/constants';
import type { HttpMethod } from '@shared/types';

const SUGGESTIONS: { text: string; icon: LucideIcon; color: string }[] = [
  { text: 'GET all users from my API', icon: Users, color: 'text-method-patch' },
  { text: 'Test the login endpoint with sample credentials', icon: KeyRound, color: 'text-method-post' },
  { text: 'Check the health of my service', icon: HeartPulse, color: 'text-success' },
  { text: 'Create a new item via POST request', icon: PackagePlus, color: 'text-method-put' },
];

export function HomeView() {
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const connections = useConnectionStore((s) => s.connections);
  const history = useRequestStore((s) => s.history);
  const { setActiveView } = useUiStore();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (!input.trim() || processing) return;
    setProcessing(true);

    const trimmed = input.trim();

    if (isUrl(trimmed)) {
      handleUrlInput(trimmed);
    } else {
      await handleAiInput(trimmed);
    }

    setProcessing(false);
  };

  const isUrl = (s: string) => {
    try { new URL(s); return true; } catch { return false; }
  };

  const isSpecUrl = (s: string) => {
    const lower = s.toLowerCase();
    return lower.includes('swagger') || lower.includes('openapi') ||
           lower.endsWith('.json') || lower.endsWith('.yaml') || lower.endsWith('.yml');
  };

  const handleUrlInput = (url: string) => {
    if (isSpecUrl(url)) {
      handleSpecUrl(url);
    } else {
      const store = useRequestStore.getState();
      store.updateActiveRequest({ url, method: 'GET', name: url });
      setActiveView('request');
    }
    setInput('');
  };

  const handleSpecUrl = async (url: string) => {
    try {
      const res = await fetch(url);
      const text = await res.text();
      const conn = useConnectionStore.getState().importOpenApiSpec(text, url);
      if (conn) {
        setActiveView('connections');
        setInput('');
      }
    } catch {
      const store = useRequestStore.getState();
      store.updateActiveRequest({ url, method: 'GET', name: url });
      setActiveView('request');
      setInput('');
    }
  };

  const handleAiInput = async (prompt: string) => {
    const methodMatch = prompt.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.+)/i);
    if (methodMatch) {
      const method = methodMatch[1].toUpperCase() as HttpMethod;
      let url = methodMatch[2].trim();
      if (!url.startsWith('http')) {
        const activeConn = connections.length > 0 ? connections[0] : null;
        if (activeConn) {
          url = activeConn.baseUrl + (url.startsWith('/') ? '' : '/') + url;
        }
      }
      const store = useRequestStore.getState();
      store.updateActiveRequest({ url, method, name: `${method} ${url}` });
      setActiveView('request');
      setInput('');
      return;
    }

    try {
      const context = connections.length > 0
        ? `Connected APIs: ${connections.map(c => `${c.name} (${c.baseUrl})`).join(', ')}`
        : '';

      const result = await window.ruke.ai.chat(
        [{ role: 'user', content: prompt, timestamp: new Date().toISOString() }],
        context
      );

      if (result.content) {
        try {
          const jsonMatch = result.content.match(/\{[\s\S]*"action"\s*:\s*"create_request"[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.request) {
              const store = useRequestStore.getState();
              store.updateActiveRequest({
                method: parsed.request.method || 'GET',
                url: parsed.request.url || '',
                headers: parsed.request.headers || [],
                params: parsed.request.params || [],
                body: parsed.request.body || { type: 'none' },
                auth: parsed.request.auth || { type: 'none' },
                name: parsed.request.name || prompt,
              });
              setActiveView('request');
              setInput('');
              return;
            }
          }
        } catch {}
      }

      const store = useRequestStore.getState();
      store.updateActiveRequest({ name: prompt });
      setActiveView('request');
      setInput('');
    } catch {
      setActiveView('request');
      setInput('');
    }
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setProcessing(true);
    try {
      const text = await file.text();
      const conn = useConnectionStore.getState().importOpenApiSpec(text, file.name);
      if (conn) {
        setActiveView('connections');
      }
    } catch {}
    setProcessing(false);
  };

  const handleFileClick = async () => {
    const result = await window.ruke.file.import([
      { name: 'API Specs', extensions: ['json', 'yaml', 'yml'] },
    ]);
    if (result.success && result.content) {
      const conn = useConnectionStore.getState().importOpenApiSpec(result.content, result.path);
      if (conn) {
        setActiveView('connections');
      }
    }
  };

  const recentHistory = history.slice(0, 6);

  return (
    <div
      className="h-full flex flex-col items-center overflow-y-auto"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleFileDrop}
    >
      <div className="w-full max-w-2xl px-6 pt-20 pb-8 flex flex-col items-center">
        {/* Hero */}
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={20} className="text-accent" />
          <h1 className="text-lg font-semibold text-text-primary">What do you want to do?</h1>
        </div>
        <p className="text-xs text-text-muted mb-8 text-center max-w-md">
          Type a request, paste a URL, drop an OpenAPI spec, or describe what you need in plain English.
        </p>

        {/* Command Bar */}
        <div className="w-full relative mb-6">
          <div className="relative flex items-center">
            <Sparkles size={16} className="absolute left-4 text-accent" />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder='Try "GET /users" or paste a spec URL...'
              disabled={processing}
              className="w-full pl-11 pr-14 py-4 text-sm rounded-2xl bg-bg-secondary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all disabled:opacity-50"
            />
            <button
              onClick={handleSubmit}
              disabled={processing || !input.trim()}
              className="absolute right-2 p-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {processing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="w-full grid grid-cols-2 gap-2 mb-10">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.text}
              onClick={() => { setInput(s.text); inputRef.current?.focus(); }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-bg-secondary border border-border hover:border-border-light hover:bg-bg-tertiary text-left transition-all group"
            >
              <s.icon size={15} className={`${s.color} shrink-0`} />
              <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">{s.text}</span>
            </button>
          ))}
        </div>

        {/* Connected APIs */}
        <div className="w-full mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Plug size={14} className="text-text-muted" />
              <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Connected APIs</h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleFileClick}
                className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                <Upload size={11} /> Import Spec
              </button>
              <button
                onClick={() => setActiveView('connections')}
                className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              >
                <Plus size={11} /> Add API
              </button>
            </div>
          </div>

          {connections.length === 0 ? (
            <div
              onClick={handleFileClick}
              className="border-2 border-dashed border-border rounded-2xl p-8 text-center cursor-pointer hover:border-accent/40 hover:bg-accent/5 transition-all"
            >
              <Globe size={24} className="mx-auto text-text-muted mb-3 opacity-50" />
              <p className="text-sm text-text-muted mb-1">No APIs connected yet</p>
              <p className="text-xs text-text-muted">
                Drop an OpenAPI spec here, paste a spec URL above, or click to import
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {connections.map((conn) => (
                <button
                  key={conn.id}
                  onClick={() => {
                    useConnectionStore.getState().setActiveConnection(conn.id);
                    setActiveView('connections');
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-bg-secondary border border-border hover:border-border-light hover:bg-bg-tertiary transition-all group text-left"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white text-xs font-bold"
                    style={{ background: conn.iconColor }}
                  >
                    {conn.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{conn.name}</p>
                    <p className="text-[10px] text-text-muted font-mono truncate">{conn.baseUrl}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-text-muted px-1.5 py-0.5 rounded bg-bg-tertiary">
                      {conn.endpoints.length} endpoints
                    </span>
                    <ChevronRight size={14} className="text-text-muted group-hover:text-text-primary transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        {recentHistory.length > 0 && (
          <div className="w-full">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-text-muted" />
              <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Recent</h2>
            </div>
            <div className="space-y-1">
              {recentHistory.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => {
                    if (entry.request) {
                      useRequestStore.getState().openTab(entry.request);
                      setActiveView('request');
                    }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-bg-secondary transition-colors group"
                >
                  <span
                    className="font-mono font-bold text-[10px] w-12 text-left shrink-0"
                    style={{ color: METHOD_COLORS[entry.method] || '#6b7280' }}
                  >
                    {entry.method}
                  </span>
                  <span className="text-xs text-text-secondary font-mono truncate flex-1 text-left">
                    {entry.url}
                  </span>
                  <span className={`font-mono text-[10px] shrink-0 ${
                    entry.status >= 200 && entry.status < 300 ? 'text-success' :
                    entry.status >= 400 ? 'text-error' : 'text-warning'
                  }`}>
                    {entry.status || 'ERR'}
                  </span>
                  <span className="text-[10px] text-text-muted shrink-0">{entry.duration}ms</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
