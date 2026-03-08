import { useState, useEffect, useCallback } from 'react';
import { nanoid } from 'nanoid';
import {
  ArrowUp,
  ArrowDown,
  Loader2,
  Plug,
  PlugX,
  Send,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Radio,
} from 'lucide-react';
import { KeyValueEditor } from './KeyValueEditor';
import type { WebSocketMessage } from '@shared/types';
import type { KeyValue } from '@shared/types';

type ConnectionStatus = 'disconnected' | 'connecting' | 'open' | 'closed' | 'error';

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

function headersToRecord(pairs: KeyValue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of pairs) {
    if (p.enabled && p.key.trim()) out[p.key.trim()] = p.value;
  }
  return out;
}

export function WebSocketView() {
  const [url, setUrl] = useState('ws://localhost:8080');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [protocolsStr, setProtocolsStr] = useState('');
  const [headers, setHeaders] = useState<KeyValue[]>([{ key: '', value: '', enabled: true }]);
  const [headersExpanded, setHeadersExpanded] = useState(false);

  const isConnected = status === 'open';
  const canConnect = status === 'disconnected' || status === 'closed' || status === 'error';
  const hasValidUrl = url.replace(/^wss?:\/\//, '').trim().length > 0;

  const addMessage = useCallback((msg: Omit<WebSocketMessage, 'id' | 'timestamp'>) => {
    setMessages((prev) => [
      ...prev,
      {
        ...msg,
        id: nanoid(),
        timestamp: new Date().toISOString(),
      },
    ]);
  }, []);

  useEffect(() => {
    if (!connectionId) return;

    const unsubscribe = window.ruke.ws.onEvent(connectionId, (evt: { type: string; data?: string; code?: number; reason?: string; error?: string }) => {
      switch (evt.type) {
        case 'open':
          setStatus('open');
          setError(null);
          break;
        case 'message':
          if (evt.data != null) {
            addMessage({ direction: 'received', data: evt.data, type: 'text' });
          }
          break;
        case 'close':
          setStatus('closed');
          break;
        case 'error':
          setStatus('error');
          setError(evt.error ?? 'Unknown error');
          break;
        default:
          break;
      }
    });

    return unsubscribe;
  }, [connectionId, addMessage]);

  const handleConnect = async () => {
    if (!hasValidUrl) return;

    const id = nanoid();
    setConnectionId(id);
    setStatus('connecting');
    setError(null);
    setMessages([]);

    const protocols = protocolsStr
      .split(/[,\s]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const headersRecord = headersToRecord(headers);

    const result = await window.ruke.ws.connect(id, url.trim(), protocols.length ? protocols : undefined, Object.keys(headersRecord).length ? headersRecord : undefined);

    if (!result.success) {
      setStatus('error');
      setError(result.error ?? 'Connection failed');
      setConnectionId(null);
    }
  };

  const handleDisconnect = async () => {
    if (!connectionId) return;
    await window.ruke.ws.close(connectionId);
    setConnectionId(null);
    setStatus('disconnected');
    setError(null);
  };

  const handleSend = async () => {
    if (!connectionId || !messageInput.trim() || status !== 'open') return;

    const data = messageInput.trim();
    addMessage({ direction: 'sent', data, type: 'text' });
    setMessageInput('');

    const result = await window.ruke.ws.send(connectionId, data);
    if (!result.success) {
      addMessage({ direction: 'received', data: `Error: ${result.error}`, type: 'text' });
    }
  };

  const statusConfig: Record<ConnectionStatus, { label: string; icon: typeof Plug; color: string; bg: string }> = {
    disconnected: {
      label: 'Disconnected',
      icon: PlugX,
      color: 'text-text-muted',
      bg: 'bg-bg-tertiary',
    },
    connecting: {
      label: 'Connecting...',
      icon: Loader2,
      color: 'text-accent',
      bg: 'bg-accent/10',
    },
    open: {
      label: 'Connected',
      icon: Radio,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    closed: {
      label: 'Closed',
      icon: PlugX,
      color: 'text-text-muted',
      bg: 'bg-bg-tertiary',
    },
    error: {
      label: 'Error',
      icon: AlertCircle,
      color: 'text-error',
      bg: 'bg-error/10',
    },
  };

  const statusInfo = statusConfig[status];
  const StatusIcon = statusInfo.icon;

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* URL bar */}
      <div className="p-4 border-b border-border bg-bg-secondary space-y-3">
        <div className="flex gap-2 items-center">
          <div className="flex-1 flex rounded-xl overflow-hidden border border-border bg-bg-tertiary focus-within:border-accent/40 transition-colors">
            <select
              value={url.startsWith('wss://') ? 'wss' : 'ws'}
              onChange={(e) => {
                const scheme = e.target.value as 'ws' | 'wss';
                const rest = url.replace(/^wss?:\/\//, '');
                setUrl(rest ? `${scheme}://${rest}` : `${scheme}://`);
              }}
              disabled={!canConnect}
              className="px-3 py-2.5 text-sm font-mono text-text-muted bg-bg-secondary border-r border-border focus:outline-none disabled:opacity-60 shrink-0"
            >
              <option value="ws">ws://</option>
              <option value="wss">wss://</option>
            </select>
            <input
              type="text"
              value={url.replace(/^wss?:\/\//, '')}
              onChange={(e) => {
                const rest = e.target.value;
                const scheme = url.startsWith('wss') ? 'wss' : 'ws';
                setUrl(rest ? `${scheme}://${rest}` : `${scheme}://`);
              }}
              placeholder="localhost:8080 or example.com/ws"
              disabled={!canConnect}
              className="flex-1 min-w-0 px-4 py-2.5 bg-transparent text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
          {canConnect ? (
            <button
              onClick={handleConnect}
              disabled={!hasValidUrl}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plug size={16} />
              Connect
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-error/20 hover:bg-error/30 text-error font-medium text-sm transition-colors"
            >
              <PlugX size={16} />
              Disconnect
            </button>
          )}
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${statusInfo.bg} ${statusInfo.color}`}
          >
            {status === 'connecting' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <StatusIcon size={14} />
            )}
            <span className="text-xs font-medium">{statusInfo.label}</span>
          </div>
          {error && (
            <span className="text-xs text-error">{error}</span>
          )}
        </div>

        {/* Protocols */}
        <div>
          <label className="block text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-1.5">
            Protocols
          </label>
          <input
            type="text"
            value={protocolsStr}
            onChange={(e) => setProtocolsStr(e.target.value)}
            placeholder="Optional: comma-separated (e.g. soap, mqtt)"
            disabled={!canConnect}
            className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors disabled:opacity-60"
          />
        </div>

        {/* Collapsible headers */}
        <div>
          <button
            onClick={() => setHeadersExpanded(!headersExpanded)}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            {headersExpanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
            <span className="text-xs font-medium">Headers</span>
          </button>
          {headersExpanded && (
            <div className="mt-2 p-3 rounded-lg bg-bg-tertiary border border-border">
              <KeyValueEditor
                pairs={headers}
                onChange={setHeaders}
                keyPlaceholder="Header name"
                valuePlaceholder="Value"
              />
            </div>
          )}
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 py-2 border-b border-border bg-bg-secondary flex items-center gap-2">
          <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">
            Messages
          </span>
          {messages.length > 0 && (
            <span className="text-[10px] text-text-muted tabular-nums">({messages.length})</span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-text-muted">
              <Radio size={32} className="mb-2 opacity-40" />
              <p className="text-sm">No messages yet</p>
              <p className="text-xs mt-1">
                {isConnected ? 'Send a message below' : 'Connect to start sending and receiving'}
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 p-3 rounded-lg border ${
                  msg.direction === 'sent'
                    ? 'bg-accent/5 border-accent/20'
                    : 'bg-bg-tertiary border-border'
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {msg.direction === 'sent' ? (
                    <ArrowUp size={14} className="text-accent" />
                  ) : (
                    <ArrowDown size={14} className="text-success" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <pre className="text-xs font-mono text-text-primary whitespace-pre-wrap break-words">
                    {msg.data}
                  </pre>
                  <div className="mt-1.5 text-[10px] text-text-muted tabular-nums">
                    {formatTimestamp(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Message input */}
        <div className="p-4 border-t border-border bg-bg-secondary">
          <div className="flex gap-2">
            <textarea
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={isConnected ? 'Type a message... (Enter to send)' : 'Connect first'}
              disabled={!isConnected}
              rows={2}
              className="flex-1 px-4 py-2.5 rounded-lg bg-bg-tertiary border border-border text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors resize-none disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSend}
              disabled={!isConnected || !messageInput.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 self-end"
            >
              <Send size={16} />
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
