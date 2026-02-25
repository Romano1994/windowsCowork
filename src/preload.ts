import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // Chat
  chat: {
    send: (message: string | any[]) => ipcRenderer.invoke('chat:send', message),
    clear: () => ipcRenderer.invoke('chat:clear'),
    onStreamChunk: (callback: (chunk: string) => void) => {
      const handler = (_event: any, chunk: string) => callback(chunk);
      ipcRenderer.on('chat:stream-chunk', handler);
      return () => ipcRenderer.removeListener('chat:stream-chunk', handler);
    },
    onStreamEnd: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('chat:stream-end', handler);
      return () => ipcRenderer.removeListener('chat:stream-end', handler);
    },
  },

  // API Config
  config: {
    set: (config: { provider: string; model: string; apiKey: string }) =>
      ipcRenderer.invoke('api:setConfig', config),
    setModel: (model: string) => ipcRenderer.invoke('api:setModel', model),
    restore: (config: { provider: string; model: string; apiKey: string }) =>
      ipcRenderer.invoke('api:restore', config),
  },

  // CLI (multi-PTY: all methods take sessionId)
  cli: {
    connect: (sessionId: string, provider: string, cwd?: string) =>
      ipcRenderer.invoke('cli:connect', sessionId, provider, cwd),
    disconnect: (sessionId: string) => ipcRenderer.invoke('cli:disconnect', sessionId),
    send: (sessionId: string, data: string) => ipcRenderer.send('cli:send', sessionId, data),
    resize: (sessionId: string, cols: number, rows: number) =>
      ipcRenderer.send('cli:resize', sessionId, cols, rows),
    exists: (sessionId: string) => ipcRenderer.invoke('cli:exists', sessionId),
    getScrollback: (sessionId: string) => ipcRenderer.invoke('cli:getScrollback', sessionId),
    onOutput: (callback: (sessionId: string, data: string) => void) => {
      const handler = (_event: any, sessionId: string, data: string) => callback(sessionId, data);
      ipcRenderer.on('cli:output', handler);
      return () => ipcRenderer.removeListener('cli:output', handler);
    },
    onExit: (callback: (sessionId: string, code: number | null) => void) => {
      const handler = (_event: any, sessionId: string, code: number | null) => callback(sessionId, code);
      ipcRenderer.on('cli:exit', handler);
      return () => ipcRenderer.removeListener('cli:exit', handler);
    },
  },

  // File System
  fs: {
    readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath),
    readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
    readFileForAI: (filePath: string) => ipcRenderer.invoke('fs:readFileForAI', filePath),
    selectFolder: () => ipcRenderer.invoke('fs:selectFolder'),
    getHome: () => ipcRenderer.invoke('fs:getHome'),
  },
});
