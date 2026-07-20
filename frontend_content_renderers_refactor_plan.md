# content-renderers.js 리팩터링 — 최종 결과

> **상태: 전체 Phase(1~7) 구현 완료 + 구현 후 추가 검토로 버그 2건 수정 완료**

## 0. 배경 / 목적

기존 `static/js/content-renderers.js` 하나에 6개 메뉴(`account_register`, `biz_reg_no`, `tax_invoice_search`, `voucher_entry`, `vendor_info`, `admin_settings`)의 렌더링 로직이 전부 들어있었음 (약 330줄). `admin_settings`가 더미 → 실제 DB 연동으로 전환되면서 다른 화면 대비 코드량이 3~4배(약 140줄)로 늘어난 것을 계기로, 메뉴가 늘어날수록 파일이 무한정 커지는 문제를 사전에 방지하기 위해 리팩터링을 진행함.

목표:
- content-renderers.js 비대화 방지
- 도메인별 독립 개발/병렬 작업 가능한 구조
- 공통 API 호출/오류 처리/그리드 생성/포맷터 재사용 구조 확립
- Registry 등록 시 중복 등록을 자동으로 걸러내는 안전장치
- Renderer/Content ID 네이밍 규칙 명문화
- 접근 빈도가 낮은 화면(admin_settings)은 Lazy Loading으로 초기 로딩 비용 제외

백엔드 마이그레이션 계획(`erp_backend_migration_plan.md` 2-8항)과 동일한 원칙 적용: **실제 화면을 만들 때 그 화면이 속한 업무 도메인 이름으로 그때그때 파일을 짓는다.**

> 백업은 별도 진행하지 않음 (사용자 수작업 백업 완료 상태에서 시작).
> Renderer Lifecycle(render/destroy)과 메모리 누수 검증은 이번 라운드 범위에서 제외 — 8장 참고 (미해결 상태 유지).

---

## 1. 결정 사항 요약 (전체 반영 완료)

| 항목 | 결정 | 구현 결과 |
|---|---|---|
| 파일 분리 | 도메인별 4개 파일 (registry / accounting / tax-invoice / admin) | ✅ 완료 |
| GridFactory | 클래스화하지 않음. 기존 `renderAgGrid` 함수형 헬퍼를 유지하고 포맷터만 추가 | ✅ 완료 (`Formatters.currency`, `Formatters.date`) |
| API Layer | `AdminAPI` 하나만 시범 도입. 나머지 도메인은 해당 백엔드 라우트 생기는 시점에 생성 | ✅ 완료 |
| API 오류 처리 | 공통 `apiFetch()` 헬퍼로 일원화 | ✅ 완료 (+ FormData 업로드 대응까지 추가 반영) |
| Registry 등록 | `registerRenderer(contentId, def)`로만 등록, 중복 시 즉시 에러 | ✅ 완료 |
| 네이밍 규칙 | `{menuKey}__{role}_grid` / `{menuKey}__{role}_form` | ✅ 완료 (6곳 리네이밍 반영) |
| Renderer 흐름 | `Renderer → API 호출(apiFetch) → GridBuilder(renderAgGrid) → 끝` | ✅ 완료 (`admin_settings__list_grid`에 적용) |
| Lazy Loading | 자동 감지 방식 (`base.html` eager 등록 여부로 자동 분기) | ✅ 완료 (구현 후 추가 검토로 감지 로직 버그 수정, 9장 참고) |
| 대상 | `admin_settings`만 lazy | ✅ 완료 |

---

## 2. 최종 디렉토리 구조 (실제 반영 상태)

```
static/js/
├── api-fetch.js                        # 공통 apiFetch() 헬퍼 (오류 처리, CSRF 토큰 자동 첨부, FormData 지원) — eager
├── admin-api.js                        # AdminAPI 계층 (apiFetch 기반, admin.js가 사용) — eager
├── content-renderers/
│   ├── registry.js                     # window.ScreenContentRenderers 선언 + registerRenderer() + 공통 헬퍼(renderAgGrid, renderKeyValueForm, Formatters)
│   ├── accounting.js                   # account_register, voucher_entry 렌더러 (더미 유지, eager)
│   ├── tax-invoice.js                  # tax_invoice_search, biz_reg_no, vendor_info 렌더러 (더미 유지, eager)
│   └── admin.js                        # admin_settings 렌더러, AdminAPI 사용 (실 DB 연동, lazy — base.html에 스크립트 태그 없음)
├── screen-layouts.js                   # contentId 6곳 리네이밍만 반영, 구조 변경 없음
├── split-layout.js                     # 변경 없음
├── tab-manager.js                      # ensureContentPane async 전환 + Lazy Loading 로직 추가 + 실패 처리 보강
└── content-renderers.js.bak            # 리팩터링 전 원본 (git 미사용 환경 고려, 삭제하지 않고 보관)
```

