/**
 * App.tsx - 메인 애플리케이션 컴포넌트
 *
 * 전체 앱의 레이아웃을 정의하는 최상위 컴포넌트입니다.
 * 4개의 주요 패널로 구성됩니다:
 * 1. FileExplorer - 파일 탐색기
 * 2. ChatPanel - AI 채팅 또는 터미널
 * 3. SessionPanel - 세션 관리
 * 4. ApiPanel - AI API 설정
 */

import React from 'react';

// 하위 컴포넌트들을 import합니다
import FileExplorer from './components/FileExplorer';
import ChatPanel from './components/ChatPanel';
import SessionPanel from './components/SessionPanel';
import ApiPanel from './components/ApiPanel';

/**
 * App 컴포넌트
 *
 * React.FC는 Function Component의 타입입니다.
 * React.FC<Props> 형태로 props 타입을 지정할 수 있지만,
 * 여기서는 props가 없어서 빈 타입입니다.
 *
 * Function Component는 JSX를 반환하는 함수입니다.
 * 클래스 컴포넌트보다 간결하고 hooks를 사용할 수 있어서 선호됩니다.
 */
const App: React.FC = () => {
  /**
   * return 문으로 JSX를 반환합니다.
   *
   * JSX는 JavaScript XML의 약자로,
   * HTML과 비슷한 문법으로 React 컴포넌트를 작성할 수 있게 해줍니다.
   *
   * JSX 규칙:
   * 1. 하나의 루트 요소만 반환해야 합니다
   * 2. 모든 태그는 닫혀야 합니다 (<div></div> 또는 <div />)
   * 3. class 대신 className을 사용합니다 (class는 JS 예약어)
   * 4. 카멜케이스로 속성을 작성합니다 (onclick → onClick)
   */
  return (
    /**
     * 최상위 div - 전체 앱 컨테이너
     * id는 CSS 선택자로 사용됩니다 (#app)
     */
    <div id="app">
      {/**
       * header - 타이틀바
       * Electron 앱의 제목을 표시합니다
       *
       * JSX 안에서 주석은 {/* ... */} 형태로 작성합니다
       */}
      <header id="titlebar">
        <span className="titlebar-title">FreiCowork</span>
      </header>

      {/**
       * main-layout - 메인 레이아웃 컨테이너
       * 3열 레이아웃: FileExplorer | ChatPanel | panel-right
       */}
      <div id="main-layout">
        {/**
         * 왼쪽 패널: 파일 탐색기
         * 자체 닫힘 태그 (self-closing tag) 사용
         */}
        <FileExplorer />

        {/**
         * 중앙 패널: 채팅 또는 터미널
         */}
        <ChatPanel />

        {/**
         * 오른쪽 패널: 세션과 API 설정
         * 세로로 2개 패널을 배치합니다
         */}
        <div id="panel-right">
          {/* 세션 관리 패널 */}
          <SessionPanel />

          {/* API 설정 패널 */}
          <ApiPanel />
        </div>
      </div>
    </div>
  );
};

/**
 * default export
 *
 * 다른 파일에서 import App from './App'으로 가져올 수 있습니다.
 * default export는 파일당 하나만 가능합니다.
 */
export default App;
