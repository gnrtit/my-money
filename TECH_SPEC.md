# 가계부 앱 테크스펙

> 최종 업데이트: 2026-04-29 (드롭다운 피커, 앱 60% 레이아웃, 캘린더 탭 순서 변경, 캘린더 월 네비게이션 추가)  
> 파일: `가계부.html` (단일 HTML 파일 앱)

---

## 1. 앱 개요

- **형태**: 단일 HTML 파일 (`가계부.html`) — 서버 불필요
- **실행 방법**: 크롬에서 파일 직접 열기 (`file://` 프로토콜)
- **인증**: Firebase 이메일/비밀번호 로그인
- **데이터 저장**: Firebase Realtime Database (클라우드)
- **다기기 동기화**: HTML 파일을 Google Drive / OneDrive에 올려두고 각 PC에서 열면 동일한 Firebase DB 사용

---

## 2. 기술 스택

| 항목 | 내용 |
|---|---|
| UI | HTML + CSS (인라인, CSS 변수 기반 다크 테마) |
| 로직 | Vanilla JavaScript (ES2017 async/await) |
| 차트 | Chart.js 4.4.1 (CDN) |
| 인증 | Firebase Auth v10.12.0 (compat) — 이메일/비밀번호 |
| DB | Firebase Realtime Database v10.12.0 (compat) |
| 외부 의존성 | CDN 3개 (Chart.js, Firebase app/auth/database) |

---

## 3. 파일 구조 (단일 HTML 내부)

```
가계부.html
├── <head>
│   ├── Chart.js CDN
│   ├── Firebase SDK 3개 CDN (app-compat, auth-compat, database-compat)
│   └── <style> — CSS 변수 기반 다크 테마 (인라인)
│
├── <body>
│   ├── #login-overlay — 로그인 전 전체화면 오버레이
│   ├── .hdr — 헤더 (제목, 시계, 동기화 상태, 사용자명/로그아웃)
│   ├── .tabs — 탭 네비게이션
│   ├── .content — 탭별 콘텐츠 섹션들
│   │
│   ├── <script> ① — Firebase 초기화 + 인증 로직
│   └── <script> ② — 메인 앱 로직 (window.initApp)
```

---

## 4. Firebase 초기화 스크립트 (script ①)

### 위치
`</style></head><body>` 직후, 메인 스크립트 이전

### 역할
1. `firebaseConfig` 로 Firebase 앱 초기화
2. `window.storage` 인터페이스 구현 (get/set)
3. 이메일 로그인/회원가입/로그아웃 함수 정의
4. `_auth.onAuthStateChanged` → 로그인 시 `window.initApp()` 호출

### 핵심 코드 패턴

```javascript
// Firebase 초기화
firebase.initializeApp(firebaseConfig);
var _auth = firebase.auth();
var _db   = firebase.database();

// window.storage 인터페이스
window.storage = {
  get: async (key) => {
    var snap = await _db.ref('users/' + uid + '/' + key).get();
    return snap.exists() ? { value: snap.val() } : null;
  },
  set: async (key, val) => {
    await _db.ref('users/' + uid + '/' + key).set(val);
  }
};

// 인증 상태 감지 → 앱 초기화
_auth.onAuthStateChanged(async (user) => {
  if (user && !window._appStarted) {
    window._appStarted = true;
    await window.initApp();
  }
});
```

### 로그인 함수
- `emailSignIn()` — 이메일/비밀번호로 로그인
- `emailSignUp()` — 신규 계정 생성
- `firebaseSignOut()` — 로그아웃
- `showLoginErr(msg)` — 로그인 오류 메시지 표시

---

## 5. 데이터 저장 구조

### Firebase Realtime Database 경로
```
users/
  {uid}/
    bf    → 고정지출 배열
    bi2   → 보험 배열
    bs    → 구독 배열
    binst → 할부 배열
    btx   → 거래 내역 배열
    bln   → 대출 객체
    bpb   → 페이백 배열 (레거시)
    bpbi  → 페이백 항목 배열 (현재 사용)
    barch → 아카이브 객체 (월별)
    bsav  → 저축 내역 배열
    bsavg → 저축 목표 배열
    bmemo → 메모 배열
```

