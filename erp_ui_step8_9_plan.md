# Step 8~9 상세 구현 Plan

> 전제 파일: `erp_ui_progress.md`(Step 1~5 기록), `erp_ui_next_steps.md`(Step 6~10 개요).
> 이 문서는 그중 **Step 8(화면별 레이아웃 연결)**과 **Step 9(AG Grid 연동)**만 떼어내어
> 실제 구현 순서/파일/코드 스케치까지 구체화한 실행 계획이다.

---

## 0. 지금까지 만들어진 것 vs 아직 연결 안 된 것 (현황 재확인)

| 컴포넌트 | 상태 | 비고 |
|---|---|---|
| `SplitLayout` 엔진(`split-layout.js`) | 완성 | 재귀 트리, 드래그 리사이즈, `type:"tabs"` 지원까지 완료 |
| `SearchPanel` 빌더(`search-panel.js`) | 완성 (방금 수정) | `menuKey` -> `SEARCH_FIELDS_CONFIG` 기반 동적 생성 |
| `TabManager`(`tab-manager.js`) | 부분 연결 | 탭 열릴 때 `SearchPanel.build()`는 호출하지만, 그 아래 `screen-content-area`는 아직 더미 placeholder 텍스트만 들어감 |
| `SCREEN_LAYOUTS` / `CONTENT_RENDERERS` | 미착수 | `erp_ui_next_steps.md`에 설계만 있고 실제 파일 없음 |
| AG Grid | 미착수 | `ag-grid-theme.css`는 빈 파일, 라이브러리 자체도 미설치 |

즉 Step 8의 핵심 과제는 단 하나: `tab-manager.js`가 만드는 `.screen-content-area` 안에,
더미 텍스트 대신 `SplitLayout.render(el, SCREEN_LAYOUTS[menuKey])`를 호출하도록 연결하는 것.

---

## Step 8 — SCREEN_LAYOUTS / CONTENT_RENDERERS 연결

### 8-1. 파일 생성: `static/js/screen-layouts.js`

`erp_ui_next_steps.md`에 이미 나온 설계를 그대로 구현. `search-fields-config.js`와 동일한 패턴(전역 객체 + menuKey 키).

```js
window.SCREEN_LAYOUTS = {
    // 유형 A - 분할 없음
    "account_register": { type: "pane", contentId: "account_register__main_grid" },
    "biz_reg_no": { type: "pane", contentId: "biz_reg_no__main_grid" },
    "tax_invoice_search": { type: "pane", contentId: "tax_invoice_search__main_grid" },

    // 유형 B - 상하 3단 (전표입력)
    "voucher_entry": {
        type: "split", direction: "vertical", ratios: [1, 2, 1],
        children: [
            { type: "pane", contentId: "voucher_entry__header_grid", minSize: 80 },
            { type: "pane", contentId: "voucher_entry__detail_grid", minSize: 120 },
            { type: "pane", contentId: "voucher_entry__mgmt_panel", minSize: 60 },
        ],
    },

    // 유형 C - 좌우 2단, 우측은 서브탭 (거래처정보관리)
    "vendor_info": {
        type: "split", direction: "horizontal", ratios: [1, 2],
        children: [
            { type: "pane", contentId: "vendor_info__list_grid", minSize: 200 },
            {
                type: "tabs",
                tabs: ["기본정보", "부가정보", "기타정보"],
                contentIds: ["vendor_info__basic", "vendor_info__extra", "vendor_info__etc"],
            },
        ],
    },
};

window.SCREEN_LAYOUT_DEFAULT = { type: "pane", contentId: "__default__main_grid" };
```

> contentId 네이밍 규칙: `${menuKey}__${역할}` 형태로 통일한다.

### 8-2. 파일 생성: `static/js/content-renderers.js`

contentId -> 렌더 함수 매핑. Step 8 단계는 더미 registerDummyRenderer() 호출로 시작, Step 9에서 실제 렌더 함수로 교체.

### 8-3. `tab-manager.js` 수정

