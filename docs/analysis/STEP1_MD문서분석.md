# STEP 1. MD 문서 전수 분석 (완료)

> 이 파일은 분석 단계 원본 상세 기록입니다. 요약은 메인 문서(`../ERP_개발계획서.md`)의
> "전체 흐름 요약" 섹션을 참고하세요. 이 파일은 근거자료(raw finding) 성격으로,
> 이후 STEP 8(개발계획서 최종 작성) 시 `../toc/*.md` 각 챕터에 재배치됩니다.

분석 대상 md 파일 (총 17개, `search_files **/*.md` 기준):

```
erp_backend_migration_plan.md
erp_ui_next_steps.md
erp_ui_progress.md
erp_ui_step8_9_plan.md
frontend_content_renderers_refactor_plan.md
future_considerations.md
login_flow.md
logs/README.md
main_py_migration_structure_review.md
new_menu_dev_guide.md
plans/admin_settings/00_overview.md
plans/admin_settings/01_sidebar_button.md
plans/admin_settings/02_backend.md
plans/admin_settings/03_frontend.md
plans/admin_settings/04_schema_proposal.md
plans/admin_settings/admin_settings_flow.md
plans/profit_payment_date_search_button_plan.md
```

## 1-1. 문서 맵 (역할 요약)

| 파일 | 역할 |
|---|---|
| `erp_ui_progress.md` | UI Step 1~9 실제 진행 기록 (완료분) |
| `erp_ui_next_steps.md` | UI Step 계획 원본 (상태 갱신 누락 있음 — 문서상 "예정"이지만 실제로는 완료) |
| `erp_ui_step8_9_plan.md` | Step 8(레이아웃 연결)/9(AG Grid 연동) 상세 실행 계획 + 결과 |
| `erp_backend_migration_plan.md` | 백엔드 레이어드 아키텍처(routes→service→repository→db) 설계/결정사항, Phase 0~7 진행 기록 |
| `frontend_content_renderers_refactor_plan.md` | content-renderers.js 도메인별 분리 리팩터링 전체 기록 + 발견된 버그 수정 |
| `login_flow.md` | 로그인~대시보드 요청/응답 흐름 상세 (파일·함수 단위) |
| `plans/admin_settings/*.md` | 관리자 설정(admin_settings) 화면 구현 계획/스키마 제안 (0~4단계) |
| `main_py_migration_structure_review.md` | 상용 Odoo `main.py`(3,565줄) 반영 시 구조 재검토 |
| `new_menu_dev_guide.md` | 신규 메뉴(`profit_loss` 예시) 추가 시 파일별 작업 가이드 (18개 항목) |
| `future_considerations.md` | 전체 문서 종합, 향후 체크리스트 + 미해결 이슈 모음 |

## 1-2. 백엔드 아키텍처 마이그레이션 (`erp_backend_migration_plan.md`)

- **목적**: 기존 `app.py` 하나에 라우팅+인증+DB 접근이 섞여 있던 구조를 `routes(프레젠테이션) → service(비즈니스 로직) → repository(쿼리) → db(접속 계층)` 4단 레이어드 구조로 전환.
- **DB 라이브러리**: psycopg + psycopg_pool 직접 사용 유지 (SQLAlchemy 전환 안 함).
- **상용DB의 실체**: 사내에서 별도 운영 중인 상용 ERP(Odoo)의 PostgreSQL DB. 조회 전용으로만 사용.
  - 2겹 방어: ① 코드 레벨 — `ReadOnlyConnection`이 `fetch_all()`/`fetch_one()`만 제공, DML 메서드 없음. ② DB 계정 레벨 — SELECT 권한만 있는 조회 전용 계정.
- **Blueprint 구조**: `auth_bp`("auth", 루트), `erp_bp`("erp", 루트), `admin_bp`("admin", `/admin` prefix).
- **버전관리**: git 미사용, Phase 진입 전 폴더 전체 백업으로 대체.
- **Repository/Service 확장 원칙**: 도메인 기반, 필요할 때마다 추가 (미리 스텁 생성 안 함). 실제 첫 도메인은 `approval`(기안/전자결재).
- **로깅**: 표준 `logging` 모듈(`RotatingFileHandler`, 5MB×5개), Docker 볼륨(`./logs:/app/logs`)으로 보존.
- **Phase 진행 상태**: 0~5 완료, 6(전체 회귀 검증) 진행 중, 7(문서화) 진행 중.
- **호출 체인 예시 (approval 도메인, 상용DB 조회)**:
  ```
  service/test_approval_service.py
      -> service/approval_service.py (get_recent_completed_approvals)
      -> repository/approval_repository.py (find_completed_approvals, get_prod_db_connection)
      -> db/prod_db.py (ProdDBSettings 접속)
      -> 사내 상용 ERP(Odoo)의 PostgreSQL
  ```

