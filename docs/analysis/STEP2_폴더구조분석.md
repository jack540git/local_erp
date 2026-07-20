# STEP 2. 프로젝트 폴더 구조 분석 (완료)

> 실제 조사 방법: `list_directory` / `list_directory_with_sizes`로 전체 폴더를 재귀적으로 직접 순회하여 확인.
> 대상 루트: `E:\100_dev\local_erp`

## 2-1. 전체 트리 (실측)

```
local_erp/
├── .dockerignore
├── .env
├── 신규메뉴추가_가이드문서.xlsx
├── app.py                              [Flask 엔트리, Blueprint 등록]
├── auth.py                             [verify_password, login_required 데코레이터]
├── db_legacy_backup.py                 [레거시, 미사용 (future_considerations.md 확인됨)]
├── docker-compose.yml
├── Dockerfile
├── menu_data.py                        [DUMMY_TREE_MENU 트리 데이터]
├── requirements.txt
│
├── db/                                 ── DB 접속 계층
│   ├── __init__.py
│   ├── local_db.py                     [get_local_db_connection(), ConnectionPool]
│   ├── prod_db.py                      [get_prod_db_connection(), ReadOnlyConnection]
│   ├── settings.py                     [DB 접속 설정]
│   └── test_prod_connection.py         [상용ERP 접속 테스트 스크립트]
│
├── repository/                         ── 쿼리 계층
│   ├── __init__.py
│   ├── local_repository.py             [로컬DB: users 관련 쿼리]
│   ├── approval_repository.py          [상용DB: 기안(approval) 조회, ReadOnly]
│   └── profit_analysis_repository.py   [상용DB: 지급기준손익 조회]
│
├── service/                            ── 비즈니스 로직 계층
│   ├── __init__.py
│   ├── user_service.py                 [admin_settings: get_user_list/detail, change_user_role]
│   ├── approval_service.py             [기안 조회 비즈니스 로직 (날짜 계산 등)]
│   ├── profit_analysis_service.py      [지급기준손익 조회 비즈니스 로직]
│   └── test_approval_service.py        [테스트 스크립트]
│
├── routes/                             ── 라우팅(프레젠테이션) 계층
│   ├── __init__.py
│   ├── auth_routes.py                  [auth_bp: /, /login, /logout]
│   ├── erp_routes.py                   [erp_bp: /dashboard, 지급기준손익 API]
│   └── admin_routes.py                 [admin_bp(/admin): /users/*, role 변경 API]
│
├── utils/                              ── 공통 유틸
│   ├── __init__.py
│   └── logger.py                       [setup_logging(app), get_logger()]
│
├── templates/                           ── Jinja2 템플릿
│   ├── base.html                       [3분할 앱 셸, 전체 CSS/JS 로드]
│   ├── base - 복사본.html              [사용자 수동 백업본, 미사용 추정]
│   ├── login.html
│   ├── dashboard.html                  [구 버전 잔존, 미사용(코드에서 참조 제거됨)]
│   ├── admin_users.html                [admin_settings 직접 URL 접속 시 폴백 페이지]
│   └── partials/
│       └── _sidebar_tree.html          [Jinja2 재귀 매크로 트리 렌더]
│
├── static/
│   ├── css/
│   │   ├── layout.css                  [3분할 CSS Grid 뼈대, --sidebar-width 등 변수]
│   │   ├── sidebar.css                 [트리메뉴, 설정버튼 스타일]
│   │   ├── tabs.css                    [탭바 스타일]
│   │   ├── search-panel.css            [검색조건 접기/펴기 패널]
│   │   ├── split-layout.css            [SplitLayout 엔진 스타일]
│   │   ├── ag-grid-theme.css           [AG Grid 엑셀풍 테마 + kv-form 스타일]
│   │   ├── admin.css                   [admin_settings 전용 스타일]
│   │   └── toolbar.css                 [상단 마스터바 툴바]
│   │
│   ├── js/
│   │   ├── sidebar-tree.js             [트리 토글/선택, 설정버튼 클릭 → TabManager]
│   │   ├── tab-manager.js              [탭 생성/전환/닫기, Lazy Loading 로직]
│   │   ├── split-layout.js             [SplitLayout 엔진: 재귀 렌더, 드래그 리사이즈]
│   │   ├── screen-layouts.js           [SCREEN_LAYOUTS: menuKey→레이아웃 트리]
│   │   ├── search-fields-config.js     [SEARCH_FIELDS_CONFIG: menuKey→검색필드]
│   │   ├── search-panel.js             [CollapsibleSearchPanel 빌더]
│   │   ├── toolbar.js                  [상단 툴바 "조회" 등 버튼 → ScreenReloadHandlers]
│   │   ├── api-fetch.js                [공통 apiFetch() 헬�(CSRF/FormData 지원)]
│   │   ├── admin-api.js                [AdminAPI (apiFetch 기반)]
│   │   ├── profit-analysis-api.js      [ProfitAnalysisAPI (apiFetch 기반)]
│   │   ├── content-renderers.js.bak    [리팩터링 전 원본, 보관용]
│   │   ├── splitter.js                 [빈 파일, 레거시 잔존]
│   │   ├── grid-init.js                [빈 파일, 레거시 잔존]
│   │   ├── _unused_date-default-rule.js.bak  [미사용 백업]
│   │   │
│   │   └── content-renderers/          ── 도메인별 렌더러 (리팩터링 결과물)
│   │       ├── registry.js             [registerRenderer, renderAgGrid, renderKeyValueForm, Formatters]
│   │       ├── accounting.js           [account_register, voucher_entry]
│   │       ├── tax-invoice.js          [biz_reg_no, tax_invoice_search, vendor_info]
│   │       ├── profit-analysis.js      [profit_payment_date — Reference 화면 ①]
│   │       └── admin.js                [admin_settings — Reference 화면 ②, Lazy Loading 대상]
│   │
│   └── vendor/                         [현재 비어있음 — AG Grid는 CDN 방식으로 로드 중이라 미사용]
│
├── logs/
│   ├── app.log                         [RotatingFileHandler 로그 파일]
│   └── README.md
│
├── plans/                              ── 신규 기능 구현 계획 문서 (STEP 1에서 분석 완료)
│   ├── profit_payment_date_search_button_plan.md
│   └── admin_settings/
│       ├── 00_overview.md ~ 04_schema_proposal.md, admin_settings_flow.md
│
├── docs/                               ── ★ 이 개발계획서 자체가 위치한 폴더
│   ├── ERP_개발계획서.md
│   ├── analysis/
│   └── toc/
│
└── (루트에 흩어진 *.md 9개는 STEP 1에서 전수 분석 완료)
```

