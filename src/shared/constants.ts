export const APP_NAME = 'Rüke';
export const APP_VERSION = '0.1.0';
export const DB_NAME = 'ruke.db';

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

export const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e',
  POST: '#f59e0b',
  PUT: '#3b82f6',
  PATCH: '#a855f7',
  DELETE: '#ef4444',
  HEAD: '#6b7280',
  OPTIONS: '#6b7280',
};

export const DEFAULT_HEADERS: Array<{ key: string; value: string }> = [
  { key: 'Content-Type', value: 'application/json' },
  { key: 'Accept', value: 'application/json' },
];

export const IPC_CHANNELS = {
  SEND_REQUEST: 'http:send-request',
  DB_QUERY: 'db:query',
  DB_RUN: 'db:run',
  AI_CHAT: 'ai:chat',
  AI_SET_KEY: 'ai:set-key',
  KEYCHAIN_GET: 'keychain:get',
  KEYCHAIN_SET: 'keychain:set',
  IMPORT_FILE: 'file:import',
  EXPORT_FILE: 'file:export',
  GET_APP_PATH: 'app:get-path',
} as const;

export const EXAMPLE_REQUEST_URL = 'https://httpbin.org/get';

export const VARIABLE_REGEX = /\{\{([^}]+)\}\}/g;
