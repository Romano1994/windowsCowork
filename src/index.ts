import { app, BrowserWindow, ipcMain, dialog, clipboard, safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// ── Error Logging (using fixed path before app.ready) ──
const logFile = path.join(process.env.APPDATA || '', 'windows-cowork-error.log');

const writeLog = (message: string) => {
  try {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
    console.log(`[LOG] ${message}`);
  } catch (e) {
    console.error(`Failed to write log: ${e}`);
  }
};

const isConptyConsoleListAgent =
  process.platform === 'win32' &&
  typeof process.argv[1] === 'string' &&
  process.argv[1].toLowerCase().includes('conpty_console_list_agent');

if (isConptyConsoleListAgent) {
  const shellPid = Number.parseInt(process.argv[2] || '', 10);

  try {
    const utilsPath = path.join(path.dirname(process.argv[1]), 'utils');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { loadNativeModule } = require(utilsPath);
    const getConsoleProcessList = loadNativeModule('conpty_console_list').module.getConsoleProcessList;
    const consoleProcessList = Number.isNaN(shellPid) ? [] : getConsoleProcessList(shellPid);

    if (typeof process.send === 'function') {
      process.send({ consoleProcessList });
    }
  } catch (error: any) {
    const message = error?.message || String(error);
    writeLog(`[conpty-agent] failed: ${message}`);

    if (!Number.isNaN(shellPid) && typeof process.send === 'function') {
      process.send({ consoleProcessList: [shellPid] });
    }
  }

  process.exit(0);
}

// Write startup message before anything else
try {
  writeLog('=== Application Started ===');
} catch (e) {
  console.error('Failed to initialize logging');
}

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
  writeLog(`UNCAUGHT EXCEPTION: ${error.message}\n${error.stack}`);
  console.error(error);
});

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  writeLog(`UNHANDLED REJECTION: ${reason}`);
  console.error(reason);
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
let pty: any;
try {
  writeLog(`Node modules path: ${__dirname}/node_modules/node-pty`);
  pty = require('node-pty');
  writeLog('✓ node-pty loaded successfully');
} catch (error: any) {
  const errorMsg = error?.message || String(error);
  const errorStack = error?.stack || '';
  writeLog(`✗ Failed to load node-pty: ${errorMsg}\nStack: ${errorStack}`);
  console.error('node-pty load error:', error);
  // Don't throw - continue anyway for now
  pty = null;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
let pdfParse: any;
try {
  pdfParse = require('pdf-parse');
  writeLog('✓ pdf-parse loaded');
} catch (e: any) {
  writeLog(`✗ pdf-parse failed: ${e.message}`);
  pdfParse = null;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
let parseOfficeAsync: any;
try {
  ({ parseOfficeAsync } = require('officeparser'));
  writeLog('✓ officeparser loaded');
} catch (e: any) {
  writeLog(`✗ officeparser failed: ${e.message}`);
  parseOfficeAsync = null;
}

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

writeLog(`process.argv: ${process.argv.join(' ')}`);

// Handle Squirrel events (install, update, uninstall)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const isSquirrelStartup = require('electron-squirrel-startup');
if (isSquirrelStartup) {
  writeLog('Squirrel startup detected → app.quit()');
  app.quit();
  process.exit(0);
} else {
  writeLog('✓ Not a squirrel event, continuing...');
}

// ── API Config ──
let apiConfig = {
  provider: 'anthropic' as 'anthropic' | 'openai' | 'gemini' | 'claude-code' | 'codex',
  model: 'claude-sonnet-4-20250514',
  apiKey: '',
};

// ── Encrypted API Key Storage ──
type Provider = 'anthropic' | 'openai' | 'gemini' | 'claude-code' | 'codex';

const getApiKeysPath = () => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'api-keys.json');
};

/**
 * loadApiKeys - 암호화된 API 키 불러오기
 */
