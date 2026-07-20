# 향후 고려사항 & 메뉴/도메인 추가 시 체크리스트

> 프로젝트의 모든 md 문서(`erp_ui_*`, `erp_backend_migration_plan.md`, `frontend_content_renderers_refactor_plan.md`,
> `login_flow.md`, `plans/admin_settings/*.md`)를 전수 검토해서, 앞으로 새 메뉴/도메인을 추가할 때 챙겨야 할 것과
> 아직 해결되지 않은 채 남아있는 항목을 한 곳에 모은 문서. 각 항목의 근거 문서를 괄호로 표기.

---

## 1. 🔴 지금 당장 검토가 필요한 보안 이슈

### 1-1. 관리자 API에 role 검증이 전혀 없음 (`plans/admin_settings/02_backend.md`, `routes/admin_routes.py`)

`/admin/users`, `/admin/users/<id>/role` 등 관리자 라우트는 현재 `@login_required`만 걸려있고 **role이 `admin`인지 확인하는 로직이 없다.** 즉 `role='user'`로 로그인한 아무 계정이나 다음 요청을 직접 보내면 자기 자신을 admin으로 바꿀 수 있다:

```bash
POST /admin/users/<자기id>/role   { "role": "admin" }
```

UI(사이드바 설정 버튼)는 숨겨져 있어도, **URL을 직접 알면 우회 가능**하므로 UI 숨김은 방어책이 안 된다. `plans/admin_settings/02_backend.md`에도 "`@admin_required` 데코레이터 추가는 다음 단계 후보"라고 명시만 되어있고 실제로 추가되지 않은 상태.

**조치 제안**: `auth.py`에 아래와 같은 데코레이터를 추가하고 `admin_routes.py`의 4개 라우트 전부에 적용.
```python
def admin_required(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        if session.get("role") != "admin":
            return jsonify({"error": "forbidden"}), 403
        return view_func(*args, **kwargs)
    return wrapped
```

### 1-2. 상용ERP는 이중 방어 확인됨 (양호) — 참고용

`db/prod_db.py`의 `ReadOnlyConnection`이 `fetch_all`/`fetch_one`만 노출하고 DML 메서드 자체가 없음 + DB 계정 권한 분리 권장까지 문서화되어 있음(`erp_backend_migration_plan.md` 1-3절). **이 패턴은 새 상용DB 도메인을 추가할 때도 그대로 유지할 것.**

---

## 2. 🟡 새 메뉴(화면) 추가 시 체크리스트

`erp_ui_next_steps.md`, `frontend_content_renderers_refactor_plan.md`를 종합하면, 새 메뉴 하나를 추가할 때 손대야 할 파일은 아래 6곳뿐이다 (엔진 코드는 절대 수정하지 않는 게 원칙).

| # | 파일 | 할 일 |
|---|---|---|
| 1 | `menu_data.py` | 트리에 `{"type": "file", "label": "...", "key": "새menuKey"}` 추가 |
| 2 | `static/js/search-fields-config.js` | `SEARCH_FIELDS_CONFIG["새menuKey"]`에 검색조건 필드 배열 추가 (없으면 `SEARCH_FIELDS_DEFAULT`로 폴백) |
| 3 | `static/js/screen-layouts.js` | `SCREEN_LAYOUTS["새menuKey"]`에 레이아웃 트리(유형 A/B/C 중 선택) 추가 |
| 4 | `static/js/content-renderers/{도메인}.js` | 해당 도메인 파일에 `registerRenderer("새menuKey__역할_grid 또는 _form", { render(el){...} })` 추가. **새 업무 도메인이면 파일 자체를 새로 생성** (`content-renderers/registry.js` 로드 이후, `base.html`에 `<script>` 태그 추가) |
| 5 | `base.html` | 신규 도메인 파일이면 `<script>` 태그 추가(+ `?v={{ ASSET_VERSION }}` 캐시버스팅 반드시 붙일 것) — 접근 빈도 낮은 화면이면 eager 대신 `tab-manager.js`의 `DOMAIN_SCRIPT_MAP`에 등록해서 Lazy Loading 고려 |
| 6 | (실 DB 연동 시) `repository/{도메인}_repository.py` → `service/{도메인}_service.py` → `routes/`에 API 라우트 | `approval`/`user` 도메인과 동일한 레이어드 패턴 재사용 |

