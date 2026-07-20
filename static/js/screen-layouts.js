// screen-layouts.js
// Step 8: 화면(menuKey)별 레이아웃 트리 선언. SplitLayout 엔진은 이 데이터를 읽기만 한다.
// 새 화면 추가 시 여기 몇 줄 + content-renderers.js에 렌더 함수 몇 개만 추가하면 끝
// (split-layout.js/tab-manager.js는 절대 수정하지 않는다).
//
// contentId 네이밍 규칙: `${menuKey}__${역할}` 형태로 통일 (예: voucher_entry__header_grid).
// 화면이 많아져도 content-renderers.js 안에서 어떤 화면 소속인지 한눈에 식별 가능하고,
// 우연히 다른 화면과 contentId가 겹치는 사고를 방지한다.

window.SCREEN_LAYOUTS = {
    // 유형 A — 분할 없음
    "account_register": { type: "pane", contentId: "account_register__main_grid" },
    "biz_reg_no": { type: "pane", contentId: "biz_reg_no__main_grid" },
    "tax_invoice_search": { type: "pane", contentId: "tax_invoice_search__main_grid" },

    // 유형 B — 상하 3단 (전표입력: 헤더그리드 + 상세그리드 + 관리항목)
    "voucher_entry": {
        type: "split", direction: "vertical", ratios: [1, 2, 1],
        children: [
            { type: "pane", contentId: "voucher_entry__header_grid", minSize: 80 },
            { type: "pane", contentId: "voucher_entry__detail_grid", minSize: 120 },
            { type: "pane", contentId: "voucher_entry__mgmt_form", minSize: 60 },
        ],
    },

    // 유형 C — 좌우 2단, 우측은 서브탭 (거래처정보관리)
    "vendor_info": {
        type: "split", direction: "horizontal", ratios: [1, 2],
        children: [
            { type: "pane", contentId: "vendor_info__list_grid", minSize: 200 },
            {
                type: "tabs",
                tabs: ["기본정보", "부가정보", "기타정보"],
                contentIds: ["vendor_info__basic_form", "vendor_info__extra_form", "vendor_info__etc_form"],
            },
        ],
    },

    // 유형 C — 관리자 설정(3단계): 좌측 사용자 목록 + 우측 기본정보/권한정보 서브탭
    // 사이드바 하단 설정 버튼(sidebar-tree.js) 클릭 시 TabManager.openTab('admin_settings', ...)로 열린다.
    "admin_settings": {
        type: "split", direction: "horizontal", ratios: [1, 2],
        children: [
            { type: "pane", contentId: "admin_settings__list_grid", minSize: 220 },
            {
                type: "tabs",
                tabs: ["기본정보", "권한정보"],
                contentIds: ["admin_settings__basic_form", "admin_settings__permission_form"],
            },
        ],
    },

    // 유형 C — 지급기준손익: 좌측 손익 + 우측 매입내역/관련문서 서브탭
    "profit_payment_date": {
        type: "split", direction: "horizontal", ratios: [3, 1],
        children: [
            { type: "pane", contentId: "profit_payment_date__list_grid", minSize: 220 },
            {
                type: "tabs",
                tabs: ["매입", "관련문서"],
                contentIds: ["profit_payment_date__revenue_purchase_form", "profit_payment_date__relation_doc_form"],
            },
        ],
    },    

    // 유형 A — 손익현황(로컬): 로컬DB 조회, 단일 그리드 (profit_payment_date와 플로는 동일, DB만 다름)
    "local_profit_data": { type: "pane", contentId: "local_profit_data__list_grid" },
};

// menuKey가 SCREEN_LAYOUTS에 없을 때 기본값 (완전히 빈 탭 방지)
window.SCREEN_LAYOUT_DEFAULT = { type: "pane", contentId: "__default__main_grid" };
