// content-renderers/registry.js
// contentId -> 렌더러 등록소(registry) + 공통 헬퍼(그리드/폼/포맷터).
// 다른 모든 content-renderers/*.js 파일보다 먼저 로드되어야 한다 (base.html 순서 참고).
//
// contentId 네이밍 규칙 (frontend_content_renderers_refactor_plan.md 3장 참고):
//   {menuKey}__{역할}_grid   <- AG Grid 콘텐츠
//   {menuKey}__{역할}_form   <- key-value 폼 콘텐츠

window.ScreenContentRenderers = window.ScreenContentRenderers || {};

// ── Registry 등록 함수: 중복 등록 방지 + 최소 유효성 검사 ──────────────
// def.render(el)  : 필수. 콘텐츠 렌더링.
// def.destroy(el) : 선택. 탭이 닫힐 때(SplitLayout.destroy 경유) 호출됨.
//   AG Grid 인스턴스처럼 render() 안에서 만든 리소스(그리드 api, 타이머, 이벤트 리스너 등)를
//   여기서 정리한다. 없으면 아무 정리도 하지 않는다(과거와 동일한 동작, 하위 호환).
function registerRenderer(contentId, def) {
    if (window.ScreenContentRenderers[contentId]) {
        throw new Error("[registerRenderer] 중복 등록: " + contentId);
    }
    if (!def || typeof def.render !== "function") {
        throw new Error("[registerRenderer] render 함수 누락: " + contentId);
    }
    if (def.destroy && typeof def.destroy !== "function") {
        throw new Error("[registerRenderer] destroy는 함수여야 함: " + contentId);
    }
    if (!/^[a-z0-9_]+__[a-z0-9]+_(grid|form)$/.test(contentId)) {
        console.warn("[registerRenderer] 네이밍 규칙 확인 필요: " + contentId);
    }
    window.ScreenContentRenderers[contentId] = def;
}
window.registerRenderer = registerRenderer;

const AG_GRID_LOCALE_KR = {
    // 텍스트/숫자 필터 조건
    contains: "포함", notContains: "포함 안 함",
    equals: "같음", notEqual: "같지 않음",
    startsWith: "시작 문자", endsWith: "끝 문자",
    blank: "비어있음", notBlank: "비어있지 않음",
    lessThan: "미만", lessThanOrEqual: "이하",
    greaterThan: "초과", greaterThanOrEqual: "이상",
    inRange: "범위", inRangeStart: "시작", inRangeEnd: "끝",
    // 필터 패널 버튼/문구
    filterOoo: "필터...", applyFilter: "적용", resetFilter: "초기화",
    clearFilter: "지우기", andCondition: "그리고", orCondition: "또는",
    // 컬럼 메뉴 / 정렬
    pinColumn: "고정", autosizeThisColumn: "이 열 크기 자동조정",
    sortAscending: "오름차순", sortDescending: "내림차순",
    // 페이징(사용 시)
    page: "페이지", to: "~", of: "/", next: "다음", previous: "이전",
};

// ── 공통 헬퍼: AG Grid 인스턴스 초기화 ──────────────────────────────────
function renderAgGrid(el, columnDefs, rowData, gridOptionsExtra) {
    el.classList.add("ag-theme-alpine", "ag-theme-erp");
    el.style.height = "100%";
    el.style.width = "100%";

    const gridOptions = Object.assign(
        {
            columnDefs: columnDefs,
            rowData: rowData,
            defaultColDef: {
                resizable: true,
                sortable: true,
                filter: true,
            },
            rowSelection: "multiple",
            animateRows: true,
            tooltipShowDelay: 300, // tooltipField가 지정된 열에 마우스를 올리면 표시되는 툴팁 지연시간(ms) - 기본값 2000ms보다 짧게 설정
            localeText: AG_GRID_LOCALE_KR,
        },
        gridOptionsExtra || {}
    );

    return agGrid.createGrid(el, gridOptions);
}
window.renderAgGrid = renderAgGrid;

// ── 공통 헬퍼: key-value 폼 렌더러 (그리드가 아닌 입력항목 나열 화면용) ──────
function renderKeyValueForm(el, fields) {
    el.classList.add("kv-form");
    el.innerHTML = "";
    fields.forEach(function (field) {
        const row = document.createElement("div");
        row.className = "kv-form-row";

        const label = document.createElement("div");
        label.className = "kv-form-label";
        label.textContent = field.label;
        row.appendChild(label);

        const value = document.createElement("div");
        value.className = "kv-form-value";
        const input = document.createElement("input");
        input.type = "text";
        input.value = field.value || "";
        input.readOnly = true; // 실제 DB 연동 전까지는 더미 표시 전용
        value.appendChild(input);
        row.appendChild(value);

        el.appendChild(row);
    });
}
window.renderKeyValueForm = renderKeyValueForm;

// ── 공통 헬퍼: 포맷터 (columnDefs의 valueFormatter 등에서 사용) ────────────
window.Formatters = {
    currency: function (v) {
        if (v == null || v === "") return "";
        return Number(v).toLocaleString();
//        return Number(v).toLocaleString() + "원";
    },
    date: function (v) {
        return v || "";
    },
};

// ── menuKey가 SCREEN_LAYOUTS에 없는 화면의 기본 폴백 ─────────────────────
registerRenderer("__default__main_grid", {
    render: function (el) {
        el.innerHTML = '<div class="split-pane-placeholder">(레이아웃 미지정 화면)</div>';
    },
});

// 조회 툴바 버튼 범용 트리거 레지스트리.
// menuKey(contentId와 달리 화면 단위) -> 재조회 함수. toolbar.js가 "조회" 버튼 클릭 시
// 현재 활성 탭의 menuKey로 이 레지스트리를 찾아 호출한다. 등록 안 한 화면은 조회 버튼이
// 무반응이며(콘솔 경고만), 에러가 나지는 않는다.
window.ScreenReloadHandlers = window.ScreenReloadHandlers || {};

function registerReload(menuKey, fn) {
    if (typeof fn !== "function") {
        throw new Error("[registerReload] fn이 함수가 아님: " + menuKey);
    }
    if (window.ScreenReloadHandlers[menuKey]) {
        throw new Error("[registerReload] 중복 등록: " + menuKey);
    }
    window.ScreenReloadHandlers[menuKey] = fn;
}
window.registerReload = registerReload;