### 보안 규칙
```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

### 저장/불러오기 함수 (메인 스크립트 내)
```javascript
// DB가 비어있으면 DF(기본값) 사용
const useCloud = typeof window.storage !== 'undefined';

async function getData(key, def) { ... }  // Firebase 또는 localStorage
async function setData(key, val) { ... }  // Firebase 또는 localStorage
async function cloudGet(key, def) { ... } // Firebase read + JSON.parse
async function cloudSet(key, val) { ... } // Firebase write + JSON.stringify
```

---

## 6. 기본값 (DF 객체)

Firebase에 데이터가 없을 때 사용하는 하드코딩 초기값.  
**삭제하면 안 됨** — 첫 로그인 시 화면을 채우는 역할.

```javascript
const DF = {
  fixed:   [...],  // 고정지출 기본 항목 8개
  ins2:    [...],  // 보험 기본 항목 6개
  sub:     [...],  // 구독 기본 항목 10개
  inst:    [...],  // 할부 기본 항목 21개
  loan:    {...},  // 학자금 대출 초기값
  payback: [...],  // 페이백 초기값
  savings: [],
  savGoals:[]
};
```

---

## 7. 메인 앱 구조 (script ②)

### 초기화 순서
```
window.initApp = async () => {
  1. loadAll()         — Firebase에서 전체 데이터 불러오기
  2. initClock()       — 시계 시작
  3. renderDash()      — 대시보드 렌더링
  4. renderMemos()     — 메모 렌더링
  5. renderPaybackMgmt()    — 페이백 관리 렌더링
  6. renderUncollectedCard() — 미수금 현황 렌더링
}
```

### 전역 상태 변수
```javascript
let fixedItems    = [];  // 고정지출
let ins2Items     = [];  // 보험
let subItems      = [];  // 구독
let installItems  = [];  // 할부
let transactions  = [];  // 거래 내역
let loanData      = {};  // 대출
let paybackData   = [];  // 페이백 (레거시)
let paybackItems  = [];  // 페이백 항목 (현재)
let archives      = {};  // 월별 아카이브
let savings       = [];  // 저축 내역
let savGoals      = [];  // 저축 목표

let txFilter = 'all';   // 내역 탭 필터 ('all'/'expense'/'income')
let donutCh  = null;    // Chart.js 인스턴스
```

### 탭 목록
| 탭 ID | 탭명 | 주요 내용 |
|---|---|---|
| `dash` | 대시보드 | 요약 카드, 차트, 현금흐름, 미수금 |
| `tx` | 내역 | 거래 추가/검색/목록, 메모 |
| `cal` | 캘린더 | 월별 달력, 날짜별 수입/지출, 검색 |
| `sav` | 저축 | 저축 목표, 입출금 내역, 이월금 |
| `fixed` | 고정지출 | 월정액 지출 항목 관리 |
| `sub` | 구독 | 구독 서비스 목록 |
| `inst` | 할부 | 카드사별 할부 현황 |
| `loan` | 대출 | 학자금 대출 잔액/상환 내역 |
| `arch` | 아카이브 | 월별 마감, 백업/복원 |

---

## 7-1. 캘린더 탭 상세

### 구성 요소

**월 네비게이션 바 (Month Navigation Bar)**
- `#cal-nav-title` — `"{calYear}년 <span style='color:var(--gold)'>{calPickerMonth}월</span>"` 형식으로 크게 표시
- `‹` / `›` 화살표 버튼으로 이전달 / 다음달 이동
- 1월 → 이전 시 12월(전년), 12월 → 다음 시 1월(다음년) 자동 연간 전환
- `calPrevMonth()` / `calNextMonth()` 함수, `renderCal()` 재호출
- 드롭다운 피커 아래에 위치, 서로 독립적으로 동작 (양쪽 모두 사용 가능)

