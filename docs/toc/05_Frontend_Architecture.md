# 5. Frontend Architecture

> 근거: [analysis/STEP4_Frontend분석.md](../analysis/STEP4_Frontend분석.md)

## 5-1. 전체 렌더링 파이프라인

```
base.html (서버 렌더, 최초 1회)
  → sidebar-tree.js (트리 클릭)
  → TabManager.openTab(menuKey, title)
  → ensureContentPane() [async]
      → SearchPanel.build()          검색조건 패널 삽입
      → Lazy Loading 판단(isDomainRendererLoaded)
      → SplitLayout.render()
  → screen-layouts.js (SCREEN_LAYOUTS[menuKey])  레이아웃 트리 정의
  → content-renderers/*.js (registerRenderer로 등록된 render 함수 실행)
      → renderAgGrid() 또는 renderKeyValueForm() (registry.js 공통 헬퍼)
```

## 5-2. base.html — 앱 셸(App Shell)

```
<div class="app-shell">
  ① .area-sidebar    → {% include 'partials/_sidebar_tree.html' %}
  ② .area-topbar     → 사이드바 토글 + 마스터 툴바(조회/추가/삭제/저장/인쇄/닫기) + 로그인정보/로그아웃
  ③ .area-tabbar     → #tab-bar (tab-manager.js가 채움)
  ④ .area-main       → #tab-content-area (홈 탭만 서버에서 미리 렌더)
  ⑤ .area-statusbar  → 더미 상태바
</div>
```

- AG Grid는 CDN 직접 로드(`ag-grid-community@31.0.0`, alpine 테마) — `static/vendor/`는 실제로 사용 안 함.
- 스크립트 로드 순서(중요, 의존성 순서): `tab-manager.js → sidebar-tree.js → toolbar.js → search-fields-config.js → search-panel.js → split-layout.js → screen-layouts.js → api-fetch.js → admin-api.js → profit-analysis-api.js → content-renderers/registry.js → content-renderers/accounting.js → content-renderers/tax-invoice.js`. **`content-renderers/admin.js`는 의도적으로 eager 로드하지 않음**(Lazy Loading, [8장](./08_TabManager동작.md) 참고).

## 5-3. 사이드바 트리 — `_sidebar_tree.html` + `sidebar-tree.js`

- `_sidebar_tree.html`: Jinja2 매크로 `render_tree(nodes)`가 재귀 호출(깊이 제한 없음, 현재는 3단계 더미 데이터 `menu_data.py`).
- `sidebar-tree.js`는 독립된 3개의 `DOMContentLoaded` 리스너로 구성:
  1. 트리 이벤트 위임 — 폴더 토글(CSS Grid `expanded` 클래스) / 리프 클릭(`TabManager.openTab(menuKey, title)`)
  2. 사이드바 토글 — `--sidebar-width` CSS 변수 변경, `layout.css`의 transition이 애니메이션 처리
  3. 하단 ⚙ 설정 버튼 — `TabManager.openTab("admin_settings", "설정")` (트리 리프 클릭과 동일 함수, menuKey만 하드코딩)

## 5-4. 탭 매니저 — `tab-manager.js`

- 상태: `tabs`(배열, 홈 탭은 `closable:false`로 항상 존재), `activeTabId`.
- `openTab(menuKey, title)`: menuKey 중복 시 활성화만, 신규면 탭 push + `ensureContentPane()`(비동기, await 안 함) + 활성화.
- `ensureContentPane(tab)`(async): 검색조건 패널 삽입 → Lazy Loading 판단 → 로드되어 있으면 즉시 `SplitLayout.render()`, 아니면 동적 `<script>` 로드 후 렌더, 실패 시 폴백 메시지.
- Lazy Loading 대상(`DOMAIN_SCRIPT_MAP`): `admin_settings`, `profit_payment_date` 둘 다 등록되어 있음(Reference 화면 ①도 Lazy 대상이라는 점은 초기 문서에 없던 내용, 코드로 확인).
- 상세 동작은 [8장](./08_TabManager동작.md).

## 5-5. SplitLayout 엔진 — `split-layout.js`

- 노드 타입 3종: `pane`(contentId), `split`(direction: vertical/horizontal, ratios, children — 재귀), `tabs`(서브탭).
- 드래그 리사이즈: 뒤쪽(`nextPane`)이 split-container의 마지막 자식이면 `flex-grow`를 유지(고정 px로 안 바꿈) — "검색조건 패널 접었을 때 빈 공백이 남는 버그"의 수정사항이 실제 코드에 반영됨.
- `minSize`로 각 pane의 최소 크기 방어.

## 5-6. 화면별 레이아웃 선언 — `screen-layouts.js`

| menuKey | 유형 | 구조 |
|---|---|---|
| `account_register` / `biz_reg_no` / `tax_invoice_search` | A | 단일 pane |
| `voucher_entry` | B | 상하 3단(헤더그리드/상세그리드/관리항목폼), ratios `[1,2,1]` |
| `vendor_info` | C | 좌우 2단(리스트그리드 + 서브탭), ratios `[1,2]` |
| `admin_settings` | C | 좌우 2단(사용자목록 + 기본/권한 서브탭), ratios `[1,2]` |
| `profit_payment_date` | **C** | 좌우 2단(손익목록 + 매입/관련문서 서브탭), ratios `[3,1]` |

⚠️ **문서-코드 불일치**: 계획 문서 일부는 `profit_payment_date`를 "유형 A(단일 그리드)"로 가정하지만, 실제 구현은 **유형 C**다.

폴백: `SCREEN_LAYOUT_DEFAULT = { type:"pane", contentId:"__default__main_grid" }`.

## 5-7. 검색조건 패널 — `search-fields-config.js` + `search-panel.js`

- `SEARCH_FIELDS_CONFIG`: menuKey별 필드 배열(`text`/`select`/`daterange`/`date`), 없으면 기본 폴백(검색어 1개).
- `date` 타입 UX: 네이티브 `<input type=date>` 미사용, 직접 구현. 숫자만 입력 허용(8자리 cap) → blur 시 포맷. **검증(alert)은 blur가 아니라 조회 실행 시점에만** — blur+alert+refocus 무한루프를 피하기 위한 의도적 설계.
- `DateDefaultRules.closingDate()`: 1~10일→10일, 11~20일→11·12일이 월요일이면 10일 아니면 20일, 21일~말일→말일, 주말이면 평일로 보정(Python 원본 로직 JS 포팅).
- Enter 키 입력 시 `.toolbar-btn[data-action=search]`를 프로그래밍적으로 클릭 → `toolbar.js` 핸들러 재사용.

## 5-8. 툴바 — `toolbar.js`

- 이벤트 위임으로 `.toolbar-btn` 클릭 처리.
- `"search"`(조회)만 실제 배선 완료: 활성 탭의 menuKey를 역산 → `window.ScreenReloadHandlers[menuKey]` 호출(레지스트리는 [6장](./06_공통Framework.md) 참고).
- 나머지(추가/삭제/저장/인쇄/닫기)는 `console.log`만 하는 더미 — 향후 개발 필요([18장](./18_향후개발계획.md)).

## 5-9. Reference 화면 진입 경로

```
admin_settings:          사이드바 하단 ⚙ 버튼 → TabManager.openTab("admin_settings", "설정")
profit_payment_date:     사이드바 트리 리프 클릭 → TabManager.openTab("profit_payment_date", "지급기준손익")
```

두 경로 모두 동일한 `openTab()` 함수를 타므로 진입 방식만 다를 뿐, 이후 처리(`ensureContentPane→SplitLayout→content-renderers`)는 완전히 동일한 파이프라인이다.
