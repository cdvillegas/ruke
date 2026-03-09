import { useState, useRef, useEffect } from 'react';
import { useRequestStore } from '../../stores/requestStore';
import { useUiStore } from '../../stores/uiStore';
import { ResponseBody } from './ResponseBody';
import { ResponseHeaders } from './ResponseHeaders';
import { Clock, HardDrive, ArrowDown, ChevronDown, History } from 'lucide-react';

function statusColor(status: number) {
  if (status >= 200 && status < 300) return 'text-success';
  if (status >= 300 && status < 400) return 'text-warning';
  if (status >= 400 && status < 500) return 'text-warning';
  return 'text-error';
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface ParsedCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string;
}

function parseSetCookieHeader(headerValue: string): ParsedCookie | null {
  const parts = headerValue.split(';').map((p) => p.trim());
  if (parts.length === 0) return null;
  const [namePart, ...attrParts] = parts;
  const eqIdx = namePart.indexOf('=');
  if (eqIdx < 0) return null;
  const name = namePart.slice(0, eqIdx).trim();
  const value = namePart.slice(eqIdx + 1).trim();
  let domain = '';
  let path = '';
  let expires = '';
  let httpOnly = false;
  let secure = false;
  let sameSite = '';
  for (const attr of attrParts) {
    const i = attr.indexOf('=');
    if (i < 0) {
      const lower = attr.toLowerCase();
      if (lower === 'httponly') httpOnly = true;
      else if (lower === 'secure') secure = true;
      continue;
    }
    const key = attr.slice(0, i).trim().toLowerCase();
    const val = attr.slice(i + 1).trim();
    if (key === 'domain') domain = val;
    else if (key === 'path') path = val;
    else if (key === 'expires') expires = val;
    else if (key === 'samesite') sameSite = val;
  }
  return { name, value, domain, path, expires, httpOnly, secure, sameSite };
}

function parseCookiesFromHeaders(headers: Record<string, string>): ParsedCookie[] {
  const cookies: ParsedCookie[] = [];
  const setCookieKey = Object.keys(headers).find((k) => k.toLowerCase() === 'set-cookie');
  if (!setCookieKey) return cookies;
  const raw = headers[setCookieKey];
  const segments = raw.split(/\r?\n/);
  for (const seg of segments) {
    const parsed = parseSetCookieHeader(seg.trim());
    if (parsed && parsed.name) cookies.push(parsed);
  }
  return cookies;
}

function HistoryDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const requestHistory = useRequestStore((s) => s.requestHistory);
  const viewHistoryResponse = useRequestStore((s) => s.viewHistoryResponse);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (requestHistory.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary bg-bg-tertiary/50 hover:bg-bg-tertiary rounded-md transition-colors"
      >
        <History size={11} />
        <span>History</span>
        <span className="text-[10px] text-text-muted tabular-nums">({requestHistory.length})</span>
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-64 bg-bg-secondary border border-border/60 rounded-lg shadow-2xl z-50 py-1 animate-fade-in max-h-64 overflow-y-auto">
          <div className="px-3 py-1.5 text-[9px] text-text-muted/50 uppercase tracking-wider font-medium">
            Response history
          </div>
          {requestHistory.map((entry) => (
            <button
              key={entry.id}
              onClick={() => { viewHistoryResponse(entry.id); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-bg-hover transition-colors"
            >
              <span className={`text-[11px] font-mono font-bold tabular-nums ${statusColor(entry.status)}`}>
                {entry.status}
              </span>
              <span className="text-[10px] text-text-muted tabular-nums">{entry.duration}ms</span>
              <span className="text-[10px] text-text-muted/50 ml-auto">{timeAgo(entry.timestamp)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryList() {
  const requestHistory = useRequestStore((s) => s.requestHistory);
  const viewHistoryResponse = useRequestStore((s) => s.viewHistoryResponse);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-border bg-bg-secondary shrink-0">
        <div className="flex items-center gap-1.5 text-text-muted">
          <History size={12} />
          <span className="text-[11px] font-medium">Previous responses</span>
          <span className="text-[10px] text-text-muted/50">({requestHistory.length})</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {requestHistory.map((entry) => (
          <button
            key={entry.id}
            onClick={() => viewHistoryResponse(entry.id)}
            className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-border/30 hover:bg-bg-hover/50 transition-colors text-left"
          >
            <span className={`text-xs font-mono font-bold tabular-nums w-8 ${statusColor(entry.status)}`}>
              {entry.status}
            </span>
            <span className="text-[11px] font-mono text-text-secondary truncate flex-1">{entry.url}</span>
            <div className="flex items-center gap-3 shrink-0 text-[10px] text-text-muted tabular-nums">
              <span>{entry.duration}ms</span>
              <span>{formatSize(entry.responseSize)}</span>
              <span className="text-text-muted/50">{timeAgo(entry.timestamp)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ResponseViewer() {
  const response = useRequestStore((s) => s.response);
  const loading = useRequestStore((s) => s.loading);
  const requestHistory = useRequestStore((s) => s.requestHistory);
  const activeResponseTab = useUiStore((s) => s.activeResponseTab);
  const setActiveResponseTab = useUiStore((s) => s.setActiveResponseTab);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-10 h-10 rounded-full border-2 border-accent/20" />
            <div
              className="absolute inset-0 w-10 h-10 rounded-full border-2 border-transparent border-t-accent"
              style={{ animation: 'spin 1s linear infinite' }}
            />
            <div
              className="absolute inset-1 w-8 h-8 rounded-full"
              style={{ animation: 'glow-send 2s ease-in-out infinite', background: 'rgba(99, 102, 241, 0.08)' }}
            />
          </div>
          <p className="text-xs text-text-muted">Sending request...</p>
        </div>
      </div>
    );
  }

  if (!response && requestHistory.length > 0) {
    return <HistoryList />;
  }

  if (!response) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-text-muted">
          <ArrowDown size={24} className="opacity-30" />
          <p className="text-xs">Send a request to see the response</p>
          <p className="text-[10px]">⌘ + Enter to send</p>
        </div>
      </div>
    );
  }

  const headerCount = Object.keys(response.headers).length;
  const cookies = parseCookiesFromHeaders(response.headers);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-border bg-bg-secondary shrink-0">
        <div className="flex items-center gap-2">
          <span className={`font-mono font-bold text-sm ${statusColor(response.status)}`}>
            {response.status || 'ERR'}
          </span>
          <span className="text-xs text-text-secondary">{response.statusText}</span>
        </div>

        <div className="flex items-center gap-4 ml-auto text-xs text-text-muted">
          <div className="flex items-center gap-1">
            <Clock size={12} />
            <span>{response.duration}ms</span>
          </div>
          <div className="flex items-center gap-1">
            <HardDrive size={12} />
            <span>{formatSize(response.size)}</span>
          </div>
          <HistoryDropdown />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 px-4 border-b border-border bg-bg-secondary shrink-0">
        {[
          { id: 'body', label: 'Body' },
          { id: 'headers', label: `Headers (${headerCount})` },
          { id: 'cookies', label: `Cookies (${cookies.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveResponseTab(tab.id)}
            className={`px-3 py-2 text-xs font-medium transition-colors relative ${
              activeResponseTab === tab.id
                ? 'text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
            {activeResponseTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeResponseTab === 'body' && (
          <ResponseBody
            body={response.body}
            bodyEncoding={response.bodyEncoding}
            contentType={response.headers['content-type'] || ''}
          />
        )}
        {activeResponseTab === 'headers' && <ResponseHeaders headers={response.headers} />}
        {activeResponseTab === 'cookies' && (
          <div className="p-4">
            {cookies.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-4">No cookies in response</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 font-semibold text-text-secondary">Name</th>
                      <th className="text-left py-2 px-3 font-semibold text-text-secondary">Value</th>
                      <th className="text-left py-2 px-3 font-semibold text-text-secondary">Domain</th>
                      <th className="text-left py-2 px-3 font-semibold text-text-secondary">Path</th>
                      <th className="text-left py-2 px-3 font-semibold text-text-secondary">Expires</th>
                      <th className="text-left py-2 px-3 font-semibold text-text-secondary">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cookies.map((c, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-bg-hover/50 transition-colors">
                        <td className="py-2 px-3 font-mono font-semibold text-accent">{c.name}</td>
                        <td className="py-2 px-3 font-mono text-text-secondary break-all max-w-[200px]">{c.value}</td>
                        <td className="py-2 px-3 font-mono text-text-muted">{c.domain || '—'}</td>
                        <td className="py-2 px-3 font-mono text-text-muted">{c.path || '—'}</td>
                        <td className="py-2 px-3 font-mono text-text-muted">{c.expires || '—'}</td>
                        <td className="py-2 px-3">
                          <div className="flex flex-wrap gap-1">
                            {c.httpOnly && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/20 text-accent">
                                HttpOnly
                              </span>
                            )}
                            {c.secure && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-success/20 text-success">
                                Secure
                              </span>
                            )}
                            {c.sameSite && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-warning/20 text-warning">
                                SameSite={c.sameSite}
                              </span>
                            )}
                            {!c.httpOnly && !c.secure && !c.sameSite && <span className="text-text-muted">—</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
