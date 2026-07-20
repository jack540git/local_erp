// sidebar-tree.js
// Step 2: 트리 펼침/접힘(slideDown/slideUp 효과) + hover/active 스타일 제어.
// Step 3에서 추가 예정: 사이드바 자체 접기/펴기(토글 버튼) -> --sidebar-width 변수 변경.
// Step 4에서 연동 예정: 리프 노드 클릭 시 탭 생성 로직 트리거.
//
// 펼침/접힘 애니메이션은 sidebar.css의 CSS Grid(grid-template-rows: 0fr <-> 1fr) 트릭으로 처리.
// JS는 "expanded" 클래스만 토글하면 되고, 높이 계산(scrollHeight)이나 조상 보정 로직이 필요 없다.
// (예전 max-height + JS 계산 방식은 중첩 구조에서 상위 높이를 수동으로 재계산해줘야 했고,
//  그 보정 타이밍 때문에 형제 항목이 잘리거나 2단계로 움직이는 문제가 있었음 -> 구조적으로 해결됨)

document.addEventListener("DOMContentLoaded", function () {
    const treeRoot = document.getElementById("sidebar-tree");
    if (!treeRoot) return;

    // 이벤트 위임: 트리 전체에 클릭 리스너 하나만 걸고, 클릭된 대상이 폴더인지 리프인지로 분기.
    // (트리가 동적으로 늘어나도 리스너를 매번 재등록할 필요 없음)
    treeRoot.addEventListener("click", function (event) {
        const row = event.target.closest(".tree-row");
        if (!row) return;

        const role = row.dataset.role;

        if (role === "folder-toggle") {
            toggleFolder(row.closest(".tree-folder"));
        } else if (role === "leaf") {
            selectLeaf(row.closest(".tree-leaf"));
        }
    });

    function toggleFolder(folderEl) {
        // CSS Grid 트릭 덕분에 클래스만 토글하면 됨 -> 브라우저가 매 프레임마다
        // grid-template-rows: 0fr <-> 1fr 사이를 실제 콘텐츠 크기 기준으로 알아서 보간.
        folderEl.classList.toggle("expanded");
    }

    function selectLeaf(leafEl) {
        // 기존 선택된 리프 노드의 active 클래스 제거 (전체 트리 통틀어 하나만 활성)
        const prevActive = treeRoot.querySelector(".tree-leaf.active");
        if (prevActive && prevActive !== leafEl) {
            prevActive.classList.remove("active");
        }
        leafEl.classList.add("active");

        // Step 4: 리프 노드 클릭 시 tab-manager.js의 TabManager.openTab()을 호출해
        // 해당 메뉴 이름으로 탭을 생성(또는 이미 열려있으면 포커스만 이동)한다.
        const menuKey = leafEl.dataset.menuKey;
        const titleEl = leafEl.querySelector(".tree-label");
        const title = titleEl ? titleEl.textContent : menuKey;

        if (window.TabManager) {
            window.TabManager.openTab(menuKey, title);
        }
    }
});

// ------------------------------------------------------------------
// Step 3: 사이드바 자체 접기/펴치 토글
// --sidebar-width CSS 변수만 변경하면 layout.css의 .app-shell transition이
// 그리드 컴럼 폭을 자동으로 부드럽게 애니메이션 처리해준다.
// ------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", function () {
    const toggleBtn = document.getElementById("sidebar-toggle-btn");
    if (!toggleBtn) return;

    const rootEl = document.documentElement;
    // 페이지 로드 시점의 --sidebar-width 값(layout.css에 정의된 폭)을 "펼침 상태 폭"으로 저장.
    // (CSS에서 이 값을 나중에 바꿔도 JS를 수정할 필요 없이 그대로 반영됨)
    const expandedWidth = getComputedStyle(rootEl).getPropertyValue("--sidebar-width").trim();
    let collapsed = false;

    toggleBtn.addEventListener("click", function () {
        collapsed = !collapsed;
        rootEl.style.setProperty("--sidebar-width", collapsed ? "0px" : expandedWidth);
        toggleBtn.textContent = collapsed ? "▶" : "◀";
    });
});

// ------------------------------------------------------------------
// 1단계(관리자 설정): 사이드바 하단 설정 버튼 클릭 -> 기존 리프 클릭과 동일하게
// TabManager.openTab()을 호출해 "설정" 탭을 연다 (이미 열려있으면 포커스만 이동,
// tab-manager.js의 openTab 중복방지 로직을 그대로 타름).
// 탭 내부 콘텐츠(사용자 목록/권한 화면)은 3단계에서
// screen-layouts.js의 SCREEN_LAYOUTS['admin_settings']로 채운다.
// ------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", function () {
    const settingsBtn = document.getElementById("sidebar-settings-btn");
    if (!settingsBtn) return;

    settingsBtn.addEventListener("click", function () {
        if (window.TabManager) {
            window.TabManager.openTab("admin_settings", "설정");
        }
    });
});
