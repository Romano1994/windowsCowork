import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ChatMessage } from './chatSlice';
import type { Task } from './taskSlice';

export interface Session {
  id: string;
  name: string;
  path: string;
  messages: ChatMessage[];
  tasks: Task[];
  taskCounter: number;
}

interface SessionState {
  sessions: Session[];
  activeId: string | null;
}

const STORAGE_KEY = 'cowork-sessions';

function loadState(): SessionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.sessions)) {
        return parsed as SessionState;
      }
    }
  } catch { /* ignore */ }
  return { sessions: [], activeId: null };
}

function saveState(state: SessionState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

const initialState: SessionState = loadState();

export interface SessionSnapshot {
  messages: ChatMessage[];
  nextId: number;
  tasks: Task[];
  taskCounter: number;
  currentPath: string;
}

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    addSession(state, action: PayloadAction<{ name: string; path: string }>) {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const session: Session = {
        id,
        name: action.payload.name,
        path: action.payload.path,
        messages: [],
        tasks: [],
        taskCounter: 0,
      };
      state.sessions.push(session);
      state.activeId = id;
      saveState(state);
    },
    deleteSession(state, action: PayloadAction<string>) {
      state.sessions = state.sessions.filter((s) => s.id !== action.payload);
      if (state.activeId === action.payload) {
        state.activeId = state.sessions.length > 0 ? state.sessions[0].id : null;
      }
      saveState(state);
    },
    switchSession(state, action: PayloadAction<string>) {
      const target = state.sessions.find((s) => s.id === action.payload);
      if (target) {
        state.activeId = action.payload;
      }
      saveState(state);
    },
    renameSession(state, action: PayloadAction<{ id: string; name: string }>) {
      const session = state.sessions.find((s) => s.id === action.payload.id);
      if (session) {
        session.name = action.payload.name;
      }
      saveState(state);
    },
    saveCurrentState(state, action: PayloadAction<SessionSnapshot>) {
      if (!state.activeId) return;
      const session = state.sessions.find((s) => s.id === state.activeId);
      if (session) {
        session.messages = action.payload.messages;
        session.tasks = action.payload.tasks;
        session.taskCounter = action.payload.taskCounter;
        session.path = action.payload.currentPath;
      }
      saveState(state);
    },
    updateSessionPath(state, action: PayloadAction<{ id: string; path: string }>) {
      const session = state.sessions.find((s) => s.id === action.payload.id);
      if (session) {
        session.path = action.payload.path;
      }
      saveState(state);
    },
  },
});

export const {
  addSession,
  deleteSession,
  switchSession,
  renameSession,
  saveCurrentState,
  updateSessionPath,
} = sessionSlice.actions;

export default sessionSlice.reducer;
