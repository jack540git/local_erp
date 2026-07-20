# 12. Reference 화면 분석 (profit_payment_date / admin_settings)

> 근거: [analysis/STEP6_Reference화면분석.md](../analysis/STEP6_Reference화면분석.md) (엔드투엔드 흐름 코드 추적 원본), [18-A장](./18-A_보완개발진행현황.md)(보완개발 진행 현황)

## 12-1. profit_payment_date (지급기준손익) — 엔드투엔드 흐름

```
사이드바 트리 리프 클릭
  → TabManager.openTab("profit_payment_date", "지급기준손익")
  → ensureContentPane() → SearchPanel.build (date 필드 1개, 기본값 DateDefaultRules.closingDate())
  → SplitLayout.render() → 유형 C(좌: list_grid, 우: 매입/관련문서 서브탭)
  → registerRenderer("profit_payment_date__list_grid").render()
       → renderAgGrid()로 빈 그리드 생성(rowData: [])
       → ℹ️ 자동조회 호출부는 의도적으로 주석 처리되어 있음(아래 참고)
  → (사용자가 검색조건 확인 후 "조회" 버튼 클릭 또는 Enter)
  → toolbar.js → ScreenReloadHandlers["profit_payment_date"] → loadProfitByPaymentDate(paneEl)
       → 검색조건 date input 재검증 → ProfitAnalysisAPI.getByPaymentDate(dateStr)
  → routes/erp_routes.py: profit_analysis_payment_date_api() (@login_required)
       → service: get_profit_by_payment_date()  (YYYY-MM-DD 정규식 검증)
       → repository: find_profit_by_payment_date()  (상용ERP, 6개 이상 CTE 조인)
  → JSON 응답 → listGridApi.setGridOption("rowData", rows)
```

### ℹ️ 자동조회 미적용 — 의도적 설계 결정 (버그 아님)

초기 계획 문서에는 "탭 오픈 시 기본일자로 1차 자동조회"로 서술되어 있었으나, **실제 운영 관점에서 자동조회가 불필요하다고 판단되어 개발 방향이 변경되었고, 사용자가 "조회" 버튼을 직접 클릭한 경우에만 조회되도록 최종 개발이 진행되었다.**

**변경 사유**: 지급기준손익 조회는 상용ERP DB를 대상으로 여러 테이블을 조인하는 무거운 분석 쿼리([STEP 6](../analysis/STEP6_Reference화면분석.md) 참고)다. 탭을 열 때마다 무조건 자동으로 조회되면 실제 업무상 불필요한 DB 부하가 반복적으로 발생한다. 사용자가 지급일자를 직접 확인/수정한 뒤 명시적으로 조회하는 협업(button-triggered)이 더 적절하다고 판단되어, **자동조회는 최종적으로 비활성화하는 쪽으로 개발 방향이 확정되었다.**

```javascript
// 탭 최초 오픈 시 1회 자동 조회 (검색조건의 기본값 기준)
// → 실운영상 불필요로 판단되어 비활성화함(의도적 주석처리).
//   향후 자동조회가 다시 필요해지면 아래 주석만 해제하면 된다.
//    loadProfitByPaymentDate(el.closest(".tab-pane"));
```

현재 동작(최종 확정된 사양): **탭을 열면 빈 그리드만 뜨고, 사용자가 검색조건(지급일자)을 확인한 뒤 직접 "조회" 버튼을 눌러야 데이터가 채워진다.** 주석 처리된 코드는 삭제하지 않고 의도적으로 남겨둔 상태이며, 향후 자동조회가 다시 필요해지면 해당 주석만 해제하면 재활성화할 수 있다.

### 발견 2 — 응답에 화면에 쓰이지 않는 필드 존재
SQL 응답에 `total_cost2`/`profit2`/`profit_rate2` 계열(대안 계산식)이 포함되지만, 프론트 columnDefs는 `profit`/`profit_rate` 계열만 표시한다. 용도가 불명확하여 검토가 필요하다.

### 발견 3 — 로깅 코드 버그
```python
logger.info("지급일기준 손익조회", date_payment)   # %s 없이 인자 전달 → TypeError 유발 가능
```
바로 아래 정상 패턴(`logger.info("[손익조회] SQL 실행 (date_payment=%s)", date_payment)`)과 대비된다.

### 서브탭 상태
"매입"/"관련문서" 서브탭 2개는 **하드코딩된 더미 데이터**로 렌더링되며, 실제 선택된 행과 연동되지 않는다(향후 개발 필요).

## 12-2. admin_settings (관리자 설정) — 엔드투엔드 흐름

