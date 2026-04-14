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
- `setApiKey(provider, apiKey)` - Store encrypted API key for provider
- `getApiKey(provider)` - Retrieve decrypted API key for provider
- `deleteApiKey(provider)` - Remove stored API key
- `getAllApiKeys()` - List all stored provider keys
- `migrateFromLocalStorage()` - Migrate legacy localStorage keys to encrypted storage

**Clipboard API** (`window.api.clipboard`):
- `readText()` - Read text from system clipboard
- `writeText(text)` - Write text to system clipboard

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

**Session State Flags**:
- `waitingForInput`: Indicates terminal is waiting for user input
- `requestTerminalFocus`: Auto-focus terminal on file double-click in CLI mode

**Session Snapshot**:
Each session preserves:
- Conversation messages and message ID sequence
- Task list and task counter
- Current working directory path
- Terminal state (when in CLI mode)

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

**System Prompt** (all providers):
```
당신은 Windows 데스크톱 자동화를 도와주는 유능한 AI 어시스턴트입니다. 한국어로 답변합니다.
```

**Image Handling**:
- Anthropic: Uses `source: { type: 'base64', media_type, data }` format
- OpenAI: Uses `image_url: { url: data:image/...;base64,... }` format
- Gemini: Uses `inlineData: { mimeType, data }` format

Each provider automatically converts file attachments from unified format to provider-specific format.

### CLI Mode Integration

When provider is `claude-code` or `codex`:
1. ChatPanel renders TerminalView instead of message interface
2. Main process spawns PTY via node-pty
3. On Windows: Executes as `powershell.exe -Command <cli-tool>`
4. xterm.js renders terminal in renderer
5. PTY I/O events flow through IPC (`cli:output`, `cli:exit`)

**Command Mapping**:
- `claude-code` → `cmd.exe /C claude`
- `codex` → `cmd.exe /C codex`

**PTY Configuration**:
- Default size: 80 columns × 24 rows
- Scrollback buffer: 100,000 characters
- Theme: Catppuccin (customizable via xterm.js)
- Each session maintains independent PTY process identified by sessionId

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

### Electron Fuses

Security hardening via `@electron/fuses`:
- `RunAsNode`: false - Prevent Node.js execution in renderer process
- `EnableEmbeddedAsarIntegrityValidation`: false - ASAR disabled for node-pty
- `OnlyLoadAppFromAsar`: false - Load resources from unpacked directory
- `EnableCookieEncryption`: true - Encrypt cookies
- `EnableNodeOptionsEnvironmentVariable`: false - Block NODE_OPTIONS injection
- `EnableNodeCliInspectArguments`: false - Disable inspect arguments

### Native Module Configuration

- `rebuildConfig.onlyModules = []` - Skip native module rebuild (uses prebuilt binaries)
- Squirrel events handled for Windows installer (startup, install, update, uninstall)

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

### API Key Storage

API keys are securely stored using Electron's `safeStorage` API:
- **Storage location**: `{userData}/api-keys.json` (encrypted)
- **Encryption**: OS-level encryption (Windows Data Protection API, macOS Keychain, Linux Secret Service)
- **Migration**: `api:migrateFromLocalStorage` automatically migrates old localStorage keys to encrypted storage
- **IPC handlers**: `config:setApiKey`, `config:getApiKey`, `config:deleteApiKey`, `config:getAllApiKeys`

The application no longer stores API keys in localStorage - this was migrated to secure storage.

## Key Dependencies

### Core Framework
- **Electron** 40.6.0 - Desktop application framework
- **React** 19.2.4 - UI library
- **Redux Toolkit** 2.11.2 - State management

### Terminal Emulation
- **node-pty** 1.1.0 - PTY process management (native module)
- **@xterm/xterm** 6.0.0 - Terminal emulator
- **@xterm/addon-fit** 0.11.0 - Terminal auto-sizing

### AI SDKs
- **@anthropic-ai/sdk** 0.78.0 - Claude API client
- **openai** 6.23.0 - OpenAI API client
- **@google/generative-ai** 0.24.1 - Gemini API client

### File Processing
- **pdf-parse** 2.4.5 - PDF text extraction
- **officeparser** 6.0.4 - Office document parsing (.pptx, .docx, .xlsx)

## Known Issues

- Some UI text contains encoding issues (Korean characters)
- Extension constants duplicated between `src/constants/extensions.ts` and `FileExplorer.tsx`
- Type definitions in `types.d.ts` may not fully match runtime behavior (error field inconsistency)

## Error Logging

Application logs errors to: `%APPDATA%\windows-cowork-error.log`
- Captures uncaught exceptions and unhandled rejections
- Logs module loading failures (especially node-pty)
- Useful for debugging production builds