### 2-1. contentId 네이밍 규칙 (반드시 지킬 것)

```
{menuKey}__{역할}_grid   ← AG Grid 콘텐츠
{menuKey}__{역할}_form   ← key-value 폼 콘텐츠
```

`registry.js`의 `registerRenderer()`가 이 정규식(`^[a-z0-9_]+__[a-z0-9]+_(grid|form)$`)에 안 맞으면 콘솔 경고를 띄우니, 경고가 뜨면 네이밍부터 재확인.

### 2-2. 레이아웃 유형 선택 기준

| 유형 | 언제 쓰나 | 예시 |
|---|---|---|
| A (단일) | 검색 → 목록 하나만 있는 화면 | 계정등록, 사업자등록번호 |
| B (상하 N단) | 헤더-상세 관계가 있는 입력 화면 | 전표입력 (헤더그리드+상세그리드+관리항목폼) |
| C (좌우 2단) | 목록에서 골라서 상세를 보는/편집하는 화면 | 거래처정보관리, 관리자 설정(admin_settings) |

### 2-3. Renderer 등록 시 중복 방지가 자동으로 걸린다

`registerRenderer()`는 이미 등록된 `contentId`를 다시 등록하려 하면 즉시 `throw`한다. 새 화면 추가 중 이 에러가 뜨면 다른 화면과 contentId가 겹쳤다는 뜻이니 네이밍부터 재확인.

### 2-4. Lazy Loading 대상 여부 판단

`admin_settings`처럼 **접근 빈도가 낮고 실 DB 연동이라 코드량이 큰 화면**만 Lazy Loading 대상으로 삼는다 (`frontend_content_renderers_refactor_plan.md` 5절 — "메뉴 15~20개 이상으로 늘어날 때 accounting.js/tax-invoice.js도 재검토"). 지금처럼 메뉴가 적을 때는 대부분 eager 로드가 낫다.

---

## 3. 🟡 새 백엔드 도메인 추가 시 체크리스트 (approval/user 패턴 재사용)

`erp_backend_migration_plan.md` 2-1절 + `plans/admin_settings/02_backend.md`를 종합.

1. **어느 DB인지 먼저 결정**: 우리가 쓰고 조회하는 로컬DB(myappdb, 읽기/쓰기 가능) vs 사내 상용ERP(PostgreSQL, 조회 전용 강제)
2. `repository/{도메인}_repository.py` 생성 — 로컬이면 `get_local_db_connection()`, 상용이면 `get_prod_db_connection()`만 사용
3. 검색조건이 여러 개 섞이는 화면이면 **동적 WHERE절 패턴** 사용 (조건절 문구만 동적 조립, 값은 항상 `%s`로 전달 — `repository/approval_repository.py`의 `find_completed_approvals()` 참고)
4. `service/{도메인}_service.py` 생성 — routes는 반드시 이 계층만 호출, repository를 직접 호출하지 않음
5. `routes/` 라우트 추가 — 기존 Blueprint(`erp_bp`/`admin_bp`) 안에 추가할지, 도메인이 커지면 별도 Blueprint(`routes/api_routes.py` 등)로 분리할지 규모 보고 판단
6. `SELECT` 절에 민감정보(비밀번호 등) 포함 여부 항상 재확인 — `find_all_users()`처럼 처음부터 SELECT 절에서 제외
7. 미리 스텁을 만들어두지 않는다 — **실제 필요해지는 시점에 그 도메인 이름으로 생성** (이미 확립된 원칙)

