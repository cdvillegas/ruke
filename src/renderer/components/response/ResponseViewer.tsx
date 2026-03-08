import { useRequestStore } from '../../stores/requestStore';
import { useUiStore } from '../../stores/uiStore';
import { ResponseBody } from './ResponseBody';
import { ResponseHeaders } from './ResponseHeaders';
import { Clock, HardDrive, ArrowDown } from 'lucide-react';

export function ResponseViewer() {
  const response = useRequestStore((s) => s.response);
  const loading = useRequestStore((s) => s.loading);
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
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-accent"
                style={{
                  animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
            <p className="text-xs text-text-muted ml-1">Sending request...</p>
          </div>
        </div>
      </div>
    );
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

  const statusColor =
    response.status >= 200 && response.status < 300
      ? 'text-success'
      : response.status >= 400
      ? 'text-error'
      : response.status >= 300
      ? 'text-warning'
      : 'text-error';

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const headerCount = Object.keys(response.headers).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-border bg-bg-secondary shrink-0">
        <div className="flex items-center gap-2">
          <span className={`font-mono font-bold text-sm ${statusColor}`}>
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
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 px-4 border-b border-border bg-bg-secondary shrink-0">
        {[
          { id: 'body', label: 'Body' },
          { id: 'headers', label: `Headers (${headerCount})` },
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
      </div>
    </div>
  );
}
