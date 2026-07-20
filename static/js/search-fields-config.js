// search-fields-config.js
// Step 6 (수정): 메뉴(menuKey)마다 다른 검색조건 필드를 선언하는 설정 데이터.
// SplitLayout의 SCREEN_LAYOUTS와 동일한 설계 원칙 -- 새 화면 추가 시 여기 몇 줄만
// 추가하면 되고, search-panel.js(엔진)는 절대 수정하지 않는다.
//
// 필드 타입: "text" | "select" | "daterange" | "date"
// { type, label, name, placeholder?, options? }

window.SEARCH_FIELDS_CONFIG = {
    "voucher_entry": [
        { type: "text", label: "회계단위", name: "unit", placeholder: "본사" },
        { type: "text", label: "사업장", name: "site", placeholder: "더존 본사" },
        { type: "daterange", label: "발생일자", name: "date_range", placeholder: "2020/08/01 - 2020/08/26" },
        { type: "select", label: "전표상태", name: "status", options: ["승인", "미결", "반려"] },
    ],
    "account_register": [
        { type: "text", label: "계정코드", name: "account_code" },
        { type: "text", label: "계정명", name: "account_name" },
    ],
    "biz_reg_no": [
        { type: "text", label: "거래처명", name: "vendor_name" },
        { type: "text", label: "사업자번호", name: "biz_no" },
    ],
    "tax_invoice_search": [
        { type: "daterange", label: "발생일자", name: "date_range", placeholder: "2020/08/01 - 2020/08/26" },
        { type: "select", label: "세무구분", name: "tax_type", options: ["과세", "영세", "면세"] },
        { type: "text", label: "거래처", name: "vendor_name" },
    ],
    "vendor_info": [
        { type: "text", label: "거래처명", name: "vendor_name" },
        { type: "text", label: "거래처코드", name: "vendor_code" },
        { type: "select", label: "사용여부", name: "use_yn", options: ["전체", "Y", "N"] },
    ],
    "profit_payment_date": [
//        { type: "date", label: "지급일자", name: "date", placeholder: "2025/08/30" },
        { type: "date", label: "지급일자", name: "date", default: "closingDate" },
    ],    
    "local_profit_data": [
        { type: "date", label: "기준일자", name: "date", default: "closingDate" },
    ],
};

// menuKey가 위 목록에 없을 때 사용할 기본 필드 (완전히 빈 화면 방지용 최소 구성)
window.SEARCH_FIELDS_DEFAULT = [
    { type: "text", label: "검색어", name: "keyword" },
];
