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
