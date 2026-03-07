import { useState } from 'react';
import { useRequestStore } from '../../stores/requestStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useUiStore } from '../../stores/uiStore';
import { RequestBuilder } from './RequestBuilder';
import { ResponseViewer } from '../response/ResponseViewer';
import { RequestAI } from './RequestAI';
import { ArrowLeft, Sparkles, X } from 'lucide-react';

export function RequestView() {
  const { openTabs, activeTabId, switchTab, closeTab, activeRequest } = useRequestStore();
  const [showAI, setShowAI] = useState(false);
  const { setActiveView } = useUiStore();

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