**드롭다운 피커 (Dropdown Picker)**
- `#sel-year` / `#sel-month` — `<select>` 엔리먼트 기반 연/월 선택
- 연도: 현재 년 기준 ±4년 범위로 JS로 생성 (`renderCal()`)
- 월: HTML에 1월~12월 고정
- 변경 시 `calYear` / `calPickerMonth` 업데이트 후 `renderCalGrid()` 호출

**월 요약 바 (`#cal-msum`)**
- 해당 월 전체 수입 합계 / 지출 합계 / 차액 표시

**캘린더 그리드 (`#cal-grid-body`)**
- 일~토 7열 격자
- 각 날짜 칸에 수입(초록) · 지출(빨강) 금액 축약 표시 (`fmtS()` — 만 단위 약식)
- 오늘 날짜: 금색 ● 마크 + `.cal-today` 테두리
- 검색 히트 날짜: 파란 테두리 `.cal-hit`
- 선택된 날짜: `.cal-sel` 강조

**날짜 상세 (`#cal-day-detail`)**
- 날짜 클릭 시 해당 날의 거래 목록 시간순 표시
- 재클릭 시 닫힘

**검색 (`#cal-srch` → `#cal-srch-results`)**
- 내역명 실시간 검색 (해당 월 내)
- 히트 날짜 파란 테두리 하이라이트 + 하단 결과 목록

### 캘린더 관련 전역 변수
```javascript
let calYear         = new Date().getFullYear(); // 피커 선택 연도
let calPickerMonth  = new Date().getMonth() + 1;// 피커 선택 월 (1~12)
let calSearch       = '';                       // 검색 키워드
let calSelDay       = null;                     // 선택된 날짜 (1~31)
```

### 캘린더 관련 함수
| 함수 | 역할 |
|---|---|
| `calPrevMonth()` | 이전 달로 이동 (1월에서 호출 시 전년 12월로 전환) |
| `calNextMonth()` | 다음 달로 이동 (12월에서 호출 시 다음년 1월로 전환) |
| `renderCal()` | 탭 진입 시 호출. 연도 select 옵션 생성(최초 1회) + 월 select 동기화 후 `renderCalGrid()` 호출 |
| `renderCalGrid()` | 달력 그리드 + 월요약 + 검색결과 전체 재렌더 |
| `calClickDay(d)` | 날짜 클릭 토글 (같은 날 재클릭 시 선택 해제) |
| `renderCalDayDetail(d)` | 선택 날짜의 거래 목록 렌더링 |
| `renderCalSrchResults()` | 검색 키워드 기반 결과 목록 렌더링 |
| `fmtS(n)` | 숫자 축약 표시 (10000→1만, 5000→5천) |

---

## 7-2. 레이아웃 구조

### 앱 래퍼 너비

```html
<!-- body 전체 영역은 다크 배경으로 채우고, 콘텐츠는 중앙 60%에 묶음 -->
<body>                                   ← background: var(--bg), 전체
  <div id="login-overlay">...</div>      ← position:fixed, 전체 커버
  <div id="app-wrap">                    ← 콘텐츠 래퍼 (60% 너비)
    .hdr
    .tabs
    .content
  </div>
</body>
```

**`#app-wrap` CSS**
```css
#app-wrap {
  width: 60%;
  min-width: 360px;
  margin: 0 auto;
}
```
- 웹 창을 마우스로 줌히거나 늘려도 콘텐츠는 다리 기준 60% 유지
- 최소 360px 이하로 들어가지 않음
- `#login-overlay`는 `app-wrap` 바깥에 떠있음으로 영향 없음

### 반응형 미디어쿼리
| 단계 | 조건 | 변화 |
|---|---|---|
| 일반 | `max-width: 750px` | `.chart-row` 1열, `.two-col` 1열, `.ins-stats`/`.arch-summary` 2열 |
| 소형 | `max-width: 480px` | `.cards` 1열, `.ins-stats`/`.arch-summary` 1열, `.cal-picker` 줄바꽔 |

---

## 8. 거래 내역 데이터 구조

