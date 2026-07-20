# 신규 업무 메뉴 추가 개발 가이드 (실제 코드 기준)

> 이 문서는 이론이 아니라 **local_erp 프로젝트의 실제 소스코드**(app.py, routes/, service/, repository/, db/,
> static/js/, templates/)를 전수 확인하고 작성했습니다. 새 구조를 제안하지 않고, **지금 admin_settings /
> voucher_entry / vendor_info가 실제로 구현된 방식을 그대로 재사용**하는 걸 전제로 합니다.
>
> 예시 메뉴로 **"손익관리"**(menuKey: `profit_loss`)를 기준으로 작성했습니다. 손익관리는 회계 도메인이므로
> `content-renderers/accounting.js`(기존 파일)에 추가하는 걸 기본 시나리오로 삼되, 완전히 새로운 도메인일 경우의
> 차이점도 각 항목의 "비고"에 함께 적었습니다.

---

## 0. 먼저 결정해야 할 것 — 이 메뉴가 어떤 성격인지

| 질문 | 답에 따라 달라지는 것 |
|---|---|
| 로컬DB(myappdb)를 쓰는가, 사내 상용ERP(Odoo)를 조회하는가? | repository가 `get_local_db_connection()`을 쓸지 `get_prod_db_connection()`을 쓸지 결정 (7~9번 항목) |
| 화면이 그리드 1개(유형 A)인가, 상하 분할(유형 B, 전표입력 참고)인가, 좌우+서브탭(유형 C, 거래처정보관리 참고)인가? | `screen-layouts.js`에 넣을 트리 모양 결정 (3번 항목) |
| 접근 빈도가 낮아서 초기 로딩에서 빼고 싶은가(admin_settings처럼)? | eager 로드(기본) vs Lazy Loading(`tab-manager.js`의 `DOMAIN_SCRIPT_MAP`) 결정 (4, 7번 항목) |
| 기존 도메인(회계/세금계산서/관리자) 중 하나에 속하는가, 완전히 새 도메인인가? | 기존 `content-renderers/*.js` 파일에 추가할지, 새 파일을 만들지 결정 (4번 항목) |

"손익관리"는 로컬DB 신규 테이블 대상, 유형 A(단일 그리드), eager 로드, 회계 도메인(accounting.js)로 가정합니다.

---

## 1. 메뉴 생성

| 구분 | 관련 파일 | 작업 내용 | 관련 함수 | 참고 구현 위치 | 비고 |
|---|---|---|---|---|---|
| 메뉴 생성 | `menu_data.py` | `DUMMY_TREE_MENU` 리스트 안, 적절한 폴더의 `children`에 `{"type": "file", "label": "손익관리", "key": "profit_loss"}` 추가 | `DUMMY_TREE_MENU` (변수, 함수 아님) | `"회계관리" > "기초자료등록"` 하위에 `account_register`/`biz_reg_no`가 추가된 방식, 또는 `"세금계산서관리"`에 `vendor_info`가 나중에 추가된 사례 | `sidebar-tree.js`는 재귀 매크로/재귀 함수 구조라 **수정 불필요** |

**구현 상태**: ■ 신규 구현 (`menu_data.py` 데이터 추가만) / `sidebar-tree.js`는 ■ 구현 불필요

---

## 2. 메뉴 클릭

| 구분 | 관련 파일 | 작업 내용 | 관련 함수 | 참고 구현 위치 | 비고 |
|---|---|---|---|---|---|
| 메뉴 클릭 | `static/js/sidebar-tree.js`, `static/js/tab-manager.js` | 없음 (완전 공통 처리) | `sidebar-tree.js`의 `selectLeaf()` → `window.TabManager.openTab(menuKey, title)` 호출 → `tab-manager.js`의 `openTab()` | 기존 6개 메뉴(계정등록/전표입력/사업자등록번호/세금계산서조회/거래처정보관리/설정) 전부 이 경로 | `selectLeaf()`가 `leafEl.dataset.menuKey`와 `.tree-label` 텍스트를 그대로 읽어서 넘기므로, 1번에서 `menu_data.py`에 `key: "profit_loss"`만 추가하면 자동으로 동작 |

