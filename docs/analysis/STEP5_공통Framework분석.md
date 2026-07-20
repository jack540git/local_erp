# STEP 5. 공통 Framework 분석 (완료)

> 실제 코드 전수 열람: `static/js/content-renderers/registry.js`, `static/js/api-fetch.js`,
> `static/js/admin-api.js`, `static/js/profit-analysis-api.js`, `auth.py`,
> `db/settings.py`, `db/local_db.py`, `db/prod_db.py`, `repository/local_repository.py`,
> `service/user_service.py`
>
> `split-layout.js`(엔진) 자체의 상세 동작은 STEP 4에서 이미 분석 완료 → 본 STEP에서는 중복 서술하지 않고 참조만 함.

## 5-1. Frontend 공통 레지스트리 — `content-renderers/registry.js`

- 모든 `content-renderers/*.js`보다 먼저 로드되어야 하는 **기반 파일**. 전역 객체 `window.ScreenContentRenderers`(contentId → 렌더 정의)를 소유.
- `registerRenderer(contentId, def)`: 중복 등록 시 즉시 `throw`(런타임에 바로 드러나는 방어), `def.render`가 함수가 아니면 역시 `throw`. contentId 네이밍 규칙(`{menuKey}__{역할}_grid|form`)은 정규식으로 **경고만**(강제 아님).
- `renderAgGrid(el, columnDefs, rowData, extra)`: AG Grid 공통 초기화 헬퍼. 한국어 로케일(`AG_GRID_LOCALE_KR`) 고정 적용, `resizable/sortable/filter` 기본 on, `tooltipShowDelay:300`으로 기본값(2000ms)보다 단축.
- `renderKeyValueForm(el, fields)`: 그리드가 아닌 key-value 나열형 화면용 헬퍼. **현재는 `input.readOnly = true` 하드코딩** — 실제 DB 연동 CRUD용이 아니라 표시 전용 더미 상태(향후 개발 필요 항목).
- `window.Formatters.currency`: 천단위 콤마 포맷. "원" 접미사 코드가 주석 처리되어 있음(정책상 보류 상태로 추정).
- `registerRenderer("__default__main_grid", ...)`: `SCREEN_LAYOUTS`에 없는 화면을 위한 전역 폴백 플레이스홀더.
- `window.ScreenReloadHandlers` / `registerReload(menuKey, fn)`: **menuKey 단위**(contentId 단위 아님) 조회 재실행 레지스트리. `toolbar.js`의 "조회" 버튼이 여기서 활성 탭의 menuKey로 찾아 호출(STEP 4-7에서 확인한 내용과 연결). 등록 안 된 menuKey는 조용히 무시(에러 없음).

## 5-2. Frontend 공통 통신 계층 — `api-fetch.js`

- `apiFetch(url, options)` 하나로 앱의 **모든 서버 통신을 강제 통일**. `admin-api.js`, `profit-analysis-api.js` 등 도메인별 API 모듈은 반드시 이 함수를 거친다(직접 `fetch()` 호출 없음, 코드 전수 확인).
- **CSRF**: GET이 아닌 메서드에서만 `X-CSRFToken` 헤더 자동 첨부. 토큰은 `<meta name="csrf-token">`에서 읽음(STEP 4에서 "추정"으로 남겼던 부분을 본 STEP에서 **코드로 확정**: hidden input이 아니라 meta 태그가 맞음). 토큰 값은 최초 1회 조회 후 모듈 전역 변수(`_csrfToken`)에 캐싱.
- FormData 전송 시 `Content-Type`을 일부러 비워 브라우저가 boundary 포함해 자동 설정하도록 방어.
- 응답 JSON 파싱 실패(빈 바디/HTML 에러 페이지 등)를 `try/catch`로 방어 후 `data = null` 처리.
- `res.ok`가 아니면 서버가 내려준 `data.error` 우선, 없으면 `res.statusText`로 표준화된 `Error`를 던짐 — 도메인 API 모듈들은 이 예외를 그대로 상위(content-renderers)에 전파.

## 5-3. 도메인별 API 모듈 — `admin-api.js` / `profit-analysis-api.js`

- 둘 다 **얇은 래퍼 그 자체** — 엔드포인트 URL 조립 + `apiFetch()` 호출만 하고, 별도 로직 없음.
- `AdminAPI`: `listUsers()`(GET), `getUser(id)`(GET), `updateRole(id, role)`(POST, JSON body). role 값 자체의 검증은 프론트에 없음(서버 `user_service.py`의 화이트리스트에 위임).
- `ProfitAnalysisAPI`: `getByPaymentDate(date)` 단일 함수, 쿼리스트링 `encodeURIComponent`로 방어.
- 두 모듈 모두 `content-renderers/{admin,profit-analysis}.js`(Lazy Loading 대상)보다 먼저 로드되어야 하는 의존성 순서를 주석으로 명시.

