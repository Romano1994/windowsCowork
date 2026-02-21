import './index.css';

// ── Type declarations ──
declare global {
  interface Window {
    api: {
      chat: {
        send: (message: string) => Promise<{ ok: boolean; response?: string; error?: string }>;
        clear: () => Promise<{ ok: boolean }>;
        onStreamChunk: (cb: (chunk: string) => void) => () => void;
        onStreamEnd: (cb: () => void) => () => void;
      };
      fs: {
        readDir: (path: string) => Promise<{
          ok: boolean;
          path?: string;
          entries?: Array<{ name: string; isDirectory: boolean }>;
          error?: string;
        }>;
        readFile: (path: string) => Promise<{
          ok: boolean;
          content?: string;
          truncated?: boolean;
          size?: number;
          ext?: string;
          error?: string;
        }>;
        selectFolder: () => Promise<{ ok: boolean; path?: string }>;
        getHome: () => Promise<string>;
      };
    };
  }
}

// ── DOM refs ──
const chatMessages = document.getElementById('chat-messages')!;
const chatInput = document.getElementById('chat-input') as HTMLTextAreaElement;
const btnSend = document.getElementById('btn-send') as HTMLButtonElement;
const fileList = document.getElementById('file-list')!;
const inputPath = document.getElementById('input-path') as HTMLInputElement;
const btnGoPath = document.getElementById('btn-go-path')!;
const btnParent = document.getElementById('btn-parent')!;
const btnSelectFolder = document.getElementById('btn-select-folder')!;
const taskListEl = document.getElementById('task-list')!;
const taskInput = document.getElementById('task-input') as HTMLInputElement;
const btnAddTask = document.getElementById('btn-add-task')!;
const btnClearDone = document.getElementById('btn-clear-done')!;
const taskStats = document.getElementById('task-stats')!;

// ── State ──
let currentPath = '';
let isStreaming = false;
let currentStreamEl: HTMLElement | null = null;

interface Task {
  id: number;
  text: string;
  done: boolean;
}

let tasks: Task[] = [];
let taskIdCounter = 0;

// ═══════════════════════════════════════
//  CHAT
// ═══════════════════════════════════════

function addChatMessage(text: string, type: 'user' | 'assistant' | 'error' | 'system'): HTMLElement {
  const el = document.createElement('div');
  el.className = `chat-msg ${type}`;
  el.textContent = text;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return el;
}

function createStreamMessage(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'chat-msg assistant';
  el.textContent = '';
  chatMessages.appendChild(el);
  return el;
}

async function sendChat() {
  const text = chatInput.value.trim();
  if (!text || isStreaming) return;

  addChatMessage(text, 'user');
  chatInput.value = '';
  chatInput.style.height = 'auto';

  isStreaming = true;
  btnSend.disabled = true;
  currentStreamEl = createStreamMessage();

  const result = await window.api.chat.send(text);

  if (!result.ok) {
    if (currentStreamEl && !currentStreamEl.textContent) {
      currentStreamEl.remove();
    }
    addChatMessage(result.error || '알 수 없는 오류', 'error');
  }

  isStreaming = false;
  btnSend.disabled = false;
  currentStreamEl = null;
  chatInput.focus();
}

// Stream listeners
window.api.chat.onStreamChunk((chunk: string) => {
  if (currentStreamEl) {
    currentStreamEl.textContent += chunk;
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
});

window.api.chat.onStreamEnd(() => {
  // stream done
});

btnSend.addEventListener('click', sendChat);

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChat();
  }
});

// Auto-resize textarea
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
});

// ═══════════════════════════════════════
//  FILE EXPLORER
// ═══════════════════════════════════════

async function loadDirectory(dirPath: string) {
  const result = await window.api.fs.readDir(dirPath);
  if (!result.ok) {
    fileList.innerHTML = `<li style="color:var(--red);padding:10px">${result.error}</li>`;
    return;
  }

  currentPath = result.path!;
  inputPath.value = currentPath;
  fileList.innerHTML = '';

  for (const entry of result.entries!) {
    const li = document.createElement('li');

    const icon = document.createElement('span');
    icon.className = `file-icon ${entry.isDirectory ? 'dir' : 'file'}`;
    icon.textContent = entry.isDirectory ? '\u{1F4C1}' : '\u{1F4C4}';

    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = entry.name;

    li.appendChild(icon);
    li.appendChild(name);

    li.addEventListener('click', () => {
      const fullPath = currentPath + (currentPath.endsWith('\\') || currentPath.endsWith('/') ? '' : '\\') + entry.name;
      if (entry.isDirectory) {
        loadDirectory(fullPath);
      } else {
        loadFilePreview(fullPath, entry.name);
      }
    });

    fileList.appendChild(li);
  }
}

