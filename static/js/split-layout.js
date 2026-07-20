// split-layout.js
// Step 7: 범용 분할 레이아웃 엔진(SplitLayout).
//
// 레이아웃 트리를 재귀적으로 읽어서 DOM을 그린다. 트리 노드 3종류:
//   { type: "pane",  contentId: "xxx", minSize: 40 }
//   { type: "split", direction: "vertical"|"horizontal", ratios: [..], children: [...] }
//   { type: "tabs",  tabs: ["제목1", ...], contentIds: ["id1", ...] }
//
// 화면(메뉴)마다 다른 건 이 트리 데이터뿐이고, 엔진 코드는 절대 수정하지 않는다.
// 실제 콘텐츠는 contentId 기준으로 window.ScreenContentRenderers에 등록된 함수에 위임
// (Step 8에서 screen-layouts.js가 이 레지스트리를 채움. 지금은 비어있어도 동작하도록
// fallback 플레이스홀더를 그려준다).

(function () {
    function render(containerEl, layoutNode) {
        containerEl.innerHTML = "";
        containerEl.appendChild(buildNode(layoutNode));
    }

    // ISSUE-08: 탭이 닫힐 때 tab-manager.js가 pane을 DOM에서 제거(pane.remove())하기 "전"에
    // 호출해야 하는 정리 함수. containerEl(탭의 .tab-pane) 하위에서 buildPane()이 심어둔
    // data-content-id 속성을 가진 모든 노드를 찾아, registerRenderer()에 destroy(el)가
    // 등록되어 있으면 호출한다. destroy가 없는 렌더러는 그냥 건너뛴다(하위 호환, 동작 변화 없음).
    // render()와 대칭되도록 이 파일에 둔다 — contentId <-> 렌더러 매핑을 아는 곳이 여기뿐이라
    // tab-manager.js가 직접 registry를 뒤지지 않아도 되게 한다.
    function destroy(containerEl) {
        if (!containerEl) return;
        const renderers = window.ScreenContentRenderers || {};
        containerEl.querySelectorAll("[data-content-id]").forEach(function (el) {
            const contentId = el.dataset.contentId;
            const entry = contentId ? renderers[contentId] : null;
            if (entry && typeof entry.destroy === "function") {
                try {
                    entry.destroy(el);
                } catch (err) {
                    console.error("[SplitLayout.destroy] destroy 실행 중 오류: " + contentId, err);
                }
            }
        });
    }

    function buildNode(node) {
        if (!node) return buildPane({});
        if (node.type === "split") return buildSplit(node);
        if (node.type === "tabs") return buildTabs(node);
        return buildPane(node); // 기본값: type: "pane" (또는 알 수 없는 타입 -> pane 취급)
    }

    function buildPane(node) {
        const el = document.createElement("div");
        el.className = "split-pane";
        if (node.contentId) el.dataset.contentId = node.contentId;
        renderContentInto(el, node.contentId);
        return el;
    }

    // contentId에 등록된 렌더러가 있으면 그걸로, 없으면 더미 플레이스홀더로 채움.
    // registry.js의 registerRenderer(contentId, { render: fn })로 등록된 객체를 불러와서
    // entry.render(el)로 호출하는 것이 현재 규약(2026-07 리팩터링 이후). 구버전에 단순 함수로
    // 직접 등록하던 방식도 혹시 있을 경우를 대비해 함경으로 지원한다.
    function renderContentInto(el, contentId) {
        const renderers = window.ScreenContentRenderers || {};
        const entry = contentId ? renderers[contentId] : null;

        if (entry && typeof entry.render === "function") {
            entry.render(el);
            return;
        }
        if (typeof entry === "function") {
            // 구버전 호환(함수 직접 등록 방식)
            entry(el);
            return;
        }

        const placeholder = document.createElement("div");
        placeholder.className = "split-pane-placeholder";
        placeholder.textContent = (contentId || "(빈 영역)") + " — 콘텐츠 자리 (더미, Step 9에서 AG Grid로 교체 예정)";
        el.appendChild(placeholder);
    }

    function buildSplit(node) {
        const container = document.createElement("div");
        container.className = "split-container";
        const direction = node.direction === "horizontal" ? "horizontal" : "vertical";
        container.dataset.direction = direction;

        const children = node.children || [];
        const ratios = (node.ratios && node.ratios.length === children.length)
            ? node.ratios
            : children.map(function () { return 1; });

        children.forEach(function (childNode, idx) {
            const childEl = buildNode(childNode);
            const grow = ratios[idx];
            // 초기 크기는 비율(flex-grow) 기반. flex-basis는 0으로 둬서 grow 비율대로만 분배.
            childEl.style.flex = grow + " 1 0px";
            childEl.dataset.minSize = childNode.minSize != null ? childNode.minSize : 40;
            container.appendChild(childEl);

            if (idx < children.length - 1) {
                const bar = document.createElement("div");
                bar.className = "split-bar";
                container.appendChild(bar);
            }
        });

        // pane/bar가 전부 DOM에 붙은 뒤, 각 bar에 드래그 핸들러 연결
        // (bar.previousElementSibling / nextElementSibling으로 인접 pane을 정확히 찾기 위해)
        container.querySelectorAll(":scope > .split-bar").forEach(function (bar) {
            attachDrag(bar, direction);
        });

        return container;
    }

    function attachDrag(bar, direction) {
        const isVertical = direction === "vertical"; // 상하 배치 -> 세로(Y) 드래그로 높이 조절

        bar.addEventListener("mousedown", function (event) {
            event.preventDefault();
            const prevPane = bar.previousElementSibling;
            const nextPane = bar.nextElementSibling;
            if (!prevPane || !nextPane) return;

            const startPos = isVertical ? event.clientY : event.clientX;
            const prevStartSize = isVertical ? prevPane.getBoundingClientRect().height : prevPane.getBoundingClientRect().width;
            const nextStartSize = isVertical ? nextPane.getBoundingClientRect().height : nextPane.getBoundingClientRect().width;
            const prevMin = parseFloat(prevPane.dataset.minSize) || 40;
            const nextMin = parseFloat(nextPane.dataset.minSize) || 40;

            bar.classList.add("dragging");
            document.body.style.cursor = isVertical ? "row-resize" : "col-resize";
            document.body.style.userSelect = "none";

            function onMove(moveEvent) {
                const currentPos = isVertical ? moveEvent.clientY : moveEvent.clientX;
                let delta = currentPos - startPos;
                let newPrev = prevStartSize + delta;
                let newNext = nextStartSize - delta;

                // 최소 크기 아래로는 못 내려가도록 clamp (한쪽이 최소치에 닿으면 delta 자체를 보정)
                if (newPrev < prevMin) {
                    delta = prevMin - prevStartSize;
                    newPrev = prevMin;
                    newNext = nextStartSize - delta;
                } else if (newNext < nextMin) {
                    delta = nextStartSize - nextMin;
                    newNext = nextMin;
                    newPrev = prevStartSize + delta;
                }

                // prevPane은 항상 고정 px로 전환.
                prevPane.style.flex = "0 0 " + newPrev + "px";

                // ⚠ nextPane이 이 split-container의 마지막 pane이면 flex-grow를 그대로 유지한다
                // (고정 px로 바꾸지 않음). 그래야 검색조건 패널이 접히거나 펼쳐져
                // 부모(screen-content-area)의 높이가 변할 때 그 남는/모자란 공간을 항상 마지막
                // pane이 흡수하게 되고, 몇 번을 드래그하든 마지막 pane은 항상 탄력적으로 남은
                // 높이를 채우므로 하단에 빈 공백이 생길 수 없다.
                const isNextLastPane = nextPane === bar.parentElement.lastElementChild;
                if (!isNextLastPane) {
                    nextPane.style.flex = "0 0 " + newNext + "px";
                }
            }

            function onUp() {
                bar.classList.remove("dragging");
                document.body.style.cursor = "";
                document.body.style.userSelect = "";
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
            }

            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
        });
    }

    function buildTabs(node) {
        const wrap = document.createElement("div");
        wrap.className = "split-tabs";

        const tabBar = document.createElement("div");
        tabBar.className = "split-tabs-bar";
        wrap.appendChild(tabBar);

        const contentWrap = document.createElement("div");
        contentWrap.className = "split-tabs-content";
        wrap.appendChild(contentWrap);

        const tabs = node.tabs || [];
        const contentIds = node.contentIds || [];

        tabs.forEach(function (tabTitle, idx) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "split-tab-btn" + (idx === 0 ? " active" : "");
            btn.textContent = tabTitle;
            btn.dataset.tabIdx = String(idx);
            tabBar.appendChild(btn);

            const pane = document.createElement("div");
            pane.className = "split-tab-pane" + (idx === 0 ? " active" : "");
            pane.dataset.tabIdx = String(idx);
            renderContentInto(pane, contentIds[idx]);
            contentWrap.appendChild(pane);
        });

        // 서브탭은 이벤트 위임을 wrap 단위로 걸어도 되지만, 이 컴포넌트는 buildTabs 호출 시점에만
        // 존재가 확정되므로 로컬 리스너로 충분 (동적으로 늘어나는 구조가 아님).
        tabBar.addEventListener("click", function (event) {
            const btn = event.target.closest(".split-tab-btn");
            if (!btn) return;
            const idx = btn.dataset.tabIdx;

            tabBar.querySelectorAll(".split-tab-btn").forEach(function (b) {
                b.classList.toggle("active", b === btn);
            });
            contentWrap.querySelectorAll(".split-tab-pane").forEach(function (p) {
                p.classList.toggle("active", p.dataset.tabIdx === idx);
            });
        });

        return wrap;
    }

    window.SplitLayout = { render: render, destroy: destroy };
})();
