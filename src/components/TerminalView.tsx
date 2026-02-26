import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useAppSelector } from '../store/hooks';

const CATPPUCCIN_THEME = {
  background: '#1e1e2e',
  foreground: '#cdd6f4',
  cursor: '#f5e0dc',
  cursorAccent: '#1e1e2e',
  selectionBackground: '#585b70',
  selectionForeground: '#cdd6f4',
  black: '#45475a',
  red: '#f38ba8',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  blue: '#89b4fa',
  magenta: '#f5c2e7',
  cyan: '#94e2d5',
  white: '#bac2de',
  brightBlack: '#585b70',
  brightRed: '#f38ba8',
  brightGreen: '#a6e3a1',
  brightYellow: '#f9e2af',
  brightBlue: '#89b4fa',
  brightMagenta: '#f5c2e7',
  brightCyan: '#94e2d5',
  brightWhite: '#a6adc8',
};

interface TerminalViewProps {
  provider: string;
  sessionId: string;
}

const TerminalView: React.FC<TerminalViewProps> = ({ provider, sessionId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const currentPath = useAppSelector((s) => s.file.currentPath);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let cancelled = false;

    const term = new Terminal({
      theme: CATPPUCCIN_THEME,
      fontFamily: "'Cascadia Code', 'Consolas', 'Courier New', monospace",
      fontSize: 14,
      cursorBlink: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(container);
    fitAddon.fit();
    term.focus();

    termRef.current = term;

    // Ctrl+C: copy selection (if any), otherwise pass through as SIGINT
    // Ctrl+V: paste from clipboard into PTY
    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true;

      if (event.ctrlKey && event.key === 'c') {
        const sel = term.getSelection();
        if (sel) {
          navigator.clipboard.writeText(sel);
          term.clearSelection();
          return false;
        }
        return true;
      }

      if (event.ctrlKey && event.key === 'v') {
        navigator.clipboard.readText().then((text) => {
          if (text) window.api.cli.send(sessionId, text);
        });
        return false;
      }

      return true;
    });

    // PTY handles input echo and line editing — send keystrokes directly
    term.onData((data: string) => {
      window.api.cli.send(sessionId, data);
    });

    // Sync terminal size → PTY
    term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
      window.api.cli.resize(sessionId, cols, rows);
    });

    // Receive output from CLI process (filter by sessionId)
    const removeOutput = window.api.cli.onOutput((sid: string, data: string) => {
      if (sid === sessionId) {
        term.write(data);
      }
    });

    const removeExit = window.api.cli.onExit((sid: string, code: number | null) => {
      if (sid === sessionId) {
        term.write(`\r\n\x1b[33m--- Process exited (code: ${code ?? 'unknown'}) ---\x1b[0m\r\n`);
        // Don't auto-disconnect — let the user read the message and manually disconnect
      }
    });

    // Mount: check if PTY already exists (reattach) or spawn new
    (async () => {
      const { exists } = await window.api.cli.exists(sessionId);
      if (cancelled) return;

      if (exists) {
        // Reattach: write scrollback buffer and sync size
        const sb = await window.api.cli.getScrollback(sessionId);
        if (cancelled) return;
        if (sb.ok && sb.data) {
          term.write(sb.data);
        }
        window.api.cli.resize(sessionId, term.cols, term.rows);
      } else {
        // New process
        const result = await window.api.cli.connect(sessionId, provider, currentPath || undefined);
        if (cancelled) return;
        if (!result.ok) {
          term.write(`\x1b[31mError: ${result.error || 'Failed to start CLI process'}\x1b[0m\r\n`);
          // Don't auto-disconnect — let the user read the error and manually disconnect
        } else {
          window.api.cli.resize(sessionId, term.cols, term.rows);
        }
      }
    })();

    // Click to re-focus terminal
    const handleClick = () => term.focus();
    container.addEventListener('click', handleClick);

    const observer = new ResizeObserver(() => {
      fitAddon.fit();
    });
    observer.observe(container);

    return () => {
      cancelled = true;
      observer.disconnect();
      container.removeEventListener('click', handleClick);
      removeOutput();
      removeExit();
      // Do NOT kill the PTY — just detach listeners and dispose xterm
      term.dispose();
      termRef.current = null;
    };
  }, [sessionId, provider]);

  return <div id="terminal-container" ref={containerRef} />;
};

export default TerminalView;
