import { useState } from 'react';
import { useGrpcStore } from '../../stores/grpcStore';
import { useUiStore } from '../../stores/uiStore';
import { GrpcRequestBuilder } from './GrpcRequestBuilder';
import { GrpcResponseViewer } from '../response/GrpcResponseViewer';
import { ArrowLeft, X, Zap, ArrowUpDown, ArrowDown, ArrowUp } from 'lucide-react';
import type { GrpcMethodType } from '@shared/types';

const METHOD_ICONS: Record<GrpcMethodType, typeof Zap> = {
  unary: Zap,
  server_streaming: ArrowDown,
  client_streaming: ArrowUp,
  bidi_streaming: ArrowUpDown,
};

const METHOD_COLORS: Record<GrpcMethodType, string> = {
  unary: '#22c55e',
  server_streaming: '#3b82f6',
  client_streaming: '#f59e0b',
  bidi_streaming: '#a855f7',
};

export function GrpcRequestView() {
  const {
    openTabs, activeTabId, switchTab, closeTab,
    activeRequest, updateActiveRequest, sendRequest, response, loading,
    getProtoDefinition, loadProtoFromDialog,
  } = useGrpcStore();
  const { setActiveView } = useUiStore();

  const protoDef = getProtoDefinition();

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border bg-bg-secondary shrink-0">
        <button
          onClick={() => setActiveView('home')}
          className="px-3 py-2.5 text-text-muted hover:text-text-primary transition-colors border-r border-border"
          title="Back to Home"
        >
          <ArrowLeft size={15} />
        </button>
        <div className="flex-1 flex items-center overflow-x-auto">
          {openTabs.map((tab) => {
            const Icon = METHOD_ICONS[tab.methodType] || Zap;
            const color = METHOD_COLORS[tab.methodType] || '#6b7280';
            return (
              <div
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className={`group flex items-center gap-2 px-3 py-2.5 text-xs cursor-pointer border-r border-border shrink-0 transition-colors ${
                  tab.id === activeTabId
                    ? 'bg-bg-primary text-text-primary'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                }`}
              >
                <Icon size={11} style={{ color }} />
                <span
                  className="font-mono font-bold text-[10px] uppercase"
                  style={{ color }}
                >
                  gRPC
                </span>
                <span className="max-w-40 truncate">
                  {tab.methodName || tab.name || 'New gRPC Request'}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-bg-active transition-all"
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="overflow-y-auto p-5 pb-2">
          <GrpcRequestBuilder
            request={activeRequest}
            onUpdate={updateActiveRequest}
            onSend={sendRequest}
            onSave={() => {}}
            loading={loading}
            response={response}
            protoDefinition={protoDef}
            onLoadProto={loadProtoFromDialog}
          />
        </div>
        <div className="border-t border-border flex-1 overflow-hidden min-h-0">
          <GrpcResponseViewer response={response} loading={loading} />
        </div>
      </div>
    </div>
  );
}
