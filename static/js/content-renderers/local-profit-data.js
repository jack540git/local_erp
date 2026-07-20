// content-renderers/local-profit-data.js
// 손익관리 도메인: local_profit_data(손익현황-로컬)
// registry.js 로드 이후에 실행되어야 함 (registerRenderer, renderAgGrid 등 사용).
//
// 레이아웃(screen-layouts.js): 유형 A — 단일 그리드.
// profit-analysis.js(profit_payment_date)와 흐름은 완전히 동일하고, 상용ERP DB 대신
// 로컬DB(get_local_db_connection)를 조회한다는 점만 다르다.
// 이름 충돌 방지: window.ProfitAnalysisAPI 대신 window.LocalProfitDataAPI 사용
// (loadLocalProfitData/listGridApi는 이 파일의 IIFE 클로저 안에서만 쓰여 다른 파일과 안 겹침).
//
// list_grid는 빈 그리드로 시작 -> "조회" 버튼(toolbar.js -> ScreenReloadHandlers)/Enter 클릭 시 조회.
// profit-analysis.js와 동일하게 탭 최초 오픈 시 자동조회는 하지 않는다 (사용자가 명시적으로 조회 눌러야 함).

(function () {
    // 도메인 내 유일한 list_grid 인스턴스를 가리킨다 (menuKey 중복 방지 덕분에 탭은 항상 하나만 존재).
    let listGridApi = null;

    // 조회조건(기준일자) 값을 읽어 백엔드 호출 -> 그리드 갱신.
    // - "조회" 버튼 클릭/Enter 시 toolbar.js가 registerReload로 등록된 이 함수를 호출
    // paneEl: 활성 탭의 .tab-pane 엘리먼트 (검색조건 입력을 이 안에서 찾는다)
    function loadLocalProfitData(paneEl) {
        if (!paneEl) return;

        const input = paneEl.querySelector('.search-panel input[name="date"]');
        if (!input) return;

        // blur 포맷("YYYY-MM-DD")이 이미 되어 있을 수도, 아직 숫자만 입력된 상태일 수도 있어
        // 숫자만 다시 뽑아서 방어적으로 재검증한다 (search-panel.js의 isValidYmd/formatYmd 재사용).
        const raw = input.value.replace(/\D/g, "");
        if (raw.length !== 8 || !isValidYmd(raw)) {
            alert("잘못된 날짜 형식입니다.");
            return;
        }
        const dateStr = formatYmd(raw);

        window.LocalProfitDataAPI.getByDate(dateStr)
            .then(function (rows) {
                console.log("[손익현황-로컬] 백엔드 응답 데이터 (" + rows.length + "건):", rows);
                if (listGridApi) {
                    listGridApi.setGridOption("rowData", rows);
                }

                // Enter로 트리거된 경우(현재 포커스가 이 탭 안의 검색조건 필드에 있는 경우)만
                // blur로 커서를 없애서 "입력칸에 커서가 그대로 남아있는" 어색함을 해소한다.
                // 툴바 버튼 클릭으로 트리거된 경우는 버튼이 paneEl 밖(상단 툴바)에 있어서 자연스럽게 미해당된다.
                if (document.activeElement && paneEl.contains(document.activeElement)) {
                    document.activeElement.blur();
                }
            })
            .catch(function (err) {
                alert(err.message || "조회 중 오류가 발생했습니다.");
            });
    }

    registerRenderer("local_profit_data__list_grid", {
        render: function (el) {
            listGridApi = renderAgGrid(
                el,
                [
                    { field: "doc_id", headerName: "문서ID", width: 118 },
                    { field: "doc_name", headerName: "사업명", width: 180, tooltipField: "doc_name" },
                    { field: "biz_done", headerName: "완료", width: 60 },
                    { field: "expected_sale", headerName: "예상매출", width: 110, type: "numericColumn", filter: "agNumberColumnFilter", valueFormatter: function (p) { return Formatters.currency(p.value); } },
                    { field: "occurred_sale", headerName: "매출", width: 110, type: "numericColumn", filter: "agNumberColumnFilter", valueFormatter: function (p) { return Formatters.currency(p.value); } },
                    { field: "uncollected_sale", headerName: "미수", width: 110, type: "numericColumn", filter: "agNumberColumnFilter", valueFormatter: function (p) { return Formatters.currency(p.value); } },
                    { field: "profit", headerName: "손익", width: 110, type: "numericColumn", filter: "agNumberColumnFilter", valueFormatter: function (p) { return Formatters.currency(p.value); } },
                    { field: "profit_rate", headerName: "손익율", width: 90, filter: "agNumberColumnFilter", valueFormatter: function (p) { return (p.value == null ? "" : p.value + "%"); } },
                    { field: "total_cost", headerName: "원가합계", width: 110, type: "numericColumn", filter: "agNumberColumnFilter", valueFormatter: function (p) { return Formatters.currency(p.value); } },
                    { field: "biz_note", headerName: "비고", width: 150, tooltipField: "biz_note" },
                ],
                []   // 빈 배열로 시작, 실제 데이터는 "조회" 버튼/Enter가 채움
            );

            // profit-analysis.js와 동일하게 탭 최초 오픈 시 자동조회는 하지 않는다.
            // loadLocalProfitData(el.closest(".tab-pane"));
        },
        // ISSUE-08: 탭이 닫힐 때 SplitLayout.destroy(pane) 경유로 호출된다.
        // admin.js/profit-analysis.js의 list_grid와 동일한 이유로 AG Grid 인스턴스를 명시적으로 destroy한다.
        destroy: function () {
            if (listGridApi) {
                listGridApi.destroy();
                listGridApi = null;
            }
        },
    });

    // "조회" 버튼(toolbar.js)/Enter가 활성 탭의 menuKey로 이 함수를 찾아 호출할 수 있도록 등록
    registerReload("local_profit_data", loadLocalProfitData);
})();
