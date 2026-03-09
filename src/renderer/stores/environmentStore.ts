import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { Environment, EnvVariable, ResolvedVariable, VariableScope } from '@shared/types';
import { VARIABLE_REGEX } from '@shared/constants';

interface EnvironmentState {
  environments: Environment[];
  archivedEnvironments: Environment[];
  activeEnvironmentId: string | null;
  selectedEnvironmentId: string | null;
  variables: Map<string, EnvVariable[]>;

  setSelectedEnvironmentId: (id: string | null) => void;
  loadEnvironments: (workspaceId: string) => Promise<void>;
  createEnvironment: (workspaceId: string, name: string) => Promise<Environment>;
  setActiveEnvironment: (workspaceId: string, envId: string) => Promise<void>;
  deleteEnvironment: (id: string) => Promise<void>;
  archiveEnvironment: (id: string) => Promise<void>;
  unarchiveEnvironment: (id: string) => Promise<void>;
  duplicateEnvironment: (envId: string) => Promise<Environment>;
  renameEnvironment: (id: string, name: string) => Promise<void>;
  loadVariables: (environmentId: string) => Promise<void>;
  addVariable: (environmentId: string, key: string, value: string, scope?: VariableScope, isSecret?: boolean) => Promise<void>;
  updateVariable: (id: string, updates: Partial<EnvVariable>) => Promise<void>;
  deleteVariable: (id: string, environmentId: string) => Promise<void>;
  resolveVariables: () => Record<string, string>;
  getResolvedVariableDetails: () => ResolvedVariable[];
  resolveString: (str: string) => string;
  getEnvironmentVariables: (envId: string) => EnvVariable[];
  getAllVariableKeys: () => string[];
  reorderEnvironments: (orderedIds: string[]) => Promise<void>;
}

