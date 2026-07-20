// profit-analysis-api.js
// 손익관리(profit_payment_date) 화면 전용 API 계층. apiFetch()를 통해 오류처리/CSRF 일임.
// base.html에서 api-fetch.js보다 뒤, content-renderers/profit-analysis.js(lazy)보다 먼저 로드되어야 함.

window.ProfitAnalysisAPI = {
    getByPaymentDate: function (date) {
        return apiFetch("/api/profit-analysis/payment-date?date=" + encodeURIComponent(date));
    },
};