function loadApiKeys(): Record<Provider, string> {
  const defaultKeys: Record<Provider, string> = {
    anthropic: '',
    openai: '',
    gemini: '',
    'claude-code': '',
    codex: '',
  };

  try {
    const keysPath = getApiKeysPath();
    if (!fs.existsSync(keysPath)) {
      return defaultKeys;
    }

    const encrypted = fs.readFileSync(keysPath, 'utf-8');
    const parsed = JSON.parse(encrypted);

    // safeStorage가 사용 가능한지 확인
    if (!safeStorage.isEncryptionAvailable()) {
      writeLog('WARNING: safeStorage encryption not available');
      return defaultKeys;
    }

    // 각 제공자별로 복호화
    const decrypted: Record<Provider, string> = { ...defaultKeys };
    for (const provider of Object.keys(parsed) as Provider[]) {
      if (parsed[provider]) {
        try {
          const buffer = Buffer.from(parsed[provider], 'base64');
          decrypted[provider] = safeStorage.decryptString(buffer);
        } catch (err) {
          writeLog(`Failed to decrypt API key for ${provider}: ${err}`);
        }
      }
    }

    return decrypted;
  } catch (err) {
    writeLog(`Failed to load API keys: ${err}`);
    return defaultKeys;
  }
}

/**
 * saveApiKey - API 키를 암호화하여 저장
 */
function saveApiKey(provider: Provider, apiKey: string): boolean {
  try {
    const keysPath = getApiKeysPath();

    // 기존 키 로드
    let keys: Record<string, string> = {};
    if (fs.existsSync(keysPath)) {
      const encrypted = fs.readFileSync(keysPath, 'utf-8');
      keys = JSON.parse(encrypted);
    }

    // safeStorage가 사용 가능한지 확인
    if (!safeStorage.isEncryptionAvailable()) {
      writeLog('WARNING: safeStorage encryption not available');
      return false;
    }

    // API 키 암호화
    if (apiKey) {
      const buffer = safeStorage.encryptString(apiKey);
      keys[provider] = buffer.toString('base64');
    } else {
      // 빈 문자열이면 키 삭제
      delete keys[provider];
    }

    // 파일에 저장
    fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2), 'utf-8');
    return true;
  } catch (err) {
    writeLog(`Failed to save API key for ${provider}: ${err}`);
    return false;
  }
}

/**
 * getApiKey - 복호화된 API 키 가져오기
 */
function getApiKey(provider: Provider): string {
  const keys = loadApiKeys();
  return keys[provider] || '';
}

/**
 * deleteApiKey - API 키 삭제
 */
function deleteApiKey(provider: Provider): boolean {
  return saveApiKey(provider, '');
}

// ── CLI Processes (multi-PTY per session) ──
interface PtyEntry {
  proc: any;
  provider: string;
  scrollback: string;
}
const cliProcesses = new Map<string, PtyEntry>();
const MAX_SCROLLBACK = 100_000;

const CLI_COMMANDS: Record<string, { cmd: string; args: string[] }> = {
  'claude-code': { cmd: 'claude', args: [] },
  'codex': { cmd: 'codex', args: [] },
};

const SYSTEM_PROMPT = '당신은 Windows 데스크톱 자동화를 도와주는 유능한 AI 어시스턴트입니다. 한국어로 답변합니다.';

const conversationHistory: Array<{ role: string; content: string | any[] }> = [];

// ── IPC: API restore (no validation, sync from renderer on startup) ──
ipcMain.handle('api:restore', (_event, config: { provider: string; model: string }) => {
  // 암호화된 저장소에서 API 키 복원
  const apiKey = getApiKey(config.provider as Provider);

  apiConfig = {
    provider: config.provider as typeof apiConfig.provider,
    model: config.model,
    apiKey,
  };
});

// ── IPC: API Model (no validation, just update) ──
ipcMain.handle('api:setModel', (_event, model: string) => {
  apiConfig.model = model;
});

// ── IPC: Encrypted API Key Management ──
ipcMain.handle('api:setApiKey', (_event, provider: Provider, apiKey: string) => {
  const success = saveApiKey(provider, apiKey);
  if (success && provider === apiConfig.provider) {
    apiConfig.apiKey = apiKey;
  }
  return { ok: success };
});

ipcMain.handle('api:getApiKey', (_event, provider: Provider) => {
  return getApiKey(provider);
});

