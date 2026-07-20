# ERP 백엔드 아키텍처 마이그레이션 계획 (레이어드 구조 전환)

> 목적: 현재 `app.py` 하나에 라우팅+인증+DB 접근이 섞여 있는 구조를,
> `routes(프레젠테이션) → service(비즈니스 로직) → repository(쿼리) → db(접속 계층)` 4단 레이어드 구조로 전환.
> 프런트엔드(templates/static, `SCREEN_LAYOUTS`/`content-renderers.js` 등 Step 1~9 결과물)는 이 마이그레이션과
> **무관하게 그대로 유지**되며, `routes/erp_routes.py`가 지금의 `/dashboard` 라우트를 그대로 이어받는다.

---

## 0. 확인된 결정 사항 (진행 전 질문에 대한 답변 반영)

| 항목 | 결정 |
|---|---|
| DB 라이브러리 | **psycopg + psycopg_pool 직접 사용 유지** (SQLAlchemy 전환 안 함) |
| 상용DB의 실체 | **사내에서 별도로 운영 중인 상용 ERP(Odoo)의 PostgreSQL DB.** Phase 2에서 실제 연동 시작(기안/approval 도메인) |
| 로깅 | 표준 라이브러리 `logging` 사용, Phase 5에서 적용 완료 |
| Blueprint 방향성 | 1-4절에 구체적으로 제시, Phase 4에서 실제 적용 완료 |
| 버전관리(git) | **미사용.** 대신 Phase 진입 전 폴더 전체 백업 절차를 4절에 명시 |
| Repository/Service 확장 방식 | **도메인 기반, 필요할 때마다 추가.** `customer/item/order`는 원래 구조 제안의 예시였을 뿐이며, 실제로는 `approval`(기안)처럼 실제 업무에 필요한 도메인이 생길 때마다 그 이름으로 repository/service 파일을 만든다. 미리 빈 스텁을 만들어두지 않는다 |

---

## 1. 현재 구조 확인 (마이그레이션 착수 시점, 실제 코드 기준)

```
app.py          Flask 엔트리 + 라우트(/, /login, /dashboard, /logout) + CSRFProtect 초기화
auth.py         verify_password(bcrypt+werkzeug 혼용) + @login_required 데코레이터
db.py           psycopg_pool.ConnectionPool 기반 커넥션 풀 + find_user_by_email() 쿼리 1개
menu_data.py    사이드 트리메뉴 더미 데이터
```

DB는 `.env`의 `DB_HOST/PORT/USER/PASSWORD/NAME` 하나(`myappdb`, 로컬 PostgreSQL, `host.docker.internal` 경유)만 존재하던 시점.

`templates/login.html`, `templates/base.html`이 참조하던 엔드포인트 이름(마이그레이션 착수 시점 값 — Blueprint 전환 후 전부 변경 대상):

| 템플릿 | 참조 | 착수 시점 엔드포인트 |
|---|---|---|
| `login.html` | 폼 action | `url_for('login_process')` |
| `base.html` | 로그아웃 폼 action | `url_for('logout')` |
| `app.py` 내부 | 리다이렉트 | `url_for('dashboard')`, `url_for('login_page')` |
| `auth.py`의 `login_required` | 리다이렉트 | `url_for('login_page')` |

### 1-1. psycopg 유지에 따른 설계 반영

SQLAlchemy를 안 쓰므로, `db/local_db.py`/`db/prod_db.py`는 "세션(Session) 객체"가 아니라 **"커넥션 풀에서 커넥션을 빌려주는 함수"**를 반환하는 형태가 정확한 표현이다.

- `get_local_db_connection()` — 기존 `db.py`의 `pool.connection()` 컨텍스트매니저를 그대로 반환하는 함수
- `get_prod_db_connection()` — 상용DB 전용, 커넥션 자체는 커넥션 풀에서 빌리되 **쓰기 관련 메서드를 감싼 얇은 래퍼 객체**를 반환 (1-3절 참고)

### 1-2. Flask `session` vs DB 접속 객체 — 이름 충돌 방지

DB 쪽은 전부 `_connection`/`_conn` 접미사로 통일한다 (`get_local_db_connection`, `get_prod_db_connection`) — Flask의 로그인 `session`과 헷갈리지 않도록.

### 1-3. 상용DB "조회 전용" 강제 방법 — 2겹 방어

