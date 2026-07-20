# STEP 3. Backend 구조 분석 (완료)

> 실제 코드 전수 열람: `app.py`, `auth.py`, `menu_data.py`, `db/*.py`, `repository/*.py`,
> `service/*.py`, `routes/*.py`, `utils/logger.py`

## 3-1. 진입점 — `app.py`

```python
app = Flask(__name__)
setup_logging(app)                       # utils/logger.py — 파일+콘솔 로깅 초기화
app.jinja_env.globals["ASSET_VERSION"]   # 캐시버스팅용, 프로세스 시작시각 or 환경변수
app.config["SECRET_KEY"]                 # 환경변수 우선, 기본값은 dev-only
csrf = CSRFProtect(app)                  # 전역 CSRF 보호 (POST/PUT/PATCH/DELETE)

app.register_blueprint(auth_bp)                          # "auth" — 루트
app.register_blueprint(erp_bp)                           # "erp"  — 루트
app.register_blueprint(admin_bp, url_prefix="/admin")     # "admin" — /admin
```

`app.py`는 Blueprint 등록과 앱 초기화만 담당 — 실제 로직은 전혀 없음(레이어드 마이그레이션 목적 달성 확인).

## 3-2. 레이어 구조 실측 (routes → service → repository → db)

### (A) 로그인 도메인

```
routes/auth_routes.py
  login_page()        GET  /            세션 있으면 redirect(erp.dashboard), 없으면 login.html
  login_process()      POST /login       ─┐
  logout()             POST /logout      │
                                          ▼
repository/local_repository.py
  find_user_by_email(email)  →  db/local_db.py: get_local_db_connection()
                                          ▼
auth.py
  verify_password(stored_hash, input_password)   # bcrypt($2y$/$2b$/$2a$ 접두사) vs werkzeug 분기
  login_required(view_func)                       # 데코레이터, session 미존재 시 auth.login_page로 리다이렉트
```

### (B) ERP 대시보드 / 지급기준손익(profit_payment_date) — Reference 화면 ①

```
routes/erp_routes.py
  dashboard()                                GET /dashboard        @login_required
      → render_template("base.html", tree_menu=DUMMY_TREE_MENU)     [menu_data.py]

  profit_analysis_payment_date_api()         GET /api/profit-analysis/payment-date   @login_required
      → service/profit_analysis_service.py: get_profit_by_payment_date(date_payment)
          - 정규식(_DATE_RE)으로 YYYY-MM-DD 형식 검증, 실패 시 ValueError → routes에서 400 응답
          → repository/profit_analysis_repository.py: find_profit_by_payment_date(date_payment)
              - 상용ERP(Odoo) 대상, WITH절 다중 CTE(contract/sale_sum/purchase_sum/delivery_orders/
                last_price/expected_product_amount/delivery_amounts/saleoder_amounts/main) 조합의
                대형 분석 쿼리 (약 190줄)
              → db/prod_db.py: get_prod_db_connection() (ReadOnlyConnection, SELECT 전용)
```

- **⚠️ 코드 품질 이슈 발견**: `profit_analysis_repository.py`의 `find_profit_by_payment_date()` 첫 줄이
  `logger.info("지급일기준 손익조회", date_payment)`이고 그 **다음 줄에 docstring**이 위치함.
  Python 문법상 오류는 아니지만(그냥 실행되지 않는 문자열 리터럴 statement가 됨), 이 함수는 실제로는
  **docstring이 없는 상태**이며 `logger.info` 호출도 포맷 인자를 안 쓰고 있어(`%s` 없음) 의도한
  로깅이 아닐 가능성이 있음. 실제 사용되는 로깅은 함수 끝부분의
  `logger.info("[손익조회] SQL 실행 (date_payment=%s)", date_payment)` 등.

### (C) admin_settings(관리자 설정) — Reference 화면 ②

```
routes/admin_routes.py  (url_prefix="/admin")
  user_settings_page()      GET  /admin/users              @login_required   [SPA 폴백 페이지, admin_users.html]
  user_list_api()           GET  /admin/users/list          @login_required   [좌측 AG Grid 목록]
  user_detail_api(id)       GET  /admin/users/<id>          @login_required   [우측 상세]
  user_role_update_api(id)  POST /admin/users/<id>/role     @login_required   [role 변경, CSRF 필요]
                                          │
                                          ▼
service/user_service.py
  ALLOWED_ROLES = {"admin", "user"}          # 화이트리스트, 하드코딩
  get_user_list()          → repository.find_all_users()
  get_user_detail(id)      → repository.find_user_by_id(id)
  change_user_role(id, role)  → new_role 검증 후 repository.update_user_role(id, role)
                                          │
                                          ▼
repository/local_repository.py
  find_all_users()      SELECT id, email, role FROM users ORDER BY id      (password 제외)
  find_user_by_id(id)   SELECT id, email, role FROM users WHERE id = %s    (password 제외)
  update_user_role(id, role)  UPDATE users SET role = %s WHERE id = %s ; commit()
```

