/**
 * components/SessionPanel.tsx - 프로젝트/세션 트리 패널
 *
 * 사이드바에 프로젝트(작업 폴더 단위)와 그 하위 세션을 트리 형태로 표시합니다.
 * - 상단 "새 프로젝트" 버튼: FileExplorer 현재 경로로 프로젝트 lookup/생성 + 첫 세션
 * - 프로젝트 헤더: 토글, 이름, + 버튼, 삭제 버튼
 * - 세션 행: 이름(인라인 편집), 입력 대기 인디케이터, 삭제 버튼
 * - 빈 세션(첫 메시지 전, ephemeral)은 다른 세션 전환 시 자동 삭제됨
 */

import React, { useState, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  createSession,
  createSessionInProject,
  deleteSession,
  deleteProject,
  toggleProjectCollapsed,
  switchSession,
  renameSession,
  saveCurrentState,
  reorderProjects,
  reorderSessionsInProject,
  deriveProjectName,
  type Session,
} from '../store/sessionSlice';
import { restoreMessages } from '../store/chatSlice';
import { restoreTasks } from '../store/taskSlice';
import { setDirectory } from '../store/fileSlice';
import {
  saveSessionConnected,
  restoreSessionConnected,
  removeSessionConnected,
  setConnected,
} from '../store/apiSlice';
import { store } from '../store';

type DragKind = 'project' | 'session';
interface DragState {
  kind: DragKind;
  index: number;
  projectId?: string;
}