1. **코드 레벨**: `db/prod_db.py`의 `ReadOnlyConnection`이 `fetch_all()`/`fetch_one()`만 제공, `commit()`/DML 메서드는 아예 없음.
2. **DB 계정 레벨**: 상용 ERP DB에 SELECT 권한만 있는 조회 전용 계정 발급 요청 — 가장 확실한 안전장치.

### 1-4. Blueprint 방향성 (구체안, Phase 4에서 실제 적용 완료)

| Blueprint 변수명 | 등록 이름(`name`) | `url_prefix` | 담당 라우트 | 비고 |
|---|---|---|---|---|
| `auth_bp` | `"auth"` | 없음(루트) | `/`, `/login`, `/logout` | 기존 URL 그대로 유지 |
| `erp_bp` | `"erp"` | 없음(루트) | `/dashboard` | 마찬가지로 기존 URL 유지 |
| `admin_bp` | `"admin"` | `/admin` | (스텁, 아직 없음) | 향후 관리자 전용 기능 추가 시 이 안에 배치 |

**엔드포인트 이름 변경 대응표** (Phase 4에서 전부 수정 완료):

| 기존 | 변경 후 |
|---|---|
| `url_for('login_page')` | `url_for('auth.login_page')` |
| `url_for('login_process')` | `url_for('auth.login_process')` |
| `url_for('logout')` | `url_for('auth.logout')` |
| `url_for('dashboard')` | `url_for('erp.dashboard')` |

### 1-5. `admin_routes.py`의 실체

현재 "관리자 전용" 기능은 없음. 빈 Blueprint(스텁)만 등록해두고, 실제 관리자 화면이 정해지면 그 안에 라우트를 채워나가는 방향으로 진행한다.

---

## 2. 제안 구조 총평

계층 분리(routes → service → repository → db), 상용DB 조회 전용 강제, 도메인 단위 repository/service 분리, Blueprint 기반 routes 분리라는 전체 방향은 향후 상용ERP 연동·동기화 배치가 들어올 걸 감안하면 **적합하고 표준적인 구조**다.

### 2-1. Repository/Service 확장 방식 — 예시 도메인 대신 실제 도메인 기반으로 변경

실제 첫 실사용 도메인은 **`approval`(기안/전자결재)**로 확인됨. 앞으로도:

- 실제 업무에 필요한 도메인이 생길 때 그 이름으로 `repository/{도메인}_repository.py`, `service/{도메인}_service.py`를 추가
- 미리 빈 스텁을 만들어두지 않음
- 상용DB 대상 쿼리는 값을 항상 `%s` 플레이스홀더로 전달 (SQL 인젝션 방지)

---

## 3. `logs/` 디렉토리 — Docker 볼륨 (Phase 5에서 해결 완료)

```yaml
services:
  local-erp:
    build: .
    volumes:
      - ./logs:/app/logs   # Phase 5에서 추가, 적용 및 검증 완료
    ...
```

---

## 4. git 미사용에 따른 백업/롤백 전략

```bash
cp -r ~/project/local_erp ~/project/local_erp_backup_phase{완료된 phase 번호}
```

- 문제가 생기면 해당 백업 폴더로 통째로 되돌리고 재시도
- `.env`(비밀번호 포함)도 백업 대상에 포함되므로, 백업 폴더 위치(외부 유출 경로 등)에 주의

---

## 5. 마이그레이션 단계 (Phase) — 진행 현황

| Phase | 작업 내용 | 산출물 / 실제 이관 대상 | 상태 |
|---|---|---|---|
| 0 | 사전 준비 | 디렉토리 생성(`db/`, `repository/`, `service/`, `routes/`, `utils/`, `logs/` + `__init__.py`) | ✅ 완료 |
| 1 | DB 접속 계층 이관 | `db/settings.py`, `db/local_db.py`, `db/prod_db.py`, `db/test_prod_connection.py` | ✅ 완료 (상용DB 접속 테스트 통과) |
| 2 | Repository 계층 신설 | `repository/local_repository.py`, `repository/approval_repository.py` | ✅ 완료 |
| 3 | Service 계층 신설 | `service/approval_service.py`(`get_recent_completed_approvals(days=365)`), `service/test_approval_service.py` | ✅ 완료 (approval_service만 실제 구현) |
| 4 | Routes Blueprint 전환 | `auth_routes.py`/`erp_routes.py`/`admin_routes.py`, `app.py` 축소 | ✅ 완료 |
| 5 | Utils 계층 + 로깅 + Docker 볼륨 | `utils/logger.py`(`logging` 모듈, `logs/app.log` 로테이션), `docker-compose.yml`에 `./logs:/app/logs` 볼륨 | ✅ 완료 (재빌드 후 로그 보존 확인됨) |
| 6 | 검증 | 로그인/로그아웃, 대시보드 회귀, CSRF, 로그 보존, 상용ERP 조회 전체 재확인 | ▶ 진행 중 |
| 7 | 문서화 | 마이그레이션 진행 기록을 이 문서로 관리 | 진행 중 |