- **🔴 실제 코드로 확인된 보안 이슈**: `admin_routes.py`의 4개 라우트 전부 `@login_required`만 적용되어 있고,
  `session["role"] == "admin"` 검증(`@admin_required` 등)이 어디에도 없음. `future_considerations.md`에서
  지적한 문제가 **코드 레벨에서 그대로 재현됨**을 확인. 즉 role="user"로 로그인한 계정도
  `POST /admin/users/<자기id>/role {"role":"admin"}`을 직접 호출하면 스스로 admin으로 승격 가능.

### (D) 기안(approval) 도메인 — 상용DB 조회 전용 참고 사례

```
service/approval_service.py
  get_recent_completed_approvals(days=365)
      - since_date = 오늘 - days (날짜 계산은 service 책임)
      → repository/approval_repository.py: find_completed_approvals(since_date)
          - approval_approval + approval_doctype + hr_employee LEFT JOIN
          - WHERE progress = 'complete' AND date_complete >= since_date
          → db/prod_db.py: get_prod_db_connection()

service/test_approval_service.py  — 독립 실행 테스트 스크립트 (routes 없이 서비스 단독 확인)
```

## 3-3. DB 접속 계층 (`db/`) 상세

| 파일 | 역할 |
|---|---|
| `db/settings.py` | `LocalDBSettings`(myappdb, 읽기/쓰기), `ProdDBSettings`(상용ERP, `is_configured()`로 미설정 시 안전 처리) — 순수 설정값만, SQL 없음 |
| `db/local_db.py` | `ConnectionPool` 전역 생성(`min_size`/`max_size`는 설정값), `get_local_db_connection()`이 `pool.connection()` 컨텍스트매니저 반환 |
| `db/prod_db.py` | `_pool`을 **lazy 생성**(모듈 로드 시 바로 안 만듦 → 접속정보 없어도 앱 안 죽음), `ReadOnlyConnection`이 `fetch_all`/`fetch_one`만 노출(DML 메서드 자체가 없음), `statement_timeout`을 커넥션 옵션으로 주입(상용ERP 부하 보호) |
| `db/test_prod_connection.py` | `python -m db.test_prod_connection`으로 단독 실행하는 접속 확인 스크립트 |

- **네이밍 규칙 확인**: Flask의 `session`(로그인 세션)과 DB 커넥션을 구분하기 위해 함수명을 전부
  `get_local_db_connection()` / `get_prod_db_connection()`으로 통일(문서에서 언급된 원칙이 코드에 실제 반영됨).

## 3-4. 공통 유틸 — `utils/logger.py`

- `setup_logging(app)`: 최초 1회만 실행되는 가드(`_configured` 플래그), `RotatingFileHandler`(5MB×5개, UTF-8) +
  콘솔 핸들러를 루트 로거에 등록. `app.logger.handlers = []` + `propagate = True`로 Flask 내부 로그도 같은 곳에 통합.
- `get_logger(name)`: 모듈별 `logging.getLogger(name)` 반환 — 모든 service/repository/routes 파일이 이 패턴 사용.
- 로그 파일 경로는 `utils/logger.py` 위치 기준 상대경로로 계산되어 `logs/app.log`로 고정.

## 3-5. Blueprint 등록 요약표

| 변수명 | 등록 이름(`url_for` 네임스페이스) | url_prefix | 실제 라우트 | 파일 |
|---|---|---|---|---|
| `auth_bp` | `"auth"` | 없음(루트) | `/`, `/login`, `/logout` | `routes/auth_routes.py` |
| `erp_bp` | `"erp"` | 없음(루트) | `/dashboard`, `/api/profit-analysis/payment-date` | `routes/erp_routes.py` |
| `admin_bp` | `"admin"` | `/admin` | `/users`, `/users/list`, `/users/<id>`, `/users/<id>/role` | `routes/admin_routes.py` |

## 3-6. 신규 백엔드 도메인 추가 시 재사용할 두 가지 패턴 (실제 코드에서 확인)

1. **CRUD형(로컬DB)**: `user_service.py` 패턴 — service가 단순 위임 + 화이트리스트 검증만 수행, repository는 단건/목록/수정 함수 3~4개.
2. **분석/조회형(상용DB)**: `approval_service.py`/`profit_analysis_service.py` 패턴 — service가 날짜 계산·형식 검증 등 "쿼리 밖 로직"을 책임지고, repository는 파라미터를 받아 SQL만 실행. 쿼리가 여러 도메인 테이블을 조인하면(`profit_analysis_repository.py`처럼) 특정 도메인에 억지로 넣지 않고 별도 파일로 분리.
