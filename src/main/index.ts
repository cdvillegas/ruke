import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { initDatabase } from './db/schema';
import { createRepository } from './db/repository';
import { HttpEngine } from './http/engine';
import { AiService } from './ai/service';
import { IPC_CHANNELS } from '../shared/constants';
import fs from 'fs';
import { autoUpdater } from 'electron-updater';

let mainWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f0f1a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  const dbPath = path.join(app.getPath('userData'), 'ruke.db');
  const db = initDatabase(dbPath);
  const repo = createRepository(db);
  const httpEngine = new HttpEngine();
  const aiService = new AiService();

  ipcMain.handle(IPC_CHANNELS.SEND_REQUEST, async (_event, request) => {
    return httpEngine.send(request);
  });

  ipcMain.handle(IPC_CHANNELS.DB_QUERY, async (_event, { method, args }) => {
    const fn = (repo as any)[method];
    if (typeof fn === 'function') {
      return fn.apply(repo, args || []);
    }
    throw new Error(`Unknown repository method: ${method}`);
  });

  ipcMain.handle(IPC_CHANNELS.AI_CHAT, async (_event, { messages, context }) => {
    return aiService.chat(messages, context);
  });

  ipcMain.handle(IPC_CHANNELS.AI_SET_KEY, async (_event, key: string) => {
    aiService.setApiKey(key);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.EXPORT_FILE, async (_event, data: string) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: 'collection.ruke',
      filters: [{ name: 'Rüke Collection', extensions: ['ruke'] }],
    });
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, data, 'utf-8');
      return { success: true, path: result.filePath };
    }
    return { success: false };
  });

  ipcMain.handle(IPC_CHANNELS.IMPORT_FILE, async (_event, filters?: { name: string; extensions: string[] }[]) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      filters: filters || [
        { name: 'Rüke / Postman Collection', extensions: ['ruke', 'json'] },
      ],
      properties: ['openFile'],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const content = fs.readFileSync(result.filePaths[0], 'utf-8');
      return { success: true, content, path: result.filePaths[0] };
    }
    return { success: false };
  });

  ipcMain.handle(IPC_CHANNELS.GET_APP_PATH, async () => {
    return app.getPath('userData');
  });

  createWindow();

  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
