# CLAUDE_KOR.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 사용하는 가이드입니다.

## 프로젝트 개요

FreiCowork는 파일 탐색, AI 채팅(Anthropic/OpenAI/Gemini), CLI 세션 관리(Claude Code/Codex), 로컬 작업 관리 기능을 하나의 Windows 중심 개발 도구로 통합한 Electron 기반 데스크톱 애플리케이션입니다.

## 명령어

### 개발
```bash
npm start              # 핫 리로드로 개발 모드 실행
npm run lint           # ESLint 실행
```

### 빌드 & 패키징
```bash
npm run package        # 포터블 버전 생성 (out/windows-cowork-win32-x64/)
npm run make           # 설치 파일 생성 (out/make/squirrel.windows/x64/)
```

## 아키텍처

### 프로세스 구조

FreiCowork는 엄격한 보안 경계를 가진 Electron 멀티 프로세스 아키텍처를 따릅니다:

- **Main Process** (`src/index.ts`): 모든 OS 레벨 작업, AI API 호출, PTY 관리, 파일 시스템 접근 처리
- **Preload Bridge** (`src/preload.ts`): `contextBridge`를 통해 renderer에 안전한 IPC API를 `window.api`로 노출
- **Renderer Process** (`src/renderer.tsx`): 엄격한 격리를 가진 React UI (`contextIsolation: true`, `nodeIntegration: false`)

모든 민감한 작업(파일 I/O, API 키, 네이티브 모듈)은 main process에서 실행됩니다. Renderer는 preload에 정의된 `window.api` 인터페이스를 통해서만 통신합니다.

### 상태 관리

Redux Toolkit이 5개의 slice로 전역 상태를 관리합니다:

- **chatSlice**: 메시지 히스토리, 입력 텍스트, 스트리밍 상태, 메시지 ID 시퀀스
- **fileSlice**: 현재 디렉터리 경로/항목, 선택된 파일, 경고
- **taskSlice**: Todo CRUD with localStorage 영속화 (`cowork-tasks`, `cowork-task-counter`)
- **apiSlice**: Provider/모델/API 키/연결 상태 with localStorage 영속화 (`cowork-api-config`)
- **sessionSlice**: 독립적인 CLI 환경을 위한 멀티 세션 관리

각 세션은 독립적인 대화 히스토리, 터미널 상태, 작업 디렉터리를 유지합니다.

### IPC 통신 패턴

모든 main↔renderer 통신은 preload bridge를 통해 흐릅니다:

**Chat API** (`window.api.chat`):
- `send(message)` - AI에 메시지 전송
- `clear()` - 대화 초기화
- `onStreamChunk(callback)` - 스트리밍 청크 수신
- `onStreamEnd(callback)` - 스트리밍 완료 알림

**Config API** (`window.api.config`):
- `set({ provider, model, apiKey })` - API 설정 및 검증
- `setModel(model)` - 모델만 변경
- `restore(config)` - 저장된 설정 복원
- `setApiKey(provider, apiKey)` - provider의 API 키를 암호화하여 저장
- `getApiKey(provider)` - provider의 API 키를 복호화하여 가져오기
- `deleteApiKey(provider)` - 저장된 API 키 제거
- `getAllApiKeys()` - 저장된 모든 provider 키 목록
- `migrateFromLocalStorage()` - 기존 localStorage 키를 암호화 저장소로 마이그레이션

**Clipboard API** (`window.api.clipboard`):
- `readText()` - 시스템 클립보드에서 텍스트 읽기
- `writeText(text)` - 시스템 클립보드에 텍스트 쓰기

**CLI API** (`window.api.cli`) - 모든 메서드는 멀티 PTY 지원을 위해 sessionId를 받습니다:
- `connect(sessionId, provider, cwd?)` - PTY 프로세스 생성
- `disconnect(sessionId)` - PTY 종료
- `send(sessionId, data)` - 터미널에 입력 전송
- `resize(sessionId, cols, rows)` - 터미널 크기 조정
- `onOutput(callback)` - 터미널 출력 수신
- `onExit(callback)` - PTY 종료 알림

**File API** (`window.api.fs`):
- `readDir(path)` - 디렉터리 내용 목록
- `readFile(path)` - 파일을 텍스트로 읽기
- `readFileForAI(path)` - AI용 파일 파싱 (이미지/PDF/Office 문서 처리)
- `selectFolder()` - 폴더 선택 다이얼로그 열기
- `getHome()` - 사용자 홈 디렉터리 가져오기

### 컴포넌트 계층 구조

```
App.tsx (루트 레이아웃)
├── FileExplorer (좌측 패널)
├── ChatPanel (중앙 - CLI 모드에서 TerminalView로 전환)
└── panel-right
    ├── SessionPanel (세션 관리)
    └── ApiPanel (API 설정)
```

