import React from 'react';
import FileExplorer from './components/FileExplorer';
import ChatPanel from './components/ChatPanel';
import SessionPanel from './components/SessionPanel';
import ApiPanel from './components/ApiPanel';

const App: React.FC = () => {
  return (
    <div id="app">
      <header id="titlebar">
        <span className="titlebar-title">FreiCowork</span>
      </header>
      <div id="main-layout">
        <FileExplorer />
        <ChatPanel />
        <div id="panel-right">
          <SessionPanel />
          <ApiPanel />
        </div>
      </div>
    </div>
  );
};

export default App;