export const useEnvironmentStore = create<EnvironmentState>((set, get) => ({
  environments: [],
  archivedEnvironments: [],
  activeEnvironmentId: null,
  selectedEnvironmentId: null,
  variables: new Map(),

  setSelectedEnvironmentId: (id) => set({ selectedEnvironmentId: id }),
  loadEnvironments: async (workspaceId) => {
    try {
      const environments = await window.ruke.db.query('getEnvironments', workspaceId);
      const active = environments.find((e: Environment) => e.isActive);
      set({ environments, activeEnvironmentId: active?.id || null });
      for (const env of environments) {
        get().loadVariables(env.id);
      }
      try {
        const archived = await window.ruke.db.query('getArchivedEnvironments', workspaceId);
        set({ archivedEnvironments: Array.isArray(archived) ? archived : [] });
      } catch {}
    } catch { /* db not ready */ }
  },

  createEnvironment: async (workspaceId, name) => {
    const id = nanoid();
    const sortOrder = get().environments.length;
    const shouldActivate = !get().activeEnvironmentId;
    await window.ruke.db.query('createEnvironment', id, workspaceId, name, sortOrder);
    if (shouldActivate) {
      await window.ruke.db.query('setActiveEnvironment', workspaceId, id);
    }
    const env: Environment = {
      id, workspaceId, name, isActive: shouldActivate, sortOrder,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    set((s) => ({
      environments: [...s.environments, env],
      ...(shouldActivate ? { activeEnvironmentId: id } : {}),
    }));
    return env;
  },

  setActiveEnvironment: async (workspaceId, envId) => {
    await window.ruke.db.query('setActiveEnvironment', workspaceId, envId);
    set((s) => ({
      activeEnvironmentId: envId || null,
      environments: s.environments.map((e) => ({
        ...e,
        isActive: e.id === envId,
      })),
    }));
  },

  deleteEnvironment: async (id) => {
    await window.ruke.db.query('deleteEnvironment', id);
    set((s) => ({
      environments: s.environments.filter((e) => e.id !== id),
      archivedEnvironments: s.archivedEnvironments.filter((e) => e.id !== id),
      activeEnvironmentId: s.activeEnvironmentId === id ? null : s.activeEnvironmentId,
      selectedEnvironmentId: s.selectedEnvironmentId === id ? null : s.selectedEnvironmentId,
    }));
  },

  archiveEnvironment: async (id) => {
    await window.ruke.db.query('archiveEnvironment', id);
    const env = get().environments.find((e) => e.id === id);
    set((s) => ({
      environments: s.environments.filter((e) => e.id !== id),
      archivedEnvironments: env ? [...s.archivedEnvironments, { ...env, archived: true, isActive: false }] : s.archivedEnvironments,
      activeEnvironmentId: s.activeEnvironmentId === id ? null : s.activeEnvironmentId,
      selectedEnvironmentId: s.selectedEnvironmentId === id ? null : s.selectedEnvironmentId,
    }));
  },

  unarchiveEnvironment: async (id) => {
    await window.ruke.db.query('unarchiveEnvironment', id);
    const env = get().archivedEnvironments.find((e) => e.id === id);
    set((s) => ({
      archivedEnvironments: s.archivedEnvironments.filter((e) => e.id !== id),
      environments: env ? [...s.environments, { ...env, archived: false }] : s.environments,
    }));
  },

  duplicateEnvironment: async (envId) => {
    const source = get().environments.find((e) => e.id === envId);
    if (!source) throw new Error('Environment not found');
    const newEnv = await get().createEnvironment(source.workspaceId, `${source.name} (copy)`);
    const sourceVars = get().variables.get(envId) || [];
    for (const v of sourceVars) {
      await get().addVariable(newEnv.id, v.key, v.value, v.scope, v.isSecret);
    }
    return newEnv;
  },

  renameEnvironment: async (id, name) => {
    await window.ruke.db.query('updateEnvironment', id, { name });
    set((s) => ({
      environments: s.environments.map((e) => (e.id === id ? { ...e, name } : e)),
    }));
  },

  loadVariables: async (environmentId) => {
    try {
      const vars = await window.ruke.db.query('getVariables', environmentId);
      set((s) => {
        const newMap = new Map(s.variables);
        newMap.set(environmentId, vars);
        return { variables: newMap };
      });
    } catch { /* db not ready */ }
  },

  addVariable: async (environmentId, key, value, scope = 'global', isSecret = false) => {
    const v: EnvVariable = {
      id: nanoid(),
      environmentId,
      key,
      value,
      isSecret,
      scope,
      scopeId: null,
      createdAt: new Date().toISOString(),
    };
    await window.ruke.db.query('createVariable', v);
    set((s) => {
      const newMap = new Map(s.variables);
      const existing = newMap.get(environmentId) || [];
      newMap.set(environmentId, [...existing, v]);
      return { variables: newMap };
    });
  },

  updateVariable: async (id, updates) => {
    await window.ruke.db.query('updateVariable', id, updates);
    set((s) => {
      const newMap = new Map(s.variables);
      for (const [envId, vars] of newMap.entries()) {
        newMap.set(
          envId,
          vars.map((v) => (v.id === id ? { ...v, ...updates } : v))
        );
      }
      return { variables: newMap };
    });
  },

  deleteVariable: async (id, environmentId) => {
    await window.ruke.db.query('deleteVariable', id);
    set((s) => {
      const newMap = new Map(s.variables);
      const existing = newMap.get(environmentId) || [];
      newMap.set(environmentId, existing.filter((v) => v.id !== id));
      return { variables: newMap };
    });
  },

  resolveVariables: () => {
    const { activeEnvironmentId, variables } = get();
    if (!activeEnvironmentId) return {};
    const vars = variables.get(activeEnvironmentId) || [];
    const resolved: Record<string, string> = {};
    for (const v of vars) {
      resolved[v.key] = v.value;
    }
    return resolved;
  },

  getResolvedVariableDetails: () => {
    const { environments, activeEnvironmentId, variables } = get();
    if (!activeEnvironmentId) return [];
    const activeEnv = environments.find((e) => e.id === activeEnvironmentId);
    const vars = variables.get(activeEnvironmentId) || [];
    return vars.map((v) => ({
      key: v.key,
      value: v.isSecret ? '••••••••' : v.value,
      source: {
        scope: v.scope,
        environmentName: activeEnv?.name || 'Unknown',
      },
    }));
  },

  resolveString: (str) => {
    const resolved = get().resolveVariables();
    return str.replace(VARIABLE_REGEX, (_, key) => resolved[key.trim()] ?? `{{${key}}}`);
  },

  getEnvironmentVariables: (envId) => {
    return get().variables.get(envId) || [];
  },

  getAllVariableKeys: () => {
    const { activeEnvironmentId, variables } = get();
    if (!activeEnvironmentId) return [];
    const vars = variables.get(activeEnvironmentId) || [];
    return vars.map((v) => v.key).filter(Boolean);
  },

  reorderEnvironments: async (orderedIds) => {
    const updates = orderedIds.map((id, i) =>
      window.ruke.db.query('updateEnvironment', id, { sortOrder: i })
    );
    await Promise.all(updates);
    set((s) => ({
      environments: s.environments
        .map((e) => {
          const idx = orderedIds.indexOf(e.id);
          return idx >= 0 ? { ...e, sortOrder: idx } : e;
        })
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }));
  },
}));