## 5-4. Backend 공통 인증 — `auth.py`

- `verify_password(stored_hash, input_password)`: 해시 접두사(`$2y$/$2b$/$2a$`)로 **레거시 bcrypt 계정과 신규 werkzeug(pbkdf2/scrypt) 계정을 자동 분기 검증** — 데이터 마이그레이션 과도기 대응 설계로 판단됨.
- `login_required` 데코레이터: 세션에 `user_id` 없으면 로그인 페이지로 리다이렉트. **이 파일에는 `role_required` 등 권한(role) 검증 데코레이터가 존재하지 않음** — STEP 3에서 지적한 `admin_routes.py`의 보안 이슈(role 검증 부재)가 애초에 **재사용할 공통 데코레이터 자체가 없어서** 발생한 구조적 원인임을 본 STEP에서 확인.

## 5-5. Backend 공통 DB 계층 — `db/settings.py` + `db/local_db.py` + `db/prod_db.py`

- **역할 분리 원칙이 코드로 강제됨**: `settings.py`(환경변수 정리) → `local_db.py`/`prod_db.py`(커넥션 풀 관리) → `repository/*.py`(SQL 작성). 각 파일 상단 주석에 "이 책임만 담당한다"가 명시되어 있고 실제로도 그 경계를 지킴(예: `local_repository.py`가 `psycopg`를 직접 import하지 않음).
- **로컬DB(`local_db.py`)**: `ConnectionPool` + `dict_row` factory로 즉시 dict 형태 반환. 읽기/쓰기 모두 허용.
- **상용DB(`prod_db.py`)**: 3중 방어 구조로 조회 전용 강제
  1. `ReadOnlyConnection` 래퍼가 `fetch_one`/`fetch_all`만 제공(commit/execute 메서드 자체가 없음 → 코드로 원천 차단)
  2. `statement_timeout`을 세션 옵션으로 강제 적용(상용ERP 부담 방지)
  3. (코드 주석상 권고) DB 계정 자체도 SELECT 권한만 부여할 것 — 이건 인프라 설정 영역이라 코드로 확인 불가, 문서상 권고사항으로만 존재
  - `.env`에 접속정보가 없어도 앱이 죽지 않도록 **lazy pool 생성**(`_pool = None` → 최초 호출 시점에 생성), 없으면 `ProdDBNotConfiguredError`.

## 5-6. Backend 레이어드 패턴 실례 — `repository/local_repository.py` + `service/user_service.py`

- `local_repository.py`: 함수 단위로 SQL 작성, 커넥션은 항상 `with get_local_db_connection() as conn:`로만 획득. `find_all_users`/`find_user_by_id`는 **의도적으로 `password` 컬럼을 SELECT에서 제외**(관리자 화면 어디서도 비밀번호 해시가 응답에 노출되지 않음, 코드로 확인).
- `user_service.py`: `routes/admin_routes.py`는 이 서비스만 호출(코드 주석 + STEP 3 확인 내용과 일치). `ALLOWED_ROLES = {"admin", "user"}` 화이트리스트로 **role 값 자체의 유효성**은 검증하지만, **"누가 이 함수를 호출할 수 있는가"(호출 주체 권한)는 검증하지 않음** — 이 지점이 STEP 3에서 발견한 자기 자신 admin 승격 취약점의 정확한 코드 위치.

## 5-7. 종합 — 프레임워크 차원의 설계 원칙 vs 미비점

| 구분 | 내용 |
|---|---|
| ✅ 잘 지켜지는 원칙 | 통신 단일창구(`apiFetch`), 렌더러 중복등록 즉시 실패, DB 계층 책임 분리(settings/pool/query 3단), 상용DB 조회전용 코드 레벨 강제(3중 방어) |
| ⚠️ 미비/위험 | **권한(role) 검증 공통 데코레이터 부재** → `admin_routes.py` 보안 이슈의 근본 원인(STEP 3·5 공통 확인), `renderKeyValueForm`이 아직 읽기전용 더미(실 CRUD 폼 아님) |

---

## STEP 5 완료 체크
- [x] Frontend 공통 레지스트리(registry.js) 분석
- [x] Frontend 공통 통신 계층(api-fetch.js) 분석
- [x] 도메인 API 모듈(admin-api.js, profit-analysis-api.js) 분석
- [x] Backend 공통 인증(auth.py) 분석
- [x] Backend 공통 DB 계층(settings/local_db/prod_db) 분석
- [x] 레이어드 패턴 실례(repository→service) 분석
