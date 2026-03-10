import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type {
  Workflow,
  WorkflowStep,
  WorkflowInput,
  WorkflowStepExtraction,
  WorkflowRun,
  WorkflowRunResult,
  WorkflowRunEntry,
  ApiRequest,
  AuthConfig,
  HttpMethod,
} from '@shared/types';
import { useCollectionStore } from './collectionStore';
import { useConnectionStore } from './connectionStore';
import { useEnvironmentStore } from './environmentStore';

function getResolvedUrl(
  req: ApiRequest,
  getConnection: (id: string) => { id: string; baseUrl: string } | undefined,
  resolveString: (str: string) => string,
  resolvedVariables: Record<string, string>
): string {
  let resolved = req.url;
  if (req.connectionId) {
    const conn = getConnection(req.connectionId);
    if (conn) {
      const base = resolveString(conn.baseUrl).replace(/\/+$/, '');
      const path = req.url.startsWith('/') ? req.url : `/${req.url}`;
      resolved = req.url.startsWith('http') ? req.url : `${base}${path}`;
    }
  }
  for (const p of req.params) {
    if (p.enabled && p.key && p.value && resolved.includes(`{${p.key}}`)) {
      const val = p.value.replace(/\{\{([^}]+)\}\}/g, (_, key) =>
        resolvedVariables[key.trim()] ?? `{{${key}}}`
      );
      resolved = resolved.replace(`{${p.key}}`, encodeURIComponent(val));
    }
  }
  resolved = resolveString(resolved);
  return resolved;
}

function getEffectiveAuth(
  req: ApiRequest,
  getConnection: (id: string) => { auth: AuthConfig } | undefined
): AuthConfig {
  if (req.auth.type !== 'none') return req.auth;
  if (req.connectionId) {
    const conn = getConnection(req.connectionId);
    if (conn && conn.auth?.type !== 'none') return conn.auth;
  }
  return req.auth;
}

interface WorkflowState {
  workflows: Workflow[];
  archivedWorkflows: Workflow[];
  selectedWorkflowId: string | null;
  steps: WorkflowStep[];
  stepExtractions: Record<string, WorkflowStepExtraction[]>;
  inputs: WorkflowInput[];
  lastRunResult: WorkflowRunResult | null;
  runHistory: WorkflowRun[];
  running: boolean;

  loadWorkflows: (workspaceId: string) => Promise<void>;
  createWorkflow: (workspaceId: string, name: string, collectionId?: string | null) => Promise<Workflow>;
  selectWorkflow: (id: string | null) => Promise<void>;
  loadSteps: (workflowId: string) => Promise<void>;
  loadInputs: (workflowId: string) => Promise<void>;
  addInput: (workflowId: string, key: string, label?: string, defaultValue?: string, isSecret?: boolean) => Promise<void>;
  removeInput: (workflowId: string, inputId: string) => Promise<void>;
  updateWorkflowInput: (inputId: string, data: Partial<WorkflowInput>) => Promise<void>;
  reorderWorkflowInputs: (workflowId: string, inputIdsInOrder: string[]) => Promise<void>;
  addStep: (workflowId: string, requestId: string) => Promise<void>;
  removeStep: (workflowId: string, stepId: string) => Promise<void>;
  reorderSteps: (workflowId: string, stepIdsInOrder: string[]) => Promise<void>;
  loadStepExtractions: (workflowId: string) => Promise<void>;
  addExtraction: (stepId: string, variableName: string, jsonPath: string) => Promise<void>;
  removeExtraction: (extractionId: string) => Promise<void>;
  runWorkflow: (workflowId: string, initialVariables?: Record<string, string>) => Promise<WorkflowRunResult | null>;
  loadRunHistory: (workflowId: string) => Promise<void>;
  updateWorkflow: (id: string, data: Partial<Workflow>) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  archiveWorkflow: (id: string) => Promise<void>;
  unarchiveWorkflow: (id: string) => Promise<void>;
  clearArchivedWorkflows: (workspaceId: string) => Promise<void>;
  reorderWorkflows: (workspaceId: string, orderedIds: string[]) => Promise<void>;
  getWorkflowsContainingRequest: (requestId: string) => Promise<Workflow[]>;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflows: [],
  archivedWorkflows: [],
  selectedWorkflowId: null,
  steps: [],
  stepExtractions: {},
  inputs: [],
  lastRunResult: null,
  runHistory: [],
  running: false,

