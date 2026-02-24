import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type Provider = 'anthropic' | 'openai' | 'google';

export const MODELS: Record<Provider, string[]> = {
  anthropic: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-20250514'],
  openai: ['gpt-4o', 'gpt-4o-mini'],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash'],
};

interface ApiState {
  provider: Provider;
  model: string;
  apiKeys: Record<Provider, string>;
  connected: boolean;
}

const STORAGE_KEY = 'cowork-api-config';

function loadState(): ApiState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.provider && parsed.model && parsed.apiKeys) {
        return { ...parsed, connected: !!parsed.connected } as ApiState;
      }
    }
  } catch { /* ignore */ }
  return {
    provider: 'anthropic',
    model: MODELS.anthropic[0],
    apiKeys: { anthropic: '', openai: '', google: '' },
    connected: false,
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
      state.model = MODELS[action.payload][0];
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
  },
});

export const { setProvider, setModel, setApiKey, setConnected, disconnect } = apiSlice.actions;
export default apiSlice.reducer;
