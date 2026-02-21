import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

if (require('electron-squirrel-startup')) {
  app.quit();
}

// ── Anthropic API (lazy-loaded) ──
let anthropicClient: any = null;

function getClient() {
  if (!anthropicClient) {
    try {
      require('dotenv/config');
    } catch { /* ignore */ }
    const Anthropic = require('@anthropic-ai/sdk');
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

const conversationHistory: Array<{ role: string; content: string }> = [];

// ── IPC: Chat ──
ipcMain.handle('chat:send', async (event, userMessage: string) => {
  conversationHistory.push({ role: 'user', content: userMessage });

  try {
    const client = getClient();
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: '당신은 Windows 데스크톱 자동화를 도와주는 유능한 AI 어시스턴트입니다. 한국어로 답변합니다.',
      messages: conversationHistory,
    });

    let fullResponse = '';

    for await (const evt of stream) {
      if (evt.type === 'content_block_delta' && evt.delta.type === 'text_delta') {
        const chunk = evt.delta.text;
        fullResponse += chunk;
        event.sender.send('chat:stream-chunk', chunk);
      }
    }

    event.sender.send('chat:stream-end');
    conversationHistory.push({ role: 'assistant', content: fullResponse });
    return { ok: true, response: fullResponse };
  } catch (err: any) {
    event.sender.send('chat:stream-end');
    const msg = err.status === 401
      ? 'API 키가 유효하지 않습니다. .env 파일을 확인하세요.'
      : err.status === 429
        ? 'API 호출 한도를 초과했습니다.'
        : err.message || String(err);
    return { ok: false, error: msg };
  }
});

ipcMain.handle('chat:clear', () => {
  conversationHistory.length = 0;
  return { ok: true };
});

// ── IPC: File Explorer ──
ipcMain.handle('fs:readDir', async (_event, dirPath: string) => {
  try {
    const resolved = path.resolve(dirPath);
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    return {
      ok: true,
      path: resolved,
      entries: entries.map(e => ({
        name: e.name,
        isDirectory: e.isDirectory(),
      })).sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      }),
    };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
  try {
    const resolved = path.resolve(filePath);
    const stat = fs.statSync(resolved);
    const MAX_SIZE = 200 * 1024;
    let content = fs.readFileSync(resolved, 'utf-8');
    let truncated = false;
    if (stat.size > MAX_SIZE) {
      content = content.slice(0, MAX_SIZE);
      truncated = true;
    }
    return { ok: true, content, truncated, size: stat.size, ext: path.extname(resolved) };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('fs:selectFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return { ok: false };
  return { ok: true, path: result.filePaths[0] };
});

ipcMain.handle('fs:getHome', () => {
  return process.env.USERPROFILE || process.env.HOME || 'C:\\';
});

// ── Window ──
const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'WindowsCowork',
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