ipcMain.handle('api:deleteApiKey', (_event, provider: Provider) => {
  const success = deleteApiKey(provider);
  if (success && provider === apiConfig.provider) {
    apiConfig.apiKey = '';
  }
  return { ok: success };
});

ipcMain.handle('api:getAllApiKeys', () => {
  return loadApiKeys();
});

ipcMain.handle('api:migrateFromLocalStorage', (_event, oldKeys: Record<Provider, string>) => {
  try {
    let migrated = 0;
    for (const provider of Object.keys(oldKeys) as Provider[]) {
      const key = oldKeys[provider];
      if (key && key.trim() !== '') {
        const success = saveApiKey(provider, key);
        if (success) {
          migrated++;
        }
      }
    }
    writeLog(`Migrated ${migrated} API keys from localStorage to encrypted storage`);
    return { ok: true, migrated };
  } catch (err) {
    writeLog(`Migration failed: ${err}`);
    return { ok: false, error: String(err) };
  }
});

// ── Helper: Get main window dynamically ──
function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows();
  // DevTools가 아닌 메인 윈도우만 필터링
  const mainWindow = windows.find(w => w.webContents.getType() === 'window');
  return mainWindow || null;
}

// ── IPC: CLI Process (multi-PTY) ──
ipcMain.handle('cli:connect', (_event, sessionId: string, provider: string, cwd?: string) => {
  // If a PTY already exists for this session, just reattach
  if (cliProcesses.has(sessionId)) {
    return { ok: true, existing: true };
  }

  const mapping = CLI_COMMANDS[provider];
  if (!mapping) {
    writeLog(`[pty:${sessionId}] Unknown CLI provider: ${provider}`);
    return { ok: false, error: `Unknown CLI provider: ${provider}` };
  }

  try {
    const isWin = process.platform === 'win32';
    const file = isWin ? 'cmd.exe' : mapping.cmd;
    const args = isWin
      ? ['/C', mapping.cmd, ...mapping.args]
      : mapping.args;

    writeLog(`[pty:${sessionId}] spawning: ${file} ${args.join(' ')}`);

    const proc = pty.spawn(file, args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: cwd || process.env.USERPROFILE || process.env.HOME || '.',
      env: { ...process.env, FORCE_COLOR: '1' } as Record<string, string>,
    });

    writeLog(`[pty:${sessionId}] spawned, pid: ${proc.pid}`);

    const entry: PtyEntry = { proc, provider, scrollback: '' };
    cliProcesses.set(sessionId, entry);

    proc.onData((data: string) => {
      // Accumulate scrollback
      entry.scrollback += data;
      if (entry.scrollback.length > MAX_SCROLLBACK) {
        entry.scrollback = entry.scrollback.slice(-MAX_SCROLLBACK);
      }
      const win = getMainWindow();  // 매번 동적으로 조회
      if (win && !win.isDestroyed()) {
        win.webContents.send('cli:output', sessionId, data);
      }
    });

    proc.onExit(({ exitCode }: { exitCode: number }) => {
      writeLog(`[pty:${sessionId}:exit] code=${exitCode}`);
      const win = getMainWindow();  // 동적 조회
      if (win && !win.isDestroyed()) {
        win.webContents.send('cli:exit', sessionId, exitCode);
      }
      cliProcesses.delete(sessionId);
    });

    return { ok: true };
  } catch (err: any) {
    writeLog(`[pty:${sessionId}] spawn error: ${err.message || String(err)}`);
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('cli:disconnect', (_event, sessionId: string) => {
  const entry = cliProcesses.get(sessionId);
  if (entry) {
    entry.proc.kill();
    cliProcesses.delete(sessionId);
  }
  return { ok: true };
});

ipcMain.on('cli:send', (_event, sessionId: string, data: string) => {
  const entry = cliProcesses.get(sessionId);
  if (entry) {
    entry.proc.write(data);
  }
});

// ── Clipboard ──
ipcMain.on('clipboard:readText', (event) => {
  event.returnValue = clipboard.readText();
});

ipcMain.on('clipboard:writeText', (_event, text: string) => {
  clipboard.writeText(text);
});

ipcMain.on('cli:resize', (_event, sessionId: string, cols: number, rows: number) => {
  const entry = cliProcesses.get(sessionId);
  if (entry) {
    try { entry.proc.resize(cols, rows); } catch { /* ignore */ }
  }
});

ipcMain.handle('cli:exists', (_event, sessionId: string) => {
  return { exists: cliProcesses.has(sessionId) };
});

ipcMain.handle('cli:getScrollback', (_event, sessionId: string) => {
  const entry = cliProcesses.get(sessionId);
  if (entry) {
    return { ok: true, data: entry.scrollback };
  }
  return { ok: false, data: '' };
});

// ── IPC: API Config (validates key with a small test call) ──
ipcMain.handle('api:setConfig', async (_event, config: { provider: string; model: string; apiKey: string }) => {
  const { provider, model, apiKey } = config;

  // CLI providers skip validation
  if (provider === 'claude-code' || provider === 'codex') {
    apiConfig = { provider: provider as typeof apiConfig.provider, model, apiKey: '' };
    return { ok: true };
  }

  try {
    if (provider === 'anthropic') {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model, max_tokens: 10,
        messages: [{ role: 'user', content: 'hi' }],
      });
    } else if (provider === 'openai') {
      const { default: OpenAI } = require('openai');
      const client = new OpenAI({ apiKey });
      await client.chat.completions.create({
        model, max_tokens: 10,
        messages: [{ role: 'user', content: 'hi' }],
      });
    } else if (provider === 'gemini') {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const m = genAI.getGenerativeModel({ model });
      await m.generateContent('hi');
    }

    // API 키 검증 성공 - 암호화하여 저장
    const saved = saveApiKey(provider as Provider, apiKey);
    if (!saved) {
      return { ok: false, error: 'API 키 암호화 저장 실패' };
    }

    apiConfig = { provider: provider as typeof apiConfig.provider, model, apiKey };
    return { ok: true };
  } catch (err: any) {
    const msg = err.status === 401 || err.message?.includes('API key')
      ? 'API 키가 유효하지 않습니다.'
      : err.message || String(err);
    return { ok: false, error: msg };
  }
});

