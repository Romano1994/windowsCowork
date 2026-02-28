/**
 * store/taskSlice.ts - 작업 관리 Slice
 *
 * TODO 리스트 형태의 작업 관리 기능을 제공합니다.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/**
 * Task - 하나의 작업
 */
export interface Task {
  id: number;       // 작업 고유 ID
  text: string;     // 작업 내용
  done: boolean;    // 완료 여부
}

/**
 * TaskState - 작업 관리 상태
 */
interface TaskState {
  tasks: Task[];    // 작업 목록
  counter: number;  // 작업 ID 카운터 (다음 작업에 부여할 ID)
  input: string;    // 새 작업 입력 필드
}

/**
 * loadFromStorage - localStorage에서 작업 목록 불러오기
 *
 * @returns 저장된 작업과 카운터
 *
 * parseInt(str, 10)은 문자열을 10진수 정수로 변환합니다.
 * 10은 진법을 나타냅니다 (10진수).
 */
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

/**
 * persisted - 저장된 데이터 불러오기
 *
 * initialState를 정의하기 전에 호출하여 저장된 데이터를 가져옵니다.
 */
const persisted = loadFromStorage();

/**
 * 초기 상태
 */
const initialState: TaskState = {
  tasks: persisted.tasks,
  counter: persisted.counter,
  input: '',
};

/**
 * saveToStorage - localStorage에 작업 목록 저장
 *
 * @param tasks - 작업 목록
 * @param counter - 카운터
 *
 * String(counter)는 숫자를 문자열로 변환합니다.
 * localStorage는 문자열만 저장할 수 있기 때문입니다.
 */
function saveToStorage(tasks: Task[], counter: number) {
  try {
    localStorage.setItem('cowork-tasks', JSON.stringify(tasks));
    localStorage.setItem('cowork-task-counter', String(counter));
  } catch { /* ignore */ }
}

/**
 * taskSlice 생성
 */
const taskSlice = createSlice({
  name: 'task',
  initialState,
  reducers: {
    /**
     * setTaskInput - 입력 필드 업데이트
     */
    setTaskInput(state, action: PayloadAction<string>) {
      state.input = action.payload;
    },

    /**
     * addTask - 새 작업 추가
     *
     * trim()은 문자열 양 끝의 공백을 제거합니다.
     * 빈 문자열이면 추가하지 않습니다 (Early return).
     */
    addTask(state) {
      const text = state.input.trim();
      if (!text) return;  // 빈 입력은 무시

      state.counter++;  // ID 증가
      state.tasks.push({ id: state.counter, text, done: false });
      state.input = '';  // 입력 필드 초기화
      saveToStorage(state.tasks, state.counter);
    },

    /**
     * toggleTask - 작업 완료/미완료 토글
     *
     * @param action - 작업 ID
     *
     * !는 부정 연산자로, true ↔ false를 전환합니다.
     */
    toggleTask(state, action: PayloadAction<number>) {
      const task = state.tasks.find((t) => t.id === action.payload);
      if (task) task.done = !task.done;  // 완료 상태 반전
      saveToStorage(state.tasks, state.counter);
    },

    /**
     * deleteTask - 작업 삭제
     *
     * @param action - 작업 ID
     */
    deleteTask(state, action: PayloadAction<number>) {
      state.tasks = state.tasks.filter((t) => t.id !== action.payload);
      saveToStorage(state.tasks, state.counter);
    },

    /**
     * clearDone - 완료된 작업 모두 삭제
     *
     * !t.done은 "완료되지 않은" 작업만 남깁니다.
     */
    clearDone(state) {
      state.tasks = state.tasks.filter((t) => !t.done);
      saveToStorage(state.tasks, state.counter);
    },

    /**
     * restoreTasks - 작업 목록 복원
     *
     * @param action - 복원할 작업과 카운터
     *
     * 세션 전환 시 이전 작업 목록을 복원합니다.
     */
    restoreTasks(state, action: PayloadAction<{ tasks: Task[]; counter: number }>) {
      state.tasks = action.payload.tasks;
      state.counter = action.payload.counter;
      state.input = '';
      saveToStorage(state.tasks, state.counter);
    },
  },
});

/**
 * 액션 생성자 export
 */
export const {
  setTaskInput,
  addTask,
  toggleTask,
  deleteTask,
  clearDone,
  restoreTasks
} = taskSlice.actions;

/**
 * 리듀서 export
 */
export default taskSlice.reducer;
