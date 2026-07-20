// api-fetch.js
// 공통 fetch 헬퍼: 오류 처리(res.ok 체크 + 표준화된 Error) + CSRF 토큰 자동 첨부.
// admin-api.js 등 모든 API 계층이 이 파일의 apiFetch()를 통해서만 서버와 통신한다.
// base.html에서 admin-api.js보다 먼저 로드되어야 함.

let _csrfToken = null;
function getCsrfToken() {
    if (_csrfToken === null) {
        const meta = document.querySelector('meta[name="csrf-token"]');
        _csrfToken = meta ? meta.content : "";
    }
    return _csrfToken;
}
window.getCsrfToken = getCsrfToken;

async function apiFetch(url, options) {
    options = options || {};
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    const needsCsrf = !!options.method && options.method.toUpperCase() !== "GET";
    const headers = Object.assign(
        isFormData ? {} : { "Content-Type": "application/json" }, // FormData면 브라우저가 boundary 포함해서 자동 설정하도록 비워둔다
        needsCsrf ? { "X-CSRFToken": getCsrfToken() } : {},
        options.headers || {}
    );

    const res = await fetch(url, Object.assign({}, options, { headers: headers }));

    let data = null;
    try {
        data = await res.json();
    } catch (e) {
        data = null; // 응답이 JSON이 아닐 수 있으므로(빈 바디, HTML 에러 페이지 등) 방어
    }

    if (!res.ok) {
        throw new Error((data && data.error) || res.statusText || "요청 실패");
    }

    return data;
}
window.apiFetch = apiFetch;
