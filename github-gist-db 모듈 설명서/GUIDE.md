# GistDB 모듈 가이드
> GitHub Gist를 서버리스 JSON 데이터베이스로 사용하는 방법

---

## 📌 이게 뭔가요?

서버(백엔드)나 데이터베이스 서비스 없이, **GitHub Gist 1개를 DB처럼 사용**하는 방식입니다.

| 항목 | 내용 |
|------|------|
| 비용 | 무료 |
| 서버 | 불필요 |
| 데이터 형식 | JSON 파일 1개 |
| 인증 방식 | GitHub PAT (Personal Access Token) |
| 적합한 규모 | 소규모 개인 앱 (수백 KB 이하 데이터) |
| 한계 | 대용량 불가, 다수 사용자 동시 저장 시 충돌 가능 (단일 사용자 다기기 사용은 아래 패턴으로 해결) |

---

## 🛠️ 1회성 사전 설정 (처음 한 번만)

### Step 1 — Gist 생성

1. [gist.github.com](https://gist.github.com/) 접속
2. 파일명 입력 (예: `my-app-data.json`)
3. 파일 내용에 `{}` 입력
4. **Create secret gist** 클릭
5. 생성된 URL에서 Gist ID 복사

```
URL 예시: https://gist.github.com/사용자명/abc123def456abc123def456abc123de
                                          ↑ 이 부분이 Gist ID
```

### Step 2 — Personal Access Token(PAT) 발급

1. GitHub → Settings → Developer Settings
2. **Personal Access Tokens → Tokens (classic)**
3. **Generate new token (classic)** 클릭
4. Note: 앱 이름 입력 (예: `my-app-token`)
5. Expiration: 원하는 만료 기간 선택
6. Scope: **`gist`** 체크박스만 선택
7. **Generate token** → 토큰 복사 (다시 볼 수 없음!)

> ⚠️ **보안 주의**: PAT는 절대 소스코드에 하드코딩하지 마세요.  
> 이 모듈은 사용자가 직접 입력한 PAT를 브라우저 로컬스토리지에만 저장합니다.

---

## 📁 파일 구조

```
your-project/
├── index.html          ← 앱 메인 파일
└── github-gist-db.js   ← 이 모듈을 복사해서 사용
```

---

## 💻 새 프로젝트에서 사용하는 방법

### 1. 모듈 불러오기

```html
<script src="github-gist-db.js"></script>
```

### 2. 초기화

```javascript
const db = new GistDB({
  appKey:   'my_app',       // 앱 고유 식별자 (로컬스토리지 키 충돌 방지)
  filename: 'data.json',    // Gist 안에 저장될 파일명
});
```

### 3. 앱 시작 시 자동 로그인

```javascript
async function init() {
  if (db.autoResume()) {
    // 저장된 인증 정보가 있으면 바로 데이터 로드
    try {
      const data = await db.get();
      if (data) {
        appState.data = data;
      } else {
        // 첫 접속: Gist에 파일이 없음 → 기본 데이터로 초기화
        appState.data = getDefaultData();
        await db.save(appState.data);
      }
      showApp();
    } catch (err) {
      // 401/403이면 토큰 만료 → 설정 화면으로
      if (err.message.includes('401') || err.message.includes('403')) {
        db.logout();
        showSetup();
      }
    }
  } else {
    showSetup(); // 최초 접속 → 설정 화면
  }
}
```

### 4. 설정 화면 — 연결 검증 버튼

```javascript
async function onVerifyClick() {
  const pat    = document.getElementById('input-pat').value.trim();
  const gistId = document.getElementById('input-gist-id').value.trim();

  try {
    await db.verify(pat, gistId);   // 실패 시 예외 발생
    // 검증 성공
    statusEl.textContent = '✅ 연결 성공! 시작 버튼을 눌러주세요.';
    document.getElementById('btn-enter').disabled = false;
  } catch (err) {
    statusEl.textContent = `❌ ${err.message}`;
  }
}
```

### 5. 설정 화면 — 시작 버튼

```javascript
async function onEnterClick() {
  const pat    = document.getElementById('input-pat').value.trim();
  const gistId = document.getElementById('input-gist-id').value.trim();

  db.connect(pat, gistId);  // 인증 정보 저장

  const data = await db.get();
  appState.data = data ?? getDefaultData();
  if (!data) await db.save(appState.data);  // 첫 접속이면 초기 파일 생성

  showApp();
}
```

### 6. 데이터 저장 (단순 버전)

```javascript
async function saveData() {
  appState.data.lastUpdated = new Date().toISOString();
  await db.save(appState.data);
}
```

> ⚠️ PC + 폰 동시 사용 시 한쪽이 덮어써질 수 있습니다.  
> 다중 기기를 사용한다면 아래 **"다중 기기 동시 접속 처리"** 섹션을 참고하세요.

### 7. 로그아웃

```javascript
function logout() {
  db.logout();
  showSetup();
}
```

---

## 🔄 다중 기기 동시 접속 처리 (Read-before-write 패턴)

PC와 폰에서 동시에 접속하면 **"마지막 저장이 이김(Last-Write-Wins)"** 문제로 데이터가 사라질 수 있습니다.  
아래 패턴을 적용하면 **저장 전 최신 서버 데이터를 가져와 병합**하므로 데이터 손실을 방지합니다.

### 핵심 원리

```
[일반 방식 - 충돌 발생]
PC: 읽기(T1) → 수정 → 저장(T1+10s) 
폰: 읽기(T1) →     수정 → 저장(T1+12s) ← PC의 변경이 사라짐!

[Read-before-write - 충돌 방지]
PC: 읽기(T1) → 수정 → 서버읽기 → 병합 → 저장
폰: 읽기(T1) →     수정 → 서버읽기(PC저장 포함) → 병합 → 저장 ← 둘 다 보존!
```

### Step 1 — 로드 시 베이스 스냅샷 저장

데이터를 로드할 때마다 **"처음 읽었을 때의 상태"** 를 별도로 보관합니다.

```javascript
async function loadData() {
  const data = await db.get();
  if (data) {
    appState.data = data;
    appState.baseData = JSON.parse(JSON.stringify(data)); // 스냅샷 저장
  }
}
```

### Step 2 — 병합 함수

`base`(처음 로드한 상태), `local`(현재 수정 상태), `server`(방금 가져온 서버 상태)를  
비교해 올바르게 합칩니다.

```javascript
/**
 * 병합 규칙:
 *  - 로컬에서 추가한 레코드  → 보존
 *  - 로컬에서 삭제한 레코드  → 제외 (서버에 있어도)
 *  - 로컬에서 수정한 레코드  → 로컬 버전 우선
 *  - 다른 기기에서 추가한 레코드 → 보존
 */
function mergeCollection(baseArr, localArr, serverArr) {
  const baseIds  = new Set((baseArr  || []).map(r => r.id));
  const localMap = new Map((localArr || []).map(r => [r.id, r]));

  // 로컬에서 삭제된 ID (base에는 있었는데 local에는 없음)
  const deletedByLocal = new Set(
    (baseArr || []).filter(r => !localMap.has(r.id)).map(r => r.id)
  );

  // 서버 기반으로 시작 (삭제된 것 제외, 로컬 수정 반영)
  const result = (serverArr || [])
    .filter(r => !deletedByLocal.has(r.id))
    .map(r => localMap.has(r.id) ? localMap.get(r.id) : r);

  const resultIds = new Set(result.map(r => r.id));

  // 로컬에서 새로 추가한 레코드 (base에 없고 서버에도 없음)
  (localArr || []).forEach(r => {
    if (!baseIds.has(r.id) && !resultIds.has(r.id)) result.push(r);
  });

  return result;
}
```

### Step 3 — 저장 시 병합 적용

```javascript
async function saveData() {
  // 1. 서버 최신 데이터 가져오기
  const serverData = await db.get();

  // 2. 서버가 우리가 로드한 이후 변경됐다면 → 병합
  if (serverData && appState.baseData &&
      serverData.lastUpdated !== appState.baseData.lastUpdated) {

    appState.data.records = mergeCollection(
      appState.baseData.records,
      appState.data.records,
      serverData.records,
    );
    // 필요한 컬렉션마다 반복 적용

    appState.baseData = JSON.parse(JSON.stringify(appState.data));
    renderAll(); // 병합된 데이터로 화면 갱신
    showToast('다른 기기의 변경 내용과 병합되었습니다.');
  }

  // 3. 저장
  appState.data.lastUpdated = new Date().toISOString();
  await db.save(appState.data);
  appState.baseData = JSON.parse(JSON.stringify(appState.data)); // 스냅샷 갱신
}
```

### Step 4 — 탭 복귀 시 자동 새로고침 (선택)

앱을 3분 이상 방치 후 돌아오면 자동으로 최신 데이터를 로드합니다.

```javascript
(function setupVisibilityRefresh() {
  const THRESHOLD_MS = 3 * 60 * 1000; // 3분
  let hiddenAt = null;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now();
    } else {
      if (!hiddenAt || Date.now() - hiddenAt < THRESHOLD_MS) { hiddenAt = null; return; }
      hiddenAt = null;

      db.get().then(data => {
        if (!data) return;
        if (data.lastUpdated !== appState.data.lastUpdated) {
          appState.data = data;
          appState.baseData = JSON.parse(JSON.stringify(data));
          renderAll();
          showToast('최신 데이터로 자동 업데이트되었습니다.');
        }
      }).catch(() => {});
    }
  });
})();
```

> 💡 **언제 필요한가?**: PC와 폰을 번갈아 사용하는 개인 앱에 적합합니다.  
> 여러 사람이 동시에 같은 데이터를 수정하는 협업 앱에는 적합하지 않습니다.

---

## 🌏 타임존(시간대) 처리

Gist에 저장되는 `lastUpdated` 같은 타임스탬프는 **UTC ISO 문자열** (`new Date().toISOString()`)로 저장하는 것을 권장합니다.

사용자에게 **표시할 때**는 명시적으로 한국 시간(KST, UTC+9)을 지정하세요.

```javascript
// ✅ 권장: 항상 KST로 표시
function formatKST(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    timeZone: 'Asia/Seoul',
  }) + ' ' + d.toLocaleTimeString('ko-KR', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Seoul',
  });
}

// ✅ 권장: datetime-local 입력값을 KST로 해석해서 UTC로 변환
function datetimeLocalToISO(val) {
  return new Date(val + ':00+09:00').toISOString();
}

// ✅ 권장: ISO → datetime-local 표시 (KST 기준)
function toDatetimeLocalKST(isoStr) {
  const d = isoStr ? new Date(isoStr) : new Date();
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const pad = v => String(v).padStart(2, '0');
  return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth()+1)}-${pad(kst.getUTCDate())}T${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`;
}
```

> ⚠️ `timeZone` 옵션을 지정하지 않으면 기기의 시스템 타임존을 따르므로,  
> 해외 환경이나 VPN 사용 시 한국 시간과 다르게 표시될 수 있습니다.

---

## 🧱 설정 화면 HTML 템플릿

```html
<div id="setup-screen">
  <h2>앱 이름 설정</h2>
  <p>GitHub Gist를 데이터 저장소로 사용합니다.</p>

  <!-- 안내 사항 -->
  <ol>
    <li>
      <a href="https://gist.github.com/" target="_blank">gist.github.com</a>에서
      새 Gist 생성 → 파일명: <code>data.json</code>, 내용: <code>{}</code>
      → <strong>Create secret gist</strong>
    </li>
    <li>
      생성된 Gist URL에서 ID 복사
      <span>(예: gist.github.com/user/<strong>abc123...</strong>)</span>
    </li>
    <li>
      GitHub Settings → Developer Settings →
      <a href="https://github.com/settings/tokens" target="_blank">Personal Access Tokens</a>
      → <strong>gist</strong> 스코프만 체크 후 토큰 발급
    </li>
  </ol>

  <!-- 입력 폼 -->
  <label>GitHub Personal Access Token (PAT)
    <input type="password" id="input-pat" placeholder="ghp_xxxxxxxxxxxx" />
  </label>

  <label>Gist ID
    <input type="text" id="input-gist-id" placeholder="abc123def456..." />
  </label>

  <div id="setup-status"></div>

  <button id="btn-verify" onclick="onVerifyClick()">연결 확인</button>
  <button id="btn-enter"  onclick="onEnterClick()" disabled>시작하기</button>
