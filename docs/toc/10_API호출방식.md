# 10. API 호출 방식

> 근거: [analysis/STEP5_공통Framework분석.md](../analysis/STEP5_공통Framework분석.md), [STEP6_Reference화면분석.md](../analysis/STEP6_Reference화면분석.md)

## 10-1. 공통 통신 계층 — `apiFetch()`

모든 프론트엔드 → 백엔드 통신은 `api-fetch.js`의 `apiFetch(url, options)` **단일 함수**를 거친다.

```javascript
async function apiFetch(url, options) {
    const isFormData = options.body instanceof FormData;
    const needsCsrf = options.method && options.method.toUpperCase() !== "GET";
    const headers = {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(needsCsrf ? { "X-CSRFToken": getCsrfToken() } : {}),
        ...options.headers,
    };
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || res.statusText || "요청 실패");
    return data;
}
```

- CSRF 토큰은 `<meta name="csrf-token">`에서 읽고 모듈 전역 변수에 캐싱.
- FormData 전송 시 `Content-Type`을 비워 브라우저가 boundary를 자동 설정하도록 방어.
- 표준화된 `Error`를 throw하므로, 호출부는 항상 `.catch(err => alert(err.message))` 패턴으로 통일되어 있다.

## 10-2. 도메인별 API 모듈

```javascript
// admin-api.js
window.AdminAPI = {
    listUsers: () => apiFetch("/admin/users/list"),
    getUser: (id) => apiFetch("/admin/users/" + id),
    updateRole: (id, role) => apiFetch("/admin/users/" + id + "/role", {
        method: "POST", body: JSON.stringify({ role }),
    }),
};

// profit-analysis-api.js
window.ProfitAnalysisAPI = {
    getByPaymentDate: (date) => apiFetch("/api/profit-analysis/payment-date?date=" + encodeURIComponent(date)),
};
```

각 모듈은 URL 조립 + `apiFetch()` 호출만 하는 얇은 래퍼다. 신규 도메인 API 모듈도 이 패턴을 그대로 따르면 된다.

## 10-3. 백엔드 응답 규약

| 상황 | 응답 |
|---|---|
| 정상 | `200` + JSON(목록/객체) |
| 입력값 검증 실패(`ValueError`) | `400` + `{"error": "메시지"}` |
| 리소스 없음 | `404` + `{"error": "not found"}` |
| 변경 성공(POST) | `200` + `{"ok": true}` |

`routes/*.py`가 `service`의 예외를 잡아 이 규약대로 변환한다(예: `admin_routes.py`의 `user_role_update_api`).

## 10-4. CSRF 흐름 종단 확인

```
app.py: CSRFProtect(app)                          — 전역 검증(POST/PUT/PATCH/DELETE)
base.html: <meta name="csrf-token" content="{{ csrf_token() }}">
api-fetch.js: getCsrfToken() → meta 태그에서 읽음 → X-CSRFToken 헤더 자동 첨부
```

## 10-5. Reference 화면 API 호출 실례

| 화면 | 메서드/경로 | 호출 시점 |
|---|---|---|
| `profit_payment_date` | `GET /api/profit-analysis/payment-date?date=YYYY-MM-DD` | "조회" 버튼 클릭 시(자동조회는 현재 비활성, [12장](./12_Reference화면분석.md)) |
| `admin_settings` | `GET /admin/users/list` | 탭 오픈 시 즉시 |
| `admin_settings` | `GET /admin/users/<id>` | 좌측 그리드 행 클릭 시 |
| `admin_settings` | `POST /admin/users/<id>/role` | "저장" 버튼 클릭 시 |

## 10-6. 신규 API 추가 시 체크리스트

1. `routes/*.py`에 라우트 추가, `@login_required` 적용(관리자 전용이면 향후 `role_required`도 함께 — 현재는 없음에 유의).
2. `service/*.py`에 입력 검증 로직 작성, `ValueError` 발생 시 routes가 400으로 변환.
3. 프론트에 `{도메인}-api.js` 추가, `apiFetch()` 재사용.
4. `base.html`에 신규 API 모듈 `<script>` 태그 추가(도메인 렌더러보다 먼저).
