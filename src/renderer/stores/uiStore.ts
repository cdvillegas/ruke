import { create } from 'zustand';
import type { AppView, OnboardingState, ProtocolType } from '@shared/types';
import { useChatStore } from './chatStore';

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

const AI_CREATED_KEY = 'ruke:ai_created';

function loadAiCreated(): string[] {
  try {
    const saved = localStorage.getItem(AI_CREATED_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

function saveAiCreated(items: string[]) {
  localStorage.setItem(AI_CREATED_KEY, JSON.stringify(items));
}

const SIDEBAR_WIDTH_KEY = 'ruke:sidebar_width';
const DEFAULT_SIDEBAR_WIDTH = 256;
const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 480;

function loadSidebarWidth(): number {
  try {
    const stored = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (stored) return Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, Number(stored)));
  } catch {}
  return DEFAULT_SIDEBAR_WIDTH;
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
  aiCreatedItems: string[];

  setActiveView: (view: AppView) => void;
  setActiveProtocol: (protocol: ProtocolType) => void;
  setSidebarWidth: (w: number) => void;
  saveSidebarWidth: () => void;
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
  markAiCreated: (id: string) => void;
  clearAiCreated: (id: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeView: 'requests',
  activeProtocol: 'rest' as ProtocolType,
  sidebarWidth: loadSidebarWidth(),
  aiPanelOpen: false,
  aiPanelWidth: 360,
  activeRequestTab: 'params',
  activeResponseTab: 'body',
  commandPaletteOpen: false,
  theme: (localStorage.getItem('ruke:theme') === 'light' ? 'light' : 'dark') as 'dark' | 'light',
  onboarding: loadOnboarding(),
  aiModeEnabled: localStorage.getItem('ruke:ai_mode') !== 'false',
  viewBadges: {},
  aiCreatedItems: loadAiCreated(),

  setActiveView: (view) => set((s) => ({
    activeView: view,
    viewBadges: { ...s.viewBadges, [view]: 0 },
  })),
  setActiveProtocol: (protocol) => set({ activeProtocol: protocol }),
  setSidebarWidth: (w) => set({ sidebarWidth: Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, w)) }),
  saveSidebarWidth: () => {
    const { sidebarWidth } = useUiStore.getState();
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
  },
  toggleAiPanel: () => {
    const opening = !useUiStore.getState().aiPanelOpen;
    if (opening && useChatStore.getState().openTabIds.length === 0) {
      useChatStore.getState().newChat();
    }
    set({ aiPanelOpen: opening });
  },
  setAiPanelOpen: (open) => {
    if (open && useChatStore.getState().openTabIds.length === 0) {
      useChatStore.getState().newChat();
    }
    set({ aiPanelOpen: open });
  },
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
  markAiCreated: (id) => set((s) => {
    if (s.aiCreatedItems.includes(id)) return {};
    const next = [...s.aiCreatedItems, id];
    saveAiCreated(next);
    return { aiCreatedItems: next };
  }),
  clearAiCreated: (id) => set((s) => {
    const next = s.aiCreatedItems.filter(i => i !== id);
    saveAiCreated(next);
    return { aiCreatedItems: next };
  }),
}));
