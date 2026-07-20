# 13. Backend ↔ Frontend 연결 구조

> 근거: [analysis/STEP4_Frontend분석.md](../analysis/STEP4_Frontend분석.md), [STEP5_공통Framework분석.md](../analysis/STEP5_공통Framework분석.md), [STEP7_데이터흐름분석.md](../analysis/STEP7_데이터흐름분석.md)

## 13-1. 연결 지점 3가지

Backend와 Frontend는 다음 3가지 지점에서만 연결된다.

1. **최초 페이지 렌더**(서버 → 클라이언트, 1회): `routes/erp_routes.py: dashboard()` → `base.html` + `tree_menu`
2. **JSON API**(클라이언트 → 서버, 화면 동작 중 반복): `{도메인}-api.js` → `apiFetch()` → `routes/*.py`
3. **CSRF 토큰**(서버 → 클라이언트, 1회): `base.html`의 `<meta name="csrf-token">` → `api-fetch.js`가 모든 비-GET 요청에 자동 첨부

이 3가지 외에는 서버와 클라이언트가 직접 통신하지 않는다 — SPA 내부 화면 전환(탭/레이아웃)은 전부 클라이언트에서만 처리된다.

## 13-2. menuKey — 두 세계를 잇는 공통 키

프론트의 `menuKey`(예: `admin_settings`)는 다음처럼 백엔드 URL과 대응된다.

| 계층 | menuKey의 쓰임 |
|---|---|
| `menu_data.py` | 트리 노드에 심어진 값 |
| `screen-layouts.js` | `SCREEN_LAYOUTS[menuKey]` 조회 키 |
| `search-fields-config.js` | `SEARCH_FIELDS_CONFIG[menuKey]` 조회 키 |
| `registry.js` | `ScreenReloadHandlers[menuKey]` 조회 키 |
| `routes/admin_routes.py` | Blueprint `url_prefix="/admin"` — menuKey와 URL 접두사가 사람이 읽기에 대응되도록 명명(코드가 자동 매핑하지는 않음) |

**menuKey와 백엔드 URL 사이에 강제 매핑 규칙은 없다** — 각 도메인 API 모듈(`admin-api.js` 등)이 코드로 직접 경로를 지정한다. 즉 menuKey는 프론트 내부 라우팅 키일 뿐, 백엔드 URL 규칙과는 독립적이다.

## 13-3. 요청 단위 연결 다이어그램

```
[Browser]
   │ (1) 최초 접속: GET /dashboard
   ▼
[app.py] → Blueprint 라우팅 → @login_required 세션 체크
   ▼
[routes/*.py] → base.html 렌더 또는 JSON API
   │
   │ (2) SPA 내부 전환: 서버 재요청 없음
   │ (3) 데이터 조회/변경: apiFetch(JSON, X-CSRFToken)
   ▼
[routes/*_routes.py] (CSRFProtect가 먼저 토큰 검증)
   ▼
[service/*.py] → [repository/*.py] → [db/*.py] → PostgreSQL
   ▼
JSON 응답 → apiFetch 표준 에러처리 → content-renderers가 그리드/폼 갱신
```

## 13-4. 응답 스키마 규약과 프론트 소비 방식

- 목록 API(`GET /admin/users/list`, `GET /api/profit-analysis/payment-date`)는 **배열을 그대로** 반환하며, 프론트는 `.then(rows => gridApi.setGridOption("rowData", rows))`로 그대로 그리드에 흘려보낸다 — 별도 매핑/변환 계층이 없다.
- 단건 API(`GET /admin/users/<id>`)는 객체를 반환하며, 프론트가 `user.email`, `user.role` 등 필드명을 SQL의 SELECT 별칭과 **동일하게** 사용한다 — 즉 DB 컬럼명이 사실상 API 계약이자 프론트 필드명이다. 컬럼명을 바꾸면 프론트 코드도 함께 바꿔야 한다.

## 13-5. 세션 데이터의 연결 — role의 정합성 문제

로그인 시 `session["role"]`이 DB 조회 값으로 고정되고, `base.html` 렌더링 시 Jinja2로 화면에 주입된다(`role={{ role }}` 형태로 로그인 정보 표시에 사용). 그러나:

⚠️ `admin_settings`에서 관리자가 다른 사용자의 role을 변경해도, **그 사용자의 이미 로그인된 세션의 `session["role"]` 값은 재로그인 전까지 갱신되지 않는다.** 현재는 백엔드 라우트들이 애초에 `session["role"]`을 인가 검증에 쓰지 않으므로 보안상 즉각적인 문제는 아니지만, 향후 `role_required` 데코레이터를 추가할 때 세션 값을 그대로 신뢰하면 "권한 회수가 즉시 반영되지 않는" 새로운 문제가 생길 수 있다([18장](./18_향후개발계획.md) 참고).

## 13-6. 정리 — 연결 구조의 강점과 약점

| 구분 | 내용 |
|---|---|
| ✅ 강점 | 연결 지점이 3가지로 명확히 제한되어 있어 추적이 쉬움. `apiFetch` 단일창구로 통신 방식이 통일됨 |
| ⚠️ 약점 | DB 컬럼명이 곧 API 필드명이라 스키마 변경이 프론트까지 전파됨(별도 DTO/직렬화 계층 없음). 세션 role의 staleness |