```
사이드바 하단 ⚙ 버튼 클릭
  → TabManager.openTab("admin_settings", "설정")
  → ensureContentPane() → Lazy Loading: content-renderers/admin.js 최초 1회 동적 로드
  → SplitLayout.render() → 유형 C(좌: list_grid, 우: 기본정보/권한정보 서브탭)
  → registerRenderer("admin_settings__list_grid").render()
       → renderAgGrid() 생성 + AdminAPI.listUsers() 즉시 자동 호출(정상 동작)
  → routes/admin_routes.py: user_list_api() (@login_required → @role_required("admin")) → service → repository → 로컬DB
  → 그리드 렌더 → 행 클릭 시 loadUserDetail(userId)
       → AdminAPI.getUser(id) → GET /admin/users/<id> → renderBasicForm + renderPermissionInfo 동시 갱신
  → role <select> 변경 후 "저장" 클릭
       → AdminAPI.updateRole() → POST /admin/users/<id>/role (X-CSRFToken 자동 첨부)
  → routes/admin_routes.py: user_role_update_api() (@login_required → @role_required("admin"), 2026-07-18 적용)
       → service.change_user_role() → ALLOWED_ROLES 화이트리스트 검증만 수행 → repository.update_user_role()
  → 성공 시 그리드 행을 applyTransaction으로 즉시 갱신 + alert("저장되었습니다.")
```

### ✅ 권한 상승 보안 취약점 — 2026-07-18 조치 완료 (과거 발견 내용 포함)

**과거 발견 내용(최종 확증 시점, 조치 전)**: `user_role_update_api()`에 `@login_required`만 있고 role 검증 데코레이터가 없었다. `ALLOWED_ROLES` 화이트리스트는 role **값**이 `admin`/`user` 중 하나인지만 검사할 뿐, **호출자 자신이 admin인지는 전혀 검사하지 않았다.**

> 로그인만 되어 있으면(role="user"라도) `POST /admin/users/{자기id}/role {"role":"admin"}`을 직접 호출해 스스로 admin으로 승격할 수 있었다.

`user_list_api()`/`user_detail_api()`도 동일하게 검증이 없어, 일반 사용자도 전체 사용자 목록과 이메일 등 상세정보를 조회할 수 있었다. 근본 원인은 `auth.py`에 재사용할 `role_required` 공통 데코레이터 자체가 없다는 점이었다.

**✅ 조치 내용**: `auth.py`에 `role_required(*allowed_roles)` 공통 데코레이터를 신규 추가하고, `admin_routes.py`의 관리자 라우트 4개(`user_settings_page`, `user_list_api`, `user_detail_api`, `user_role_update_api`) 전부에 `@login_required` 바로 아래 `@role_required("admin")`을 적용해 해결했다(2026-07-18). 이제 role="user" 계정이 이 4개 API 중 무엇을 호출하든 `403 {"error": "권한이 없습니다."}`를 받는다. 상세 변경 파일, diff, 검증 절차는 **[18-A장, ISSUE-01](./18-A_보완개발진행현황.md#2-1-issue-01-admin_routespy-role-검증-부재--완료)** 참고.

> **남은 과제**: 사이드바 ⚙ 버튼은 role과 무관하게 항상 노출되므로, 일반 사용자가 admin_settings 탭을 열면 403을 받긴 하지만 프론트에 이를 안내하는 UX 처리가 아직 없다(18-A ISSUE-01의 "남은 작업" 참고).

### 프론트 특이사항
`basic_form`/`permission_form` 두 서브탭은 **동일한 API 응답 한 번**으로 동시에 채워진다(profit 화면의 하드코딩 더미와 대비되는 실제 연동 사례). role 변경 성공 시 서버 재조회 없이 그리드를 직접 갱신한다.

## 12-3. 두 화면 비교표

| 항목 | profit_payment_date | admin_settings |
|---|---|---|
| 대상 DB | 상용ERP(Odoo, 조회 전용) | 로컬DB(읽기/쓰기) |
| 최초 진입 시 자동조회 | ℹ️ 의도적으로 비활성(운영상 불필요 판단, 확정 사양) | ✅ 정상 동작 |
| 서브탭 연동 | 더미 데이터(미연동) | 실제 API 연동 |
| CRUD | 조회(R)만 | 조회(R) + 수정(U, role) |
| Lazy Loading 대상 | ✅ | ✅ |
| 보안 이슈 | 없음(조회 전용) | ✅ 해결됨(2026-07-18, `role_required` 적용 — [18-A](./18-A_보완개발진행현황.md)) |

## 12-4. 신규 개발자를 위한 시사점

- 새 화면을 만들 때 **admin_settings의 "자동조회+상세연동" 패턴**과 **profit_payment_date의 "버튼 조회+무거운 분석쿼리" 패턴** 중 성격에 맞는 쪽을 참고하면 된다. 조회 자체가 무겁거나 상용ERP에 부담을 주는 화면이라면 profit_payment_date처럼 **자동조회를 넣지 않고 버튼 트리거만 두는 것도 정당한 설계 선택**이다(무조건 자동조회가 정답은 아님).
- **관리자 전용 API는 이제 `auth.py`의 `role_required("admin")`을 재사용하면 된다.** 과거에는 이 데코레이터 자체가 없어 admin_settings가 취약점의 원인이 되었지만(2026-07-18 이전), 지금은 공통 데코레이터가 존재하므로 새 관리자 API를 만들 때 `@login_required` 바로 아래에 `@role_required("admin")`을 붙이는 것이 표준이다.
