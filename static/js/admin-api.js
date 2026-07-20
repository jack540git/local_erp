// admin-api.js
// 관리자 설정(admin_settings) 화면 전용 API 계층. apiFetch()를 통해 오류 처리/CSRF를 일임한다.
// base.html에서 api-fetch.js보다 뒤, content-renderers/admin.js(lazy)보다 먼저 로드되어야 함.

window.AdminAPI = {
    listUsers: function () {
        return apiFetch("/admin/users/list");
    },
    getUser: function (id) {
        return apiFetch("/admin/users/" + id);
    },
    updateRole: function (id, role) {
        return apiFetch("/admin/users/" + id + "/role", {
            method: "POST",
            body: JSON.stringify({ role: role }),
        });
    },
};
