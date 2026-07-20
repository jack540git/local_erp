# STEP 4. Frontend 구조 분석 (완료)

> 실제 코드 전수 열람: `templates/base.html`, `templates/login.html`, `templates/partials/_sidebar_tree.html`,
> `templates/admin_users.html`, `static/js/sidebar-tree.js`, `static/js/tab-manager.js`,
> `static/js/split-layout.js`, `static/js/screen-layouts.js`, `static/js/search-fields-config.js`,
> `static/js/search-panel.js`, `static/js/toolbar.js`

## 4-1. `base.html` — 앱 셸(App Shell) 구조

```
<div class="app-shell">
  ① .area-sidebar    → {% include 'partials/_sidebar_tree.html' %}
  ② .area-topbar     → 사이드바토글버튼 + 마스터툴바(조회/추가/삭제/저장/인쇄/닫기) + 로그인정보/로그아웃폼
  ③ .area-tabbar     → #tab-bar (tab-manager.js가 채움)
  ④ .area-main       → #tab-content-area, 홈 탭(tab-home)만 서버에서 미리 렌더 (block main_content)
  ⑤ .area-statusbar  → 더미 상태바
</div>
```

- `<meta name="csrf-token">`은 head에 있으나, 실제 JS의 CSRF 헤더 첨부는 `api-fetch.js`가
  `csrf_token()`이 심어둔 hidden input이 아니라 이 meta 태그를 읽는 것으로 추정됨(STEP 5에서 확인).
- AG Grid는 **CDN 직접 로드** (`ag-grid-community@31.0.0`, alpine 테마) — `static/vendor/`는 실제로 안 씀.
- `ASSET_VERSION`을 모든 정적 리소스 URL 뒤에 `?v=`로 붙여 캐시버스팅, 이 값은 `window.ASSET_VERSION`으로도 노출되어 `tab-manager.js`의 동적 `<script>` 로드(Lazy Loading) 시 재사용됨.
- **스크립트 로드 순서(중요)**: `tab-manager.js` → `sidebar-tree.js` → `toolbar.js` → `search-fields-config.js` → `search-panel.js` → `split-layout.js` → `screen-layouts.js` → `api-fetch.js` → `admin-api.js` → `profit-analysis-api.js` → `content-renderers/registry.js` → `content-renderers/accounting.js` → `content-renderers/tax-invoice.js`. **`content-renderers/admin.js`는 의도적으로 로드하지 않음**(Lazy Loading, STEP 5에서 상세).
- `templates/dashboard.html`은 코드에서 더 이상 참조되지 않는 레거시 파일(STEP 2에서 확인한 내용 재확인).

## 4-2. 사이드바 트리 — `_sidebar_tree.html` + `sidebar-tree.js`

- `_sidebar_tree.html`: Jinja2 매크로 `render_tree(nodes)`가 자기 자신을 재귀 호출 (depth 제한 없음, 현재는 3단계 더미 데이터).
- 하단에 `#sidebar-settings-btn`(⚙) 고정 — admin_settings 진입점.
- `sidebar-tree.js`는 **3개의 독립 `DOMContentLoaded` 리스너**로 구성:
  1. 트리 이벤트 위임 — `folder-toggle`(CSS Grid `expanded` 클래스 토글만 하면 됨, JS 높이계산 불필요) / `leaf`(active 클래스 갱신 + `TabManager.openTab(menuKey, title)`)
  2. 사이드바 자체 토글 — `--sidebar-width` CSS 변수 변경(0px ↔ 원래값), `layout.css`의 transition이 애니메이션 처리
  3. 설정 버튼 클릭 — `TabManager.openTab("admin_settings", "설정")` (트리 리프 클릭과 동일한 함수, 하드코딩된 menuKey만 다름)

## 4-3. 탭 매니저 — `tab-manager.js` (IIFE, `window.TabManager` 노출)

- **상태**: `tabs`(배열, 홈 탭은 `closable:false`로 항상 존재), `activeTabId`.
- **핵심 함수**:
  - `openTab(menuKey, title)`: `menuKey` 중복 체크 → 있으면 `activateTab()`만, 없으면 새 탭 push + `ensureContentPane()`(비동기, await 안 함) + `activateTab()`.
  - `ensureContentPane(tab)` (**async**): 검색조건 패널(`SearchPanel.build`) 삽입 → `.screen-content-area` div 생성 → **Lazy Loading 판단**(`isDomainRendererLoaded`) → 로드되어 있으면 즉시 `SplitLayout.render()`, 아니면 `loadDomainScriptOnce()`로 스크립트 동적 로드 후 렌더, 실패 시 사용자에게 폴백 메시지 표시.
  - `activateTab(tabId)` / `closeTab(tabId)`: 닫을 때 인접 탭(오른쪽 우선) 포커스 이동, 홈 탭 보장으로 배열이 빈 적 없음.
- **Lazy Loading 대상**(`DOMAIN_SCRIPT_MAP`): `admin_settings` → `content-renderers/admin.js`, **`profit_payment_date` → `content-renderers/profit-analysis.js`도 Lazy 대상으로 실제 코드에 등록되어 있음** (STEP 1 문서 분석 당시엔 admin_settings만 언급되었으나, 실제 코드는 Reference 화면 ①도 Lazy Loading 대상임 — 문서와 코드의 차이점).
- `_loadedScripts`(Map)로 캐싱하되 **로드 실패 시 캐시 삭제**하여 재시도 가능하게 처리(리팩터링 문서 9-3 반영 확인).

