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
import { setSessionWaitingForInput, clearSessionWaitingForInput, clearTerminalFocusRequest } from '../store/sessionSlice';

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
   * Redux state - 활성 세션 ID 가져오기
   */
  const activeSessionId = useAppSelector((s) => s.session.activeId);

  /**
   * Redux state - 터미널 포커스 요청 플래그
   */
  const shouldFocusTerminal = useAppSelector((s) => {
    const session = s.session.sessions.find((sess) => sess.id === sessionId);
    return session?.requestTerminalFocus ?? false;
  });

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

  /**
   * Write/Resize 조정 및 사용자 스크롤 타임스탬프
   * 터미널에 데이터를 쓰는 중인지 추적하여 resize와의 충돌 방지
   * 사용자 스크롤 시간을 기록하여 hysteresis 적용
   */
  const isWritingRef = useRef<boolean>(false);
  const lastUserScrollTimeRef = useRef<number>(0);

  /**
   * 입력 대기 감지를 위한 Ref
   * 마지막 출력 시간, 세션별 최근 줄, 세션별 감지 타임아웃을 추적합니다.
   * 백그라운드 세션의 입력 대기 상태도 감지하기 위해 세션별로 관리합니다.
   */
  const lastOutputTimeRef = useRef<number>(0);
  const recentLinesRef = useRef<Map<string, string[]>>(new Map());
  const detectionTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const firstOutputTimeRef = useRef<Map<string, number>>(new Map());  // 세션별 첫 출력 시간

  /**
   * 사용자 입력 시점 추적
   * 입력 에코를 즉시 flush하기 위해 마지막 키 입력 시간을 기록
   */
  const lastInputTimeRef = useRef<number>(0);

  /**
   * 적응형 임계값 시스템을 위한 RTT 측정 인프라
   * IPC 왕복 시간(Round-Trip Time)을 측정하여 시스템 부하에 자동으로 적응
   */
  const ipcRttBufferRef = useRef<number[]>([]);  // 최근 20개 RTT 측정값
  const pendingInputTimeRef = useRef<number | null>(null);  // 입력 전송 시각
  const adaptiveThresholdRef = useRef<number>(200);  // 동적 임계값 (초기 200ms)

  /**
   * 한글/중국어 등 IME 입력 상태 추적
   * 조합 중인 문자는 PTY에 전송하지 않아 한글 입력 지연 해결
   */
  const isComposingRef = useRef<boolean>(false);
  const lastComposedTextRef = useRef<string>('');  // 마지막으로 조합 완료된 텍스트 (중복 전송 방지용)

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let mounted = true;
    let cancelled = false;

    const term = new Terminal({
      theme: CATPPUCCIN_THEME,
      fontFamily: "'Cascadia Code', 'Consolas', 'Courier New', monospace",
      fontSize: 14,
      cursorBlink: true,
      // 스크롤백 버퍼 제한으로 메모리 사용량 및 렌더링 성능 개선
      // 1000줄로 제한하여 고속 스크롤 및 메모리 문제 방지
      scrollback: 1000,
      // 커서 렌더링 정확도 향상
      cursorStyle: 'bar',  // 더 명확한 커서 표시
      cursorInactiveStyle: 'outline',  // 포커스 잃었을 때 outline
      letterSpacing: 0,  // 문자 간격 정확히 정렬
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(container);
    fitAddon.fit();
    term.focus();

    termRef.current = term;

    // IME(한글/중국어 등) 입력 상태 추적
    // 조합 중인 문자는 PTY 에코가 없으므로 전송하지 않음
    const handleCompositionStart = () => {
      isComposingRef.current = true;
    };

    const handleCompositionEnd = (e: CompositionEvent) => {
      isComposingRef.current = false;

      // 완성된 한글 텍스트를 PTY에 직접 전송
      if (e.data) {
        const now = Date.now();
        lastInputTimeRef.current = now;
        pendingInputTimeRef.current = now;  // RTT 측정용
        window.api.cli.send(sessionId, e.data);
        dispatch(clearSessionWaitingForInput(sessionId));

        // onData에서 중복 전송 방지를 위해 저장
        lastComposedTextRef.current = e.data;
      }
    };

    container.addEventListener('compositionstart', handleCompositionStart);
    container.addEventListener('compositionend', handleCompositionEnd);

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
          lastUserScrollTimeRef.current = Date.now();
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

    // xterm.js가 customKeyEventHandler 호출 시점에 선택 영역을 이미 지울 수 있으므로
    // onSelectionChange로 선택 내용을 미리 저장해두고 폴백으로 사용
    let savedSelection = '';

    term.onSelectionChange(() => {
      const sel = term.getSelection();
      if (sel) savedSelection = sel;
    });

    const handleMouseDown = () => {
      savedSelection = '';
    };
    container.addEventListener('mousedown', handleMouseDown);

    // Ctrl+C: 선택 텍스트가 있으면 복사, 아니면 SIGINT로 전달
    // Ctrl+V / Shift+Insert: 클립보드에서 붙여넣기
    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true;

      // 복사
      if (event.ctrlKey && event.key === 'c') {
        const sel = term.getSelection() || savedSelection;
        if (sel) {
          window.api.clipboard.writeText(sel);
          term.clearSelection();
          savedSelection = '';
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

    // PTY가 입력 에코와 줄 편집을 처리함 — 키 입력을 직접 전송
    term.onData((data: string) => {
      // IME 조합 중(한글/중국어 등)이면 전송하지 않음
      // PTY 에코가 없어 지연이 발생하므로, 조합 완료 후에만 전송
      if (isComposingRef.current) {
        return;
      }

      // compositionend에서 이미 전송한 텍스트면 스킵
      if (data === lastComposedTextRef.current) {
        lastComposedTextRef.current = '';  // 플래그 리셋
        return;
      }

      const now = Date.now();
      lastInputTimeRef.current = now;
      pendingInputTimeRef.current = now;  // RTT 측정 시작점
      window.api.cli.send(sessionId, data);
      // 사용자가 입력을 전송하면 입력 대기 플래그 해제
      dispatch(clearSessionWaitingForInput(sessionId));
    });

    // 터미널 크기를 PTY와 동기화
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
          const shouldAutoScroll =
            !userScrolledUpRef.current &&
            !isUserScrollingRef.current &&
            (Date.now() - lastUserScrollTimeRef.current > 500);

          // 터미널에 데이터 쓰기
          isWritingRef.current = true;
          termRef.current.write(bufferedData);

          // 쓰기 후에만 한 번 스크롤 처리 (여러 번 호출 방지)
          // Double RAF: 렌더링 사이클 후 다시 한번 대기하여 안정적인 스크롤
          if (shouldAutoScroll) {
            requestAnimationFrame(() => {
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
                isWritingRef.current = false;
              });
            });
          } else {
            isWritingRef.current = false;
          }
        }
        rafIdRef.current = null;
      });
    };

    /**
     * 입력 대기 프롬프트 감지 함수
     * 지정된 세션의 최근 줄에서 입력 프롬프트 패턴을 확인합니다.
     * 다중 기준 점수 시스템을 사용하여 false positive 방지
     */
    const checkIfWaitingForInput = (targetSessionId: string) => {
      const recentLines = recentLinesRef.current.get(targetSessionId) || [];

      // 각 줄을 점수 기반으로 분석
      const isPrompt = recentLines.some((rawLine, index) => {
        const trimmed = rawLine.trim();
        if (!trimmed) return false;

        const line = trimmed.toLowerCase();
        let score = 0;

        // === STRONG SIGNALS (100점 - 단독으로 충분) ===

        // 명확한 이진 선택 프롬프트
        if (line.includes('(y/n)') || line.includes('[yes/no]') || line.includes('(yes/no)')) {
          score += 100;
        }

        // Claude Code 특정 프롬프트
        if (line.includes('chat about this') || line.includes('Chat about this')) {
          score += 100;
        }

        // 번호 메뉴 + 입력 프롬프트
        if (index > 0) {
          const prevLine = recentLines[index - 1].trim().toLowerCase();
          if (/^\s*\d+\)/.test(prevLine) && (line.endsWith('>') || line.endsWith(':'))) {
            score += 100;
          }
        }

        // Shell 프롬프트 패턴 (줄 시작에만)
        if (/^(ps\s*>|\$|#\s)/.test(line)) {
          score += 100;
        }

        // === MEDIUM SIGNALS (60점) ===

        // 대화형 질문
        if (
          line.endsWith('?') &&
          (line.includes('do you want') ||
            line.includes('would you like') ||
            line.includes('should i') ||
            line.includes('which would'))
        ) {
          score += 60;
        }

        // 명령형 + 콜론
        if (
          /^(enter|type|input|select|choose)/.test(line) &&
          line.endsWith(':')
        ) {
          score += 60;
        }

        // 확인 요청
        if (line.includes('confirm') && (line.endsWith('?') || line.endsWith(':'))) {
          score += 60;
        }

        // 옵션 선택 문구
        if (line.includes('select an option') || line.includes('choose one')) {
          score += 60;
        }

        // === WEAK SIGNALS (40점) ===

        // 짧은 줄
        if (trimmed.length < 80) {
          score += 40;
        }

        // 특정 종료 문자 (:, ?)
        if (line.endsWith(':') || line.endsWith('?')) {
          score += 40;
        }

        // "press"와 "key"가 근접
        const pressIndex = line.indexOf('press');
        const keyIndex = line.indexOf('key');
        if (pressIndex !== -1 && keyIndex !== -1 && Math.abs(keyIndex - pressIndex) <= 20) {
          score += 40;
        }

        // "waiting for" 또는 "awaiting"
        if (line.includes('waiting for') || line.includes('awaiting')) {
          score += 40;
        }

        // === EDGE CASE BOOSTERS (20점) ===

        // 비밀번호/인증 관련
        if (/(password|passphrase|token|credentials?|auth)/i.test(line)) {
          score += 20;
        }

        // 파일 경로 입력
        if (/(path|directory|folder|file|location).*:/i.test(line)) {
          score += 20;
        }

        // 숫자 입력 요청
        if (/(number|count|amount|quantity|how many).*[?:]/i.test(line)) {
          score += 20;
        }

        // === NEGATIVE SIGNALS ===

        // 로그 레벨 감지 개선: 로그 형식과 프롬프트 형식을 구분
        // 로그: "[INFO]: message" or "2024-03-10 INFO: message"
        // 프롬프트: "Info: Please enter your choice:"
        const hasLogTimestamp = /\d{4}-\d{2}-\d{2}/.test(line) || /\[\d{2}:\d{2}:\d{2}\]/.test(line);
        const hasLogPrefix = /^\[?(info|error|debug|warning|warn)\]?\s*:/i.test(line);
        const hasPromptKeywords = /(enter|input|select|choose|type|please)/i.test(line);

        // 로그 형식이거나 타임스탬프가 있으면 거부 (단, 프롬프트 키워드가 있으면 허용)
        if ((hasLogPrefix || hasLogTimestamp) && !hasPromptKeywords) {
          return false;
        }

        // 매우 긴 줄
        if (trimmed.length > 120) {
          score -= 50;
        }

        // 여러 문장 (마침표가 2개 이상)
        if ((trimmed.match(/\./g) || []).length >= 2) {
          score -= 40;
        }

        // 과거형 동사
        if (
          /\b(confirmed|entered|pressed|selected|chosen|typed|completed)\b/.test(line)
        ) {
          score -= 30;
        }

        // 마침표로 끝남
        if (line.endsWith('.')) {
          score -= 20;
        }

        // 문서/도움말 관련
        if (line.includes('documentation') || line.includes('help')) {
          score -= 30;
        }

        // 연속 출력 감점을 마지막 줄만 제외하도록 개선
        // 긴 명령 출력 후 프롬프트는 일반적 패턴이므로 마지막 줄은 감점 안 함
        if (recentLines.length >= 4 && index < recentLines.length - 1) {
          // 마지막 줄이 아닌 중간 줄에만 감점 적용
          score -= 20;
        }

        // 임계값을 95점으로 완화하여 경계 케이스 커버
        const meetsThreshold = score >= 95;

        // 디버깅을 위한 신뢰도 로깅 (개발 모드에서만)
        if (process.env.NODE_ENV === 'development') {
          if (score >= 80) {
            console.log(`[PromptDetection] Session ${targetSessionId.slice(0,8)} - Score: ${score}, Line: "${trimmed}"`);
          }
        }

        return meetsThreshold;
      });

      // 백그라운드 세션인 경우에만 플래그 설정
      if (isPrompt && targetSessionId !== activeSessionId) {
        dispatch(setSessionWaitingForInput({ sessionId: targetSessionId, waiting: true }));
      }
    };

    // CLI 프로세스에서 출력 받기 (모든 세션의 입력 대기 감지, 활성 세션만 렌더링)
    const removeOutput = window.api.cli.onOutput((sid: string, data: string) => {
      if (!mounted) return;  // unmount된 컴포넌트 무시
      if (!cancelled) {
        // === 모든 세션: 입력 대기 감지 ===
        // 최근 줄 추출 (ANSI 제어 문자 제거 후, 세션별로 최대 10줄 유지)
        // eslint-disable-next-line no-control-regex
        const lines = data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').split(/\r?\n/);
        const nonEmptyLines = lines.filter(l => l.trim());
        if (nonEmptyLines.length > 0) {
          const current = recentLinesRef.current.get(sid) || [];
          // 버퍼 크기를 20줄로 확장하여 빠른 출력에서도 프롬프트 캡처
          recentLinesRef.current.set(sid, [...current, ...nonEmptyLines].slice(-20));
        }

        // 타임아웃 관리 개선: 최초 출력 시간 추적하여 최대 지연 방지
        const oldTimeout = detectionTimeoutRef.current.get(sid);
        const firstOutputTime = firstOutputTimeRef.current.get(sid);

        // 첫 출력이면 시작 시간 기록
        if (!firstOutputTime) {
          firstOutputTimeRef.current.set(sid, Date.now());
        }

        if (oldTimeout) {
          clearTimeout(oldTimeout);
        }

        // 최초 출력 후 5초가 지났으면 강제 검사 (연속 출력 중에도)
        const timeSinceFirstOutput = firstOutputTime ? Date.now() - firstOutputTime : 0;
        const shouldForceCheck = timeSinceFirstOutput > 5000;

        const newTimeout = setTimeout(() => {
          if (!cancelled) {
            checkIfWaitingForInput(sid);
            // 검사 후 첫 출력 시간 리셋
            firstOutputTimeRef.current.delete(sid);
          }
          detectionTimeoutRef.current.delete(sid);
        }, shouldForceCheck ? 500 : 3000);

        detectionTimeoutRef.current.set(sid, newTimeout);
      }

      // === 활성 세션만: 렌더링 ===
      if (sid === sessionId && !cancelled) {
        // 버퍼에 데이터 추가
        outputBufferRef.current += data;
        if (firstBufferedAtRef.current === 0) {
          firstBufferedAtRef.current = Date.now();
        }

        // 마지막 출력 시간 업데이트
        lastOutputTimeRef.current = Date.now();

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

        // RTT 측정 및 적응형 임계값 계산
        let currentThreshold = adaptiveThresholdRef.current;
        const timeSinceInput = Date.now() - lastInputTimeRef.current;

        if (pendingInputTimeRef.current !== null &&
            data.length < 20 &&
            timeSinceInput < 500) {
          // RTT 측정값 기록
          const rtt = Date.now() - pendingInputTimeRef.current;
          ipcRttBufferRef.current.push(rtt);

          // 최근 20개만 유지 (순환 버퍼)
          if (ipcRttBufferRef.current.length > 20) {
            ipcRttBufferRef.current.shift();
          }

          // P95 백분위수로 임계값 계산 (이상값에 강건)
          if (ipcRttBufferRef.current.length >= 10) {
            const sorted = [...ipcRttBufferRef.current].sort((a, b) => a - b);
            const p95Index = Math.floor(sorted.length * 0.95);
            const p95Rtt = sorted[p95Index];

            // 임계값 = P95 RTT + 50ms 여유 (최소 50ms, 최대 500ms)
            currentThreshold = Math.max(50, Math.min(500, p95Rtt + 50));
            adaptiveThresholdRef.current = currentThreshold;
          }

          pendingInputTimeRef.current = null;  // 측정 완료
        }

        // 개선된 에코 감지 (동적 임계값 사용)
        const isInputEcho = timeSinceInput < currentThreshold && data.length < 20;

        // 스피너/진행 표시와 같이 제어문자가 포함된 청크 또는 입력 에코는 즉시 반영
        if (hasInteractiveControl || isInputEcho) {
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

        // 100개 입력마다 RTT 통계 로깅 (텔레메트리)
        if (ipcRttBufferRef.current.length > 0 &&
            ipcRttBufferRef.current.length % 100 === 0) {
          const sorted = [...ipcRttBufferRef.current].sort((a, b) => a - b);
          const p50 = sorted[Math.floor(sorted.length * 0.5)];
          const p95 = sorted[Math.floor(sorted.length * 0.95)];
          const p99 = sorted[Math.floor(sorted.length * 0.99)];

          console.log(`[TerminalView] IPC RTT stats - P50: ${p50}ms, P95: ${p95}ms, P99: ${p99}ms, Threshold: ${adaptiveThresholdRef.current}ms`);
        }
      }
    });

    const removeExit = window.api.cli.onExit((sid: string, code: number | null) => {
      if (sid === sessionId) {
        term.write(`\r\n\x1b[33m--- Process exited (code: ${code ?? 'unknown'}) ---\x1b[0m\r\n`);
        // UI 상태를 실제 PTY 상태와 동기화하기 위해 자동 연결 해제
        dispatch(disconnect());
      }
    });

    // 마운트: PTY가 이미 존재하는지 확인 (다시 연결) 또는 새로 생성
    (async () => {
      const { exists } = await window.api.cli.exists(sessionId);
      if (cancelled) return;

      if (exists) {
        // 다시 연결: 스크롤백 버퍼를 쓰고 크기 동기화
        const sb = await window.api.cli.getScrollback(sessionId);
        if (cancelled) return;
        if (sb.ok && sb.data) {
          term.write(sb.data);
        }
        window.api.cli.resize(sessionId, term.cols, term.rows);
      } else {
        // 새 프로세스
        const result = await window.api.cli.connect(sessionId, provider, sessionPath || undefined);
        if (cancelled) return;
        if (!result.ok) {
          term.write(`\x1b[31mError: ${result.error || 'Failed to start CLI process'}\x1b[0m\r\n`);
          // 자동 연결 해제하지 않음 — 사용자가 오류를 읽고 수동으로 연결 해제하도록
        } else {
          window.api.cli.resize(sessionId, term.cols, term.rows);
        }
      }
    })();

    // 클릭하여 터미널 다시 포커스
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
          // Write 작업 중에는 resize 스크롤 스킵 (충돌 방지)
          if (isWritingRef.current) {
            resizeTimeout = null;
            return;
          }

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
                if (termRef.current && !cancelled && !isWritingRef.current) {
                  // 재검증: write 작업이 끝났고 여전히 맨 아래인지 확인
                  try {
                    const buffer = termRef.current.buffer.active;
                    const stillAtBottom = (buffer.baseY - buffer.viewportY) <= 2;
                    if (stillAtBottom) {
                      termRef.current.scrollToBottom();
                    }
                  } catch (e) {
                    // 무시
                  }
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
      mounted = false;  // 즉시 플래그 설정
      cancelled = true;
      isWritingRef.current = false;

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
      // 모든 세션의 입력 대기 감지 타임아웃 정리
      detectionTimeoutRef.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
      detectionTimeoutRef.current.clear();
      firstOutputTimeRef.current.clear();  // 첫 출력 시간 Map도 정리

      // 남은 버퍼 flush
      if (outputBufferRef.current && termRef.current) {
        termRef.current.write(outputBufferRef.current);
        outputBufferRef.current = '';
      }

      observer.disconnect();
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('click', handleClick);
      container.removeEventListener('contextmenu', handleContextMenu);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('keydown', handleKeyScroll);
      container.removeEventListener('compositionstart', handleCompositionStart);
      container.removeEventListener('compositionend', handleCompositionEnd);
      removeOutput();
      removeExit();
      // PTY를 종료하지 말고 단순히 리스너를 분리하고 xterm 정리
      term.dispose();
      termRef.current = null;
    };
  }, [sessionId, provider, sessionPath]);

  /**
   * 터미널 포커스 요청 처리
   *
   * FileExplorer에서 파일 더블클릭 시 자동으로 터미널에 포커스합니다.
   * requestTerminalFocus 플래그가 true가 되면 실행됩니다.
   */
  useEffect(() => {
    if (shouldFocusTerminal && termRef.current) {
      // requestAnimationFrame으로 브라우저 렌더링 사이클 후 실행
      requestAnimationFrame(() => {
        if (termRef.current) {
          termRef.current.focus();

          // 플래그 클리어 (재실행 방지)
          dispatch(clearTerminalFocusRequest(sessionId));
        }
      });
    }
  }, [shouldFocusTerminal, sessionId, dispatch]);

  return <div id="terminal-container" style={{marginBottom: '10px'}} ref={containerRef} />;
};

export default TerminalView;
