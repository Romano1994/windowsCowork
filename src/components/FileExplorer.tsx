/**
 * components/FileExplorer.tsx - 파일 탐색기 컴포넌트
 *
 * 파일 시스템을 탐색하고 파일을 선택할 수 있는 패널입니다.
 * - 디렉토리 탐색
 * - 파일 선택 (AI에게 첨부)
 * - CLI 모드에서는 파일 경로를 터미널에 전송
 */

import React, { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setDirectory, setInputPath, setSelectedFile, setFileAlert, setError } from '../store/fileSlice';
import { removeWelcome } from '../store/chatSlice';
import { isCliProvider } from '../store/apiSlice';

/**
 * 지원하는 파일 확장자 정의
 *
 * const로 선언된 배열은 재할당할 수 없지만,
 * 내용은 변경할 수 있습니다. (배열 자체의 참조는 불변)
 */

// 이미지 파일 확장자
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

/**
 * 텍스트 파일 확장자
 * AI가 읽을 수 있는 다양한 텍스트 형식을 지원합니다.
 */
const TEXT_EXTENSIONS = [
  '.txt', '.md', '.csv', '.json', '.xml', '.html', '.htm', '.css',
  '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h',
  '.cs', '.rb', '.go', '.rs', '.sh', '.bat', '.ps1', '.yaml', '.yml',
  '.toml', '.ini', '.cfg', '.conf', '.log', '.sql', '.r', '.swift',
];

/**
 * 지원하는 모든 확장자
 *
 * Spread 연산자(...)로 배열을 펼쳐서 새 배열을 만듭니다.
 * [...arr1, ...arr2, ...arr3]는 모든 배열을 합칩니다.
 */
const SUPPORTED_EXTENSIONS = [...IMAGE_EXTENSIONS, '.pdf', '.pptx', '.docx', '.xlsx', ...TEXT_EXTENSIONS];

/**
 * FileExplorer 컴포넌트
 */
