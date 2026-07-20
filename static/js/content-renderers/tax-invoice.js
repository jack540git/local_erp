// content-renderers/tax-invoice.js
// 세금계산서관리 도메인: biz_reg_no(사업자등록번호), tax_invoice_search(세금계산서조회), vendor_info(거래처정보관리)
// registry.js 로드 이후에 실행되어야 함 (registerRenderer, renderAgGrid 등 사용).

registerRenderer("biz_reg_no__main_grid", {
    render: function (el) {
        renderAgGrid(
            el,
            [
                { field: "vendor_name", headerName: "거래처명", width: 160 },
                { field: "biz_no", headerName: "사업자등록번호", width: 140 },
                { field: "ceo_name", headerName: "대표자명", width: 100 },
                { field: "address", headerName: "주소", width: 260 },
            ],
            [
                { vendor_name: "삼별", biz_no: "921-01-15131", ceo_name: "", address: "" },
                { vendor_name: "Paradise Pusan", biz_no: "454-52-45624", ceo_name: "", address: "" },
                { vendor_name: "신세계", biz_no: "234-52-42352", ceo_name: "", address: "" },
                { vendor_name: "(주)대도에프앤비", biz_no: "120-86-78301", ceo_name: "", address: "" },
            ]
        );
    },
});

registerRenderer("tax_invoice_search__main_grid", {
    render: function (el) {
        renderAgGrid(
            el,
            [
                { field: "issue_date", headerName: "발생일자", width: 110, valueFormatter: function (p) { return Formatters.date(p.value); } },
                { field: "vendor_name", headerName: "거래처명", width: 160 },
                { field: "tax_type", headerName: "세무구분", width: 90 },
                { field: "supply_amount", headerName: "공급가액", width: 120, type: "numericColumn", valueFormatter: function (p) { return Formatters.currency(p.value); } },
                { field: "tax_amount", headerName: "세액", width: 100, type: "numericColumn", valueFormatter: function (p) { return Formatters.currency(p.value); } },
            ],
            [
                { issue_date: "2020-08-19", vendor_name: "삼별", tax_type: "과세", supply_amount: 1000000, tax_amount: 100000 },
                { issue_date: "2020-08-19", vendor_name: "현대", tax_type: "과세", supply_amount: 500000, tax_amount: 50000 },
                { issue_date: "2020-08-19", vendor_name: "Paradise Pusan", tax_type: "영세", supply_amount: 300000, tax_amount: 0 },
            ]
        );
    },
});

// ── 거래처정보관리: 좌측 리스트그리드 + 우측 서브탭 폼 ───────────────────
registerRenderer("vendor_info__list_grid", {
    render: function (el) {
        renderAgGrid(
            el,
            [
                { field: "vendor_code", headerName: "거래처코드", width: 90 },
                { field: "vendor_name", headerName: "거래처명", width: 150 },
                { field: "biz_no", headerName: "사업자등록번호", width: 130 },
                { field: "use_yn", headerName: "사용", width: 60 },
            ],
            [
                { vendor_code: "00001", vendor_name: "삼별", biz_no: "921-01-15131", use_yn: "Y" },
                { vendor_code: "00005", vendor_name: "Paradise Pusan", biz_no: "454-52-45624", use_yn: "Y" },
                { vendor_code: "00007", vendor_name: "하나로", biz_no: "666-66-66666", use_yn: "N" },
                { vendor_code: "00034", vendor_name: "(주)대도에프앤비", biz_no: "120-86-78301", use_yn: "Y" },
            ]
        );
    },
});

// 기존 vendor_info__basic/extra/etc -> 네이밍 규칙에 맞춰 _form 접미사로 변경
registerRenderer("vendor_info__basic_form", {
    render: function (el) {
        renderKeyValueForm(el, [
            { label: "사업자등록번호", value: "921-01-15131" },
            { label: "거래처구분", value: "주요" },
            { label: "대표자명", value: "" },
            { label: "주소", value: "" },
        ]);
    },
});

registerRenderer("vendor_info__extra_form", {
    render: function (el) {
        renderKeyValueForm(el, [
            { label: "거래처담당자", value: "이광일" },
            { label: "핸드폰번호", value: "010-8548-1111" },
            { label: "전화번호", value: "032-881-1211" },
            { label: "E-MAIL주소", value: "" },
        ]);
    },
});

registerRenderer("vendor_info__etc_form", {
    render: function (el) {
        renderKeyValueForm(el, [
            { label: "거래처명(약칭)", value: "" },
            { label: "사용여부", value: "Y" },
            { label: "휴폐업구분", value: "정상" },
            { label: "내외국인", value: "" },
        ]);
    },
});
