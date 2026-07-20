# 6. 공통 Framework

> 근거: [analysis/STEP5_공통Framework분석.md](../analysis/STEP5_공통Framework분석.md)

## 6-1. Frontend 공통 레지스트리 — `content-renderers/registry.js`

모든 `content-renderers/*.js`보다 먼저 로드되어야 하는 기반 파일. `window.ScreenContentRenderers`(contentId → 렌더 정의)를 소유한다.

```javascript
function registerRenderer(contentId, def) {
    if (window.ScreenContentRenderers[contentId]) throw ...   // 중복 등록 즉시 실패
    if (!def || typeof def.render !== "function") throw ...   // render 함수 없으면 즉시 실패
    // contentId 네이밍 규칙({menuKey}__{역할}_grid|form) 위반 시 콘솔 경고만(강제 아님)
    window.ScreenContentRenderers[contentId] = def;
}
```

- `renderAgGrid(el, columnDefs, rowData, extra)`: AG Grid 공통 초기화. 한국어 로케일 고정, `resizable/sortable/filter` 기본 on, `tooltipShowDelay:300`.
- `renderKeyValueForm(el, fields)`: key-value 나열형 화면용. **현재는 `input.readOnly = true` 고정** — 실 CRUD 폼이 아니라 표시 전용 더미 상태.
- `window.Formatters.currency`: 천단위 콤마 포맷.
- `registerRenderer("__default__main_grid", ...)`: `SCREEN_LAYOUTS`에 없는 화면의 전역 폴백.
- `window.ScreenReloadHandlers` + `registerReload(menuKey, fn)`: **menuKey 단위**(contentId 아님) 조회 재실행 레지스트리. `toolbar.js`의 "조회" 버튼이 활성 탭의 menuKey로 찾아 호출. 등록 안 된 menuKey는 조용히 무시(에러 없음).

## 6-2. Frontend 공통 통신 계층 — `api-fetch.js`

```javascript
async function apiFetch(url, options) {
    // GET이 아닌 메서드에서만 X-CSRFToken 자동 첨부 (meta[name=csrf-token]에서 읽음)
    // FormData면 Content-Type을 비워 브라우저가 boundary 포함해 자동 설정
    // 응답 JSON 파싱 실패를 try/catch로 방어
    // res.ok 아니면 data.error 우선, 없으면 res.statusText로 표준화된 Error throw
}
```

`admin-api.js`, `profit-analysis-api.js` 등 **모든 도메인 API 모듈은 반드시 이 함수를 거친다**(직접 `fetch()` 호출 없음, 코드 전수 확인). 신규 도메인 API를 추가할 때도 이 함수를 재사용한다.

## 6-3. 도메인별 API 모듈 패턴

```javascript
// admin-api.js
window.AdminAPI = {
    listUsers: () => apiFetch("/admin/users/list"),
    getUser: (id) => apiFetch("/admin/users/" + id),
    updateRole: (id, role) => apiFetch("/admin/users/" + id + "/role", { method: "POST", body: JSON.stringify({ role }) }),
};
```

얇은 래퍼 그 자체 — 엔드포인트 URL 조립 + `apiFetch()` 호출만. 신규 도메인 API 모듈도 이 패턴을 그대로 따른다.

## 6-4. Backend 공통 인증 — `auth.py`

```python
def verify_password(stored_hash, input_password):
    # $2y$/$2b$/$2a$ 접두사 → bcrypt(레거시), 그 외 → werkzeug(신규)

def login_required(view_func):
    # session에 user_id 없으면 로그인 페이지로 리다이렉트
```

⚠️ `role_required` 등 권한 검증 공통 데코레이터는 **존재하지 않는다**. 신규 도메인에 관리자 전용 API가 필요하다면, 이 파일에 먼저 공통 데코레이터를 추가하는 것이 바람직하다(현재는 각 라우트가 임시방편으로도 검증하지 않는 상태).

## 6-5. Backend 공통 DB 계층

```
db/settings.py   (환경변수 정리, SQL 없음)
       ↓
db/local_db.py (읽기/쓰기)   db/prod_db.py (조회 전용)
       ↓                            ↓
repository/*.py (SQL 작성, get_local_db_connection() / get_prod_db_connection()만 사용)
```

- 로컬DB: `ConnectionPool` + `dict_row` factory로 즉시 dict 반환.
- 상용DB: `ReadOnlyConnection`이 `fetch_one`/`fetch_all`만 제공(commit/execute 자체가 없어 코드로 원천 차단) + `statement_timeout` 강제 적용 + `.env` 미설정 시에도 앱이 죽지 않는 lazy pool 생성.

## 6-6. 레이어드 패턴 실례

```python
# repository/local_repository.py
def find_all_users():
    with get_local_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, email, role FROM users ORDER BY id")  # password 의도적 제외
            return cur.fetchall()

# service/user_service.py
ALLOWED_ROLES = {"admin", "user"}
def change_user_role(user_id, new_role):
    if new_role not in ALLOWED_ROLES:
        raise ValueError(...)
    update_user_role(user_id, new_role)
```

`change_user_role()`은 **role 값 자체**의 유효성만 검증할 뿐, **호출 주체가 이 작업을 수행할 권한이 있는지는 검증하지 않는다** — 이 지점이 admin_settings 보안 이슈의 정확한 코드 위치다([12장](./12_Reference화면분석.md)).

## 6-7. 종합 — 설계 원칙 vs 미비점

| 구분 | 내용 |
|---|---|
| ✅ 잘 지켜지는 원칙 | 통신 단일창구(`apiFetch`), 렌더러 중복등록 즉시 실패, DB 계층 책임 분리(settings/pool/query 3단), 상용DB 조회전용 코드 레벨 강제 |
| ⚠️ 미비/위험 | 권한(role) 검증 공통 데코레이터 부재, `renderKeyValueForm`이 아직 읽기전용 더미(실 CRUD 폼 아님) |