### 3-1. 상용DB 도메인이 늘어날 때 — Repository 파일 비대화 대응 방안

`approval_repository.py`처럼 상용DB 쿼리 도메인이 계속 늘어나면, 이 원칙을 단계적으로 적용한다.

**원칙: 쿼리는 반드시 repository 계층에만 둔다 (service로 옮기지 않는다).** 파일 크기 문제는 계층을 바꾸는 게 아니라 같은 계층 안에서 세분화하는 방식으로 해결한다.

| 상황 | 조치 |
|---|---|
| 도메인 쿼리 함수 5개 이하 | 지금처럼 단일 파일 유지 (`repository/{도메인}_repository.py`) |
| 도메인 쿼리 함수 6개 이상 또는 파일 200줄 이상 | 패키지로 승격: `repository/{도메인}/__init__.py`가 공개 인터페이스(re-export) 역할, 내부는 `list.py`/`detail.py` 등으로 기능별 분리. **`content-renderers/{도메인}.js` + `registry.js`와 동일한 패턴** — service 임포트 경로는 거의 안 바뀌고 내부만 세분화됨 |
| 여러 도메인에서 동적 WHERE절 보일러플레이트 반복 | `db/query_utils.py`에 `build_where(conditions_map)` 같은 공통 헬퍼로 추출 |
| 단일 쿼리 자체가 조인이 많아 매우 길어짐 | (선택) 그 쿼리만 `.sql` 파일로 분리해서 읽어오는 것도 가능하나, 지금 규모에서는 오버엔지니어링이라 권장 안 함 |

**패키지 승격 예시**:
```
repository/
└── approval/
    ├── __init__.py       # from .list import find_completed_approvals 등으로 공개 인터페이스 유지
    ├── list.py           # 목록 조회 관련 쿼리
    ├── detail.py         # 단건 조회 관련 쿼리
    └── attachment.py     # 첨부파일 관련 기능이 생기면 추가
```
이렇게 하면 `service/approval_service.py`의 `from repository.approval_repository import ...`가 `from repository.approval import ...`로 **경로만 한 번 바뀔 뿐**, 그 이후 내부 파일이 몇 개로 늘어나든 service 코드는 전혀 수정할 필요 없다.

---

## 4. 🟢 알려져 있으나 아직 미해결인 항목 (재검토 필요 시점 되면 진행)

| 항목 | 근거 문서 | 내용 |
|---|---|---|
| Renderer Lifecycle(`render`/`destroy`) 미정의 | `frontend_content_renderers_refactor_plan.md` 8장 | 렌더러가 `render(el)`만 있고 정리 함수가 없음. 탭을 반복해서 열고 닫으면 AG Grid 인스턴스/리스너가 누적될 가능성 |
| 메모리 누수 미검증 | 〃 | `closeTab()`이 `pane.remove()`만 함. `admin.js`의 모듈 스코프 변수(`listGridApi` 등)도 정리 안 됨. Chrome DevTools Heap Snapshot 실측 필요 |
| `last_login_at` 컬럼 미존재 | `plans/admin_settings/04_schema_proposal.md` | 로그인 성공 시각을 저장할 컬럼이 없음. 스키마 확장안은 나와 있으나 마이그레이션 미적용 |
| `user_login_history`, `menu_permissions` 테이블 | 〃 | 현재 로그인 상태 추적, 메뉴별 세부 권한(RBAC)을 위한 설계만 있고 미구현. `menu_data.py`가 DB 기반으로 바뀌는 시점에 `menu_permissions`도 같이 연동 예정 |
| `role` 화이트리스트가 하드코딩 | `service/user_service.py`(`ALLOWED_ROLES = {"admin", "user"}`) | role 종류가 늘어나면 테이블화 고려 |
| `erp_ui_next_steps.md`의 Step 상태가 실제와 불일치 | `erp_ui_next_steps.md` | Step 6~9가 전부 "예정"으로 남아있으나 실제로는 전부 완료됨(`erp_ui_progress.md`엔 반영됨). 문서 최신화 필요 |
| 레거시 빈 파일 정리 여부 | `static/js/splitter.js`, `static/js/grid-init.js`, `db_legacy_backup.py`, `content-renderers.js.bak`, `templates/admin_users.html`(폴백 페이지로 실제 사용 중이니 이건 유지), `templates/base - 복사본.html` | 동작에는 영향 없으나 git 미사용 환경이라 삭제 대신 보관 중. 정리 시점 판단 필요 |
| 로그 로테이션 5MB 도달 여부 | `erp_backend_progress.md`(있었다면) / Phase 6 검증 | 아직 5MB를 실제로 넘겨본 적이 없어 로테이션 동작 자체는 미검증. 장기 운영 중 자연 확인 대상 |

