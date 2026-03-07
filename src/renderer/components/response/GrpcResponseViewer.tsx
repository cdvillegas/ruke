import { useState } from 'react';
import { GRPC_STATUS_CODES, GRPC_STATUS_COLORS } from '@shared/constants';
import type { GrpcResponse, GrpcStreamMessage } from '@shared/types';
import { ResponseBody } from './ResponseBody';
import { Clock, ArrowDown, Hash, ChevronDown, ChevronRight } from 'lucide-react';

interface GrpcResponseViewerProps {
  response: GrpcResponse | null;
  loading: boolean;
}

export function GrpcResponseViewer({ response, loading }: GrpcResponseViewerProps) {
  const [activeTab, setActiveTab] = useState<'body' | 'messages' | 'metadata' | 'trailers'>('body');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-accent"
                style={{ animation: `pulse-dot 1s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </div>
          <p className="text-xs text-text-muted">Invoking RPC...</p>
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-text-muted">
          <ArrowDown size={24} className="opacity-30" />
          <p className="text-xs">Invoke a method to see the response</p>
          <p className="text-[10px]">Select a service method and click Invoke</p>
        </div>
      </div>
    );
  }

  const statusName = GRPC_STATUS_CODES[response.status] || 'UNKNOWN';
  const statusColor = GRPC_STATUS_COLORS[response.status] || '#ef4444';
  const isOk = response.status === 0;

  const metadataCount = Object.keys(response.metadata).length;
  const trailerCount = Object.keys(response.trailers).length;
  const messageCount = response.messages.length;

  const tabs = [
    { id: 'body' as const, label: 'Response' },
    ...(messageCount > 1 ? [{ id: 'messages' as const, label: `Messages (${messageCount})` }] : []),
    ...(metadataCount > 0 ? [{ id: 'metadata' as const, label: `Metadata (${metadataCount})` }] : []),
    ...(trailerCount > 0 ? [{ id: 'trailers' as const, label: `Trailers (${trailerCount})` }] : []),
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* gRPC status bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-border bg-bg-secondary shrink-0">
        <div className="flex items-center gap-2">
          <span
            className="font-mono font-bold text-sm"
            style={{ color: statusColor }}
          >
            {response.status}
          </span>
          <span
            className="text-xs font-mono font-medium px-1.5 py-0.5 rounded"
            style={{ color: statusColor, backgroundColor: `${statusColor}15` }}
          >
            {statusName}
          </span>
          {!isOk && (
            <span className="text-xs text-text-secondary truncate max-w-xs">
              {response.statusMessage}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 ml-auto text-xs text-text-muted">
          {messageCount > 1 && (
            <div className="flex items-center gap-1">
              <Hash size={12} />
              <span>{messageCount} msgs</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Clock size={12} />
            <span>{response.duration}ms</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 px-4 border-b border-border bg-bg-secondary shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'body' && <ResponseBody body={response.body} />}

        {activeTab === 'messages' && (
          <StreamMessageList messages={response.messages} />
        )}

        {activeTab === 'metadata' && (
          <MetadataTable entries={response.metadata} title="Response Metadata" />
        )}

        {activeTab === 'trailers' && (
          <MetadataTable entries={response.trailers} title="Trailers" />
        )}
      </div>
    </div>
  );
}

function StreamMessageList({ messages }: { messages: GrpcStreamMessage[] }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="divide-y divide-border">
      {messages.map((msg) => {
        const isExpanded = expandedIds.has(msg.id);
        return (
          <div key={msg.id}>
            <button
              onClick={() => toggle(msg.id)}
              className="w-full flex items-center gap-2 px-4 py-2 text-xs hover:bg-bg-hover transition-colors"
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span className={`font-mono font-medium ${
                msg.direction === 'sent' ? 'text-method-post' : 'text-method-get'
              }`}>
                {msg.direction === 'sent' ? '↑ SENT' : '↓ RECV'}
              </span>
              <span className="text-text-muted">#{msg.index}</span>
              <span className="text-text-muted ml-auto text-[10px]">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </button>
            {isExpanded && (
              <div className="px-4 pb-3">
                <ResponseBody body={msg.data} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MetadataTable({ entries, title }: { entries: Record<string, string>; title: string }) {
  const items = Object.entries(entries);
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-xs text-text-muted">No {title.toLowerCase()}</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-2 text-text-muted font-medium">Key</th>
            <th className="text-left py-2 px-2 text-text-muted font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {items.map(([key, value]) => (
            <tr key={key} className="border-b border-border/50">
              <td className="py-2 px-2 font-mono text-accent">{key}</td>
              <td className="py-2 px-2 font-mono text-text-primary break-all">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
