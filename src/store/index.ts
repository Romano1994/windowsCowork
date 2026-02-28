/**
 * store/index.ts - Redux 스토어 설정 파일
 *
 * Redux는 React 애플리케이션의 전역 상태를 관리하는 라이브러리입니다.
 * Redux Toolkit은 Redux를 더 쉽게 사용할 수 있게 해주는 공식 도구입니다.
 */

// @reduxjs/toolkit에서 스토어 설정 함수를 가져옵니다
import { configureStore } from '@reduxjs/toolkit';

// 각 기능별 reducer를 가져옵니다
// reducer는 상태를 어떻게 변경할지 정의한 함수입니다
import chatReducer from './chatSlice';
import fileReducer from './fileSlice';
import taskReducer from './taskSlice';
import apiReducer from './apiSlice';
import sessionReducer from './sessionSlice';

/**
 * Redux 스토어 생성
 *
 * configureStore는 Redux Toolkit이 제공하는 함수로,
 * 여러 설정을 자동으로 해주는 스토어를 만듭니다:
 * - Redux DevTools 자동 연결
 * - 기본 미들웨어 설정
 * - 개발 모드에서 상태 불변성 체크
 */
export const store = configureStore({
  /**
   * reducer 객체
   *
   * 각 키는 전역 상태의 한 부분을 담당합니다.
   * 예: state.chat, state.file, state.task 등으로 접근할 수 있습니다.
   */
  reducer: {
    chat: chatReducer,       // 채팅 관련 상태
    file: fileReducer,       // 파일 탐색기 관련 상태
    task: taskReducer,       // 작업 관리 상태
    api: apiReducer,         // API 설정 상태
    session: sessionReducer, // 세션 관리 상태
  },
});

/**
 * RootState 타입 정의
 *
 * TypeScript의 ReturnType<T>는 함수의 반환 타입을 추출합니다.
 * typeof는 값의 타입을 가져옵니다.
 *
 * 따라서 RootState는 store.getState()가 반환하는 객체의 타입입니다.
 * 이를 통해 useSelector 등에서 타입 안정성을 확보할 수 있습니다.
 */
export type RootState = ReturnType<typeof store.getState>;

/**
 * AppDispatch 타입 정의
 *
 * dispatch는 액션을 발생시켜 상태를 변경하는 함수입니다.
 * 이 타입을 사용하면 dispatch에서도 타입 체크를 할 수 있습니다.
 */
export type AppDispatch = typeof store.dispatch;
