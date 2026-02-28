/**
 * store/apiSlice.ts - API 설정 관리 Slice
 *
 * AI 제공자(Anthropic, OpenAI 등) 설정과 연결 상태를 관리합니다.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/**
 * Provider - AI 제공자 타입
 *
 * Union 타입으로 가능한 제공자를 제한합니다.
 * - anthropic, openai, gemini: API를 통한 일반 채팅
 * - claude-code, codex: CLI 터미널 모드
 */
export type Provider = 'anthropic' | 'openai' | 'gemini' | 'claude-code' | 'codex';

/**
 * CLI_PROVIDERS - CLI 모드를 제공하는 제공자 목록
 *
 * readonly 배열로 선언하여 수정을 방지합니다.
 * const 배열은 내용을 수정할 수 있지만, readonly를 명시하면 더 안전합니다.
 */
export const CLI_PROVIDERS: Provider[] = ['claude-code', 'codex'];

/**
 * isCliProvider - CLI 제공자인지 확인하는 함수
 *
 * @param p - 확인할 제공자
 * @returns CLI 제공자 여부
 *
 * includes는 배열에 특정 요소가 있는지 확인합니다.
 */
export const isCliProvider = (p: Provider): boolean => CLI_PROVIDERS.includes(p);

/**
 * MODELS - 각 제공자별 사용 가능한 모델 목록
 *
 * Record<K, V>는 TypeScript 유틸리티 타입으로,
 * K를 키로, V를 값으로 하는 객체 타입을 만듭니다.
 *
 * 예: Record<string, number>는 { [key: string]: number } 와 같습니다.
 */
export const MODELS: Record<Provider, string[]> = {
  anthropic: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-20250514'],
  openai: ['gpt-4o', 'gpt-4o-mini'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  'claude-code': [],  // CLI 모드는 모델 선택 불필요
  'codex': [],        // CLI 모드는 모델 선택 불필요
};

/**
 * SessionApiSnapshot - 세션별 API 연결 상태 스냅샷
 *
 * 각 세션이 어떤 AI 제공자와 연결되어 있었는지 저장합니다.
 * 세션 전환 시 연결 상태를 복원하는데 사용됩니다.
 */
interface SessionApiSnapshot {
  connected: boolean;  // 연결 여부
  provider: Provider;  // 제공자
  model: string;       // 모델
}

/**
 * ApiState - API 설정 상태
 */
interface ApiState {
  provider: Provider;                           // 현재 선택된 제공자
  model: string;                                // 현재 선택된 모델
  apiKeys: Record<Provider, string>;            // 각 제공자별 API 키
  connected: boolean;                           // 현재 연결 상태
  connectedSessions: Record<string, SessionApiSnapshot>;  // 각 세션의 연결 상태
}

/**
 * localStorage 키
 */
const STORAGE_KEY = 'cowork-api-config';

/**
 * loadState - localStorage에서 API 설정 불러오기
 *
 * @returns 저장된 설정 또는 기본 설정
 */
function loadState(): ApiState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.provider && parsed.apiKeys) {
        /**
         * Spread 연산자(...)로 parsed 객체를 복사합니다.
         * as ApiState는 타입 단언으로, TypeScript에게 이 객체가
         * ApiState 타입임을 알려줍니다.
         */
        const state = { ...parsed } as ApiState;

        /**
         * CLI 제공자는 연결을 유지할 수 없습니다
         * (Electron 재시작 시 프로세스가 종료되기 때문)
         */
        if (isCliProvider(state.provider)) {
          state.connected = false;
        } else {
          /**
           * !!는 이중 부정 연산자로, 값을 boolean으로 변환합니다.
           * !는 부정 연산자(NOT)입니다.
           *
           * 예: !!1 → true, !!0 → false, !!"hello" → true, !!"" → false
           */
          state.connected = !!parsed.connected;
        }

        // 세션별 연결 상태는 유지하지 않음 (재시작 시 초기화)
        state.connectedSessions = {};
        return state;
      }
    }
  } catch { /* ignore */ }

  /**
   * 기본 설정 반환
   * 모든 API 키는 빈 문자열로 초기화됩니다.
   */
  return {
    provider: 'anthropic',
    model: MODELS.anthropic[0],  // 첫 번째 모델 선택
    apiKeys: { anthropic: '', openai: '', gemini: '', 'claude-code': '', 'codex': '' },
    connected: false,
    connectedSessions: {},
  };
}

