# STEP 7. 전체 데이터 흐름 분석 (완료)

> 실제 코드 전수 열람: `app.py`, `routes/auth_routes.py`, `auth.py`, `utils/logger.py`,
> STEP 3~6에서 이미 분석한 routes/service/repository/db 전 계층을 종합
>
> STEP 6이 "화면 2개"의 개별 흐름이었다면, 본 STEP은 **로그인~세션~권한~로깅까지 앱 전체를 관통하는 공통 데이터 흐름**을 정리한다.

## 7-1. 앱 초기화 흐름 — `app.py`

```
app.py 로드
  → setup_logging(app)          # utils/logger.py: 파일(logs/app.log, 5MB 로테이션)+콘솔 핸들러 등록, app.logger를 루트 로거에 위임
  → ASSET_VERSION 계산           # 프로세스 시작 시각(UNIX time) → 정적파일 캐시버스팅 값, base.html이 사용(STEP4-1)
  → SECRET_KEY 로드              # 환경변수 FLASK_SECRET_KEY, 없으면 "dev-only-change-me" 하드코딩 기본값 사용
  → CSRFProtect(app)             # 전역 CSRF 검증 (POST/PUT/PATCH/DELETE) — api-fetch.js의 X-CSRFToken과 짝(STEP5-2)
  → Blueprint 등록: auth_bp, erp_bp, admin_bp(url_prefix="/admin")
```

- **⚠️ 보안 주의점**: `SECRET_KEY` 기본값이 `"dev-only-change-me"`로 하드코딩되어 있음. `.env`에 `FLASK_SECRET_KEY`가 설정되지 않으면 이 값이 그대로 운영에 쓰일 위험이 있음(세션 위변조 방어 근간이 되는 값이라 STEP 3/5/6의 role 검증 부재 이슈와 별개로 별도 점검 필요 항목).

## 7-2. 로그인 → 세션 → 화면 접근 전체 흐름

```
GET "/"  (routes/auth_routes.py: login_page)
  → 세션에 user_id 있으면 바로 /dashboard로 리다이렉트, 없으면 login.html 렌더

POST "/login" (login_process)
  → repository.find_user_by_email(email)  # 로컬DB, password 해시 포함 조회(로그인 시에만 예외적으로 필요)
  → auth.verify_password(stored_hash, password)  # bcrypt/werkzeug 자동분기(STEP5-4)
  → 성공 시: session.clear() → session[user_id/email/role] = DB 조회 시점 값 저장
  → redirect(/dashboard)

GET "/dashboard" (routes/erp_routes.py: dashboard, @login_required)
  → session["email"], session["role"]을 그대로 base.html에 주입(Jinja2)
  → base.html: 트리메뉴(DUMMY_TREE_MENU, menu_data.py) 렌더 + 정적 스크립트 로드(STEP4-1 순서)
  → 이후 모든 화면 진입은 STEP4에서 분석한 TabManager→SplitLayout→content-renderers 파이프라인(서버 재요청 없이 SPA 방식)

POST "/logout" (logout)
  → session.clear() → 로그인 페이지로
```

### 🔴 핵심 데이터 흐름 이슈: 세션 role 값의 정합성(Staleness)
- `session["role"]`은 **로그인 시점**에 DB에서 조회한 값이 그대로 세션 쿠키에 고정된다. 이후 `admin_settings` 화면(STEP 6)에서 관리자가 어떤 사용자의 role을 변경해도, **해당 사용자가 이미 로그인해 있는 세션의 `role` 값은 재로그인 전까지 갱신되지 않는다** — 서버 라우트들이 애초에 `session["role"]`을 검증에 쓰지 않는 상태(STEP 3/5/6)라 현재는 이 값이 화면 표시 외의 인가 로직에 실질적으로 쓰이지 않지만, **향후 role 검증 데코레이터를 추가할 때 세션 role을 그대로 신뢰하면 "권한 회수가 즉시 반영되지 않는" 새로운 문제가 생길 수 있음** — 개발 계획서 향후 개발 항목(role 검증 추가) 설계 시 반드시 함께 고려해야 할 지점.

## 7-3. 요청 단위 데이터 흐름 종합 다이어그램

