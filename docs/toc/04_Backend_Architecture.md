# 4. Backend Architecture

> 근거: [analysis/STEP3_Backend분석.md](../analysis/STEP3_Backend분석.md), [STEP5_공통Framework분석.md](../analysis/STEP5_공통Framework분석.md), [STEP7_데이터흐름분석.md](../analysis/STEP7_데이터흐름분석.md)

## 4-1. 4단 레이어드 구조

```
routes/  →  service/  →  repository/  →  db/
(프레젠테이션)  (비즈니스 로직)  (SQL)  (커넥션 풀)
```

기존 `app.py` 단일 파일 구조에서 이 구조로 마이그레이션(Phase 0~5 완료, Phase 6 회귀검증 진행)했으며, 로그인/profit_payment_date/admin_settings/approval 4개 도메인 전부에서 이 구조가 일관되게 적용되어 있음을 코드로 확인했다.

## 4-2. 계층별 책임

| 계층 | 책임 | 하지 않는 것 |
|---|---|---|
| `routes/*.py` | HTTP 요청 파싱, `@login_required` 적용, service 호출, JSON/템플릿 응답 변환 | SQL 작성, 비즈니스 로직 |
| `service/*.py` | 입력값 검증(정규식/화이트리스트), 날짜 계산 등 "쿼리 밖" 로직, repository 호출 | repository를 우회한 직접 DB 접근 |
| `repository/*.py` | SQL 작성 및 실행, `db/` 커넥션 함수 사용 | 커넥션 풀 직접 생성, 비즈니스 판단 |
| `db/*.py` | 커넥션 풀 관리, 접속 설정 | SQL 쿼리 작성 |

## 4-3. app.py — 엔트리포인트

```python
app = Flask(__name__)
setup_logging(app)
app.jinja_env.globals["ASSET_VERSION"] = ...   # 캐시버스팅
app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY", "dev-only-change-me")
csrf = CSRFProtect(app)

app.register_blueprint(auth_bp)                        # "auth", 루트
app.register_blueprint(erp_bp)                          # "erp", 루트
app.register_blueprint(admin_bp, url_prefix="/admin")    # "admin", /admin
```

⚠️ `SECRET_KEY` 기본값이 `"dev-only-change-me"`로 하드코딩되어 있다. `.env`에 `FLASK_SECRET_KEY`가 없으면 이 값이 그대로 쓰이므로, 운영 배포 체크리스트에 반드시 포함해야 한다([19장 체크리스트](./19_체크리스트.md)).

## 4-4. Blueprint 등록 요약표

| 변수명 | 네임스페이스(`url_for`) | url_prefix | 라우트 | 파일 |
|---|---|---|---|---|
| `auth_bp` | `"auth"` | 없음 | `/`, `/login`, `/logout` | `routes/auth_routes.py` |
| `erp_bp` | `"erp"` | 없음 | `/dashboard`, `/api/profit-analysis/payment-date` | `routes/erp_routes.py` |
| `admin_bp` | `"admin"` | `/admin` | `/users`, `/users/list`, `/users/<id>`, `/users/<id>/role` | `routes/admin_routes.py` |

## 4-5. 도메인별 레이어 실례 (2가지 재사용 패턴)

### 패턴 A — CRUD형(로컬DB), 예: admin_settings

```
routes/admin_routes.py
  user_list_api()      GET /admin/users/list
  user_detail_api(id)  GET /admin/users/<id>
  user_role_update_api(id)  POST /admin/users/<id>/role
        ▼
service/user_service.py
  ALLOWED_ROLES = {"admin", "user"}   # 화이트리스트, 하드코딩
  get_user_list() / get_user_detail(id) / change_user_role(id, role)
        ▼
repository/local_repository.py
  find_all_users() / find_user_by_id(id) / update_user_role(id, role)
  (password 컬럼은 SELECT에서 의도적으로 제외)
        ▼
db/local_db.py → PostgreSQL(myappdb)
```

### 패턴 B — 분석/조회형(상용DB), 예: profit_payment_date, approval

```
routes/erp_routes.py
  profit_analysis_payment_date_api()  GET /api/profit-analysis/payment-date
        ▼
service/profit_analysis_service.py
  get_profit_by_payment_date(date_payment)
  - 정규식(YYYY-MM-DD)으로 형식 검증, 실패 시 ValueError → routes가 400 응답
        ▼
repository/profit_analysis_repository.py
  find_profit_by_payment_date(date_payment)
  - 다중 CTE(6개 이상) 조인의 대형 분석 쿼리
        ▼
db/prod_db.py → 상용ERP(Odoo) PostgreSQL (ReadOnlyConnection)
```

신규 도메인을 추가할 때는 위 두 패턴 중 성격에 맞는 쪽을 선택해 그대로 따라 하면 된다([17장](./17_신규메뉴개발절차.md)).

## 4-6. DB 접속 계층 상세

| 파일 | 역할 |
|---|---|
| `db/settings.py` | `LocalDBSettings`, `ProdDBSettings` — 환경변수 정리만, SQL 없음. `ProdDBSettings.is_configured()`로 미설정 시 안전 판단 |
| `db/local_db.py` | 모듈 로드 시 즉시 `ConnectionPool` 생성. `get_local_db_connection()`이 컨텍스트매니저 반환 |
| `db/prod_db.py` | **Lazy pool 생성**(`_pool=None`, 최초 호출 시 생성) — 접속정보 없어도 앱이 죽지 않음. `ReadOnlyConnection`이 `fetch_all`/`fetch_one`만 제공(commit/execute 메서드 자체가 없어 코드 레벨에서 쓰기 원천 차단). `statement_timeout` 세션 옵션으로 상용ERP 부하 보호 |

## 4-7. 인증 — auth.py

```python
def verify_password(stored_hash, input_password):
    # $2y$/$2b$/$2a$ 접두사 → bcrypt(레거시 계정)
    # 그 외 → werkzeug pbkdf2/scrypt(신규 계정)

def login_required(view_func):
    # session에 user_id 없으면 로그인 페이지로 리다이렉트
```

⚠️ **`role_required` 등 권한(인가) 검증 데코레이터가 이 파일에 존재하지 않는다.** 이것이 `admin_settings`의 role 승격 취약점([12장](./12_Reference화면분석.md), [16장](./16_개발표준.md))의 구조적 원인이다 — 검증 자체가 어려운 게 아니라, **재사용할 공통 구조가 애초에 없다.**

## 4-8. 로깅

`utils/logger.py`의 `setup_logging(app)`이 앱 시작 시 1회 호출되어 `RotatingFileHandler`(5MB×5개)+콘솔 핸들러를 루트 로거에 등록하고, Flask의 `app.logger`도 동일 핸들러로 위임한다. 모든 계층은 `get_logger(__name__)`으로 모듈별 로거를 얻어 사용한다.

⚠️ `repository/profit_analysis_repository.py`의 `find_profit_by_payment_date()` 최상단 `logger.info("지급일기준 손익조회", date_payment)` 호출은 포맷 문자열에 `%s`가 없는데 인자를 넘기고 있어, 실제 handler가 붙어있는 이 환경에서 `TypeError`를 유발할 수 있는 코드 패턴이다(수정 필요, [16장](./16_개발표준.md) 참고).
