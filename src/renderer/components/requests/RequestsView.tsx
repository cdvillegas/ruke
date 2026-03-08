import { useState, useRef, useCallback } from 'react';
import { useUiStore } from '../../stores/uiStore';
import { useRequestStore } from '../../stores/requestStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { RequestBuilder } from '../request/RequestBuilder';
import { GrpcRequestView } from '../request/GrpcRequestView';
import { ResponseViewer } from '../response/ResponseViewer';
import { AgentPanel } from './AgentPanel';
import { Sparkles, Send, FolderPlus, Plus } from 'lucide-react';

const AGENT_WIDTH_KEY = 'ruke:agent_panel_width';
const DEFAULT_AGENT_WIDTH = 380;
const MIN_AGENT_WIDTH = 280;
const MAX_AGENT_WIDTH = 700;

function EmptyState() {
  const newRequest = useRequestStore((s) => s.newRequest);
  const createCollection = useCollectionStore((s) => s.createCollection);

  const handleNewCollection = async () => {
    await createCollection('New Collection');
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-5">
          <Send size={24} className="text-accent" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">
          No request selected
        </h2>
        <p className="text-sm text-text-muted mb-8 leading-relaxed">
          Create a new request to start exploring your APIs, or organize your work with collections.
        </p>

        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => newRequest()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-medium text-sm transition-colors shadow-lg shadow-accent/20"
          >
            <Plus size={16} />
            New Request
          </button>
          <button
            onClick={handleNewCollection}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-bg-tertiary hover:bg-bg-hover border border-border text-text-secondary hover:text-text-primary font-medium text-sm transition-colors"
          >
            <FolderPlus size={16} />
            New Collection
          </button>
        </div>

        <div className="flex flex-col gap-2 text-[11px] text-text-muted/60">
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 rounded bg-bg-tertiary border border-border/60 font-mono text-[10px]">
              &#8984;N
            </kbd>
            <span>New request</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 rounded bg-bg-tertiary border border-border/60 font-mono text-[10px]">
              &#8984;K
            </kbd>
            <span>Command palette</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResizableSplit() {
  const [topRatio, setTopRatio] = useState(0.45);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDrag = useCallback((deltaY: number) => {
    if (!containerRef.current) return;
    const h = containerRef.current.getBoundingClientRect().height;
    if (h === 0) return;
    setTopRatio(prev => Math.max(0.15, Math.min(0.85, prev + deltaY / h)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    let lastY = e.clientY;
    const onMove = (ev: MouseEvent) => {
      handleDrag(ev.clientY - lastY);
      lastY = ev.clientY;
    };
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
  }, [handleDrag]);

  return (
    <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden">
      <div className="overflow-y-auto p-5 pb-2" style={{ height: `${topRatio * 100}%` }}>
        <RequestBuilder />
      </div>
      <div
        onMouseDown={handleMouseDown}
        className="h-1 bg-border hover:bg-accent/40 cursor-row-resize shrink-0 group flex items-center justify-center transition-colors"
      >
        <div className="w-8 h-0.5 rounded-full bg-text-muted/20 group-hover:bg-accent/60 transition-colors" />
      </div>
      <div className="flex-1 overflow-hidden min-h-0">
        <ResponseViewer />
      </div>
    </div>
  );
}

export function RequestsView() {
  const activeProtocol = useUiStore((s) => s.activeProtocol);
  const showAgent = useUiStore((s) => s.aiPanelOpen);
  const toggleAgent = useUiStore((s) => s.toggleAiPanel);
  const hasActiveRequest = useRequestStore((s) => s.hasSelection);

  const [agentWidth, setAgentWidth] = useState(() => {
    const stored = localStorage.getItem(AGENT_WIDTH_KEY);
    return stored ? Math.max(MIN_AGENT_WIDTH, Math.min(MAX_AGENT_WIDTH, Number(stored))) : DEFAULT_AGENT_WIDTH;
  });

  const handleAgentResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    let lastX = e.clientX;
    const onMove = (ev: MouseEvent) => {
      const delta = lastX - ev.clientX;
      lastX = ev.clientX;
      setAgentWidth(prev => {
        const next = Math.max(MIN_AGENT_WIDTH, Math.min(MAX_AGENT_WIDTH, prev + delta));
        return next;
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setAgentWidth(prev => {
        localStorage.setItem(AGENT_WIDTH_KEY, String(prev));
        return prev;
      });
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  return (
    <div className="h-full flex overflow-hidden relative">
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {!hasActiveRequest ? (
          <EmptyState />
        ) : activeProtocol === 'grpc' ? (
          <GrpcRequestView />
        ) : (
          <ResizableSplit />
        )}
      </div>

      {showAgent && (
        <div className="flex shrink-0" style={{ width: agentWidth }}>
          <div
            onMouseDown={handleAgentResize}
            className="w-1 bg-border hover:bg-accent/40 cursor-col-resize shrink-0 group flex items-center justify-center transition-colors"
          >
            <div className="h-8 w-0.5 rounded-full bg-text-muted/20 group-hover:bg-accent/60 transition-colors" />
          </div>
          <div className="flex-1 min-w-0">
            <AgentPanel />
          </div>
        </div>
      )}

      {!showAgent && (
        <button
          onClick={toggleAgent}
          className="ai-assist-fab absolute bottom-5 right-5 z-10 flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-semibold tracking-wide transition-all duration-300 hover:scale-105 active:scale-95"
        >
          <Sparkles size={14} className="ai-assist-icon" />
          AI Assist
        </button>
      )}
    </div>
  );
}
