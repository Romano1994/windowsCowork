/**
 * todoMarkdown.ts - TODO.md 파일 파서/직렬화
 *
 * 포맷:
 * # TODO
 *
 * ## 대주제 1
 * *소주제 1*
 *
 * 설명 본문...
 *
 * ## 대주제 2
 * *소주제 2*
 *
 * 설명...
 */

export interface Todo {
  id: string;
  title: string;
  description: string;
}

const TODO_MD_HEADER = '# TODO';

function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * parseTodoMd - TODO.md 텍스트를 Todo 배열로 파싱
 *
 * `## ` 헤더 기준으로 블록 분할.
 * 블록의 첫 줄 = title
 * 이후 줄들 = description (trim)
 */
export function parseTodoMd(text: string): Todo[] {
  if (!text || typeof text !== 'string') return [];

  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const todos: Todo[] = [];
  let current: { title: string; body: string[] } | null = null;

  for (const rawLine of lines) {
    const line = rawLine;
    if (line.startsWith('## ')) {
      if (current) {
        todos.push(finalizeBlock(current));
      }
      current = { title: line.slice(3).trim(), body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) todos.push(finalizeBlock(current));

  return todos;
}

function finalizeBlock(block: { title: string; body: string[] }): Todo {
  const description = block.body.join('\n').trim();
  return {
    id: makeId(),
    title: block.title,
    description,
  };
}

/**
 * serializeTodoMd - Todo 배열을 TODO.md 문자열로 직렬화
 */
export function serializeTodoMd(todos: Todo[]): string {
  const parts: string[] = [TODO_MD_HEADER, ''];

  for (const t of todos) {
    const title = (t.title || '').trim() || '(제목 없음)';
    parts.push(`## ${title}`);
    if (t.description && t.description.trim()) {
      parts.push('');
      parts.push(t.description.trim());
    }
    parts.push('');
  }

  return parts.join('\n');
}

export function newTodoId(): string {
  return makeId();
}