## 1-3. Frontend UI 스켈레톤 (`erp_ui_progress.md`, `erp_ui_next_steps.md`, `erp_ui_step8_9_plan.md`)

- **기술스택**: Flask + Jinja2 / PostgreSQL / AG Grid Community / Vanilla JS.
- **Step 1~9 전체 완료** (문서 상태 표기 오류 있었음 — `erp_ui_next_steps.md`는 6~9를 "예정"으로 표기하지만 실제로는 전부 완료).

| Step | 내용 | 상태 |
|---|---|---|
| 1 | 3분할 CSS Grid 뼈대(사이드바/상단바+탭바/메인/상태바) | 완료 |
| 2 | 좌측 트리메뉴(3단계, Jinja2 재귀 매크로) + 펼침/접힘 | 완료 |
| 3 | 사이드바 토글(접기/펴기) 버튼 | 완료 |
| 4 | 탭 매니저(트리 클릭 → 탭 생성/중복방지/닫기/전환) | 완료 |
| 5 | 상단 마스터바 툴바 버튼 | 완료 |
| 6 | CollapsibleSearchPanel(검색조건 접기/펴기) | 완료 |
| 7 | SplitLayout 엔진(재귀 트리, 드래그 리사이즈, 독립 스크롤) | 완료 (핵심 컴포넌트) |
| 8 | SCREEN_LAYOUTS + CONTENT_RENDERERS 연결 | 완료 |
| 9 | AG Grid Community 연동 | 완료 (9-6까지 브라우저 확인 대기 상태로 기록되었으나 이후 리팩터링 문서에서 실사용 확인됨) |

- **레이아웃 3유형**:
  - 유형 A(단일): 검색조건 + 그리드 1개 — 계정등록, 사업자등록번호, 세금계산서조회
  - 유형 B(상하 N단): 검색조건 + 헤더그리드 + 상세그리드 + 관리항목 폼 — 전표입력
  - 유형 C(좌우 2단): 검색조건 + 좌측 리스트그리드 + 우측 서브탭 폼 — 거래처정보관리, admin_settings
- **설계 원칙**: SplitLayout 엔진은 한 번만 작성하고 이후 절대 수정하지 않음. 화면 추가 시 `SCREEN_LAYOUTS`(레이아웃 트리)와 `CONTENT_RENDERERS`(contentId→렌더함수) 두 곳만 갱신.
- **트리 펼침/접힘**: 초기 max-height 트릭 → 중첩 아코디언 버그 발견 후 CSS Grid `grid-template-rows: 0fr↔1fr` 방식으로 전환(더 단순하고 견고).
- **SplitLayout 버그 수정 이력**: 검색조건 패널을 접었을 때 마지막 pane이 남는 공간을 못 흡수하던 버그 → 드래그 로직에서 마지막 pane은 고정 px 대신 `flex-grow` 유지하도록 수정.
- **AG Grid**: Community 버전만 사용 (Enterprise 기능—rowGroup, masterDetail, enableRangeSelection 등—의도적으로 미사용). CDN 방식(`ag-grid-community@31.0.0`) 로드.
- **key-value 폼**: 그리드가 아닌 상세/서브탭 화면(관리항목, 거래처 서브탭)은 `renderKeyValueForm()` 별도 렌더러로 처리.

## 1-4. content-renderers.js 리팩터링 (`frontend_content_renderers_refactor_plan.md`)

- **배경**: 단일 파일에 6개 메뉴 렌더링 로직이 모두 있어 비대화 문제 발생 (admin_settings 실 DB 연동 후 코드량 3~4배 증가가 계기).
- **최종 구조**:
  ```
  static/js/
  ├── api-fetch.js                 # 공통 apiFetch() 헬퍼 (eager)
  ├── admin-api.js                 # AdminAPI 계층 (eager)
  ├── content-renderers/
  │   ├── registry.js              # registerRenderer(), renderAgGrid, renderKeyValueForm, Formatters
  │   ├── accounting.js            # account_register, voucher_entry (eager)
  │   ├── tax-invoice.js           # tax_invoice_search, biz_reg_no, vendor_info (eager)
  │   └── admin.js                 # admin_settings (lazy loading 대상)
  ├── screen-layouts.js
  ├── split-layout.js
  ├── tab-manager.js               # async 전환 + Lazy Loading 로직 추가
  └── content-renderers.js.bak     # 원본 백업 (git 미사용 환경 고려)
  ```
