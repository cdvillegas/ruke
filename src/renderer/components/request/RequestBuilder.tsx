import { useRequestStore } from '../../stores/requestStore';
import { useEnvironmentStore } from '../../stores/environmentStore';
import { useUiStore } from '../../stores/uiStore';
import { ParamsEditor } from './ParamsEditor';
import { HeadersEditor } from './HeadersEditor';
import { BodyEditor } from './BodyEditor';
import { AuthEditor } from './AuthEditor';
import { HTTP_METHODS, METHOD_COLORS } from '@shared/constants';
import type { HttpMethod } from '@shared/types';
import { Send, Loader2, Save } from 'lucide-react';

export function RequestBuilder() {
  const { activeRequest, setMethod, setUrl, loading, sendRequest, saveRequest } = useRequestStore();
  const resolveVariables = useEnvironmentStore((s) => s.resolveVariables);
  const resolveString = useEnvironmentStore((s) => s.resolveString);
  const { activeRequestTab, setActiveRequestTab } = useUiStore();

  const handleSend = () => {
    const vars = resolveVariables();
    sendRequest(vars);
  };

  const resolvedUrl = resolveString(activeRequest.url);
  const hasVariables = activeRequest.url !== resolvedUrl && activeRequest.url.includes('{{');

  const tabs = [
    { id: 'params', label: 'Params', count: activeRequest.params.filter((p) => p.enabled && p.key).length },
    { id: 'headers', label: 'Headers', count: activeRequest.headers.filter((h) => h.enabled && h.key).length },
    { id: 'body', label: 'Body', badge: activeRequest.body.type !== 'none' ? activeRequest.body.type : undefined },
    { id: 'auth', label: 'Auth', badge: activeRequest.auth.type !== 'none' ? activeRequest.auth.type : undefined },
  ];

  return (
    <div className="space-y-4">
      {/* URL Bar */}
      <div className="flex gap-2">
        <select
          value={activeRequest.method}
          onChange={(e) => setMethod(e.target.value as HttpMethod)}
          className="px-3 py-2.5 rounded-lg bg-bg-tertiary border border-border text-sm font-mono font-bold focus:outline-none focus:border-accent transition-colors cursor-pointer"
          style={{ color: METHOD_COLORS[activeRequest.method] || '#9898b8' }}
        >
          {HTTP_METHODS.map((m) => (
            <option key={m} value={m} style={{ color: METHOD_COLORS[m] }}>
              {m}
            </option>
          ))}
        </select>

        <div className="flex-1 relative">
          <input
            type="text"
            value={activeRequest.url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Enter URL or paste cURL..."
            className="w-full px-4 py-2.5 rounded-lg bg-bg-tertiary border border-border text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
          />
          {hasVariables && (
            <div className="absolute -bottom-5 left-0 text-[10px] text-text-muted font-mono truncate max-w-full">
              {resolvedUrl}
            </div>
          )}
        </div>

        <button
          onClick={() => saveRequest()}
          className="px-3 py-2.5 rounded-lg bg-bg-tertiary border border-border hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
          title="Save Request (⌘S)"
        >
          <Save size={16} />
        </button>

        <button
          onClick={handleSend}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
          <span>Send</span>
        </button>
      </div>

      {/* Tabs */}
      <div className={`${hasVariables ? 'mt-6' : ''}`}>
        <div className="flex gap-0.5 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveRequestTab(tab.id)}
              className={`px-4 py-2 text-xs font-medium transition-colors relative ${
                activeRequestTab === tab.id
                  ? 'text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-accent/20 text-accent text-[10px]">
                  {tab.count}
                </span>
              )}
              {tab.badge && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-warning/20 text-warning text-[10px]">
                  {tab.badge}
                </span>
              )}
              {activeRequestTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
              )}
            </button>
          ))}
        </div>

        <div className="pt-3">
          {activeRequestTab === 'params' && <ParamsEditor />}
          {activeRequestTab === 'headers' && <HeadersEditor />}
          {activeRequestTab === 'body' && <BodyEditor />}
          {activeRequestTab === 'auth' && <AuthEditor />}
        </div>
      </div>
    </div>
  );
}
