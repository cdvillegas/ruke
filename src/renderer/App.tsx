import { useState, useEffect, useCallback, Component, type ReactNode } from 'react';
import { useUiStore } from './stores/uiStore';
import { useCollectionStore } from './stores/collectionStore';
import { useRequestStore } from './stores/requestStore';
import { useConnectionStore } from './stores/connectionStore';
import { RequestsView } from './components/requests/RequestsView';
import { RequestSidebar } from './components/requests/RequestSidebar';
import { ConnectionsSidebar, ConnectionsMain } from './components/connections/ConnectionsView';
import { EnvironmentsSidebar, EnvironmentsMain } from './components/environment/EnvironmentsView';
import { SettingsView } from './components/settings/SettingsView';
import { NavRail } from './components/layout/NavRail';
import { Onboarding } from './components/onboarding/Onboarding';
import { CommandPalette } from './components/layout/CommandPalette';
import { AgentPanel } from './components/requests/AgentPanel';
import { useEnvironmentStore } from './stores/environmentStore';
import { Sparkles } from 'lucide-react';

const AGENT_WIDTH_KEY = 'ruke:agent_panel_width';
const DEFAULT_AGENT_WIDTH = 380;
const MIN_AGENT_WIDTH = 280;
const MAX_AGENT_WIDTH = 700;

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', color: '#e8e8f0', background: '#0f0f1a', minHeight: '100vh' }}>
          <h1 style={{ color: '#ef4444', marginBottom: 16 }}>Something went wrong</h1>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#9898b8', fontSize: 13 }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#6868a0', fontSize: 11, marginTop: 12 }}>{this.state.error.stack}</pre>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{ marginTop: 24, padding: '8px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppInner() {
  const onboarding = useUiStore((s) => s.onboarding);
  const commandPaletteOpen = useUiStore((s) => s.commandPaletteOpen);
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const activeView = useUiStore((s) => s.activeView);
  const theme = useUiStore((s) => s.theme);
  const loadWorkspaces = useCollectionStore((s) => s.loadWorkspaces);
  const loadHistory = useRequestStore((s) => s.loadHistory);
  const loadConnections = useConnectionStore((s) => s.loadConnections);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ruke:theme', theme);
  }, [theme]);

  const activeWorkspaceId = useCollectionStore((s) => s.activeWorkspaceId);

  useEffect(() => {
    loadWorkspaces().then(() => {
      const wsId = useCollectionStore.getState().activeWorkspaceId;
      if (wsId) useEnvironmentStore.getState().loadEnvironments(wsId);
    });
    loadHistory();
    loadConnections();
    useRequestStore.getState().loadUncollectedRequests();
    useRequestStore.getState().loadArchivedRequests();
  }, []);

  useEffect(() => {
    if (activeWorkspaceId) useEnvironmentStore.getState().loadEnvironments(activeWorkspaceId);
  }, [activeWorkspaceId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        const { sendRequest } = useRequestStore.getState();
        const vars = useEnvironmentStore.getState().resolveVariables();
        sendRequest(vars);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        const { newRequest } = useRequestStore.getState();
        newRequest();
        useUiStore.getState().setActiveView('requests');
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        const { saveRequest } = useRequestStore.getState();
        saveRequest();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        useUiStore.getState().toggleAiPanel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen]);

  const sidebarWidth = useUiStore((s) => s.sidebarWidth);
  const setSidebarWidth = useUiStore((s) => s.setSidebarWidth);
  const saveSidebarWidth = useUiStore((s) => s.saveSidebarWidth);
  const showAgent = useUiStore((s) => s.aiPanelOpen);
  const toggleAgent = useUiStore((s) => s.toggleAiPanel);

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
      setSidebarWidth(useUiStore.getState().sidebarWidth + delta);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      saveSidebarWidth();
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [setSidebarWidth, saveSidebarWidth]);

  const handleAgentResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    let lastX = e.clientX;
    const onMove = (ev: MouseEvent) => {
      const delta = lastX - ev.clientX;
      lastX = ev.clientX;
      setAgentWidth(prev => Math.max(MIN_AGENT_WIDTH, Math.min(MAX_AGENT_WIDTH, prev + delta)));
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

  if (!onboarding.completed) {
    return <Onboarding />;
  }

  const hasSidebar = activeView !== 'settings';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-primary">
      <NavRail />
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="flex items-center justify-end px-4 py-2 border-b border-border shrink-0 bg-bg-secondary/40">
          <button
            onClick={toggleAgent}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              showAgent
                ? 'bg-accent/10 border-accent/30 text-accent'
                : 'bg-bg-tertiary border-border text-text-muted hover:bg-bg-hover hover:text-text-primary'
            }`}
          >
            <Sparkles size={12} />
            AI Assist
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden min-h-0">
          {hasSidebar && (
            <div className="flex shrink-0" style={{ width: sidebarWidth }}>
              <div className="flex-1 min-w-0 h-full flex flex-col bg-bg-secondary">
                {(activeView === 'chats' || activeView === 'requests') && <RequestSidebar />}
                {activeView === 'connections' && <ConnectionsSidebar />}
                {activeView === 'environments' && <EnvironmentsSidebar />}
              </div>
              <div
                onMouseDown={handleSidebarResize}
                className="w-1 bg-border hover:bg-accent/40 cursor-col-resize shrink-0 group flex items-center justify-center transition-colors"
              >
                <div className="h-8 w-0.5 rounded-full bg-text-muted/20 group-hover:bg-accent/60 transition-colors" />
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0 overflow-hidden">
            {(activeView === 'chats' || activeView === 'requests') && <RequestsView />}
            {activeView === 'connections' && <ConnectionsMain />}
            {activeView === 'environments' && <EnvironmentsMain />}
            {activeView === 'settings' && <SettingsView />}
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
        </div>
      </main>
      {commandPaletteOpen && <CommandPalette />}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