`ensureContentPane()`의 `screen-content-area` 생성 부분에서, 더미 텍스트 대신 `SplitLayout.render(contentArea, layout)`를 호출하도록 교체.

### 8-4. 더미 메뉴 데이터 보강

`menu_data.py`에 유형 C 검증용 "거래처정보관리"(`vendor_info`) 메뉴 추가. `SCREEN_LAYOUTS`, `SEARCH_FIELDS_CONFIG`에도 함께 추가.

### 8-5. 검증 시나리오

| 확인 항목 | 기대 결과 |
|---|---|
| "계정등록"(유형 A) 탭 열기 | 분할선 없이 그리드 placeholder 1개만 꽉 채워 표시 |
| "전표입력"(유형 B) 탭 열기 | 상하 3단, 분할선 2개, 드래그로 비율 조절 가능 |
| "거래처정보관리"(유형 C) 탭 열기 | 좌우 2단, 우측 서브탭 전환 가능 |
| 세 탭 동시 오픈 후 전환 | SplitLayout 상태가 서로 섞이지 않고 독립 유지 |
| 검색조건 패널 접기 | 그 아래 SplitLayout 영역이 자동으로 늘어나는지 |
| 탭 닫기 후 재오픈 | SplitLayout 상태가 초기화되는 게 정상(의도된 동작) |

### 8-6. `base.html`의 Step 7 데모 코드 정리

Step 8 완료 후 `#split-layout-demo` 관련 임시 스크립트 삭제. 홈 탭은 순수 대시보드로 복원.

---

## Step 9 — AG Grid Community 연동

### 9-1. 라이브러리 설치 방식

CDN 스크립트 태그 방식 권장 (사내망 폐쇄 시 `static/vendor/`에 로컬 서빙으로 전환).

### 9-2. `static/css/ag-grid-theme.css`

`--ag-header-background-color` 등 CSS 변수 오버라이드로 엑셀풍 커스텀 테마 구현.

### 9-3. `content-renderers.js`의 더미 렌더러를 실제 AG Grid로 교체

```js
function renderAgGrid(el, columnDefs, rowData, gridOptionsExtra) {
    el.classList.add("ag-theme-erp");
    el.style.height = "100%";
    el.style.width = "100%";

    const gridOptions = Object.assign({
        columnDefs: columnDefs,
        rowData: rowData,
        defaultColDef: { resizable: true, sortable: true, filter: true },
        rowSelection: "multiple",
        pinnedBottomRowData: gridOptionsExtra && gridOptionsExtra.pinnedBottomRowData,
    }, gridOptionsExtra || {});

    agGrid.createGrid(el, gridOptions);
}
```

> 헤더 고정(Freeze header) 및 정렬(Sort)은 AG Grid Community의 기본 내장 동작이라 별도 구현이 필요 없다.
> 정렬은 `defaultColDef.sortable: true`로 이미 포함되어 있다. 다만 SplitLayout 안에 AG Grid를 넣는
> 구조와 결합했을 때 깨지지 않는지는 반드시 검증한다.

### 9-4. Enterprise 전용 기능 실수 방지 체크

- [ ] `rowGroup`, `enableRowGroup` 등 Row Grouping 옵션 없음
- [ ] `masterDetail: true` 없음 (SplitLayout으로 직접 구현하므로 애초에 안 씀)
- [ ] `enterpriseModules` import 없음
- [ ] `ag-grid-enterprise` 패키지/CDN URL 없음

### 9-5. 성능/스크롤 확인

- 이중 스크롤바가 생기지 않는지 확인 필요 (`el.style.height = "100%"`로 AG Grid 컨테이너가 부모 높이를 정확히 채우도록).
- 분할선 드래그 중 그리드가 버벅이지 않는지, 필요 시 드래그 종료 시점에만 컬럼 재계산하는 방식으로 최적화.

### 9-6. 검증 시나리오

