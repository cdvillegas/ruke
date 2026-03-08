import { useState, useRef, useCallback } from 'react';
import { useUiStore } from '../../stores/uiStore';
import { useRequestStore } from '../../stores/requestStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { RequestBuilder } from '../request/RequestBuilder';
import { GrpcRequestView } from '../request/GrpcRequestView';
import { ResponseViewer } from '../response/ResponseViewer';
import { Send, FolderPlus, Plus } from 'lucide-react';

function EmptyState() {
  const newRequest = useRequestStore((s) => s.newRequest);
  const createCollection = useCollectionStore((s) => s.createCollection);

  const handleNewCollection = async () => {
    await createCollection('New Collection');
  };

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-full max-w-md px-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-bg-secondary border border-border/60 flex items-center justify-center mb-3">
            <Send size={18} className="text-text-muted" />
          </div>
          <h3 className="text-base font-semibold text-text-primary mb-1">No request selected</h3>
          <p className="text-[11px] text-text-muted/70 text-center">
            Create a new request to start exploring your APIs, or organize your work with collections
          </p>
        </div>

        <button
          onClick={() => newRequest()}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-bg-secondary border border-border hover:border-accent/30 hover:bg-bg-hover transition-all text-left group"
        >
          <div className="w-8 h-8 rounded-lg bg-accent/10 group-hover:bg-accent/15 flex items-center justify-center shrink-0 transition-colors">
            <Plus size={14} className="text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-text-primary">New request</p>
            <p className="text-[10px] text-text-muted/60 mt-0.5">Start with a blank HTTP request</p>
          </div>
        </button>

        <button
          onClick={handleNewCollection}
          className="w-full flex items-center gap-3 px-4 py-3 mt-2 rounded-xl bg-bg-secondary border border-border hover:border-accent/30 hover:bg-bg-hover transition-all text-left group"
        >
          <div className="w-8 h-8 rounded-lg bg-bg-tertiary/60 group-hover:bg-accent/10 flex items-center justify-center shrink-0 transition-colors">
            <FolderPlus size={14} className="text-text-muted/50 group-hover:text-accent/70 transition-colors" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-text-primary">New collection</p>
            <p className="text-[10px] text-text-muted/60 mt-0.5">Organize requests into groups</p>
          </div>
        </button>

        <div className="flex items-center justify-center gap-8 mt-5 text-xs text-text-muted/60">
          <div className="flex items-center gap-1.5">
            <kbd className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-bg-tertiary border border-border/60 font-mono"><span className="text-[13px] leading-none">&#8984;</span><span className="text-[11px] leading-none">N</span></kbd>
            <span>New request</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-bg-tertiary border border-border/60 font-mono"><span className="text-[13px] leading-none">&#8984;</span><span className="text-[11px] leading-none">K</span></kbd>
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
  const hasActiveRequest = useRequestStore((s) => s.hasSelection);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {!hasActiveRequest ? (
        <EmptyState />
      ) : activeProtocol === 'grpc' ? (
        <GrpcRequestView />
      ) : (
        <ResizableSplit />
      )}
    </div>
  );
}
