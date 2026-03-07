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
  AGENT_DISCOVER: 'agent:discover',
  KEYCHAIN_GET: 'keychain:get',
  KEYCHAIN_SET: 'keychain:set',
  IMPORT_FILE: 'file:import',
  EXPORT_FILE: 'file:export',
  GET_APP_PATH: 'app:get-path',
  GRPC_LOAD_PROTO: 'grpc:load-proto',
  GRPC_SEND_REQUEST: 'grpc:send-request',
  GRPC_SERVER_REFLECTION: 'grpc:server-reflection',
  GRPC_CANCEL_STREAM: 'grpc:cancel-stream',
} as const;

export const GRPC_STATUS_CODES: Record<number, string> = {
  0: 'OK',
  1: 'CANCELLED',
  2: 'UNKNOWN',
  3: 'INVALID_ARGUMENT',
  4: 'DEADLINE_EXCEEDED',
  5: 'NOT_FOUND',
  6: 'ALREADY_EXISTS',
  7: 'PERMISSION_DENIED',
  8: 'RESOURCE_EXHAUSTED',
  9: 'FAILED_PRECONDITION',
  10: 'ABORTED',
  11: 'OUT_OF_RANGE',
  12: 'UNIMPLEMENTED',
  13: 'INTERNAL',
  14: 'UNAVAILABLE',
  15: 'DATA_LOSS',
  16: 'UNAUTHENTICATED',
};

export const GRPC_STATUS_COLORS: Record<number, string> = {
  0: '#22c55e',
  1: '#f59e0b',
  2: '#ef4444',
  3: '#ef4444',
  4: '#f59e0b',
  5: '#ef4444',
  7: '#ef4444',
  12: '#6b7280',
  13: '#ef4444',
  14: '#f59e0b',
  16: '#ef4444',
};

export const EXAMPLE_REQUEST_URL = 'https://httpbin.org/get';

export const VARIABLE_REGEX = /\{\{([^}]+)\}\}/g;
