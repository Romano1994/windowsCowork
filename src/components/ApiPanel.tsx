import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setProvider, setModel, setApiKey, setConnected, disconnect,
  MODELS, Provider, isCliProvider,
} from '../store/apiSlice';

const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Gemini',
  'claude-code': 'Claude Code',
  'codex': 'Codex',
};

const ApiPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const { provider, model, apiKeys, connected } = useAppSelector((s) => s.api);
  const activeSessionId = useAppSelector((s) => s.session.activeId);
  const [keyInput, setKeyInput] = useState(apiKeys[provider]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isCli = isCliProvider(provider);

  // Sync saved config to main process on startup
  useEffect(() => {
    if (connected && !isCliProvider(provider) && apiKeys[provider]) {
      window.api.config.restore({ provider, model, apiKey: apiKeys[provider] });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const p = e.target.value as Provider;
    dispatch(setProvider(p));
    setKeyInput(apiKeys[p] || '');
    setError('');
  };

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
