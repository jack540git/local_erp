# 지급기준손익(profit_payment_date) — 조회 버튼 연동 Plan

> 백엔드(`repository/profit_analysis_repository.py`, `service/profit_analysis_service.py`,
> `routes/erp_routes.py`)는 구현 완료된 상태. 이 문서는 **프론트엔드 "조회 버튼 → 데이터 반영"**
> 배선만 다룬다.

## 목표 동작

메뉴에서 "지급기준손익" 클릭 → 탭 생성(활성화) + 빈 그리드 표시 → 상단 툴바 "조회" 버튼 클릭 →
검색조건(지급일자) 값을 읽어 백엔드 호출 → 응답으로 그리드 채움.

## 검토 결과 — 사용자 작업 목록 확인

| 번호 | 항목 | 검토 |
|---|---|---|
| 1 | Renderer 수정 (더미 제거, 빈 Grid 생성, GridApi 저장) | ✅ 정확. `admin.js`의 `admin_settings__list_grid`가 이미 같은 패턴(모듈 스코프 `listGridApi` 변수) |
| 2 | `registerReload("profit_payment_date", ...)` 구현 | ✅ 정확. `registry.js`에 레지스트리 자체는 이미 존재(`registerReload`), 아직 아무도 등록 안 한 상태였음 |
| 3 | Search Panel → API 연결 (조회조건 읽기 → `ProfitAnalysisAPI.getByPaymentDate()`) | ✅ 정확 |
| 4 | Backend 결과 → Grid 반영 (`setGridOption("rowData", ...)`) | ✅ 정확 |

**추가로 발견되어 이번에 같이 처리하는 항목** (사용자 목록엔 없었으나 "조회 버튼 클릭" 자체를 위해 필수):

| 항목 | 이유 |
|---|---|
| `toolbar.js`의 "조회" 버튼 클릭 → 활성 탭 menuKey 판별 → `ScreenReloadHandlers[menuKey]` 호출 배선 | 지금까지 `toolbar.js`는 클릭 시 `console.log`만 하는 더미 상태라, 2~4번이 다 구현돼도 "조회" 버튼 자체가 아무것도 트리거하지 않음 |
| `templates/base.html`에 `profit-analysis-api.js` `<script>` 태그 추가 | 어디에도 로드가 안 되어 있어 `ProfitAnalysisAPI`가 `undefined` 상태였음 |

## 전체 흐름 (확정본)

```
사용자
  │  메뉴에서 "지급기준손익" 클릭
  ▼
sidebar-tree.js (selectLeaf) → TabManager.openTab("profit_payment_date", "지급기준손익")
  │
  ▼
tab-manager.js: ensureContentPane()
  │  ① SearchPanel.build("profit_payment_date")
  │     → search-fields-config.js의 필드 정의(date, default: "closingDate") 반영,
  │       DateDefaultRules.closingDate()로 지급일자 기본값 자동 채움 (신규 탭 생성 시 1회만)
  │  ② DOMAIN_SCRIPT_MAP 확인 → profit-analysis.js는 eager 로드 대상 아님/이미 로드됨 전제
  │     (현재 설계상 lazy 대상이면 최초 오픈 시 동적 로드)
  │  ③ SplitLayout.render() → SCREEN_LAYOUTS["profit_payment_date"] 레이아웃 구성
  ▼
content-renderers/profit-analysis.js
  │  registerRenderer("profit_payment_date__list_grid", { render(el) {...} })
  │  render(el) 실행:
  │    - renderAgGrid(el, columnDefs, [])   ← 더미 대신 빈 배열로 그리드만 생성
  │    - listGridApi = 반환값 저장 (모듈 스코프 변수, admin.js와 동일 패턴)
  │    - 최초 1회 loadProfitByPaymentDate(el.closest('.tab-pane')) 호출
  │      → 탭 열자마자 기본 지급일자 기준으로 자동 조회 (admin_settings__list_grid와 동일한 관례)
  │  registerReload("profit_payment_date", loadProfitByPaymentDate)
  │      → 이후 "조회" 버튼 클릭 시 재사용할 동일 함수를 레지스트리에 등록
  ▼
=================== (탭/그리드 준비 완료 상태) ===================
  │
  │  사용자: 상단 마스터바 "조회" 버튼 클릭
  ▼
toolbar.js
  │  getActivePane() → document.querySelector('#tab-content-area > .tab-pane.active')
  │  getActiveMenuKey() → pane.dataset.tabId("tab-profit_payment_date")에서 "tab-" 제거
  │  window.ScreenReloadHandlers["profit_payment_date"](activePane) 호출
  ▼
content-renderers/profit-analysis.js: loadProfitByPaymentDate(paneEl)
  │  paneEl.querySelector('.search-panel input[name="date"]')로 현재 입력값 읽기
  │  (blur 포맷 전 상태 대비, search-panel.js의 isValidYmd/formatYmd로 방어적 재검증)
  ▼
profit-analysis-api.js: ProfitAnalysisAPI.getByPaymentDate(dateStr)
  │  apiFetch("/api/profit-analysis/payment-date?date=" + dateStr)
  ▼
routes/erp_routes.py: profit_analysis_payment_date_api()  [구현 완료]
  → service/profit_analysis_service.py: get_profit_by_payment_date()  [구현 완료]
  → repository/profit_analysis_repository.py: find_profit_by_payment_date()  [구현 완료]
  → 상용ERP(Odoo) PostgreSQL 조회
  ▼
JSON 응답
  ▼
loadProfitByPaymentDate의 .then(): listGridApi.setGridOption("rowData", rows)
  ▼
화면: 그리드에 실제 데이터 표시
```

## 작업 순서

```
1. templates/base.html          profit-analysis-api.js <script> 태그 추가
2. static/js/toolbar.js         "조회" 액션 → ScreenReloadHandlers 호출 배선
3. content-renderers/profit-analysis.js
     - IIFE로 감싸고 모듈 스코프 listGridApi 변수 추가
     - list_grid render(): renderAgGrid(el, columnDefs, [])로 빈 그리드 생성 + gridApi 저장
     - loadProfitByPaymentDate(paneEl) 함수 작성 (날짜 읽기 → API 호출 → 그리드 갱신 → 에러 alert)
     - render() 끝에서 loadProfitByPaymentDate() 1회 호출 (최초 자동 조회)
     - registerReload("profit_payment_date", loadProfitByPaymentDate)
4. 재빌드 및 검증
```

## 검증 체크리스트

- [ ] "지급기준손익" 메뉴 클릭 → 탭 생성, 지급일자 필드에 마감일 규칙 기본값 자동 채워짐
- [ ] 탭이 열리자마자 그 기본값 기준으로 그리드에 데이터가 1차 자동 표시됨
- [ ] 검색조건의 지급일자를 변경 후 "조회" 클릭 → 변경된 날짜 기준으로 그리드가 다시 채워짐
- [ ] 다른 탭(예: 홈, 계정등록)이 활성 상태일 때 "조회" 클릭 → 아무 동작 안 함(콘솔 경고만), 에러 없음
- [ ] 잘못된 날짜(예: 20250231) 입력 후 blur → "잘못된 날짜 형식입니다." alert, 조회는 이전 값 기준으로 동작(또는 조회 자체가 막히는지 확인)
- [ ] Network 탭에서 `/api/profit-analysis/payment-date?date=...` 요청/응답 확인
- [ ] `logs/app.log`에 조회 파라미터/결과 건수 로그 기록 확인 (`erp_routes.py`의 `logger.info`)
- [ ] 브라우저 콘솔 에러 없음