```javascript
// 지출
{
  id: 20260429001,         // YYYYMMDDxxx 형식 숫자
  type: 'expense',
  name: '스타벅스',
  amount: 6500,
  datetime: '2026-04-29T14:30',
  payMethod: 'kb',         // 결제 수단 코드
  installMonths: 0,        // 0 = 일시불, n = n개월 할부
  isLoanPayment: false,    // 학자금 대출 납입 여부
  isRefund: false          // 환급 예정 여부
}

// 수입
{
  id: 20260429002,
  type: 'income',
  name: '4월 사례금',
  amount: 2750000,
  datetime: '2026-04-29T09:00',
  incomeType: 'salary'     // 수입 유형 코드
}
```

### 결제 수단 코드 (payMethod)
`kb`, `lotte`, `shinhan`, `samsung`, `hyundai`, `hana`, `woori`, `nh`, `bc`, `citi`, `ibk`, `suhyup`, `saemaeul`, `kakao`, `toss`, `kbank`, `postbank`, `cash`, `invest`, `sav`

### 수입 유형 코드 (incomeType)
`salary`, `carryover`, `payback`, `refund`, `savwithdraw`, `invest_return`, `bonus`, `other`

---

## 9. CSS 디자인 시스템

### CSS 변수 (`:root`)
```css
--bg:      #0f0f10   /* 최하단 배경 */
--bg2:     #1a1a1d   /* 카드 배경 */
--bg3:     #222226   /* 입력칸 배경 */
--bg4:     #2c2c32   /* 깊은 배경 */
--text:    #f0ede8   /* 기본 텍스트 */
--text2:   #9b9893   /* 보조 텍스트 */
--text3:   #5c5a57   /* 비활성 텍스트 */
--gold:    #d4a847   /* 주요 강조색 */
--gold2:   #f0c860   /* 밝은 골드 */
--green:   #4caf7d   /* 수입/긍정 */
--red:     #e05c5c   /* 지출/위험 */
--blue:    #5b9cf6   /* 정보 */
--purple:  #9b7fe8   /* 장기할부 */
--orange:  #e8924a   /* 이월금 */
--r:       12px      /* 기본 border-radius */
--rs:      8px       /* 작은 border-radius */
```

---

## 10. 백업 / 복원

- **내보내기**: `exportData()` — 전체 데이터를 JSON 파일로 다운로드
- **가져오기**: `importData()` — JSON 파일 업로드 후 Firebase에 저장
- **월 마감**: `archiveMonth()` — 이달 데이터를 `barch` 키에 저장
- **초기화**: `resetToDefaults()` — `DF` 기본값으로 리셋

---

## 11. 수정 시 주의사항

1. **`DF` 객체 절대 삭제 금지** — Firebase 빈 상태에서 기본값 역할
2. **`window.initApp` 함수 유지** — Firebase 인증 콜백이 이 함수를 호출함
3. **`window._appStarted` 플래그** — 앱이 중복 초기화되지 않도록 방지
4. **`useCloud` 분기** — `window.storage`가 있으면 Firebase, 없으면 localStorage 사용
5. **script 순서** — Firebase 초기화 script ① 이 반드시 메인 script ② 보다 앞에 있어야 함
6. **`setStat(msg, cls)`** — 헤더의 동기화 상태 표시 (`sync-ok` / `sync-ing` / `sync-err`)
7. **캘린더 연도 `<select>`** — `renderCal()` 에서 주삭Index로 옵션 동적 생성. 탭 첫 진입 시 1회만 생성됨 (`options.length === 0` 체크)
8. **`#app-wrap` 유지** — `.hdr`, `.tabs`, `.content`의 부모. 이 div 제거 시 모든 콘텐츠가 100% 너비로 펜짐

---

## 12. Firebase 콘솔 설정 체크리스트

- [ ] Realtime Database 생성 (위치: us-central1)
- [ ] 보안 규칙 설정 (`$uid === auth.uid`)
- [ ] Authentication → 이메일/비밀번호 활성화
- [ ] `firebaseConfig` 7개 값을 `가계부.html`에 입력
