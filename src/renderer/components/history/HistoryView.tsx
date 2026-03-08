import { useState, useEffect } from 'react';
import { useRequestStore } from '../../stores/requestStore';
import { History, Search, Trash2, Clock, ExternalLink } from 'lucide-react';
import { METHOD_COLORS } from '@shared/constants';

export function HistoryView() {
  const history = useRequestStore((s) => s.history);
  const loadHistory = useRequestStore((s) => s.loadHistory);
  const clearHistory = useRequestStore((s) => s.clearHistory);
  const searchHistory = useRequestStore((s) => s.searchHistory);
  const openTab = useRequestStore((s) => s.openTab);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      searchHistory(searchQuery);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <History size={18} className="text-accent" />
          <h2 className="text-lg font-semibold text-text-primary">Request History</h2>
          <span className="px-2 py-0.5 rounded-full bg-bg-tertiary text-[10px] text-text-muted">
            {history.length}
          </span>
        </div>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md text-text-muted hover:text-error hover:bg-error/10 transition-colors"
          >
            <Trash2 size={13} />
            <span>Clear All</span>
          </button>
        )}
      </div>

      <div className="px-6 py-3 shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter history by URL or method..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-bg-tertiary border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-4">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <History size={32} className="text-text-muted opacity-30 mb-3" />
            <p className="text-sm text-text-muted">No request history</p>
            <p className="text-xs text-text-muted mt-1">Requests will appear here as you send them</p>
          </div>
        ) : (
          <div className="space-y-1">
            {history.map((entry) => (
              <button
                key={entry.id}
                onClick={() => {
                  if (entry.request) openTab(entry.request);
                }}
                className="w-full group flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-bg-hover transition-colors"
              >
                <span
                  className="font-mono font-bold text-xs w-14 text-left shrink-0"
                  style={{ color: METHOD_COLORS[entry.method] || '#6b7280' }}
                >
                  {entry.method}
                </span>
                <span className="text-xs text-text-primary font-mono truncate flex-1 text-left">
                  {entry.url}
                </span>
                <span
                  className={`font-mono text-xs shrink-0 ${
                    entry.status >= 200 && entry.status < 300
                      ? 'text-success'
                      : entry.status >= 400
                      ? 'text-error'
                      : 'text-warning'
                  }`}
                >
                  {entry.status || 'ERR'}
                </span>
                <span className="text-[10px] text-text-muted shrink-0 flex items-center gap-1">
                  <Clock size={10} />
                  {entry.duration}ms
                </span>
                <span className="text-[10px] text-text-muted shrink-0 w-16 text-right">
                  {formatTime(entry.timestamp)}
                </span>
                <ExternalLink
                  size={12}
                  className="text-text-muted opacity-0 group-hover:opacity-100 shrink-0 transition-opacity"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