const SessionPanel: React.FC = () => {
  const dispatch = useAppDispatch();

  const { projects, sessions, activeId } = useAppSelector((s) => s.session);
  const chat = useAppSelector((s) => s.chat);
  const task = useAppSelector((s) => s.task);
  const file = useAppSelector((s) => s.file);
  const provider = useAppSelector((s) => s.api.provider);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [dragOver, setDragOver] = useState<{ kind: DragKind; index: number; projectId?: string } | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const isCliProvider = provider === 'claude-code' || provider === 'codex';
  const activeSession = sessions.find((s) => s.id === activeId);

  const sessionsByProject = (projectId: string): Session[] =>
    sessions.filter((s) => s.projectId === projectId);

  /** 현재 활성 세션의 chat/task 상태를 슬라이스에 저장 */
  const persistActive = () => {
    if (!activeId) return;
    dispatch(saveCurrentState({
      messages: chat.messages,
      nextId: chat.nextId,
      tasks: task.tasks,
      taskCounter: task.counter,
      currentPath: activeSession?.path || file.currentPath,
    }));
    dispatch(saveSessionConnected({ sessionId: activeId }));
  };

  /** 새 세션 생성 후 PTY auto-spawn 등 후속 처리 */
  const afterCreate = async (projectPath: string) => {
    const newId = store.getState().session.activeId;
    if (!newId) return;
    dispatch(restoreMessages({ messages: [], nextId: 1 }));
    dispatch(restoreTasks({ tasks: [], counter: 0 }));
    try {
      const result = await window.api.fs.readDir(projectPath);
      if (result.ok && result.path && result.entries) {
        dispatch(setDirectory({ path: result.path, entries: result.entries }));
      }
    } catch { /* ignore */ }
    if (isCliProvider) {
      // connected=true → cliMode 활성화 → TerminalView 마운트 → Claude Code 표시
      dispatch(setConnected(true));
      try { await window.api.cli.connect(newId, provider, projectPath); } catch { /* ignore */ }
    }
  };

  const handleNewProject = async () => {
    if (!file.currentPath) return;
    // 이전 활성이 ephemeral이면 PTY kill
    if (activeSession?.ephemeral) {
      try { await window.api.cli.disconnect(activeSession.id); } catch { /* ignore */ }
      dispatch(removeSessionConnected({ sessionId: activeSession.id }));
    } else {
      persistActive();
    }
    dispatch(createSession({
      projectPath: file.currentPath,
      provider: isCliProvider ? provider : 'claude-code',
    }));
    await afterCreate(file.currentPath);
  };

  const handleAddSessionToProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    if (activeSession?.ephemeral) {
      try { await window.api.cli.disconnect(activeSession.id); } catch { /* ignore */ }
      dispatch(removeSessionConnected({ sessionId: activeSession.id }));
    } else {
      persistActive();
    }
    dispatch(createSessionInProject({
      projectId,
      provider: isCliProvider ? provider : 'claude-code',
    }));
    await afterCreate(project.path);
  };

  const handleSwitch = async (id: string) => {
    if (id === activeId) return;

    // 이전 활성이 ephemeral이면 PTY kill (slice가 세션 자체는 제거)
    let prevEphemeralId: string | null = null;
    if (activeSession?.ephemeral) {
      prevEphemeralId = activeSession.id;
    } else {
      persistActive();
    }

    dispatch(switchSession(id));

    if (prevEphemeralId) {
      try { await window.api.cli.disconnect(prevEphemeralId); } catch { /* ignore */ }
      dispatch(removeSessionConnected({ sessionId: prevEphemeralId }));
    }

    const target = store.getState().session.sessions.find((s) => s.id === id);
    if (!target) return;

    dispatch(restoreMessages({
      messages: target.messages,
      nextId: target.messages.length > 0
        ? Math.max(...target.messages.map((m) => m.id)) + 1
        : 1,
    }));
    dispatch(restoreTasks({ tasks: target.tasks, counter: target.taskCounter }));

    if (target.path) {
      try {
        const result = await window.api.fs.readDir(target.path);
        if (result.ok && result.path && result.entries) {
          dispatch(setDirectory({ path: result.path, entries: result.entries }));
        }
      } catch { /* ignore */ }
    }
    dispatch(restoreSessionConnected({ sessionId: id }));
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try { await window.api.cli.disconnect(id); } catch { /* ignore */ }
    dispatch(removeSessionConnected({ sessionId: id }));

    const wasActive = id === activeId;
    dispatch(deleteSession(id));

    if (wasActive) {
      const nextId = store.getState().session.activeId;
      const next = nextId ? store.getState().session.sessions.find((s) => s.id === nextId) : null;
      if (next) {
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
        dispatch(restoreMessages({ messages: [], nextId: 1 }));
        dispatch(restoreTasks({ tasks: [], counter: 0 }));
      }
    }
  };

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const owned = sessionsByProject(projectId);
    if (owned.length > 0) {
      const ok = window.confirm(`이 프로젝트와 그 안의 세션 ${owned.length}개를 삭제할까요?`);
      if (!ok) return;
      for (const s of owned) {
        try { await window.api.cli.disconnect(s.id); } catch { /* ignore */ }
        dispatch(removeSessionConnected({ sessionId: s.id }));
      }
    }
    const wasActiveInProject = !!activeSession && activeSession.projectId === projectId;
    dispatch(deleteProject(projectId));
    if (wasActiveInProject) {
      const nextId = store.getState().session.activeId;
      const next = nextId ? store.getState().session.sessions.find((s) => s.id === nextId) : null;
      if (next) {
        dispatch(restoreMessages({
          messages: next.messages,
          nextId: next.messages.length > 0
            ? Math.max(...next.messages.map((m) => m.id)) + 1
            : 1,
        }));
        dispatch(restoreTasks({ tasks: next.tasks, counter: next.taskCounter }));
        dispatch(restoreSessionConnected({ sessionId: next.id }));
      } else {
        dispatch(restoreMessages({ messages: [], nextId: 1 }));
        dispatch(restoreTasks({ tasks: [], counter: 0 }));
      }
    }
  };

  const handleToggleCollapse = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(toggleProjectCollapsed(projectId));
  };

  const handleRename = (id: string) => {
    const trimmed = editName.trim();
    if (trimmed) dispatch(renameSession({ id, name: trimmed }));
    setEditingId(null);
    setEditName('');
  };

  const startRename = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditName(currentName);
  };

  // ── Drag & Drop ────────────────────────────────────────────────
  const startDrag = (state: DragState, e: React.DragEvent) => {
    dragRef.current = state;
    e.dataTransfer.effectAllowed = 'move';
  };

  const overTarget = (kind: DragKind, index: number, projectId: string | undefined, e: React.DragEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    // 프로젝트 드래그는 프로젝트 슬롯에만, 세션 드래그는 같은 프로젝트의 세션 슬롯에만
    if (drag.kind !== kind) return;
    if (kind === 'session' && drag.projectId !== projectId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver({ kind, index, projectId });
  };

  const dropTarget = (kind: DragKind, index: number, projectId: string | undefined, e: React.DragEvent) => {
    e.preventDefault();
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind !== kind) { dragRef.current = null; setDragOver(null); return; }
    if (kind === 'project') {
      if (drag.index !== index) {
        dispatch(reorderProjects({ fromIndex: drag.index, toIndex: index }));
      }
    } else if (kind === 'session' && projectId && drag.projectId === projectId) {
      if (drag.index !== index) {
        dispatch(reorderSessionsInProject({ projectId, fromIndex: drag.index, toIndex: index }));
      }
    }
    dragRef.current = null;
    setDragOver(null);
  };

  const endDrag = () => { dragRef.current = null; setDragOver(null); };

  // ── 렌더 ───────────────────────────────────────────────────────
  const renderSession = (session: Session, indexInProject: number) => {
    const isActive = session.id === activeId;
    const isDragOver = dragOver?.kind === 'session'
      && dragOver.projectId === session.projectId
      && dragOver.index === indexInProject;

    return (
      <li
        key={session.id}
        className={[
          'session-row',
          isActive ? 'active' : '',
          session.ephemeral ? 'ephemeral' : '',
          isDragOver ? 'drag-over' : '',
        ].filter(Boolean).join(' ')}
        onClick={() => handleSwitch(session.id)}
        draggable
        onDragStart={(e) => startDrag({ kind: 'session', index: indexInProject, projectId: session.projectId }, e)}
        onDragOver={(e) => overTarget('session', indexInProject, session.projectId, e)}
        onDrop={(e) => dropTarget('session', indexInProject, session.projectId, e)}
        onDragEnd={endDrag}
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
        </div>
        {session.waitingForInput && !isActive && (
          <div className="session-attention-badge" title="Waiting for input">
            <div className="pulse-dot"></div>
          </div>
        )}
        <button
          className="session-delete"
          onClick={(e) => handleDeleteSession(session.id, e)}
          title="Delete session"
        >
          {'×'}
        </button>
      </li>
    );
  };

  return (
    <div id="panel-sessions">
      <div className="panel-header">
        <span className="panel-label">Projects</span>
        <button
          className="panel-action"
          onClick={handleNewProject}
          title="현재 파일 탐색기 폴더로 새 프로젝트/세션 생성"
        >
          + 새 프로젝트
        </button>
      </div>

      <ul id="project-list">
        {projects.map((project, projectIndex) => {
          const projectSessions = sessionsByProject(project.id);
          const hasActiveSession = !!activeSession && activeSession.projectId === project.id;
          // 활성 세션의 프로젝트는 collapsed=true여도 강제 펼침
          const expanded = !project.collapsed || hasActiveSession;
          const hasWaiting = projectSessions.some((s) => s.waitingForInput && s.id !== activeId);
          const isProjectDragOver = dragOver?.kind === 'project' && dragOver.index === projectIndex;

          return (
            <li
              key={project.id}
              className={['project-block', isProjectDragOver ? 'drag-over' : ''].filter(Boolean).join(' ')}
            >
              <div
                className={['project-header', hasActiveSession ? 'has-active' : ''].filter(Boolean).join(' ')}
                onClick={(e) => handleToggleCollapse(project.id, e)}
                draggable
                onDragStart={(e) => startDrag({ kind: 'project', index: projectIndex }, e)}
                onDragOver={(e) => overTarget('project', projectIndex, undefined, e)}
                onDrop={(e) => dropTarget('project', projectIndex, undefined, e)}
                onDragEnd={endDrag}
                title={project.path}
              >
                <span className="project-caret">{expanded ? '▾' : '▸'}</span>
                <span className="project-name">{deriveProjectName(project.path)}</span>
                {hasWaiting && !expanded && (
                  <div className="session-attention-badge" title="대기 중인 세션 있음">
                    <div className="pulse-dot"></div>
                  </div>
                )}
                <button
                  className="project-add"
                  onClick={(e) => handleAddSessionToProject(project.id, e)}
                  title="이 프로젝트에 세션 추가"
                >
                  +
                </button>
                <button
                  className="project-delete"
                  onClick={(e) => handleDeleteProject(project.id, e)}
                  title="프로젝트 삭제"
                >
                  {'×'}
                </button>
              </div>
              {expanded && (
                <ul className="session-sublist">
                  {projectSessions.map((session, i) => renderSession(session, i))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {projects.length === 0 && (
        <div id="session-empty">
          프로젝트가 없습니다.<br />
          파일 탐색기에서 작업 폴더로 이동한 뒤 “+ 새 프로젝트”를 누르세요.
        </div>
      )}
    </div>
  );
};

export default SessionPanel;
