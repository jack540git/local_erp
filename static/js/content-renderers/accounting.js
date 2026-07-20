// content-renderers/accounting.js
// 회계관리 도메인: account_register(계정등록), voucher_entry(전표입력)
// registry.js 로드 이후에 실행되어야 함 (registerRenderer, renderAgGrid 등 사용).
//
// 설계 판단: 참조 스크린샷(ERPiU)을 보면 모든 영역이 그리드는 아니었음.
//   - 리스트/조회성 화면(계정등록, 전표 헤더/상세) -> AG Grid
//   - 폼(입력항목 나열)성 화면(전표입력 관리항목) -> key-value 폼 렌더러
//
// Enterprise 전용 기능(rowGroup, masterDetail, enterpriseModules 등)은 사용하지 않는다.
// Range Selection도 사용하지 않고 rowSelection: "multiple"(행 단위 선택)만 사용한다.

registerRenderer("account_register__main_grid", {
    render: function (el) {
        renderAgGrid(
            el,
            [
                { field: "account_code", headerName: "계정코드", width: 110 },
                { field: "account_name", headerName: "계정명", width: 180 },
                { field: "account_type", headerName: "구분", width: 100 },
            ],
            [
                { account_code: "10100", account_name: "현금", account_type: "자산" },
                { account_code: "10200", account_name: "당좌예금", account_type: "자산" },
                { account_code: "10300", account_name: "보통예금", account_type: "자산" },
                { account_code: "25100", account_name: "외상매입금", account_type: "부채" },
                { account_code: "40100", account_name: "제품매출", account_type: "수익" },
            ]
        );
    },
});

registerRenderer("voucher_entry__header_grid", {
    render: function (el) {
        renderAgGrid(
            el,
            [
                { field: "voucher_no", headerName: "전표번호", width: 150 },
                { field: "acc_date", headerName: "회계일자", width: 100, valueFormatter: function (p) { return Formatters.date(p.value); } },
                { field: "dept", headerName: "작성부서", width: 100 },
                { field: "writer", headerName: "작성사원", width: 90 },
                { field: "memo", headerName: "적요내역", width: 220 },
                { field: "amount", headerName: "금액", width: 110, type: "numericColumn", valueFormatter: function (p) { return Formatters.currency(p.value); } },
                { field: "status", headerName: "상태", width: 80 },
            ],
            [
                { voucher_no: "FI2020081900002", acc_date: "2020-08-19", dept: "임원실", writer: "강경라", memo: "부가세예수금_매출(8월)", amount: 500000, status: "승인" },
            ]
        );
    },
});

registerRenderer("voucher_entry__detail_grid", {
    render: function (el) {
        renderAgGrid(
            el,
            [
                { field: "side", headerName: "차대", width: 70 },
                { field: "account_code", headerName: "계정코드", width: 100 },
                { field: "account_name", headerName: "계정명", width: 130 },
                { field: "memo_name", headerName: "적요명", width: 220 },
                { field: "amount", headerName: "금액", width: 110, type: "numericColumn", valueFormatter: function (p) { return Formatters.currency(p.value); } },
                { field: "vendor_name", headerName: "거래처명", width: 150 },
            ],
            [
                { side: "대변", account_code: "30500", account_name: "부가세예수금", memo_name: "11.과세(세금계산서)-(1)", amount: 100000, vendor_name: "삼별" },
                { side: "대변", account_code: "30500", account_name: "부가세예수금", memo_name: "18.현금영수증(매출)-(3)", amount: 100000, vendor_name: "하나로" },
                { side: "차변", account_code: "10100", account_name: "현금", memo_name: "", amount: 500000, vendor_name: "" },
            ],
            {
                pinnedBottomRowData: [
                    { side: "합계", account_code: "", account_name: "", memo_name: "", amount: 700000, vendor_name: "" },
                ],
            }
        );
    },
});

// 관리항목: 실제 화면(스크린샷)에서도 그리드가 아니라 key-value 형태의 항목 나열이라 폼 렌더러 사용
// (기존 voucher_entry__mgmt_panel -> 네이밍 규칙에 맞춰 voucher_entry__mgmt_form 으로 변경)
registerRenderer("voucher_entry__mgmt_form", {
    render: function (el) {
        renderKeyValueForm(el, [
            { label: "귀속사업장", value: "더존 본사" },
            { label: "발생일자", value: "2020/08/19" },
            { label: "과세표준액", value: "1,000,000" },
            { label: "거래처", value: "(주)대도에프앤비" },
            { label: "사업자등록번호", value: "1208678301" },
            { label: "세무구분", value: "1B  매입자발행세금계산서" },
        ]);
    },
});
