import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  addSession,
  deleteSession,
  switchSession,
  renameSession,
  saveCurrentState,
} from '../store/sessionSlice';
import { restoreMessages } from '../store/chatSlice';
import { restoreTasks } from '../store/taskSlice';
import { setDirectory } from '../store/fileSlice';
import {
  disconnect,
  saveSessionConnected,
  restoreSessionConnected,
  removeSessionConnected,
} from '../store/apiSlice';

const SessionPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const { sessions, activeId } = useAppSelector((s) => s.session);
  const chat = useAppSelector((s) => s.chat);
  const task = useAppSelector((s) => s.task);
  const file = useAppSelector((s) => s.file);

  const [nameInput, setNameInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleAddSession = () => {
    const name = nameInput.trim();
    if (!name) return;
    // Save current session state — keep the session's OWN stored path, not current file explorer
    if (activeId) {
      const currentSession = sessions.find((s) => s.id === activeId);
      dispatch(saveCurrentState({
        messages: chat.messages,
        nextId: chat.nextId,
        tasks: task.tasks,
        taskCounter: task.counter,
        currentPath: currentSession?.path || file.currentPath,
      }));
      dispatch(saveSessionConnected({ sessionId: activeId }));
    }
    // New session gets current file explorer path (where the user navigated to)
    dispatch(addSession({ name, path: file.currentPath }));
    // Clear state for the new session — new session starts disconnected
    dispatch(restoreMessages({ messages: [], nextId: 1 }));
    dispatch(restoreTasks({ tasks: [], counter: 0 }));
    dispatch(disconnect());
    setNameInput('');
  };

  const handleSwitch = async (id: string) => {
    if (id === activeId) return;

    // 1. Save current session state
    if (activeId) {
      dispatch(saveCurrentState({
        messages: chat.messages,
        nextId: chat.nextId,
        tasks: task.tasks,
        taskCounter: task.counter,
        currentPath: file.currentPath,
      }));
      // Save connected status for current session (PTY stays alive)
      dispatch(saveSessionConnected({ sessionId: activeId }));
    }

    // 2. Switch active session
    dispatch(switchSession(id));

    // 3. Restore new session data
    const target = sessions.find((s) => s.id === id);
    if (!target) return;

    dispatch(restoreMessages({
      messages: target.messages,
      nextId: target.messages.length > 0
        ? Math.max(...target.messages.map((m) => m.id)) + 1
        : 1,
    }));
    dispatch(restoreTasks({ tasks: target.tasks, counter: target.taskCounter }));

    // 4. Load directory
    if (target.path) {
      try {
        const result = await window.api.fs.readDir(target.path);
        if (result.ok && result.path && result.entries) {
          dispatch(setDirectory({ path: result.path, entries: result.entries }));
        }
      } catch { /* ignore */ }
    }

    // 5. Restore connected status for target session (no disconnect — PTY kept alive)
    dispatch(restoreSessionConnected({ sessionId: id }));
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Kill the PTY for this session (if any)
    try {
      await window.api.cli.disconnect(id);
    } catch { /* ignore */ }
    dispatch(removeSessionConnected({ sessionId: id }));

    const wasActive = id === activeId;
    dispatch(deleteSession(id));

    if (wasActive) {
      const remaining = sessions.filter((s) => s.id !== id);
      if (remaining.length > 0) {
        const next = remaining[0];
        dispatch(restoreMessages({
          messages: next.messages,
          nextId: next.messages.length > 0
            ? Math.max(...next.messages.map((m) => m.id)) + 1
            : 1,
        }));
        dispatch(restoreTasks({ tasks: next.tasks, counter: next.taskCounter }));
        dispatch(restoreSessionConnected({ sessionId: next.id }));
        if (next.path) {
          window.api.fs.readDir(next.path).then((result) => {
            if (result.ok && result.path && result.entries) {
              dispatch(setDirectory({ path: result.path, entries: result.entries }));
            }
          });
        }
      } else {
        // Last session deleted — clear all state
        dispatch(restoreMessages({ messages: [], nextId: 1 }));
        dispatch(restoreTasks({ tasks: [], counter: 0 }));
        dispatch(restoreSessionConnected({ sessionId: '' }));
      }
    }
  };

  const handleRename = (id: string) => {
    const trimmed = editName.trim();
    if (trimmed) {
      dispatch(renameSession({ id, name: trimmed }));
    }
    setEditingId(null);
    setEditName('');
  };

  const startRename = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditName(currentName);
  };

  const shortenPath = (p: string) => {
    if (!p) return '(no path)';
    const parts = p.replace(/\\/g, '/').split('/');
    if (parts.length <= 2) return p;
    return '…/' + parts.slice(-2).join('/');
  };

  return (
    <div id="panel-sessions">
      <div className="panel-header">
        <span className="panel-label">Sessions</span>
        <span className="session-count">{sessions.length}</span>
      </div>
      <div id="session-input-area">
        <input
          type="text"
          id="session-input"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddSession()}
          placeholder="New session name..."
        />
        <button id="btn-add-session" onClick={handleAddSession}>+</button>
      </div>
      <ul id="session-list">
        {sessions.map((session) => (
          <li
            key={session.id}
            className={session.id === activeId ? 'active' : ''}
            onClick={() => handleSwitch(session.id)}
          >
            <div className="session-info">
              {editingId === session.id ? (
                <input
                  className="session-rename-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(session.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onBlur={() => handleRename(session.id)}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              ) : (
                <span
                  className="session-name"
                  onDoubleClick={(e) => startRename(session.id, session.name, e)}
                >
                  {session.name}
                </span>
              )}
              <span className="session-path">{shortenPath(session.path)}</span>
            </div>
            <button
              className="session-delete"
              onClick={(e) => handleDelete(session.id, e)}
              title="Delete session"
            >
              {'\u00D7'}
            </button>
          </li>
        ))}
      </ul>
      {sessions.length === 0 && (
        <div id="session-empty">No sessions. Create one above.</div>
      )}
    </div>
  );
};

export default SessionPanel;
