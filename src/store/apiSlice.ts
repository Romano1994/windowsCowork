import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type Provider = 'anthropic' | 'openai' | 'gemini' | 'claude-code' | 'codex';

export const CLI_PROVIDERS: Provider[] = ['claude-code', 'codex'];
export const isCliProvider = (p: Provider): boolean => CLI_PROVIDERS.includes(p);

export const MODELS: Record<Provider, string[]> = {
  anthropic: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-20250514'],
  openai: ['gpt-4o', 'gpt-4o-mini'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  'claude-code': [],
  'codex': [],
};

interface SessionApiSnapshot {
  connected: boolean;
  provider: Provider;
  model: string;
}

interface ApiState {
  provider: Provider;
  model: string;
  apiKeys: Record<Provider, string>;
  connected: boolean;
  connectedSessions: Record<string, SessionApiSnapshot>;
}

const STORAGE_KEY = 'cowork-api-config';

function loadState(): ApiState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.provider && parsed.apiKeys) {
        const state = { ...parsed } as ApiState;
        // CLI providers cannot persist connections (process not alive after restart)
        if (isCliProvider(state.provider)) {
          state.connected = false;
        } else {
          state.connected = !!parsed.connected;
        }
        state.connectedSessions = {};
        return state;
      }
    }
  } catch { /* ignore */ }
  return {
    provider: 'anthropic',
    model: MODELS.anthropic[0],
    apiKeys: { anthropic: '', openai: '', gemini: '', 'claude-code': '', 'codex': '' },
    connected: false,
    connectedSessions: {},
  };
}

function saveState(state: ApiState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const initialState: ApiState = loadState();

const apiSlice = createSlice({
  name: 'api',
  initialState,
  reducers: {
    setProvider(state, action: PayloadAction<Provider>) {
      state.provider = action.payload;
      const models = MODELS[action.payload];
      state.model = models.length > 0 ? models[0] : '';
      saveState(state);
    },
    setModel(state, action: PayloadAction<string>) {
      state.model = action.payload;
      saveState(state);
    },
    setApiKey(state, action: PayloadAction<{ provider: Provider; key: string }>) {
      state.apiKeys[action.payload.provider] = action.payload.key;
      saveState(state);
    },
    setConnected(state, action: PayloadAction<boolean>) {
      state.connected = action.payload;
      saveState(state);
    },
    disconnect(state) {
      state.connected = false;
      saveState(state);
    },
    saveSessionConnected(state, action: PayloadAction<{ sessionId: string }>) {
      state.connectedSessions[action.payload.sessionId] = {
        connected: state.connected,
        provider: state.provider,
        model: state.model,
      };
    },
    restoreSessionConnected(state, action: PayloadAction<{ sessionId: string }>) {
      const snapshot = state.connectedSessions[action.payload.sessionId];
      if (snapshot) {
        state.connected = snapshot.connected;
        state.provider = snapshot.provider;
        state.model = snapshot.model;
      } else {
        state.connected = false;
      }
      saveState(state);
    },
    removeSessionConnected(state, action: PayloadAction<{ sessionId: string }>) {
      delete state.connectedSessions[action.payload.sessionId];
    },
  },
});

export const {
  setProvider, setModel, setApiKey, setConnected, disconnect,
  saveSessionConnected, restoreSessionConnected, removeSessionConnected,
} = apiSlice.actions;
export default apiSlice.reducer;
