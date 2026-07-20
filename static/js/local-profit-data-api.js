// local-profit-data-api.js
// 손익현황(로컬, local_profit_data) 화면 전용 API 계층. apiFetch()를 통해 오류처리/CSRF 일임.
// base.html에서 api-fetch.js보다 뒤, content-renderers/local-profit-data.js(lazy)보다 먼저 로드되어야 함.

window.LocalProfitDataAPI = {
    getByDate: function (date) {
        return apiFetch("/api/local-profit-data?date=" + encodeURIComponent(date));
    },
};
