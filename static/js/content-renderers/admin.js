// content-renderers/admin.js
// 관리자 설정(3단계): 좌측 사용자 목록(AG Grid, 실제 DB 연동) + 우측 기본정보/권한정보 서브탭.
// 다른 도메인 파일과 달리 base.html에서 eager 로드하지 않고, admin_settings 탭을 최초로 열 때
// tab-manager.js의 Lazy Loading으로 동적 로드된다 (DOMAIN_SCRIPT_MAP 참고).
//
// registry.js(registerRenderer, renderAgGrid, renderKeyValueForm), api-fetch.js(apiFetch),
// admin-api.js(AdminAPI)가 이 파일보다 먼저 로드되어 있어야 한다 (base.html에서 전부 eager 로드됨).
//
// admin_settings는 menuKey 중복 방지(tab-manager.js)로 한 번에 하나의 탭만 존재하므로,
// 아래 모듈 스코프 변수로 기본/권한 패널 el과 AG Grid api를 보관해두고 재사용한다.
(function () {
    let listGridApi = null;
    let basicPaneEl = null;
    let permissionPaneEl = null;

    function renderBasicPlaceholder() {
        if (!basicPaneEl) return;
        basicPaneEl.innerHTML = '<div class="split-pane-placeholder">좌측 목록에서 사용자를 선택해주세요.</div>';
    }

    function renderPermissionPlaceholder() {
        if (!permissionPaneEl) return;
        permissionPaneEl.innerHTML = '<div class="split-pane-placeholder">좌측에서 사용자를 선택하면 권한 정보가 표시됩니다.</div>';
    }

    function renderBasicForm(user) {
        if (!basicPaneEl) return;
        basicPaneEl.classList.add("kv-form");
        basicPaneEl.innerHTML = "";

        // 이메일 (readonly)
        renderKeyValueForm(basicPaneEl, [{ label: "이메일", value: user.email }]);

        // role 선택박스 + 저장 버튼은 key-value 폼 패턴과 달라 readonly가 아니므로 직접 구성
        const roleRow = document.createElement("div");
        roleRow.className = "kv-form-row";

        const roleLabel = document.createElement("div");
        roleLabel.className = "kv-form-label";
        roleLabel.textContent = "Role";
        roleRow.appendChild(roleLabel);

        const roleValueWrap = document.createElement("div");
        roleValueWrap.className = "kv-form-value";
        const roleSelect = document.createElement("select");
        roleSelect.className = "admin-role-select";
        ["admin", "user"].forEach(function (r) {
            const opt = document.createElement("option");
            opt.value = r;
            opt.textContent = r;
            if (r === user.role) opt.selected = true;
            roleSelect.appendChild(opt);
        });
        roleValueWrap.appendChild(roleSelect);
        roleRow.appendChild(roleValueWrap);
        basicPaneEl.appendChild(roleRow);

        // 저장 버튼
        const btnRow = document.createElement("div");
        btnRow.className = "kv-form-row admin-btn-row";
        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.className = "admin-save-btn";
        saveBtn.textContent = "저장";
        saveBtn.addEventListener("click", function () {
            saveUserRole(user.id, roleSelect.value, saveBtn);
        });
        btnRow.appendChild(saveBtn);
        basicPaneEl.appendChild(btnRow);
    }

    function renderPermissionInfo(user) {
        if (!permissionPaneEl) return;
        permissionPaneEl.innerHTML =
            '<div class="split-pane-placeholder">' +
            "현재 역할(Role): <strong>" + (user.role || "") + "</strong><br><br>" +
            "1단계에서는 역할(Role) 기반으로만 동작합니다. " +
            "메뉴별 세부 권한 매트릭스는 다음 단계에서 추가됩니다." +
            "</div>";
    }

    function loadUserDetail(userId) {
        AdminAPI.getUser(userId)
            .then(function (user) {
                renderBasicForm(user);
                renderPermissionInfo(user);
            })
            .catch(function (err) {
                console.error("사용자 상세 조회 실패", err);
            });
    }

    function saveUserRole(userId, newRole, btnEl) {
        btnEl.disabled = true;
        AdminAPI.updateRole(userId, newRole)
            .then(function () {
                if (listGridApi) {
                    listGridApi.applyTransaction({ update: [{ id: userId, role: newRole }] });
                }
                alert("저장되었습니다.");
            })
            .catch(function (err) {
                alert(err.message || "저장 중 오류가 발생했습니다.");
            })
            .finally(function () {
                btnEl.disabled = false;
            });
    }

    registerRenderer("admin_settings__list_grid", {
        render: function (el) {
            const gridOptions = {
                columnDefs: [
                    { field: "id", headerName: "ID", width: 70 },
                    { field: "email", headerName: "이메일", width: 220 },
                    { field: "role", headerName: "Role", width: 100 },
                ],
                rowData: [],
                defaultColDef: { resizable: true, sortable: true, filter: true },
                rowSelection: "single",
                animateRows: true,
                onRowClicked: function (event) {
                    if (event.data) loadUserDetail(event.data.id);
                },
            };

            listGridApi = renderAgGrid(el, gridOptions.columnDefs, gridOptions.rowData, {
                rowSelection: "single",
                onRowClicked: gridOptions.onRowClicked,
            });

            AdminAPI.listUsers()
                .then(function (users) {
                    listGridApi.setGridOption("rowData", users);
                })
                .catch(function (err) {
                    console.error("사용자 목록 조회 실패", err);
                });
        },
        // ISSUE-08: 탭이 닫힐 때 SplitLayout.destroy(pane) 경유으로 호출된다.
        // AG Grid는 createGrid()로 만든 인스턴스를 destroy()하지 않으면 내부 리스너/타이머가
        // 남아 메모리 누수의 원인이 될 수 있어 명시적으로 정리한다.
        destroy: function () {
            if (listGridApi) {
                listGridApi.destroy();
                listGridApi = null;
            }
        },
    });

    registerRenderer("admin_settings__basic_form", {
        render: function (el) {
            basicPaneEl = el;
            renderBasicPlaceholder();
        },
        // 그리드는 아니지만, 탭이 닫힌 뒤에도 detach된 DOM을 모듈 스코프 변수가 계속 붙잡고
        // 있지 않도록 참조를 비워준다(작은 누수 방지, 명시적 정리 원칙 일관성 유지).
        destroy: function () {
            basicPaneEl = null;
        },
    });

    registerRenderer("admin_settings__permission_form", {
        render: function (el) {
            permissionPaneEl = el;
            renderPermissionPlaceholder();
        },
        destroy: function () {
            permissionPaneEl = null;
        },
    });
})();
