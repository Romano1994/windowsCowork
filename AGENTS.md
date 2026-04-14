# Repository Guidelines

## Project Structure & Module Organization
This is an Electron + React + TypeScript app.
- `src/index.ts`: Electron main process (IPC, PTY, AI providers).
- `src/preload.ts`: Preload bridge for renderer ↔ main.
- `src/renderer.tsx` and `src/App.tsx`: Renderer entry and root UI.
- `src/components/`: UI components (PascalCase files like `ChatPanel.tsx`).
- `src/store/`, `src/constants/`, `src/enum/`, `src/types.d.ts`: State, constants, enums, types.
- `assets/`: App assets and icons.
- `out/` and `.webpack/`: Build artifacts (generated).

## Build, Test, and Development Commands
Run these from the repo root.
- `npm start`: Launches the app in development mode (Electron Forge).
- `npm run lint`: Runs ESLint over `.ts`/`.tsx` in the repo.
- `npm run package`: Creates a packaged app in `out/`.
- `npm run make`: Builds platform installers (see `out/make/`).
- `npm run publish`: Publishes builds (only when release-ready).

## Coding Style & Naming Conventions
- Indentation: 2 spaces in `.ts`/`.tsx` files.
- React components use PascalCase filenames (e.g., `TerminalView.tsx`).
- TypeScript settings are in `tsconfig.json`; `noImplicitAny` is enabled.
- ESLint is configured in `.eslintrc.json` with TypeScript and import rules.
- Follow existing file organization patterns in `src/` when adding new modules.

## Testing Guidelines
There is no automated test suite in this repository right now.
- Add tests only if you introduce a test framework; document new commands here.
- When changing behavior, perform a manual smoke test via `npm start`.

## Commit & Pull Request Guidelines
Git history uses Conventional Commits-style subjects.
- Format: `type(scope): summary` or `type: summary`.
- Common types include `feat`, `fix`, `docs`, `chore`, `build`, `ui`, `main`.
- 커밋 메세지는 한글로 작성합니다.
Pull requests should include:
- A concise summary of changes and affected areas.
- Any manual test steps performed (or note “not tested”).
- UI updates should include screenshots or short clips.

## Security & Configuration Tips
- API keys are configured at runtime; keep secrets out of the repo.
- Use `.env` for local-only configuration and avoid committing sensitive values.