> 기안(approval) 화면을 실제 프론트엔드와 연결하는 작업(`/api/approvals` 라우트 등)은 repository/service 계층이 준비되어 있으나, 별도 요청 시 진행.

---

## 6. 로깅 라이브러리 검토 — `logging`(표준) 채택 (Phase 5에서 확정)

- 이 프로젝트는 의존성을 최소로 유지하는 방향으로 일관되게 결정해왔다. 서드파티 로깅 라이브러리보다 **Python 표준 `logging` 모듈**(`RotatingFileHandler`)이 이 프로젝트 원칙과 일관된다.
- Flask가 내부적으로 이미 표준 `logging`(`app.logger`)을 쓰므로 통합이 쉽다.

---

## 7. 위험 요소 (최신화)

- **Docker 볼륨**: 해결 완료 (3절, Phase 5).
- **되돌리기 전략**: git 미사용이므로 4절의 폴더 백업 절차를 Phase마다 반드시 수행.
- **상용ERP 조회 부하**: `approval_service`가 기본 365일치를 조회하도록 되어 있어, 데이터량이 많아지면 상용ERP에 부하를 줄 수 있음. `PROD_DB_STATEMENT_TIMEOUT`(현재 5000ms)이 안전장치 역할을 하지만, 실제 데이터량 확인 후 필요하면 기본 조회 기간을 줄이는 것을 고려.

---

## Phase 1~4 진행 결과 (검토 완료)

### 코드 전체 재확인 결과

| Phase | 확인 항목 | 결과 |
|---|---|---|
| 1 | `db/local_db.py`에 Phase 1 임시로 남겨뒀던 `find_user_by_email`이 제거되고 순수 커넥션 풀 관리만 남았는지 | ✅ 확인됨 |
| 2 | `repository/local_repository.py`(로컬), `repository/approval_repository.py`(상용) 분리, `get_prod_db_connection()` 사용, `%s` 플레이스홀더, 컬럼 별칭 snake_case 통일 | ✅ 확인됨 |
| 3 | `service/approval_service.py`가 repository를 위임 호출하고, 날짜 계산(`since_date`) 책임을 service가 지도록 분리 | ✅ 확인됨 |
| 4 | `app.py`(Blueprint 등록만 남음), `auth_routes.py`/`erp_routes.py`/`admin_routes.py`, `auth.py`의 `login_required`, `login.html`/`base.html`의 `url_for` 전부 `auth.*`/`erp.*` 형식으로 정확히 치환 | ✅ 확인됨 |

### Phase 3 진행 방식 결정

3가지 선택지(스텁 먼저 생성 / approval_service만 실제 구현 / Service 계층 생략) 중 **2번 선택** — `approval_service.py`만 실제 구현, `customer/item/order` 등은 실제 필요해지는 시점에 추가.

### 호출 체인 (실제 상용DB 접속 확인)

```
service/test_approval_service.py
    -> service/approval_service.py (get_recent_completed_approvals)
    -> repository/approval_repository.py (find_completed_approvals, get_prod_db_connection 사용)
    -> db/prod_db.py (ProdDBSettings 기준 접속)
    -> 사내 상용 ERP(Odoo)의 PostgreSQL (approval_approval / approval_doctype / hr_employee 테이블)
```

**Phase 1~4 상태: 전체 완료.**

---

## Phase 5 진행 결과 (완료)

### 구현 내역

| 파일 | 내용 |
|---|---|
| `utils/logger.py` | `setup_logging(app)`: 루트 로거에 `RotatingFileHandler`(5MB, 5개 보관, `logs/app.log`)와 콘솔 핸들러 등록. `app.logger.propagate = True`로 Flask 내부 로그도 같은 곳에 통합. `get_logger(name)`: 모듈별 로거 획득 |
| `app.py` | `setup_logging(app)`을 Flask 인스턴스 생성 직후 호출, 앱 초기화 완료 로그 기록 |
| `routes/auth_routes.py` | 로그인 성공/실패, 로그아웃 시 이메일+역할만 기록 (비밀번호 등 민감정보 없음) |
| `service/approval_service.py` | 상용ERP 조회 시작/완료(건수만) 로그 — 향후 조회 부하 추적용 |
| `docker-compose.yml` | `volumes: - ./logs:/app/logs` 추가 |

