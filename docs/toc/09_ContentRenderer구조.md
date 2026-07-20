# 9. Content Renderer 구조

> 근거: [analysis/STEP4_Frontend분석.md](../analysis/STEP4_Frontend분석.md), [STEP5_공통Framework분석.md](../analysis/STEP5_공통Framework분석.md), [STEP1_MD문서분석.md](../analysis/STEP1_MD문서분석.md) 1-4절

## 9-1. contentId 개념

`SCREEN_LAYOUTS`가 정의하는 레이아웃 트리의 각 `pane`은 `contentId`를 가진다. `SplitLayout`이 렌더링 시점에 이 `contentId`로 `window.ScreenContentRenderers`(registry.js가 관리)를 조회해 실제 렌더 함수를 실행한다.

## 9-2. 네이밍 규칙

```
{menuKey}__{역할}_grid   ← AG Grid 콘텐츠
{menuKey}__{역할}_form   ← key-value 폼 콘텐츠
```

예: `profit_payment_date__list_grid`, `profit_payment_date__revenue_purchase_form`, `admin_settings__basic_form`.

`registerRenderer()`가 정규식(`^[a-z0-9_]+__[a-z0-9]+_(grid|form)$`)으로 이 규칙을 검증하지만 **위반 시 콘솔 경고만** 하고 등록 자체는 막지 않는다.

## 9-3. 등록 함수 — `registerRenderer(contentId, def)`

```javascript
function registerRenderer(contentId, def) {
    if (window.ScreenContentRenderers[contentId]) throw new Error("중복 등록: " + contentId);
    if (!def || typeof def.render !== "function") throw new Error("render 함수 누락: " + contentId);
    window.ScreenContentRenderers[contentId] = def;
}
```

`def.render(el)` 형태로 등록하며, `el`은 렌더링 대상 DOM 엘리먼트다. 렌더러 안에서 `el.closest(".tab-pane")`으로 상위 탭 컨텍스트(검색조건 등)에 접근할 수 있다(profit-analysis.js에서 실사용).

## 9-4. 도메인별 파일 분리

```
content-renderers/
├── registry.js           ← 반드시 가장 먼저 로드 (등록소 자체)
├── accounting.js          ← account_register, voucher_entry (샘플)
├── tax-invoice.js          ← biz_reg_no, tax_invoice_search, vendor_info (샘플)
├── profit-analysis.js      ← profit_payment_date (Reference ①, Lazy)
└── admin.js                 ← admin_settings (Reference ②, Lazy)
```

과거에는 6개 메뉴 렌더링 로직이 `content-renderers.js` 단일 파일에 있었으나(현재 `.js.bak`으로 보관), admin_settings 실 DB 연동으로 코드량이 급증하며 도메인별로 분리했다(리팩터링 이력: [STEP1_MD문서분석.md](../analysis/STEP1_MD문서분석.md) 1-4절).

## 9-5. ⚠️ 리팩터링 중 발생했던 전역 회귀 버그 (수정 완료, 재발 방지 코드 존재)

1. `registerRenderer()` 도입으로 등록값이 함수 → 객체(`{render: fn}`)로 바뀜.
2. `split-layout.js`의 `renderContentInto()`와 `tab-manager.js`의 `isDomainRendererLoaded()`가 여전히 `typeof entry === "function"`으로 체크 → 항상 거짓 → **전 화면 렌더링이 죽는 전역 버그** 발생.
3. 수정: `entry.render`가 함수인지 확인하는 방식으로 변경(구버전 함수 직접 등록 방식도 폴백 지원).
4. 재발 방지: `registerRenderer()`가 `def.render`가 함수가 아니면 등록 자체를 `throw`로 막음.

신규 렌더러를 작성할 때 이 히스토리를 알아야 하는 이유: **반드시 `{ render: function(el) {...} }` 형태로 등록**해야 하며, 함수를 직접 넘기면 안 된다.

## 9-6. 렌더러 두 가지 유형

### (A) AG Grid 렌더러

```javascript
registerRenderer("profit_payment_date__list_grid", {
    render: function (el) {
        listGridApi = renderAgGrid(el, columnDefs, []);  // 빈 배열로 시작
        // 필요 시 registerReload(menuKey, fn)로 조회 버튼 배선
    },
});
```

### (B) key-value 폼 렌더러

```javascript
registerRenderer("profit_payment_date__revenue_purchase_form", {
    render: function (el) {
        renderKeyValueForm(el, [{ label: "매입처", value: "..." }, ...]);
    },
});
```

⚠️ `renderKeyValueForm`은 현재 `input.readOnly = true` 고정이라, 실제 값 수정이 필요한 폼(예: admin.js의 role 선택)은 `renderKeyValueForm`을 부분적으로만 쓰고 나머지(select, 버튼)는 직접 DOM을 구성한다(`admin.js`의 `renderBasicForm()` 참고).

## 9-7. Renderer Lifecycle 관련 미해결 사항

`render()` 함수만 정의되어 있고 `destroy()`/`unmount()` 같은 생명주기 훅이 없다. 탭을 반복적으로 열고 닫을 때 AG Grid 인스턴스나 이벤트 리스너가 정리되지 않아 메모리 누수가 발생할 가능성이 문서상(`frontend_content_renderers_refactor_plan.md`) 미해결 항목으로 남아 있으며, 실측 검증도 아직 없다([18장 향후개발계획](./18_향후개발계획.md) 참고).
