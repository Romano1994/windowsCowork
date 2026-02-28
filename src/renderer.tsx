/**
 * renderer.tsx - React 애플리케이션 진입점
 *
 * Electron의 renderer 프로세스에서 실행되는 React 앱의 시작점입니다.
 * Redux Provider로 앱을 감싸 전역 상태를 사용할 수 있게 합니다.
 */

// React를 import합니다 (JSX 문법을 사용하기 위해 필요)
import React from 'react';

/**
 * createRoot는 React 18의 새로운 API입니다.
 * ReactDOM.render 대신 사용합니다.
 */
import { createRoot } from 'react-dom/client';

/**
 * Provider는 Redux 스토어를 React 컴포넌트 트리에 주입하는 컴포넌트입니다.
 * Provider로 감싼 모든 하위 컴포넌트에서 useSelector, useDispatch를 사용할 수 있습니다.
 */
import { Provider } from 'react-redux';

// Redux 스토어와 메인 App 컴포넌트를 import
import { store } from './store';
import App from './App';

// CSS 파일 import (webpack이 처리합니다)
import './index.css';

/**
 * DOM에서 'root' ID를 가진 요소를 찾습니다.
 * !는 TypeScript의 non-null assertion으로,
 * 이 값이 null이 아님을 보장합니다.
 *
 * HTML 파일에 <div id="root"></div>가 있어야 합니다.
 */
const container = document.getElementById('root')!;

/**
 * createRoot로 React 루트를 생성합니다.
 * 이는 React가 DOM을 관리할 수 있게 해줍니다.
 */
const root = createRoot(container);

/**
 * render 메서드로 React 컴포넌트를 실제 DOM에 렌더링합니다.
 *
 * JSX 문법:
 * - <Provider>는 React.createElement(Provider, ...)로 변환됩니다
 * - store={store}는 Provider 컴포넌트의 props입니다
 * - <App />은 자식 요소가 없는 컴포넌트입니다
 *
 * 구조:
 * Provider (Redux 스토어 제공)
 *   └─ App (메인 애플리케이션)
 */
root.render(
  <Provider store={store}>
    <App />
  </Provider>
);
