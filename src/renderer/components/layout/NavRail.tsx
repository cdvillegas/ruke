import { useUiStore } from '../../stores/uiStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { Home, Plug, Settings, Zap } from 'lucide-react';
import type { AppView } from '@shared/types';

const NAV: { id: AppView; icon: typeof Home; label: string }[] = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'connections', icon: Plug, label: 'APIs' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

export function NavRail() {
  const { activeView, setActiveView } = useUiStore();
  const connectionCount = useConnectionStore((s) => s.connections.length);

  return (
    <div className="w-14 flex flex-col items-center py-4 gap-1 border-r border-border bg-bg-secondary shrink-0">
      <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center mb-4">
        <span className="text-white text-sm font-bold">R</span>
      </div>

      {NAV.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveView(item.id)}
          className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all group ${
            activeView === item.id
              ? 'bg-accent/15 text-accent'
              : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
          }`}
          title={item.label}
        >
          <item.icon size={18} />
          {item.id === 'connections' && connectionCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent text-white text-[9px] flex items-center justify-center font-bold">
              {connectionCount}
            </span>
          )}
          {activeView === item.id && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent rounded-r" />
          )}
        </button>
      ))}

      <div className="flex-1" />

      <button
        onClick={() => setActiveView('home')}
        className="w-10 h-10 rounded-xl flex items-center justify-center text-text-muted hover:text-accent hover:bg-accent/10 transition-all"
        title="New request (⌘K)"
      >
        <Zap size={18} />
      </button>
    </div>
  );
}
