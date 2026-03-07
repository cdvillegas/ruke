import { create } from 'zustand';
import type { AppView, OnboardingState } from '@shared/types';

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
  sidebarWidth: number;
  aiPanelOpen: boolean;
  aiPanelWidth: number;
  activeRequestTab: string;
  activeResponseTab: string;
  commandPaletteOpen: boolean;
  theme: 'dark' | 'light';
  onboarding: OnboardingState;

  setActiveView: (view: AppView) => void;
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
}

export const useUiStore = create<UiState>((set) => ({
  activeView: 'home',
  sidebarWidth: 260,
  aiPanelOpen: false,
  aiPanelWidth: 360,
  activeRequestTab: 'params',
  activeResponseTab: 'body',
  commandPaletteOpen: false,
  theme: (localStorage.getItem('ruke:theme') === 'light' ? 'light' : 'dark') as 'dark' | 'light',
  onboarding: loadOnboarding(),

  setActiveView: (view) => set({ activeView: view }),
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
}));
