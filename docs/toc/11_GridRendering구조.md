# 11. Grid Rendering 구조

> 근거: [analysis/STEP4_Frontend분석.md](../analysis/STEP4_Frontend분석.md), [STEP5_공통Framework분석.md](../analysis/STEP5_공통Framework분석.md), [STEP6_Reference화면분석.md](../analysis/STEP6_Reference화면분석.md)

## 11-1. AG Grid 버전 및 로드 방식

- **AG Grid Community 31.0.0**, CDN에서 직접 로드(`base.html`). `static/vendor/`는 사용하지 않는다.
- **Enterprise 기능(rowGroup, masterDetail, enableRangeSelection 등)은 의도적으로 미사용** — Community 라이선스 범위 내에서만 구현되어 있다.

## 11-2. 공통 초기화 헬퍼 — `renderAgGrid()`

```javascript
function renderAgGrid(el, columnDefs, rowData, gridOptionsExtra) {
    el.classList.add("ag-theme-alpine", "ag-theme-erp");
    el.style.height = "100%";
    el.style.width = "100%";
    const gridOptions = {
        columnDefs, rowData,
        defaultColDef: { resizable: true, sortable: true, filter: true },
        rowSelection: "multiple",
        animateRows: true,
        tooltipShowDelay: 300,          // 기본 2000ms보다 단축
        localeText: AG_GRID_LOCALE_KR,  // 한국어 필터/정렬/컬럼메뉴 문구
        ...gridOptionsExtra,
    };
    return agGrid.createGrid(el, gridOptions);
}
```

모든 화면의 그리드는 이 함수를 통해서만 생성된다 — 공통 스타일/한국어 로케일/기본 옵션이 자동으로 적용된다.

## 11-3. 컬럼 정의(columnDefs) 작성 패턴

`profit-analysis.js`의 실제 예시:

```javascript
{ field: "expected_sale", headerName: "예상매출", width: 76,
  type: "numericColumn", filter: "agNumberColumnFilter",
  valueFormatter: (p) => Formatters.currency(p.value) },
```

- 금액 컬럼은 `type: "numericColumn"` + `filter: "agNumberColumnFilter"` + `Formatters.currency` 조합이 표준 패턴.
- 퍼센트 컬럼은 `valueFormatter: (p) => p.value == null ? "" : p.value + "%"` 직접 처리(공통 Formatter 없음).
- 긴 텍스트 컬럼은 `tooltipField`로 툴팁 지정(`doc_name`, `biz_note` 등).

## 11-4. 그리드 데이터 채우기 — 두 가지 패턴

### 패턴 A — 초기 빈 배열 + 이후 API로 채움 (profit_payment_date)

```javascript
listGridApi = renderAgGrid(el, columnDefs, []);   // 빈 배열로 시작
// ... 이후 "조회" 버튼 클릭 시 listGridApi.setGridOption("rowData", rows)
```

### 패턴 B — 렌더 즉시 API 자동 호출 (admin_settings)

```javascript
listGridApi = renderAgGrid(el, columnDefs, []);
AdminAPI.listUsers().then((users) => listGridApi.setGridOption("rowData", users));
```

⚠️ `profit_payment_date`는 원래 패턴 B(자동조회)로 설계되었으나 현재 코드는 해당 호출이 주석 처리되어 있어 실질적으로 패턴 A로 동작한다([12장](./12_Reference화면분석.md) 참고).

## 11-5. 행 선택 → 상세 연동 패턴 (admin_settings)

```javascript
onRowClicked: function (event) {
    if (event.data) loadUserDetail(event.data.id);
}
```

좌측 그리드 클릭 → 우측 서브탭(기본정보/권한정보) 동시 갱신. `rowSelection: "single"`로 단일 선택만 허용.

## 11-6. 그리드 갱신 방식 — 재조회 vs 낙관적 업데이트

| 화면 | 갱신 방식 |
|---|---|
| `profit_payment_date` | 재조회(`setGridOption("rowData", rows)`로 전체 교체) |
| `admin_settings` (role 저장 후) | 낙관적 업데이트(`listGridApi.applyTransaction({ update: [...] })`로 해당 행만 갱신, 서버 재조회 없음) |

`applyTransaction`은 서버와 화면 상태가 이론상 어긋날 여지가 있으나(동시 편집 등), 현재 단일 관리자 사용 전제로는 문제가 없어 보인다.

## 11-7. 신규 그리드 화면 작성 시 체크리스트

1. `renderAgGrid()`를 통해서만 그리드 생성(직접 `agGrid.createGrid()` 호출 금지 — 공통 스타일/로케일 누락).
2. 금액 컬럼은 `Formatters.currency` 재사용.
3. 초기 데이터가 필요하면 render 함수 안에서 API를 즉시 호출(admin_settings 패턴), 사용자 액션 후 채우려면 `registerReload()`로 배선(profit_payment_date 패턴, [6장](./06_공통Framework.md) 참고).