- **네이밍 규칙**: `{menuKey}__{역할}_grid` (AG Grid) / `{menuKey}__{역할}_form` (key-value 폼). `registerRenderer()`가 정규식으로 검증, 어긋나면 콘솔 경고.
- **Lazy Loading**: `admin_settings`만 대상 (접근 빈도 낮고 코드량 큼). `tab-manager.js`의 `DOMAIN_SCRIPT_MAP` + `loadDomainScriptOnce()`로 최초 탭 오픈 시에만 동적 `<script>` 로드.
- **⚠️ 발견/수정된 전역 회귀 버그 (중요 — Reference 화면 분석 시 재확인 필요)**:
  1. `registerRenderer()` 도입으로 등록값이 함수(`fn`) → 객체(`{render: fn}`)로 변경됨.
  2. `split-layout.js`의 `renderContentInto()`가 여전히 `typeof entry === "function"`으로 체크 → 항상 거짓 → **사실상 모든 화면의 렌더러가 호출되지 않는 전역 버그** 발생. admin_settings는 실 DB 연동 화면이라 빈 화면이 눈에 띄었을 뿐, 다른 화면(더미 데이터)도 동일 문제를 겪고 있었음.
  3. `tab-manager.js`의 `isDomainRendererLoaded()`도 동일한 타입 체크 오류.
  4. **수정**: 두 함수 모두 `entry.render`가 함수인지 확인하는 방식으로 변경 (구버전 함수 직접 등록 방식도 폴백 지원).
  5. **재발 방지**: `registerRenderer()`가 `def.render`가 함수가 아니면 등록 자체를 막도록(`throw`) 처리.
- **추가 개선**: `apiFetch()`에 FormData(파일 업로드 대비) 지원 추가, 스크립트 로드 실패 시 재시도 가능하도록 캐시 처리 개선 + 사용자 폴백 메시지 표시.
- **미해결 항목(별도 라운드로 이월)**: Renderer Lifecycle(render/destroy) 미정의, 탭 반복 개폐 시 AG Grid 인스턴스/리스너 메모리 누수 미검증.

## 1-5. 로그인 흐름 (`login_flow.md`)

```
① 브라우저 GET localhost:8080/
② Docker 포트매핑 (nginx 미경유) → Flask 컨테이너
③ auth_bp.login_page() [routes/auth_routes.py] — session 없으면 login.html 렌더
④ 로그인 폼 제출 (JS 이벤트 없는 순수 HTML form POST)
⑤ auth_bp.login_process() [routes/auth_routes.py]
     → find_user_by_email() [repository/local_repository.py] → get_local_db_connection() [db/local_db.py]
     → verify_password() [auth.py] (bcrypt/werkzeug 혼용 판별)
     → session 저장 → redirect(url_for("erp.dashboard"))  (302, 함수 종료)
⑥ 브라우저 자동 GET /dashboard (완전히 새로운 요청)
⑦ @login_required 통과 → erp_bp.dashboard() [routes/erp_routes.py]
     → render_template("base.html", email, role, tree_menu=DUMMY_TREE_MENU)
⑧ base.html: {% include 'partials/_sidebar_tree.html' %} + CSS/JS 태그
⑨ _sidebar_tree.html: render_tree(tree_menu) 매크로 재귀 호출 → 완성된 HTML 삽입
⑩ 이후 전부 클라이언트 사이드 (트리클릭→TabManager→SplitLayout→AG Grid, 서버 재요청 없음)
```

- **중요 포인트**: DB 커넥션은 요청마다 새로 연결하는 게 아니라 앱 시작 시 `ConnectionPool`이 미리 연결을 맺어두고, 요청마다 빌렸다 반납(close 아님)하는 방식.
- Blueprint 변수명(`auth_bp`)과 등록 이름(`"auth"`, `url_for`가 참조)은 다른 개념 — `Blueprint("auth", __name__)`의 첫 인자가 실제 네임스페이스.

## 1-6. admin_settings 화면 계획 (`plans/admin_settings/*.md`)

- **범위**: Role 기반(admin/user) 뼈대만 우선 구현, 세부 권한 매트릭스(RBAC)는 설계안만 제안.
- **화면 구성**: 사이드바 하단 ⚙ 버튼 → "설정" 탭(SPA, 유형 C) → 좌측 사용자 목록(AG Grid) + 우측 서브탭(기본정보/권한정보).
- **API**: `GET /admin/users/list`(목록), `GET /admin/users/<id>`(상세, password 제외), `POST /admin/users/<id>/role`(변경, CSRF 필요).
- **레이어**: `routes/admin_routes.py` → `service/user_service.py`(ALLOWED_ROLES 화이트리스트 검증) → `repository/local_repository.py`(find_all_users, find_user_by_id, update_user_role) → `db/local_db.py`.
- **폴백 페이지**: `/admin/users` 직접 URL 접속 시에는 SPA 경로를 안 타고 `admin_users.html` 서버 렌더 폴백 사용.
- **🔴 미해결 보안 이슈**: 관리자 API에 `role == admin` 검증이 없음 — `@login_required`만 걸려 있어 일반 유저도 URL을 직접 호출하면 자기 자신을 admin으로 승격 가능. `@admin_required` 데코레이터 추가가 제안되었으나 아직 미적용.
- **스키마 확장 제안(미구현)**: `users.name/is_active/created_at/last_login_at` 컬럼, `user_login_history`(로그인 이력), `menu_permissions`(RBAC 매트릭스) 테이블 설계안.

