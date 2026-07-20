// toolbar.js
// 상단 마스터바 툴바(조회/추가/삭제/저장/인쇄/닫기) 버튼 클릭 처리.
// "조회" 버튼만 registry.js의 window.ScreenReloadHandlers와 연동(2026-07 추가).
// 나머지 액션(추가/삭제/저장/인쇄/닫기)은 아직 콘솔 로그만 찍는 더미 단계.

/*
document.addEventListener("DOMContentLoaded", function () {
    const toolbar = document.getElementById("master-toolbar");
    if (!toolbar) return;

    // 이벤트 위임: 버튼이 늘어나도 리스너 재등록 불필요 (sidebar-tree.js와 동일한 패턴)
    toolbar.addEventListener("click", function (event) {
        const btn = event.target.closest(".toolbar-btn");
        if (!btn) return;

        const action = btn.dataset.action;
        console.log("툴바 버튼 클릭:", action);

        // Step 6~8: 여기서 activeTab 기준으로 조회/추가/삭제/저장/인쇄/닫기 실제 동작 연동 예정.
        // 예) switch(action) { case "search": ... case "add": ... }
    });
});
*/

document.addEventListener("DOMContentLoaded", function () {
    const toolbar = document.getElementById("master-toolbar");
    if (!toolbar) return;

    // 활성 탭(.tab-pane.active)을 찾아 menuKey를 역산(tab-manager.js의 id: "tab-" + menuKey 규칙).
    // tab-manager.js를 수정하지 않고, 이미 DOM에 드러난 상태(class="active", data-tab-id)만 읽는다.
    function getActivePane() {
        return document.querySelector("#tab-content-area > .tab-pane.active");
    }

    function getActiveMenuKey(paneEl) {
        if (!paneEl) return null;
        return (paneEl.dataset.tabId || "").replace(/^tab-/, "");
    }

    // 이벤트 위임: 버튼이 늘어나도 리스너 재등록 불필요
    toolbar.addEventListener("click", function (event) {
        const btn = event.target.closest(".toolbar-btn");
        if (!btn) return;

        const action = btn.dataset.action;

        if (action === "search") {
            const activePane = getActivePane();
            const menuKey = getActiveMenuKey(activePane);
            const reloadFn = menuKey && window.ScreenReloadHandlers && window.ScreenReloadHandlers[menuKey];

            if (typeof reloadFn === "function") {
                reloadFn(activePane);
            } else {
                // 조회 핸들러를 등록 안 한 화면(홈 등)이면 무반응 — 에러는 아님, 콘솔 경고만
                console.warn("[toolbar] 조회 핸들러 미등록:", menuKey);
            }
            return;
        }

        console.log("툴바 버튼 클릭:", action);
        // Step 10 이후: 추가/삭제/저장/인쇄/닫기도 필요해지는 화면부터 같은 방식(ScreenXxxHandlers 레지스트리)으로 확장 예정.
    });
});
