import { useUiStore } from '../../stores/uiStore';
import { MessageSquare, Zap, Plug, Layers, Settings } from 'lucide-react';
import type { AppView } from '@shared/types';

const MAIN_NAV: { id: AppView; icon: typeof MessageSquare; label: string }[] = [
  { id: 'chats', icon: MessageSquare, label: 'Chats' },
  { id: 'requests', icon: Zap, label: 'Requests' },
  { id: 'connections', icon: Plug, label: 'APIs' },
  { id: 'environments', icon: Layers, label: 'Environments' },
];

const BOTTOM_NAV: { id: AppView; icon: typeof MessageSquare; label: string }[] = [
  { id: 'settings', icon: Settings, label: 'Settings' },
];

function NavButton({ item, isActive, onClick }: {
  item: { id: AppView; icon: typeof MessageSquare; label: string };
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all group ${
        isActive
          ? 'bg-accent/15 text-accent'
          : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
      }`}
      title={item.label}
    >
      <item.icon size={18} />
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent rounded-r" />
      )}
    </button>
  );
}

export function NavRail() {
  const activeView = useUiStore((s) => s.activeView);
  const setActiveView = useUiStore((s) => s.setActiveView);

  return (
    <div className="w-14 flex flex-col items-center py-4 gap-1 border-r border-border bg-bg-secondary shrink-0">
      <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center mb-4">
        <span className="text-white text-sm font-bold">R</span>
      </div>

      {MAIN_NAV.map((item) => (
        <NavButton
          key={item.id}
          item={item}
          isActive={activeView === item.id}
          onClick={() => setActiveView(item.id)}
        />
      ))}

      <div className="mt-auto flex flex-col gap-1">
        {BOTTOM_NAV.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            isActive={activeView === item.id}
            onClick={() => setActiveView(item.id)}
          />
        ))}
      </div>
    </div>
  );
}
