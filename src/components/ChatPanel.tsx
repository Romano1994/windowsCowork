/**
 * components/ChatPanel.tsx - 채팅/터미널 패널 컴포넌트
 *
 * AI와의 채팅 또는 CLI 터미널을 표시하는 메인 패널입니다.
 * - 일반 모드: AI와의 채팅 인터페이스
 * - CLI 모드: 터미널 인터페이스 (Claude Code, Codex)
 */

/**
 * React hooks import:
 * - useEffect: 컴포넌트 생명주기나 상태 변화에 반응
 * - useRef: DOM 참조나 렌더링 간 유지되는 값 저장
 * - useCallback: 함수 메모이제이션 (불필요한 재생성 방지)
 */
import React, { useEffect, useRef, useCallback } from 'react';

// Redux hooks와 액션들을 import
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setInput,
  addMessageWithId,
  updateMessageText,
  removeEmptyMessage,
  addMessage,
  setStreaming,
} from '../store/chatSlice';
import { deleteSelectedFile, clearFileAlert } from '../store/fileSlice'
import { isCliProvider } from '../store/apiSlice';
import { store } from '../store';
import TerminalView from './TerminalView';

/**
 * ChatPanel 컴포넌트
 *
 * React.FC는 Function Component 타입입니다.
 */