</div>
```

---

## 🤖 AI 주문서 (새 프로젝트 시작 시 붙여넣기)

아래 텍스트를 AI에게 주면 이 모듈을 기반으로 새 앱을 만들어줍니다.

---

```
[GitHub Gist DB 모듈 사용 지시]

데이터 저장/불러오기는 반드시 첨부된 github-gist-db.js 모듈의 GistDB 클래스를 사용할 것.
별도의 백엔드 서버나 다른 스토리지 방식(Firebase, Supabase 등)은 절대 사용하지 말 것.

초기화 방법:
  const db = new GistDB({ appKey: '앱고유키', filename: '파일명.json' });

앱 시작 시:
  db.autoResume() 로 저장된 인증 정보 복원 시도
  성공 시 db.get() 으로 데이터 로드
  실패 시 설정 화면 표시
  데이터 로드 후 반드시 appState.baseData = JSON.parse(JSON.stringify(data)) 로 스냅샷 저장

설정 화면:
  db.verify(pat, gistId) 로 연결 검증 (실패 시 에러 메시지 표시)
  검증 성공 후 db.connect(pat, gistId) 로 인증 정보 저장
  db.get() 로 데이터 로드, null 이면 기본 데이터로 초기화 후 db.save() 호출
  데이터 로드 후 appState.baseData 스냅샷 저장

