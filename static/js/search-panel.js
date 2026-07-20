// search-panel.js
// Step 6: 검색조건 패널(CollapsibleSearchPanel) 접기/펴기 처리.
// Step 6(수정): menuKey 기반으로 검색조건 패널을 동적 생성하는 build() 함수 추가.
//
// build(menuKey)는 SEARCH_FIELDS_CONFIG[menuKey](없으면 SEARCH_FIELDS_DEFAULT)를 읽어
// .search-panel DOM 엘리먼트를 새로 만들어 반환한다. 필드 타입이 늘어나도(예: "date", "checkbox")
// buildSearchField() 안에 분기 하나만 추가하면 되고, 호출하는 쪽(tab-manager.js 등)은
// 수정할 필요가 없다 -- SCREEN_LAYOUTS/CONTENT_RENDERERS와 동일한 설계 원칙.

document.addEventListener("DOMContentLoaded", function () {
    // 이벤트 위임(document 레벨) -> 나중에 동적으로 생성되는 패널에도 자동 적용됨
    document.addEventListener("click", function (event) {
        const toggleBtn = event.target.closest(".search-panel-toggle");
        if (!toggleBtn) return;

        const panel = toggleBtn.closest(".search-panel");
        if (!panel) return;

        panel.classList.toggle("collapsed");
    });

    // 검색조건 필드에서 Enter 입력 → "조회" 툴바 버튼을 실제로 클릭시켜 호출.
    // toolbar.js의 기존 클릭 핸들러(활성 탭 찾기 -> ScreenReloadHandlers 호출)를 그대로 재사용해서,
    // 여기서는 검색조건 범위 판단만 하고 실제 조회 로직은 중복 구현하지 않는다.
    document.addEventListener("keydown", function (event) {
        if (event.key !== "Enter") return;

        const field = event.target.closest(".search-panel input, .search-panel select");
        if (!field) return;

        event.preventDefault(); // 혹시 모를 기본 동작(폼 제출 등)이 있다면 막음

        const searchBtn = document.querySelector('.toolbar-btn[data-action="search"]');
        if (searchBtn) searchBtn.click();
    });
});

