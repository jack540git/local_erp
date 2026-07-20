// content-renderers/profit-analysis.js
// 손익관리 도메인: profit_payment_date(지급기준손익)
// registry.js 로드 이후에 실행되어야 함 (registerRenderer, renderAgGrid, renderKeyValueForm 등 사용).
//
// 레이아웃(screen-layouts.js): 유형 C — 좌측 손익 목록그리드 + 우측 "매입"/"관련문서" 서브탭(폼).
// list_grid는 빈 그리드로 시작 -> 탭 최초 오픈 시 1회 자동 조회 + "조회" 버튼(toolbar.js ->
// ScreenReloadHandlers) 클릭 시 재조회. 서브탭 폼 2개는 아직 더미 상태.

(function () {
    // 도메인 내 유일한 list_grid 인스턴스를 가리킨다 (menuKey 중복 방지 덕분에 탭은 항상 하나만 존재).
    let listGridApi = null;

    // 조회조건(지급일자) 값을 읽어 백엔드 호출 -> 그리드 갱신.
    // - 탭 최초 오픈 시 render() 끝에서 1회 자동 호출 (기본값 기준 초기 조회)
    // - 이후 "조회" 버튼 클릭 시 toolbar.js가 registerReload로 등록된 이 함수를 재호출
    // paneEl: 활성 탭의 .tab-pane 엘리먼트 (검색조건 입력을 이 안에서 찾는다)
    function loadProfitByPaymentDate(paneEl) {
        console.log("[손익조회] loadProfitByPaymentDate 진입", paneEl);
        if (!paneEl) return;

        const input = paneEl.querySelector('.search-panel input[name="date"]');
        if (!input) return;

        // blur 포맷("YYYY-MM-DD")이 이미 되어 있을 수도, 아직 숫자만 입력된 상태일 수도 있어
        // 숫자만 다시 뽑아서 방어적으로 재검증한다 (search-panel.js의 isValidYmd/formatYmd 재사용).
        const raw = input.value.replace(/\D/g, "");
        if (raw.length !== 8 || !isValidYmd(raw)) {
            alert("잘못된 날짜 형식입니다._profit-analysis");
//            console.log("[잘못된 날짜 형식입니다._profit-analysis");            
            return;
        }
        const dateStr = formatYmd(raw);
        console.log("[손익조회] API 호출 직전", dateStr);        

        window.ProfitAnalysisAPI.getByPaymentDate(dateStr)
            .then(function (rows) {
                console.log("[손익조회] 백엔드 응답 데이터 (" + rows.length + "건):", rows);
                if (listGridApi) {
                    listGridApi.setGridOption("rowData", rows);
                }

                // Enter로 트리거된 경우(현재 포커스가 이 탭 안의 검색조건 필드에 있는 경우)만
                // blur로 커서를 없애서 "입력칸에 커서가 그대로 남아있는" 어색함을 해소한다.
                // 툴바 버튼 클릭으로 트리거된 경우는 버튼이 paneEl 밖(상단 툴바)에 있어서 자연스럽게 미해당된다.
                // TODO(다음 개선): 조회 결과를 바로 탐색할 수 있도록 그리드 첫 행으로 포커스 이동하는 것도 추가 예정
                // (예: listGridApi.setFocusedCell(0, "project_code")).
                if (document.activeElement && paneEl.contains(document.activeElement)) {
                    document.activeElement.blur();
                }                
            })
            .catch(function (err) {
                alert(err.message || "조회 중 오류가 발생했습니다.");
            });
    }

    registerRenderer("profit_payment_date__list_grid", {
        render: function (el) {
            listGridApi = renderAgGrid(
                el,
                [
                    { field: "doc_id", headerName: "문서ID", width: 118 },
                    { field: "doc_name", headerName: "사업명", width: 180, tooltipField: "doc_name" },
                    { field: "biz_done", headerName: "완료", width: 51 },
                    { field: "expected_sale", headerName: "예상매출", width: 76, type: "numericColumn", filter: "agNumberColumnFilter", valueFormatter: function (p) { return Formatters.currency(p.value); } },
                    { field: "occurred_sale", headerName: "매출", width: 76, type: "numericColumn", filter: "agNumberColumnFilter", valueFormatter: function (p) { return Formatters.currency(p.value); } },
                    { field: "uncollected_sale", headerName: "미수", width: 76, type: "numericColumn", filter: "agNumberColumnFilter", valueFormatter: function (p) { return Formatters.currency(p.value); } },
                    { field: "profit", headerName: "손익", width: 73, type: "numericColumn", filter: "agNumberColumnFilter", valueFormatter: function (p) { return Formatters.currency(p.value); } },
                    { field: "profit_rate", headerName: "손익율", width: 62, valueFormatter: function (p) { return (p.value == null ? "" : p.value + "%"); } },
                    { field: "total_cost", headerName: "원가합계", width: 73, type: "numericColumn", valueFormatter: function (p) { return Formatters.currency(p.value); } },
                    { field: "product_value", headerName: "제품", width: 73, type: "numericColumn", valueFormatter: function (p) { return Formatters.currency(p.value); } },
                    { field: "sum_product", headerName: "상품", width: 73, type: "numericColumn", valueFormatter: function (p) { return Formatters.currency(p.value); } },
                    { field: "sum_construction", headerName: "공사", width: 73, type: "numericColumn", valueFormatter: function (p) { return Formatters.currency(p.value); } },
                    { field: "sum_fee", headerName: "수수료", width: 73, type: "numericColumn", valueFormatter: function (p) { return Formatters.currency(p.value); } },
                    { field: "sum_agency", headerName: "일괄하도", width: 73, type: "numericColumn", valueFormatter: function (p) { return Formatters.currency(p.value); } },
                    { field: "etc_purchase", headerName: "기타", width: 32, type: "numericColumn", valueFormatter: function (p) { return Formatters.currency(p.value); } },
                    { field: "biz_note", headerName: "비고", width: 150, tooltipField: "biz_note" },
//                    { field: "profit_rate", headerName: "손익율", width: 90, valueFormatter: function (p) { return (p.value == null ? "" : p.value + "%"); } },
                ],
                []   // 빈 배열로 시작, 실제 데이터는 아래 초기 자동조회 + "조회" 버튼이 채움
            );

            // 탭 최초 오픈 시 1회 자동 조회 (검색조건의 기본값 기준)
        //    loadProfitByPaymentDate(el.closest(".tab-pane"));
        },
        // ISSUE-08: 탭이 닫힐 때 SplitLayout.destroy(pane) 경유으로 호출된다.
        // admin.js의 list_grid와 동일한 이유로 AG Grid 인스턴스를 명시적으로 destroy한다.
        destroy: function () {
            if (listGridApi) {
                listGridApi.destroy();
                listGridApi = null;
            }
        },
    });

    // "조회" 버튼(toolbar.js)이 활성 탭의 menuKey로 이 함수를 찾아 호출할 수 있도록 등록
    registerReload("profit_payment_date", loadProfitByPaymentDate);
})();

// "매입" 서브탭: 선택된 프로젝트의 매입내역 요약 (그리드가 아니라 key-value 폼 — vendor_info__basic_form 등과 동일 패턴)
registerRenderer("profit_payment_date__revenue_purchase_form", {
    render: function (el) {
        renderKeyValueForm(el, [
            { label: "매입처", value: "(주)대도에프앤비" },
            { label: "매입일자", value: "2026/06/15" },
            { label: "매입액", value: "32,000,000" },
            { label: "지급기준일", value: "2026/07/10" },
            { label: "세금계산서번호", value: "" },
        ]);
    },
});

// "관련문서" 서브탭: 결재문서 등 연결 문서 요약
registerRenderer("profit_payment_date__relation_doc_form", {
    render: function (el) {
        renderKeyValueForm(el, [
            { label: "관련 기안문서", value: "" },
            { label: "계약서 번호", value: "" },
            { label: "첨부파일", value: "" },
        ]);
    },
});