const ChatPanel: React.FC = () => {
  /**
   * useAppDispatch - Redux 액션을 발생시키는 함수
   *
   * dispatch(action)을 호출하면 Redux 스토어의 상태가 변경됩니다.
   */
  const dispatch = useAppDispatch();

  /**
   * useAppSelector - Redux 스토어에서 필요한 상태를 선택
   *
   * selector 함수는 전체 상태(RootState)를 받아 필요한 부분만 반환합니다.
   * 선택된 상태가 변경되면 컴포넌트가 리렌더링됩니다.
   *
   * 구조 분해 할당(destructuring)으로 여러 값을 한 번에 가져옵니다:
   * const { a, b } = { a: 1, b: 2 } → const a = 1, b = 2
   */
  const { messages, input, isStreaming } = useAppSelector((s) => s.chat);
  const { provider, connected } = useAppSelector((s) => s.api);
  const activeSessionId = useAppSelector((s) => s.session.activeId);

  /**
   * find는 배열에서 조건을 만족하는 첫 번째 요소를 반환합니다.
   * 화살표 함수(=>)는 간결한 함수 표현식입니다.
   */
  const activeSession = useAppSelector((s) =>
    s.session.sessions.find(session => session.id === activeSessionId)
  );

  const selectedFile = useAppSelector((s) => s.file.selectedFile);
  const fileAlert = useAppSelector((s) => s.file.fileAlert);

  /**
   * cliMode - CLI 모드 여부 계산
   *
   * &&는 논리 AND 연산자입니다.
   * 양쪽이 모두 true일 때만 true를 반환합니다.
   */
  const cliMode = isCliProvider(provider) && connected;

  /**
   * useRef - 렌더링 간 유지되는 값 저장
   *
   * useRef는 { current: value } 객체를 반환합니다.
   * .current 값을 변경해도 리렌더링이 발생하지 않습니다.
   *
   * 주요 용도:
   * 1. DOM 요소 참조
   * 2. 이전 값 저장
   * 3. 타이머/구독 ID 저장
   */

  /**
   * messagesEndRef - 메시지 목록의 끝을 가리키는 DOM 참조
   * 새 메시지가 추가되면 자동 스크롤하기 위해 사용합니다.
   *
   * <HTMLDivElement>는 제네릭 타입으로, div 요소를 참조함을 명시합니다.
   * null로 초기화하고, JSX에서 ref={messagesEndRef}로 연결합니다.
   */
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /**
   * streamTextRef - 스트리밍 중인 텍스트를 임시 저장
   * AI 응답이 청크 단위로 들어올 때 누적합니다.
   */
  const streamTextRef = useRef('');

  /**
   * streamMsgIdRef - 스트리밍 중인 메시지의 ID
   * 어떤 메시지를 업데이트해야 하는지 추적합니다.
   */
  const streamMsgIdRef = useRef(-1);

  /**
   * scrollToBottom - 메시지 목록의 끝으로 스크롤
   *
   * ?는 옵셔널 체이닝(optional chaining) 연산자입니다.
   * messagesEndRef.current가 null이면 실행하지 않습니다.
   * null?.method() → 에러 없이 undefined 반환
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  };

  /**
   * useEffect - 부수 효과(side effect) 처리
   *
   * useEffect(callback, dependencies)
   * - callback: 실행할 함수
   * - dependencies: 의존성 배열 (이 값이 변경되면 callback 재실행)
   *
   * 여기서는 messages가 변경될 때마다 스크롤을 아래로 이동시킵니다.
   */
  useEffect(() => {
    scrollToBottom();
  }, [messages]);  // messages가 변경되면 실행

  /**
   * Stream listeners 설정
   *
   * 이 useEffect는 컴포넌트가 마운트될 때 한 번만 실행됩니다.
   * AI 스트리밍 이벤트 리스너를 등록합니다.
   */
  useEffect(() => {
    /**
     * onStreamChunk - 스트리밍 청크를 받을 때마다 호출
     *
     * +=는 복합 대입 연산자로, a += b는 a = a + b와 같습니다.
     * 청크를 누적하여 메시지 텍스트를 업데이트합니다.
     */
    const removeChunk = window.api.chat.onStreamChunk((chunk: string) => {
      streamTextRef.current += chunk;  // 텍스트 누적
      dispatch(updateMessageText({
        id: streamMsgIdRef.current,
        text: streamTextRef.current
      }));
    });

    /**
     * onStreamEnd - 스트리밍이 끝날 때 호출
     */
    const removeEnd = window.api.chat.onStreamEnd(() => {
      // 스트림 완료 (현재는 추가 처리 없음)
    });

    /**
     * cleanup 함수
     *
     * useEffect에서 함수를 반환하면, 컴포넌트가 언마운트되거나
     * 의존성이 변경되기 전에 실행됩니다.
     * 여기서는 이벤트 리스너를 제거하여 메모리 누수를 방지합니다.
     */
    return () => {
      removeChunk();  // 청크 리스너 제거
      removeEnd();    // 종료 리스너 제거
    };
  }, [dispatch]);  // dispatch는 변경되지 않지만, 의존성에 포함하는 것이 권장됩니다

  /**
   * sendMessage - 메시지 전송 함수
   *
   * useCallback으로 감싸 함수를 메모이제이션합니다.
   * 의존성(input, isStreaming 등)이 변경되지 않으면 같은 함수 인스턴스를 재사용합니다.
   *
   * async는 비동기 함수를 선언할 때 사용합니다.
   * async 함수는 항상 Promise를 반환합니다.
   */
  const sendMessage = useCallback(async () => {
    // trim()으로 앞뒤 공백 제거
    let text = input.trim();
    if (!text) return;  // 빈 입력은 무시

    /**
     * CLI 모드 처리
     * CLI 모드에서는 입력을 터미널에 직접 전송합니다.
     */
    if (cliMode) {
      window.api.cli.send(activeSessionId || 'default', text + '\n');
      dispatch(setInput(''));  // 입력 필드 초기화
      return;  // Early return
    }

    // 이미 스트리밍 중이면 무시 (중복 전송 방지)
    if (isStreaming) return;

    // 상태 초기화
    dispatch(setInput(''));
    dispatch(setStreaming(true));
    if (fileAlert) dispatch(clearFileAlert());

    /**
     * try-catch-finally 블록
     *
     * - try: 실행할 코드 (에러 발생 가능)
     * - catch: 에러 처리
     * - finally: 성공/실패 관계없이 항상 실행 (cleanup용)
     */
    try {
      /**
       * 파일 첨부 처리
       *
       * store.getState()로 현재 Redux 상태를 직접 가져올 수 있습니다.
       * 일반적으로는 useSelector를 사용하지만,
       * 여기서는 함수 내부에서 최신 상태가 필요하므로 직접 접근합니다.
       */
      const fileState = store.getState().file;
      let displayText = text;           // 화면에 표시할 텍스트
      let apiMessage: string | any[] = text;  // API에 전송할 메시지

      // 파일이 선택되어 있으면
      if (fileState.selectedFile) {
        /**
         * 경로 구분자 처리
         * Windows는 \, Unix는 /를 사용합니다.
         * 경로가 이미 구분자로 끝나면 추가하지 않습니다.
         *
         * 삼항 연산자: condition ? valueIfTrue : valueIfFalse
         */
        const sep = fileState.currentPath.endsWith('\\') || fileState.currentPath.endsWith('/') ? '' : '\\';
        const fullPath = fileState.currentPath + sep + fileState.selectedFile;

        // 파일 읽기 (타입 선언)
        let fileResult: AIFileResult;
        try {
          /**
           * await는 Promise가 완료될 때까지 기다립니다.
           * async 함수 내부에서만 사용할 수 있습니다.
           */
          fileResult = await window.api.fs.readFileForAI(fullPath);
        } catch (e: any) {
          // 파일 읽기 실패 시 에러 처리
          dispatch(deleteSelectedFile());
          dispatch(addMessage({ type: 'error', text: e.message || '파일을 읽을 수 없습니다.' }));
          dispatch(setStreaming(false));
          return;
        }

        // 화면에 표시할 텍스트 (파일명 포함)
        // 템플릿 리터럴: `문자열 ${변수}` 형태로 문자열을 만듭니다
        displayText = `[${fileState.selectedFile}]\n${text}`;

        // 파일 읽기 결과 확인
        if (!fileResult.ok) {
          dispatch(deleteSelectedFile());
          dispatch(addMessage({ type: 'error', text: fileResult.error || '파일을 읽을 수 없습니다.' }));
          dispatch(setStreaming(false));
          return;
        }

        /**
         * 파일 타입에 따라 다른 형식으로 전송
         */
        if (fileResult.type === 'image') {
          /**
           * 이미지 파일: Claude Vision API 형식
           * 배열로 컨텐츠 블록을 구성합니다.
           */
          apiMessage = [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: fileResult.media_type,
                data: fileResult.data,
              },
            },
            {
              type: 'text',
              text: `첨부된 이미지 파일: ${fileResult.fileName}\n\n사용자 메시지: ${text}`,
            },
          ];
        } else {
          /**
           * 텍스트 파일: 마크다운 코드 블록으로 감싸기
           * ` (백틱)로 감싸면 코드 블록이 됩니다.
           */
          apiMessage = `다음은 첨부된 파일 \`${fileResult.fileName}\`의 내용입니다:\n\`\`\`\n${fileResult.content}\n\`\`\`\n\n사용자 메시지: ${text}`;
        }

        // 파일 선택 해제
        dispatch(deleteSelectedFile());
      }

      /**
       * 메시지 ID 미리 할당
       *
       * 사용자 메시지와 AI 응답용 빈 메시지를 동시에 추가합니다.
       * AI 응답은 스트리밍으로 점진적으로 채워집니다.
       */
      const state = store.getState().chat;
      const userId = state.nextId;         // 사용자 메시지 ID
      const assistantId = state.nextId + 1; // AI 메시지 ID

      // 사용자 메시지 추가
      dispatch(addMessageWithId({ id: userId, type: 'user', text: displayText }));

      // AI 응답용 빈 메시지 추가 (스트리밍으로 채워질 예정)
      dispatch(addMessageWithId({ id: assistantId, type: 'assistant', text: '' }));

      // 스트리밍 상태 초기화
      streamTextRef.current = '';
      streamMsgIdRef.current = assistantId;

      /**
       * AI API 호출
       * await로 응답을 기다립니다.
       */
      const result = await window.api.chat.send(apiMessage);

      /**
       * 결과 처리
       */
      if (!result.ok) {
        // 실패 시 빈 메시지 제거하고 에러 메시지 추가
        dispatch(removeEmptyMessage(assistantId));
        dispatch(addMessage({ type: 'error', text: result.error || 'Unknown error' }));
      }
    } catch (e: any) {
      /**
       * 예외 처리
       * e: any는 에러 객체의 타입입니다.
       * TypeScript에서 catch의 에러는 기본적으로 unknown 타입이므로
       * any로 단언하여 .message에 접근할 수 있게 합니다.
       */
      dispatch(addMessage({ type: 'error', text: e.message || '알 수 없는 오류가 발생했습니다.' }));
    } finally {
      /**
       * finally 블록은 성공/실패 관계없이 항상 실행됩니다.
       * 스트리밍 상태를 해제합니다.
       */
      dispatch(setStreaming(false));
    }
  }, [input, isStreaming, fileAlert, cliMode, dispatch]);  // 의존성 배열

  /**
   * handleKeyDown - 키보드 이벤트 처리
   *
   * @param e - React의 키보드 이벤트
   *
   * React.KeyboardEvent<T>는 특정 요소(T)에서 발생하는 키보드 이벤트 타입입니다.
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    /**
     * Enter 키를 누르면 메시지 전송
     * Shift+Enter는 줄바꿈 (기본 동작)
     *
     * &&는 논리 AND로, 양쪽 조건이 모두 참일 때 true입니다.
     * !는 부정 연산자로, true ↔ false를 반전시킵니다.
     */
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();  // 기본 동작(줄바꿈) 방지
      sendMessage();
    }
  };

  /**
   * handleXBtn - 첨부 파일 제거 버튼 핸들러
   */
  const handleXBtn = () => {
    dispatch(deleteSelectedFile());
  }

  /**
   * JSX 반환 - 컴포넌트의 UI를 정의합니다
   */
  return (
    <main id="panel-chat">
      {/**
       * 조건부 렌더링
       *
       * {condition ? <A /> : <B />}
       * - condition이 true면 A 컴포넌트
       * - condition이 false면 B 컴포넌트
       *
       * CLI 모드와 채팅 모드를 전환합니다.
       */}
      {cliMode ? (
        /**
         * CLI 모드: 터미널 표시
         *
         * props 전달:
         * - provider: AI 제공자
         * - sessionId: 세션 ID (없으면 'default')
         * - sessionPath: 세션의 작업 경로
         *
         * ||는 논리 OR 연산자로, 왼쪽이 falsy면 오른쪽 값을 반환합니다.
         */
        <TerminalView
          provider={provider}
          sessionId={activeSessionId || 'default'}
          sessionPath={activeSession?.path}
        />
      ) : (
        /**
         * 채팅 모드: 메시지 목록 표시
         */
        <div id="chat-messages">
          {/**
           * map은 배열의 각 요소를 변환합니다.
           * messages.map(msg => <JSX>) → 각 메시지를 JSX로 변환
           *
           * key prop은 React가 리스트 아이템을 추적하는데 사용됩니다.
           * 고유한 값이어야 합니다.
           *
           * 템플릿 리터럴: `chat-msg ${msg.type}`
           * - msg.type이 'user'면 "chat-msg user"
           * - msg.type이 'assistant'면 "chat-msg assistant"
           * 이렇게 동적으로 클래스를 조합할 수 있습니다.
           */}
          {messages.map((msg) => (
            <div key={msg.id} className={`chat-msg ${msg.type}`}>
              {msg.text}
            </div>
          ))}

          {/**
           * 스크롤 앵커
           * ref로 DOM 요소를 참조하여 scrollIntoView할 수 있게 합니다.
           */}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/**
       * 파일 경고 메시지 표시
       *
       * {condition && <JSX>}는 조건부 렌더링의 또 다른 방법입니다.
       * - condition이 true면 JSX 렌더링
       * - condition이 false면 아무것도 렌더링하지 않음
       */}
      {!cliMode && fileAlert && (
        <div id="chat-file-alert">{fileAlert}</div>
      )}

      {/**
       * 선택된 파일 표시
       *
       * style prop은 인라인 스타일을 지정합니다.
       * JSX에서는 중괄호 2개를 사용합니다: {{}}
       * - 외부 {}: JSX 표현식
       * - 내부 {}: JavaScript 객체
       *
       * CSS 속성은 카멜케이스로 작성합니다:
       * - display-flex → display: 'flex'
       */}
      {!cliMode && selectedFile && (
        <div style={{display: 'flex'}}>
          <div id="chat-selected-file">{selectedFile}</div>

          {/**
           * onClick prop은 클릭 이벤트 핸들러입니다.
           * 함수를 전달하면 클릭 시 해당 함수가 실행됩니다.
           */}
          <div className="btn_x" onClick={handleXBtn}>x</div>
        </div>
      )}

      {/**
       * 입력 영역 (채팅 모드에서만 표시)
       */}
      {!cliMode && (
        <div id="chat-input-area">
          {/**
           * textarea - 다중 행 입력 필드
           *
           * props:
           * - value: 제어 컴포넌트의 현재 값
           * - onChange: 값이 변경될 때 호출되는 핸들러
           * - onKeyDown: 키를 누를 때 호출되는 핸들러
           * - placeholder: 빈 입력 필드에 표시되는 힌트
           * - rows: 표시할 행 수
           *
           * 제어 컴포넌트(Controlled Component):
           * React 상태와 입력 값을 동기화하는 컴포넌트입니다.
           * value와 onChange를 함께 사용해야 합니다.
           */}
          <textarea
            id="chat-input"
            value={input}
            onChange={(e) => {
              /**
               * onChange는 인라인 화살표 함수를 사용합니다.
               * e.target.value는 입력된 값입니다.
               */
              if (fileAlert) dispatch(clearFileAlert());
              dispatch(setInput(e.target.value));
            }}
            onKeyDown={handleKeyDown}
            placeholder="Enter message..."
            rows={2}
          />

          {/**
           * button - 전송 버튼
           *
           * disabled prop이 true면 버튼이 비활성화됩니다.
           * 스트리밍 중에는 전송할 수 없도록 합니다.
           */}
          <button id="btn-send" onClick={sendMessage} disabled={isStreaming}>
            Send
          </button>
        </div>
      )}
    </main>
  );
};

/**
 * default export
 */
export default ChatPanel;