### 멀티 세션 아키텍처

세션은 독립적인 작업 환경을 제공합니다:
- 각 세션은 자체 대화 히스토리와 터미널 상태를 가짐
- PTY 프로세스는 세션 범위 (sessionId로 식별)
- 세션별로 작업 디렉터리 보존
- 세션 전환 시 모든 상태 유지

**세션 상태 플래그**:
- `waitingForInput`: 터미널이 사용자 입력을 기다리고 있음을 나타냄
- `requestTerminalFocus`: CLI 모드에서 파일 더블클릭 시 터미널 자동 포커스

**세션 스냅샷**:
각 세션은 다음을 보존합니다:
- 대화 메시지 및 메시지 ID 시퀀스
- 작업 목록 및 작업 카운터
- 현재 작업 디렉터리 경로
- 터미널 상태 (CLI 모드인 경우)

### AI Provider 통합

Main process는 세 가지 provider에 대한 스트리밍을 구현합니다:

**Anthropic Claude** (`streamAnthropic`):
- 이미지 분석을 위한 vision 모델 지원
- role/content 구조의 메시지 배열 형식 사용
- `event: content_block_delta`를 통한 스트리밍

**OpenAI** (`streamOpenAI`):
- 이미지 분석을 위한 GPT-4 vision 지원
- role/content 구조의 메시지 배열 사용
- `data: [DONE]` 프로토콜을 통한 스트리밍

**Google Gemini** (`streamGemini`):
- `generateContentStream` API 사용
- 메시지를 Gemini 형식으로 변환
- async iteration을 통한 스트리밍

모든 provider는 main process 메모리에 대화 히스토리를 유지합니다 (`conversationHistory`).

**시스템 프롬프트** (모든 provider):
```
당신은 Windows 데스크톱 자동화를 도와주는 유능한 AI 어시스턴트입니다. 한국어로 답변합니다.
```

**이미지 처리**:
- Anthropic: `source: { type: 'base64', media_type, data }` 형식 사용
- OpenAI: `image_url: { url: data:image/...;base64,... }` 형식 사용
- Gemini: `inlineData: { mimeType, data }` 형식 사용

각 provider는 파일 첨부를 통합 형식에서 provider별 형식으로 자동 변환합니다.

### CLI 모드 통합

Provider가 `claude-code` 또는 `codex`일 때:
1. ChatPanel이 메시지 인터페이스 대신 TerminalView를 렌더링
2. Main process가 node-pty를 통해 PTY 생성
3. Windows에서: `powershell.exe -Command <cli-tool>` 형태로 실행
4. xterm.js가 renderer에서 터미널 렌더링
5. PTY I/O 이벤트가 IPC를 통해 흐름 (`cli:output`, `cli:exit`)

**명령어 매핑**:
- `claude-code` → `cmd.exe /C claude`
- `codex` → `cmd.exe /C codex`

**PTY 설정**:
- 기본 크기: 80열 × 24행
- 스크롤백 버퍼: 100,000자
- 테마: Catppuccin (xterm.js를 통해 커스터마이징 가능)
- 각 세션은 sessionId로 식별되는 독립적인 PTY 프로세스 유지

### AI용 파일 처리

`fs:readFileForAI`는 다양한 파일 타입을 처리합니다 (`src/constants/extensions.ts`에 정의):

