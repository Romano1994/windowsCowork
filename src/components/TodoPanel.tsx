/**
 * components/TodoPanel.tsx - TODO 오버레이 패널
 *
 * CLI 모드에서 터미널 패널 위에 떠있는 오버레이.
 * 활성 세션의 작업 디렉토리에 있는 TODO.md와 동기화된다.
 * 헤더 드래그로 이동, 우하단 핸들로 크기 조절 가능.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setTodoPanelOpen,
  setTodos,
  setLoading,
  setError,
  clearTodos,
  addTodo,
  updateTodo,
  deleteTodo,
  reorderTodos,
  Todo,
} from '../store/todoSlice';
import { parseTodoMd, serializeTodoMd } from '../utils/todoMarkdown';

function joinTodoPath(dir: string): string {
  if (!dir) return '';
  const trimmed = dir.replace(/[\\/]+$/, '');
  const sep = dir.includes('/') && !dir.includes('\\') ? '/' : '\\';
  return trimmed + sep + 'TODO.md';
}

interface FormState {
  title: string;
  description: string;
}

const emptyForm: FormState = { title: '', description: '' };

const DEFAULT_W = 380;
const DEFAULT_H = 480;

const TodoPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isOpen, todos, loadedPath, loading, error } = useAppSelector((s) => s.todo);
  const activeSessionId = useAppSelector((s) => s.session.activeId);
  const sessionPath = useAppSelector((s) => {
    const active = s.session.sessions.find((x) => x.id === s.session.activeId);
    return active?.path || '';
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showAddForm, setShowAddForm] = useState(false);

  // 위치·크기 상태
  const [pos, setPos] = useState({ x: 16, y: 16 });
  const [size, setSize] = useState({ w: DEFAULT_W, h: DEFAULT_H });

  // 아이템 드래그 상태
  const dragItemIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // 드래그 참조값 (re-render 없이 유지)
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const todoFilePath = sessionPath ? joinTodoPath(sessionPath) : '';
  const saveSeqRef = useRef(0);

  // 패널이 열리거나 활성 세션이 바뀌면 TODO.md를 로드
  useEffect(() => {
    if (!isOpen) return;
    if (!sessionPath) {
      dispatch(clearTodos());
      return;
    }
    const targetPath = joinTodoPath(sessionPath);
    if (loadedPath === targetPath) return;

    let cancelled = false;
    (async () => {
      dispatch(setLoading(true));
      const existsRes = await window.api.fs.exists(targetPath);
      if (cancelled) return;
      if (!existsRes.exists) {
        dispatch(setTodos({ todos: [], loadedPath: targetPath }));
        return;
      }
      const readRes = await window.api.fs.readFile(targetPath);
      if (cancelled) return;
      if (!readRes.ok) {
        dispatch(setError(readRes.error || 'TODO.md 읽기 실패'));
        return;
      }
      const parsed = parseTodoMd(readRes.content || '');
      dispatch(setTodos({ todos: parsed, loadedPath: targetPath }));
    })();

    return () => { cancelled = true; };
  }, [isOpen, sessionPath, activeSessionId, loadedPath, dispatch]);

  // 변경사항을 TODO.md에 자동 저장
  useEffect(() => {
    if (!isOpen) return;
    if (!loadedPath) return;
    if (loading) return;
    const seq = ++saveSeqRef.current;
    const content = serializeTodoMd(todos);
    (async () => {
      const res = await window.api.fs.writeFile(loadedPath, content);
      if (seq !== saveSeqRef.current) return;
      if (!res.ok) {
        dispatch(setError(res.error || 'TODO.md 저장 실패'));
      }
    })();
  }, [todos, isOpen, loadedPath, loading, dispatch]);

  // 패널이 열릴 때 화면 중앙에 초기 위치 배치
  useEffect(() => {
    if (!isOpen) return;
    setPos({
      x: Math.max(0, (window.innerWidth - DEFAULT_W) / 2),
      y: Math.max(0, (window.innerHeight - DEFAULT_H) / 2),
    });
  }, [isOpen]);

  // ── 드래그 (이동) ──────────────────────────────────────────
  const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const pw = window.innerWidth;
      const ph = window.innerHeight;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      const nx = Math.max(0, Math.min(pw - size.w, dragRef.current.origX + dx));
      const ny = Math.max(0, Math.min(ph - size.h, dragRef.current.origY + dy));
      setPos({ x: nx, y: ny });
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pos, size]);

  // ── 리사이즈 ──────────────────────────────────────────────
  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: size.w, origH: size.h };

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const pw = window.innerWidth;
      const ph = window.innerHeight;
      const dx = ev.clientX - resizeRef.current.startX;
      const dy = ev.clientY - resizeRef.current.startY;
      const nw = Math.max(260, Math.min(pw - pos.x, resizeRef.current.origW + dx));
      const nh = Math.max(200, Math.min(ph - pos.y, resizeRef.current.origH + dy));
      setSize({ w: nw, h: nh });
    };

    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [size, pos]);

  // 닫기: 작성 중인 내용이 있으면 저장 후 닫기
  const closeWithSave = useCallback(() => {
    if ((showAddForm || editingId) && form.title.trim()) {
      const title = form.title.trim();
      if (editingId) {
        dispatch(updateTodo({ id: editingId, title, description: form.description.trim() }));
      } else {
        dispatch(addTodo({ title, description: form.description.trim() }));
      }
    }
    dispatch(setTodoPanelOpen(false));
    setShowAddForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }, [dispatch, showAddForm, editingId, form]);

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeWithSave(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, closeWithSave]);

  const handleItemClick = (id: string) => {
    if (editingId) return;
    setExpandedId((cur) => (cur === id ? null : id));
  };

  const startAdd = () => {
    setEditingId(null);
    setShowAddForm(true);
    setForm(emptyForm);
  };

  const startEdit = (t: Todo, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAddForm(false);
    setEditingId(t.id);
    setForm({ title: t.title, description: t.description });
    setExpandedId(t.id);
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const submitForm = () => {
    const title = form.title.trim();
    if (!title) return;
    if (editingId) {
      dispatch(updateTodo({ id: editingId, title, description: form.description.trim() }));
    } else {
      dispatch(addTodo({ title, description: form.description.trim() }));
    }
    cancelForm();
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(deleteTodo(id));
    if (expandedId === id) setExpandedId(null);
    if (editingId === id) cancelForm();
  };

  if (!isOpen) return null;

  const canUse = !!sessionPath;

  return (
    <>
      {/* 배경 클릭 시 닫기 */}
      <div className="todo-backdrop" onClick={closeWithSave} />
    <div
      ref={panelRef}
      className="todo-panel"
      role="dialog"
      aria-label="TODO LIST"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
    >
      <div className="todo-panel-header" onMouseDown={onHeaderMouseDown}>
        <span className="panel-label">TODO LIST</span>
        <span className="todo-panel-path" title={todoFilePath}>
          {todoFilePath || '작업 디렉토리를 설정하세요'}
        </span>
        <button className="todo-panel-close" onClick={closeWithSave} title="닫기">×</button>
      </div>

      <div className="todo-panel-body">
        {!canUse && (
          <div className="todo-empty">세션의 작업 디렉토리가 설정되어 있지 않습니다.</div>
        )}

        {canUse && error && (
          <div className="todo-error">{error}</div>
        )}

        {canUse && !loading && todos.length === 0 && !showAddForm && (
          <div className="todo-empty">등록된 TODO가 없습니다. 아래 버튼으로 추가하세요.</div>
        )}

        {canUse && (
          <ul className="todo-list">
            {todos.map((t, index) => {
              const isExpanded = expandedId === t.id;
              const isEditing = editingId === t.id;
              return (
                <li
                  key={t.id}
                  className={`todo-item ${isExpanded ? 'expanded' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                  draggable={!isEditing}
                  onDragStart={() => { dragItemIndexRef.current = index; }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverIndex(index); }}
                  onDragLeave={() => setDragOverIndex(null)}
                  onDrop={() => {
                    if (dragItemIndexRef.current !== null && dragItemIndexRef.current !== index) {
                      dispatch(reorderTodos({ fromIndex: dragItemIndexRef.current, toIndex: index }));
                    }
                    dragItemIndexRef.current = null;
                    setDragOverIndex(null);
                  }}
                  onDragEnd={() => { dragItemIndexRef.current = null; setDragOverIndex(null); }}
                  onClick={() => handleItemClick(t.id)}
                >
                  {isEditing ? (
                    <TodoForm
                      form={form}
                      setForm={setForm}
                      onSubmit={submitForm}
                      onCancel={cancelForm}
                      submitLabel="저장"
                    />
                  ) : (
                    <>
                      <div className="todo-item-row">
                        <span className="todo-drag-handle" title="드래그로 순서 변경">⠿</span>
                        <div className="todo-item-main">
                          <div className="todo-item-title">{t.title || '(제목 없음)'}</div>
                        </div>
                        <div className="todo-item-actions">
                          <button
                            className="todo-icon-btn"
                            onClick={(e) => startEdit(t, e)}
                            title="수정"
                          >✎</button>
                          <button
                            className="todo-icon-btn todo-icon-btn-danger"
                            onClick={(e) => handleDelete(t.id, e)}
                            title="삭제"
                          >🗑</button>
                        </div>
                      </div>
                      {isExpanded && t.description && (
                        <div className="todo-item-description">{t.description}</div>
                      )}
                      {isExpanded && !t.description && (
                        <div className="todo-item-description todo-item-description-empty">
                          (설명 없음)
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {canUse && showAddForm && (
          <div className="todo-add-form">
            <TodoForm
              form={form}
              setForm={setForm}
              onSubmit={submitForm}
              onCancel={cancelForm}
              submitLabel="추가"
            />
          </div>
        )}
      </div>

      {canUse && !showAddForm && !editingId && (
        <div className="todo-panel-footer">
          <button className="todo-add-btn" onClick={startAdd}>+ 새 TODO 추가</button>
        </div>
      )}

      {/* 리사이즈 핸들 (우하단) */}
      <div className="todo-resize-handle" onMouseDown={onResizeMouseDown} />
    </div>
    </>
  );
};

interface TodoFormProps {
  form: FormState;
  setForm: (f: FormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
}

const TodoForm: React.FC<TodoFormProps> = ({ form, setForm, onSubmit, onCancel, submitLabel }) => {
  return (
    <div className="todo-form" onClick={(e) => e.stopPropagation()}>
      <input
        className="todo-form-input"
        type="text"
        placeholder="대주제"
        value={form.title}
        autoFocus
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />
      <textarea
        className="todo-form-textarea"
        placeholder="설명"
        value={form.description}
        rows={4}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      <div className="todo-form-actions">
        <button className="todo-form-btn" onClick={onCancel}>취소</button>
        <button className="todo-form-btn todo-form-btn-primary" onClick={onSubmit}>{submitLabel}</button>
      </div>
    </div>
  );
};

export default TodoPanel;