## 1-7. profit_payment_date(지급기준손익) 화면 계획 (`plans/profit_payment_date_search_button_plan.md`)

- 백엔드(`repository/profit_analysis_repository.py`, `service/profit_analysis_service.py`, `routes/erp_routes.py`)는 구현 완료 상태. 이 문서는 프론트 "조회 버튼 → 데이터 반영" 배선만 다룸.
- **흐름**: 메뉴 클릭 → 탭 생성 + 빈 그리드 + 기본 지급일자로 1차 자동조회 → 상단 "조회" 버튼 클릭 → `toolbar.js`가 활성 탭 menuKey 판별 → `ScreenReloadHandlers[menuKey]` 호출 → `ProfitAnalysisAPI.getByPaymentDate()` → 상용ERP(Odoo) 조회 → `setGridOption("rowData", ...)`.
- **레지스트리 패턴**: `registerReload(menuKey, fn)`로 "조회" 버튼 재사용 함수를 등록해두는 방식 (admin_settings의 `listGridApi` 모듈 스코프 변수 패턴과 동일 계열).

## 1-8. 상용 Odoo `main.py` 반영 시 구조 재검토 (`main_py_migration_structure_review.md`)

- 대상 `main.py`: 3,565줄, 컨트롤러 7개 이상, 실제 업무 도메인 최소 9개(매출/매입/계약관리/손익조회/프로젝트수익/납품관리 등).
- **구조 변경 결정**: repository 분리 기준을 "함수5개/200줄"에서 **쿼리 복잡도 기준**으로 변경 (재귀/다중 CTE 쿼리는 1함수 1파일도 허용). 분석/리포팅성 쿼리는 특정 도메인 대신 `repository/analytics/`로 분리. `container_id` 분기는 if/elif 대신 dict 기반 레지스트리 패턴(`registerRenderer`와 동일 발상)으로.
- **진행 방식**: 전체 일괄 이관 아님, `approval` 도메인 때처럼 실제 필요한 화면부터 우선순위대로 하나씩.

## 1-9. 신규 메뉴 개발 가이드 요약 (`new_menu_dev_guide.md`)

새 메뉴 하나 추가 시 건드리는 파일(예시: `profit_loss`, 유형 A, 회계 도메인 가정):

```
1. menu_data.py                              — 트리 leaf 노드 추가
2. static/js/screen-layouts.js               — SCREEN_LAYOUTS에 레이아웃 추가
3. content-renderers/{도메인}.js              — registerRenderer() 추가 (신규 도메인이면 파일 신규 + base.html <script> 태그)
4. static/js/search-fields-config.js         — SEARCH_FIELDS_CONFIG 추가 (선택, 없으면 기본 폴백)
5. repository/{도메인}_repository.py          — 신규 (로컬DB or 상용DB 커넥션 함수 사용)
6. service/{도메인}_service.py                — 신규 (routes는 이 계층만 호출)
7. routes/{도메인}_routes.py + app.py 등록    — 신규 (app.py Blueprint 등록 누락이 가장 흔한 실수)
8. {도메인}-api.js + base.html <script>       — 신규 (apiFetch 기반)
```
`sidebar-tree.js`, `tab-manager.js`, `split-layout.js`, `search-panel.js`, `registry.js`(엔진 자체) 등은 **수정 불필요** — 이것이 이 프로젝트의 핵심 설계 원칙(엔진/설정 분리).

## 1-10. 향후 고려사항 종합 (`future_considerations.md`)

- 🔴 관리자 API role 검증 부재 (1-6 참고, 조치 제안 코드 있음)
- 🟡 새 메뉴/도메인 추가 체크리스트 (1-9와 동일 내용을 문서 간 상호 정리)
- 🟢 미해결: Renderer Lifecycle, 메모리 누수, `last_login_at`/`user_login_history`/`menu_permissions` 미구현, role 화이트리스트 하드코딩, 로그 로테이션 실측 미검증, 레거시 파일 정리 여부(`splitter.js`, `grid-init.js`, `db_legacy_backup.py`, `content-renderers.js.bak`, `base - 복사본.html` 등 보관 중)
- 🟢 운영 참고: 상용ERP 조회 부하 주의(365일 기본조회), 컨테이너 타임존(Asia/Seoul) 반영됨, 캐시버스팅(`ASSET_VERSION`) 쿼리스트링 누락 주의