function isValidYmd(raw8) {
    if (!/^\d{8}$/.test(raw8)) return false;
    const y = parseInt(raw8.slice(0, 4), 10);
    const m = parseInt(raw8.slice(4, 6), 10);
    const d = parseInt(raw8.slice(6, 8), 10);
    // new Date(y, m-1, d)로 만들어서 다시 각 필드를 읽었을 때 그대로인지 확인
    // (2월 31일 같은 존재하지 않는 날짜는 3월로 넘어가버려서 이 검사에 걸림, 윤년도 자동 처리됨)
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function formatYmd(raw8) {
    return raw8.slice(0, 4) + "-" + raw8.slice(4, 6) + "-" + raw8.slice(6, 8);
}

// 날짜 필드의 기본값 규칙. search-fields-config.js에서 `default: "today"` 처럼
// 이름만 참조하면 되고, 규칙이 늘어나도 여기만 추가하면 된다 (Formatters와 동일한 레지스트리 패턴).
window.DateDefaultRules = {
    today: function () {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(now.getDate()).padStart(2, "0");
        return "" + y + m + d; // 원시 8자리 문자열(YYYYMMDD)로 반환
    },

    // 마감일 계산 규칙 (파이썬 원본을 그대로 포팅):
    //   1~10일   : 10일 (토요일이면 +2일, 일요일이면 +1일 -> 월요일)
    //   11~20일  : 11일 또는 12일이 월요일이면 10일, 아니면 20일(토=+2, 일=+1)
    //   21일~말일: 그 달의 마지막 날(토요일이면 -1일, 일요일이면 -2일 -> 금요일)
    // 주의: 파이썬 date.weekday()는 월=0..일=6이지만, JS Date.getDay()는 일=0..토=6이라
    // 포팅 시 요일 인덱스를 다시 매핑해야 함 (토=6, 일=0, 월=1).
    closingDate: function () {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const day = today.getDate();
        let target;

        if (day >= 1 && day <= 10) {
            target = new Date(year, month, 10);
            const w = target.getDay();
            if (w === 6) target.setDate(target.getDate() + 2);
            else if (w === 0) target.setDate(target.getDate() + 1);
        } else if (day >= 11 && day <= 20) {
            const d11 = new Date(year, month, 11);
            const d12 = new Date(year, month, 12);
            if (d11.getDay() === 1 || d12.getDay() === 1) {
                target = new Date(year, month, 10);
            } else {
                target = new Date(year, month, 20);
                const w = target.getDay();
                if (w === 6) target.setDate(target.getDate() + 2);
                else if (w === 0) target.setDate(target.getDate() + 1);
            }
        } else {
            target = new Date(year, month + 1, 0); // 다음달 1일 - 1일 = 이번달 마지막날
            const w = target.getDay();
            if (w === 6) target.setDate(target.getDate() - 1);
            else if (w === 0) target.setDate(target.getDate() - 2);
        }

        const y = target.getFullYear();
        const m = String(target.getMonth() + 1).padStart(2, "0");
        const d = String(target.getDate()).padStart(2, "0");
        return "" + y + m + d;
    },
};

function buildSearchField(field) {
    const wrap = document.createElement("div");
    wrap.className = "search-field";

    const label = document.createElement("label");
    label.textContent = field.label;
    wrap.appendChild(label);

    if (field.type === "select") {
        const select = document.createElement("select");
        select.name = field.name;
        (field.options || []).forEach(function (optionText) {
            const option = document.createElement("option");
            option.value = optionText;
            option.textContent = optionText;
            select.appendChild(option);
        });
        wrap.appendChild(select);
    } else if (field.type === "date") {
        // 정식 "date" 타입: 숫자 8자리만 입력 → blur 시 YYYY-MM-DD로 포맷 + 유효성 검증.
        // 네이티브 <input type="date">를 안 쓰는 이유: 요구사항(숫자만/8자리 마스킹/포커스 시 전체선택)은
        // 브라우저 기본 date input으로는 구현 불가능해서 직접 구현.
        const input = document.createElement("input");
        input.type = "text";
        input.name = field.name;
        input.inputMode = "numeric";
        input.maxLength = 8; // 포맷팅 전(숫자만 입력 중) 기준. 포맷팅 후(YYYY-MM-DD, 10자)는 JS로 값을 직접 대입하므로 영향 없음.
        if (field.placeholder) input.placeholder = field.placeholder;

        // 1) 숫자(0~9)만 허용, 8자리로 cap
        input.addEventListener("input", function () {
            input.value = input.value.replace(/\D/g, "").slice(0, 8);
        });

        // 4) 포커스 진입 시 전체 선택 (기존 값이 있으면 바로 덮어쓰기 가능)
        input.addEventListener("focus", function () {
            input.select();
        });

        // 3) 포커스 이탈(blur) 시 포맷만 담당. 검증(alert)은 여기서 하지 않음.
        // 이유: "조회" 실행 시점의 검증(profit-analysis.js 등 loadXxx 함수)이 유일한 검증 지점이어야
        // 두 가지 문제가 동시에 사라진다:
        //   1) blur 검증과 조회 검증이 둘 다 alert를 띄우면 같은 에러가 2번 뜨는 문제
        //   2) blur 핸들러 안에서 alert() 후 input.focus()를 다시 불러오면(심지어 setTimeout으로
        //      미뤄도), "조회" 버튼을 실제 마우스로 클릭해 blur가 발생한 상황에서는, blur 처리 중
        //      포커스를 강제로 되돌리는 것과 버튼 클릭이 충돌하면서 blur->alert->focus->blur가
        //      반복되는 무한루프가 발생함.
        // 해결: blur에서는 유효할 때만 포맷하고, 유효하지 않으면 원시 숫자를 그대로 둔다
        // (alert X, focus() 호출 X).
        input.addEventListener("blur", function () {
            const raw = input.value.replace(/\D/g, "");
            if (raw.length === 0) return; // 검색조건이라 빈 값은 허용 (선택 입력)
            if (isValidYmd(raw)) {
                input.value = formatYmd(raw);
            }
            // 유효하지 않으면 아무것도 하지 않음 -> 사용자가 다시 클릭(focus 리스너가 select() 호출)해서
            // 이어서 수정하면 된다. 에러 표시는 "조회" 실행 시점에만 한다.
        });

        // 6) 신규 탭 생성 시에만 기본값 자동입력 (buildSearchField는 SearchPanel.build()가 호출될 때만
        // 실행되고, SearchPanel.build()는 tab-manager.js의 ensureContentPane()에서 새 탭을 만들 때만
        // 호출되므로, 여기서 기본값을 채워두면 "신규 탭에만 적용"이 자동으로 보장된다.)
        if (field.default && window.DateDefaultRules && window.DateDefaultRules[field.default]) {
            const raw = window.DateDefaultRules[field.default]();
            if (isValidYmd(raw)) {
                input.value = formatYmd(raw);
            }
        }

        wrap.appendChild(input);
    } else {
        // "text"와 "daterange"는 지금 단계(더미)에서는 동일하게 단일 텍스트 입력으로 처리.
        // 실제 달력 위젯 등은 Step 10(DB 연동) 시점에 필요하면 별도로 교체 예정.
        const input = document.createElement("input");
        input.type = "text";
        input.name = field.name;
        if (field.placeholder) input.placeholder = field.placeholder;
        wrap.appendChild(input);
    }

    return wrap;
}

function buildSearchPanel(menuKey) {
    const fields = (window.SEARCH_FIELDS_CONFIG && window.SEARCH_FIELDS_CONFIG[menuKey])
        || window.SEARCH_FIELDS_DEFAULT
        || [];

    const panel = document.createElement("div");
    panel.className = "search-panel";
    panel.dataset.menuKey = menuKey || "";

    panel.innerHTML =
        '<div class="search-panel-header">' +
            '<span class="search-panel-title">조회조건</span>' +
            '<button type="button" class="search-panel-toggle" aria-label="검색조건 토글"><i class="fa-solid fa-chevron-up"></i></button>' +
        "</div>" +
        '<div class="search-panel-body">' +
            '<div class="search-panel-body-inner">' +
                '<div class="search-panel-fields"></div>' +
            "</div>" +
        "</div>";

    const fieldsEl = panel.querySelector(".search-panel-fields");
    fields.forEach(function (field) {
        fieldsEl.appendChild(buildSearchField(field));
    });

    return panel;
}

// tab-manager.js 등 외부에서 호출할 수 있도록 전역에 공개
window.SearchPanel = { build: buildSearchPanel };
