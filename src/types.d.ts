/**
 * types.d.ts - 전역 타입 정의 파일
 *
 * TypeScript의 타입 선언 파일(.d.ts)은 타입 정보만을 포함합니다.
 * 이 파일은 전역 타입과 Electron의 preload API 타입을 정의합니다.
 */

// export {}는 이 파일을 모듈로 만들어 global scope 오염을 방지합니다
export {};

/**
 * declare global 블록은 전역 타입을 선언할 때 사용합니다.
 * 이 안에 선언된 타입은 프로젝트 어디서든 import 없이 사용할 수 있습니다.
 */
declare global {
  /**
   * AIFileResultImage - 이미지 파일 읽기 결과 타입
   *
   * Interface는 TypeScript에서 객체의 구조를 정의하는 방법입니다.
   * 이 인터페이스는 이미지 파일을 AI에게 전달하기 위한 구조를 정의합니다.
   */
  interface AIFileResultImage {
    ok: true;              // 성공 여부 (리터럴 타입: 반드시 true만 가능)
    type: 'image';         // 파일 타입 (리터럴 타입: 반드시 'image'만 가능)
    media_type: string;    // MIME 타입 (예: 'image/png', 'image/jpeg')
    data: string;          // Base64로 인코딩된 이미지 데이터
    fileName: string;      // 파일 이름
    error: string;         // 에러 메시지 (성공 시 빈 문자열)
  }

  /**
   * AIFileResultText - 텍스트 파일 읽기 결과 타입
   *
   * PDF, PPTX, 일반 텍스트 파일 등을 AI에게 전달하기 위한 구조입니다.
   */
  interface AIFileResultText {
    ok: true;              // 성공 여부
    type: 'text';          // 파일 타입 (리터럴 타입)
    content: string;       // 파일의 텍스트 내용
    fileName: string;      // 파일 이름
    error: string;         // 에러 메시지
  }

  /**
   * AIFileResultError - 파일 읽기 실패 결과 타입
   */
  interface AIFileResultError {
    ok: false;             // 실패 상태 (리터럴 타입: 반드시 false)
    error: string;         // 에러 메시지
  }

  /**
   * AIFileResult - Union 타입 (합집합 타입)
   *
   * TypeScript의 Union 타입은 여러 타입 중 하나가 될 수 있는 타입입니다.
   * '|' 연산자로 타입을 연결합니다.
   *
   * AIFileResult는 성공(Image/Text) 또는 실패(Error) 중 하나의 타입이 됩니다.
   */
  type AIFileResult = AIFileResultImage | AIFileResultText | AIFileResultError;

  /**
   * Window 인터페이스 확장
   *
   * Electron의 preload 스크립트에서 노출한 API를 타입으로 정의합니다.
   * 이를 통해 renderer 프로세스에서 window.api를 안전하게 사용할 수 있습니다.
   */
  interface Window {
    /**
     * api - Electron의 main 프로세스와 통신하기 위한 API 객체
     *
     * Electron의 보안을 위해 contextBridge를 통해 노출된 API들입니다.
     */
    api: {
      /**
       * chat - AI 채팅 관련 API
       */
      chat: {
        /**
         * send - AI에게 메시지를 전송합니다
         *
         * @param message - 문자열 또는 컨텐츠 블록 배열 (이미지 + 텍스트)
         * @returns Promise로 감싸진 결과 객체
         *
         * Promise<T>는 비동기 작업의 결과를 나타내는 타입입니다.
         */
        send: (message: string | any[]) => Promise<{ ok: boolean; response?: string; error?: string }>;

        /**
         * clear - 채팅 기록을 지웁니다
         */
        clear: () => Promise<{ ok: boolean }>;

        /**
         * onStreamChunk - AI 응답이 스트리밍될 때 호출되는 리스너 등록
         *
         * @param cb - 청크를 받을 때마다 호출되는 콜백 함수
         * @returns 리스너를 제거하는 함수 (cleanup용)
         *
         * 이 패턴은 이벤트 리스너를 등록하고 나중에 제거할 수 있게 해줍니다.
         */
        onStreamChunk: (cb: (chunk: string) => void) => () => void;

        /**
         * onStreamEnd - 스트리밍이 끝날 때 호출되는 리스너
         */
        onStreamEnd: (cb: () => void) => () => void;
      };

      /**
       * config - AI API 설정 관련
       */
      config: {
        /**
         * set - API 설정을 저장하고 연결을 시도합니다
         */
        set: (config: { provider: string; model: string; apiKey: string }) => Promise<{ ok: boolean; error?: string }>;

        /**
         * setModel - 모델만 변경합니다
         */
        setModel: (model: string) => Promise<void>;

        /**
         * restore - 저장된 설정을 복원합니다
         */
        restore: (config: { provider: string; model: string; apiKey: string }) => Promise<void>;
      };

      /**
       * cli - 터미널(CLI) 관련 API
       *
       * PTY (Pseudo Terminal)를 사용하여 실제 터미널 환경을 제공합니다.
       */
      cli: {
        /**
         * connect - CLI 프로세스를 시작하거나 연결합니다
         *
         * @param sessionId - 세션 식별자
         * @param provider - AI 제공자 ('claude-code' 또는 'codex')
         * @param cwd - 작업 디렉토리 (선택사항)
         */
        connect: (sessionId: string, provider: string, cwd?: string) =>
          Promise<{ ok: boolean; existing?: boolean; error?: string }>;

        /**
         * disconnect - CLI 프로세스를 종료합니다
         */
        disconnect: (sessionId: string) => Promise<{ ok: boolean }>;

        /**
         * send - CLI에 입력을 전송합니다
         */
        send: (sessionId: string, data: string) => void;

        /**
         * resize - 터미널 크기를 조정합니다
         */
        resize: (sessionId: string, cols: number, rows: number) => void;

        /**
         * exists - 해당 세션의 PTY가 존재하는지 확인합니다
         */
        exists: (sessionId: string) => Promise<{ exists: boolean }>;

        /**
         * getScrollback - 터미널의 이전 출력을 가져옵니다
         */
        getScrollback: (sessionId: string) => Promise<{ ok: boolean; data: string }>;

        /**
         * onOutput - 터미널 출력을 받을 리스너를 등록합니다
         */
        onOutput: (cb: (sessionId: string, data: string) => void) => () => void;

        /**
         * onExit - 프로세스 종료 시 호출될 리스너를 등록합니다
         */
        onExit: (cb: (sessionId: string, code: number | null) => void) => () => void;
      };

      /**
       * fs - 파일 시스템 관련 API
       */
      fs: {
        /**
         * readDir - 디렉토리의 내용을 읽습니다
         */
        readDir: (path: string) => Promise<{
          ok: boolean;
          path?: string;
          entries?: Array<{ name: string; isDirectory: boolean }>;
          error?: string;
        }>;

        /**
         * readFile - 파일의 내용을 읽습니다
         */
        readFile: (path: string) => Promise<{
          ok: boolean;
          content?: string;
          truncated?: boolean;
          size?: number;
          ext?: string;
          error?: string;
        }>;

        /**
         * readFileForAI - AI에게 전달할 형식으로 파일을 읽습니다
         * 이미지는 Base64로, 텍스트는 문자열로 변환합니다.
         */
        readFileForAI: (path: string) => Promise<AIFileResult>;

        /**
         * selectFolder - 폴더 선택 다이얼로그를 엽니다
         */
        selectFolder: () => Promise<{ ok: boolean; path?: string }>;

        /**
         * getHome - 사용자의 홈 디렉토리 경로를 반환합니다
         */
        getHome: () => Promise<string>;
      };
    };
  }
}