`screen-layouts.js`는 `contentId` 문자열 기반 조회 구조라 내용 변경 없음 (리네임된 contentId 값만 갱신). **`split-layout.js`는 변경 없음이 아니라 수정이 실제로 필요했음 — 9-6장 참고 (후속 발견된 심각한 회귀 버그).**

> **계획 대비 변경점**: 원 계획은 "Phase 6 완료 후 `content-renderers.js` 삭제"였으나, git 미사용 환경 특성상 완전 삭제 대신 `content-renderers.js.bak`으로 이름만 바꿔 보관함 (동작에는 영향 없음, 필요 시 언제든 삭제 가능).

---

## 3. Renderer/Content ID 네이밍 규칙 (적용 완료)

```
{menuKey}__{role}_grid   ← AG Grid 콘텐츠
{menuKey}__{role}_form   ← key-value 폼 콘텐츠
```

리네이밍 반영 결과:

| 기존 | 변경 후 | 반영 위치 |
|---|---|---|
| `voucher_entry__mgmt_panel` | `voucher_entry__mgmt_form` | `screen-layouts.js`, `content-renderers/accounting.js` |
| `vendor_info__basic` | `vendor_info__basic_form` | `screen-layouts.js`, `content-renderers/tax-invoice.js` |
| `vendor_info__extra` | `vendor_info__extra_form` | `screen-layouts.js`, `content-renderers/tax-invoice.js` |
| `vendor_info__etc` | `vendor_info__etc_form` | `screen-layouts.js`, `content-renderers/tax-invoice.js` |
| `admin_settings__basic` | `admin_settings__basic_form` | `screen-layouts.js`, `content-renderers/admin.js` |
| `admin_settings__permission` | `admin_settings__permission_form` | `screen-layouts.js`, `content-renderers/admin.js` |

검증 결과: 최종 등록된 contentId 14개(`__default__main_grid` 포함)와 `screen-layouts.js`가 참조하는 contentId 13개가 1:1로 정확히 일치, 중복/누락 없음 확인 완료.

---

## 4. Phase별 작업 (전체 완료)

### Phase 1 — registry.js 분리 ✅

`static/js/content-renderers/registry.js` 신설. `registerRenderer(contentId, def)`, `renderAgGrid`, `renderKeyValueForm`, `Formatters`(`currency`, `date`), `__default__main_grid` 폴백 등록까지 전부 반영.

```javascript
function registerRenderer(contentId, def) {
    if (window.ScreenContentRenderers[contentId]) {
        throw new Error("[registerRenderer] 중복 등록: " + contentId);
    }
    if (!def || typeof def.render !== "function") {
        throw new Error("[registerRenderer] render 함수 누락: " + contentId);
    }
    if (!/^[a-z0-9]+__[a-z0-9_]+_(grid|form)$/.test(contentId)) {
        console.warn("[registerRenderer] 네이밍 규칙 확인 필요: " + contentId);
    }
    window.ScreenContentRenderers[contentId] = def;
}
```

### Phase 2 — accounting.js / tax-invoice.js 분리 ✅

- `content-renderers/accounting.js`: `account_register__main_grid`, `voucher_entry__header_grid`/`detail_grid`/`mgmt_form` (4개)
- `content-renderers/tax-invoice.js`: `biz_reg_no__main_grid`, `tax_invoice_search__main_grid`, `vendor_info__list_grid`/`basic_form`/`extra_form`/`etc_form` (6개)
- 전부 `window.ScreenContentRenderers["xxx"] = fn` 직접 대입 → `registerRenderer("xxx", { render(el){...} })` 방식으로 전환 완료
- `voucher_entry`, `tax_invoice_search`의 금액/날짜 컬럼에 `valueFormatter: p => Formatters.currency(p.value)` 등 적용 완료

