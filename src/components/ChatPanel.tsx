import React, { useEffect, useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setInput,
  addMessageWithId,
  updateMessageText,
  removeEmptyMessage,
  addMessage,
  setStreaming,
} from '../store/chatSlice';
import { deleteSelectedFile, clearFileAlert } from '../store/fileSlice'
import { store } from '../store';

const ChatPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const { messages, input, isStreaming } = useAppSelector((s) => s.chat);
  const selectedFile = useAppSelector((s) => s.file.selectedFile);
  const fileAlert = useAppSelector((s) => s.file.fileAlert);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamTextRef = useRef('');
  const streamMsgIdRef = useRef(-1);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Stream listeners
  useEffect(() => {
    const removeChunk = window.api.chat.onStreamChunk((chunk: string) => {
      streamTextRef.current += chunk;
      dispatch(updateMessageText({ id: streamMsgIdRef.current, text: streamTextRef.current }));
    });

    const removeEnd = window.api.chat.onStreamEnd(() => {
      // stream finished
    });

    return () => {
      removeChunk();
      removeEnd();
    };
  }, [dispatch]);

  const sendMessage = useCallback(async () => {
    let text = input.trim();
    if (!text || isStreaming) return;

    dispatch(setInput(''));
    dispatch(setStreaming(true));
    if (fileAlert) dispatch(clearFileAlert());

    try {
      // If a file is attached, read its content and append to the message
      const fileState = store.getState().file;
      let displayText = text;
      let apiMessage: string | any[] = text;

      if (fileState.selectedFile) {
        const sep = fileState.currentPath.endsWith('\\') || fileState.currentPath.endsWith('/') ? '' : '\\';
        const fullPath = fileState.currentPath + sep + fileState.selectedFile;

        let fileResult: AIFileResult;
        try {
          fileResult = await window.api.fs.readFileForAI(fullPath);
        } catch (e: any) {
          dispatch(deleteSelectedFile());
          dispatch(addMessage({ type: 'error', text: e.message || '파일을 읽을 수 없습니다.' }));
          dispatch(setStreaming(false));
          return;
        }

        displayText = `[${fileState.selectedFile}]\n${text}`;

        if (!fileResult.ok) {
          dispatch(deleteSelectedFile());
          dispatch(addMessage({ type: 'error', text: fileResult.error || '파일을 읽을 수 없습니다.' }));
          dispatch(setStreaming(false));
          return;
        }

        if (fileResult.type === 'image') {
          // Build content blocks array with image + text for Claude vision
          apiMessage = [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: fileResult.media_type,
                data: fileResult.data,
              },
            },
            {
              type: 'text',
              text: `첨부된 이미지 파일: ${fileResult.fileName}\n\n사용자 메시지: ${text}`,
            },
          ];
        } else {
          // Text-based files (PDF, PPTX, plain text)
          apiMessage = `다음은 첨부된 파일 \`${fileResult.fileName}\`의 내용입니다:\n\`\`\`\n${fileResult.content}\n\`\`\`\n\n사용자 메시지: ${text}`;
        }

        dispatch(deleteSelectedFile());
      }

      // Get next IDs from current state
      const state = store.getState().chat;
      const userId = state.nextId;
      const assistantId = state.nextId + 1;

      dispatch(addMessageWithId({ id: userId, type: 'user', text: displayText }));
      dispatch(addMessageWithId({ id: assistantId, type: 'assistant', text: '' }));

      streamTextRef.current = '';
      streamMsgIdRef.current = assistantId;

      const result = await window.api.chat.send(apiMessage);

      if (!result.ok) {
        dispatch(removeEmptyMessage(assistantId));
        dispatch(addMessage({ type: 'error', text: result.error || 'Unknown error' }));
      }
    } catch (e: any) {
      dispatch(addMessage({ type: 'error', text: e.message || '알 수 없는 오류가 발생했습니다.' }));
    } finally {
      dispatch(setStreaming(false));
    }
  }, [input, isStreaming, fileAlert, dispatch]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleXBtn = () => {
    dispatch(deleteSelectedFile());
  }

  return (
    <main id="panel-chat">
      <div id="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-msg ${msg.type}`}>
            {msg.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      {fileAlert && (
        <div id="chat-file-alert">{fileAlert}</div>
      )}
      {selectedFile && (
        <div style={{display: 'flex'}}>
          <div id="chat-selected-file">{selectedFile}</div>
          <div className="btn_x" onClick={handleXBtn}>x</div>
        </div>
      )}
      <div id="chat-input-area">
        <textarea
          id="chat-input"
          value={input}
          onChange={(e) => {
            if (fileAlert) dispatch(clearFileAlert());
            dispatch(setInput(e.target.value));
          }}
          onKeyDown={handleKeyDown}
          placeholder="Enter message..."
          rows={2}
        />
        <button id="btn-send" onClick={sendMessage} disabled={isStreaming}>
          Send
        </button>
      </div>
    </main>
  );
};

export default ChatPanel;