  loadWorkflows: async (workspaceId) => {
    try {
      const workflows = await window.ruke.db.query('getUncollectedWorkflows', workspaceId);
      const list = Array.isArray(workflows) ? workflows : [];
      let archived: Workflow[] = [];
      try {
        const raw = await window.ruke.db.query('getArchivedWorkflows', workspaceId);
        archived = Array.isArray(raw) ? raw : [];
      } catch {}
      set({ workflows: list, archivedWorkflows: archived });

      // Clear selection if it's not in this workspace
      const current = get().selectedWorkflowId;
      const exists = list.some((w: Workflow) => w.id === current)
        || archived.some((w: Workflow) => w.id === current);
      if (current && !exists) set({ selectedWorkflowId: null, steps: [], stepExtractions: {}, inputs: [], runHistory: [] });

      // Restore last selected workflow (like requests)
      const lastId = localStorage.getItem('ruke:lastSelectedWorkflowId');
      const toSelect = lastId && (list.some((w: Workflow) => w.id === lastId) || archived.some((w: Workflow) => w.id === lastId))
        ? lastId
        : null;
      if (toSelect && get().selectedWorkflowId !== toSelect) get().selectWorkflow(toSelect);
    } catch { /* db not ready */ }
  },

  createWorkflow: async (workspaceId, name, collectionId = null) => {
    const id = nanoid();
    const workflows = collectionId
      ? (await window.ruke.db.query('getWorkflowsByCollection', collectionId)) || []
      : get().workflows;
    const sortOrder = workflows.length;
    await window.ruke.db.query('createWorkflow', id, workspaceId, name, sortOrder, collectionId);
    const w: Workflow = {
      id,
      workspaceId,
      collectionId: collectionId || undefined,
      name,
      sortOrder,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (collectionId) {
      const { useWorkflowCollectionStore } = await import('./workflowCollectionStore');
      useWorkflowCollectionStore.getState().loadWorkflows(collectionId);
    } else {
      set((s) => ({ workflows: [...s.workflows, w] }));
    }
    return w;
  },

  selectWorkflow: async (id) => {
    set({ selectedWorkflowId: id });
    if (id) {
      localStorage.setItem('ruke:lastSelectedWorkflowId', id);
      await get().loadSteps(id);
      await get().loadInputs(id);
      await get().loadStepExtractions(id);
      await get().loadRunHistory(id);
    } else {
      localStorage.removeItem('ruke:lastSelectedWorkflowId');
      set({ steps: [], stepExtractions: {}, inputs: [], runHistory: [] });
    }
  },

  loadSteps: async (workflowId) => {
    try {
      const steps = await window.ruke.db.query('getWorkflowSteps', workflowId);
      set({ steps: Array.isArray(steps) ? steps : [] });
    } catch {
      set({ steps: [] });
    }
  },

  loadInputs: async (workflowId) => {
    try {
      const inputs = await window.ruke.db.query('getWorkflowInputs', workflowId);
      set({ inputs: Array.isArray(inputs) ? inputs : [] });
    } catch {
      set({ inputs: [] });
    }
  },

  addInput: async (workflowId, key, label, defaultValue, isSecret) => {
    const inputs = get().inputs;
    const sortOrder = inputs.length;
    const id = nanoid();
    await window.ruke.db.query('createWorkflowInput', id, workflowId, key, label ?? null, defaultValue ?? null, !!isSecret, sortOrder);
    const newInput: WorkflowInput = { id, workflowId, key, label, defaultValue, isSecret, sortOrder };
    set((s) => ({
      inputs: [...s.inputs, newInput].sort((a, b) => a.sortOrder - b.sortOrder),
    }));
  },

  removeInput: async (workflowId, inputId) => {
    await window.ruke.db.query('deleteWorkflowInput', inputId);
    set((s) => {
      const next = s.inputs.filter((inp) => inp.id !== inputId);
      return { inputs: next.map((inp, i) => ({ ...inp, sortOrder: i })) };
    });
  },

  updateWorkflowInput: async (inputId, data) => {
    await window.ruke.db.query('updateWorkflowInput', inputId, data);
    set((s) => ({
      inputs: s.inputs.map((inp) => (inp.id === inputId ? { ...inp, ...data } : inp)),
    }));
  },

  reorderWorkflowInputs: async (workflowId, inputIdsInOrder) => {
    await window.ruke.db.query('reorderWorkflowInputs', workflowId, inputIdsInOrder);
    set((s) => ({
      inputs: inputIdsInOrder
        .map((id) => s.inputs.find((inp) => inp.id === id))
        .filter(Boolean) as WorkflowInput[],
    }));
  },

  addStep: async (workflowId, requestId) => {
    const steps = get().steps;
    const sortOrder = steps.length;
    const id = nanoid();
    await window.ruke.db.query('addWorkflowStep', id, workflowId, requestId, sortOrder);
    const newStep: WorkflowStep = { id, workflowId, requestId, sortOrder };
    set((s) => ({
      steps: [...s.steps, newStep].sort((a, b) => a.sortOrder - b.sortOrder),
    }));
  },

  removeStep: async (workflowId, stepId) => {
    await window.ruke.db.query('deleteWorkflowStep', stepId);
    set((s) => {
      const next = s.steps.filter((st) => st.id !== stepId);
      const { [stepId]: _, ...restExtractions } = s.stepExtractions;
      return {
        steps: next.map((st, i) => ({ ...st, sortOrder: i })),
        stepExtractions: restExtractions,
      };
    });
  },

  reorderSteps: async (workflowId, stepIdsInOrder) => {
    await window.ruke.db.query('reorderWorkflowSteps', workflowId, stepIdsInOrder);
    set((s) => ({
      steps: stepIdsInOrder
        .map((id) => s.steps.find((st) => st.id === id))
        .filter(Boolean) as WorkflowStep[],
    }));
  },

  loadStepExtractions: async (workflowId) => {
    try {
      const steps = get().steps;
      const map: Record<string, WorkflowStepExtraction[]> = {};
      for (const st of steps) {
        const exts = await window.ruke.db.query('getWorkflowStepExtractions', st.id);
        map[st.id] = Array.isArray(exts) ? exts : [];
      }
      set({ stepExtractions: map });
    } catch {
      set({ stepExtractions: {} });
    }
  },

  addExtraction: async (stepId, variableName, jsonPath) => {
    const exts = get().stepExtractions[stepId] ?? [];
    const sortOrder = exts.length;
    const id = nanoid();
    await window.ruke.db.query('createWorkflowStepExtraction', id, stepId, variableName, jsonPath, sortOrder);
    const newExt: WorkflowStepExtraction = { id, stepId, variableName, jsonPath, sortOrder };
    set((s) => ({
      stepExtractions: {
        ...s.stepExtractions,
        [stepId]: [...(s.stepExtractions[stepId] ?? []), newExt].sort((a, b) => a.sortOrder - b.sortOrder),
      },
    }));
  },

  removeExtraction: async (extractionId) => {
    const exts = Object.entries(get().stepExtractions).find(([, arr]) => arr.some((e) => e.id === extractionId));
    if (!exts) return;
    const [stepId] = exts;
    await window.ruke.db.query('deleteWorkflowStepExtraction', extractionId);
    set((s) => ({
      stepExtractions: {
        ...s.stepExtractions,
        [stepId]: (s.stepExtractions[stepId] ?? []).filter((e) => e.id !== extractionId),
      },
    }));
  },

  runWorkflow: async (workflowId, initialVariables?: Record<string, string>) => {
    const workflow = get().workflows.find((w) => w.id === workflowId)
      || get().archivedWorkflows.find((w) => w.id === workflowId);
    if (!workflow) return null;

    const steps = await window.ruke.db.query('getWorkflowSteps', workflowId);
    if (!Array.isArray(steps) || steps.length === 0) return null;

    const getConnection = useConnectionStore.getState().getConnection;
    const resolveVariables = useEnvironmentStore.getState().resolveVariables;
    const resolveString = useEnvironmentStore.getState().resolveString;

    set({ running: true, lastRunResult: null });
    const startedAt = new Date().toISOString();
    let runVariables: Record<string, string> = { ...resolveVariables(), ...(initialVariables || {}) };
    const results: WorkflowRunEntry[] = [];
    const sortedSteps = (steps as WorkflowStep[]).sort((a, b) => a.sortOrder - b.sortOrder);

    for (let i = 0; i < sortedSteps.length; i++) {
      const step = sortedSteps[i];
      const req: ApiRequest | null = await window.ruke.db.query('getRequestById', step.requestId);
      if (!req) {
        results.push({
          requestId: step.requestId,
          requestName: '(deleted request)',
          method: 'GET',
          url: '',
          status: 0,
          statusText: 'Request not found',
          duration: 0,
          passed: false,
          error: 'Request not found',
        });
        continue;
      }

      const resolvedUrl = getResolvedUrl(req, getConnection, resolveString, runVariables);
      const effectiveAuth = getEffectiveAuth(req, getConnection);

      let sendPayload: any = {
        ...req,
        url: resolvedUrl,
        auth: effectiveAuth,
        resolvedVariables: runVariables,
      };

      if (req.scripts?.preRequest) {
        try {
          const preResult = await window.ruke.scripting.run(
            req.scripts.preRequest,
            {
              request: {
                method: req.method,
                url: resolvedUrl,
                headers: Object.fromEntries(
                  req.headers.filter((h: { enabled: boolean }) => h.enabled).map((h: { key: string; value: string }) => [h.key, h.value])
                ),
                body: req.body?.raw,
              },
              variables: runVariables,
              testResults: [],
            },
            'pre-request'
          );
          if (preResult?.variables) {
            runVariables = { ...runVariables, ...preResult.variables };
            sendPayload = { ...sendPayload, resolvedVariables: runVariables };
          }
        } catch (_) {}
      }

      const entry: WorkflowRunEntry = {
        requestId: req.id,
        requestName: req.name,
        method: req.method as HttpMethod,
        url: resolvedUrl,
        status: 0,
        statusText: '',
        duration: 0,
        passed: false,
      };

      try {
        const response = await window.ruke.sendRequest(sendPayload);
        entry.status = response.status;
        entry.statusText = response.statusText;
        entry.duration = response.duration;
        entry.passed = response.status >= 200 && response.status < 300;

        const extractions = await window.ruke.db.query('getWorkflowStepExtractions', step.id) as Array<{ variableName: string; jsonPath: string }>;
        if (Array.isArray(extractions) && extractions.length > 0) {
          try {
            const parsed = JSON.parse(response.body);
            for (const ext of extractions) {
              const parts = (ext.jsonPath || '').replace(/^\$\.?/, '').replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
              let val: unknown = parsed;
              for (const p of parts) {
                if (val == null || typeof val !== 'object') {
                  val = undefined;
                  break;
                }
                val = (val as Record<string, unknown>)[p];
              }
              if (val !== undefined && val !== null) {
                runVariables[ext.variableName] = String(val);
              }
            }
          } catch (_) {}
        }

        if (req.scripts?.postResponse) {
          try {
            const scriptResult = await window.ruke.scripting.run(
              req.scripts.postResponse,
              {
                request: {
                  method: req.method,
                  url: resolvedUrl,
                  headers: Object.fromEntries(
                    req.headers.filter((h: { enabled: boolean }) => h.enabled).map((h: { key: string; value: string }) => [h.key, h.value])
                  ),
                  body: req.body?.raw,
                },
                response: {
                  status: response.status,
                  statusText: response.statusText,
                  headers: response.headers,
                  body: response.body,
                  duration: response.duration,
                },
                variables: runVariables,
                testResults: [],
              },
              'post-response'
            );
            if (scriptResult?.variables) {
              runVariables = { ...runVariables, ...scriptResult.variables };
            }
          } catch (_) {}
        }
      } catch (err: any) {
        entry.status = 0;
        entry.statusText = 'Request failed';
        entry.error = err?.message || String(err);
        entry.passed = false;
      }

      results.push(entry);
    }

    const completedAt = new Date().toISOString();
    const duration = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = results.filter((r) => !r.passed).length;
    const status = failedCount === results.length ? 'failed' : passedCount === results.length ? 'success' : 'partial';

    const outputKeys = workflow.outputKeys;
    const outputs = outputKeys?.length
      ? Object.fromEntries(outputKeys.filter((k) => k in runVariables).map((k) => [k, runVariables[k]]))
      : { ...runVariables };

    const stepsForLog = results.map((r, i) => ({
      index: i,
      requestName: r.requestName,
      method: r.method,
      status: r.status,
      statusCode: r.status,
      duration: r.duration,
      error: r.error,
      passed: r.passed,
    }));

    const runId = nanoid();
    await window.ruke.db.query('addWorkflowRun', {
      id: runId,
      workflowId,
      startedAt,
      completedAt,
      durationMs: duration,
      status,
      inputsJson: JSON.stringify(initialVariables || {}),
      outputsJson: JSON.stringify(outputs),
      logJson: JSON.stringify({ steps: stepsForLog }),
    });

    const result: WorkflowRunResult = {
      workflowId,
      workflowName: workflow.name,
      runId,
      startedAt,
      completedAt,
      duration,
      total: results.length,
      passed: passedCount,
      failed: failedCount,
      results,
      finalVariables: { ...runVariables },
    };
    set({ lastRunResult: result, running: false });
    return result;
  },

  loadRunHistory: async (workflowId) => {
    try {
      const runs = await window.ruke.db.query('getWorkflowRuns', workflowId, 50);
      set({ runHistory: Array.isArray(runs) ? runs : [] });
    } catch {
      set({ runHistory: [] });
    }
  },

  updateWorkflow: async (id, data) => {
    await window.ruke.db.query('updateWorkflow', id, data);
    set((s) => ({
      workflows: s.workflows.map((w) => (w.id === id ? { ...w, ...data } : w)),
      archivedWorkflows: s.archivedWorkflows.map((w) => (w.id === id ? { ...w, ...data } : w)),
    }));
  },

  deleteWorkflow: async (id) => {
    await window.ruke.db.query('deleteWorkflow', id);
    set((s) => ({
      workflows: s.workflows.filter((w) => w.id !== id),
      archivedWorkflows: s.archivedWorkflows.filter((w) => w.id !== id),
      selectedWorkflowId: s.selectedWorkflowId === id ? null : s.selectedWorkflowId,
      steps: s.selectedWorkflowId === id ? [] : s.steps,
    }));
  },

  archiveWorkflow: async (id) => {
    await window.ruke.db.query('archiveWorkflow', id);
    const w = get().workflows.find((x) => x.id === id);
    set((s) => ({
      workflows: s.workflows.filter((x) => x.id !== id),
      archivedWorkflows: w ? [...s.archivedWorkflows, { ...w, archived: true }] : s.archivedWorkflows,
      selectedWorkflowId: s.selectedWorkflowId === id ? null : s.selectedWorkflowId,
      steps: s.selectedWorkflowId === id ? [] : s.steps,
    }));
  },

  unarchiveWorkflow: async (id) => {
    await window.ruke.db.query('unarchiveWorkflow', id);
    const w = get().archivedWorkflows.find((x) => x.id === id);
    set((s) => ({
      archivedWorkflows: s.archivedWorkflows.filter((x) => x.id !== id),
      workflows: w ? [...s.workflows, { ...w, archived: false }] : s.workflows,
    }));
  },

  clearArchivedWorkflows: async (workspaceId) => {
    try {
      await window.ruke.db.query('clearArchivedWorkflows', workspaceId);
      set({ archivedWorkflows: [] });
    } catch {}
  },

  reorderWorkflows: async (workspaceId, orderedIds) => {
    if (!orderedIds.length) return;
    try {
      await Promise.all(
        orderedIds.map((id, i) => window.ruke.db.query('updateWorkflow', id, { sortOrder: i }))
      );
      await get().loadWorkflows(workspaceId);
    } catch {
      await get().loadWorkflows(workspaceId);
    }
  },

  getWorkflowsContainingRequest: async (requestId) => {
    try {
      const list = await window.ruke.db.query('getWorkflowsContainingRequest', requestId);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  },
}));
