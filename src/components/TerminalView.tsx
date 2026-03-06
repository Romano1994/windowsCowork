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
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { disconnect } from '../store/apiSlice';

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
   * Redux dispatch hook
   */
  const dispatch = useAppDispatch();

  /**
   * useRef로 DOM과 터미널 인스턴스 참조
   */
  const containerRef = useRef<HTMLDivElement>(null);  // 터미널을 렌더링할 div
  const termRef = useRef<Terminal | null>(null);       // xterm.js 인스턴스

  /**
   * 출력 버퍼링을 위한 상태
   * 작은 청크들을 모아서 한번에 렌더링하여 무한 스크롤 방지
   */
  const outputBufferRef = useRef<string>('');
  const writeTimeoutRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const firstBufferedAtRef = useRef<number>(0);

  /**
   * 스크롤 상태 추적
   * 사용자가 수동으로 스크롤을 올린 경우 자동 스크롤 비활성화
   */
  const userScrolledUpRef = useRef<boolean>(false);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollYRef = useRef<number>(0);  // 마지막 스크롤 위치
  const isUserScrollingRef = useRef<boolean>(false);  // 사용자가 능동적으로 스크롤 중

  /**
   * 출력 속도 제한 (rate limiting)
   * 고속 스크롤 방지를 위한 출력 속도 제어
   */
  const lastWriteTimeRef = useRef<number>(0);
  const pendingWritesRef = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let cancelled = false;

    const term = new Terminal({
      theme: CATPPUCCIN_THEME,
      fontFamily: "'Cascadia Code', 'Consolas', 'Courier New', monospace",
      fontSize: 14,
      cursorBlink: true,
      // 스크롤백 버퍼 제한으로 메모리 사용량 및 렌더링 성능 개선
      // 1000줄로 제한하여 고속 스크롤 및 메모리 문제 방지
      scrollback: 1000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(container);
    fitAddon.fit();
    term.focus();

    termRef.current = term;

    // onScroll 이벤트로 사용자 스크롤을 더 정확히 감지
    // xterm.js의 onScroll 이벤트는 스크롤 방향과 위치를 제공
    let removeOnScroll: { dispose: () => void } | undefined;
    if (termRef.current?.onScroll) {
      removeOnScroll = termRef.current.onScroll((newScrollY: number) => {
        if (cancelled) return;

        // 스크롤 방향 감지
        if (newScrollY < lastScrollYRef.current) {
          // 위로 스크롤 (newScrollY가 작아짐)
          userScrolledUpRef.current = true;
          isUserScrollingRef.current = true;
        } else if (newScrollY > lastScrollYRef.current) {
          // 아래로 스크롤 (newScrollY가 커짐)
          if (termRef.current) {
            try {
              const buffer = termRef.current.buffer.active;
              const isNearBottom = (buffer.baseY - buffer.viewportY) <= 3;
              if (isNearBottom) {
                userScrolledUpRef.current = false;
                isUserScrollingRef.current = false;
              } else {
                isUserScrollingRef.current = true;
              }
            } catch (e) {
              isUserScrollingRef.current = true;
            }
          }
        }

        lastScrollYRef.current = newScrollY;

        // 사용자 스크롤 후 1초 동안은 자동 스크롤 비활성화
        if (userScrollTimeoutRef.current) {
          clearTimeout(userScrollTimeoutRef.current);
        }
        userScrollTimeoutRef.current = setTimeout(() => {
          if (!isUserScrollingRef.current) {
            userScrolledUpRef.current = false;
          }
          isUserScrollingRef.current = false;
          userScrollTimeoutRef.current = null;
        }, 1000);
      });
    }

    // 폴백: onScroll이 없으면 50ms마다 상태 확인
    const scrollCheckInterval = setInterval(() => {
      if (!termRef.current || cancelled || !isUserScrollingRef.current) return;

      try {
        const buffer = termRef.current.buffer.active;
        const isNearBottom = (buffer.baseY - buffer.viewportY) <= 3;
        if (isNearBottom && !userScrollTimeoutRef.current) {
          // 사용자가 수동 조작 없이 맨 아래에 도달
          userScrolledUpRef.current = false;
        }
      } catch (e) {
        // 무시
      }
    }, 50);

    // Ctrl+C: copy selection (if any), otherwise pass through as SIGINT
    // Ctrl+V / Shift+Insert: paste from clipboard
    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true;

      // 복사
      if (event.ctrlKey && event.key === 'c') {
        const sel = term.getSelection();
        if (sel) {
          window.api.clipboard.writeText(sel);
          term.clearSelection();
          return false;
        }
        return true;
      }

      // 붙여넣기 (Ctrl+V 또는 Shift+Insert)
      if ((event.ctrlKey && event.key === 'v') || (event.shiftKey && event.key === 'Insert')) {
        event.preventDefault();
        try {
          const text = window.api.clipboard.readText();
          if (text) {
            window.api.cli.send(sessionId, text);
          }
        } catch (err) {
          console.error('Failed to read clipboard:', err);
        }
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

    /**
     * 사용자가 수동으로 스크롤했는지 감지
     * xterm.js API를 정확히 사용하여 viewport 위치 추적
     */
    const checkUserScroll = () => {
      if (!termRef.current) return;

      try {
        const buffer = termRef.current.buffer.active;
        // viewportY: 현재 viewport가 보고 있는 줄 번호 (0-based)
        // baseY: 버퍼에서 스크롤 가능한 최상단 줄 번호
        // baseY + rows: 버퍼의 최하단 (현재 커서 위치)
        const viewportY = buffer.viewportY;
        const baseY = buffer.baseY;

        // 맨 아래에 있으려면: viewportY가 baseY와 같거나 가까워야 함
        // 여유를 두고 2줄 이내면 "맨 아래"로 간주
        const isAtBottom = (baseY - viewportY) <= 2;
        userScrolledUpRef.current = !isAtBottom;
      } catch (e) {
        // 버퍼 API 접근 실패 시 안전하게 처리
        userScrolledUpRef.current = false;
      }
    };

    /**
     * 버퍼링된 출력을 터미널에 쓰는 함수
     * requestAnimationFrame을 사용하여 렌더링 최적화
     * 스마트 스크롤: 사용자가 스크롤을 올린 경우 자동 스크롤하지 않음
     */
    const flushBuffer = () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = requestAnimationFrame(() => {
        if (outputBufferRef.current && termRef.current && !cancelled) {
          const now = Date.now();
          const bufferSize = outputBufferRef.current.length;

          // 동적 throttle: 버퍼 크기에 따라 조정
          // 큰 버퍼는 더 오래 대기 (스크롤 안정성 향상)
          // Codex는 실시간 진행 상태(think/edit)가 자주 갱신되므로 더 공격적으로 flush
          let minInterval = provider === 'codex' ? 4 : 8;
          if (bufferSize > 10000) minInterval = provider === 'codex' ? 8 : 16;
          if (bufferSize > 50000) minInterval = provider === 'codex' ? 16 : 32;
          if (bufferSize > 100000) minInterval = provider === 'codex' ? 24 : 64;

          if (now - lastWriteTimeRef.current < minInterval) {
            pendingWritesRef.current++;
            // 과도한 pending writes 방지
            if (pendingWritesRef.current > 50 && bufferSize > 50000) {
              const maxBufferSize = 100000; // 100KB
              if (outputBufferRef.current.length > maxBufferSize) {
                outputBufferRef.current = outputBufferRef.current.slice(-maxBufferSize);
              }
            }
            // 다음 프레임에 다시 시도
            rafIdRef.current = requestAnimationFrame(() => flushBuffer());
            return;
          }

          const bufferedData = outputBufferRef.current;
          outputBufferRef.current = '';
          firstBufferedAtRef.current = 0;
          pendingWritesRef.current = 0;
          lastWriteTimeRef.current = now;

          // 쓰기 전에 현재 스크롤 상태 확인
          checkUserScroll();
          const shouldAutoScroll = !userScrolledUpRef.current && !isUserScrollingRef.current;

          // 터미널에 데이터 쓰기
          termRef.current.write(bufferedData);

          // 쓰기 후에만 한 번 스크롤 처리 (여러 번 호출 방지)
          // requestAnimationFrame으로 다음 렌더링 사이클에 스크롤
          if (shouldAutoScroll) {
            requestAnimationFrame(() => {
              if (termRef.current && !cancelled && !userScrolledUpRef.current) {
                try {
                  const buffer = termRef.current.buffer.active;
                  const isAtBottom = (buffer.baseY - buffer.viewportY) <= 3;
                  // 여전히 맨 아래 근처에 있으면 스크롤 (사용자가 올려도 즉시 복구 안 함)
                  if (isAtBottom) {
                    termRef.current.scrollToBottom();
                  }
                } catch (e) {
                  // 버퍼 API 오류
                }
              }
            });
          }
        }
        rafIdRef.current = null;
      });
    };

    // Receive output from CLI process (filter by sessionId)
    const removeOutput = window.api.cli.onOutput((sid: string, data: string) => {
      if (sid === sessionId && !cancelled) {
        // 버퍼에 데이터 추가
        outputBufferRef.current += data;
        if (firstBufferedAtRef.current === 0) {
          firstBufferedAtRef.current = Date.now();
        }

        // 짧은 지연 후 버퍼 flush
        // 기존 타이머를 매번 취소하지 않고, 최초 이벤트 기준으로 flush를 보장해
        // 고빈도 스트림에서 "무한 지연"이 발생하지 않도록 함
        let debounceTime = provider === 'codex' ? 8 : 16;
        const bufLen = outputBufferRef.current.length;
        if (bufLen > 5000) debounceTime = provider === 'codex' ? 24 : 64;
        else if (bufLen > 2000) debounceTime = provider === 'codex' ? 16 : 48;
        else if (bufLen > 1000) debounceTime = provider === 'codex' ? 12 : 32;

        const hasInteractiveControl =
          data.includes('\r') ||
          data.includes('\x1b[2K') ||
          data.includes('\x1b[1A') ||
          data.includes('\x1b[?25');

        // 스피너/진행 표시와 같이 제어문자가 포함된 청크는 즉시 반영
        if (hasInteractiveControl) {
          if (writeTimeoutRef.current !== null) {
            clearTimeout(writeTimeoutRef.current);
            writeTimeoutRef.current = null;
          }
          flushBuffer();
          return;
        }

        if (writeTimeoutRef.current === null) {
          writeTimeoutRef.current = window.setTimeout(() => {
            flushBuffer();
            writeTimeoutRef.current = null;
          }, debounceTime);
        } else if (Date.now() - firstBufferedAtRef.current > 80) {
          // 장시간 누적 방지: 최대 지연을 넘기면 강제 flush
          clearTimeout(writeTimeoutRef.current);
          writeTimeoutRef.current = null;
          flushBuffer();
        }
      }
    });

    const removeExit = window.api.cli.onExit((sid: string, code: number | null) => {
      if (sid === sessionId) {
        term.write(`\r\n\x1b[33m--- Process exited (code: ${code ?? 'unknown'}) ---\x1b[0m\r\n`);
        // Auto-disconnect to sync UI state with actual PTY state
        dispatch(disconnect());
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

    // 우클릭: 선택 텍스트가 있으면 복사, 없으면 붙여넣기
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const sel = term.getSelection();
      if (sel) {
        window.api.clipboard.writeText(sel);
        term.clearSelection();
      } else {
        try {
          const text = window.api.clipboard.readText();
          if (text) {
            window.api.cli.send(sessionId, text);
          }
        } catch (err) {
          console.error('Failed to paste from clipboard:', err);
        }
      }
    };
    container.addEventListener('contextmenu', handleContextMenu);

    // 마우스 휠/스크롤 이벤트로 사용자 스크롤 감지
    const handleWheel = (e: WheelEvent) => {
      // 사용자가 명시적으로 스크롤하고 있음을 표시
      isUserScrollingRef.current = true;

      // 위로 스크롤
      if (e.deltaY < 0) {
        userScrolledUpRef.current = true;
      }
      // 아래로 스크롤
      else if (e.deltaY > 0) {
        checkUserScroll();
        // 맨 아래에 도달했으면 자동 스크롤 재활성화
        if (!userScrolledUpRef.current) {
          isUserScrollingRef.current = false;
        }
      }

      // 사용자 스크롤 플래그 리셋 (800ms 동안 스크롤이 없으면)
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
      userScrollTimeoutRef.current = setTimeout(() => {
        isUserScrollingRef.current = false;
        checkUserScroll();  // 현재 위치 확인
        userScrollTimeoutRef.current = null;
      }, 800);
    };
    container.addEventListener('wheel', handleWheel, { passive: true });

    // 키보드 스크롤 이벤트 감지 (Page Up/Down, Arrow Up/Down, Home/End)
    const handleKeyScroll = (e: KeyboardEvent) => {
      if (['PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
        // End 키: 맨 아래로 이동 → 자동 스크롤 즉시 재활성화
        if (e.key === 'End') {
          setTimeout(() => {
            checkUserScroll();
            if (!userScrolledUpRef.current && userScrollTimeoutRef.current) {
              clearTimeout(userScrollTimeoutRef.current);
              userScrollTimeoutRef.current = null;
            }
          }, 50);
          return;
        }

        // 다른 키: 스크롤 후 상태 확인
        setTimeout(() => {
          checkUserScroll();
          if (userScrolledUpRef.current) {
            if (userScrollTimeoutRef.current) {
              clearTimeout(userScrollTimeoutRef.current);
            }
            userScrollTimeoutRef.current = setTimeout(() => {
              checkUserScroll();
              userScrollTimeoutRef.current = null;
            }, 500);
          }
        }, 50);
      }
    };
    container.addEventListener('keydown', handleKeyScroll);

    /**
     * 터미널 크기 조정 디바운싱
     * ResizeObserver가 너무 자주 호출되어 렌더링과 충돌하는 것을 방지
     */
    let resizeTimeout: number | null = null;
    let lastResizeTime = 0;
    const observer = new ResizeObserver(() => {
      const now = Date.now();
      // 과도한 resize 이벤트 필터링 (최소 100ms 간격)
      if (now - lastResizeTime < 100) {
        return;
      }
      lastResizeTime = now;

      if (resizeTimeout !== null) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = window.setTimeout(() => {
        if (!cancelled && termRef.current) {
          try {
            // resize 전 스크롤 상태 저장 (더 정확한 방법)
            let wasAtBottom = false;
            try {
              const buffer = termRef.current.buffer.active;
              const viewportY = buffer.viewportY;
              const baseY = buffer.baseY;
              wasAtBottom = (baseY - viewportY) <= 2;
            } catch (e) {
              wasAtBottom = true; // 에러 시 기본값: 맨 아래로
            }

            fitAddon.fit();

            // resize 후 스크롤 위치 복원
            if (wasAtBottom && termRef.current) {
              // requestAnimationFrame으로 렌더링 후 스크롤
              requestAnimationFrame(() => {
                if (termRef.current && !cancelled) {
                  termRef.current.scrollToBottom();
                }
              });
            }
          } catch (e) {
            console.error('Terminal resize error:', e);
          }
        }
        resizeTimeout = null;
      }, 150); // 150ms 디바운스
    });
    observer.observe(container);

    return () => {
      cancelled = true;

      // 타이머와 애니메이션 프레임 정리
      clearInterval(scrollCheckInterval);
      if (removeOnScroll) {
        removeOnScroll.dispose();
      }
      if (writeTimeoutRef.current !== null) {
        clearTimeout(writeTimeoutRef.current);
        writeTimeoutRef.current = null;
      }
      if (userScrollTimeoutRef.current !== null) {
        clearTimeout(userScrollTimeoutRef.current);
        userScrollTimeoutRef.current = null;
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      // 남은 버퍼 flush
      if (outputBufferRef.current && termRef.current) {
        termRef.current.write(outputBufferRef.current);
        outputBufferRef.current = '';
      }

      observer.disconnect();
      container.removeEventListener('click', handleClick);
      container.removeEventListener('contextmenu', handleContextMenu);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('keydown', handleKeyScroll);
      removeOutput();
      removeExit();
      // Do NOT kill the PTY — just detach listeners and dispose xterm
      term.dispose();
      termRef.current = null;
    };
  }, [sessionId, provider, sessionPath]);

  return <div id="terminal-container" style={{marginBottom: '10px'}} ref={containerRef} />;
};

export default TerminalView;
