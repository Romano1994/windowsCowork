/**
 * components/ApiPanel.tsx - API 설정 패널
 *
 * AI 제공자와 모델을 선택하고 연결하는 컴포넌트입니다.
 *
 * 주요 기능:
 * - AI 제공자 선택 (Anthropic, OpenAI, Gemini, CLI 도구)
 * - 모델 선택
 * - API 키 입력 및 연결
 * - 연결 상태 표시
 */

import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setProvider, setModel, setApiKey, setConnected, disconnect,
  MODELS, Provider, isCliProvider,
} from '../store/apiSlice';

/**
 * PROVIDER_LABELS - 제공자별 표시 이름
 *
 * Record<Provider, string>는 모든 Provider에 대한 라벨을 정의합니다.
 */
const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Gemini',
  'claude-code': 'Claude Code',
  'codex': 'Codex',
};

const ApiPanel: React.FC = () => {
  const dispatch = useAppDispatch();

  // Redux 상태
  const { provider, model, apiKeys, connected } = useAppSelector((s) => s.api);
  const activeSessionId = useAppSelector((s) => s.session.activeId);

  /**
   * 로컬 상태 (useState)
   * - keyInput: API 키 입력 필드
   * - loading: 연결 시도 중 여부
   * - error: 에러 메시지
   */
  const [keyInput, setKeyInput] = useState(apiKeys[provider]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // CLI 제공자 여부
  const isCli = isCliProvider(provider);

  /**
   * 시작 시 저장된 설정을 main 프로세스에 복원
   *
   * 빈 의존성 배열([])은 컴포넌트 마운트 시 한 번만 실행됩니다.
   */
  useEffect(() => {
    if (connected && !isCliProvider(provider) && apiKeys[provider]) {
      window.api.config.restore({ provider, model, apiKey: apiKeys[provider] });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * handleProviderChange - AI 제공자 변경 핸들러
   *
   * @param e - select 요소의 변경 이벤트
   *
   * React.ChangeEvent<HTMLSelectElement>는
   * select 요소에서 발생하는 변경 이벤트 타입입니다.
   */
  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const p = e.target.value as Provider;  // 타입 단언
    dispatch(setProvider(p));
    setKeyInput(apiKeys[p] || '');  // 해당 제공자의 저장된 키 불러오기
    setError('');
  };

  /**
   * handleSubmit - API 연결 시도
   *
   * async/await를 사용한 비동기 처리:
   * 1. 로딩 상태 활성화
   * 2. API 키 저장
   * 3. main 프로세스에 연결 요청
   * 4. 결과에 따라 연결 상태 업데이트
   */
  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    dispatch(setApiKey({ provider, key: keyInput }));

    const result = await window.api.config.set({ provider, model, apiKey: keyInput });

    setLoading(false);
    if (result.ok) {
      dispatch(setConnected(true));
    } else {
      setError(result.error || 'Connection failed');
    }
  };

  const handleCliConnect = () => {
    // Just set connected=true to mount TerminalView.
    // TerminalView will call cli.connect() after its listeners are ready.
    dispatch(setConnected(true));
  };

  const handleCliDisconnect = async () => {
    await window.api.cli.disconnect(activeSessionId || 'default');
    dispatch(disconnect());
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(setModel(e.target.value));
    window.api.config.setModel(e.target.value);
  };

  const handleSwitch = async () => {
    if (isCli) {
      await window.api.cli.disconnect(activeSessionId || 'default');
    }
    dispatch(disconnect());
    setKeyInput('');
    setError('');
  };

  // ── Connected mode ──
  if (connected) {
    return (
      <div id="panel-api">
        <div className="panel-header">
          <span className="panel-label">API</span>
          <span className="api-provider-badge">{PROVIDER_LABELS[provider]}</span>
        </div>
        <div className="api-fields">
          {isCli ? (
            <div className="cli-status">CLI process running</div>
          ) : (
            <label>
              <span>Model</span>
              <select value={model} onChange={handleModelChange}>
                {MODELS[provider].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
          )}
          <button className="api-switch-btn" onClick={handleSwitch}>
            {isCli ? 'Disconnect' : 'Switch AI'}
          </button>
        </div>
      </div>
    );
  }

  // ── Login mode ──
  return (
    <div id="panel-api">
      <div className="panel-header">
        <span className="panel-label">API</span>
      </div>
      <div className="api-fields">
        <label>
          <span>Provider</span>
          <select value={provider} onChange={handleProviderChange}>
            {(Object.keys(PROVIDER_LABELS) as Provider[]).map((p) => (
              <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
            ))}
          </select>
        </label>
        {!isCli && (
          <>
            <label>
              <span>Model</span>
              <select value={model} onChange={(e) => dispatch(setModel(e.target.value))}>
                {MODELS[provider].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <label>
              <span>API Key</span>
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Enter API key..."
              />
            </label>
          </>
        )}
        {error && <div className="api-error">{error}</div>}
        {isCli ? (
          <button className="api-save-btn" onClick={handleCliConnect}>
            Connect
          </button>
        ) : (
          <button className="api-save-btn" onClick={handleSubmit} disabled={loading || !keyInput}>
            {loading ? 'Connecting...' : 'Submit'}
          </button>
        )}
      </div>
    </div>
  );
};

export default ApiPanel;
