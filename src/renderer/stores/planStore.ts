import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { Plan, PlanStep, PlanStatus, PlanStepStatus } from '@shared/types';

const STORAGE_KEY = 'ruke:plans';

function loadPlans(): Plan[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function savePlans(plans: Plan[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
}

function derivePlanStatus(steps: PlanStep[]): PlanStatus {
  if (steps.length === 0) return 'draft';
  if (steps.some(s => s.status === 'in_progress')) return 'in_progress';
  if (steps.every(s => s.status === 'done' || s.status === 'skipped')) return 'completed';
  if (steps.some(s => s.status === 'failed')) return 'failed';
  if (steps.some(s => s.status === 'done')) return 'in_progress';
  return 'draft';
}

interface PlanState {
  plans: Plan[];
  activePlanId: string | null;

  createPlan: (title: string, stepDescriptions: string[], chatSessionId: string) => Plan;
  updatePlanStep: (planId: string, stepId: string, status: PlanStepStatus) => void;
  updatePlanStatus: (planId: string, status: PlanStatus) => void;
  deletePlan: (planId: string) => void;
  setActivePlan: (planId: string | null) => void;
  getPlan: (planId: string) => Plan | undefined;
  getPlansForSession: (chatSessionId: string) => Plan[];
}

export const usePlanStore = create<PlanState>((set, get) => ({
  plans: loadPlans(),
  activePlanId: null,

  createPlan: (title, stepDescriptions, chatSessionId) => {
    const now = new Date().toISOString();
    const plan: Plan = {
      id: nanoid(),
      title,
      steps: stepDescriptions.map(desc => ({
        id: nanoid(),
        description: desc,
        status: 'pending' as PlanStepStatus,
      })),
      status: 'draft',
      chatSessionId,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [plan, ...get().plans];
    set({ plans: updated, activePlanId: plan.id });
    savePlans(updated);
    return plan;
  },

  updatePlanStep: (planId, stepId, status) => {
    const updated = get().plans.map(p => {
      if (p.id !== planId) return p;
      const steps = p.steps.map(s => s.id === stepId ? { ...s, status } : s);
      return { ...p, steps, status: derivePlanStatus(steps), updatedAt: new Date().toISOString() };
    });
    set({ plans: updated });
    savePlans(updated);
  },

  updatePlanStatus: (planId, status) => {
    const updated = get().plans.map(p =>
      p.id === planId ? { ...p, status, updatedAt: new Date().toISOString() } : p
    );
    set({ plans: updated });
    savePlans(updated);
  },

  deletePlan: (planId) => {
    const updated = get().plans.filter(p => p.id !== planId);
    const activePlanId = get().activePlanId === planId ? null : get().activePlanId;
    set({ plans: updated, activePlanId });
    savePlans(updated);
  },

  setActivePlan: (planId) => {
    set({ activePlanId: planId });
  },

  getPlan: (planId) => {
    return get().plans.find(p => p.id === planId);
  },

  getPlansForSession: (chatSessionId) => {
    return get().plans.filter(p => p.chatSessionId === chatSessionId);
  },
}));
