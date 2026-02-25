import { configureStore } from '@reduxjs/toolkit';
import chatReducer from './chatSlice';
import fileReducer from './fileSlice';
import taskReducer from './taskSlice';
import apiReducer from './apiSlice';
import sessionReducer from './sessionSlice';

export const store = configureStore({
  reducer: {
    chat: chatReducer,
    file: fileReducer,
    task: taskReducer,
    api: apiReducer,
    session: sessionReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
