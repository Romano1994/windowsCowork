# FreiCowork

> AI 기반 개발 도구 - Windows 환경 중심의 통합 코워킹 플랫폼

FreiCowork는 파일 탐색, AI 채팅, CLI 세션 관리, 할 일 관리 기능을 하나의 데스크톱 애플리케이션에 통합한 Electron 기반 개발 도구입니다.

## 주요 기능

### 🤖 다중 AI 통합
- **Anthropic Claude**: Claude 모델을 통한 고급 대화 및 코드 지원
- **OpenAI GPT**: GPT-4 등 OpenAI 모델 지원
- **Google Gemini**: Google의 최신 AI 모델 통합
- 실시간 스트리밍 응답으로 빠른 피드백

### 💬 스마트 채팅
- 멀티모달 지원: 이미지, PDF, Office 문서(pptx/docx/xlsx) 첨부 가능
- 파일 컨텍스트 기반 대화
- 대화 히스토리 관리

### 🖥️ CLI 세션 관리
- **Claude Code** 및 **Codex** CLI 통합
- 세션별 터미널 환경 관리
- xterm 기반 풀 기능 터미널 에뮬레이터
- 세션 전환 시 경로 및 상태 보존

### 📁 파일 탐색
- 통합 파일 브라우저
- 빠른 파일 선택 및 AI 첨부
- 다양한 파일 형식 지원

### ✅ 할 일 관리
- 로컬 Todo 리스트
- 완료/미완료 항목 관리
- localStorage 기반 영속화

## 기술 스택

### Core
- **Electron** 40.6.0 - 데스크톱 애플리케이션 프레임워크
- **React** 19.2.4 - UI 라이브러리
- **TypeScript** 4.5.4 - 타입 안전성
- **Redux Toolkit** - 상태 관리

### Terminal
- **node-pty** - PTY 프로세스 관리
- **@xterm/xterm** - 터미널 에뮬레이터

### AI SDK
- **@anthropic-ai/sdk** - Claude API
- **openai** - OpenAI API
- **@google/generative-ai** - Gemini API

### File Processing
- **pdf-parse** - PDF 파일 파싱
- **officeparser** - Office 문서 파싱

### Build Tools
- **Electron Forge** - 빌드 및 패키징
- **Webpack** - 번들링
- **TypeScript Loader** - TS 컴파일

## 시작하기

### 사전 요구사항
- Node.js v16 이상
- npm (Node.js와 함께 설치됨)
- Windows OS (권장)

### 설치

```bash
# 저장소 클론
git clone https://github.com/Romano1994/windowsCowork.git

# 디렉터리 이동
cd windowsCowork

# 의존성 설치
npm install
```

### 개발 모드 실행

```bash
npm start
```

애플리케이션이 hot reload 모드로 실행됩니다.

### AI API 설정

애플리케이션 실행 후 우측 하단 API Panel에서:
1. Provider 선택 (Claude, OpenAI, Gemini)
2. 모델 선택
3. API 키 입력
4. Connect 버튼 클릭

## 사용 방법

### 일반 AI 채팅
1. API Panel에서 provider/model 설정 및 연결
2. 중앙 Chat Panel에서 메시지 입력
3. 실시간 스트리밍 응답 확인

### 파일 첨부 채팅
1. 좌측 File Explorer에서 파일 선택
2. Chat Panel에서 메시지 작성 및 전송
3. AI가 파일 컨텍스트를 포함한 응답 제공

지원 파일 형식:
- 이미지: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`
- 문서: `.pdf`, `.pptx`, `.docx`, `.xlsx`
- 코드/텍스트: `.txt`, `.md`, `.json`, `.ts`, `.tsx`, `.py` 등

### CLI 모드
1. API Panel에서 provider를 `claude-code` 또는 `codex`로 선택
2. Connect 버튼 클릭
3. Chat Panel이 터미널 뷰로 전환
4. 명령어 실행 및 CLI 도구 사용

### 세션 관리
- 좌측 Session Panel에서 새 세션 생성
- 세션 간 전환으로 독립적인 작업 환경 유지
- 각 세션은 개별 대화 히스토리 및 경로 보존

## 빌드 및 배포

### 패키징 (포터블 버전)

```bash
npm run package
```

출력: `out/windows-cowork-win32-x64/`

### 설치 파일 생성

```bash
npm run make
```

출력: `out/make/squirrel.windows/x64/Windows Cowork-1.0.0 Setup.exe`

자세한 빌드 가이드는 [BUILD_GUIDE.md](./BUILD_GUIDE.md)를 참조하세요.

## 프로젝트 구조

```
windowsCowork/
├── src/
│   ├── index.ts              # Main process (IPC, AI, PTY)
│   ├── preload.ts            # Preload bridge
│   ├── renderer.tsx          # Renderer entry
│   ├── App.tsx               # Root UI component
│   ├── components/           # React components
│   │   ├── ChatPanel.tsx     # 채팅 및 터미널 UI
│   │   ├── SessionPanel.tsx  # 세션 관리 UI
│   │   ├── TerminalView.tsx  # CLI 터미널 UI
│   │   ├── ApiPanel.tsx      # API 연결 UI
│   │   ├── FileExplorer.tsx  # 파일 탐색 UI
│   │   └── TaskPanel.tsx     # Todo 관리 UI
│   ├── store/                # Redux store & slices
│   ├── constants/            # 상수 정의
│   └── types.d.ts            # TypeScript 타입 정의
├── assets/                   # 아이콘 및 리소스
├── forge.config.ts           # Electron Forge 설정
├── webpack.*.config.ts       # Webpack 설정
└── package.json              # 프로젝트 메타데이터

```

자세한 프로젝트 컨텍스트는 [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md)를 참조하세요.

## 개발 스크립트

```bash
# 개발 모드 실행
npm start

# 린트 검사
npm run lint

# 패키징
npm run package

# 배포용 빌드
npm run make

# 배포 (설정된 경우)
npm run publish
```

## 라이선스

MIT License

Copyright (c) 2024 romano1994

## 작성자

**romano1994**
- Email: fhaksh0369@gmail.com
- GitHub: [@Romano1994](https://github.com/Romano1994)

## 관련 문서

- [빌드 가이드](./BUILD_GUIDE.md) - 빌드 및 배포 상세 가이드
- [프로젝트 컨텍스트](./PROJECT_CONTEXT.md) - 프로젝트 아키텍처 및 기술 상세
- [배포 상태](./DEPLOYMENT_STATUS.md) - 현재 배포 상태

## 기여

이슈 및 풀 리퀘스트를 환영합니다!

## 문의

문제가 발생하거나 제안사항이 있으시면 [GitHub Issues](https://github.com/Romano1994/windowsCowork/issues)에 등록해 주세요.