| 확인 항목 | 기대 결과 |
|---|---|
| "계정등록" 탭(유형 A) | AG Grid에 더미 행, 정렬/필터/컬럼 리사이즈 정상 동작 |
| "전표입력" 탭(유형 B) | 헤더/상세그리드 각각 독립 동작, 하단 합계 행(pinned) 표시 |
| Enterprise 기능 미사용 확인 | 9-4 체크리스트 전항목 통과 |
| SplitLayout 드래그 중 그리드 | 버벅임 없이 리사이즈 |

---

## 전체 순서 요약

```
Step 8: 8-1 screen-layouts.js -> 8-2 content-renderers.js -> 8-3 tab-manager.js 연결
        -> 8-4 유형 C 더미 메뉴 -> 8-5 검증 -> 8-6 데모 코드 정리

Step 9: 9-1 AG Grid 로드 방식 -> 9-2 테마 CSS -> 9-3 실제 렌더러 교체
        -> 9-4 Enterprise 미사용 체크 -> 9-5 성능 확인 -> 9-6 최종 검증
```

Step 8이 끝나야 Step 9의 각 contentId가 어느 화면 소속인지 명확해지므로, 8 완료 후 9로 진행한다.

---

## Step 8 진행 결과 (완료)

### 계획 대비 실제 구현 내역

| 항목 | 계획 | 실제 구현 |
|---|---|---|
| 8-1 `screen-layouts.js` | 유형 A(3개)/B/C 트리 | 계획과 동일하게 생성 |
| 8-2 `content-renderers.js` | 10개 contentId 더미 렌더러 | 계획과 동일하게 생성 |
| 8-3 `tab-manager.js` 수정 | 더미 -> `SplitLayout.render()` 호출 | 계획대로 적용 (SearchPanel 연동 부분은 기존 유지) |
| 8-4 유형 C 더미 메뉴 | `vendor_info` 추가 | 계획대로 적용, 검색조건도 함께 추가 |
| 8-5 검증 | 유형 A/B/C 동시 오픈 | 스크린샷으로 전표입력(유형 B) 확인됨 |
| 8-6 데모 코드 정리 | 삭제 | 계획대로 적용, 홈 탭 순수 대시보드로 복원 |

### 계획에 없던 추가 수정 — SplitLayout 마지막 pane 고정 버그

검증 과정에서 발견한 버그를 함께 수정함:

- **증상**: 전표입력(유형 B) 탭에서 검색조건 패널을 접으면, 그 아래 SplitLayout 영역이 맨 아래에 빈 공백으로만 늘어나고 실제 패널들은 크기가 안 바뀌는 현상.
- **원인**: 드래그 로직이 인접한 두 pane을 모두 고정 px로 바꾸는 구조였는데, 마지막 pane까지 고정되면 부모 컨테이너가 커져도 그 남는 공간을 흡수할 pane이 없어짐.
- **수정**: 드래그 시 `nextPane`이 해당 split-container의 마지막 pane이면 고정 px로 바꾸지 않고 `flex-grow`를 그대로 유지하도록 변경.
- **수정 파일**: `static/js/split-layout.js` (`onMove` 함수 내 `isNextLastPane` 분기 추가)

### 검증 결과

- 계정등록(유형 A) — 분할선 없이 그리드 1개만 꽉 채워 표시: 확인됨
- 전표입력(유형 B) — 상하 3단, 분할선 2개 드래그 가능: 확인됨
- 거래처정보관리(유형 C) — 좌우 2단, 우측 서브탭 전환: 확인됨
- 검색조건 패널 접기/펼치기 시 빈 공백 없이 정상 확장: 버그 수정 후 확인됨

**Step 8 상태: 완료** (Step 9로 진행 가능)

---

## Step 9 진행 결과 (9-1~9-3 완료, 9-4~9-6 검토 완료)

### 9-1~9-3 구현 확인

