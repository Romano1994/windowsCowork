# Repository Guidelines (KOR)

## 프로젝트 구조 및 모듈 구성
이 프로젝트는 Electron + React + TypeScript 앱입니다.
- `src/index.ts`: Electron 메인 프로세스 (IPC, PTY, AI 제공자).
- `src/preload.ts`: 렌더러 ↔ 메인 브리지.
- `src/renderer.tsx`, `src/App.tsx`: 렌더러 엔트리 및 루트 UI.
- `src/components/`: UI 컴포넌트 (PascalCase 파일명, 예: `ChatPanel.tsx`).
- `src/store/`, `src/constants/`, `src/enum/`, `src/types.d.ts`: 상태, 상수, enum, 타입 정의.
- `assets/`: 앱 자산 및 아이콘.
- `out/`, `.webpack/`: 빌드 산출물 (생성됨).

## 빌드, 테스트, 개발 명령어
리포지토리 루트에서 실행합니다.
- `npm start`: 개발 모드로 앱 실행 (Electron Forge).
- `npm run lint`: 리포지토리의 `.ts`/`.tsx`에 대해 ESLint 실행.
- `npm run package`: `out/`에 패키징된 앱 생성.
- `npm run make`: 플랫폼 설치 파일 생성 (`out/make/`).
- `npm run publish`: 빌드 배포 (릴리스 준비 시에만).

## 코딩 스타일 및 네이밍 규칙
- 들여쓰기: `.ts`/`.tsx`에서 2칸.
- React 컴포넌트는 PascalCase 파일명 사용 (예: `TerminalView.tsx`).
- TypeScript 설정은 `tsconfig.json`; `noImplicitAny` 활성화.
- ESLint 설정은 `.eslintrc.json`에 있으며 TypeScript/import 규칙 사용.
- 새 모듈 추가 시 `src/` 내 기존 구조를 따릅니다.

## 테스트 가이드
현재 이 리포지토리에는 자동화된 테스트가 없습니다.
- 테스트 프레임워크를 도입하면 이 문서에 명령어를 추가하세요.
- 동작 변경 시 `npm start`로 수동 스모크 테스트를 수행합니다.

## 커밋 및 PR 가이드
Git 히스토리는 Conventional Commits 스타일의 제목을 사용합니다.
- 형식: `type(scope): summary` 또는 `type: summary`.
- 커밋 메세지는 한글로 작성합니다.
- 주요 타입: `feat`, `fix`, `docs`, `chore`, `build`, `ui`, `main`.
PR에는 다음을 포함하세요.
- 변경 내용과 영향 범위의 요약.
- 수행한 수동 테스트 단계 (또는 “not tested”).
- UI 변경 시 스크린샷 또는 짧은 클립.

## 보안 및 설정 팁
- API 키는 실행 시 설정하며, 저장소에 비밀을 커밋하지 마세요.
- 로컬 전용 설정은 `.env`에 두고 민감한 값은 커밋하지 않습니다.
