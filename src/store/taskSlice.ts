import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Task {
  id: number;
  text: string;
  done: boolean;
}

interface TaskState {
  tasks: Task[];
  counter: number;
  input: string;
}

function loadFromStorage(): { tasks: Task[]; counter: number } {
  try {
    const saved = localStorage.getItem('cowork-tasks');
    const counter = localStorage.getItem('cowork-task-counter');
    return {
      tasks: saved ? JSON.parse(saved) : [],
      counter: counter ? parseInt(counter, 10) : 0,
    };
  } catch {
    return { tasks: [], counter: 0 };
  }
}

const persisted = loadFromStorage();

const initialState: TaskState = {
  tasks: persisted.tasks,
  counter: persisted.counter,
  input: '',
};

function saveToStorage(tasks: Task[], counter: number) {
  try {
    localStorage.setItem('cowork-tasks', JSON.stringify(tasks));
    localStorage.setItem('cowork-task-counter', String(counter));
  } catch { /* ignore */ }
}

const taskSlice = createSlice({
  name: 'task',
  initialState,
  reducers: {
    setTaskInput(state, action: PayloadAction<string>) {
      state.input = action.payload;
    },
    addTask(state) {
      const text = state.input.trim();
      if (!text) return;
      state.counter++;
      state.tasks.push({ id: state.counter, text, done: false });
      state.input = '';
      saveToStorage(state.tasks, state.counter);
    },
    toggleTask(state, action: PayloadAction<number>) {
      const task = state.tasks.find((t) => t.id === action.payload);
      if (task) task.done = !task.done;
      saveToStorage(state.tasks, state.counter);
    },
    deleteTask(state, action: PayloadAction<number>) {
      state.tasks = state.tasks.filter((t) => t.id !== action.payload);
      saveToStorage(state.tasks, state.counter);
    },
    clearDone(state) {
      state.tasks = state.tasks.filter((t) => !t.done);
      saveToStorage(state.tasks, state.counter);
    },
    restoreTasks(state, action: PayloadAction<{ tasks: Task[]; counter: number }>) {
      state.tasks = action.payload.tasks;
      state.counter = action.payload.counter;
      state.input = '';
      saveToStorage(state.tasks, state.counter);
    },
  },
});

export const { setTaskInput, addTask, toggleTask, deleteTask, clearDone, restoreTasks } = taskSlice.actions;

export default taskSlice.reducer;
