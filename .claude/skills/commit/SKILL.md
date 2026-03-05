---
name: commit
description: 현재 변경사항을 분석하고 프로젝트 컨벤션에 맞춰 커밋 생성
disable-model-invocation: false
allowed-tools: Bash(git *)
model: haiku
---

# 변경사항 커밋

현재 작업 디렉토리의 변경사항을 분석하고 프로젝트의 커밋 컨벤션에 맞춰 커밋을 생성합니다.

## 사용법

```
/commit                    # 변경사항 자동 분석 후 커밋
/commit 커밋 메시지          # 직접 메시지 지정
```

## 커밋 메시지 컨벤션

**형식:** `<타입>(<스코프>): <설명>`

**타입:**
- `feat` - 새로운 기능 추가
- `fix` - 버그 수정
- `docs` - 문서 변경
- `refactor` - 코드 리팩토링
- `perf` - 성능 개선
- `test` - 테스트 추가/수정
- `chore` - 빌드 설정, 도구 변경

**스코프 (선택):**
- `ui` - UI 관련
- `api` - API 관련
- 컴포넌트명 - 특정 컴포넌트 (예: ChatPanel, TerminalView)

**예시:**
- `feat(ChatPanel): 메시지 스트리밍 기능 추가`
- `fix(ui): 터미널 스크롤 안정성 개선`
- `docs: README.md 업데이트`

## 실행 프로세스

### 인자가 제공된 경우 ($ARGUMENTS가 비어있지 않음)

1. `git status` 실행하여 변경사항 확인
2. 변경사항이 없으면 사용자에게 알림
3. 변경사항이 있으면:
   - 관련 파일들을 `git add`로 스테이징
   - 제공된 메시지로 커밋 생성 (Co-Authored-By 태그 포함)
   - `git status`로 결과 확인

### 인자가 없는 경우 (자동 분석)

1. `git status` 실행하여 변경사항 확인
2. 변경사항이 없으면 사용자에게 알림
3. 변경사항이 있으면:
   - `git diff`로 상세 변경사항 확인
   - `git log --oneline -5`로 최근 커밋 스타일 확인
   - 변경사항을 분석하여 적절한 타입, 스코프, 설명 결정
   - **즉시 커밋 생성 (확인 요청 없음)**
   - **결과만 간단히 보고**: 커밋 해시, 변경된 파일 수, 커밋 메시지만 표시

## 커밋 생성 방법

**HEREDOC을 사용하여 포맷 유지:**

```bash
git commit -m "$(cat <<'EOF'
커밋 메시지 제목

상세 설명 (필요시)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

## 결과 보고 형식

커밋 완료 후 다음 정보만 간단히 보고:

```
✓ 커밋 완료: abc1234
  - 파일 변경: 2개
  - 메시지: fix(ui): 터미널 스크롤 안정성 개선
```

**중요:** 불필요한 설명 없이 결과만 표시. git status 전체 출력은 생략.

## 주의사항

- 변경사항이 여러 개일 경우 하나의 커밋이 아닌 여러개로 나눠서 커밋
- NEVER use `--no-verify` flag (pre-commit 훅 존재 가능)
- NEVER use `git add -A` or `git add .` (의도하지 않은 파일 포함 가능)
  - 대신 변경된 파일을 개별적으로 스테이징
- NEVER commit sensitive files (.env, credentials.json 등)
- 한글/영어 혼용 가능 (프로젝트 컨벤션 따름, 되도록 커밋 메세지는 한글)
- 커밋 메시지는 간결하고 명확하게 (제목 70자 이내)