```
[Browser]
   │  (1) 최초 접속: GET /dashboard (세션 쿠키 포함)
   ▼
[Flask app.py] → Blueprint 라우팅 → @login_required 세션 체크
   ▼
[routes/*.py] → 화면 렌더(base.html) 또는 JSON API
   │
   │  (2) SPA 내부 화면 전환: 서버 재요청 없음 (TabManager+SplitLayout, STEP4)
   │  (3) 데이터 조회/변경: apiFetch(JSON, X-CSRFToken 헤더)
   ▼
[routes/*_routes.py]  (CSRFProtect가 먼저 토큰 검증)
   ▼
[service/*.py]   ← 입력값 검증(정규식/화이트리스트), 권한(role) 검증은 미구현
   ▼
[repository/*.py] ← SQL 작성 전담
   ▼
[db/local_db.py 또는 db/prod_db.py] ← 커넥션 풀 대여
   ▼
PostgreSQL (로컬 myappdb: 읽기/쓰기 | 상용ERP Odoo: 조회 전용, ReadOnlyConnection)
   ▼
JSON 응답 → apiFetch 표준 에러처리 → content-renderers가 AG Grid/폼 갱신
```

## 7-4. 로깅 데이터 흐름

- 모든 계층(`routes`, `service`, `repository`)이 `utils.logger.get_logger(__name__)`로 모듈별 로거를 얻어 **같은 파일(`logs/app.log`)+콘솔에 통합 기록**. Flask 자체 에러 로그(`app.logger`)도 동일 파일로 위임되어 있어 별도 로그 파일 확인 불필요.
- 로그 포맷: `%(asctime)s [%(levelname)s] %(name)s: %(message)s` — 모듈명(`%(name)s`)이 그대로 찍히므로 어느 계층에서 난 로그인지 파일만 봐도 구분 가능.
- **STEP 6에서 발견한 로깅 버그 재확인**: `profit_analysis_repository.py`의 `logger.info("지급일기준 손익조회", date_payment)`는 포맷 문자열에 `%s`가 없는데 인자를 넘겨, 실제 이 라인이 실행되는 시점에 Python logging이 `msg % args`를 시도하며 `TypeError: not all arguments converted during string formatting`를 던질 수 있는 코드. `setup_logging()`이 실제 파일+콘솔 핸들러를 등록하므로(로거가 비활성 상태가 아님) **손익조회 API 호출 시마다 이 오류가 실제로 발생할 가능성이 높음**(응답 자체가 실패하지는 않을 수 있으나— logging 예외는 기본적으로 handleError가 삼켜서 stderr에만 찍히고 요청은 계속 진행됨. 다만 로그가 이 지점부터 유실됨).

## 7-5. 데이터 흐름 관점에서 본 2-DB 구조의 의미

| | 로컬DB(myappdb) | 상용ERP DB(Odoo) |
|---|---|---|
| 흐름상 위치 | 로그인 인증, 관리자 설정 | 손익분석 등 조회성 화면 |
| 권한 | 읽기/쓰기 모두 허용 | `ReadOnlyConnection`으로 코드 레벨 조회 강제(STEP5-5) |
| 커넥션 생성 시점 | 앱 시작 시 즉시(`pool = ConnectionPool(...)` 모듈 로드 시 생성) | Lazy(`_pool = None`, 최초 호출 시 생성, `.env` 미설정 시 앱은 안 죽고 호출 시점에만 에러) |
| 데이터의 최신성 | 즉시 반영(같은 트랜잭션 흐름) | 상용ERP 운영 데이터를 그대로 조회(별도 배치/동기화 없음, 실시간 조회) |

---

## STEP 7 완료 체크
- [x] 앱 초기화 흐름(app.py) 분석
- [x] 로그인→세션→화면 접근 전체 흐름 분석
- [x] 세션 role 정합성(staleness) 문제 발견 및 향후 설계 시 유의점 도출
- [x] 요청 단위 종합 데이터 흐름 다이어그램 작성
- [x] 로깅 데이터 흐름 및 STEP6 발견 버그의 실제 영향 분석
- [x] 2-DB 구조를 데이터 흐름 관점에서 비교