## 4-4. SplitLayout 엔진 — `split-layout.js` (IIFE, `window.SplitLayout` 노출)

- 노드 타입 3종: `pane`(contentId), `split`(direction: vertical/horizontal, ratios, children — 재귀), `tabs`(서브탭).
- `renderContentInto(el, contentId)`: **리팩터링 후 버그 수정이 반영된 최신 코드** 확인 —
  `entry.render`가 함수면 신규 규약으로 호출, `typeof entry === "function"`이면 구버전 폴백. 둘 다 아니면 플레이스홀더.
- **드래그 리사이즈**(`attachDrag`): `mousedown`→`mousemove`→`mouseup`. 인접 pane 중 앞쪽(`prevPane`)은 항상 고정 px 전환, **뒤쪽(`nextPane`)이 해당 split-container의 마지막 자식이면 `flex-grow`를 유지**(고정 px로 안 바꿈) — STEP 1에서 문서로 확인한 "검색조건 패널 접었을 때 빈 공백 버그" 수정사항이 실제 코드에 정확히 반영됨.
- `minSize`로 각 pane의 최소 크기 방어(clamp).

## 4-5. 화면별 레이아웃 선언 — `screen-layouts.js`

실제 `SCREEN_LAYOUTS` 등록 현황(6개 menuKey):

| menuKey | 유형 | 구조 |
|---|---|---|
| `account_register` | A | 단일 pane |
| `biz_reg_no` | A | 단일 pane |
| `tax_invoice_search` | A | 단일 pane |
| `voucher_entry` | B | 상하 3단(헤더그리드/상세그리드/관리항목폼), ratios `[1,2,1]` |
| `vendor_info` | C | 좌우 2단(리스트그리드 + 기본/부가/기타정보 서브탭), ratios `[1,2]` |
| `admin_settings` | C | 좌우 2단(사용자목록 + 기본정보/권한정보 서브탭), ratios `[1,2]` |
| `profit_payment_date` | **C** | 좌우 2단(손익목록 + 매입/관련문서 서브탭), ratios `[3,1]` |

- **⚠️ 문서-코드 불일치 발견**: STEP 1에서 분석한 계획 문서(`new_menu_dev_guide.md` 등)는 `profit_payment_date`(지급기준손익)를 예시로 들 때 "유형 A(단일 그리드)"으로 가정하는 서술이 있었으나, **실제 구현은 유형 C**(좌측 목록 그리드 + 우측 매입/관련문서 서브탭)임을 코드로 확인. Reference 화면 분석(STEP 6)에서 최종 확정할 것.
- 폴백: `SCREEN_LAYOUT_DEFAULT = { type:"pane", contentId:"__default__main_grid" }`.

## 4-6. 검색조건 패널 — `search-fields-config.js` + `search-panel.js`

- `SEARCH_FIELDS_CONFIG`: menuKey별 필드 배열(`text`/`select`/`daterange`/`date`), 없으면 `SEARCH_FIELDS_DEFAULT`(검색어 1개) 폴백.
- `profit_payment_date`는 `date` 타입 1개(`name:"date"`, `default:"closingDate"`) — 신규 탭 생성 시에만 `DateDefaultRules.closingDate()`로 자동 채움.
- **`date` 타입 입력의 UX 설계**(네이티브 `<input type=date>` 미사용, 직접 구현):
  - 숫자만 입력 허용, 8자리 cap → blur 시 유효하면 `YYYY-MM-DD`로 포맷
  - **검증(alert)은 blur가 아니라 "조회" 실행 시점에만** — blur+alert+refocus 조합이 무한루프를 일으키는 문제를 피하기 위한 의도적 설계
  - focus 시 전체 선택(바로 덮어쓰기 가능)
- `DateDefaultRules`(레지스트리 패턴): `today`, `closingDate`(1~10일→10일, 11~20일→11·12일이 월요일이면 10일 아니면 20일, 21일~말일→말일, 토/일이면 평일로 보정 — Python 원본 로직을 JS로 포팅, 요일 인덱스 매핑 차이 주석으로 명시).
- Enter 키 입력 시 `.toolbar-btn[data-action=search]`를 프로그래밍적으로 클릭 → `toolbar.js`의 기존 핸들러 재사용(중복 구현 없음).

## 4-7. 툴바 — `toolbar.js`

- 이벤트 위임으로 `.toolbar-btn` 클릭 처리.
- `"search"`(조회) 액션만 실제 배선 완료: 활성 탭의 `data-tab-id`(`"tab-" + menuKey`)에서 menuKey를 역산 → `window.ScreenReloadHandlers[menuKey]` 호출 (STEP 5의 `registry.js`가 제공하는 레지스트리).
- 나머지 액션(추가/삭제/저장/인쇄/닫기)은 `console.log`만 하는 더미 상태 — **향후 개발 필요 항목**.
- 구버전 코드(주석 처리된 블록)가 파일에 그대로 남아있음 — 정리 후보.

## 4-8. Reference 화면 진입 경로 요약 (STEP 6에서 상세 분석 예정)

```
admin_settings:          사이드바 하단 ⚙ 버튼 → TabManager.openTab("admin_settings", "설정")
profit_payment_date:     사이드바 트리 "손익관리 > 지급기준손익" 리프 클릭 → TabManager.openTab("profit_payment_date", "지급기준손익")
```//두 경로 모두 동일한 `TabManager.openTab()` 함수를 타므로 진입 방식이 다를 뿐 이후 처리(ensureContentPane→SplitLayout→content-renderers)는 완전히 동일한 파이프라인.