### Phase 3 — api-fetch.js 신설 ✅ (구현 후 FormData 지원 추가 반영)

```javascript
async function apiFetch(url, options) {
    options = options || {};
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    const needsCsrf = !!options.method && options.method.toUpperCase() !== "GET";
    const headers = Object.assign(
        isFormData ? {} : { "Content-Type": "application/json" },
        needsCsrf ? { "X-CSRFToken": getCsrfToken() } : {},
        options.headers || {}
    );

    const res = await fetch(url, Object.assign({}, options, { headers: headers }));

    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }

    if (!res.ok) {
        throw new Error((data && data.error) || res.statusText || "요청 실패");
    }
    return data;
}
```

원 계획 대비 `isFormData` 분기가 추가됨 (9장 참고) — 향후 파일 업로드 API가 생겨도 `Content-Type`을 강제 덮어쓰지 않도록 미리 대응.

### Phase 4 — AdminAPI 계층 도입 + admin.js 분리 ✅

- `admin-api.js`: `AdminAPI.listUsers()` / `AdminAPI.getUser(id)` / `AdminAPI.updateRole(id, role)` — 전부 `apiFetch` 기반, 자체 오류 처리 없음(공통 계층에 위임)
- `content-renderers/admin.js`: 기존 IIFE 그대로 이관, `fetch(...)` 3곳 전부 `AdminAPI.*` 호출로 교체, `getCsrfToken()` 중복 정의 제거(Phase 3 공통 버전 사용), `registerRenderer` 전환 완료
- Renderer 흐름 목표(`Renderer → AdminAPI 호출 → renderAgGrid` 3단 분리) 그대로 구현됨

### Phase 5 — Lazy Loading 적용 ✅ (구현 후 버그 2건 발견/수정, 9장 참고)

`tab-manager.js`에 `DOMAIN_SCRIPT_MAP`, `loadDomainScriptOnce`, `findAnyContentId`, `isDomainRendererLoaded` 추가하고 `ensureContentPane`을 `async`로 전환 완료. 최종 코드는 9장의 수정본이 반영된 상태 (원 계획 코드에서 `isDomainRendererLoaded`의 판정 로직과 `loadDomainScriptOnce`의 실패 처리 부분이 구현 후 검토를 거쳐 변경됨).

`openTab()`은 원안대로 `ensureContentPane(newTab)`을 `await` 없이 호출 후 바로 `activateTab()` — pane 자체는 동기로 이미 DOM에 붙으므로 문제없음을 최종 확인.

### Phase 6 — base.html 스크립트 태그 교체 ✅

```html
<script src="{{ url_for('static', filename='js/api-fetch.js') }}"></script>
<script src="{{ url_for('static', filename='js/admin-api.js') }}"></script>
<script src="{{ url_for('static', filename='js/content-renderers/registry.js') }}"></script>
<script src="{{ url_for('static', filename='js/content-renderers/accounting.js') }}"></script>
<script src="{{ url_for('static', filename='js/content-renderers/tax-invoice.js') }}"></script>
<!-- content-renderers/admin.js는 여기서 로드하지 않음: admin_settings 탭을 최초로 열 때 tab-manager.js가 동적 로드 (Lazy Loading) -->
```

로드 순서(`api-fetch.js` → `admin-api.js` → `registry.js` → `accounting.js`/`tax-invoice.js`) 그대로 반영.

### Phase 7 — 검증 ✅ (정적 검증까지 완료, 브라우저 수동 확인은 별도 필요)

완료한 항목:
- `node --check`로 신규/수정 파일 전체(`registry.js`, `accounting.js`, `tax-invoice.js`, `admin.js`, `api-fetch.js`, `admin-api.js`, `tab-manager.js`, `screen-layouts.js`) 구문 오류 없음 확인
- `registerRenderer` 등록 개수(14개)가 원본과 정확히 일치, 중복 없음 확인 (정적 grep)
- `screen-layouts.js` contentId(13개)와 registry 등록 목록 1:1 대조, 리네이밍 누락 없음 확인
- 옛 contentId(`mgmt_panel`, `vendor_info__basic` 등) 잔존 참조 전체 검색 → 주석 1곳(`accounting.js`의 변경 이력 주석) 외 실사용 코드에는 없음 확인
- `templates` 내 `content-renderers.js` 참조 전수 검색 → `admin_users.html`(미사용 레거시, `app.py`에 라우트 없음), `base - 복사본.html`(사용자 수동 백업본, 미사용 추정) 2곳만 발견, 둘 다 실제 렌더링 경로 아님을 `app.py` 대조로 확인

