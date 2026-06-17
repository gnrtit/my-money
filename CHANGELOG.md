# 변경 이력

## [2026-06-17] - Firebase → GitHub Gist DB 전환

### 변경 사항
- Firebase Auth + Realtime Database 완전 제거 (CDN 스크립트 3개 포함)
- `GistDB` 클래스 내장: GitHub Gist 1개를 서버리스 JSON DB로 사용
- 로그인 화면 → GitHub PAT + Gist ID 입력 화면으로 교체
- 인증 정보는 `sessionStorage` + `localStorage`에 자동 저장/복원 (재방문 시 자동 연결)
- 전체 데이터를 Gist 내 `kab-data.json` 단일 파일로 관리
- `window.storage` 인터페이스 유지 → 기존 앱 로직 변경 없음
- 헤더 상단 "GitHub Gist 연결됨" 표시 + 로그아웃 버튼

## [2026-05-28] - 공개용 전환: 하드코딩 개인 데이터 제거

### 변경 사항
- 고정지출·보험·구독·할부·대출 기본값 데이터 전체 삭제 (사용자가 직접 입력)
- 월 수입(`INCOME`) 상수 → Firebase 저장 변수로 전환
- 보험 납입 추적 설정(`INS_START_Y/M`, `INS_TOTAL`) → Firebase 저장 변수로 전환
- **설정 탭 신규 추가**: 월 수입, 보험 납입 시작일/총 기간 입력 UI
- 하드코딩된 현금흐름 HTML 금액 제거
- 개인 라벨 일반화: `사례금` → `월급/급여`, `교회환급` → `선지급환급`, `학자금 대출` → `대출`
- AI 구독 개인 알림 문구 제거
- 빠른입력 프리셋 개인 금액 초기화 (0원)

## [2026-05-28] - 프로젝트 초기화

### 추가
- `README.md` 생성: 앱 소개, 사용법, 기술 스택 문서화
- `.gitignore` 생성: 압축파일, OS 파일, `.claude/` 제외
- GitHub 저장소 연결 및 초기 커밋 푸시 (`gnrtit/my-money`)
