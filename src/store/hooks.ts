/**
 * store/hooks.ts - 타입이 지정된 Redux Hooks
 *
 * React-Redux의 기본 hooks에 TypeScript 타입을 추가한 커스텀 hooks입니다.
 * 이를 사용하면 매번 타입을 지정하지 않아도 됩니다.
 */

// react-redux에서 기본 hooks를 가져옵니다
import { useDispatch, useSelector } from 'react-redux';

// 우리가 정의한 RootState와 AppDispatch 타입을 가져옵니다
// 'type' 키워드는 타입만 import할 때 사용합니다 (런타임에서는 제거됨)
import type { RootState, AppDispatch } from './index';

/**
 * useAppDispatch - 타입이 지정된 dispatch hook
 *
 * withTypes는 Redux Toolkit이 제공하는 메서드로,
 * hook에 타입 정보를 추가합니다.
 *
 * 사용 예시:
 *   const dispatch = useAppDispatch();
 *   dispatch(someAction()); // TypeScript가 액션 타입을 체크합니다
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();

/**
 * useAppSelector - 타입이 지정된 selector hook
 *
 * selector는 Redux 스토어에서 특정 상태를 선택하는 함수입니다.
 *
 * 사용 예시:
 *   const messages = useAppSelector((state) => state.chat.messages);
 *   // state의 타입이 RootState로 자동 추론됩니다
 */
export const useAppSelector = useSelector.withTypes<RootState>();