**구현 상태**: ■ 구현 불필요 (기존 공통 로직 그대로 재사용)

---

## 3. Layout 생성

| 구분 | 관련 파일 | 작업 내용 | 관련 함수 | 참고 구현 위치 | 비고 |
|---|---|---|---|---|---|
| Layout 생성 | `static/js/screen-layouts.js` | `window.SCREEN_LAYOUTS` 객체에 `"profit_loss": { type: "pane", contentId: "profit_loss__main_grid" }` 추가 (유형 A인 경우) | `SCREEN_LAYOUTS` (객체, `SplitLayout.render()`가 읽음) | 유형 A: `account_register`. 유형 B(상하분할): `voucher_entry`. 유형 C(좌우+서브탭): `vendor_info`, `admin_settings` | `contentId` 네이밍 규칙 **반드시 준수**: `{menuKey}__{역할}_grid` 또는 `_form` (`frontend_content_renderers_refactor_plan.md` 3장). `split-layout.js`는 **절대 수정 안 함** |

**구현 상태**: ■ 신규 구현 (레이아웃 선언 몇 줄) / `split-layout.js`(엔진)는 ■ 구현 불필요

---

## 4. Renderer 등록

| 구분 | 관련 파일 | 작업 내용 | 관련 함수 | 참고 구현 위치 | 비고 |
|---|---|---|---|---|---|
| Renderer 등록 | `static/js/content-renderers/accounting.js` (기존 도메인 파일에 추가) 또는 신규 `content-renderers/profit-loss.js` | `registerRenderer("profit_loss__main_grid", { render: function(el) {...} })` 추가 | `registerRenderer()` (등록 함수, `registry.js`에 정의) | `account_register__main_grid` 렌더러 (`accounting.js` 안) | 같은 회계 도메인이면 `accounting.js`에 추가 권장(완전히 새 도메인이면 새 파일). 신규 파일이면 **`templates/base.html`에 `<script src="...content-renderers/파일명.js">` 태그 추가 필수** (eager) 또는 **`tab-manager.js`의 `DOMAIN_SCRIPT_MAP`에 등록**(lazy, `admin_settings` 참고) |

**구현 상태**: ■ 신규 구현 / `registry.js`의 `registerRenderer()` 자체는 ■ 구현 불필요(기존 함수 호출만)

> ⚠️ **주의(2026-07 발견된 실제 버그)**: `registerRenderer()`로 등록하는 값은 반드시 `{ render: function(el) {...} }` **객체** 형태여야 합니다. `split-layout.js`의 `renderContentInto()`가 이 형태를 기준으로 호출하도록 이미 수정되어 있으므로(`frontend_content_renderers_refactor_plan.md` 9-6장 참고), 예전처럼 함수를 직접 대입(`window.ScreenContentRenderers["xxx"] = function(el){...}`)하면 안 됩니다.

---

## 5. Grid 생성

| 구분 | 관련 파일 | 작업 내용 | 관련 함수 | 참고 구현 위치 | 비고 |
|---|---|---|---|---|---|
| Grid 생성 | `static/js/content-renderers/registry.js` | 없음 — 4번의 renderer 함수 안에서 `renderAgGrid(el, columnDefs, rowData, gridOptionsExtra)`를 호출만 함 | `renderAgGrid()` | `account_register__main_grid`, `admin_settings__list_grid`(실 API 연동 예시) | `el`에 `ag-theme-alpine`/`ag-theme-erp` 클래스 자동 부여, `agGrid.createGrid()` 호출까지 함수 안에서 처리됨. Grid API 객체(`listGridApi` 등)가 필요하면(행 클릭, 갱신 등) 반환값을 변수에 저장 |

**구현 상태**: ■ 구현 불필요 (기존 함수 호출만, 함수 자체 수정 없음)

---

## 6. API