다중 기기 충돌 방지 (PC + 폰 동시 사용 시 필수):
  저장 전 반드시 db.get() 으로 최신 서버 데이터 확인
  서버의 lastUpdated 가 baseData.lastUpdated 와 다르면 mergeCollection() 으로 병합 후 저장
  저장 완료 후 appState.baseData 스냅샷 갱신
  visibilitychange 이벤트로 3분 이상 백그라운드 후 복귀 시 자동 새로고침 구현

타임존:
  저장 타임스탬프는 new Date().toISOString() (UTC) 사용
  화면 표시 시 toLocaleDateString/toLocaleTimeString 에 timeZone: 'Asia/Seoul' 명시
  datetime-local 입력값 변환: new Date(val + ':00+09:00').toISOString()

데이터 저장:
  db.save(데이터객체) 호출

로그아웃:
  db.logout() 호출

PAT 입력 필드는 type="password" 로 마스킹할 것.
401/403 에러 발생 시 db.logout() 후 설정 화면으로 이동할 것.
```

---

## ❓ 자주 묻는 것들

**Q. 데이터가 몇 개까지 저장 가능한가요?**  
Gist 파일 1개당 최대 10MB. 일반 앱에서는 충분합니다.

**Q. 여러 기기에서 동시에 사용하면 어떻게 되나요?**  
기본 방식은 마지막으로 저장한 데이터가 남습니다(Last-Write-Wins). PC와 폰이 동시에 저장하면 한쪽의 변경이 사라질 수 있습니다.  
이를 방지하려면 **Read-before-write 병합 패턴**을 사용하세요 (위 "다중 기기 동시 접속 처리" 섹션 참고).  
여러 명이 동시에 같은 데이터를 편집하는 협업 앱에는 이 방식이 적합하지 않습니다.

**Q. PAT가 만료되면 어떻게 되나요?**  
API 호출 시 401 오류가 발생합니다. `autoResume()` 시 오류가 나면 자동으로 설정 화면으로 이동하도록 구현되어 있습니다. 새 PAT를 발급해서 다시 입력하면 됩니다.

**Q. Secret Gist와 Public Gist 차이는?**  
Secret Gist는 URL을 아는 사람만 볼 수 있습니다(완전한 비공개는 아님). 민감한 데이터는 저장하지 마세요.

**Q. 앱마다 Gist를 새로 만들어야 하나요?**  
네, 앱마다 별도의 Gist와 별도의 `appKey`를 사용하는 것을 권장합니다.