| 항목 | 계획 | 실제 구현 |
|---|---|---|
| 9-1 CDN 로드 | jsDelivr CDN | `base.html`에 `ag-grid-community@31.0.0` 버전 고정하여 추가 완료 |
| 9-2 `ag-grid-theme.css` | 엑셀풍 CSS 변수 오버라이드 | 계획대로 구현, `.kv-form` 스타일까지 추가 구현(계획에 없던 부분, 폼형 화면용) |
| 9-3 `content-renderers.js` | AG Grid 렌더러로 순차 교체 | 10개 contentId 전부 교체 완료. 계획에 없던 `renderKeyValueForm()` 헬퍼 추가로 폼형 화면(관리항목, 거래처정보관리 서브탭)을 그리드와 분리 처리 |

### 계획 대비 추가/변경 사항

- **`renderKeyValueForm()` 신규 추가**: 계획은 모든 화면을 AG Grid로 가정했으나, 실제 참조 이미지(전표입력 관리항목, 거래처정보관리 서브탭)를 다시 확인해보니 그리드가 아니라 key-value 폼 형태임을 발견하고 별도 렌더러를 추가함. 화면 성격에 맞는 렌더러를 선택하는 것이, 모든 곳을 AG Grid로 억지로 맞추는 것보다 나은 선택.
- **Range Selection(셀 다중선택) 미사용 결정**: 계획에는 `enableRangeSelection: true`가 들어있었으나, 이 옵션이 AG Grid 버전에 따라 Community/Enterprise 경계가 달라지는 점을 감안해 `rowSelection: "multiple"`(행 단위 선택, 확실한 Community 기능)만 사용하는 방식으로 더 안전하게 변경.

### 9-4. Enterprise 미사용 체크 — 통과

`content-renderers.js` 전체 검토 결과 `rowGroup`, `masterDetail`, `enterpriseModules`, `ag-grid-enterprise` 어느 곳에도 없음. 체크리스트 4항목 전체 통과.

### 9-5. 성능/스크롤 — 구현 코드 기준 재검토 결과로 계획 수정

- **이중 스크롤바**: `split-layout.js`의 `buildPane()`이 `.split-pane` div 자체를 AG Grid 마운트 대상으로 그대로 쓰고 있어서(AG Grid가 자체 내부 스크롤 처리), 구조적으로 이중 스크롤바가 생길 수 없음을 확인. 별도 대응 불필요.
- **`sizeColumnsToFit()` 호출 타이밍 최적화**: 계획에는 드래그 종료 시점에 호출하도록 적어두었으나, 실제 `content-renderers.js`의 모든 `columnDefs`가 고정 px 폭(비율 기반 flex 컬럼이 아니라 명시적 폭)으로 정의되어 있어서, 분할선을 드래그해도 컬럼 폭 자체는 그대로 유지되고 보이는 영역만 조절됨. 이 최적화는 적용하지 않는 것으로 계획을 수정함 — 강제로 넣으면 설계해둔 고정폭이 임의로 늘어나버려 의도와 다르게 동작할 수 있음.

### 9-6. 검증 체크리스트 (사용자 확인 필요)

- [ ] "계정등록"(유형 A) 탭 — AG Grid 더미 행 5개, 정렬/필터/컬럼 리사이즈 정상 동작
- [ ] 헤더 고정 — 세로 스크롤해도 컬럼 헤더가 화면 상단에 계속 고정되는지
- [ ] 정렬(Sort) — 헤더 클릭 시 오름차순/내림차순/해제 순환
- [ ] "전표입력"(유형 B) 탭 — 헤더/상세그리드는 AG Grid, 관리항목은 key-value 폼으로 각각 독립 동작, 하단 합계 행(pinned) 표시
- [ ] "거래처정보관리"(유형 C) 탭 — 좌측 거래처 리스트 그리드 + 우측 기본/부가/기타정보 서브탭 전환 시 각각 key-value 폼 정상 표시
- [ ] Enterprise 기능 미사용 — 9-4 통과로 확인 완료
- [ ] SplitLayout 분할선 드래그 중에도 그리드가 버벅임 없이 리사이즈되는지 (9-5 분석대로 컬럼 폭은 고정 유지되는 것이 정상)

**Step 9 상태: 9-1~9-5 구현/검토 완료, 9-6 사용자 최종 확인 대기**