---

## 5. 🟢 운영/성능 관련 참고사항

- **상용ERP 조회 부하**: `approval_service`류 함수가 기본적으로 넓은 기간(365일 등)을 조회하도록 되어 있으면 상용ERP에 부하를 줄 수 있음. `PROD_DB_STATEMENT_TIMEOUT`(현재 5000ms)이 안전장치이긴 하나, 실제 데이터량 확인 후 기본 조회 기간을 줄이는 걸 검토 (`erp_backend_migration_plan.md` 7절)
- **컨테이너 타임존**: `Dockerfile`에 `TZ=Asia/Seoul` + `tzdata` 설치를 반영해서 로그 시각이 호스트와 일치하도록 이미 고쳐짐. **새로 이미지를 만들 때(예: 별도 배치 컨테이너 등)도 이 설정을 빠뜨리지 않을 것.**
- **캐시버스팅(`ASSET_VERSION`)**: 정적 파일(css/js)을 고칠 때마다 `base.html`의 `?v={{ ASSET_VERSION }}` 쿼리스트링이 자동으로 값을 바꿔주므로 브라우저 캐시 걱정은 없음. **단, 새 정적 파일을 `base.html`에 추가할 때 이 쿼리스트링 붙이는 걸 빠뜨리지 말 것** (실제로 리팩터링 중 한 번 누락된 전례 있음).
- **Docker 볼륨**: `logs/`만 마운트되어 있음. 향후 파일 업로드 기능(예: 거래처 사업자등록증 첨부 — `api-fetch.js`가 FormData 지원을 이미 선제적으로 반영해둠, `frontend_content_renderers_refactor_plan.md` 9-4절)이 생기면 업로드 파일 저장 경로도 볼륨 마운트 검토 필요.

---

## 6. 문서 맵 (이 프로젝트의 md 파일이 각각 무엇을 담당하는지)

| 파일 | 역할 |
|---|---|
| `erp_ui_progress.md` | UI Step 1~9 실제 진행 기록 (완료분) |
| `erp_ui_next_steps.md` | UI Step 계획 원본 (상태 갱신 누락 있음, 4장 참고) |
| `erp_ui_step8_9_plan.md` | Step 8/9 상세 실행 계획 + 결과 |
| `erp_backend_migration_plan.md` | 백엔드 레이어드 아키텍처 설계/결정사항 |
| `frontend_content_renderers_refactor_plan.md` | content-renderers.js 분리 리팩터링 전체 기록 (버그 수정 포함) |
| `login_flow.md` | 로그인~대시보드 요청/응답 흐름 상세 (파일·함수 단위) |
| `plans/admin_settings/*.md` | 관리자 설정 화면 구현 계획/스키마 제안 |
| **`future_considerations.md`(이 문서)** | 위 전체를 종합한 향후 검토사항 + 메뉴/도메인 추가 체크리스트 |

새 기능을 계획할 때는 이 문서에서 관련 항목을 먼저 확인하고, 완료되면 해당 섹션에 완료 표시하거나 지워나가는 방식으로 유지 관리할 것을 제안한다.
