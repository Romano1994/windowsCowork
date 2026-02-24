import React from 'react';
import FileExplorer from './components/FileExplorer';
import ChatPanel from './components/ChatPanel';
import TaskPanel from './components/TaskPanel';
import ApiPanel from './components/ApiPanel';

const App: React.FC = () => {
  return (
    <div id="app">
      <header id="titlebar">
        <span className="titlebar-title">WindowsCowork</span>
      </header>
      <div id="main-layout">
        <FileExplorer />
        <ChatPanel />
        <div id="panel-right">
          <TaskPanel />
          <ApiPanel />
        </div>
      </div>
    </div>
  );
};

export default App;
