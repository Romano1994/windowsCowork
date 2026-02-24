import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface FileEntry {
  name: string;
  isDirectory: boolean;
}

interface FileState {
  currentPath: string;
  inputPath: string;
  entries: FileEntry[];
  selectedFile: string;
  error: string;
  fileAlert: string;
}

const initialState: FileState = {
  currentPath: '',
  inputPath: '',
  entries: [],
  selectedFile: '',
  error: '',
  fileAlert: '',
};

const fileSlice = createSlice({
  name: 'file',
  initialState,
  reducers: {
    setDirectory(state, action: PayloadAction<{ path: string; entries: FileEntry[] }>) {
      state.currentPath = action.payload.path;
      state.inputPath = action.payload.path;
      state.entries = action.payload.entries;
      state.error = '';
      state.selectedFile = '';
      state.fileAlert = '';
    },
    setInputPath(state, action: PayloadAction<string>) {
      state.inputPath = action.payload;
    },
    setSelectedFile(state, action: PayloadAction<string>) {
      state.selectedFile = action.payload;
      state.fileAlert = '';
    },
    setFileAlert(state, action: PayloadAction<string>) {
      state.fileAlert = action.payload;
    },
    clearFileAlert(state) {
      state.fileAlert = '';
    },
    setError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.entries = [];
    },
    deleteSelectedFile(state) {
      state.selectedFile = '';
      state.fileAlert = '';
    },
  },
});

export const { setDirectory, setInputPath, setSelectedFile, setFileAlert, clearFileAlert, setError, deleteSelectedFile } = fileSlice.actions;

export default fileSlice.reducer;
