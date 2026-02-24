import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parseOfficeAsync } = require('officeparser');

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

if (require('electron-squirrel-startup')) {
  app.quit();
}

// ── API Config ──
let apiConfig = {
  provider: 'anthropic' as 'anthropic' | 'openai' | 'google',
  model: 'claude-sonnet-4-20250514',
  apiKey: '',
};

const SYSTEM_PROMPT = '당신은 Windows 데스크톱 자동화를 도와주는 유능한 AI 어시스턴트입니다. 한국어로 답변합니다.';

const conversationHistory: Array<{ role: string; content: string | any[] }> = [];

// ── IPC: API Model (no validation, just update) ──
ipcMain.handle('api:setModel', (_event, model: string) => {
  apiConfig.model = model;
});

// ── IPC: API Config (validates key with a small test call) ──
ipcMain.handle('api:setConfig', async (_event, config: { provider: string; model: string; apiKey: string }) => {
  const { provider, model, apiKey } = config;

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
    } else if (provider === 'google') {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const m = genAI.getGenerativeModel({ model });
      await m.generateContent('hi');
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

async function streamGoogle(event: Electron.IpcMainInvokeEvent) {
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
      case 'google':
        fullResponse = await streamGoogle(event);
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

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const TEXT_EXTENSIONS = [
  '.txt', '.md', '.csv', '.json', '.xml', '.html', '.htm', '.css',
  '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h',
  '.cs', '.rb', '.go', '.rs', '.sh', '.bat', '.ps1', '.yaml', '.yml',
  '.toml', '.ini', '.cfg', '.conf', '.log', '.sql', '.r', '.swift',
];
const SUPPORTED_EXTENSIONS = [...IMAGE_EXTENSIONS, '.pdf', '.pptx', '.docx', '.xlsx', ...TEXT_EXTENSIONS];
const MEDIA_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

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
