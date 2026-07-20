# STEP 6. Reference 화면 분석 — profit_payment_date / admin_settings (완료)

> 실제 코드 전수 열람: `static/js/content-renderers/profit-analysis.js`, `static/js/content-renderers/admin.js`,
> `routes/erp_routes.py`, `routes/admin_routes.py`, `service/profit_analysis_service.py`, `service/user_service.py`,
> `repository/profit_analysis_repository.py`, `repository/local_repository.py`
>
> 두 화면 모두 **STEP 4(Frontend 렌더링 파이프라인)** · **STEP 5(공통 Framework)** 에서 확인한 공통 구조를
> 실제로 사용하는 "레퍼런스" 사례. 본 STEP은 두 화면 각각의 **엔드투엔드 호출 흐름**(진입~DB~응답~렌더)을 추적한다.

## 6-1. `profit_payment_date` (지급기준손익) — 엔드투엔드 흐름

```
사이드바 트리 리프 클릭
  → TabManager.openTab("profit_payment_date", "지급기준손익")
  → ensureContentPane() → SearchPanel.build (date 필드 1개, 기본값 DateDefaultRules.closingDate())
  → SplitLayout.render() → 유형 C(좌: list_grid, 우: 매입/관련문서 서브탭)
  → registerRenderer("profit_payment_date__list_grid").render()
       → renderAgGrid()로 빈 그리드 생성(rowData: [])
       → ⚠️ 탭 최초 오픈 시 자동조회 호출부(`loadProfitByPaymentDate(...)`)가 **주석 처리되어 비활성 상태**
  → (사용자가 "조회" 버튼 클릭 또는 Enter)
  → toolbar.js → ScreenReloadHandlers["profit_payment_date"] → loadProfitByPaymentDate(paneEl)
       → 검색조건 date input 값 재검증(정규식+isValidYmd, search-panel.js 재사용)
       → ProfitAnalysisAPI.getByPaymentDate(dateStr) → apiFetch(GET /api/profit-analysis/payment-date?date=...)
  → routes/erp_routes.py: profit_analysis_payment_date_api() (@login_required)
       → service/profit_analysis_service.py: get_profit_by_payment_date()
            → 정규식(YYYY-MM-DD) 검증, 실패 시 ValueError → 라우트가 400 응답
       → repository/profit_analysis_repository.py: find_profit_by_payment_date()
            → db/prod_db.py: get_prod_db_connection() (상용ERP, 조회 전용)
            → 다중 CTE 조인 SQL 실행(계약/매출/매입/납품/제품단가 등 6개 이상 서브쿼리 결합)
  → JSON 응답 → listGridApi.setGridOption("rowData", rows)로 그리드 갱신
```

### ⚠️ 중요 발견: STEP 1·3-1 요약과의 불일치
- 메인 문서 3-1절 요약에는 **"탭 오픈 시 기본일자로 1차 자동조회"**라고 서술되어 있으나, 실제 `profit-analysis.js`의 render 함수 안에서 해당 호출 코드(`loadProfitByPaymentDate(el.closest(".tab-pane"))`)가 **주석 처리(비활성)** 되어 있음을 코드로 확인. 현재 동작은 **탭을 열어도 빈 그리드만 뜨고, 사용자가 직접 "조회" 버튼을 눌러야 데이터가 채워짐**. 메인 문서 3-1의 서술은 갱신 필요(STEP 8에서 최종 반영).

### 데이터 조회 구조 특이사항
- `repository/profit_analysis_repository.py`의 SQL은 **단일 화면을 위한 매우 무거운 분석 쿼리**(계약/매출/매입/납품예정/납품실적/판매오더 6개 CTE 조인). 상용ERP DB(Odoo 스키마: `approval_approval`, `revenue_sale`, `revenue_purchase`, `delivery_order` 등)를 직접 조회.
- `total_cost`/`profit`/`profit_rate` 계열과 `total_cost2`/`profit2`/`profit_rate2` 계열이 **동시에 계산되어 응답에 포함**되나, 프론트 `profit-analysis.js`의 columnDefs는 `profit`/`profit_rate` 계열만 그리드에 표시 — `product_value2` 기반 대안 계산식은 응답에는 있지만 화면에 노출되지 않는 상태(용도 불명, 검토 필요).
- **로깅 버그 의심**: `find_profit_by_payment_date()` 최상단의 `logger.info("지급일기준 손익조회", date_payment)` 호출은 포맷 문자열에 `%s` 자리가 없는데 인자를 넘기고 있어, logging 모듈이 실제 포맷팅을 시도하는 상황(예: 핸들러가 있는 환경)에서 `TypeError`를 유발할 수 있는 코드 패턴. 바로 아래 줄의 `logger.info("[손익조회] SQL 실행 (date_payment=%s)", date_payment)`는 정상 패턴이라 이 라인만 예외적으로 잘못 작성됨.
- 서브탭 2개(`revenue_purchase_form`, `relation_doc_form`)는 **하드코딩된 더미 데이터**로 렌더링(`renderKeyValueForm`에 고정 문자열 전달) — 실제 선택된 행과 연동되지 않음, 향후 개발 필요 항목.

## 6-2. `admin_settings` (관리자 설정) — 엔드투엔드 흐름

