import { useUiStore } from '../../stores/uiStore';
import { useCollectionStore } from '../../stores/collectionStore';
import { useRequestStore } from '../../stores/requestStore';
import { EnvSwitcher } from '../environment/EnvSwitcher';
import { Sparkles, Command, Plus, Moon, Sun } from 'lucide-react';

export function TopBar() {
  const { theme, toggleTheme, toggleAiPanel, aiPanelOpen, setCommandPaletteOpen } = useUiStore();
  const activeWorkspace = useCollectionStore((s) => {
    const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
    return ws?.name || 'My Workspace';
  });
  const newRequest = useRequestStore((s) => s.newRequest);

  return (
    <div className="drag-region h-12 flex items-center justify-between border-b border-border bg-bg-secondary px-4 shrink-0">
      <div className="no-drag flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center">
            <span className="text-white text-xs font-bold">R</span>
          </div>
          <span className="text-sm font-semibold text-text-primary">{activeWorkspace}</span>
        </div>
      </div>

      <div className="no-drag flex items-center gap-1">
        <EnvSwitcher />
      </div>

      <div className="no-drag flex items-center gap-1">
        <button
          onClick={() => newRequest()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md bg-bg-tertiary hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
          title="New Request"
        >
          <Plus size={14} />
          <span>New</span>
        </button>

        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md bg-bg-tertiary hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
          title="Command Palette (⌘K)"
        >
          <Command size={14} />
          <span className="text-text-muted">⌘K</span>
        </button>

        <button
          onClick={toggleAiPanel}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-colors ${
            aiPanelOpen
              ? 'bg-accent text-white'
              : 'bg-bg-tertiary hover:bg-bg-hover text-text-secondary hover:text-text-primary'
          }`}
          title="AI Assistant (⌘I)"
        >
          <Sparkles size={14} />
          <span>AI</span>
        </button>

        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-md bg-bg-tertiary hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </div>
  );
}