**이미지** (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`):
- base64로 읽기
- 반환: `{ type: 'image', source: { data: base64, media_type: mime } }`

**PDF** (`.pdf`):
- `pdf-parse`를 통한 텍스트 추출
- 반환: `{ type: 'text', text: extracted_content }`

**Office 문서** (`.pptx`, `.docx`, `.xlsx`):
- `officeparser`를 통한 텍스트 추출
- 반환: `{ type: 'text', text: extracted_content }`

**텍스트/코드** (`.txt`, `.md`, `.json`, `.ts` 등):
- UTF-8로 읽기 (200KB 크기 제한)
- 반환: `{ type: 'text', text: file_content }`

## 빌드 설정

### 네이티브 모듈 처리

**node-pty**: 터미널 기능을 위한 핵심 네이티브 의존성
- `webpack.main.config.ts`의 `externals`를 통해 webpack에서 제외
- `forge.config.ts`의 `afterCopy` 훅을 통해 빌드 시 수동 복사
- node-pty가 올바르게 로드되도록 ASAR 비활성화 (`asar: false`)
- N-API 사전 빌드 바이너리 사용 (rebuild 불필요)

### Electron Fuses

`@electron/fuses`를 통한 보안 강화:
- `RunAsNode`: false - Renderer 프로세스에서 Node.js 실행 방지
- `EnableEmbeddedAsarIntegrityValidation`: false - node-pty를 위해 ASAR 비활성화
- `OnlyLoadAppFromAsar`: false - 압축 해제된 디렉터리에서 리소스 로드
- `EnableCookieEncryption`: true - 쿠키 암호화
- `EnableNodeOptionsEnvironmentVariable`: false - NODE_OPTIONS 주입 차단
- `EnableNodeCliInspectArguments`: false - inspect 인자 비활성화

### 네이티브 모듈 설정

- `rebuildConfig.onlyModules = []` - 네이티브 모듈 리빌드 건너뛰기 (사전 빌드 바이너리 사용)
- Windows 설치 프로그램용 Squirrel 이벤트 처리 (startup, install, update, uninstall)

## 코드 작업 가이드

### 새로운 AI Provider 추가

1. `src/index.ts`에 스트리밍 함수 추가 (예: `streamNewProvider`)
2. `api:setConfig` IPC 핸들러를 업데이트하여 새 provider 검증
3. `chat:send` 핸들러의 switch 문에 provider 추가
4. ApiPanel UI를 업데이트하여 새 provider 옵션 포함

### 파일 형식 지원 추가

1. `src/constants/extensions.ts`에 확장자 추가
2. `src/index.ts`의 `fs:readFileForAI` 핸들러를 업데이트하여 새 형식 파싱
3. 필요한 경우 파서 라이브러리 설치
4. README.md에 문서 업데이트

### Redux 상태 수정

1. `src/store/`의 적절한 slice 편집
2. `createSlice`의 `reducers` 객체를 통해 액션 생성자 추가
3. 컴포넌트에서 `useDispatch` 훅을 통해 액션 사용
4. 컴포넌트에서 `useSelector` 훅을 통해 상태 선택
5. 영속화가 필요한 경우 localStorage 저장/로드 로직 업데이트

### 세션 관리

각 세션은 고유한 sessionId(UUID)로 식별됩니다. 세션 범위 기능을 추가하려면:
1. sessionSlice에 sessionId를 키로 사용하여 세션 데이터 저장
2. 세션 컨텍스트가 필요한 IPC 호출에 sessionId 전달
3. Main process에서 sessionId를 키로 하는 Map에 세션 범위 상태 유지
4. 세션 삭제 또는 PTY 종료 시 세션 데이터 정리

### API 키 저장

API 키는 Electron의 `safeStorage` API를 사용하여 안전하게 저장됩니다:
- **저장 위치**: `{userData}/api-keys.json` (암호화됨)
- **암호화**: OS 레벨 암호화 (Windows Data Protection API, macOS Keychain, Linux Secret Service)
- **마이그레이션**: `api:migrateFromLocalStorage`가 기존 localStorage 키를 암호화 저장소로 자동 마이그레이션
- **IPC 핸들러**: `config:setApiKey`, `config:getApiKey`, `config:deleteApiKey`, `config:getAllApiKeys`

애플리케이션은 더 이상 API 키를 localStorage에 저장하지 않습니다 - 안전한 저장소로 마이그레이션되었습니다.

## 주요 의존성

### 코어 프레임워크
- **Electron** 40.6.0 - 데스크톱 애플리케이션 프레임워크
- **React** 19.2.4 - UI 라이브러리
- **Redux Toolkit** 2.11.2 - 상태 관리

### 터미널 에뮬레이션
- **node-pty** 1.1.0 - PTY 프로세스 관리 (네이티브 모듈)
- **@xterm/xterm** 6.0.0 - 터미널 에뮬레이터
- **@xterm/addon-fit** 0.11.0 - 터미널 자동 크기 조정

### AI SDK
- **@anthropic-ai/sdk** 0.78.0 - Claude API 클라이언트
- **openai** 6.23.0 - OpenAI API 클라이언트
- **@google/generative-ai** 0.24.1 - Gemini API 클라이언트

### 파일 처리
- **pdf-parse** 2.4.5 - PDF 텍스트 추출
- **officeparser** 6.0.4 - Office 문서 파싱 (.pptx, .docx, .xlsx)

## 알려진 이슈

- 일부 UI 텍스트에 인코딩 문제 포함 (한글 문자)
- 확장자 상수가 `src/constants/extensions.ts`와 `FileExplorer.tsx`에 중복 정의
- `types.d.ts`의 타입 정의가 런타임 동작과 완전히 일치하지 않을 수 있음 (error 필드 불일치)

## 에러 로깅

애플리케이션은 에러를 다음 위치에 기록합니다: `%APPDATA%\windows-cowork-error.log`
- 잡히지 않은 예외와 처리되지 않은 rejection 캡처
- 모듈 로딩 실패 로그 (특히 node-pty)
- 프로덕션 빌드 디버깅에 유용
