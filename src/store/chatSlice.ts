/**
 * store/chatSlice.ts - 채팅 상태 관리 Slice
 *
 * Redux Toolkit의 createSlice는 액션과 리듀서를 한 번에 생성합니다.
 * Slice는 Redux 상태의 한 조각을 의미합니다.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/**
 * ChatMessage 인터페이스
 *
 * export를 사용하면 다른 파일에서 import하여 사용할 수 있습니다.
 */
export interface ChatMessage {
  id: number;                                      // 메시지 고유 ID
  type: 'user' | 'assistant' | 'error' | 'system'; // Union 타입: 4가지 중 하나
  text: string;                                    // 메시지 내용
}

/**
 * ChatState 인터페이스
 *
 * 채팅 관련 전체 상태의 구조를 정의합니다.
 */
interface ChatState {
  messages: ChatMessage[];  // 채팅 메시지 배열
  input: string;            // 사용자 입력 텍스트
  isStreaming: boolean;     // AI 응답이 스트리밍 중인지 여부
  nextId: number;           // 다음 메시지에 부여할 ID
}

/**
 * initialState - 초기 상태
 *
 * Redux 스토어가 처음 생성될 때의 상태를 정의합니다.
 */
const initialState: ChatState = {
  messages: [
    { id: 0, type: 'system', text: 'FreiCowork에 오신 것을 환영합니다. 무엇을 도와드릴까요?' },
  ],
  input: '',
  isStreaming: false,
  nextId: 1,
};

/**
 * chatSlice 생성
 *
 * createSlice는 다음을 자동으로 생성합니다:
 * 1. 액션 생성자 (action creators)
 * 2. 리듀서 함수 (reducer function)
 */
const chatSlice = createSlice({
  name: 'chat',        // 액션 타입의 prefix로 사용됩니다 (예: 'chat/setInput')
  initialState,        // 초기 상태
  /**
   * reducers - 상태를 변경하는 함수들
   *
   * Redux Toolkit은 Immer 라이브러리를 사용하여
   * 불변성을 자동으로 처리합니다.
   * 따라서 state를 직접 수정하는 것처럼 보이지만,
   * 실제로는 새로운 상태 객체가 생성됩니다.
   */
  reducers: {
    /**
     * setInput - 입력 필드의 텍스트를 업데이트
     *
     * @param state - 현재 상태 (Immer의 Draft 타입)
     * @param action - PayloadAction<T> 형태의 액션
     *
     * PayloadAction은 Redux Toolkit이 제공하는 타입으로,
     * action.payload에 데이터를 담습니다.
     */
    setInput(state, action: PayloadAction<string>) {
      state.input = action.payload;
    },

    /**
     * removeWelcome - 환영 메시지 제거
     *
     * filter는 배열 메서드로, 조건을 만족하는 요소만 남깁니다.
     * 여기서는 id가 0이 아닌 메시지만 남깁니다.
     */
    removeWelcome(state) {
      state.messages = state.messages.filter((m) => m.id !== 0);
    },

    /**
     * addMessage - 새 메시지 추가 (ID 자동 할당)
     *
     * @param action - Omit<ChatMessage, 'id'>: ChatMessage에서 id를 제외한 타입
     *
     * Omit<T, K>는 TypeScript 유틸리티 타입으로,
     * T 타입에서 K 속성을 제외한 새 타입을 만듭니다.
     *
     * Spread 연산자(...)를 사용하여 객체를 복사합니다.
     * state.nextId++는 후위 증가 연산자로, 현재 값을 사용한 후 1 증가시킵니다.
     */
    addMessage(state, action: PayloadAction<Omit<ChatMessage, 'id'>>) {
      state.messages = state.messages.filter((m) => m.id !== 0);
      state.messages.push({ ...action.payload, id: state.nextId++ });
    },

    /**
     * addMessageWithId - ID를 포함한 메시지 추가
     *
     * 외부에서 ID를 지정하여 메시지를 추가할 때 사용합니다.
     * 스트리밍 응답을 위해 미리 빈 메시지를 만들 때 유용합니다.
     */
    addMessageWithId(state, action: PayloadAction<ChatMessage>) {
      state.messages = state.messages.filter((m) => m.id !== 0);
      state.messages.push(action.payload);
      // nextId를 업데이트하여 ID 충돌을 방지합니다
      if (action.payload.id >= state.nextId) {
        state.nextId = action.payload.id + 1;
      }
    },

    /**
     * allocateId - ID만 증가시키기
     *
     * 메시지를 추가하지 않고 다음 ID를 예약할 때 사용합니다.
     */
    allocateId(state) {
      state.nextId++;
    },

    /**
     * updateMessageText - 특정 메시지의 텍스트 업데이트
     *
     * @param action - { id: number; text: string } 형태의 payload
     *
     * find는 배열에서 조건을 만족하는 첫 번째 요소를 반환합니다.
     * 찾지 못하면 undefined를 반환합니다.
     *
     * 이 함수는 주로 스트리밍 중 텍스트를 점진적으로 업데이트할 때 사용됩니다.
     */
    updateMessageText(state, action: PayloadAction<{ id: number; text: string }>) {
      const msg = state.messages.find((m) => m.id === action.payload.id);
      if (msg) msg.text = action.payload.text;
    },

    /**
     * removeEmptyMessage - 빈 메시지 제거
     *
     * 스트리밍이 실패했을 때 미리 만든 빈 메시지를 제거합니다.
     */
    removeEmptyMessage(state, action: PayloadAction<number>) {
      state.messages = state.messages.filter(
        (m) => !(m.id === action.payload && m.text === '')
      );
    },

    /**
     * setStreaming - 스트리밍 상태 설정
     *
     * 스트리밍 중일 때는 사용자가 새 메시지를 보낼 수 없도록 합니다.
     */
    setStreaming(state, action: PayloadAction<boolean>) {
      state.isStreaming = action.payload;
    },

    /**
     * restoreMessages - 메시지 복원
     *
     * 세션 전환 시 이전 메시지를 복원할 때 사용합니다.
     * 삼항 연산자(? :)를 사용하여 조건부로 값을 할당합니다.
     */
    restoreMessages(state, action: PayloadAction<{ messages: ChatMessage[]; nextId: number }>) {
      state.messages = action.payload.messages.length > 0
        ? action.payload.messages
        : [{ id: 0, type: 'system', text: 'FreiCowork에 오신 것을 환영합니다. 무엇을 도와드릴까요?' }];
      state.nextId = action.payload.nextId;
      state.input = '';
      state.isStreaming = false;
    },
  },
});

/**
 * 액션 생성자 export
 *
 * chatSlice.actions에는 reducers에 정의한 각 함수에 대응하는
 * 액션 생성자가 자동으로 생성됩니다.
 *
 * 예: setInput('Hello')를 호출하면
 *     { type: 'chat/setInput', payload: 'Hello' } 액션이 생성됩니다.
 */
export const {
  setInput,
  removeWelcome,
  addMessage,
  addMessageWithId,
  allocateId,
  updateMessageText,
  removeEmptyMessage,
  setStreaming,
  restoreMessages,
} = chatSlice.actions;

/**
 * 리듀서 export
 *
 * 이 리듀서는 store 설정 시 사용됩니다.
 * default export는 파일당 하나만 가능합니다.
 */
export default chatSlice.reducer;