### 검증 결과

- [x] `docker compose logs -f local-erp`로 콘솔 로그 실시간 확인됨
- [x] 로그인 성공/실패 시 `logs/app.log`에 이메일/역할 기록되는 것 확인됨
- [x] `~/project/local_erp/logs/app.log`가 호스트에서도 직접 열람 가능 (볼륨 마운트 정상)
- [x] `docker compose up -d --build` 재빌드 후에도 로그 파일 유지됨 (`LOG_DIR`이 `/app/logs`로 계산되어 볼륨 마운트 경로와 정확히 일치함을 코드 레벨에서도 재확인)
- [x] `Dockerfile`에 `USER` 지시어가 없어 컨테이너가 root로 실행 → 마운트된 `logs/`에 쓰기 권한 문제 없음 확인

**Phase 5 상태: 완료.**

---

## Phase 6 — 전체 회귀 검증 (진행 중)

Phase 1~5에 걸쳐 구조가 크게 바뀌었으므로(단일 `app.py` → 레이어드 구조), 사용자가 체감하는 기능이 하나도 안 바뀌었는지 전체적으로 재확인한다.

### 6-1. 인증 흐름

- [ ] 로그인 페이지(`/`) 정상 표시
- [ ] 정상 계정으로 로그인 성공 → `/dashboard`로 이동
- [ ] 잘못된 비밀번호로 로그인 실패 → 에러 메시지 표시, `logs/app.log`에 `로그인 실패` 기록
- [ ] 로그아웃 → 다시 로그인 페이지로 이동, `logs/app.log`에 `로그아웃` 기록
- [ ] 로그인 없이 `/dashboard` 직접 접속 시 로그인 페이지로 리다이렉트되는지 (`@login_required` 정상 동작)

### 6-2. 대시보드(UI) 회귀 — Step 1~9 결과물이 백엔드 구조 변경과 무관하게 그대로인지

- [ ] 사이드바 트리(회계관리/세금계산서관리 등) 정상 표시, 펼침/접힘 정상
- [ ] 사이드바 토글 버튼(`◀`/`▶`) 정상 동작
- [ ] 트리 클릭 시 탭 생성/중복방지/닫기 정상 동작
- [ ] 유형 A/B/C(계정등록/전표입력/거래처정보관리) 탭 각각 SplitLayout + AG Grid 정상 렌더링
- [ ] 검색조건 패널이 메뉴별로 다른 필드를 보여주는지(Step 6 수정 사항)

### 6-3. CSRF

- [ ] 로그인 폼 제출 정상 동작 (csrf_token 유효)
- [ ] 로그아웃 폼 제출 정상 동작

### 6-4. 상용ERP 연동

- [ ] `docker compose exec local-erp python -m db.test_prod_connection` 재실행 → 연결 성공
- [ ] `docker compose exec local-erp python -m service.test_approval_service` 재실행 → 365일치 기안 조회 성공, `logs/app.log`에 조회 시작/완료 로그 기록

### 6-5. 인프라

- [ ] `docker compose ps`로 `local-erp` 컨테이너 `Up` 상태 확인
- [ ] 컨테이너 재시작(`docker compose restart local-erp`) 후에도 기능 정상
- [ ] `logs/app.log` 파일 크기가 5MB를 넘으면 로테이션되는지는 지금 당장 확인 어려움 — 장기 운영 중 자연스럽게 확인 (즉시 검증 불필요)

### 6-6. 코드 정합성 최종 확인

- [ ] `db_legacy_backup.py`, 예전 `dashboard.html` 등 더 이상 안 쓰는 파일들이 어디서도 import되지 않는지 (검색: `grep -rn "db_legacy_backup\|dashboard.html" ~/project/local_erp --include=*.py --include=*.html`)
- [ ] `requirements.txt`에 실제로 쓰이는 패키지만 있는지 (Flask, Flask-WTF, psycopg, psycopg-pool, bcrypt)

---

> 6-1~6-4는 실제로 클릭/실행해보며 확인이 필요한 항목이고, 6-5~6-6은 코드/설정 확인 위주이다.
> 6-1부터 순서대로 진행하고, 각 항목 결과를 알려주시면 문제 있는 부분만 짚어서 수정하겠다.
