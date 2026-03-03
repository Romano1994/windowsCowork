# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FreiCowork is an Electron-based desktop application that integrates file exploration, AI chat (Anthropic/OpenAI/Gemini), CLI session management (Claude Code/Codex), and local task management into a unified Windows-centric development tool.

## Commands

### Development
```bash
npm start              # Run in development mode with hot reload
npm run lint           # Run ESLint
```

### Build & Package
```bash
npm run package        # Create portable version (out/windows-cowork-win32-x64/)
npm run make           # Create installer (out/make/squirrel.windows/x64/)
```

## Architecture

### Process Structure

FreiCowork follows Electron's multi-process architecture with strict security boundaries:

- **Main Process** (`src/index.ts`): Handles all OS-level operations, AI API calls, PTY management, and file system access
- **Preload Bridge** (`src/preload.ts`): Exposes safe IPC API to renderer via `contextBridge` as `window.api`
- **Renderer Process** (`src/renderer.tsx`): React UI with strict isolation (`contextIsolation: true`, `nodeIntegration: false`)

All sensitive operations (file I/O, API keys, native modules) run in main process. Renderer communicates only through the `window.api` interface defined in preload.

### State Management

Redux Toolkit manages global state with 5 slices:

- **chatSlice**: Message history, input text, streaming state, message ID sequence
- **fileSlice**: Current directory path/entries, selected files, warnings
- **taskSlice**: Todo CRUD with localStorage persistence (`cowork-tasks`, `cowork-task-counter`)
- **apiSlice**: Provider/model/API key/connection state with localStorage persistence (`cowork-api-config`)
- **sessionSlice**: Multi-session management for independent CLI environments

Each session maintains independent conversation history, terminal state, and working directory.

### IPC Communication Pattern

All main↔renderer communication flows through the preload bridge:

**Chat API** (`window.api.chat`):
- `send(message)` - Send message to AI
- `clear()` - Clear conversation
- `onStreamChunk(callback)` - Receive streaming chunks
- `onStreamEnd(callback)` - Notification when streaming completes

**Config API** (`window.api.config`):
- `set({ provider, model, apiKey })` - Set and validate API configuration
- `setModel(model)` - Change model only
- `restore(config)` - Restore saved configuration

**CLI API** (`window.api.cli`) - All methods accept sessionId for multi-PTY support:
- `connect(sessionId, provider, cwd?)` - Spawn PTY process
- `disconnect(sessionId)` - Terminate PTY
- `send(sessionId, data)` - Send input to terminal
- `resize(sessionId, cols, rows)` - Resize terminal
- `onOutput(callback)` - Receive terminal output
- `onExit(callback)` - Notification when PTY exits

**File API** (`window.api.fs`):
- `readDir(path)` - List directory contents
- `readFile(path)` - Read file as text
- `readFileForAI(path)` - Parse file for AI (handles images/PDFs/Office docs)
- `selectFolder()` - Open folder picker dialog
- `getHome()` - Get user home directory

### Component Hierarchy

```
App.tsx (Root Layout)
├── FileExplorer (left panel)
├── ChatPanel (center - switches to TerminalView in CLI mode)
└── panel-right
    ├── SessionPanel (session management)
    └── ApiPanel (API configuration)
```

### Multi-Session Architecture

Sessions enable independent working environments:
- Each session has its own conversation history and terminal state
- PTY processes are session-scoped (identified by sessionId)
- Working directory preserved per session
- Switching sessions preserves all state

### AI Provider Integration

Main process implements streaming for three providers:

**Anthropic Claude** (`streamAnthropic`):
- Supports vision models for image analysis
- Uses message array format with role/content structure
- Streams via `event: content_block_delta`

**OpenAI** (`streamOpenAI`):
- Supports GPT-4 vision for image analysis
- Uses message array with role/content structure
- Streams via `data: [DONE]` protocol

**Google Gemini** (`streamGemini`):
- Uses `generateContentStream` API
- Converts messages to Gemini format
- Streams via async iteration

All providers maintain conversation history in main process memory (`conversationHistory`).

### CLI Mode Integration

When provider is `claude-code` or `codex`:
1. ChatPanel renders TerminalView instead of message interface
2. Main process spawns PTY via node-pty
3. On Windows: Executes as `powershell.exe -Command <cli-tool>`
4. xterm.js renders terminal in renderer
5. PTY I/O events flow through IPC (`cli:output`, `cli:exit`)

### File Processing for AI

`fs:readFileForAI` handles different file types (defined in `src/constants/extensions.ts`):

**Images** (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`):
- Read as base64
- Return `{ type: 'image', source: { data: base64, media_type: mime } }`

**PDFs** (`.pdf`):
- Extract text via `pdf-parse`
- Return `{ type: 'text', text: extracted_content }`

**Office docs** (`.pptx`, `.docx`, `.xlsx`):
- Extract text via `officeparser`
- Return `{ type: 'text', text: extracted_content }`

**Text/Code** (`.txt`, `.md`, `.json`, `.ts`, etc.):
- Read as UTF-8 with 200KB size limit
- Return `{ type: 'text', text: file_content }`

## Build Configuration

### Native Module Handling

**node-pty**: Critical native dependency for terminal functionality
- Excluded from webpack via `externals` in `webpack.main.config.ts`
- Manually copied during build via `afterCopy` hook in `forge.config.ts`
- ASAR disabled (`asar: false`) to ensure node-pty loads correctly
- Uses N-API prebuilt binaries (no rebuild required)

### Security Settings

Configured in `forge.config.ts`:
- `RunAsNode`: false (prevent node execution in renderer)
- `EnableCookieEncryption`: true
- `EnableNodeOptionsEnvironmentVariable`: false
- `EnableNodeCliInspectArguments`: false

## Working with Code

### Adding New AI Providers

1. Add streaming function in `src/index.ts` (e.g., `streamNewProvider`)
2. Update `api:setConfig` IPC handler to validate new provider
3. Add provider to switch statement in `chat:send` handler
4. Update ApiPanel UI to include new provider option

### Adding File Format Support

1. Add extension to `src/constants/extensions.ts`
2. Update `fs:readFileForAI` handler in `src/index.ts` to parse new format
3. Install required parser library if needed
4. Update documentation in README.md

### Modifying Redux State

1. Edit appropriate slice in `src/store/`
2. Add action creators via `reducers` object in `createSlice`
3. Use actions in components via `useDispatch` hook
4. Select state in components via `useSelector` hook
5. For persistence, update localStorage save/load logic

### Session Management

Each session is identified by a unique sessionId (UUID). To add session-scoped features:
1. Store session data in sessionSlice with sessionId as key
2. Pass sessionId to IPC calls that need session context
3. In main process, maintain session-scoped state in Maps keyed by sessionId
4. Clean up session data on session deletion or PTY exit

## Known Issues

- Some UI text contains encoding issues (Korean characters)
- API keys stored in renderer localStorage (consider OS keychain for production)
- Extension constants duplicated between `src/constants/extensions.ts` and `FileExplorer.tsx`
- Type definitions in `types.d.ts` may not fully match runtime behavior (error field inconsistency)

## Error Logging

Application logs errors to: `%APPDATA%\windows-cowork-error.log`
- Captures uncaught exceptions and unhandled rejections
- Logs module loading failures (especially node-pty)
- Useful for debugging production builds