// ── Provider-specific streaming ──
async function streamAnthropic(event: Electron.IpcMainInvokeEvent) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: apiConfig.apiKey || process.env.ANTHROPIC_API_KEY });

  const stream = await client.messages.stream({
    model: apiConfig.model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
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
  return fullResponse;
}

async function streamOpenAI(event: Electron.IpcMainInvokeEvent) {
  const { default: OpenAI } = require('openai');
  const client = new OpenAI({ apiKey: apiConfig.apiKey });

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversationHistory.map((m) => ({
      role: m.role,
      content: typeof m.content === 'string'
        ? m.content
        : m.content.map((block: any) => {
            if (block.type === 'text') return { type: 'text', text: block.text };
            if (block.type === 'image') return {
              type: 'image_url',
              image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` },
            };
            return { type: 'text', text: JSON.stringify(block) };
          }),
    })),
  ];

  const stream = await client.chat.completions.create({
    model: apiConfig.model,
    messages,
    stream: true,
  });

  let fullResponse = '';
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) {
      fullResponse += delta;
      event.sender.send('chat:stream-chunk', delta);
    }
  }
  return fullResponse;
}

async function streamGemini(event: Electron.IpcMainInvokeEvent) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiConfig.apiKey);
  const model = genAI.getGenerativeModel({ model: apiConfig.model });

  // Build Google-format history (roles: 'user' | 'model')
  const history = conversationHistory.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: typeof m.content === 'string'
      ? [{ text: m.content }]
      : m.content.map((block: any) => {
          if (block.type === 'text') return { text: block.text };
          if (block.type === 'image') return {
            inlineData: { mimeType: block.source.media_type, data: block.source.data },
          };
          return { text: JSON.stringify(block) };
        }),
  }));

  const lastMsg = conversationHistory[conversationHistory.length - 1];
  const userParts = typeof lastMsg.content === 'string'
    ? [{ text: lastMsg.content }]
    : lastMsg.content.map((block: any) => {
        if (block.type === 'text') return { text: block.text };
        if (block.type === 'image') return {
          inlineData: { mimeType: block.source.media_type, data: block.source.data },
        };
        return { text: JSON.stringify(block) };
      });

  const chat = model.startChat({
    history,
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
  });

  const result = await chat.sendMessageStream(userParts);

  let fullResponse = '';
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      fullResponse += text;
      event.sender.send('chat:stream-chunk', text);
    }
  }
  return fullResponse;
}

// ── IPC: Chat ──
ipcMain.handle('chat:send', async (event, userMessage: string | any[]) => {
  conversationHistory.push({ role: 'user', content: userMessage });

  try {
    let fullResponse: string;

    switch (apiConfig.provider) {
      case 'openai':
        fullResponse = await streamOpenAI(event);
        break;
      case 'gemini':
        fullResponse = await streamGemini(event);
        break;
      default:
        fullResponse = await streamAnthropic(event);
        break;
    }

    event.sender.send('chat:stream-end');
    conversationHistory.push({ role: 'assistant', content: fullResponse });
    return { ok: true, response: fullResponse };
  } catch (err: any) {
    event.sender.send('chat:stream-end');
    const msg = err.status === 401
      ? 'API 키가 유효하지 않습니다.'
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

import { IMAGE_EXTENSIONS, SUPPORTED_EXTENSIONS, MEDIA_TYPES } from './constants/extensions';

ipcMain.handle('fs:readFileForAI', async (_event, filePath: string) => {
  try {
    const resolved = path.resolve(filePath);
    const ext = path.extname(resolved).toLowerCase();

    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      return {
        ok: false,
        error: `지원하지 않는 파일 형식입니다: ${ext}\n지원 형식: 이미지(png, jpg, gif, webp), PDF, PPTX, DOCX, XLSX, 텍스트 파일`,
      };
    }

    // Image files → base64 for Claude vision
    if (IMAGE_EXTENSIONS.includes(ext)) {
      const buffer = fs.readFileSync(resolved);
      const base64 = buffer.toString('base64');
      return {
        ok: true,
        type: 'image' as const,
        media_type: MEDIA_TYPES[ext],
        data: base64,
        fileName: path.basename(resolved),
      };
    }

    // PDF → extract text with pdf-parse
    if (ext === '.pdf') {
      const buffer = fs.readFileSync(resolved);
      const pdf = await pdfParse(buffer);
      return {
        ok: true,
        type: 'text' as const,
        content: pdf.text,
        fileName: path.basename(resolved),
      };
    }

    // PPTX/DOCX/XLSX → extract text with officeparser
    if (ext === '.pptx' || ext === '.docx' || ext === '.xlsx') {
      const text = await parseOfficeAsync(resolved);
      return {
        ok: true,
        type: 'text' as const,
        content: text,
        fileName: path.basename(resolved),
      };
    }

    // Fallback: read as UTF-8 text
    const stat = fs.statSync(resolved);
    const MAX_SIZE = 200 * 1024;
    let content = fs.readFileSync(resolved, 'utf-8');
    if (stat.size > MAX_SIZE) {
      content = content.slice(0, MAX_SIZE);
    }
    return {
      ok: true,
      type: 'text' as const,
      content,
      fileName: path.basename(resolved),
    };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
  try {
    const resolved = path.resolve(filePath);
    fs.writeFileSync(resolved, content, 'utf-8');
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('fs:exists', async (_event, filePath: string) => {
  try {
    const resolved = path.resolve(filePath);
    return { ok: true, exists: fs.existsSync(resolved) };
  } catch (err: any) {
    return { ok: false, exists: false, error: err.message };
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
  writeLog('createWindow() called');
  try {
    const mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      title: 'FreiCowork',
      webPreferences: {
        preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    writeLog(`Window created, loading URL: ${MAIN_WINDOW_WEBPACK_ENTRY}`);
    mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
    writeLog('loadURL called');
  } catch (e: any) {
    writeLog(`✗ createWindow error: ${e.message}\n${e.stack}`);
  }
};

app.on('before-quit', () => {
  for (const [, entry] of cliProcesses) {
    entry.proc.kill();
  }
  cliProcesses.clear();
});

app.on('ready', () => {
  writeLog('app.ready event fired');
  createWindow();
});

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
