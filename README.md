# 내 가계부

Firebase 기반 단일 HTML 파일 개인 가계부 앱.

## 특징

- 빌드 도구나 서버 없이 브라우저에서 `가계부.html`을 직접 열어 사용
- Firebase Auth 이메일/비밀번호 로그인
- Firebase Realtime Database 클라우드 저장 — 다기기 동기화 지원
- 수입/지출 관리, 캘린더 뷰, 차트(Chart.js), 백업/복원 기능 포함
- CSS 변수 기반 다크 테마

## 사용 방법

1. `가계부.html`을 크롬 브라우저로 열기
2. 이메일/비밀번호로 로그인 또는 회원가입
3. 데이터는 Firebase Realtime Database에 자동 저장

> Google Drive / OneDrive에 HTML 파일을 올려두고 여러 PC에서 열면 동일한 DB를 공유합니다.

## 기술 스택

| 항목 | 내용 |
|---|---|
| UI | HTML + CSS (인라인, 다크 테마) |
| 로직 | Vanilla JavaScript (ES2017) |
| 차트 | Chart.js 4.4.1 (CDN) |
| 인증 | Firebase Auth v10.12.0 |
| DB | Firebase Realtime Database v10.12.0 |

## 파일 구조

```
가계부.html   # 앱 전체 (단일 파일)
TECH_SPEC.md  # 기술 명세
AGENTS.md     # AI 에이전트 작업 지침
.github/      # Copilot 지침 및 워크플로우
```
