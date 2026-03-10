import Database from 'better-sqlite3';

export function initDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'personal',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      parent_id TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES collections(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      collection_id TEXT,
      name TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT 'GET',
      url TEXT NOT NULL DEFAULT '',
      headers TEXT NOT NULL DEFAULT '[]',
      params TEXT NOT NULL DEFAULT '[]',
      body TEXT NOT NULL DEFAULT '{"type":"none"}',
      auth TEXT NOT NULL DEFAULT '{"type":"none"}',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS environments (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS env_variables (
      id TEXT PRIMARY KEY,
      environment_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL DEFAULT '',
      is_secret INTEGER NOT NULL DEFAULT 0,
      scope TEXT NOT NULL DEFAULT 'global',
      scope_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (environment_id) REFERENCES environments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      request_id TEXT,
      method TEXT NOT NULL,
      url TEXT NOT NULL,
      status INTEGER NOT NULL,
      duration_ms REAL NOT NULL,
      response_size INTEGER NOT NULL DEFAULT 0,
      request_data TEXT NOT NULL DEFAULT '{}',
      response_data TEXT NOT NULL DEFAULT '{}',
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY,
      request_id TEXT,
      messages TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS workflow_collections (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      parent_id TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES workflow_collections(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workflow_steps (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      request_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
      FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workflow_inputs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      key TEXT NOT NULL,
      label TEXT,
      default_value TEXT,
      is_secret INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workflow_runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      duration_ms REAL NOT NULL,
      status TEXT NOT NULL,
      inputs_json TEXT NOT NULL DEFAULT '{}',
      outputs_json TEXT NOT NULL DEFAULT '{}',
      log_json TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workflow_step_extractions (
      id TEXT PRIMARY KEY,
      step_id TEXT NOT NULL,
      variable_name TEXT NOT NULL,
      json_path TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (step_id) REFERENCES workflow_steps(id) ON DELETE CASCADE
    );
  `);

  // Migrations: add new columns safely
  const envColumns = db.prepare("PRAGMA table_info(environments)").all() as { name: string }[];
  const envColNames = new Set(envColumns.map(c => c.name));
  if (!envColNames.has('connection_id')) {
    db.exec("ALTER TABLE environments ADD COLUMN connection_id TEXT");
  }
  if (!envColNames.has('base_url')) {
    db.exec("ALTER TABLE environments ADD COLUMN base_url TEXT");
  }
  if (!envColNames.has('archived')) {
    db.exec("ALTER TABLE environments ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
  }

  const reqColumns = db.prepare("PRAGMA table_info(requests)").all() as { name: string }[];
  const reqColNames = new Set(reqColumns.map(c => c.name));
  if (!reqColNames.has('archived')) {
    db.exec("ALTER TABLE requests ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
  }
  if (!reqColNames.has('connection_id')) {
    db.exec("ALTER TABLE requests ADD COLUMN connection_id TEXT");
  }
  if (!reqColNames.has('endpoint_id')) {
    db.exec("ALTER TABLE requests ADD COLUMN endpoint_id TEXT");
  }

  const wfColumns = db.prepare("PRAGMA table_info(workflows)").all() as { name: string }[];
  const wfColNames = new Set(wfColumns.map(c => c.name));
  if (!wfColNames.has('output_keys')) {
    db.exec("ALTER TABLE workflows ADD COLUMN output_keys TEXT");
  }
  if (!wfColNames.has('collection_id')) {
    db.exec("ALTER TABLE workflows ADD COLUMN collection_id TEXT REFERENCES workflow_collections(id) ON DELETE SET NULL");
  }

  const wsCount = db.prepare('SELECT COUNT(*) as count FROM workspaces').get() as { count: number };
  if (wsCount.count === 0) {
    const { nanoid } = require('nanoid') as { nanoid: () => string };
    db.prepare('INSERT INTO workspaces (id, name, type) VALUES (?, ?, ?)').run(
      nanoid(),
      'My Workspace',
      'personal'
    );
  }

  return db;
}
