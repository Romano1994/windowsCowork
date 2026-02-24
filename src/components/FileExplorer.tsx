import React, { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setDirectory, setInputPath, setSelectedFile, setFileAlert, setError } from '../store/fileSlice';
import { removeWelcome } from '../store/chatSlice';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const TEXT_EXTENSIONS = [
  '.txt', '.md', '.csv', '.json', '.xml', '.html', '.htm', '.css',
  '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h',
  '.cs', '.rb', '.go', '.rs', '.sh', '.bat', '.ps1', '.yaml', '.yml',
  '.toml', '.ini', '.cfg', '.conf', '.log', '.sql', '.r', '.swift',
];
const SUPPORTED_EXTENSIONS = [...IMAGE_EXTENSIONS, '.pdf', '.pptx', '.docx', '.xlsx', ...TEXT_EXTENSIONS];

const FileExplorer: React.FC = () => {
  const dispatch = useAppDispatch();
  const { currentPath, inputPath, entries, selectedFile, error } = useAppSelector((s) => s.file);

  const loadDirectory = useCallback(async (dirPath: string) => {
    const result = await window.api.fs.readDir(dirPath);
    if (!result.ok) {
      dispatch(setError(result.error || 'Failed to read directory'));
      return;
    }
    dispatch(setDirectory({ path: result.path!, entries: result.entries! }));
  }, [dispatch]);

  useEffect(() => {
    (async () => {
      const home = await window.api.fs.getHome();
      loadDirectory(home);
    })();
  }, [loadDirectory]);

  const goParent = () => {
    if (!currentPath) return;
    const sep = currentPath.includes('/') ? '/' : '\\';
    const parts = currentPath.split(sep).filter(Boolean);
    if (parts.length <= 1) {
      loadDirectory(parts[0] + '\\');
      return;
    }
    parts.pop();
    let parent = parts.join(sep);
    if (currentPath.startsWith('/')) parent = '/' + parent;
    else if (parts.length === 1 && /^[A-Za-z]:$/.test(parts[0])) parent += '\\';
    loadDirectory(parent);
  };

  const handleEntryClick = (entry: { name: string; isDirectory: boolean }) => {
    const sep = currentPath.endsWith('\\') || currentPath.endsWith('/') ? '' : '\\';
    const fullPath = currentPath + sep + entry.name;
    if (entry.isDirectory) {
      loadDirectory(fullPath);
    } else {
      const ext = entry.name.includes('.') ? '.' + entry.name.split('.').pop()!.toLowerCase() : '';
      if (ext && !SUPPORTED_EXTENSIONS.includes(ext)) {
        dispatch(setFileAlert(`지원하지 않는 파일 형식입니다: ${ext}\n지원: 이미지, PDF, PPTX, DOCX, XLSX, 텍스트 파일`));
        return;
      }
      dispatch(setSelectedFile(entry.name));
      dispatch(removeWelcome());
    }
  };

  const handleSelectFolder = async () => {
    const result = await window.api.fs.selectFolder();
    if (result.ok && result.path) {
      loadDirectory(result.path);
    }
  };

  const handlePathSubmit = () => {
    if (inputPath.trim()) loadDirectory(inputPath.trim());
  };

  return (
    <aside id="panel-files">
      <div className="panel-header">
        <span className="panel-label">File Explorer</span>
        <button onClick={handleSelectFolder} title="Select folder">...</button>
      </div>
      <div id="file-path-bar">
        <input
          type="text"
          id="input-path"
          value={inputPath}
          onChange={(e) => dispatch(setInputPath(e.target.value))}
          onKeyDown={(e) => e.key === 'Enter' && handlePathSubmit()}
          placeholder="Path..."
        />
        <button id="btn-go-path" onClick={handlePathSubmit}>Go</button>
      </div>
      <div id="btn-parent-row">
        <button id="btn-parent" onClick={goParent}>.. (Parent)</button>
      </div>
      <ul id="file-list">
        {error && <li style={{ color: 'var(--red)', padding: 10 }}>{error}</li>}
        {entries.map((entry) => (
          <li key={entry.name} className={!entry.isDirectory && entry.name === selectedFile ? 'active' : ''} onClick={() => handleEntryClick(entry)}>
            <span className={`file-icon ${entry.isDirectory ? 'dir' : 'file'}`}>
              {entry.isDirectory ? '\u{1F4C1}' : '\u{1F4C4}'}
            </span>
            <span className="file-name">{entry.name}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default FileExplorer;
