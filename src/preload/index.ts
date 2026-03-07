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
