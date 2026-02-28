/**
 * store/fileSlice.ts - 파일 탐색기 상태 관리 Slice
 *
 * 파일 시스템 탐색과 파일 선택 기능을 관리합니다.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/**
 * FileEntry - 파일/디렉토리 항목
 *
 * 파일 탐색기에 표시되는 각 항목의 정보를 담습니다.
 */
export interface FileEntry {
  name: string;           // 파일/폴더 이름
  isDirectory: boolean;   // 디렉토리 여부 (true: 폴더, false: 파일)
}

/**
 * FileState - 파일 탐색기 상태
 */
interface FileState {
  currentPath: string;    // 현재 탐색 중인 디렉토리 경로
  inputPath: string;      // 경로 입력 필드의 텍스트 (currentPath와 다를 수 있음)
  entries: FileEntry[];   // 현재 디렉토리의 파일/폴더 목록
  selectedFile: string;   // 선택된 파일 이름 (AI에게 첨부할 파일)
  error: string;          // 에러 메시지
  fileAlert: string;      // 파일 관련 경고 메시지 (예: 지원하지 않는 형식)
}

/**
 * 초기 상태
 *
 * 빈 문자열과 빈 배열로 초기화합니다.
 */
const initialState: FileState = {
  currentPath: '',
  inputPath: '',
  entries: [],
  selectedFile: '',
  error: '',
  fileAlert: '',
};

/**
 * fileSlice 생성
 */
const fileSlice = createSlice({
  name: 'file',
  initialState,
  reducers: {
    /**
     * setDirectory - 디렉토리 변경
     *
     * @param action - path와 entries를 포함하는 객체
     *
     * 디렉토리를 이동하거나 새로 읽을 때 호출됩니다.
     * 모든 에러와 선택 상태를 초기화합니다.
     */
    setDirectory(state, action: PayloadAction<{ path: string; entries: FileEntry[] }>) {
      state.currentPath = action.payload.path;
      state.inputPath = action.payload.path;  // 입력 필드도 동기화
      state.entries = action.payload.entries;
      state.error = '';
      state.selectedFile = '';
      state.fileAlert = '';
    },

    /**
     * setInputPath - 경로 입력 필드 업데이트
     *
     * 사용자가 경로를 직접 입력할 때 사용합니다.
     * Enter를 누르기 전까지는 currentPath와 다를 수 있습니다.
     */
    setInputPath(state, action: PayloadAction<string>) {
      state.inputPath = action.payload;
    },

    /**
     * setSelectedFile - 파일 선택
     *
     * AI에게 첨부할 파일을 선택합니다.
     * 파일을 선택하면 이전 경고 메시지는 사라집니다.
     */
    setSelectedFile(state, action: PayloadAction<string>) {
      state.selectedFile = action.payload;
      state.fileAlert = '';
    },

    /**
     * setFileAlert - 파일 경고 메시지 설정
     *
     * 예: 지원하지 않는 파일 형식을 선택했을 때
     */
    setFileAlert(state, action: PayloadAction<string>) {
      state.fileAlert = action.payload;
    },

    /**
     * clearFileAlert - 경고 메시지 제거
     */
    clearFileAlert(state) {
      state.fileAlert = '';
    },

    /**
     * setError - 에러 메시지 설정
     *
     * 디렉토리 읽기 실패 등의 에러 발생 시 호출됩니다.
     * 에러가 발생하면 파일 목록을 비웁니다.
     */
    setError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.entries = [];  // 에러 시 이전 목록 제거
    },

    /**
     * deleteSelectedFile - 선택된 파일 해제
     *
     * 파일을 첨부한 후 또는 선택을 취소할 때 사용합니다.
     */
    deleteSelectedFile(state) {
      state.selectedFile = '';
      state.fileAlert = '';
    },
  },
});

/**
 * 액션 생성자 export
 *
 * 여러 액션을 한 줄에 export할 수 있습니다.
 */
export const {
  setDirectory,
  setInputPath,
  setSelectedFile,
  setFileAlert,
  clearFileAlert,
  setError,
  deleteSelectedFile
} = fileSlice.actions;

/**
 * 리듀서 export
 */
export default fileSlice.reducer;