**아직 미완료(브라우저에서 직접 확인 필요)**:
- 6개 메뉴 전부 클릭 시 정상 렌더 여부
- `admin_settings` 최초 오픈 시 로딩 확인 + Network 탭에서 `admin.js`가 이때만 요청되는지
- `admin_settings` 탭 닫았다가 재오픈 시 스크립트 중복 로드 없이 정상 동작하는지
- role 변경 저장 및 에러 케이스(alert 메시지) 정상 동작 여부
- `registerRenderer` 중복 등록 시 실제로 에러가 발생하는지

---

## 5. 이번 라운드에서 하지 않은 것 (다음으로 미룸, 변경 없음)

| 항목 | 미루는 이유 / 재개 시점 |
|---|---|
| `AccountingAPI`, `TaxInvoiceAPI` 등 나머지 도메인 API 계층 | 아직 대응 백엔드 라우트가 없음(더미 데이터 단계). 해당 도메인 백엔드 연동 시점에 함께 생성 |
| Grid Factory 클래스화 | 현재 규모(그리드 10개 내외)에서는 함수형 `renderAgGrid` + `Formatters`로 충분 |
| accounting.js / tax-invoice.js의 Lazy Loading | 사용 빈도 높고 코드량 작아 이득 적음. 메뉴 15~20개 이상으로 늘어날 때 재검토 |
| 로딩 중 placeholder UI (정상 케이스) | admin_settings 최초 오픈 지연이 사내망 기준 체감 미미할 것으로 예상. 다만 **로드 실패 시 폴백 메시지는 9장에서 추가 구현함** (정상 로딩 중 placeholder와는 별개) |
| Renderer Lifecycle(render/destroy), 메모리 누수 검증 | 8장 참고 — 여전히 미해결, 별도 검토 필요 |

---

## 6. 위험 요소 / 주의사항 (실제 반영 결과)

1. **렌더 타이밍**: `ensureContentPane`이 `await loadDomainScriptOnce()` 이후에 `render()`를 호출하도록 구현됨 → 우려했던 레이스 컨디션 없음
2. **로드 순서**: `base.html`에 `api-fetch.js → admin-api.js → registry.js → accounting.js/tax-invoice.js` 순서로 반영 확인
3. **파일명/도메인명 일관성**: `AdminAPI` 하나만 존재, 향후 도메인 API 추가 시 실제 업무 도메인명 사용 원칙 유지 예정
4. **네이밍 리네이밍 누락 위험**: `screen-layouts.js` 6곳, `content-renderers/*.js` 6곳 전부 대조 완료, 누락 없음 확인 (3장 표 참고)

---

## 7. 다음 단계

- 위 Phase 7의 "미완료(브라우저 수동 확인)" 항목 사용자 확인 필요
- 8장의 Renderer Lifecycle/메모리 누수는 여전히 별도 라운드로 남아있음

---

## 8. 검토 필요 (여전히 미해결 — 이번 라운드 범위 제외)

아래 2개 항목은 이번 리팩터링 범위에서 계속 제외된 상태이며, **리팩터링 여부와 무관하게 현재 코드에 이미 존재하는 문제**이므로 별도로 검토가 필요함을 재기록해둔다.

1. **Renderer Lifecycle(`render`/`destroy`) 규칙 정의**
   현재 렌더러는 `render(el)` 하나만 있고 대응하는 정리(`destroy`) 함수가 없음. `registerRenderer(contentId, { render, destroy })` 형태로 계약을 확장하고, `render`가 핸들(grid api 등)을 반환하도록 `split-layout.js`도 함께 손봐야 함.