| 구분 | 관련 파일 | 작업 내용 | 관련 함수 | 참고 구현 위치 | 비고 |
|---|---|---|---|---|---|
| API | 신규 `static/js/profit-loss-api.js` | `window.ProfitLossAPI = { list: function(){...}, detail: function(id){...}, save: function(id,data){...} }` 형태로 작성, 내부에서 전부 `apiFetch()` 호출 | `apiFetch()`(공통 헬퍼, 신규 구현 안 함), `ProfitLossAPI.list()` 등(신규) | `admin-api.js`(`AdminAPI.listUsers()`/`getUser()`/`updateRole()` 패턴 그대로) | `templates/base.html`에 `<script src="...js/profit-loss-api.js">` 추가 필요 (`api-fetch.js`보다 뒤, renderer 파일보다 앞) |

**구현 상태**: ■ 신규 구현 (도메인 API 파일) / `apiFetch()`(`api-fetch.js`)는 ■ 구현 불필요

---

## 7. Backend Route

| 구분 | 관련 파일 | 작업 내용 | 관련 함수 | 참고 구현 위치 | 비고 |
|---|---|---|---|---|---|
| Backend Route | 신규 `routes/profit_loss_routes.py` | `profit_loss_bp = Blueprint("profit_loss", __name__)` 생성 후 `/list`, `/<int:id>` 등 라우트 정의. **`app.py`에 import + `app.register_blueprint(profit_loss_bp, url_prefix="/profit-loss")` 추가 필수** | `@profit_loss_bp.route(...)` | `routes/admin_routes.py`(`user_list_api()`, `user_detail_api()`, `user_role_update_api()` 패턴), `app.py`의 기존 3개 Blueprint 등록부 | 모든 라우트에 `@login_required`(`auth.py`) 적용. `app.py` 수정을 빠뜨리면 라우트 자체가 등록 안 됨(404) — **가장 놓치기 쉬운 지점** |

**구현 상태**: ■ 신규 구현 (`routes/profit_loss_routes.py` + `app.py` 수정)

---

## 8. Service

| 구분 | 관련 파일 | 작업 내용 | 관련 함수 | 참고 구현 위치 | 비고 |
|---|---|---|---|---|---|
| Service | 신규 `service/profit_loss_service.py` | `get_profit_loss_list()`, `get_profit_loss_detail(id)` 등 — routes는 이 함수만 호출, repository를 직접 호출하지 않음 | 함수명은 자유(도메인에 맞게) | `service/user_service.py`(단순 위임 패턴), `service/approval_service.py`(날짜 계산 등 비즈니스 로직을 service가 책임지는 패턴) | routes → service → repository → db, 4단 구조를 그대로 유지 (`erp_backend_migration_plan.md` 기준) |

**구현 상태**: ■ 신규 구현

---

## 9. Repository

| 구분 | 관련 파일 | 작업 내용 | 관련 함수 | 참고 구현 위치 | 비고 |
|---|---|---|---|---|---|
| Repository | 신규 `repository/profit_loss_repository.py` | `find_profit_loss_list()` 등 — SQL은 전부 `%s` 플레이스홀더 사용 | 함수명 자유 | 로컬DB 대상: `repository/local_repository.py`. 상용ERP(Odoo) 대상: `repository/approval_repository.py`(`get_prod_db_connection()` + `ReadOnlyConnection.fetch_all()`, SELECT 전용 강제) | 로컬DB면 `db.local_db.get_local_db_connection()`, 상용ERP 조회면 `db.prod_db.get_prod_db_connection()` import. **이 파일에서 커넥션 풀을 직접 만들지 않음**(db 계층 책임) |

**구현 상태**: ■ 신규 구현

---

## 10. DB

| 구분 | 관련 파일 | 작업 내용 | 관련 함수 | 참고 구현 위치 | 비고 |
|---|---|---|---|---|---|
| DB | (별도 마이그레이션 파일/도구 없음) | 로컬DB(myappdb)에 새 테이블이 필요하면 `psql -h localhost -U myapp_user -d myappdb`로 직접 `CREATE TABLE` 실행 | - | `users` 테이블 생성 이력(`myApp` 프로젝트의 `install/install_log.md` 관례), 설계 문서 작성 방식은 `plans/admin_settings/04_schema_proposal.md` 참고 | 이 프로젝트엔 Alembic 등 마이그레이션 프레임워크가 없음. 스키마 변경 전 `04_schema_proposal.md`처럼 **먼저 설계 문서로 검토 후 psql로 직접 실행**하는 방식 |

