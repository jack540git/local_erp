# ERP UI 스켈레톤 개발 — 다음 단계 예정

> 완료된 단계(Step 1~5)의 상세 작업 기록은 `erp_ui_progress.md`를 참고.
> 이 파일은 `erp_ui_progress.md` 파일 크기가 커져서, **아직 진행하지 않은 단계**만 분리해서 관리하기 위한 파일이다.
> 각 Step이 완료되면, 이 파일의 해당 행을 "완료"로 표시하고 상세 작업 내용은 `erp_ui_progress.md`에 새 섹션으로 추가한다.

---

## 우측 메인 상세 영역(Right Main Content) 구현 방안 — 레이아웃 엔진 + 설정 기반 방식

> 참조 스크린샷(ERPiU) 4장 분석 결과, 화면(메뉴)마다 요구되는 분할 구조가 다름:
> - **유형 A (단일)**: 사업자등록번호, 세금계산서조회 — 검색조건 + 그리드 1개, 분할 없음
> - **유형 B (상하 N단)**: 전표입력 — 검색조건 + 헤더그리드 + 상세그리드 + 관리항목 패널 (3단 분할)
> - **유형 C (좌우 2단)**: 거래처정보관리 — 검색조건 + 좌측 리스트그리드 + 우측 탭 폼
>
> 이 구조를 화면마다 새로 코딩하지 않고, **레이아웃 엔진 1개 + 화면별 설정(config) 데이터**로 처리하기로 결정함.
> 엔진은 "분할 방향 + 자식 pane 목록"을 재귀적으로 표현하는 트리 데이터를 읽어서 그리기만 하고,
> 실제 화면 내용(그리드/폼)은 `contentId` 기준으로 별도 렌더러 함수에 위임 — **레이아웃과 내용을 완전히 분리**.

### 핵심 설계 원칙

1. **레이아웃 엔진(`SplitLayout`)은 한 번만 작성**하고, 어떤 화면이 추가돼도 엔진 코드는 수정하지 않는다.
2. **화면별 레이아웃은 데이터(트리 구조)로 선언**한다 (`screen_layouts.py` 또는 JS 설정 객체) — menuKey마다 몇 줄만 추가하면 새 화면의 분할 구조가 완성됨.
3. **콘텐츠는 `contentId` 기준 렌더러 함수로 분리** — Step 9(AG Grid)에서 더미 pane을 실제 그리드로 교체할 때, 레이아웃 코드는 손대지 않는다.
4. 각 pane은 `overflow: auto`로 **독립 스크롤** 보장.
5. 분할선(Splitter)은 드래그로 크기 조절 가능, 트리 깊이 제한 없이 **중첩 가능** (유형 C의 우측 탭 안에 다시 분할이 들어가는 경우 등도 커버).

### 레이아웃 트리 데이터 예시

```js
SCREEN_LAYOUTS = {
    // 유형 A — 분할 없음
    "tax_invoice_list": {
        type: "pane", contentId: "main_grid"
    },

    // 유형 B — 상하 3단
    "voucher_entry": {
        type: "split", direction: "vertical", ratios: [30, 50, 20],
        children: [
            { type: "pane", contentId: "header_grid" },
            { type: "pane", contentId: "detail_grid" },
            { type: "pane", contentId: "mgmt_panel" },
        ]
    },

    // 유형 C — 좌우 2단, 우측 안에 탭
    "vendor_info": {
        type: "split", direction: "horizontal", ratios: [35, 65],
        children: [
            { type: "pane", contentId: "list_grid" },
            { type: "tabs", tabs: ["기본정보", "부가정보", "기타정보"],
              contentIds: ["detail_basic", "detail_extra", "detail_etc"] },
        ]
    },
};
```

```js
// contentId -> 실제 렌더 함수 매핑. Step 9(AG Grid)에서 이 부분만 확장/교체.
CONTENT_RENDERERS = {
    "main_grid":    (el) => renderMainGrid(el),
    "header_grid":  (el) => renderHeaderGrid(el),
    "detail_grid":  (el) => renderDetailGrid(el),
    "mgmt_panel":   (el) => renderMgmtPanel(el),
    "list_grid":    (el) => renderVendorList(el),
    "detail_basic": (el) => renderVendorBasicForm(el),
    // ...
};
```

새 화면 추가 시 해야 할 일은 오직: ① `SCREEN_LAYOUTS`에 트리 몇 줄 추가, ② `CONTENT_RENDERERS`에 그 화면 전용 렌더 함수 추가 — 이 두 가지뿐. `SplitLayout` 엔진, `CollapsibleSearchPanel`, Splitter 드래그 로직은 전혀 수정하지 않는다.

---

## 남은 단계 (세분화된 실행 계획)

| Step | 내용 | 상태 |
|---|---|---|
| 6 | 상단 검색조건 패널(`CollapsibleSearchPanel`) 공통 컴포넌트 | 예정 |
| 7 | 범용 분할 레이아웃 엔진(`SplitLayout`) — 재귀 트리 파싱 + Splitter 드래그 리사이즈 + 개별 스크롤 | 예정 |
| 8 | 화면별 레이아웃 설정(`SCREEN_LAYOUTS`) + 콘텐츠 렌더러(`CONTENT_RENDERERS`) 구조 정립, 더미 pane으로 유형 A/B/C 전부 검증 | 예정 |
| 9 | AG Grid Community 설치, 더미 pane → 실제 그리드 렌더러로 교체, 엑셀풍 테마 | 예정 |
| 10 | PostgreSQL 연동 API 추가 (별도 요청 시 진행) | 보류 |

