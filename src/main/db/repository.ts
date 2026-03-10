import Database from 'better-sqlite3';
import type {
  Workspace, Collection, ApiRequest, Environment,
  EnvVariable, HistoryEntry, AiConversation, Workflow, WorkflowStep,
  WorkflowStepExtraction, WorkflowInput, WorkflowRun, WorkflowCollection,
} from '../../shared/types';

function parseWorkflowRow(r: any): Workflow {
  const outputKeys = r.outputKeys != null && r.outputKeys !== '' ? JSON.parse(r.outputKeys) : undefined;
  return {
    ...r,
    collectionId: r.collectionId ?? null,
    archived: !!r.archived,
    outputKeys: Array.isArray(outputKeys) ? outputKeys : undefined,
  };
}

export function createRepository(db: Database.Database) {
  return {
    // ── Workspaces ──
    getWorkspaces(): Workspace[] {
      return db.prepare('SELECT id, name, type, created_at as createdAt FROM workspaces ORDER BY created_at').all() as Workspace[];
    },

    createWorkspace(id: string, name: string, type: string): void {
      db.prepare('INSERT INTO workspaces (id, name, type) VALUES (?, ?, ?)').run(id, name, type);
    },

    // ── Collections ──
    getCollections(workspaceId: string): Collection[] {
      return db.prepare(
        `SELECT id, workspace_id as workspaceId, name, parent_id as parentId,
         sort_order as sortOrder, created_at as createdAt, updated_at as updatedAt
         FROM collections WHERE workspace_id = ? ORDER BY sort_order`
      ).all(workspaceId) as Collection[];
    },

    createCollection(id: string, workspaceId: string, name: string, parentId: string | null, sortOrder: number): void {
      db.prepare(
        'INSERT INTO collections (id, workspace_id, name, parent_id, sort_order) VALUES (?, ?, ?, ?, ?)'
      ).run(id, workspaceId, name, parentId, sortOrder);
    },

    updateCollection(id: string, data: Partial<Collection>): void {
      const sets: string[] = [];
      const values: any[] = [];
      if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name); }
      if (data.parentId !== undefined) { sets.push('parent_id = ?'); values.push(data.parentId); }
      if (data.sortOrder !== undefined) { sets.push('sort_order = ?'); values.push(data.sortOrder); }
      sets.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE collections SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    },

    deleteCollection(id: string): void {
      db.prepare('DELETE FROM collections WHERE id = ?').run(id);
    },

    // ── Requests ──
    getRequests(collectionId: string): ApiRequest[] {
      const rows = db.prepare(
        `SELECT id, collection_id as collectionId, name, method, url,
         headers, params, body, auth, archived, connection_id as connectionId,
         endpoint_id as endpointId, sort_order as sortOrder,
         created_at as createdAt, updated_at as updatedAt
         FROM requests WHERE collection_id = ? AND (archived = 0 OR archived IS NULL) ORDER BY sort_order`
      ).all(collectionId) as any[];
      return rows.map(parseRequestRow);
    },

    getAllRequests(workspaceId: string): ApiRequest[] {
      const rows = db.prepare(
        `SELECT r.id, r.collection_id as collectionId, r.name, r.method, r.url,
         r.headers, r.params, r.body, r.auth, r.archived, r.connection_id as connectionId,
         r.endpoint_id as endpointId, r.sort_order as sortOrder,
         r.created_at as createdAt, r.updated_at as updatedAt
         FROM requests r
         LEFT JOIN collections c ON r.collection_id = c.id
         WHERE c.workspace_id = ? OR r.collection_id IS NULL
         ORDER BY r.sort_order`
      ).all(workspaceId) as any[];
      return rows.map(parseRequestRow);
    },

    getUncollectedRequests(): ApiRequest[] {
      const rows = db.prepare(
        `SELECT id, collection_id as collectionId, name, method, url,
         headers, params, body, auth, archived, connection_id as connectionId,
         endpoint_id as endpointId, sort_order as sortOrder,
         created_at as createdAt, updated_at as updatedAt
         FROM requests
         WHERE collection_id IS NULL AND (archived = 0 OR archived IS NULL)
         ORDER BY sort_order, updated_at DESC`
      ).all() as any[];
      return rows.map(parseRequestRow);
    },

    getArchivedRequests(): ApiRequest[] {
      const rows = db.prepare(
        `SELECT id, collection_id as collectionId, name, method, url,
         headers, params, body, auth, archived, connection_id as connectionId,
         endpoint_id as endpointId, sort_order as sortOrder,
         created_at as createdAt, updated_at as updatedAt
         FROM requests WHERE archived = 1
         ORDER BY updated_at DESC`
      ).all() as any[];
      return rows.map(parseRequestRow);
    },

    getRequestById(id: string): ApiRequest | null {
      const row = db.prepare(
        `SELECT id, collection_id as collectionId, name, method, url,
         headers, params, body, auth, archived, connection_id as connectionId,
         endpoint_id as endpointId, sort_order as sortOrder,
         created_at as createdAt, updated_at as updatedAt
         FROM requests WHERE id = ?`
      ).get(id) as any;
      return row ? parseRequestRow(row) : null;
    },

    createRequest(req: ApiRequest): void {
      db.prepare(
        `INSERT INTO requests (id, collection_id, name, method, url, headers, params, body, auth, archived, connection_id, endpoint_id, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        req.id, req.collectionId, req.name, req.method, req.url,
        JSON.stringify(req.headers), JSON.stringify(req.params),
        JSON.stringify(req.body), JSON.stringify(req.auth),
        req.archived ? 1 : 0, req.connectionId || null, req.endpointId || null,
        req.sortOrder
      );
    },

    updateRequest(id: string, data: Partial<ApiRequest>): void {
      const sets: string[] = [];
      const values: any[] = [];
      if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name); }
      if (data.method !== undefined) { sets.push('method = ?'); values.push(data.method); }
      if (data.url !== undefined) { sets.push('url = ?'); values.push(data.url); }
      if (data.headers !== undefined) { sets.push('headers = ?'); values.push(JSON.stringify(data.headers)); }
      if (data.params !== undefined) { sets.push('params = ?'); values.push(JSON.stringify(data.params)); }
      if (data.body !== undefined) { sets.push('body = ?'); values.push(JSON.stringify(data.body)); }
      if (data.auth !== undefined) { sets.push('auth = ?'); values.push(JSON.stringify(data.auth)); }
      if (data.collectionId !== undefined) { sets.push('collection_id = ?'); values.push(data.collectionId); }
      if (data.archived !== undefined) { sets.push('archived = ?'); values.push(data.archived ? 1 : 0); }
      if (data.connectionId !== undefined) { sets.push('connection_id = ?'); values.push(data.connectionId || null); }
      if (data.endpointId !== undefined) { sets.push('endpoint_id = ?'); values.push(data.endpointId || null); }
      if (data.sortOrder !== undefined) { sets.push('sort_order = ?'); values.push(data.sortOrder); }
      sets.push("updated_at = datetime('now')");
      values.push(id);
      if (sets.length > 1) {
        db.prepare(`UPDATE requests SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      }
    },

    archiveRequest(id: string): void {
      db.prepare("UPDATE requests SET archived = 1, collection_id = NULL, updated_at = datetime('now') WHERE id = ?").run(id);
    },

    unarchiveRequest(id: string): void {
      db.prepare("UPDATE requests SET archived = 0, updated_at = datetime('now') WHERE id = ?").run(id);
    },

    deleteRequest(id: string): void {
      db.prepare('DELETE FROM requests WHERE id = ?').run(id);
    },

    clearArchivedRequests(): void {
      db.prepare('DELETE FROM requests WHERE archived = 1').run();
    },

    // ── Environments ──
    getEnvironments(workspaceId: string): Environment[] {
      return db.prepare(
        `SELECT id, workspace_id as workspaceId, name, is_active as isActive,
         sort_order as sortOrder, connection_id as connectionId, base_url as baseUrl,
         archived, created_at as createdAt, updated_at as updatedAt
         FROM environments WHERE workspace_id = ? AND (archived = 0 OR archived IS NULL) ORDER BY sort_order`
      ).all(workspaceId) as any[];
    },

    getArchivedEnvironments(workspaceId: string): Environment[] {
      return db.prepare(
        `SELECT id, workspace_id as workspaceId, name, is_active as isActive,
         sort_order as sortOrder, connection_id as connectionId, base_url as baseUrl,
         archived, created_at as createdAt, updated_at as updatedAt
         FROM environments WHERE workspace_id = ? AND archived = 1 ORDER BY sort_order`
      ).all(workspaceId) as any[];
    },

    getEnvironmentsByConnection(connectionId: string): Environment[] {
      return db.prepare(
        `SELECT id, workspace_id as workspaceId, name, is_active as isActive,
         sort_order as sortOrder, connection_id as connectionId, base_url as baseUrl,
         created_at as createdAt, updated_at as updatedAt
         FROM environments WHERE connection_id = ? ORDER BY sort_order`
      ).all(connectionId) as any[];
    },

    createEnvironment(id: string, workspaceId: string, name: string, sortOrder: number, connectionId?: string, baseUrl?: string): void {
      db.prepare(
        'INSERT INTO environments (id, workspace_id, name, sort_order, connection_id, base_url) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, workspaceId, name, sortOrder, connectionId ?? null, baseUrl ?? null);
    },

    setActiveEnvironment(workspaceId: string, envId: string): void {
      db.prepare('UPDATE environments SET is_active = 0 WHERE workspace_id = ?').run(workspaceId);
      db.prepare('UPDATE environments SET is_active = 1 WHERE id = ?').run(envId);
    },

    updateEnvironment(id: string, data: Partial<Environment>): void {
      const sets: string[] = [];
      const values: any[] = [];
      if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name); }
      if (data.sortOrder !== undefined) { sets.push('sort_order = ?'); values.push(data.sortOrder); }
      sets.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE environments SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    },

    deleteEnvironment(id: string): void {
      db.prepare('DELETE FROM environments WHERE id = ?').run(id);
    },

    archiveEnvironment(id: string): void {
      db.prepare("UPDATE environments SET archived = 1, is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
    },

    unarchiveEnvironment(id: string): void {
      db.prepare("UPDATE environments SET archived = 0, updated_at = datetime('now') WHERE id = ?").run(id);
    },

    // ── Variables ──
    getVariables(environmentId: string): EnvVariable[] {
      return db.prepare(
        `SELECT id, environment_id as environmentId, key, value, is_secret as isSecret,
         scope, scope_id as scopeId, created_at as createdAt
         FROM env_variables WHERE environment_id = ? ORDER BY key`
      ).all(environmentId) as any[];
    },

    createVariable(v: EnvVariable): void {
      db.prepare(
        `INSERT INTO env_variables (id, environment_id, key, value, is_secret, scope, scope_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(v.id, v.environmentId, v.key, v.value, v.isSecret ? 1 : 0, v.scope, v.scopeId);
    },

    updateVariable(id: string, data: Partial<EnvVariable>): void {
      const sets: string[] = [];
      const values: any[] = [];
      if (data.key !== undefined) { sets.push('key = ?'); values.push(data.key); }
      if (data.value !== undefined) { sets.push('value = ?'); values.push(data.value); }
      if (data.isSecret !== undefined) { sets.push('is_secret = ?'); values.push(data.isSecret ? 1 : 0); }
      if (data.scope !== undefined) { sets.push('scope = ?'); values.push(data.scope); }
      values.push(id);
      if (sets.length > 0) {
        db.prepare(`UPDATE env_variables SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      }
    },

    deleteVariable(id: string): void {
      db.prepare('DELETE FROM env_variables WHERE id = ?').run(id);
    },

    // ── Workflow collections ──
    getWorkflowCollections(workspaceId: string): WorkflowCollection[] {
      return db.prepare(
        `SELECT id, workspace_id as workspaceId, name, parent_id as parentId,
         sort_order as sortOrder, created_at as createdAt, updated_at as updatedAt
         FROM workflow_collections WHERE workspace_id = ? ORDER BY sort_order`
      ).all(workspaceId) as WorkflowCollection[];
    },

    createWorkflowCollection(id: string, workspaceId: string, name: string, parentId: string | null, sortOrder: number): void {
      db.prepare(
        'INSERT INTO workflow_collections (id, workspace_id, name, parent_id, sort_order) VALUES (?, ?, ?, ?, ?)'
      ).run(id, workspaceId, name, parentId, sortOrder);
    },

    updateWorkflowCollection(id: string, data: Partial<WorkflowCollection>): void {
      const sets: string[] = [];
      const values: any[] = [];
      if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name); }
      if (data.parentId !== undefined) { sets.push('parent_id = ?'); values.push(data.parentId); }
      if (data.sortOrder !== undefined) { sets.push('sort_order = ?'); values.push(data.sortOrder); }
      sets.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE workflow_collections SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    },

    deleteWorkflowCollection(id: string): void {
      db.prepare("UPDATE workflows SET collection_id = NULL WHERE collection_id = ?").run(id);
      db.prepare('DELETE FROM workflow_collections WHERE parent_id = ?').run(id);
      db.prepare('DELETE FROM workflow_collections WHERE id = ?').run(id);
    },

    getWorkflowsByCollection(collectionId: string): Workflow[] {
      const rows = db.prepare(
        `SELECT id, workspace_id as workspaceId, collection_id as collectionId, name, sort_order as sortOrder,
         archived, output_keys as outputKeys, created_at as createdAt, updated_at as updatedAt
         FROM workflows WHERE collection_id = ? AND (archived = 0 OR archived IS NULL) ORDER BY sort_order`
      ).all(collectionId) as any[];
      return rows.map((r: any) => parseWorkflowRow(r));
    },

    getUncollectedWorkflows(workspaceId: string): Workflow[] {
      const rows = db.prepare(
        `SELECT id, workspace_id as workspaceId, collection_id as collectionId, name, sort_order as sortOrder,
         archived, output_keys as outputKeys, created_at as createdAt, updated_at as updatedAt
         FROM workflows
         WHERE workspace_id = ? AND (collection_id IS NULL OR collection_id = '') AND (archived = 0 OR archived IS NULL)
         ORDER BY sort_order, updated_at DESC`
      ).all(workspaceId) as any[];
      return rows.map((r: any) => parseWorkflowRow(r));
    },

    // ── Workflows ──
    getWorkflows(workspaceId: string): Workflow[] {
      const rows = db.prepare(
        `SELECT id, workspace_id as workspaceId, collection_id as collectionId, name, sort_order as sortOrder,
         archived, output_keys as outputKeys, created_at as createdAt, updated_at as updatedAt
         FROM workflows WHERE workspace_id = ? AND (archived = 0 OR archived IS NULL) ORDER BY sort_order`
      ).all(workspaceId) as any[];
      return rows.map((r: any) => parseWorkflowRow(r));
    },

    getArchivedWorkflows(workspaceId: string): Workflow[] {
      const rows = db.prepare(
        `SELECT id, workspace_id as workspaceId, collection_id as collectionId, name, sort_order as sortOrder,
         archived, output_keys as outputKeys, created_at as createdAt, updated_at as updatedAt
         FROM workflows WHERE workspace_id = ? AND archived = 1 ORDER BY sort_order`
      ).all(workspaceId) as any[];
      return rows.map((r: any) => parseWorkflowRow(r));
    },

    getWorkflowById(id: string): Workflow | null {
      const row = db.prepare(
        `SELECT id, workspace_id as workspaceId, collection_id as collectionId, name, sort_order as sortOrder,
         archived, output_keys as outputKeys, created_at as createdAt, updated_at as updatedAt
         FROM workflows WHERE id = ?`
      ).get(id) as any;
      return row ? parseWorkflowRow(row) : null;
    },

    createWorkflow(id: string, workspaceId: string, name: string, sortOrder: number, collectionId?: string | null): void {
      db.prepare(
        'INSERT INTO workflows (id, workspace_id, name, sort_order, collection_id) VALUES (?, ?, ?, ?, ?)'
      ).run(id, workspaceId, name, sortOrder, collectionId ?? null);
    },

    updateWorkflow(id: string, data: Partial<Workflow>): void {
      const sets: string[] = [];
      const values: any[] = [];
      if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name); }
      if (data.sortOrder !== undefined) { sets.push('sort_order = ?'); values.push(data.sortOrder); }
      if (data.collectionId !== undefined) { sets.push('collection_id = ?'); values.push(data.collectionId); }
      if (data.archived !== undefined) { sets.push('archived = ?'); values.push(data.archived ? 1 : 0); }
      if (data.outputKeys !== undefined) { sets.push('output_keys = ?'); values.push(JSON.stringify(data.outputKeys)); }
      sets.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE workflows SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    },

    deleteWorkflow(id: string): void {
      db.prepare('DELETE FROM workflows WHERE id = ?').run(id);
    },

    archiveWorkflow(id: string): void {
      db.prepare("UPDATE workflows SET archived = 1, updated_at = datetime('now') WHERE id = ?").run(id);
    },

    unarchiveWorkflow(id: string): void {
      db.prepare("UPDATE workflows SET archived = 0, updated_at = datetime('now') WHERE id = ?").run(id);
    },

    clearArchivedWorkflows(workspaceId: string): void {
      db.prepare('DELETE FROM workflows WHERE workspace_id = ? AND archived = 1').run(workspaceId);
    },

    getWorkflowSteps(workflowId: string): WorkflowStep[] {
      return db.prepare(
        `SELECT id, workflow_id as workflowId, request_id as requestId, sort_order as sortOrder
         FROM workflow_steps WHERE workflow_id = ? ORDER BY sort_order`
      ).all(workflowId) as WorkflowStep[];
    },

    addWorkflowStep(id: string, workflowId: string, requestId: string, sortOrder: number): void {
      db.prepare(
        'INSERT INTO workflow_steps (id, workflow_id, request_id, sort_order) VALUES (?, ?, ?, ?)'
      ).run(id, workflowId, requestId, sortOrder);
    },

    updateWorkflowStep(id: string, data: Partial<WorkflowStep>): void {
      const sets: string[] = [];
      const values: any[] = [];
      if (data.requestId !== undefined) { sets.push('request_id = ?'); values.push(data.requestId); }
      if (data.sortOrder !== undefined) { sets.push('sort_order = ?'); values.push(data.sortOrder); }
      values.push(id);
      if (sets.length > 0) {
        db.prepare(`UPDATE workflow_steps SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      }
    },

    deleteWorkflowStep(id: string): void {
      db.prepare('DELETE FROM workflow_steps WHERE id = ?').run(id);
    },

    reorderWorkflowSteps(workflowId: string, stepIdsInOrder: string[]): void {
      stepIdsInOrder.forEach((stepId, i) => {
        db.prepare('UPDATE workflow_steps SET sort_order = ? WHERE id = ? AND workflow_id = ?').run(i, stepId, workflowId);
      });
    },

    // ── Workflow step extractions ──
    getWorkflowStepExtractions(stepId: string): WorkflowStepExtraction[] {
      return db.prepare(
        `SELECT id, step_id as stepId, variable_name as variableName, json_path as jsonPath, sort_order as sortOrder
         FROM workflow_step_extractions WHERE step_id = ? ORDER BY sort_order`
      ).all(stepId) as WorkflowStepExtraction[];
    },

    createWorkflowStepExtraction(id: string, stepId: string, variableName: string, jsonPath: string, sortOrder: number): void {
      db.prepare(
        'INSERT INTO workflow_step_extractions (id, step_id, variable_name, json_path, sort_order) VALUES (?, ?, ?, ?, ?)'
      ).run(id, stepId, variableName, jsonPath, sortOrder);
    },

    deleteWorkflowStepExtraction(id: string): void {
      db.prepare('DELETE FROM workflow_step_extractions WHERE id = ?').run(id);
    },

    getWorkflowsContainingRequest(requestId: string): Workflow[] {
      const rows = db.prepare(
        `SELECT w.id, w.workspace_id as workspaceId, w.name, w.sort_order as sortOrder,
         w.archived, w.output_keys as outputKeys, w.created_at as createdAt, w.updated_at as updatedAt
         FROM workflows w
         INNER JOIN workflow_steps s ON s.workflow_id = w.id
         WHERE s.request_id = ? AND (w.archived = 0 OR w.archived IS NULL)
         ORDER BY w.sort_order`
      ).all(requestId) as any[];
      return rows.map((r: any) => parseWorkflowRow(r));
    },

    // ── Workflow inputs ──
    getWorkflowInputs(workflowId: string): WorkflowInput[] {
      const rows = db.prepare(
        `SELECT id, workflow_id as workflowId, key, label, default_value as defaultValue,
         is_secret as isSecret, sort_order as sortOrder
         FROM workflow_inputs WHERE workflow_id = ? ORDER BY sort_order`
      ).all(workflowId) as any[];
      return rows.map((r: any) => ({ ...r, isSecret: !!r.isSecret }));
    },

    createWorkflowInput(id: string, workflowId: string, key: string, label: string | null, defaultValue: string | null, isSecret: boolean, sortOrder: number): void {
      db.prepare(
        'INSERT INTO workflow_inputs (id, workflow_id, key, label, default_value, is_secret, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(id, workflowId, key, label, defaultValue, isSecret ? 1 : 0, sortOrder);
    },

    updateWorkflowInput(id: string, data: Partial<WorkflowInput>): void {
      const sets: string[] = [];
      const values: any[] = [];
      if (data.key !== undefined) { sets.push('key = ?'); values.push(data.key); }
      if (data.label !== undefined) { sets.push('label = ?'); values.push(data.label); }
      if (data.defaultValue !== undefined) { sets.push('default_value = ?'); values.push(data.defaultValue); }
      if (data.isSecret !== undefined) { sets.push('is_secret = ?'); values.push(data.isSecret ? 1 : 0); }
      if (data.sortOrder !== undefined) { sets.push('sort_order = ?'); values.push(data.sortOrder); }
      values.push(id);
      if (sets.length > 0) {
        db.prepare(`UPDATE workflow_inputs SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      }
    },

    deleteWorkflowInput(id: string): void {
      db.prepare('DELETE FROM workflow_inputs WHERE id = ?').run(id);
    },

    reorderWorkflowInputs(workflowId: string, inputIdsInOrder: string[]): void {
      inputIdsInOrder.forEach((inputId, i) => {
        db.prepare('UPDATE workflow_inputs SET sort_order = ? WHERE id = ? AND workflow_id = ?').run(i, inputId, workflowId);
      });
    },

    // ── Workflow runs ──
    addWorkflowRun(run: { id: string; workflowId: string; startedAt: string; completedAt: string; durationMs: number; status: string; inputsJson: string; outputsJson: string; logJson: string }): void {
      db.prepare(
        `INSERT INTO workflow_runs (id, workflow_id, started_at, completed_at, duration_ms, status, inputs_json, outputs_json, log_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(run.id, run.workflowId, run.startedAt, run.completedAt, run.durationMs, run.status, run.inputsJson, run.outputsJson, run.logJson);
    },

    getWorkflowRuns(workflowId: string, limit: number = 50): WorkflowRun[] {
      const rows = db.prepare(
        `SELECT id, workflow_id as workflowId, started_at as startedAt, completed_at as completedAt,
         duration_ms as durationMs, status, inputs_json as inputsJson, outputs_json as outputsJson, log_json as logJson
         FROM workflow_runs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?`
      ).all(workflowId, limit) as any[];
      return rows.map((r: any) => {
        const log = JSON.parse(r.logJson || '{}');
        return {
          id: r.id,
          workflowId: r.workflowId,
          startedAt: r.startedAt,
          completedAt: r.completedAt,
          durationMs: r.durationMs,
          status: r.status,
          inputs: JSON.parse(r.inputsJson || '{}'),
          outputs: JSON.parse(r.outputsJson || '{}'),
          steps: log.steps || [],
        };
      });
    },

    getWorkflowRunById(runId: string): WorkflowRun | null {
      const row = db.prepare(
        `SELECT id, workflow_id as workflowId, started_at as startedAt, completed_at as completedAt,
         duration_ms as durationMs, status, inputs_json as inputsJson, outputs_json as outputsJson, log_json as logJson
         FROM workflow_runs WHERE id = ?`
      ).get(runId) as any;
      if (!row) return null;
      const log = JSON.parse(row.logJson || '{}');
      return {
        id: row.id,
        workflowId: row.workflowId,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        durationMs: row.durationMs,
        status: row.status,
        inputs: JSON.parse(row.inputsJson || '{}'),
        outputs: JSON.parse(row.outputsJson || '{}'),
        steps: log.steps || [],
      };
    },

    // ── History ──
    getHistory(limit: number = 50, offset: number = 0): HistoryEntry[] {
      const rows = db.prepare(
        `SELECT id, request_id as requestId, method, url, status,
         duration_ms as duration, response_size as responseSize,
         request_data, response_data, timestamp
         FROM history ORDER BY timestamp DESC LIMIT ? OFFSET ?`
      ).all(limit, offset) as any[];
      return rows.map((row: any) => ({
        ...row,
        request: JSON.parse(row.request_data),
        response: JSON.parse(row.response_data),
      }));
    },

    addHistory(entry: { id: string; requestId: string | null; method: string; url: string; status: number; duration: number; responseSize: number; request: any; response: any }): void {
      db.prepare(
        `INSERT INTO history (id, request_id, method, url, status, duration_ms, response_size, request_data, response_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        entry.id, entry.requestId, entry.method, entry.url, entry.status,
        entry.duration, entry.responseSize,
        JSON.stringify(entry.request), JSON.stringify(entry.response)
      );
    },

    getHistoryForRequest(requestId: string, limit: number = 20): HistoryEntry[] {
      const rows = db.prepare(
        `SELECT id, request_id as requestId, method, url, status,
         duration_ms as duration, response_size as responseSize,
         request_data, response_data, timestamp
         FROM history WHERE request_id = ? ORDER BY timestamp DESC LIMIT ?`
      ).all(requestId, limit) as any[];
      return rows.map((row: any) => ({
        ...row,
        request: JSON.parse(row.request_data),
        response: JSON.parse(row.response_data),
      }));
    },

    clearHistory(): void {
      db.prepare('DELETE FROM history').run();
    },

    searchHistory(query: string): HistoryEntry[] {
      const rows = db.prepare(
        `SELECT id, request_id as requestId, method, url, status,
         duration_ms as duration, response_size as responseSize,
         request_data, response_data, timestamp
         FROM history WHERE url LIKE ? OR method LIKE ?
         ORDER BY timestamp DESC LIMIT 100`
      ).all(`%${query}%`, `%${query}%`) as any[];
      return rows.map((row: any) => ({
        ...row,
        request: JSON.parse(row.request_data),
        response: JSON.parse(row.response_data),
      }));
    },

    // ── AI Conversations ──
    getConversation(id: string): AiConversation | null {
      const row = db.prepare(
        `SELECT id, request_id as requestId, messages, created_at as createdAt
         FROM ai_conversations WHERE id = ?`
      ).get(id) as any;
      if (!row) return null;
      return { ...row, messages: JSON.parse(row.messages) };
    },

    saveConversation(conv: AiConversation): void {
      db.prepare(
        `INSERT OR REPLACE INTO ai_conversations (id, request_id, messages) VALUES (?, ?, ?)`
      ).run(conv.id, conv.requestId, JSON.stringify(conv.messages));
    },

    // ── Settings ──
    getSetting(key: string): string | null {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
      return row ? row.value : null;
    },

    setSetting(key: string, value: string): void {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
    },
  };
}

function parseRequestRow(row: any): ApiRequest {
  return {
    ...row,
    headers: JSON.parse(row.headers),
    params: JSON.parse(row.params),
    body: JSON.parse(row.body),
    auth: JSON.parse(row.auth),
    archived: !!row.archived,
    connectionId: row.connectionId || undefined,
    endpointId: row.endpointId || undefined,
  };
}

export type Repository = ReturnType<typeof createRepository>;
