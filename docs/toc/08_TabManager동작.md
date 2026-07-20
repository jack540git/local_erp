# 8. Tab Manager 동작

> 근거: [analysis/STEP4_Frontend분석.md](../analysis/STEP4_Frontend분석.md) 4-3절

## 8-1. 상태 모델

`tab-manager.js`는 IIFE로 감싸여 `window.TabManager`만 노출한다. 내부 상태는:

- `tabs`: 배열. 홈 탭은 `closable:false`로 항상 존재(배열이 빈 적이 없도록 보장).
- `activeTabId`: 현재 활성 탭의 ID.

## 8-2. `openTab(menuKey, title)`

```
menuKey가 이미 tabs 배열에 있는가?
  있음 → activateTab(existingId)만 호출 (중복 탭 생성 방지)
  없음 → 새 탭 push
       → ensureContentPane(tab)  (비동기 호출, await 하지 않음 — "발사 후 대기 안 함")
       → activateTab(newId)
```

`menuKey` 기준 중복 방지 덕분에, 사이드바에서 같은 메뉴를 여러 번 클릭해도 탭이 하나만 존재한다. 이 특성 때문에 `content-renderers/*.js` 안에서 모듈 스코프 변수(`listGridApi` 등)로 그리드 인스턴스를 안전하게 재사용할 수 있다(예: `profit-analysis.js`, `admin.js` 둘 다 이 패턴).

## 8-3. `ensureContentPane(tab)` — async 핵심 로직

```
1. 검색조건 패널 삽입 (SearchPanel.build)
2. .screen-content-area div 생성
3. Lazy Loading 판단 (isDomainRendererLoaded(menuKey))
     이미 로드됨 → 즉시 SplitLayout.render()
     안 됨      → loadDomainScriptOnce(menuKey)로 <script> 동적 로드
                  → 성공: SplitLayout.render()
                  → 실패: 사용자에게 폴백 메시지 표시, _loadedScripts 캐시에서 제거(재시도 가능하게)
```

## 8-4. Lazy Loading 대상 — `DOMAIN_SCRIPT_MAP`

| menuKey | 동적 로드 대상 스크립트 |
|---|---|
| `admin_settings` | `content-renderers/admin.js` |
| `profit_payment_date` | `content-renderers/profit-analysis.js` |

두 Reference 화면 모두 Lazy Loading 대상이라는 점은, 초기 계획 문서 단계에서는 `admin_settings`만 언급되었으나 실제 코드에는 `profit_payment_date`도 등록되어 있다는 차이가 있다(STEP 4에서 코드로 확인). 이유는 접근 빈도가 낮거나 코드량이 큰 화면의 초기 로딩 부담을 줄이기 위함으로 추정된다.

`_loadedScripts`(Map)로 로드 여부를 캐싱하되, **로드 실패 시 캐시에서 제거하여 재시도가 가능**하도록 처리되어 있다(과거 리팩터링 문서의 개선사항이 실제 코드에 반영됨).

## 8-5. `activateTab(tabId)` / `closeTab(tabId)`

- `activateTab`: 해당 탭의 콘텐츠 영역을 표시하고 나머지는 숨김, 탭바 active 클래스 갱신.
- `closeTab`: 닫을 때 인접 탭(오른쪽 우선)으로 포커스 이동. 홈 탭은 `closable:false`라 항상 최소 1개 탭은 남는다.

## 8-6. 신규 화면 개발자가 알아야 할 것

- 새 메뉴를 Lazy Loading 대상으로 만들고 싶다면 `DOMAIN_SCRIPT_MAP`에 항목을 추가하면 되지만, **이 파일(`tab-manager.js`)은 엔진이므로 원칙적으로 수정하지 않는 것을 지향**한다. 신규 도메인의 렌더러 파일을 eager 로드 목록(`base.html`)에 추가하는 것이 더 원칙에 부합한다.
- `openTab()`은 `title`을 그대로 탭 라벨에 쓰므로, 사이드바 메뉴명과 탭 제목을 일치시키는 것이 사용자 경험상 자연스럽다.
