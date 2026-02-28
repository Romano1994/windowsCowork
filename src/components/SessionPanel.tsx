/**
 * components/SessionPanel.tsx - 세션 관리 패널
 *
 * 여러 작업 세션을 생성하고 관리하는 컴포넌트입니다.
 * 각 세션은 독립적인 채팅, 작업, 디렉토리를 가집니다.
 *
 * 주요 기능:
 * - 세션 추가/삭제/전환
 * - 세션 이름 변경
 * - 세션별 상태 저장/복원
 */

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

  // Redux 상태 가져오기
  const { sessions, activeId } = useAppSelector((s) => s.session);
  const chat = useAppSelector((s) => s.chat);
  const task = useAppSelector((s) => s.task);
  const file = useAppSelector((s) => s.file);

  /**
   * 로컬 상태 관리 (useState)
   *
   * useState는 컴포넌트 내부 상태를 관리합니다.
   * Redux와 달리 이 컴포넌트에서만 사용됩니다.
   */
  const [nameInput, setNameInput] = useState('');  // 새 세션 이름 입력
  const [editingId, setEditingId] = useState<string | null>(null);  // 편집 중인 세션 ID
  const [editName, setEditName] = useState('');  // 편집 중인 이름

  /**
   * handleAddSession - 새 세션 추가
   *
   * 1. 현재 세션 상태를 저장
   * 2. 새 세션 생성 (현재 디렉토리를 작업 경로로 설정)
   * 3. 빈 상태로 초기화
   */
  const handleAddSession = () => {
    const name = nameInput.trim();
    if (!name) return;

    // 현재 활성 세션이 있으면 상태를 저장
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

    // 새 세션 추가 (현재 파일 탐색기 경로를 작업 경로로)
    dispatch(addSession({ name, path: file.currentPath }));

    // 새 세션은 빈 상태로 시작
    dispatch(restoreMessages({ messages: [], nextId: 1 }));
    dispatch(restoreTasks({ tasks: [], counter: 0 }));
    dispatch(disconnect());
    setNameInput('');
  };

  /**
   * handleSwitch - 세션 전환
   *
   * @param id - 전환할 세션 ID
   *
   * 복잡한 작업 순서:
   * 1. 현재 세션의 모든 상태 저장
   * 2. 활성 세션 변경
   * 3. 대상 세션의 상태 복원
   * 4. 대상 세션의 디렉토리 로드
   * 5. 대상 세션의 AI 연결 상태 복원
   */
  const handleSwitch = async (id: string) => {
    if (id === activeId) return;  // 같은 세션이면 무시

    // 1. 현재 세션 상태 저장
    if (activeId) {
      const currentSession = sessions.find((s) => s.id === activeId);
      dispatch(saveCurrentState({
        messages: chat.messages,
        nextId: chat.nextId,
        tasks: task.tasks,
        taskCounter: task.counter,
        currentPath: currentSession?.path || file.currentPath,
      }));
      // PTY는 계속 실행되도록 연결 상태만 저장
      dispatch(saveSessionConnected({ sessionId: activeId }));
    }

    // 2. 활성 세션 변경
    dispatch(switchSession(id));

    // 3. 대상 세션 데이터 복원
    const target = sessions.find((s) => s.id === id);
    if (!target) return;

    // 채팅 메시지 복원
    dispatch(restoreMessages({
      messages: target.messages,
      // nextId는 기존 메시지 중 최대 ID + 1
      nextId: target.messages.length > 0
        ? Math.max(...target.messages.map((m) => m.id)) + 1
        : 1,
    }));

    // 작업 목록 복원
    dispatch(restoreTasks({ tasks: target.tasks, counter: target.taskCounter }));

    // 4. 디렉토리 로드
    if (target.path) {
      try {
        const result = await window.api.fs.readDir(target.path);
        if (result.ok && result.path && result.entries) {
          dispatch(setDirectory({ path: result.path, entries: result.entries }));
        }
      } catch { /* ignore */ }
    }

    // 5. AI 연결 상태 복원
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
