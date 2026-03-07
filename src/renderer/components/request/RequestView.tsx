import { useState } from 'react';
import { useRequestStore } from '../../stores/requestStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useUiStore } from '../../stores/uiStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { RequestBuilder } from './RequestBuilder';
import { GrpcRequestView } from './GrpcRequestView';
import { ResponseViewer } from '../response/ResponseViewer';
import { RequestAI } from './RequestAI';
import { ApiExplorer } from './ApiExplorer';
import { ArrowLeft, Sparkles, X, Plug } from 'lucide-react';

export function RequestView() {
  const { openTabs, activeTabId, switchTab, closeTab, activeRequest } = useRequestStore();
  const [showAI, setShowAI] = useState(false);
  const [showExplorer, setShowExplorer] = useState(() => {
    const saved = localStorage.getItem('ruke:explorer_open');
    return saved === null ? true : saved === 'true';
  });
  const { setActiveView, activeProtocol } = useUiStore();
  const connectionCount = useConnectionStore((s) => s.connections.length);

  const toggleExplorer = () => {
    const next = !showExplorer;
    setShowExplorer(next);
    localStorage.setItem('ruke:explorer_open', String(next));
  };

  if (activeProtocol === 'grpc') {
    return <GrpcRequestView />;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tab bar + back button */}
      <div className="flex items-center border-b border-border bg-bg-secondary shrink-0">
        <button
          onClick={() => setActiveView('home')}
          className="px-3 py-2.5 text-text-muted hover:text-text-primary transition-colors border-r border-border"
          title="Back to Home"
        >
          <ArrowLeft size={15} />
        </button>
        <button
          onClick={toggleExplorer}
          className={`relative px-3 py-2.5 transition-colors border-r border-border ${
            showExplorer ? 'text-accent bg-accent/10' : 'text-text-muted hover:text-accent'
          }`}
          title="API Explorer"
        >
          <Plug size={15} />
          {connectionCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-accent text-white text-[7px] flex items-center justify-center font-bold">
              {connectionCount}
            </span>
          )}
        </button>
        <div className="flex-1 flex items-center overflow-x-auto">
          {openTabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`group flex items-center gap-2 px-3 py-2.5 text-xs cursor-pointer border-r border-border shrink-0 transition-colors ${
                tab.id === activeTabId
                  ? 'bg-bg-primary text-text-primary'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`}
            >
              <span
                className="font-mono font-bold text-[10px]"
                style={{ color: ({
                  GET: '#22c55e', POST: '#f59e0b', PUT: '#3b82f6',
                  PATCH: '#a855f7', DELETE: '#ef4444'
                } as Record<string, string>)[tab.method] || '#6b7280' }}
              >
                {tab.method}
              </span>
              <span className="max-w-40 truncate">{tab.name || tab.url || 'New Request'}</span>
              <button
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-bg-active transition-all"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => setShowAI(!showAI)}
          className={`px-3 py-2.5 transition-colors border-l border-border ${
            showAI ? 'text-accent bg-accent/10' : 'text-text-muted hover:text-accent'
          }`}
          title="AI Assist"
        >
          <Sparkles size={15} />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {showExplorer && <ApiExplorer onClose={toggleExplorer} />}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="overflow-y-auto p-5 pb-2">
            <RequestBuilder />
          </div>
          <div className="border-t border-border flex-1 overflow-hidden min-h-0">
            <ResponseViewer />
          </div>
        </div>
        {showAI && <RequestAI onClose={() => setShowAI(false)} />}
      </div>
    </div>
  );
}