async function loadFilePreview(filePath: string, fileName: string) {
  const result = await window.api.fs.readFile(filePath);
  if (!result.ok) {
    addChatMessage(`파일 읽기 실패: ${result.error}`, 'error');
    return;
  }

  const preview = result.content!.length > 500
    ? result.content!.slice(0, 500) + '\n... (truncated)'
    : result.content!;

  const sizeKB = ((result.size || 0) / 1024).toFixed(1);
  addChatMessage(
    `[${fileName}] (${sizeKB}KB, ${result.ext})\n${preview}`,
    'system'
  );
}

btnGoPath.addEventListener('click', () => {
  const p = inputPath.value.trim();
  if (p) loadDirectory(p);
});

inputPath.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const p = inputPath.value.trim();
    if (p) loadDirectory(p);
  }
});

btnParent.addEventListener('click', () => {
  if (!currentPath) return;
  // Go up one directory
  const sep = currentPath.includes('/') ? '/' : '\\';
  const parts = currentPath.split(sep).filter(Boolean);
  if (parts.length <= 1) {
    // Root drive on Windows (e.g., C:\)
    loadDirectory(parts[0] + '\\');
    return;
  }
  parts.pop();
  let parent = parts.join(sep);
  // Restore root slash for unix or drive letter for windows
  if (currentPath.startsWith('/')) parent = '/' + parent;
  else if (parts.length === 1 && /^[A-Za-z]:$/.test(parts[0])) parent += '\\';
  loadDirectory(parent);
});

btnSelectFolder.addEventListener('click', async () => {
  const result = await window.api.fs.selectFolder();
  if (result.ok && result.path) {
    loadDirectory(result.path);
  }
});

// ═══════════════════════════════════════
//  TASKS
// ═══════════════════════════════════════

function renderTasks() {
  taskListEl.innerHTML = '';

  for (const task of tasks) {
    const li = document.createElement('li');
    if (task.done) li.classList.add('done');

    const check = document.createElement('div');
    check.className = 'task-check';
    check.textContent = task.done ? '\u2713' : '';
    check.addEventListener('click', () => {
      task.done = !task.done;
      saveTasks();
      renderTasks();
    });

    const text = document.createElement('span');
    text.className = 'task-text';
    text.textContent = task.text;

    const del = document.createElement('button');
    del.className = 'task-delete';
    del.textContent = '\u00D7';
    del.addEventListener('click', () => {
      tasks = tasks.filter(t => t.id !== task.id);
      saveTasks();
      renderTasks();
    });

    li.appendChild(check);
    li.appendChild(text);
    li.appendChild(del);
    taskListEl.appendChild(li);
  }

  // Stats
  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  taskStats.textContent = total === 0
    ? 'No tasks'
    : `${done}/${total} completed`;
}

function addTask(text: string) {
  tasks.push({ id: ++taskIdCounter, text, done: false });
  saveTasks();
  renderTasks();
}

function saveTasks() {
  try {
    localStorage.setItem('cowork-tasks', JSON.stringify(tasks));
    localStorage.setItem('cowork-task-counter', String(taskIdCounter));
  } catch { /* ignore */ }
}

function loadTasks() {
  try {
    const saved = localStorage.getItem('cowork-tasks');
    const counter = localStorage.getItem('cowork-task-counter');
    if (saved) tasks = JSON.parse(saved);
    if (counter) taskIdCounter = parseInt(counter, 10);
  } catch { /* ignore */ }
}

btnAddTask.addEventListener('click', () => {
  const text = taskInput.value.trim();
  if (!text) return;
  addTask(text);
  taskInput.value = '';
  taskInput.focus();
});

taskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const text = taskInput.value.trim();
    if (!text) return;
    addTask(text);
    taskInput.value = '';
  }
});

btnClearDone.addEventListener('click', () => {
  tasks = tasks.filter(t => !t.done);
  saveTasks();
  renderTasks();
});

// ═══════════════════════════════════════
//  INIT
// ═══════════════════════════════════════

async function init() {
  // Load tasks from localStorage
  loadTasks();
  renderTasks();

  // Load home directory
  const home = await window.api.fs.getHome();
  loadDirectory(home);

  // Welcome message
  addChatMessage('WindowsCowork에 오신 것을 환영합니다. 무엇을 도와드릴까요?', 'system');
  chatInput.focus();
}

init();
