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
