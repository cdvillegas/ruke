export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type BodyType = 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary' | 'graphql';

export type AuthType = 'none' | 'bearer' | 'basic' | 'api-key' | 'oauth2';

export type VariableScope = 'global' | 'collection' | 'folder' | 'request';

export interface KeyValue {
  key: string;
  value: string;
  enabled: boolean;
}

export interface OAuth2Config {
  grantType: 'authorization_code' | 'client_credentials' | 'password' | 'implicit';
  clientId: string;
  clientSecret?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  redirectUri?: string;
  scope?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: string;
  usePkce?: boolean;
  codeVerifier?: string;
  username?: string;
  password?: string;
}

export interface AuthConfig {
  type: AuthType;
  bearer?: { token: string };
  basic?: { username: string; password: string };
  apiKey?: { key: string; value: string; addTo: 'header' | 'query' };
  oauth2?: OAuth2Config;
}

export interface RequestBody {
  type: BodyType;
  raw?: string;
  formData?: KeyValue[];
  urlEncoded?: KeyValue[];
  binary?: string;
  graphql?: { query: string; variables: string; operationName?: string };
}

export interface ScriptConfig {
  preRequest?: string;
  postResponse?: string;
}

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration?: number;
}

export interface ScriptContext {
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  };
  response?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    duration: number;
  };
  variables: Record<string, string>;
  testResults: TestResult[];
}

export interface ApiRequest {
  id: string;
  collectionId: string | null;
  connectionId?: string;
  endpointId?: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: RequestBody;
  auth: AuthConfig;
  scripts?: ScriptConfig;
  options?: RequestOptions;
  archived?: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RequestOptions {
  timeout?: number;
  followRedirects?: boolean;
  maxRedirects?: number;
  proxy?: { host: string; port: number; auth?: { username: string; password: string } };
}

export interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  /** When the response is binary, body is base64-encoded and this is set to 'base64'. */
  bodyEncoding?: 'base64';
  size: number;
  duration: number;
  timestamp: string;
  redirected?: boolean;
  finalUrl?: string;
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
  archived?: boolean;
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

export type ProtocolType = 'rest' | 'graphql' | 'grpc';

export type GrpcMethodType = 'unary' | 'server_streaming' | 'client_streaming' | 'bidi_streaming';

export interface ProtoField {
  name: string;
  type: string;
  repeated: boolean;
  mapKey?: string;
  mapValue?: string;
  oneofGroup?: string;
  nested?: ProtoField[];
  enumValues?: string[];
  comment?: string;
}

export interface ProtoMessageType {
  name: string;
  fullName: string;
  fields: ProtoField[];
}

export interface ProtoMethod {
  name: string;
  fullName: string;
  serviceName: string;
  inputType: string;
  outputType: string;
  methodType: GrpcMethodType;
  inputFields?: ProtoField[];
  outputFields?: ProtoField[];
  comment?: string;
}

export interface ProtoService {
  name: string;
  fullName: string;
  methods: ProtoMethod[];
  comment?: string;
}

export interface ProtoDefinition {
  packageName: string;
  services: ProtoService[];
  messageTypes: ProtoMessageType[];
  filePath: string;
}

export interface GrpcMetadata {
  key: string;
  value: string;
  enabled: boolean;
}

export interface GrpcRequest {
  id: string;
  collectionId: string | null;
  name: string;
  protocol: 'grpc';
  serverUrl: string;
  protoFilePath: string;
  serviceName: string;
  methodName: string;
  methodType: GrpcMethodType;
  message: string;
  metadata: GrpcMetadata[];
  tlsEnabled: boolean;
  deadline?: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface GrpcStreamMessage {
  id: string;
  direction: 'sent' | 'received';
  data: string;
  timestamp: string;
  index: number;
}

export interface GrpcResponse {
  status: number;
  statusMessage: string;
  metadata: Record<string, string>;
  trailers: Record<string, string>;
  body: string;
  messages: GrpcStreamMessage[];
  duration: number;
  timestamp: string;
}

export type AppView = 'chats' | 'requests' | 'history' | 'environments' | 'connections' | 'settings';

export interface ChatToolCall {
  id: string;
  name: string;
  arguments: string;
  result?: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

export interface ChatAttachment {
  name: string;
  size: number;
  content: string;
}

export type ContextMentionType = 'request' | 'environment' | 'connection' | 'collection';

export interface ContextMention {
  type: ContextMentionType;
  id: string;
  label: string;
  meta?: string;
}

export interface QueuedMessage {
  content: string;
  attachments?: ChatAttachment[];
  mentions?: ContextMention[];
  mode: 'agent' | 'ask' | 'plan';
}

export type PlanStepStatus = 'pending' | 'in_progress' | 'done' | 'failed' | 'skipped';
export type PlanStatus = 'draft' | 'in_progress' | 'completed' | 'failed';

export interface PlanStep {
  id: string;
  description: string;
  status: PlanStepStatus;
}

export interface Plan {
  id: string;
  title: string;
  steps: PlanStep[];
  status: PlanStatus;
  chatSessionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  toolCalls?: ChatToolCall[];
  toolCallId?: string;
  attachments?: ChatAttachment[];
  timestamp: string;
  mode?: string;
  model?: string;
  planId?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

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
  specType: 'openapi' | 'graphql' | 'grpc' | 'manual' | 'imported';
  auth: AuthConfig;
  endpoints: ApiEndpoint[];
  description?: string;
  iconColor: string;
  iconLetter?: string;
  iconName?: string;
  protoDefinition?: ProtoDefinition;
  archived?: boolean;
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
  in: 'query' | 'path' | 'header' | 'body';
  required: boolean;
  type: string;
  description?: string;
  enumValues?: string[];
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
  specType: 'openapi' | 'graphql' | 'grpc';
  endpointCount: number;
  endpoints: ApiEndpoint[];
  protoDefinition?: ProtoDefinition;
  error?: string;
}

export interface WebSocketMessage {
  id: string;
  direction: 'sent' | 'received';
  data: string;
  type: 'text' | 'binary' | 'ping' | 'pong';
  timestamp: string;
}

export interface WebSocketConnection {
  id: string;
  url: string;
  status: 'connecting' | 'open' | 'closing' | 'closed' | 'error';
  protocols?: string[];
  headers?: KeyValue[];
  messages: WebSocketMessage[];
  connectedAt?: string;
  disconnectedAt?: string;
  error?: string;
}

export interface CollectionRunResult {
  collectionId: string;
  collectionName: string;
  startedAt: string;
  completedAt: string;
  duration: number;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  results: CollectionRunEntry[];
}

export interface CollectionRunEntry {
  requestId: string;
  requestName: string;
  method: HttpMethod;
  url: string;
  status: number;
  statusText: string;
  duration: number;
  testResults: TestResult[];
  passed: boolean;
  error?: string;
}
