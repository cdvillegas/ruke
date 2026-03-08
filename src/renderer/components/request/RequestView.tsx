import { useState, useRef, useCallback } from 'react';
import { useRequestStore } from '../../stores/requestStore';
import { useUiStore } from '../../stores/uiStore';
import { RequestBuilder } from './RequestBuilder';
import { GrpcRequestView } from './GrpcRequestView';
import { ResponseViewer } from '../response/ResponseViewer';
import { ArrowLeft, X, Plus } from 'lucide-react';

function ResizableHandle({ onDrag }: { onDrag: (deltaY: number) => void }) {
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const onMove = (ev: MouseEvent) => onDrag(ev.clientY - startY);
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [onDrag]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className="h-1 bg-border hover:bg-accent/40 cursor-row-resize shrink-0 group flex items-center justify-center transition-colors"
    >
      <div className="w-8 h-0.5 rounded-full bg-text-muted/20 group-hover:bg-accent/60 transition-colors" />
    </div>
  );
}

export function RequestView() {
  const openTabs = useRequestStore((s) => s.openTabs);
  const activeTabId = useRequestStore((s) => s.activeTabId);
  const switchTab = useRequestStore((s) => s.switchTab);
  const closeTab = useRequestStore((s) => s.closeTab);
  const newRequest = useRequestStore((s) => s.newRequest);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const activeProtocol = useUiStore((s) => s.activeProtocol);
  const [topRatio, setTopRatio] = useState(0.45);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDrag = useCallback((deltaY: number) => {
    if (!containerRef.current) return;
    const h = containerRef.current.getBoundingClientRect().height;
    if (h === 0) return;
    setTopRatio(prev => Math.max(0.15, Math.min(0.85, prev + deltaY / h)));
  }, []);

  if (activeProtocol === 'grpc') {
    return <GrpcRequestView />;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border bg-bg-secondary shrink-0">
        <button
          onClick={() => setActiveView('chats')}
          className="px-3 py-2.5 text-text-muted hover:text-text-primary transition-colors border-r border-border"
          title="Back to Chats"
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
              {openTabs.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-bg-active transition-all"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => newRequest()}
            className="px-2.5 py-2.5 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors shrink-0"
            title="New Request"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden" ref={containerRef}>
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="overflow-y-auto p-5 pb-2" style={{ height: `${topRatio * 100}%` }}>
            <RequestBuilder />
          </div>
          <ResizableHandle onDrag={handleDrag} />
          <div className="flex-1 overflow-hidden min-h-0">
            <ResponseViewer />
          </div>
        </div>
      </div>
    </div>
  );
}
