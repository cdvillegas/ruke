export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type BodyType = 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary' | 'graphql';

export type AuthType = 'none' | 'bearer' | 'basic' | 'api-key';

export type VariableScope = 'global' | 'collection' | 'folder' | 'request';

export interface KeyValue {
  key: string;
  value: string;
  enabled: boolean;
}

export interface AuthConfig {
  type: AuthType;
  bearer?: { token: string };
  basic?: { username: string; password: string };
  apiKey?: { key: string; value: string; addTo: 'header' | 'query' };
}

export interface RequestBody {
  type: BodyType;
  raw?: string;
  formData?: KeyValue[];
  urlEncoded?: KeyValue[];
  binary?: string;
  graphql?: { query: string; variables: string; operationName?: string };
}

export interface ApiRequest {
  id: string;
  collectionId: string | null;
  name: string;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: RequestBody;
  auth: AuthConfig;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  size: number;
  duration: number;
  timestamp: string;
}

export interface HistoryEntry {
  id: string;
  requestId: string | null;
  method: HttpMethod;
  url: string;
  status: number;
  duration: number;
  responseSize: number;
  timestamp: string;
  request: ApiRequest;
  response: ApiResponse;
}

export interface Workspace {
  id: string;
  name: string;
  type: 'personal' | 'team';
  createdAt: string;
}

export interface Collection {
  id: string;
  workspaceId: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Environment {
  id: string;
  workspaceId: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface EnvVariable {
  id: string;
  environmentId: string;
  key: string;
  value: string;
  isSecret: boolean;
  scope: VariableScope;
  scopeId: string | null;
  createdAt: string;
}

export interface AiConversation {
  id: string;
  requestId: string | null;
  messages: AiMessage[];
  createdAt: string;
}

export interface AiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface CollectionTreeNode {
  collection: Collection;
  children: CollectionTreeNode[];
  requests: ApiRequest[];
}

export interface ResolvedVariable {
  key: string;
  value: string;
  source: {
    scope: VariableScope;
    environmentName: string;
    overriddenBy?: string;
  };
}

export interface RukeExport {
  version: string;
  exportedAt: string;
  collections: Collection[];
  requests: ApiRequest[];
  environments: Environment[];
  variables: EnvVariable[];
}

export type AppView = 'home' | 'request' | 'history' | 'environments' | 'connections' | 'settings';

export interface OnboardingState {
  completed: boolean;
  currentStep: number;
  previousTool: 'postman' | 'insomnia' | 'curl' | 'none' | null;
}

export interface ApiConnection {
  id: string;
  name: string;
  baseUrl: string;
  specUrl?: string;
  specType: 'openapi' | 'graphql' | 'manual' | 'imported';
  auth: AuthConfig;
  endpoints: ApiEndpoint[];
  description?: string;
  iconColor: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiEndpoint {
  id: string;
  connectionId: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description?: string;
  parameters?: EndpointParam[];
  requestBody?: { type: BodyType; schema?: string; example?: string };
  tags?: string[];
}

export interface EndpointParam {
  name: string;
  in: 'query' | 'path' | 'header';
  required: boolean;
  type: string;
  description?: string;
}

export interface RequestThread {
  id: string;
  connectionId?: string;
  title: string;
  entries: ThreadEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ThreadEntry {
  id: string;
  type: 'user-prompt' | 'ai-message' | 'request' | 'response';
  content: string;
  request?: ApiRequest;
  response?: ApiResponse;
  timestamp: string;
}

export interface DiscoveryResult {
  name: string;
  description: string;
  baseUrl: string;
  specUrl?: string;
  specType: 'openapi' | 'graphql';
  endpointCount: number;
  endpoints: ApiEndpoint[];
  error?: string;
}
