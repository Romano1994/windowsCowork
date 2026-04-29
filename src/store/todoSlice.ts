/**
 * store/todoSlice.ts - TODO 패널 상태 관리
 *
 * 세션의 작업 디렉토리에 TODO.md 파일로 영속화되는 구조화된 TODO를 관리합니다.
 * localStorage를 쓰지 않고, TODO.md 파일이 single source of truth입니다.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Todo } from '../utils/todoMarkdown';
import { newTodoId } from '../utils/todoMarkdown';

export type { Todo };

interface TodoState {
  isOpen: boolean;
  todos: Todo[];
  loadedPath: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: TodoState = {
  isOpen: false,
  todos: [],
  loadedPath: null,
  loading: false,
  error: null,
};

const todoSlice = createSlice({
  name: 'todo',
  initialState,
  reducers: {
    toggleTodoPanel(state) {
      state.isOpen = !state.isOpen;
    },
    setTodoPanelOpen(state, action: PayloadAction<boolean>) {
      state.isOpen = action.payload;
    },
    setTodos(state, action: PayloadAction<{ todos: Todo[]; loadedPath: string }>) {
      state.todos = action.payload.todos;
      state.loadedPath = action.payload.loadedPath;
      state.loading = false;
      state.error = null;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.loading = false;
    },
    clearTodos(state) {
      state.todos = [];
      state.loadedPath = null;
      state.error = null;
    },
    addTodo(state, action: PayloadAction<{ title: string; description: string }>) {
      state.todos.push({
        id: newTodoId(),
        title: action.payload.title,
        description: action.payload.description,
      });
    },
    updateTodo(state, action: PayloadAction<{ id: string; title: string; description: string }>) {
      const t = state.todos.find((x) => x.id === action.payload.id);
      if (t) {
        t.title = action.payload.title;
        t.description = action.payload.description;
      }
    },
    deleteTodo(state, action: PayloadAction<string>) {
      state.todos = state.todos.filter((t) => t.id !== action.payload);
    },
    reorderTodos(state, action: PayloadAction<{ fromIndex: number; toIndex: number }>) {
      const { fromIndex, toIndex } = action.payload;
      if (fromIndex === toIndex) return;
      const items = [...state.todos];
      const [moved] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, moved);
      state.todos = items;
    },
  },
});

export const {
  toggleTodoPanel,
  setTodoPanelOpen,
  setTodos,
  setLoading,
  setError,
  clearTodos,
  addTodo,
  updateTodo,
  deleteTodo,
  reorderTodos,
} = todoSlice.actions;

export default todoSlice.reducer;
