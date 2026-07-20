// tab-manager.js
// Step 4: 트리 클릭 -> 탭 생성/중복방지/닫기/전환.
//
// 데이터 구조:
// tabs = [{ id: 'tab-xxx', title: '계정등록', menuKey: 'account_register', closable: true }]
// activeTabId = 'tab-xxx'
//
// 콘텐츠 방식: 각 탭에 대응하는 <div class="tab-pane" data-tab-id="...">를 만들어두고
// active 클래스로 display 토글하는 방식 사용 (지시서 3-2절의 두 가지 제안 중 전자 방식).
// 지금은 Step 4(뼈대) 단계라 각 탭의 콘텐츠는 더미 텍스트만 표시하고,
// Step 6 이후 실제 조회조건/그리드로 이 tab-pane 내부를 채워나갈 예정.

(function () {
    const tabBarEl = document.getElementById("tab-bar");
    const contentAreaEl = document.getElementById("tab-content-area");
    if (!tabBarEl || !contentAreaEl) return;

    // 홈 탭은 항상 존재하며 닫을 수 없음 (지시서 와이어프레임의 "[홈]"에 X가 없는 것과 동일)
    let tabs = [
        { id: "tab-home", title: "홈", menuKey: null, closable: false },
    ];
    let activeTabId = "tab-home";

    function renderTabBar() {
        tabBarEl.innerHTML = "";

        tabs.forEach(function (tab) {
            const tabEl = document.createElement("div");
            tabEl.className = "tab-item" + (tab.id === activeTabId ? " active" : "");
            tabEl.dataset.tabId = tab.id;

            const titleEl = document.createElement("span");
            titleEl.className = "tab-title";
            titleEl.textContent = tab.title;
            tabEl.appendChild(titleEl);

            if (tab.closable) {
                const closeEl = document.createElement("span");
                closeEl.className = "tab-close";
                closeEl.textContent = "✕";
                closeEl.addEventListener("click", function (event) {
                    // 탭 클릭(활성화) 이벤트로 버블링되지 않도록 차단
                    event.stopPropagation();
                    closeTab(tab.id);
                });
                tabEl.appendChild(closeEl);
            }

            tabEl.addEventListener("click", function () {
                activateTab(tab.id);
            });

            tabBarEl.appendChild(tabEl);
        });
    }

    function renderActiveContent() {
        contentAreaEl.querySelectorAll(":scope > .tab-pane").forEach(function (pane) {
            pane.classList.toggle("active", pane.dataset.tabId === activeTabId);
        });
    }

    // ── Lazy Loading: admin_settings처럼 base.html에서 eager 로드하지 않은 도메인 스크립트를
    // 탭을 최초로 열 때만 동적으로 로드한다. eager 도메인은 DOMAIN_SCRIPT_MAP에 없으므로
    // 항상 즉시 resolve되어 지금까지와 동일한 동기적 흐름을 그대로 탄다.
    const DOMAIN_SCRIPT_MAP = {
        admin_settings: "/static/js/content-renderers/admin.js",
        profit_payment_date: "/static/js/content-renderers/profit-analysis.js",
        local_profit_data: "/static/js/content-renderers/local-profit-data.js",
    };
    const _loadedScripts = new Map();

    function loadDomainScriptOnce(menuKey) {
        const url = DOMAIN_SCRIPT_MAP[menuKey];
        if (!url) return Promise.resolve();
        if (_loadedScripts.has(url)) return _loadedScripts.get(url);

        const promise = new Promise(function (resolve, reject) {
            const script = document.createElement("script");
            script.src = url + (window.ASSET_VERSION ? "?v=" + window.ASSET_VERSION : "");
            script.onload = resolve;
            script.onerror = function () {
                script.remove();
                reject(new Error("화면 스크립트 로드 실패: " + url));
            };
            document.body.appendChild(script);
        });

        promise.catch(function () {
            // 실패는 캐싱하지 않음 -> 다음 탭 오픈 시 재시도 가능하게 함 (일시적 네트워크 오류 대비)
            _loadedScripts.delete(url);
        });

        _loadedScripts.set(url, promise);
        return promise;
    }

    function findAnyContentId(node) {
        if (!node) return null;
        if (node.type === "pane") return node.contentId || null;
        if (node.type === "tabs") return (node.contentIds && node.contentIds[0]) || null;
        if (node.type === "split") {
            const children = node.children || [];
            for (let i = 0; i < children.length; i++) {
                const found = findAnyContentId(children[i]);
                if (found) return found;
            }
        }
        return null;
    }

    function isDomainRendererLoaded(menuKey) {
        const layout = (window.SCREEN_LAYOUTS && window.SCREEN_LAYOUTS[menuKey]) || window.SCREEN_LAYOUT_DEFAULT;
        const contentId = findAnyContentId(layout);
        const entry = contentId && window.ScreenContentRenderers && window.ScreenContentRenderers[contentId];
        return !!(entry && typeof entry.render === "function");
    }

    async function ensureContentPane(tab) {
        const existingPane = contentAreaEl.querySelector('.tab-pane[data-tab-id="' + tab.id + '"]');
        if (existingPane) return;

        const pane = document.createElement("div");
        pane.className = "tab-pane";
        pane.dataset.tabId = tab.id;

        // Step 6(수정): 메뉴별 검색조건 패널을 SearchPanel.build(menuKey)로 동적 생성.
        // (SEARCH_FIELDS_CONFIG에 없는 menuKey는 SEARCH_FIELDS_DEFAULT로 폴백)
        if (window.SearchPanel) {
            pane.appendChild(window.SearchPanel.build(tab.menuKey));
        }

        // Step 8: 더미 placeholder 대신, SCREEN_LAYOUTS[tab.menuKey] 기준으로
        // SplitLayout.render()를 호출해서 실제 화면 구조(유형 A/B/C)를 그린다.
        const contentArea = document.createElement("div");
        contentArea.className = "screen-content-area";
        pane.appendChild(contentArea);
        contentAreaEl.appendChild(pane);

        if (window.SplitLayout) {
            const layout = (window.SCREEN_LAYOUTS && window.SCREEN_LAYOUTS[tab.menuKey])
                || window.SCREEN_LAYOUT_DEFAULT;

            if (isDomainRendererLoaded(tab.menuKey)) {
                window.SplitLayout.render(contentArea, layout);
            } else {
                // Lazy 도메인(admin.js 등) 최초 오픈: 스크립트 로드가 끝난 뒤에 렌더해야
                // renderContentInto가 조용히 placeholder로 빠지지 않는다.
                try {
                    await loadDomainScriptOnce(tab.menuKey);
                    window.SplitLayout.render(contentArea, layout);
                } catch (err) {
                    console.error("[ensureContentPane] 화면 로드 실패: " + tab.menuKey, err);
                    contentArea.innerHTML = '<div class="split-pane-placeholder">화면을 불러오지 못했습니다. 탭을 닫고 다시 열어주세요.</div>';
                }
            }
        }
    }

    function activateTab(tabId) {
        activeTabId = tabId;
        renderTabBar();
        renderActiveContent();
    }

    function closeTab(tabId) {
        const idx = tabs.findIndex(function (t) { return t.id === tabId; });
        if (idx === -1) return;

        const wasActive = activeTabId === tabId;
        tabs.splice(idx, 1);

        const pane = contentAreaEl.querySelector('.tab-pane[data-tab-id="' + tabId + '"]');
        if (pane) {
            // ISSUE-08: DOM에서 제거하기 전에 렌더러가 등록해둔 destroy(el)을 먼저 호출해,
            // AG Grid 인스턴스 등 render() 안에서 만든 리소스가 정리되도록 한다.
            // destroy가 없는 렌더러는 아무일도 일어나지 않아 기존과 동일하게 동작한다.
            if (window.SplitLayout && typeof window.SplitLayout.destroy === "function") {
                window.SplitLayout.destroy(pane);
            }
            pane.remove();
        }

        if (wasActive) {
            // 인접 탭(오른쪽 우선) -> 없으면 왼쪽 -> 그래도 없으면 마지막 탭(홈은 항상 남아있어 보장됨)
            const nextTab = tabs[idx] || tabs[idx - 1] || tabs[tabs.length - 1];
            activeTabId = nextTab.id;
        }

        renderTabBar();
        renderActiveContent();
    }

    function openTab(menuKey, title) {
        // 이미 열려있는 메뉴면 새 탭을 만들지 않고 기존 탭으로 포커스만 이동 (중복 탭 방지)
        const existing = tabs.find(function (t) { return t.menuKey === menuKey; });
        if (existing) {
            activateTab(existing.id);
            return;
        }

        const newTab = {
            id: "tab-" + menuKey,
            title: title,
            menuKey: menuKey,
            closable: true,
        };
        tabs.push(newTab);
        ensureContentPane(newTab);
        activateTab(newTab.id);
    }

    // sidebar-tree.js(리프 노드 클릭)에서 호출할 수 있도록 전역에 공개
    window.TabManager = { openTab: openTab };

    // 초기 렌더 (홈 탭)
    renderTabBar();
    renderActiveContent();
})();
