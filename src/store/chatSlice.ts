import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ChatMessage {
  id: number;
  type: 'user' | 'assistant' | 'error' | 'system';
  text: string;
}

interface ChatState {
  messages: ChatMessage[];
  input: string;
  isStreaming: boolean;
  nextId: number;
}

const initialState: ChatState = {
  messages: [
    { id: 0, type: 'system', text: 'WindowsCowork에 오신 것을 환영합니다. 무엇을 도와드릴까요?' },
  ],
  input: '',
  isStreaming: false,
  nextId: 1,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setInput(state, action: PayloadAction<string>) {
      state.input = action.payload;
    },
    removeWelcome(state) {
      state.messages = state.messages.filter((m) => m.id !== 0);
    },
    addMessage(state, action: PayloadAction<Omit<ChatMessage, 'id'>>) {
      state.messages = state.messages.filter((m) => m.id !== 0);
      state.messages.push({ ...action.payload, id: state.nextId++ });
    },
    addMessageWithId(state, action: PayloadAction<ChatMessage>) {
      state.messages = state.messages.filter((m) => m.id !== 0);
      state.messages.push(action.payload);
      if (action.payload.id >= state.nextId) {
        state.nextId = action.payload.id + 1;
      }
    },
    allocateId(state) {
      state.nextId++;
    },
    updateMessageText(state, action: PayloadAction<{ id: number; text: string }>) {
      const msg = state.messages.find((m) => m.id === action.payload.id);
      if (msg) msg.text = action.payload.text;
    },
    removeEmptyMessage(state, action: PayloadAction<number>) {
      state.messages = state.messages.filter(
        (m) => !(m.id === action.payload && m.text === '')
      );
    },
    setStreaming(state, action: PayloadAction<boolean>) {
      state.isStreaming = action.payload;
    },
  },
});

export const {
  setInput,
  removeWelcome,
  addMessage,
  addMessageWithId,
  allocateId,
  updateMessageText,
  removeEmptyMessage,
  setStreaming,
} = chatSlice.actions;

export default chatSlice.reducer;