### Step 6 — CollapsibleSearchPanel (검색조건 접기/펴기)

- **목표**: 모든 화면(유형 A/B/C 공통) 최상단에 들어갈 검색조건 영역을, 접기/펴기 가능한 독립 컴포넌트로 구현.
- **적용 기술**: 트리메뉴 때 검증된 CSS Grid `grid-template-rows: 0fr <-> 1fr` 트릭 재사용 (max-height 방식의 중첩 버그를 이미 경험했으므로 처음부터 fr 방식으로 시작).
- **예상 파일**: `static/css/search-panel.css`(신규), `static/js/search-panel.js`(신규)
- **검증**: 접기/펴기 버튼 클릭 시 부드럽게 전환, 접었을 때 아래 콘텐츠 영역이 자동으로 늘어나는지(높이 재계산).

### Step 7 — SplitLayout 엔진 (핵심)

- **목표**: 레이아웃 트리 데이터를 받아 재귀적으로 DOM을 그리고, pane 사이에 드래그 가능한 Splitter를 삽입하는 범용 엔진 작성.
- **세부 기능**:
  - `direction: "vertical"`(상하) / `"horizontal"`(좌우) 분기
  - `ratios` 배열 기준 초기 크기 분배 (예: `[30, 50, 20]` → 각 pane의 flex-basis 또는 px 크기)
  - Splitter 드래그 시 인접한 두 pane의 크기만 재계산 (`mousedown` → `mousemove`로 delta 계산 → `mouseup`에서 최종 확정)
  - 각 pane에 `overflow: auto` 고정 → 독립 스크롤
  - `type: "tabs"` 노드 지원 (유형 C의 우측 탭 폼) — Step 4의 `tab-manager.js`와는 별개로, 화면 내부의 서브탭 전용 경량 로직
  - 재귀 호출로 몇 단이든 중첩 가능하게 설계 (트리 깊이 제한 없음)
- **예상 파일**: `static/css/split-layout.css`(신규), `static/js/split-layout.js`(신규, 기존 `splitter.js` 빈 파일을 이 용도로 채움)
- **드래그 크기 기억 여부**: 이번 단계는 **매번 기본 비율로 리셋**하는 단순한 방식으로 시작 (localStorage 저장은 필요 시 이후 별도 요청으로 진행).
- **검증**: 유형 A(분할 없음) / 유형 B(상하 3단, 더미 색상 블록) / 유형 C(좌우 2단, 더미 색상 블록)를 테스트 페이지에서 각각 렌더링해보고, 분할선 드래그로 크기가 정상 조절되는지, 각 pane이 내용 넘칠 때 자기 영역만 스크롤되는지 확인.

### Step 8 — 화면별 레이아웃 설정 + 콘텐츠 렌더러 구조 정립

- **목표**: `SCREEN_LAYOUTS`, `CONTENT_RENDERERS` 두 매핑 구조를 실제로 만들고, 기존 Step 4(탭 매니저)의 `ensureContentPane()`이 탭을 열 때 이 설정을 참조해서 `SplitLayout`을 실제로 그리도록 연결.
- **더미 콘텐츠**: 각 `contentId` 렌더러는 지금 단계에서는 "타이틀 + contentId" 텍스트만 표시 (Step 4의 더미 탭 콘텐츠와 동일한 패턴).
- **검증 대상 메뉴(더미 데이터에 유형 매핑 추가)**:
  - `account_register`(계정등록) 등 → 유형 A
  - `voucher_entry`(전표입력) → 유형 B
  - 신규 더미 메뉴 1개 → 유형 C (실제 거래처정보관리 메뉴가 아직 없다면 더미로 하나 추가)
- **검증**: 트리에서 서로 다른 유형의 메뉴 3개를 클릭 → 탭 생성 시 각각 다른 분할 구조(A/B/C)로 정상 렌더링되는지 확인.

### Step 9 — AG Grid Community 연동 (기존 계획 유지)

- Step 7~8에서 만든 `main_grid`, `header_grid`, `detail_grid`, `list_grid` 등 더미 pane을 실제 AG Grid 인스턴스로 교체.
- 엑셀풍 테마(`ag-grid-theme.css`, Step 1에서 미리 만들어둔 빈 파일) 적용.
- 레이아웃 엔진(Step 7)이 각 pane의 실제 크기(px)를 이미 계산해주므로, AG Grid는 그 크기에 맞춰 `100%` 폭/높이로만 초기화하면 됨.

### Step 10 — PostgreSQL 연동 API (보류, 기존 Step 9와 동일)

- 별도 요청 시 진행. 위 단계들이 다 끝난 뒤, 더미 데이터를 실제 DB 조회 결과로 교체.

---

> 위 순서(6 → 7 → 8 → 9)대로 한 단계씩 요청받아 진행하고 매 단계마다 확인 예정.
> Step 7(SplitLayout 엔진)이 프로젝트 전체에서 가장 중요한 핵심 컴포넌트이므로, 이 단계는 특히 꼼꼼히 검증한 뒤 다음으로 넘어갈 것.