2. **메모리 누수 및 `Grid.destroy()` 검증**
   `tab-manager.js`의 `closeTab()`은 현재 `pane.remove()`만 수행하고, AG Grid 인스턴스나 `admin.js`의 모듈 스코프 변수(`listGridApi`, `basicPaneEl`, `permissionPaneEl`)에 대한 정리가 없음. 탭을 반복적으로 열고 닫으면 detached DOM 및 AG Grid 내부 리스너가 누적될 가능성이 있음. Chrome DevTools Heap Snapshot으로 실측 검증 필요.

두 항목은 서로 연결되어 있음(1번의 lifecycle 계약이 2번 문제의 해결책) — 별도 라운드에서 함께 진행하는 것을 제안.

---

## 9. 구현 완료 후 추가 검토에서 발견/수정한 이슈

Phase 1~7 구현을 마친 뒤 별도로 4가지를 재검토하여, 그중 2건의 실제 버그를 발견하고 수정함.

### 9-1. `ensureContentPane`의 async 반영 — 이상 없음 확인
계획대로 `async` 전환, `await loadDomainScriptOnce()` 이후 `render()` 호출 순서 정확히 반영되어 있었음. 수정 없음.

### 9-2. `isDomainRendererLoaded()` — 버그 발견 및 수정

**원인**: Phase 1에서 `registerRenderer()` 도입으로 등록값이 함수(`fn`)에서 객체(`{ render: fn }`)로 바뀌었는데, Phase 5의 판정 로직은 여전히 `typeof entry === "function"`으로 검사하고 있어 **항상 `false`를 반환**하는 상태였음.

- 실제 영향: eager 도메인도 매번 `loadDomainScriptOnce()`(즉시 resolve)를 거치는 불필요한 비동기 홉이 추가됨. 기능적으로 눈에 보이는 오작동은 없었으나(Promise.resolve()로 매번 우회), 이 fast-path 검사 자체가 완전히 무력화된 상태였음.

**수정**:
```javascript
function isDomainRendererLoaded(menuKey) {
    const layout = (window.SCREEN_LAYOUTS && window.SCREEN_LAYOUTS[menuKey]) || window.SCREEN_LAYOUT_DEFAULT;
    const contentId = findAnyContentId(layout);
    const entry = contentId && window.ScreenContentRenderers && window.ScreenContentRenderers[contentId];
    return !!(entry && typeof entry.render === "function");
}
```

### 9-3. `loadDomainScriptOnce()` 로드 실패 처리 — 개선 필요 확인, 반영 완료

**원인**: 스크립트 로드 실패(네트워크 오류 등) 시 reject된 Promise가 `_loadedScripts`에 그대로 캐싱되어, **한 번 실패하면 페이지 새로고침 전까지 재시도가 불가능**했음. 또한 `ensureContentPane`에 `try/catch`가 없어 실패 시 콘솔에 `Uncaught (in promise)`만 남고 사용자에게는 빈 화면만 보였음.

**수정**:
```javascript
function loadDomainScriptOnce(menuKey) {
    const url = DOMAIN_SCRIPT_MAP[menuKey];
    if (!url) return Promise.resolve();
    if (_loadedScripts.has(url)) return _loadedScripts.get(url);

    const promise = new Promise(function (resolve, reject) {
        const script = document.createElement("script");
        script.src = url;
        script.onload = resolve;
        script.onerror = function () {
            script.remove();
            reject(new Error("화면 스크립트 로드 실패: " + url));
        };
        document.body.appendChild(script);
    });

    promise.catch(function () {
        _loadedScripts.delete(url); // 실패는 캐시하지 않음 -> 다음 탭 오픈 시 재시도 가능
    });

    _loadedScripts.set(url, promise);
    return promise;
}
```

`ensureContentPane`에도 `try/catch` 추가하여 실패 시 사용자에게 폴백 메시지 표시:
```javascript
try {
    await loadDomainScriptOnce(tab.menuKey);
    window.SplitLayout.render(contentArea, layout);
} catch (err) {
    console.error("[ensureContentPane] 화면 로드 실패: " + tab.menuKey, err);
    contentArea.innerHTML = '<div class="split-pane-placeholder">화면을 불러오지 못했습니다. 탭을 닫고 다시 열어주세요.</div>';
}
```

### 9-4. `apiFetch()` FormData 지원 — 개선 필요 확인, 반영 완료

