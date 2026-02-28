/**
 * components/TerminalView.tsx - 터미널 뷰 컴포넌트
 *
 * xterm.js를 사용한 실제 터미널 인터페이스입니다.
 * Electron의 PTY (Pseudo Terminal)와 연결되어 실제 셸 명령을 실행합니다.
 *
 * 주요 기능:
 * - xterm.js 터미널 렌더링
 * - PTY 프로세스와 통신
 * - 키보드 입력/출력 처리
 * - 터미널 크기 자동 조정
 * - 복사/붙여넣기 지원
 */

import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';  // 터미널 라이브러리
import { FitAddon } from '@xterm/addon-fit';  // 자동 크기 조정 애드온
import '@xterm/xterm/css/xterm.css';  // 터미널 스타일
import { useAppSelector } from '../store/hooks';

/**
 * CATPPUCCIN_THEME - 터미널 색상 테마
 *
 * xterm.js의 테마는 각 색상을 16진수로 정의합니다.
 * Catppuccin은 인기 있는 파스텔 색상 테마입니다.
 */
const CATPPUCCIN_THEME = {
  background: '#1e1e2e',
  foreground: '#cdd6f4',
  cursor: '#f5e0dc',
  cursorAccent: '#1e1e2e',
  selectionBackground: '#585b70',
  selectionForeground: '#cdd6f4',
  // ANSI 색상 (0-7: 일반, 8-15: 밝은 색)
  black: '#45475a',
  red: '#f38ba8',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  blue: '#89b4fa',
  magenta: '#f5c2e7',
  cyan: '#94e2d5',
  white: '#bac2de',
  brightBlack: '#585b70',
  brightRed: '#f38ba8',
  brightGreen: '#a6e3a1',
  brightYellow: '#f9e2af',
  brightBlue: '#89b4fa',
  brightMagenta: '#f5c2e7',
  brightCyan: '#94e2d5',
  brightWhite: '#a6adc8',
};

/**
 * TerminalViewProps - 컴포넌트 Props 타입
 *
 * Props는 부모 컴포넌트로부터 받는 데이터입니다.
 * Interface로 props의 구조를 정의합니다.
 */
interface TerminalViewProps {
  provider: string;      // AI 제공자 (CLI 도구 종류)
  sessionId: string;     // 세션 ID (PTY 식별용)
  sessionPath?: string;  // 세션의 작업 디렉토리 (선택적)
}

/**
 * TerminalView 컴포넌트
 *
 * React.FC<Props> 형태로 props 타입을 지정합니다.
 * 구조 분해 할당으로 props를 받습니다.
 */
const TerminalView: React.FC<TerminalViewProps> = ({ provider, sessionId, sessionPath }) => {
  /**
   * useRef로 DOM과 터미널 인스턴스 참조
   */
  const containerRef = useRef<HTMLDivElement>(null);  // 터미널을 렌더링할 div
  const termRef = useRef<Terminal | null>(null);       // xterm.js 인스턴스

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let cancelled = false;

    const term = new Terminal({
      theme: CATPPUCCIN_THEME,
      fontFamily: "'Cascadia Code', 'Consolas', 'Courier New', monospace",
      fontSize: 14,
      cursorBlink: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(container);
    fitAddon.fit();
    term.focus();

    termRef.current = term;

    // Ctrl+C: copy selection (if any), otherwise pass through as SIGINT
    // Ctrl+V: paste from clipboard into PTY
    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true;

      if (event.ctrlKey && event.key === 'c') {
        const sel = term.getSelection();
        if (sel) {
          navigator.clipboard.writeText(sel);
          term.clearSelection();
          return false;
        }
        return true;
      }

      if (event.ctrlKey && event.key === 'v') {
        navigator.clipboard.readText().then((text) => {
          if (text) window.api.cli.send(sessionId, text);
        });
        return false;
      }

      return true;
    });

    // PTY handles input echo and line editing — send keystrokes directly
    term.onData((data: string) => {
      window.api.cli.send(sessionId, data);
    });

    // Sync terminal size → PTY
    term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
      window.api.cli.resize(sessionId, cols, rows);
    });

    // Receive output from CLI process (filter by sessionId)
    const removeOutput = window.api.cli.onOutput((sid: string, data: string) => {
      if (sid === sessionId) {
        term.write(data);
      }
    });

    const removeExit = window.api.cli.onExit((sid: string, code: number | null) => {
      if (sid === sessionId) {
        term.write(`\r\n\x1b[33m--- Process exited (code: ${code ?? 'unknown'}) ---\x1b[0m\r\n`);
        // Don't auto-disconnect — let the user read the message and manually disconnect
      }
    });

    // Mount: check if PTY already exists (reattach) or spawn new
    (async () => {
      const { exists } = await window.api.cli.exists(sessionId);
      if (cancelled) return;

      if (exists) {
        // Reattach: write scrollback buffer and sync size
        const sb = await window.api.cli.getScrollback(sessionId);
        if (cancelled) return;
        if (sb.ok && sb.data) {
          term.write(sb.data);
        }
        window.api.cli.resize(sessionId, term.cols, term.rows);
      } else {
        // New process
        const result = await window.api.cli.connect(sessionId, provider, sessionPath || undefined);
        if (cancelled) return;
        if (!result.ok) {
          term.write(`\x1b[31mError: ${result.error || 'Failed to start CLI process'}\x1b[0m\r\n`);
          // Don't auto-disconnect — let the user read the error and manually disconnect
        } else {
          window.api.cli.resize(sessionId, term.cols, term.rows);
        }
      }
    })();

    // Click to re-focus terminal
    const handleClick = () => term.focus();
    container.addEventListener('click', handleClick);

    const observer = new ResizeObserver(() => {
      fitAddon.fit();
    });
    observer.observe(container);

    return () => {
      cancelled = true;
      observer.disconnect();
      container.removeEventListener('click', handleClick);
      removeOutput();
      removeExit();
      // Do NOT kill the PTY — just detach listeners and dispose xterm
      term.dispose();
      termRef.current = null;
    };
  }, [sessionId, provider, sessionPath]);

  return <div id="terminal-container" ref={containerRef} />;
};

export default TerminalView;
