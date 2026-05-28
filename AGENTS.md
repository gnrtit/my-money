# Codex Project Notes

이 파일은 Codex가 이 프로젝트에서 작업할 때 빠르게 참고하기 위한 로컬 작업 지침이다.

## 기본 원칙

- 응답과 작업 보고는 한국어로 한다.
- 사용자는 코드 비전문가일 수 있으므로 변경 내용과 영향은 쉬운 말로 설명한다.
- 상위 시스템/개발자 지침이 이 파일이나 `.github` 지침과 충돌하면 상위 지침을 따른다.
- 코드 변경은 요청 범위에 필요한 부분만 최소로 수정한다.
- 기존 사용자 변경사항을 되돌리지 않는다.

## 참고 문서

- 앱 분석 및 구조: `TECH_SPEC.md`
- 프로젝트 지침: `.github/copilot-instructions.md`
- 중앙 지침 워크플로우: `.github/.agent/workflows/중앙지침.md`
- 스킬 모음: `.github/skills/*/SKILL.md`
- 템플릿 모음: `.github/templates/`

## 스킬 사용 방식

- 작업 주제와 맞는 스킬이 있으면 해당 `SKILL.md`를 먼저 읽고 필요한 부분만 적용한다.
- 예: UI 개선은 `frontend-design`, 테스트는 `webapp-testing`, 리뷰는 `code-review`, 단계형 개발은 `phase-*` 또는 `pdca`.
- 스킬 본문이 긴 경우 전부 무작정 읽지 말고, 현재 작업에 필요한 섹션과 참조 파일만 읽는다.

## 현재 앱 요약

- 앱은 `가계부.html` 단일 파일로 동작한다.
- 빌드 도구나 서버 없이 브라우저에서 직접 여는 구조다.
- 인증은 Firebase Auth 이메일/비밀번호 방식이다.
- 데이터는 기본적으로 Firebase Realtime Database에 저장된다.
- 저장 경로는 `users/{firebase uid}/{key}` 형식이다.
- `localStorage`는 `window.storage`가 없을 때만 사용하는 fallback이다.

## 수정 시 주의

- Firebase 초기화 스크립트와 메인 앱 스크립트의 순서를 깨지 않는다.
- `window.initApp`와 `window.storage` 인터페이스를 유지한다.
- 데이터 키는 기존 호환성을 위해 유지한다: `bf`, `bi2`, `bs`, `binst`, `btx`, `bln`, `bpb`, `bpbi`, `barch`, `bsav`, `bsavg`, `bmemo`.
- 백업/복원 기능을 수정할 때는 현재 사용 키 전체가 포함되는지 확인한다.
- 단일 HTML 파일 특성상 작은 변경도 넓게 영향을 줄 수 있으므로, 변경 전후 관련 함수 이름을 검색해 영향 범위를 확인한다.

## 검증

- 가능한 경우 브라우저에서 로그인, 저장, 새로고침, 캘린더, 백업/복원을 확인한다.
- 이 환경에 브라우저나 Node가 없으면 정적 검색 결과와 검증 한계를 사용자에게 분명히 알린다.