**원인**: `apiFetch()`가 항상 `Content-Type: application/json`을 강제 설정하고 있어, 향후 파일 업로드(`FormData`)를 body로 넘기는 API가 생기면 브라우저가 자동으로 붙여야 할 `multipart/form-data; boundary=...`를 덮어써 요청이 깨지는 구조였음. 현재는 `AdminAPI`에 업로드 기능이 없어 당장의 오작동은 없었으나, 거래처정보관리 등에서 사업자등록증 첨부 같은 기능이 생길 때를 대비해 선제적으로 수정함.

**수정**: `api-fetch.js` (4장 Phase 3 최종 코드에 반영됨) — `options.body instanceof FormData`일 때 `Content-Type`을 비워 브라우저가 자동 설정하도록 분기 추가. CSRF 헤더는 FormData 요청에도 동일하게 유지.

### 9-5. 검증

`node --check`로 `tab-manager.js`, `api-fetch.js` 재검증 통과 확인.

### 9-6. `split-layout.js`의 `renderContentInto()` — 전역 회귀 버그 발견 및 수정

**증상**: `admin_settings` 화면이 실제 DB 연동으로 전환된 뒤, 사용자 목록 그리드가 계속 빈 화면(더미 플레이스홀더)로만 나옴. 교차 확인 결과, `admin_settings`만의 문제가 아니라 **계정등록/전표입력 등 기존 화면을 포함해 사실상 모든 화면의 렌더러가 호출되지 않는 전역 회귀 버그**였음. `admin_settings`에서 눈에 띄 것은, 이 화면만 유일하게 실제 DB 데이터를 기다리는 화면이라 "비어있다"는 게 확연히 느껴졌기 때문이고, 다른 화면(더미 데이터)은 육안으로는 플레이스홀더와 실제 그리드가 구별이 잘 안 되어 느껴지지 않았을 뿐, 실제로는 같은 문제를 겪고 있었다.

**원인**: Phase 1(`registry.js` 도입)으로 `registerRenderer()`가 등록하는 값이 단순 함수(`fn`)에서 객체(`{ render: fn }`)로 바뀌었는데, `split-layout.js`의 `renderContentInto()`는 여전히 구버전 규약대로 `typeof entry === "function"`로만 검사하고 있었음. `typeof { render: fn }`는 `"object"`이므로 이 조건문은 **항상 거짓**이 되어, 등록된 렌더러가 있는데도 호출되지 못하고 조용히 더미 플레이스홀더로 빠지는 상태였다.

이는 2절에 적은 "`split-layout.js`는 contentId 문자열 기반 조회 구조라 내용 변경 없음"이라는 판단이 계획 검토 단계에서 놓친 것이었음을 보여준다 — `contentId`로 `entry`를 찾아오는 "조회" 부분은 안 바뀌었지만, 찾아온 `entry`를 실행하는 "호출 규약"(직접 호출 vs `.render()` 호출)이 바뀌었다는 것을 반영 안 함.

**수정**:
```javascript
function renderContentInto(el, contentId) {
    const renderers = window.ScreenContentRenderers || {};
    const entry = contentId ? renderers[contentId] : null;

    if (entry && typeof entry.render === "function") {
        entry.render(el);   // 새 규약 (registerRenderer로 등록된 객체)
        return;
    }
    if (typeof entry === "function") {
        entry(el);           // 구버전 호환 (단순 함수 직접 등록 방식 대비)
        return;
    }
    // ... 플레이스홀더 fallback
}
```

**연쇄 확인**: 같은 부류의 버그가 `tab-manager.js`의 `isDomainRendererLoaded()`에도 동일하게 존재해서(9-2절), 이번 점검에서 동시에 발견되고 같이 수정됨. 두 버그 모두 근본 원인이 동일하다(`registerRenderer`의 리턴값 타입 변경을 반영 안 한 잠재 호출지가 여러 군데 남아있었던 것).

**파일**: `static/js/split-layout.js` (`renderContentInto` 함수만 수정, 엔진/트리 순회/드래그 등 나머지 로직은 무수정)

**재발 방지**: `registry.js`의 `registerRenderer()`가 `def.render`가 함수가 아니면 등록 자체를 막아서(즉시 `throw`), 앞으로 같은 부류의 호출 규약 불일치가 생기면 등록 시점에 바로 오류로 드러난다.
