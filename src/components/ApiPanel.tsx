import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setProvider, setModel, setApiKey, setConnected, disconnect,
  MODELS, Provider,
} from '../store/apiSlice';

const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
};

const ApiPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const { provider, model, apiKeys, connected } = useAppSelector((s) => s.api);
  const [keyInput, setKeyInput] = useState(apiKeys[provider]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const p = e.target.value as Provider;
    dispatch(setProvider(p));
    setKeyInput(apiKeys[p]);
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

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(setModel(e.target.value));
    window.api.config.setModel(e.target.value);
  };

  const handleSwitch = () => {
    dispatch(disconnect());
    setKeyInput('');
    setError('');
  };

  // ── Connected mode: model select + switch button ──
  if (connected) {
    return (
      <div id="panel-api">
        <div className="panel-header">
          <span className="panel-label">API</span>
          <span className="api-provider-badge">{PROVIDER_LABELS[provider]}</span>
        </div>
        <div className="api-fields">
          <label>
            <span>Model</span>
            <select value={model} onChange={handleModelChange}>
              {MODELS[provider].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <button className="api-switch-btn" onClick={handleSwitch}>Switch AI</button>
        </div>
      </div>
    );
  }

  // ── Login mode: full form ──
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
        {error && <div className="api-error">{error}</div>}
        <button className="api-save-btn" onClick={handleSubmit} disabled={loading || !keyInput}>
          {loading ? 'Connecting...' : 'Submit'}
        </button>
      </div>
    </div>
  );
};

export default ApiPanel;
