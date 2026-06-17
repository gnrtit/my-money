/**
 * ============================================================
 *  GistDB — GitHub Gist를 서버리스 JSON DB로 사용하는 핵심 모듈
 * ============================================================
 *
 *  [ 개요 ]
 *  - 서버/백엔드 없이 GitHub Gist 1개를 DB처럼 사용
 *  - 데이터는 Gist 안의 JSON 파일 1개로 관리
 *  - 인증은 GitHub PAT(Personal Access Token) + Gist ID 사용
 *  - 자격증명은 sessionStorage + localStorage에 자동 저장/복원
 *
 *  [ 사용법 ]
 *
 *  // 1. 초기화 (앱마다 appKey와 filename을 바꿔서 사용)
 *  const db = new GistDB({
 *    appKey:   'my_app',     // localStorage 키 충돌 방지용 접두사
 *    filename: 'data.json',  // Gist 안에 저장될 파일명
 *  });
 *
 *  // 2. 앱 시작 시 자동 재연결 시도
 *  if (db.autoResume()) {
 *    const data = await db.get();   // 데이터 불러오기
 *    // ... 앱 초기화
 *  } else {
 *    showSetupScreen();             // 최초 설정 화면 표시
 *  }
 *
 *  // 3. 최초 설정 화면에서 연결 검증 후 저장
 *  await db.verify(pat, gistId);   // 연결 검증 (실패 시 예외 발생)
 *  db.connect(pat, gistId);        // 인증 정보 저장
 *
 *  // 4. 데이터 읽기
 *  const data = await db.get();    // null 이면 파일 없음(초기화 필요)
 *
 *  // 5. 데이터 저장
 *  await db.save(data);
 *
 *  // 6. 로그아웃
 *  db.logout();
 * ============================================================
 */

class GistDB {
  // private 필드 (외부에서 직접 접근 불가)
  #pat = '';
  #gistId = '';
  #appKey;
  #filename;

  static #API_BASE    = 'https://api.github.com';
  static #API_VERSION = '2022-11-28';

  /**
   * @param {object} config
   * @param {string} config.appKey   - localStorage 키 접두사 (앱마다 고유하게 설정)
   * @param {string} config.filename - Gist 안에 저장될 JSON 파일명 (예: 'data.json')
   */
  constructor({ appKey, filename }) {
    if (!appKey)   throw new Error('GistDB: appKey가 필요합니다.');
    if (!filename) throw new Error('GistDB: filename이 필요합니다.');
    this.#appKey   = appKey;
    this.#filename = filename;
  }

  // ─── 내부 헬퍼 ───────────────────────────────────────────

  get #keyPAT()  { return `${this.#appKey}_pat`; }
  get #keyGist() { return `${this.#appKey}_gist_id`; }

  #headers(extra = {}) {
    return {
      'Authorization':      `Bearer ${this.#pat}`,
      'Accept':             'application/vnd.github+json',
      'X-GitHub-Api-Version': GistDB.#API_VERSION,
      ...extra,
    };
  }

  // ─── 공개 메서드 ─────────────────────────────────────────

  /**
   * 현재 연결 상태 (PAT + GistID 모두 있으면 true)
   * @type {boolean}
   */
  get connected() {
    return !!(this.#pat && this.#gistId);
  }

  /**
   * 앱 시작 시 localStorage / sessionStorage에서 인증 정보를 복원합니다.
   * 복원 성공 시 true, 저장된 정보 없으면 false를 반환합니다.
   * @returns {boolean}
   */
  autoResume() {
    const pat    = sessionStorage.getItem(this.#keyPAT)  || localStorage.getItem(this.#keyPAT);
    const gistId = sessionStorage.getItem(this.#keyGist) || localStorage.getItem(this.#keyGist);
    if (pat && gistId) {
      this.#pat    = pat;
      this.#gistId = gistId;
      return true;
    }
    return false;
  }

  /**
   * PAT + GistID 조합이 실제로 유효한지 GitHub API로 검증합니다.
   * 실패 시 에러를 throw 합니다.
   * @param {string} pat    - GitHub Personal Access Token
   * @param {string} gistId - GitHub Gist ID
   */
  async verify(pat, gistId) {
    if (!pat || !gistId) throw new Error('PAT와 Gist ID를 모두 입력해주세요.');
    const res = await fetch(`${GistDB.#API_BASE}/gists/${gistId}`, {
      headers: {
        'Authorization':        `Bearer ${pat}`,
        'Accept':               'application/vnd.github+json',
        'X-GitHub-Api-Version': GistDB.#API_VERSION,
      },
    });
    if (!res.ok) throw new Error(`연결 실패: 응답 코드 ${res.status} — PAT 또는 Gist ID를 확인해주세요.`);
  }

  /**
   * 인증 정보를 메모리 + sessionStorage + localStorage에 저장합니다.
   * verify() 성공 후 호출하세요.
   * @param {string} pat    - GitHub Personal Access Token
   * @param {string} gistId - GitHub Gist ID
   */
  connect(pat, gistId) {
    this.#pat    = pat;
    this.#gistId = gistId;
    sessionStorage.setItem(this.#keyPAT,  pat);
    sessionStorage.setItem(this.#keyGist, gistId);
    localStorage.setItem(this.#keyPAT,    pat);
    localStorage.setItem(this.#keyGist,   gistId);
  }

  /**
   * Gist에서 JSON 데이터를 읽어옵니다.
   * Gist 안에 filename 파일이 없으면 null을 반환합니다 (초기화 필요 상태).
   * @returns {Promise<object|null>}
   */
  async get() {
    if (!this.connected) throw new Error('연결 정보 없음. autoResume() 또는 connect()를 먼저 호출하세요.');
    const res = await fetch(`${GistDB.#API_BASE}/gists/${this.#gistId}`, {
      headers: this.#headers(),
    });
    if (!res.ok) throw new Error(`데이터 읽기 실패 (${res.status})`);
    const json = await res.json();
    const file = json.files?.[this.#filename];
    if (!file) return null;
    try   { return JSON.parse(file.content); }
    catch { return null; }
  }

  /**
   * Gist에 JSON 데이터를 저장합니다 (PATCH 방식 — 덮어쓰기).
   * @param {object} data - 저장할 데이터 객체
   * @returns {Promise<object>} - GitHub API 응답
   */
  async save(data) {
    if (!this.connected) throw new Error('연결 정보 없음. autoResume() 또는 connect()를 먼저 호출하세요.');
    const body = JSON.stringify({
      files: {
        [this.#filename]: { content: JSON.stringify(data, null, 2) },
      },
    });
    const res = await fetch(`${GistDB.#API_BASE}/gists/${this.#gistId}`, {
      method:  'PATCH',
      headers: this.#headers({ 'Content-Type': 'application/json' }),
      body,
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`데이터 저장 실패 (${res.status}): ${errText}`);
    }
    return res.json();
  }

  /**
   * 로그아웃: 메모리 + sessionStorage + localStorage에서 인증 정보를 모두 삭제합니다.
   */
  logout() {
    this.#pat    = '';
    this.#gistId = '';
    [sessionStorage, localStorage].forEach(storage => {
      storage.removeItem(this.#keyPAT);
      storage.removeItem(this.#keyGist);
    });
  }
}