## 2-2. 폴더별 역할 요약표

| 폴더 | 레이어 | 역할 |
|---|---|---|
| `db/` | DB 접속 | 커넥션 풀/설정, 로컬DB(쓰기 가능) vs 상용DB(조회 전용 `ReadOnlyConnection`) 분리 |
| `repository/` | 쿼리 | SQL 실행 전담, `%s` 플레이스홀더 사용, 도메인별 파일 분리 |
| `service/` | 비즈니스 로직 | routes와 repository 사이 중개, 화이트리스트/날짜계산 등 로직 담당 |
| `routes/` | 프레젠테이션 | Blueprint 단위 라우팅, `@login_required` 적용 |
| `utils/` | 공통 유틸 | 로깅 설정 |
| `templates/` | 뷰(서버 렌더) | 최초 페이지 골격(`base.html`)만 서버 렌더, 이후는 SPA |
| `static/css`, `static/js` | 프론트 정적 자원 | 엔진(split-layout, tab-manager 등) + 설정(screen-layouts, search-fields-config) + 도메인별 렌더러(content-renderers/) 분리 구조 |
| `static/vendor/` | (미사용) | AG Grid는 CDN 로드라 실제로는 빈 폴더 |
| `logs/` | 런타임 로그 | Docker 볼륨 마운트 대상 |
| `plans/` | 기획 문서 | 신규 화면 구현 계획 (개발계획서의 근거 자료 중 하나) |
| `docs/` | 이 개발계획서 | 메인 + analysis + toc 3계층 |

## 2-3. 레거시/미사용 파일 (실측 확인, 삭제하지 않고 보관 중 — git 미사용 특성)

| 파일 | 상태 |
|---|---|
| `db_legacy_backup.py` | 미사용 (백업용) |
| `templates/dashboard.html` | 코드에서 참조 제거됨, 파일만 존재 |
| `templates/base - 복사본.html` | 사용자 수동 백업본 추정 |
| `static/js/content-renderers.js.bak` | 리팩터링 전 원본 |
| `static/js/splitter.js`, `static/js/grid-init.js` | 빈 파일 (Step 1 초기에 만든 자리표시자, 실제 구현은 다른 파일명으로 감) |
| `static/js/_unused_date-default-rule.js.bak` | 미사용 백업 |

## 2-4. 파일 규모 관찰

- 가장 큰 문서: `erp_ui_progress.md`(24.8KB), `frontend_content_renderers_refactor_plan.md`(21.9KB), `new_menu_dev_guide.md`(19.6KB) — 전부 STEP 1에서 이미 분석 완료.
- 가장 큰 JS: `content-renderers.js.bak`(17.2KB, 미사용 원본), 실제 사용 중인 `content-renderers/*.js`는 도메인별로 4.6~7.6KB로 분산됨 (리팩터링 목적 달성 확인).
- Backend 코드는 파일당 대체로 작음(1~2KB 내외) — 레이어드 구조가 실제로 코드를 잘게 분리하고 있음을 사이즈로도 확인.