```
사이드바 하단 ⚙ 버튼 클릭
  → TabManager.openTab("admin_settings", "설정")
  → ensureContentPane() → Lazy Loading: content-renderers/admin.js 최초 1회 동적 로드
  → SplitLayout.render() → 유형 C(좌: list_grid, 우: 기본정보/권한정보 서브탭)
  → registerRenderer("admin_settings__list_grid").render()
       → renderAgGrid()로 그리드 생성(rowSelection:"single", onRowClicked 배선)
       → AdminAPI.listUsers() → apiFetch(GET /admin/users/list) 즉시 자동 호출(이쪽은 profit 화면과 달리 주석 처리 없이 실제로 동작)
  → routes/admin_routes.py: user_list_api() (@login_required) → service.get_user_list() → repository.find_all_users()
       → db/local_db.py(로컬DB) → SELECT id,email,role (password 제외)
  → 그리드에 사용자 목록 렌더 → 행 클릭 시 loadUserDetail(userId)
       → AdminAPI.getUser(id) → GET /admin/users/<id> → user_detail_api() → get_user_detail() → find_user_by_id()
       → 응답으로 renderBasicForm(user) + renderPermissionInfo(user) 동시 렌더(기본정보/권한정보 두 서브탭 동시 갱신)
  → 기본정보 탭에서 role <select> 변경 후 "저장" 클릭
       → saveUserRole(userId, newRole) → AdminAPI.updateRole() → POST /admin/users/<id>/role (X-CSRFToken 자동 첨부)
  → routes/admin_routes.py: user_role_update_api() (@login_required만, role 검증 없음 — STEP 3·5에서 확인한 이슈)
       → service.change_user_role() → ALLOWED_ROLES 화이트리스트 검증만 수행 → repository.update_user_role() → UPDATE ... SET role
  → 성공 시 그리드 행을 applyTransaction으로 즉시 갱신(재조회 없이 낙관적 업데이트) + alert("저장되었습니다.")
```

### 이 화면에서 실제로 확인된 보안 이슈 (STEP 3·5 발견의 최종 확증)
- `user_role_update_api()`에 `@login_required`만 있고 role 검증 데코레이터가 없음 — **로그인만 되어 있으면 어떤 사용자든 자기 자신 포함 임의 user_id의 role을 "admin"으로 변경 가능**. `ALLOWED_ROLES` 화이트리스트는 role **값**이 `admin`/`user` 중 하나인지만 검사할 뿐, 호출자 자신이 admin인지는 전혀 검사하지 않음. 세 곳(routes/service/auth.py 공통 데코레이터 부재)의 코드 흐름을 모두 추적해 실제로 취약점이 성립함을 최종 확인.
- `user_list_api()`/`user_detail_api()`도 동일하게 role 검증이 없어, 일반 사용자도 전체 사용자 목록과 상세정보(이메일 등)를 조회 가능.

### admin_settings 프론트 특이사항
- `basic_form`/`permission_form` 두 서브탭은 **동일한 `loadUserDetail()` 한 번의 API 응답**으로 동시에 채워짐 — profit 화면의 서브탭(하드코딩 더미)과 달리 실제 선택 연동이 되어 있음.
- role 변경 성공 시 서버 재조회 없이 그리드를 직접 `applyTransaction`으로 갱신 — 서버와 화면 상태가 어긋날 여지는 이론상 있으나(다른 사용자가 동시에 변경하는 등) 단일 관리자 사용 전제로는 문제 없어 보임.

## 6-3. 두 Reference 화면 비교

| 항목 | profit_payment_date | admin_settings |
|---|---|---|
| 대상 DB | 상용ERP(Odoo, 조회 전용) | 로컬DB(myappdb, 읽기/쓰기) |
| 최초 진입 시 자동조회 | ❌ 코드상 비활성(주석 처리) | ✅ 정상 동작 |
| 서브탭 연동 | 더미 데이터(미연동) | 실제 API 연동 |
| CRUD | 조회(R)만 | 조회(R) + 수정(U, role) |
| Lazy Loading 대상 | ✅ (`content-renderers/profit-analysis.js`) | ✅ (`content-renderers/admin.js`) |
| 보안 이슈 | 없음(조회 전용이라 위험도 낮음) | 🔴 있음(권한 상승 가능) |

---

## STEP 6 완료 체크
- [x] profit_payment_date 엔드투엔드 흐름 추적(진입→검색조건→API→서비스→레포지토리→상용DB→응답→그리드)
- [x] admin_settings 엔드투엔드 흐름 추적(진입→목록조회→상세조회→role변경→로컬DB)
- [x] STEP 1/3-1 요약과 실제 코드의 불일치(자동조회 비활성) 확인
- [x] STEP 3·5에서 발견한 보안 이슈를 실제 화면 흐름으로 최종 확증
- [x] 두 화면 비교표 작성

---

## 추가 확인 (사용자 피드백 반영)

> 위 6-1절의 "⚠️ 중요 발견: STEP 1·3-1 요약과의 불일치" 기록은, 이후 프로젝트 담당자 확인 결과 **문서-코드 불일치(버그)가 아니라 의도적 설계 결정**으로 최종 확인되었다.
>
> **확정 내용**: profit_payment_date 자동조회 기능은 실운영에 있어 불필요하다고 판단되었고, 사용자가 직접 "조회" 버튼을 클릭한 경우에만 조회되도록 개발방향을 변경하여 최종 개발이 진행되었다. 이에 따라 계획을 수정하여 반영하였음. 향후 필요에 따라 자동조회 기능을 다시 활성화할 수 있도록 해당 호출부 코드는 삭제하지 않고 주석처리된 상태로 유지함.
>
> **이로 인해 수정된 문서**: [toc/12_Reference화면분석.md](../toc/12_Reference화면분석.md)와 메인 문서(`ERP_개발계획서.md`) 3-2/3-3절에 "미해결 이슈"가 아닌 "의도적 설계 결정"으로 최종 반영됨.
>
> **유의**: 이 파일(analysis/STEP6)은 당시 시점의 코드 실측 기록(근거자료)이므로 원문은 그대로 남겨두고, 이 추가 확인 내용만 별도로 덧이는 방식으로 작성함.