**구현 상태**: ■ 신규 구현 (필요한 경우에만, 기존 테이블 재사용이면 불필요)

---

## 11. 권한

| 구분 | 관련 파일 | 작업 내용 | 관련 함수 | 참고 구현 위치 | 비고 |
|---|---|---|---|---|---|
| 권한 | `auth.py` | 없음 (현재 프로젝트에 메뉴별 세부 권한 체크 자체가 없음) | `@login_required` | 모든 기존 라우트가 `login_required`만 적용, `role`(admin/user) 값 자체는 있지만 "이 role은 이 메뉴 못 봄" 같은 체크는 어디에도 구현 안 됨 | 메뉴별 권한이 필요하면 `plans/admin_settings/04_schema_proposal.md`의 `menu_permissions` 설계안(미구현)을 먼저 실제로 구현해야 함 — **이번 범위 밖** |

**구현 상태**: ■ 구현 불필요 (로그인만 되어 있으면 접근 가능, 현재 프로젝트 구조상 한계)

---

## 12. 검색조건

| 구분 | 관련 파일 | 작업 내용 | 관련 함수 | 참고 구현 위치 | 비고 |
|---|---|---|---|---|---|
| 검색조건 | `static/js/search-fields-config.js` | `window.SEARCH_FIELDS_CONFIG`에 `"profit_loss": [ {type:"daterange", label:"기간", name:"date_range"}, ... ]` 추가 | `SEARCH_FIELDS_CONFIG` (객체, `search-panel.js`의 `SearchPanel.build()`가 읽음) | `voucher_entry`, `tax_invoice_search` 항목 | 안 넣으면 `SEARCH_FIELDS_DEFAULT`(검색어 필드 1개)로 자동 폴백되므로 화면이 깨지지는 않음. `search-panel.js`(엔진)는 수정 안 함 |

**구현 상태**: ■ 신규 구현 (설정 데이터만) / `search-panel.js`는 ■ 구현 불필요

---

## 13. Grid 컬럼

| 구분 | 관련 파일 | 작업 내용 | 관련 함수 | 참고 구현 위치 | 비고 |
|---|---|---|---|---|---|
| Grid 컬럼 | 4번에서 만든 renderer 함수 내부 (`accounting.js`의 `profit_loss__main_grid`) | `columnDefs` 배열을 `renderAgGrid()` 호출 시 직접 작성 | 없음(데이터 배열) | `voucher_entry__header_grid`의 `columnDefs`(필드/헤더명/너비/`valueFormatter` 지정 방식) | 재사용 가능한 공통 컬럼 정의 파일은 없음 — 매번 renderer 함수 안에 하드코딩하는 게 현재 프로젝트 방식 |

**구현 상태**: ■ 신규 구현 (renderer 파일 내부)

---

## 14. Formatter

| 구분 | 관련 파일 | 작업 내용 | 관련 함수 | 참고 구현 위치 | 비고 |
|---|---|---|---|---|---|
| Formatter | `static/js/content-renderers/registry.js`의 `window.Formatters` | 금액/날짜는 기존 `Formatters.currency`/`Formatters.date` 그대로 사용. 새 포맷(예: 퍼센트)이 필요하면 `Formatters`에 함수 추가 | `Formatters.currency(v)`, `Formatters.date(v)` | `voucher_entry__detail_grid`의 `valueFormatter: function(p){ return Formatters.currency(p.value); }` | 기존 포맷으로 충분하면 이 파일 수정 자체가 불필요 |

**구현 상태**: 대부분 ■ 구현 불필요 (기존 재사용) / 새 포맷 필요시만 ■ 신규 구현

---

## 15. 저장/수정

