/**
 * store/sessionSlice.ts - 세션 관리 Slice
 *
 * 여러 작업 세션을 관리하고 각 세션의 상태를 저장/복원합니다.
 * localStorage를 사용하여 브라우저를 닫아도 세션이 유지됩니다.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ChatMessage } from './chatSlice';
import type { Task } from './taskSlice';

/**
 * Session - 하나의 작업 세션
 *
 * 각 세션은 독립적인 채팅, 작업 목록, 작업 디렉토리를 가집니다.
 */
export interface Session {
  id: string;                // 고유 식별자
  name: string;              // 세션 이름 (사용자가 지정)
  path: string;              // 작업 디렉토리 경로
  messages: ChatMessage[];   // 이 세션의 채팅 기록
  tasks: Task[];             // 이 세션의 작업 목록
  taskCounter: number;       // 작업 ID 카운터
}

/**
 * SessionState - 세션 관리 상태
 */
interface SessionState {
  sessions: Session[];       // 모든 세션 목록
  activeId: string | null;   // 현재 활성화된 세션 ID (null이면 세션 없음)
}

/**
 * localStorage 키
 *
 * const로 선언하면 값을 변경할 수 없습니다.
 * 대문자로 작성하는 것은 상수임을 나타내는 관례입니다.
 */
const STORAGE_KEY = 'cowork-sessions';

/**
 * loadState - localStorage에서 세션 상태 불러오기
 *
 * @returns 저장된 상태 또는 초기 상태
 *
 * localStorage.getItem은 문자열을 반환하므로
 * JSON.parse로 객체로 변환해야 합니다.
 *
 * try-catch 문은 에러 처리를 위해 사용합니다:
 * - try 블록: 실행할 코드
 * - catch 블록: 에러 발생 시 실행할 코드
 */
function loadState(): SessionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // 타입 검증: sessions가 배열인지 확인
      if (Array.isArray(parsed.sessions)) {
        return parsed as SessionState;  // as는 타입 단언(type assertion)
      }
    }
  } catch { /* ignore */ }  // 에러 무시 (초기 상태 반환)
  return { sessions: [], activeId: null };
}

/**
 * saveState - localStorage에 세션 상태 저장
 *
 * @param state - 저장할 상태
 *
 * JSON.stringify는 객체를 JSON 문자열로 변환합니다.
 */
function saveState(state: SessionState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

/**
 * 초기 상태
 *
 * localStorage에서 이전 세션을 불러옵니다.
 */
const initialState: SessionState = loadState();

/**
 * SessionSnapshot - 세션 상태 스냅샷
 *
 * 세션 전환 시 현재 상태를 저장하기 위한 타입입니다.
 */
export interface SessionSnapshot {
  messages: ChatMessage[];
  nextId: number;
  tasks: Task[];
  taskCounter: number;
  currentPath: string;
}

/**
 * sessionSlice 생성
 */
const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    /**
     * addSession - 새 세션 추가
     *
     * @param action - 세션 이름과 경로
     *
     * ID 생성 방법:
     * - Date.now().toString(36): 현재 시간을 36진수 문자열로 변환
     * - Math.random().toString(36).slice(2, 6): 랜덤 문자열 4자
     * - 두 개를 합쳐 고유한 ID 생성
     */
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
      state.activeId = id;  // 새 세션을 활성화
      saveState(state);     // localStorage에 저장
    },

    /**
     * deleteSession - 세션 삭제
     *
     * @param action - 삭제할 세션 ID
     *
     * filter는 조건을 만족하는 요소만 남깁니다.
     * 삭제된 세션이 활성 세션이었다면, 첫 번째 세션을 활성화합니다.
     */
    deleteSession(state, action: PayloadAction<string>) {
      state.sessions = state.sessions.filter((s) => s.id !== action.payload);
      if (state.activeId === action.payload) {
        state.activeId = state.sessions.length > 0 ? state.sessions[0].id : null;
      }
      saveState(state);
    },

    /**
     * switchSession - 세션 전환
     *
     * @param action - 전환할 세션 ID
     *
     * find는 조건을 만족하는 첫 번째 요소를 찾습니다.
     * 존재하는 세션인지 확인 후 전환합니다.
     */
    switchSession(state, action: PayloadAction<string>) {
      const target = state.sessions.find((s) => s.id === action.payload);
      if (target) {
        state.activeId = action.payload;
      }
      saveState(state);
    },

    /**
     * renameSession - 세션 이름 변경
     *
     * @param action - 세션 ID와 새 이름
     */
    renameSession(state, action: PayloadAction<{ id: string; name: string }>) {
      const session = state.sessions.find((s) => s.id === action.payload.id);
      if (session) {
        session.name = action.payload.name;
      }
      saveState(state);
    },

    /**
     * saveCurrentState - 현재 상태를 세션에 저장
     *
     * @param action - 저장할 상태 스냅샷
     *
     * 세션 전환 시 현재 채팅, 작업, 경로를 세션에 저장합니다.
     * Early return 패턴: activeId가 없으면 바로 반환
     */
    saveCurrentState(state, action: PayloadAction<SessionSnapshot>) {
      if (!state.activeId) return;  // 활성 세션이 없으면 리턴
      const session = state.sessions.find((s) => s.id === state.activeId);
      if (session) {
        session.messages = action.payload.messages;
        session.tasks = action.payload.tasks;
        session.taskCounter = action.payload.taskCounter;
        session.path = action.payload.currentPath;
      }
      saveState(state);
    },

    /**
     * updateSessionPath - 세션의 작업 경로 업데이트
     *
     * @param action - 세션 ID와 새 경로
     */
    updateSessionPath(state, action: PayloadAction<{ id: string; path: string }>) {
      const session = state.sessions.find((s) => s.id === action.payload.id);
      if (session) {
        session.path = action.payload.path;
      }
      saveState(state);
    },
  },
});

/**
 * 액션 생성자 export
 */
export const {
  addSession,
  deleteSession,
  switchSession,
  renameSession,
  saveCurrentState,
  updateSessionPath,
} = sessionSlice.actions;

/**
 * 리듀서 export
 */
export default sessionSlice.reducer;
