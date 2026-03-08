import { useState, useRef, useCallback } from 'react';
import { useUiStore } from '../../stores/uiStore';
import { RequestBuilder } from '../request/RequestBuilder';
import { GrpcRequestView } from '../request/GrpcRequestView';
import { ResponseViewer } from '../response/ResponseViewer';
import { RequestSidebar } from './RequestSidebar';
import { AgentPanel } from './AgentPanel';
import { Sparkles } from 'lucide-react';

const AGENT_WIDTH_KEY = 'ruke:agent_panel_width';
const DEFAULT_AGENT_WIDTH = 380;
const MIN_AGENT_WIDTH = 280;
const MAX_AGENT_WIDTH = 700;

const SIDEBAR_WIDTH_KEY = 'ruke:sidebar_width';
const DEFAULT_SIDEBAR_WIDTH = 256;
const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 480;

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

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return stored ? Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, Number(stored))) : DEFAULT_SIDEBAR_WIDTH;
  });

  const [agentWidth, setAgentWidth] = useState(() => {
    const stored = localStorage.getItem(AGENT_WIDTH_KEY);
    return stored ? Math.max(MIN_AGENT_WIDTH, Math.min(MAX_AGENT_WIDTH, Number(stored))) : DEFAULT_AGENT_WIDTH;
  });

  const handleSidebarResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    let lastX = e.clientX;
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - lastX;
      lastX = ev.clientX;
      setSidebarWidth(prev => Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, prev + delta)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setSidebarWidth(prev => {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(prev));
        return prev;
      });
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

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
    <div className="h-full flex overflow-hidden">
      <div className="flex shrink-0" style={{ width: sidebarWidth }}>
        <RequestSidebar />
        <div
          onMouseDown={handleSidebarResize}
          className="w-1 bg-border hover:bg-accent/40 cursor-col-resize shrink-0 group flex items-center justify-center transition-colors"
        >
          <div className="h-8 w-0.5 rounded-full bg-text-muted/20 group-hover:bg-accent/60 transition-colors" />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {activeProtocol === 'grpc' ? (
            <GrpcRequestView />
          ) : (
            <ResizableSplit />
          )}
        </div>

        {showAgent && (
          <div className="flex shrink-0" style={{ width: agentWidth }}>
            {/* Drag handle */}
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
            className="absolute bottom-4 right-4 z-10 flex items-center gap-2 px-4 py-2.5 rounded-full bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/25 hover:shadow-accent/40 transition-all text-xs font-medium"
          >
            <Sparkles size={14} />
            AI Assist
          </button>
        )}
      </div>
    </div>
  );
}