| 구분 | 관련 파일 | 작업 내용 | 관련 함수 | 참고 구현 위치 | 비고 |
|---|---|---|---|---|---|
| 저장/수정 | `profit-loss-api.js`(6번), renderer 파일(4번) | API에 `save(id, data)` 함수 추가 + renderer의 저장 버튼 클릭 이벤트에서 호출, 성공 시 `gridApi.applyTransaction({ update: [...] })`로 그리드 즉시 갱신 | `AdminAPI.updateRole()` 대응 함수, `applyTransaction()` | `content-renderers/admin.js`의 `saveUserRole()` 함수 전체(버튼 클릭 → API 호출 → 성공 시 `listGridApi.applyTransaction()` → `alert()`) | 백엔드 라우트(7번)는 CSRF 보호 대상이므로 `apiFetch()`가 자동으로 `X-CSRFToken` 헤더를 붙여줌 (직접 처리 불필요) |

**구현 상태**: ■ 신규 구현 (참고할 실제 동작 코드 있음: `admin.js`)

---

## 16. 삭제

| 구분 | 관련 파일 | 작업 내용 | 관련 함수 | 참고 구현 위치 | 비고 |
|---|---|---|---|---|---|
| 삭제 | `profit-loss-api.js`, `routes/profit_loss_routes.py`, `service/`, `repository/` | API에 `delete(id)` 추가 → `DELETE` 라우트(또는 `POST /profit-loss/<id>/delete`) → service → repository의 `DELETE FROM ...` | 자유 명명 | **현재 프로젝트에 삭제가 구현된 화면이 없음** (admin_settings도 role 변경만 있고 사용자 삭제 기능 없음) | 참고할 기존 구현 코드가 없어 처음부터 설계 필요. 저장(15번) 패턴을 그대로 응용 |

**구현 상태**: ■ 신규 구현 (참고 가능한 기존 코드 없음, 새로 설계)

---

## 17. Excel

| 구분 | 관련 파일 | 작업 내용 | 관련 함수 | 참고 구현 위치 | 비고 |
|---|---|---|---|---|---|
| Excel | renderer 파일 내 툴바 버튼 또는 `toolbar.js` | AG Grid Community 내장 기능 `gridApi.exportDataAsCsv()` 호출하는 버튼 추가 | `exportDataAsCsv()` (AG Grid 자체 제공, Community 무료 범위) | **현재 프로젝트에 사용 사례 없음** — Enterprise 전용 `exportDataAsExcel()`이 아니라 Community의 `exportDataAsCsv()`만 사용 가능 (`erp_ui_step8_9_plan.md` 9-4절의 Enterprise 기능 금지 원칙 동일 적용) | 진짜 `.xlsx`가 필요하면 Community 범위를 벗어나므로, 서버에서 만들어 내려주는 방식(별도 백엔드 구현) 검토 필요 |

**구현 상태**: ■ 신규 구현 (기존 사용 사례 없음, Community 기능 범위 내에서 처음 도입)

---

## 18. 검증

- [ ] `menu_data.py`에 메뉴 생성 확인 (트리에 "손익관리"가 보이는지)
- [ ] 메뉴 클릭 시 탭 생성 확인 (중복 클릭 시 탭 안 늘어나는지도 함께 확인)
- [ ] Lazy Loading 대상이면(선택), Network 탭에서 해당 시점에만 스크립트가 요청되는지 확인
- [ ] `apiFetch()`를 통한 API 호출 확인 (Network 탭에서 요청/응답 확인)
- [ ] Grid 표시 확인 (컬럼/헤더/데이터 정상 렌더)
- [ ] 정렬(Sort)/필터/컬럼 리사이즈 정상 동작 확인
- [ ] 검색조건 패널이 이 메뉴 전용 필드로 표시되는지 확인
- [ ] 저장 확인 (성공 alert + 그리드 즉시 갱신)
- [ ] 수정 확인 (동일 항목 재저장 시 최신 값 반영)
- [ ] 삭제 확인 (구현했다면, 삭제 후 그리드에서 즉시 사라지는지)
- [ ] 새로고침 확인 (`/dashboard` 재접속 후에도 메뉴/탭 흐름 정상)
- [ ] 탭 닫기 후 재오픈 확인 (Lazy 대상이면 스크립트 중복 로드 없이 정상 동작)
- [ ] `registerRenderer()` 중복 등록 시 실제로 에러가 발생하는지 (콘솔에서 확인)
- [ ] 권한 확인 (현재 프로젝트는 로그인 여부만 체크 — 비로그인 상태로 API 직접 호출 시 리다이렉트/401 확인)
- [ ] Console Error 없음 확인
- [ ] Network Error(4xx/5xx) 없음 확인
- [ ] `docker compose logs -f local-erp` 및 `logs/app.log`에 관련 로그(조회/저장 등)가 남는지 확인

