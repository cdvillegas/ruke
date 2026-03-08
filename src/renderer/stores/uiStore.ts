import { create } from 'zustand';
import type { AppView, OnboardingState, ProtocolType } from '@shared/types';

function loadOnboarding(): OnboardingState {
  try {
    const saved = localStorage.getItem('ruke:onboarding');
    if (saved) return JSON.parse(saved);
  } catch {}
  return { completed: false, currentStep: 0, previousTool: null };
}

function saveOnboarding(state: OnboardingState) {
  localStorage.setItem('ruke:onboarding', JSON.stringify(state));
}

interface UiState {
  activeView: AppView;
  activeProtocol: ProtocolType;
  sidebarWidth: number;
  aiPanelOpen: boolean;
  aiPanelWidth: number;
  activeRequestTab: string;
  activeResponseTab: string;
  commandPaletteOpen: boolean;
  theme: 'dark' | 'light';
  onboarding: OnboardingState;
  aiModeEnabled: boolean;
  viewBadges: Partial<Record<AppView, number>>;

  setActiveView: (view: AppView) => void;
  setActiveProtocol: (protocol: ProtocolType) => void;
  setSidebarWidth: (w: number) => void;
  toggleAiPanel: () => void;
  setAiPanelOpen: (open: boolean) => void;
  setActiveRequestTab: (tab: string) => void;
  setActiveResponseTab: (tab: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleTheme: () => void;
  setOnboarding: (state: Partial<OnboardingState>) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  setAiMode: (enabled: boolean) => void;
  toggleAiMode: () => void;
  incrementBadge: (view: AppView) => void;
  clearBadge: (view: AppView) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeView: 'requests',
  activeProtocol: 'rest' as ProtocolType,
  sidebarWidth: 260,
  aiPanelOpen: false,
  aiPanelWidth: 360,
  activeRequestTab: 'params',
  activeResponseTab: 'body',
  commandPaletteOpen: false,
  theme: (localStorage.getItem('ruke:theme') === 'light' ? 'light' : 'dark') as 'dark' | 'light',
  onboarding: loadOnboarding(),
  aiModeEnabled: localStorage.getItem('ruke:ai_mode') !== 'false',
  viewBadges: {},

  setActiveView: (view) => set((s) => ({
    activeView: view,
    viewBadges: { ...s.viewBadges, [view]: 0 },
  })),
  setActiveProtocol: (protocol) => set({ activeProtocol: protocol }),
  setSidebarWidth: (w) => set({ sidebarWidth: w }),
  toggleAiPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen })),
  setAiPanelOpen: (open) => set({ aiPanelOpen: open }),
  setActiveRequestTab: (tab) => set({ activeRequestTab: tab }),
  setActiveResponseTab: (tab) => set({ activeResponseTab: tab }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
  setOnboarding: (state) =>
    set((s) => {
      const updated = { ...s.onboarding, ...state };
      saveOnboarding(updated);
      return { onboarding: updated };
    }),
  completeOnboarding: () => {
    const final: OnboardingState = { completed: true, currentStep: 999, previousTool: null };
    saveOnboarding(final);
    set({ onboarding: final });
  },
  resetOnboarding: () => {
    const initial: OnboardingState = { completed: false, currentStep: 0, previousTool: null };
    saveOnboarding(initial);
    set({ onboarding: initial });
  },
  setAiMode: (enabled) => {
    localStorage.setItem('ruke:ai_mode', String(enabled));
    set({ aiModeEnabled: enabled });
  },
  toggleAiMode: () => set((s) => {
    const next = !s.aiModeEnabled;
    localStorage.setItem('ruke:ai_mode', String(next));
    return { aiModeEnabled: next };
  }),
  incrementBadge: (view) => set((s) => {
    if (s.activeView === view) return {};
    return { viewBadges: { ...s.viewBadges, [view]: (s.viewBadges[view] || 0) + 1 } };
  }),
  clearBadge: (view) => set((s) => ({
    viewBadges: { ...s.viewBadges, [view]: 0 },
  })),
}));
