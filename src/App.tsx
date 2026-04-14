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

import React, { useState, useRef, useCallback, useEffect } from 'react';

// 하위 컴포넌트들을 import합니다
import FileExplorer from './components/FileExplorer';
import ChatPanel from './components/ChatPanel';
import SessionPanel from './components/SessionPanel';
import ApiPanel from './components/ApiPanel';

const STORAGE_KEY_LEFT = 'panel-left-width';
const STORAGE_KEY_RIGHT = 'panel-right-width';
const MIN_LEFT = 160;
const MAX_LEFT = 500;
const MIN_RIGHT = 180;
const MAX_RIGHT = 500;

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
  const [leftWidth, setLeftWidth] = useState(() =>
    parseInt(localStorage.getItem(STORAGE_KEY_LEFT) || '260', 10)
  );
  const [rightWidth, setRightWidth] = useState(() =>
    parseInt(localStorage.getItem(STORAGE_KEY_RIGHT) || '280', 10)
  );
  const dragging = useRef<null | 'left' | 'right'>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current) return;
    const delta = e.clientX - startX.current;
    if (dragging.current === 'left') {
      const next = Math.min(MAX_LEFT, Math.max(MIN_LEFT, startWidth.current + delta));
      setLeftWidth(next);
      localStorage.setItem(STORAGE_KEY_LEFT, String(next));
    } else {
      const next = Math.min(MAX_RIGHT, Math.max(MIN_RIGHT, startWidth.current - delta));
      setRightWidth(next);
      localStorage.setItem(STORAGE_KEY_RIGHT, String(next));
    }
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const startLeftDrag = (e: React.MouseEvent) => {
    dragging.current = 'left';
    startX.current = e.clientX;
    startWidth.current = leftWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const startRightDrag = (e: React.MouseEvent) => {
    dragging.current = 'right';
    startX.current = e.clientX;
    startWidth.current = rightWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div id="app">
      <header id="titlebar">
        <span className="titlebar-title">FreiCowork</span>
      </header>
      <div
        id="main-layout"
        style={{
          '--left-width': leftWidth + 'px',
          '--right-width': rightWidth + 'px',
        } as React.CSSProperties}
      >
        <FileExplorer />
        <div className="resize-handle" onMouseDown={startLeftDrag} />
        <ChatPanel />
        <div className="resize-handle" onMouseDown={startRightDrag} />
        <div id="panel-right">
          <SessionPanel />
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