---

## 작업 순서 (번호순)

```
1. 메뉴 추가          menu_data.py에 leaf 노드 추가
      ↓
2. Layout 추가        screen-layouts.js의 SCREEN_LAYOUTS에 항목 추가
      ↓
3. Renderer 추가       content-renderers/accounting.js(또는 신규 파일)에 registerRenderer() 추가
                       (신규 파일이면 base.html에 <script> 태그 추가, 또는 tab-manager.js의
                        DOMAIN_SCRIPT_MAP에 lazy 등록)
      ↓
4. 검색조건 추가(선택)  search-fields-config.js의 SEARCH_FIELDS_CONFIG에 항목 추가
      ↓
5. Repository 추가     repository/profit_loss_repository.py 신규 작성
      ↓
6. Service 추가        service/profit_loss_service.py 신규 작성 (repository 호출)
      ↓
7. Backend Route 추가  routes/profit_loss_routes.py 신규 작성
                       → app.py에 import + register_blueprint 추가 (필수, 빠뜨리기 쉬움)
      ↓
8. Frontend API 추가   profit-loss-api.js 신규 작성 (apiFetch 기반)
                       → base.html에 <script> 태그 추가
      ↓
9. Renderer ↔ API 연결  4번에서 만든 renderer 함수 안에서 ProfitLossAPI.list() 등 호출,
                       그리드 rowData 채우기
      ↓
10. 저장/수정/삭제 연결 (필요 시) API 함수 + 버튼 이벤트 + applyTransaction 연동
      ↓
11. 테스트             18번 검증 체크리스트 전체 확인
```

> 순서 3(Renderer)과 8(Frontend API)은 실제로는 병행 작업 가능 — renderer 함수 뼈대를 먼저 만들고
> API가 준비되기 전까지는 더미 데이터로 그리드만 먼저 확인하는 방식(기존 6개 메뉴가 실제로 이렇게
> "더미 → 실 API 연동" 순서로 개발됨)도 이 프로젝트의 실제 패턴입니다.

---

## 신규 메뉴 구현 체크리스트

```
□ menu_data.py 메뉴 노드 추가
□ screen-layouts.js SCREEN_LAYOUTS 등록
□ content-renderers/*.js registerRenderer() 등록 (신규 파일이면 base.html 스크립트 태그 또는
  tab-manager.js DOMAIN_SCRIPT_MAP 등록도 함께)
□ search-fields-config.js SEARCH_FIELDS_CONFIG 등록 (선택)
□ repository/{도메인}_repository.py 작성
□ service/{도메인}_service.py 작성
□ routes/{도메인}_routes.py 작성 + app.py에 Blueprint 등록
□ {도메인}-api.js 작성 + base.html 스크립트 태그 추가
□ Grid 컬럼(columnDefs) 정의
□ Formatter 적용 (기존 Formatters 재사용 또는 신규 추가)
□ 저장 확인
□ 수정 확인
□ 삭제 확인 (구현한 경우)
□ Excel(CSV) 내보내기 확인 (구현한 경우)
□ Lazy Loading 확인 (해당하는 경우)
□ 권한 확인 (현재는 로그인 여부만)
□ Console Error 없음
□ Network Error 없음
□ 브라우저 새로고침 정상
□ 탭 재오픈 정상
```