/**
 * saveState - localStorage에 API 설정 저장
 */
function saveState(state: ApiState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * 초기 상태 - localStorage에서 불러옵니다
 */
const initialState: ApiState = loadState();

/**
 * apiSlice 생성
 */
const apiSlice = createSlice({
  name: 'api',
  initialState,
  reducers: {
    /**
     * setProvider - AI 제공자 변경
     *
     * @param action - 새 제공자
     *
     * 제공자가 변경되면 해당 제공자의 첫 번째 모델을 자동 선택합니다.
     */
    setProvider(state, action: PayloadAction<Provider>) {
      state.provider = action.payload;
      const models = MODELS[action.payload];
      state.model = models.length > 0 ? models[0] : '';  // 첫 모델 선택
      saveState(state);
    },

    /**
     * setModel - 모델 변경
     */
    setModel(state, action: PayloadAction<string>) {
      state.model = action.payload;
      saveState(state);
    },

    /**
     * setApiKey - API 키 설정
     *
     * @param action - 제공자와 API 키
     *
     * 각 제공자별로 API 키를 별도로 저장합니다.
     */
    setApiKey(state, action: PayloadAction<{ provider: Provider; key: string }>) {
      state.apiKeys[action.payload.provider] = action.payload.key;
      saveState(state);
    },

    /**
     * setConnected - 연결 상태 설정
     */
    setConnected(state, action: PayloadAction<boolean>) {
      state.connected = action.payload;
      saveState(state);
    },

    /**
     * disconnect - 연결 해제
     */
    disconnect(state) {
      state.connected = false;
      saveState(state);
    },

    /**
     * saveSessionConnected - 현재 연결 상태를 세션에 저장
     *
     * @param action - 세션 ID
     *
     * 세션 전환 시 현재 AI 연결 상태를 저장합니다.
     * 나중에 이 세션으로 돌아왔을 때 복원할 수 있습니다.
     */
    saveSessionConnected(state, action: PayloadAction<{ sessionId: string }>) {
      state.connectedSessions[action.payload.sessionId] = {
        connected: state.connected,
        provider: state.provider,
        model: state.model,
      };
    },

    /**
     * restoreSessionConnected - 세션의 연결 상태 복원
     *
     * @param action - 세션 ID
     *
     * 이전에 저장한 세션의 AI 연결 상태를 복원합니다.
     * 저장된 상태가 없으면 연결을 해제합니다.
     */
    restoreSessionConnected(state, action: PayloadAction<{ sessionId: string }>) {
      const snapshot = state.connectedSessions[action.payload.sessionId];
      if (snapshot) {
        state.connected = snapshot.connected;
        state.provider = snapshot.provider;
        state.model = snapshot.model;
      } else {
        state.connected = false;  // 저장된 상태 없음 → 연결 해제
      }
      saveState(state);
    },

    /**
     * removeSessionConnected - 세션의 연결 상태 제거
     *
     * @param action - 세션 ID
     *
     * delete 연산자로 객체의 속성을 삭제합니다.
     * 세션이 삭제될 때 호출됩니다.
     */
    removeSessionConnected(state, action: PayloadAction<{ sessionId: string }>) {
      delete state.connectedSessions[action.payload.sessionId];
    },
  },
});

/**
 * 액션 생성자 export
 */
export const {
  setProvider, setModel, setApiKey, setConnected, disconnect,
  saveSessionConnected, restoreSessionConnected, removeSessionConnected,
} = apiSlice.actions;

/**
 * 리듀서 export
 */
export default apiSlice.reducer;