const FileExplorer: React.FC = () => {
  const dispatch = useAppDispatch();

  /**
   * Redux 스토어에서 필요한 상태들을 가져옵니다
   */
  const { currentPath, inputPath, entries, selectedFile, error } = useAppSelector((s) => s.file);
  const { provider, connected } = useAppSelector((s) => s.api);
  const activeSessionId = useAppSelector((s) => s.session.activeId);

  // CLI 모드 여부 확인
  const cliMode = isCliProvider(provider) && connected;

  /**
   * loadDirectory - 디렉토리 내용을 읽어 상태에 저장
   *
   * @param dirPath - 읽을 디렉토리 경로
   *
   * useCallback으로 함수를 메모이제이션합니다.
   * 이 함수는 여러 곳에서 사용되므로 재생성을 방지합니다.
   */
  const loadDirectory = useCallback(async (dirPath: string) => {
    // API 호출하여 디렉토리 읽기
    const result = await window.api.fs.readDir(dirPath);

    // 실패 시 에러 처리
    if (!result.ok) {
      dispatch(setError(result.error || 'Failed to read directory'));
      return;
    }

    /**
     * 성공 시 Redux 상태 업데이트
     *
     * !는 non-null assertion으로,
     * result.path와 result.entries가 null이 아님을 보장합니다.
     * (result.ok가 true면 이 값들이 존재함을 알고 있기 때문)
     */
    dispatch(setDirectory({ path: result.path!, entries: result.entries! }));
  }, [dispatch]);  // dispatch가 변경되면 함수 재생성

  /**
   * 컴포넌트 마운트 시 홈 디렉토리 로드
   *
   * IIFE (Immediately Invoked Function Expression) 패턴:
   * (async () => { ... })()
   *
   * useEffect는 async 함수를 직접 받을 수 없어서
   * 내부에서 async 함수를 즉시 실행합니다.
   */
  useEffect(() => {
    (async () => {
      const home = await window.api.fs.getHome();
      loadDirectory(home);
    })();
  }, [loadDirectory]);  // loadDirectory가 변경되면 다시 실행 (실제로는 거의 변경 안 됨)

  /**
   * goParent - 상위 디렉토리로 이동
   *
   * Windows와 Unix의 경로 구분자 차이를 처리해야 합니다.
   */
  const goParent = () => {
    if (!currentPath) return;  // 경로 없으면 무시

    /**
     * 경로 구분자 결정
     * /가 있으면 Unix 스타일, 아니면 Windows 스타일
     */
    const sep = currentPath.includes('/') ? '/' : '\\';

    /**
     * 경로를 부분으로 나누기
     *
     * split(sep): 구분자로 문자열을 배열로 분할
     * filter(Boolean): 빈 문자열 제거
     *
     * 예: "C:\\Users\\Name" → ["C:", "Users", "Name"]
     */
    const parts = currentPath.split(sep).filter(Boolean);

    /**
     * 루트 디렉토리 처리
     * Windows에서 드라이브 루트(C:\)는 특별 처리가 필요합니다.
     */
    if (parts.length <= 1) {
      loadDirectory(parts[0] + '\\');
      return;
    }

    /**
     * 마지막 부분 제거 (상위 디렉토리로 이동)
     *
     * pop()은 배열의 마지막 요소를 제거하고 반환합니다.
     */
    parts.pop();

    /**
     * join(sep): 배열을 문자열로 합치기
     *
     * 예: ["C:", "Users"] → "C:\\Users"
     */
    let parent = parts.join(sep);

    // Unix 경로는 /로 시작
    if (currentPath.startsWith('/')) parent = '/' + parent;
    /**
     * Windows 드라이브 루트는 \로 끝나야 함
     *
     * 정규 표현식: /^[A-Za-z]:$/
     * - ^: 문자열 시작
     * - [A-Za-z]: 알파벳 한 글자
     * - :: 콜론 문자
     * - $: 문자열 끝
     * 즉, "C:", "D:" 등의 패턴을 찾습니다.
     */
    else if (parts.length === 1 && /^[A-Za-z]:$/.test(parts[0])) parent += '\\';

    loadDirectory(parent);
  };

  /**
   * handleEntryClick - 파일/폴더 클릭 핸들러
   *
   * @param entry - 클릭된 항목
   *
   * 폴더는 열고, 파일은 선택합니다.
   */
  const handleEntryClick = (entry: { name: string; isDirectory: boolean }) => {
    // 경로 구분자 처리
    const sep = currentPath.endsWith('\\') || currentPath.endsWith('/') ? '' : '\\';
    const fullPath = currentPath + sep + entry.name;

    if (entry.isDirectory) {
      /**
       * 폴더 클릭: 해당 폴더로 이동
       */
      loadDirectory(fullPath);
    } else {
      /**
       * 파일 클릭: 파일 선택 (AI 첨부용)
       */

      /**
       * 파일 확장자 추출
       *
       * split('.'): .으로 문자열 분할
       * pop(): 마지막 요소 (확장자) 가져오기
       * toLowerCase(): 소문자로 변환
       *
       * 예: "file.txt" → ["file", "txt"] → "txt" → ".txt"
       */
      const ext = entry.name.includes('.') ? '.' + entry.name.split('.').pop()!.toLowerCase() : '';

      /**
       * 확장자 검증
       */
      if (ext && !SUPPORTED_EXTENSIONS.includes(ext)) {
        dispatch(setFileAlert(`지원하지 않는 파일 형식입니다: ${ext}\n지원: 이미지, PDF, PPTX, DOCX, XLSX, 텍스트 파일`));
        return;
      }

      // 파일 선택
      dispatch(setSelectedFile(entry.name));
      dispatch(removeWelcome());  // 환영 메시지 제거
    }
  };

  /**
   * handleEntryDoubleClick - 파일/폴더 더블클릭 핸들러
   *
   * @param entry - 더블클릭된 항목
   *
   * CLI 모드에서만 동작: 파일 경로를 터미널에 전송합니다.
   */
  const handleEntryDoubleClick = (entry: { name: string; isDirectory: boolean }) => {
    // CLI 모드가 아니거나 폴더면 무시
    if (!cliMode || entry.isDirectory) return;

    const sep = currentPath.endsWith('\\') || currentPath.endsWith('/') ? '' : '\\';
    const fullPath = currentPath + sep + entry.name;

    /**
     * 경로에 공백이 있으면 따옴표로 감싸기
     *
     * 터미널에서 공백이 있는 경로는 따옴표로 감싸야 합니다.
     * 예: "C:\Program Files\file.txt"
     */
    const pathStr = fullPath.includes(' ') ? `"${fullPath}"` : fullPath;

    // 터미널에 경로 전송
    window.api.cli.send(activeSessionId || 'default', pathStr);
  };

  /**
   * handleSelectFolder - 폴더 선택 다이얼로그 열기
   *
   * OS의 폴더 선택 다이얼로그를 엽니다.
   */
  const handleSelectFolder = async () => {
    const result = await window.api.fs.selectFolder();
    if (result.ok && result.path) {
      loadDirectory(result.path);
    }
  };

  /**
   * handlePathSubmit - 경로 입력 제출
   *
   * 사용자가 직접 입력한 경로로 이동합니다.
   */
  const handlePathSubmit = () => {
    if (inputPath.trim()) loadDirectory(inputPath.trim());
  };

  /**
   * JSX 반환 - FileExplorer UI
   *
   * aside 태그는 사이드바를 나타내는 HTML5 시맨틱 태그입니다.
   */
  return (
    <aside id="panel-files">
      {/**
       * 헤더: 제목과 폴더 선택 버튼
       */}
      <div className="panel-header">
        <span className="panel-label">File Explorer</span>

        {/**
         * 폴더 선택 버튼
         *
         * title prop은 마우스 오버 시 툴팁을 표시합니다.
         */}
        <button onClick={handleSelectFolder} title="Select folder" style={{width: '20px'}}>...</button>
      </div>

      {/**
       * 경로 입력 바
       */}
      <div id="file-path-bar">
        {/**
         * 경로 입력 필드
         *
         * onKeyDown에서 화살표 함수와 단축 평가를 사용합니다:
         * e.key === 'Enter' && handlePathSubmit()
         *
         * 이는 다음과 같습니다:
         * if (e.key === 'Enter') handlePathSubmit();
         */}
        <input
          type="text"
          id="input-path"
          value={inputPath}
          onChange={(e) => dispatch(setInputPath(e.target.value))}
          onKeyDown={(e) => e.key === 'Enter' && handlePathSubmit()}
          placeholder="Path..."
        />

        {/**
         * Go 버튼
         */}
        <button id="btn-go-path" onClick={handlePathSubmit}>Go</button>
      </div>

      {/**
       * 상위 디렉토리 이동 버튼
       */}
      <div id="btn-parent-row">
        <button id="btn-parent" onClick={goParent}>.. (Parent)</button>
      </div>

      {/**
       * 파일/폴더 목록
       *
       * ul은 unordered list (순서 없는 목록)입니다.
       */}
      <ul id="file-list">
        {/**
         * 에러 메시지 표시
         *
         * CSS 변수 사용: var(--red)
         * CSS에서 --red로 정의된 색상을 사용합니다.
         */}
        {error && <li style={{ color: 'var(--red)', padding: 10 }}>{error}</li>}

        {/**
         * 파일/폴더 항목 렌더링
         *
         * map으로 각 entry를 li 요소로 변환합니다.
         */}
        {entries.map((entry) => (
          <li
            key={entry.name}
            /**
             * 조건부 className
             *
             * 파일이고 선택되어 있으면 'active' 클래스를 추가합니다.
             * 폴더는 선택할 수 없습니다.
             */
            className={!entry.isDirectory && entry.name === selectedFile ? 'active' : ''}
            /**
             * 이벤트 핸들러
             *
             * 화살표 함수로 entry를 전달합니다.
             * onClick={() => handleEntryClick(entry)}
             * 이렇게 하지 않으면 이벤트 객체가 전달되어 버립니다.
             */
            onClick={() => handleEntryClick(entry)}
            onDoubleClick={() => handleEntryDoubleClick(entry)}
          >
            {/**
             * 파일/폴더 아이콘
             *
             * Unicode 이모지 사용:
             * - \u{1F4C1}: 📁 (폴더)
             * - \u{1F4C4}: 📄 (파일)
             */}
            <span className={`file-icon ${entry.isDirectory ? 'dir' : 'file'}`}>
              {entry.isDirectory ? '\u{1F4C1}' : '\u{1F4C4}'}
            </span>

            {/**
             * 파일/폴더 이름
             */}
            <span className="file-name">{entry.name}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
};

/**
 * default export
 */
export default FileExplorer;
