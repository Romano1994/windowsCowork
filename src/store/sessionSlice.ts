/**
 * store/sessionSlice.ts - 프로젝트/세션 관리 Slice
 *
 * 프로젝트는 작업 디렉토리 단위의 그룹이고, 세션은 그 프로젝트 안의 개별 작업 컨텍스트입니다.
 * 세션은 첫 메시지가 전송되어 Claude Code의 session-id가 확보되기 전까지는 휘발성이며 저장되지 않습니다.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ChatMessage } from './chatSlice';
import type { Task } from './taskSlice';

/**
 * Project - 작업 폴더 단위
 *
 * id는 UUID이며 path는 unique key 역할을 합니다 (정규화된 키로 비교).
 * 표시명은 path의 마지막 segment로 도출하므로 별도 name 필드는 없습니다.
 */
export interface Project {
  id: string;
  path: string;
  collapsed: boolean;
  sessionCounter: number;
}

/**
 * Session - 프로젝트 내 개별 작업 세션
 *
 * provider가 'claude-code'인 세션은 첫 메시지 후 Claude Code의 session-id를 id로 사용합니다.
 * 그 전까지는 임시 id를 사용하고 ephemeral=true로 표시되어 저장에서 제외됩니다.
 */
export interface Session {
  id: string;
  projectId: string;
  name: string;
  path: string;
  provider: 'claude-code' | 'codex';
  ephemeral: boolean;
  messages: ChatMessage[];
  tasks: Task[];
  taskCounter: number;
  waitingForInput?: boolean;
  requestTerminalFocus?: boolean;
}

interface SessionState {
  projects: Project[];
  sessions: Session[];
  activeId: string | null;
}

const STORAGE_KEY = 'cowork-sessions';

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/**
 * 프로젝트 path 비교용 정규화 키.
 * Windows 환경 기준: 슬래시 방향/중복/상대경로를 정리하고 소문자화합니다.
 */
export function normalizeProjectPath(p: string): string {
  if (!p) return '';
  // 슬래시 통일 → 중복 슬래시 제거 → '.' segment 제거 → 후행 슬래시 제거 → 소문자화
  let s = p.replace(/\//g, '\\');
  s = s.replace(/\\+/g, '\\');
  s = s.split('\\').filter((seg, i) => seg !== '.' || i === 0).join('\\');
  s = s.replace(/\\+$/, '');
  return s.toLowerCase();
}

/**
 * 프로젝트 표시명 도출: path의 마지막 segment.
 */
export function deriveProjectName(p: string): string {
  if (!p) return '(no path)';
  const segments = p.replace(/[\\/]+$/, '').split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] || p;
}

function findProjectByPath(projects: Project[], rawPath: string): Project | undefined {
  const key = normalizeProjectPath(rawPath);
  return projects.find((proj) => normalizeProjectPath(proj.path) === key);
}

interface StoredState {
  projects?: Project[];
  sessions?: Session[];
  activeId?: string | null;
}

function migrateLegacy(parsed: StoredState): SessionState {
  const legacySessions = (parsed.sessions || []) as Array<Partial<Session> & { path: string; name?: string }>;
  const projects: Project[] = [];
  const sessions: Session[] = [];

  for (const s of legacySessions) {
    if (!s.path) continue;
    let project = findProjectByPath(projects, s.path);
    if (!project) {
      project = {
        id: genId(),
        path: s.path,
        collapsed: false,
        sessionCounter: 0,
      };
      projects.push(project);
    }
    project.sessionCounter += 1;
    sessions.push({
      id: s.id || genId(),
      projectId: project.id,
      name: s.name || `새 세션 ${project.sessionCounter}`,
      path: s.path,
      provider: (s as { provider?: 'claude-code' | 'codex' }).provider || 'claude-code',
      ephemeral: false,
      messages: s.messages || [],
      tasks: s.tasks || [],
      taskCounter: s.taskCounter || 0,
    });
  }

  return {
    projects,
    sessions,
    activeId: parsed.activeId ?? null,
  };
}

function loadState(): SessionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { projects: [], sessions: [], activeId: null };
    const parsed: StoredState = JSON.parse(raw);
    // 신스키마: projects 필드 존재
    if (Array.isArray(parsed.projects) && Array.isArray(parsed.sessions)) {
      return {
        projects: parsed.projects,
        sessions: parsed.sessions.filter((s) => !s.ephemeral),
        activeId: parsed.activeId ?? null,
      };
    }
    // 구스키마: sessions만 존재 → 마이그레이션
    if (Array.isArray(parsed.sessions)) {
      const migrated = migrateLegacy(parsed);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch { /* ignore */ }
      return migrated;
    }
  } catch { /* ignore */ }
  return { projects: [], sessions: [], activeId: null };
}

