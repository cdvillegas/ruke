import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/constants';

const api = {
  sendRequest: (request: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.SEND_REQUEST, request),

  db: {
    query: (method: string, ...args: any[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.DB_QUERY, { method, args }),
  },

  ai: {
    chat: (messages: any[], context?: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_CHAT, { messages, context }),
    setKey: (key: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_SET_KEY, key),
  },

  agent: {
    discover: (query: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENT_DISCOVER, query),
  },

  grpc: {
    loadProto: (filePath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GRPC_LOAD_PROTO, filePath),
    sendRequest: (request: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.GRPC_SEND_REQUEST, request),
    serverReflection: (serverUrl: string, tlsEnabled: boolean) =>
      ipcRenderer.invoke(IPC_CHANNELS.GRPC_SERVER_REFLECTION, { serverUrl, tlsEnabled }),
    cancelStream: (streamId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GRPC_CANCEL_STREAM, streamId),
  },

  scripting: {
    run: (script: string, context: any, phase: 'pre-request' | 'post-response') =>
      ipcRenderer.invoke(IPC_CHANNELS.RUN_SCRIPT, { script, context, phase }),
  },

  oauth2: {
    authorize: (authorizationUrl: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.OAUTH2_AUTHORIZE, { authorizationUrl }),
  },

  ws: {
    connect: (id: string, url: string, protocols?: string[], headers?: Record<string, string>) =>
      ipcRenderer.invoke(IPC_CHANNELS.WS_CONNECT, { id, url, protocols, headers }),
    send: (id: string, data: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.WS_SEND, { id, data }),
    close: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.WS_CLOSE, { id }),
    onEvent: (id: string, callback: (event: any) => void) => {
      const channel = `ws:event:${id}`;
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
  },

  file: {
    export: (data: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.EXPORT_FILE, data),
    import: (filters?: { name: string; extensions: string[] }[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.IMPORT_FILE, filters),
  },

  getAppPath: () => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_PATH),
};

contextBridge.exposeInMainWorld('ruke', api);

export type RukeAPI = typeof api;
