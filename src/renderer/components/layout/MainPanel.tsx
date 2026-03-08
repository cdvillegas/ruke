import { useUiStore } from '../../stores/uiStore';
import { useRequestStore } from '../../stores/requestStore';
import { RequestBuilder } from '../request/RequestBuilder';
import { ResponseViewer } from '../response/ResponseViewer';
import { HistoryView } from '../history/HistoryView';
import { EnvEditor } from '../environment/EnvEditor';
import { SettingsView } from '../settings/SettingsView';
import { X } from 'lucide-react';

export function MainPanel() {
  const activeView = useUiStore((s) => s.activeView);
  const openTabs = useRequestStore((s) => s.openTabs);
  const activeTabId = useRequestStore((s) => s.activeTabId);
  const switchTab = useRequestStore((s) => s.switchTab);
  const closeTab = useRequestStore((s) => s.closeTab);

  if (activeView === 'history') return <HistoryView />;
  if (activeView === 'environments') return <EnvEditor />;
  if (activeView === 'settings') return <SettingsView />;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab Bar */}
      <div className="flex items-center border-b border-border bg-bg-secondary overflow-x-auto shrink-0">
        {openTabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            className={`group relative flex items-center gap-2 px-3 py-2 text-xs cursor-pointer border-r border-border shrink-0 transition-colors ${
              tab.id === activeTabId
                ? 'bg-bg-primary text-text-primary border-b-2 border-b-accent'
                : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            }`}
          >
            <span
              className={`font-mono font-bold text-[10px] ${
                ({
                  GET: 'text-method-get',
                  POST: 'text-method-post',
                  PUT: 'text-method-put',
                  PATCH: 'text-method-patch',
                  DELETE: 'text-method-delete',
                } as Record<string, string>)[tab.method] || 'text-text-muted'
              }`}
            >
              {tab.method}
            </span>
            <span className="max-w-32 truncate">{tab.name || tab.url || 'New Request'}</span>
            <span
              className="absolute right-0 top-0 bottom-0 flex items-center pr-1.5 pl-4 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                background: tab.id === activeTabId
                  ? 'linear-gradient(to right, transparent, var(--color-bg-primary) 40%)'
                  : 'linear-gradient(to right, transparent, var(--color-bg-secondary) 40%)',
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="p-0.5 rounded hover:bg-bg-active transition-colors text-text-muted hover:text-text-primary"
              >
                <X size={12} />
              </button>
            </span>
          </div>
        ))}
      </div>

      {/* Request + Response Split */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4">
          <RequestBuilder />
        </div>
        <div className="border-t border-border flex-1 overflow-hidden">
          <ResponseViewer />
        </div>
      </div>
    </div>
  );
}