function saveState(state: SessionState) {
  try {
    // ephemeral 세션은 저장에서 제외
    const persisted: SessionState = {
      projects: state.projects,
      sessions: state.sessions.filter((s) => !s.ephemeral),
      activeId: state.activeId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch { /* ignore */ }
}

const initialState: SessionState = loadState();

export interface SessionSnapshot {
  messages: ChatMessage[];
  nextId: number;
  tasks: Task[];
  taskCounter: number;
  currentPath: string;
}

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    /**
     * createSession - 프로젝트 자동 생성/lookup 후 세션 추가
     * 새 세션은 ephemeral=true로 시작합니다.
     */
    createSession(
      state,
      action: PayloadAction<{ projectPath: string; sessionPath?: string; provider: 'claude-code' | 'codex' }>
    ) {
      const { projectPath, sessionPath, provider } = action.payload;
      let project = findProjectByPath(state.projects, projectPath);
      if (!project) {
        project = {
          id: genId(),
          path: projectPath,
          collapsed: false,
          sessionCounter: 0,
        };
        state.projects.push(project);
      }
      project.sessionCounter += 1;
      const session: Session = {
        id: genId(),
        projectId: project.id,
        name: `새 세션 ${project.sessionCounter}`,
        path: sessionPath || project.path,
        provider,
        ephemeral: true,
        messages: [],
        tasks: [],
        taskCounter: 0,
      };
      state.sessions.push(session);
      state.activeId = session.id;
      // ephemeral이므로 saveState는 호출하지 않음 (활성화 전환만 영속화하고 싶을 수 있으나,
      // 새 빈 세션이 휘발성이라 굳이 저장 불필요)
    },

    /**
     * createSessionInProject - 기존 프로젝트에 세션 추가
     */
    createSessionInProject(
      state,
      action: PayloadAction<{ projectId: string; provider: 'claude-code' | 'codex' }>
    ) {
      const project = state.projects.find((p) => p.id === action.payload.projectId);
      if (!project) return;
      project.sessionCounter += 1;
      const session: Session = {
        id: genId(),
        projectId: project.id,
        name: `새 세션 ${project.sessionCounter}`,
        path: project.path,
        provider: action.payload.provider,
        ephemeral: true,
        messages: [],
        tasks: [],
        taskCounter: 0,
      };
      state.sessions.push(session);
      state.activeId = session.id;
    },

    /**
     * promoteSessionId - 휘발성 세션을 Claude session-id로 승격하여 영속화
     */
    promoteSessionId(state, action: PayloadAction<{ oldId: string; newId: string }>) {
      const { oldId, newId } = action.payload;
      const session = state.sessions.find((s) => s.id === oldId);
      if (!session) return;
      session.id = newId;
      session.ephemeral = false;
      if (state.activeId === oldId) state.activeId = newId;
      saveState(state);
    },

    /**
     * deleteSession - 세션 삭제. 활성 세션 삭제 시 같은 프로젝트 내 다른 세션으로 전환.
     */
    deleteSession(state, action: PayloadAction<string>) {
      const target = state.sessions.find((s) => s.id === action.payload);
      if (!target) return;
      state.sessions = state.sessions.filter((s) => s.id !== action.payload);
      if (state.activeId === action.payload) {
        const sameProject = state.sessions.filter((s) => s.projectId === target.projectId);
        state.activeId = sameProject[0]?.id ?? state.sessions[0]?.id ?? null;
      }
      saveState(state);
    },

    /**
     * deleteProject - 프로젝트와 소속 세션 일괄 삭제
     */
    deleteProject(state, action: PayloadAction<string>) {
      const projectId = action.payload;
      const removedSessionIds = state.sessions
        .filter((s) => s.projectId === projectId)
        .map((s) => s.id);
      state.sessions = state.sessions.filter((s) => s.projectId !== projectId);
      state.projects = state.projects.filter((p) => p.id !== projectId);
      if (state.activeId && removedSessionIds.includes(state.activeId)) {
        state.activeId = state.sessions[0]?.id ?? null;
      }
      saveState(state);
    },

    /**
     * toggleProjectCollapsed - 프로젝트 펼침/접힘 토글
     */
    toggleProjectCollapsed(state, action: PayloadAction<string>) {
      const project = state.projects.find((p) => p.id === action.payload);
      if (project) {
        project.collapsed = !project.collapsed;
        saveState(state);
      }
    },

    /**
     * switchSession - 세션 전환. 이전 활성 세션이 ephemeral이면 삭제(휘발).
     */
    switchSession(state, action: PayloadAction<string>) {
      const next = state.sessions.find((s) => s.id === action.payload);
      if (!next) return;

      // 이전 활성 세션이 ephemeral이면 제거
      if (state.activeId && state.activeId !== action.payload) {
        const prev = state.sessions.find((s) => s.id === state.activeId);
        if (prev && prev.ephemeral) {
          state.sessions = state.sessions.filter((s) => s.id !== prev.id);
        }
      }

      state.activeId = action.payload;
      next.waitingForInput = false;
      saveState(state);
    },

    /**
     * renameSession - 세션 이름 변경
     */
    renameSession(state, action: PayloadAction<{ id: string; name: string }>) {
      const session = state.sessions.find((s) => s.id === action.payload.id);
      if (session) {
        session.name = action.payload.name;
        saveState(state);
      }
    },

    /**
     * saveCurrentState - 현재 채팅/작업 상태를 활성 세션에 저장
     */
    saveCurrentState(state, action: PayloadAction<SessionSnapshot>) {
      if (!state.activeId) return;
      const session = state.sessions.find((s) => s.id === state.activeId);
      if (session) {
        session.messages = action.payload.messages;
        session.tasks = action.payload.tasks;
        session.taskCounter = action.payload.taskCounter;
        // session.path는 생성 시 결정 후 불변 (FileExplorer는 첨부 전용)
      }
      saveState(state);
    },

    /**
     * setSessionWaitingForInput - 입력 대기 플래그 설정
     */
    setSessionWaitingForInput(state, action: PayloadAction<{ sessionId: string; waiting: boolean }>) {
      const session = state.sessions.find((s) => s.id === action.payload.sessionId);
      if (session) {
        session.waitingForInput = action.payload.waiting;
        saveState(state);
      }
    },

    /**
     * clearSessionWaitingForInput - 입력 대기 플래그 해제
     */
    clearSessionWaitingForInput(state, action: PayloadAction<string>) {
      const session = state.sessions.find((s) => s.id === action.payload);
      if (session) {
        session.waitingForInput = false;
        saveState(state);
      }
    },

    /**
     * requestTerminalFocus - 터미널 포커스 요청
     */
    requestTerminalFocus(state, action: PayloadAction<string>) {
      const session = state.sessions.find((s) => s.id === action.payload);
      if (session) {
        session.requestTerminalFocus = true;
      }
    },

    /**
     * clearTerminalFocusRequest - 터미널 포커스 요청 해제
     */
    clearTerminalFocusRequest(state, action: PayloadAction<string>) {
      const session = state.sessions.find((s) => s.id === action.payload);
      if (session) {
        session.requestTerminalFocus = false;
      }
    },

    /**
     * reorderProjects - 프로젝트 순서 변경
     */
    reorderProjects(state, action: PayloadAction<{ fromIndex: number; toIndex: number }>) {
      const { fromIndex, toIndex } = action.payload;
      if (fromIndex === toIndex) return;
      const [moved] = state.projects.splice(fromIndex, 1);
      state.projects.splice(toIndex, 0, moved);
      saveState(state);
    },

    /**
     * reorderSessionsInProject - 프로젝트 내 세션 순서 변경
     *
     * fromIndex/toIndex는 해당 프로젝트의 세션 배열 기준 인덱스입니다.
     */
    reorderSessionsInProject(
      state,
      action: PayloadAction<{ projectId: string; fromIndex: number; toIndex: number }>
    ) {
      const { projectId, fromIndex, toIndex } = action.payload;
      if (fromIndex === toIndex) return;
      const indices: number[] = [];
      state.sessions.forEach((s, i) => { if (s.projectId === projectId) indices.push(i); });
      if (fromIndex < 0 || fromIndex >= indices.length || toIndex < 0 || toIndex >= indices.length) return;
      const fromGlobal = indices[fromIndex];
      const toGlobal = indices[toIndex];
      const [moved] = state.sessions.splice(fromGlobal, 1);
      state.sessions.splice(toGlobal, 0, moved);
      saveState(state);
    },
  },
});

export const {
  createSession,
  createSessionInProject,
  promoteSessionId,
  deleteSession,
  deleteProject,
  toggleProjectCollapsed,
  switchSession,
  renameSession,
  saveCurrentState,
  setSessionWaitingForInput,
  clearSessionWaitingForInput,
  requestTerminalFocus,
  clearTerminalFocusRequest,
  reorderProjects,
  reorderSessionsInProject,
} = sessionSlice.actions;

export default sessionSlice.reducer;
