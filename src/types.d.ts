export {};

declare global {
  interface AIFileResultImage {
    ok: true;
    type: 'image';
    media_type: string;
    data: string;
    fileName: string;
    error: string;
  }

  interface AIFileResultText {
    ok: true;
    type: 'text';
    content: string;
    fileName: string;
    error: string;
  }

  interface AIFileResultError {
    ok: false;
    error: string;
  }

  type AIFileResult = AIFileResultImage | AIFileResultText | AIFileResultError;

  interface Window {
    api: {
      chat: {
        send: (message: string | any[]) => Promise<{ ok: boolean; response?: string; error?: string }>;
        clear: () => Promise<{ ok: boolean }>;
        onStreamChunk: (cb: (chunk: string) => void) => () => void;
        onStreamEnd: (cb: () => void) => () => void;
      };
      config: {
        set: (config: { provider: string; model: string; apiKey: string }) => Promise<{ ok: boolean; error?: string }>;
        setModel: (model: string) => Promise<void>;
        restore: (config: { provider: string; model: string; apiKey: string }) => Promise<void>;
      };
      cli: {
        connect: (sessionId: string, provider: string, cwd?: string) =>
          Promise<{ ok: boolean; existing?: boolean; error?: string }>;
        disconnect: (sessionId: string) => Promise<{ ok: boolean }>;
        send: (sessionId: string, data: string) => void;
        resize: (sessionId: string, cols: number, rows: number) => void;
        exists: (sessionId: string) => Promise<{ exists: boolean }>;
        getScrollback: (sessionId: string) => Promise<{ ok: boolean; data: string }>;
        onOutput: (cb: (sessionId: string, data: string) => void) => () => void;
        onExit: (cb: (sessionId: string, code: number | null) => void) => () => void;
      };
      fs: {
        readDir: (path: string) => Promise<{
          ok: boolean;
          path?: string;
          entries?: Array<{ name: string; isDirectory: boolean }>;
          error?: string;
        }>;
        readFile: (path: string) => Promise<{
          ok: boolean;
          content?: string;
          truncated?: boolean;
          size?: number;
          ext?: string;
          error?: string;
        }>;
        readFileForAI: (path: string) => Promise<AIFileResult>;
        selectFolder: () => Promise<{ ok: boolean; path?: string }>;
        getHome: () => Promise<string>;
      };
    };
  }
}
