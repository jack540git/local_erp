# ERP UI 스켈레톤 개발 진행 기록

> 원본 지시서: `ERP_UI_스켈레톤_개발지시서.md` (참조 이미지: ERPiU 스타일 회계 ERP 화면)
> 기술스택: Flask + Jinja2 / PostgreSQL / AG Grid Community(예정) / Vanilla JS

---

## 참조 이미지 분석 요약

첨부된 ERPiU 화면 4장 기준으로 구조 확인:

1. **좌측 사이드바**: 로고(`ERPiU`) + 즐겨찾기/최근/트리 아이콘 바 + 3단계 트리메뉴 (예: 회계관리 > 세금계산서관리 > 세금계산서조회)
2. **상단 마스터바**: 조회/추가/삭제/저장/인쇄/닫기 버튼(아이콘+텍스트) + 우측 검색/원격지원/로그아웃
3. **탭바(MDI)**: 여러 메뉴가 탭으로 동시에 열려있고, 활성 탭은 파란 밑줄 강조, `X`로 개별 닫기 가능
4. **메인 영역**: 접이식 조회조건 폼 + 그리드(엑셀풍, 헤더 진한 배경, 컬럼별 정렬/필터) + 하단 합계 행
5. 세부 화면(거래처정보관리 등)은 좌측 리스트 그리드 + 우측 상세 폼(탭 구조: 기본정보/부가정보/기타정보) 형태
6. 전표입력 화면은 헤더 그리드 + 상세 그리드(차변/대변) + 하단 관리항목 영역의 3단 구조

이 구조는 지시서의 3-2(탭바), 3-3(사이드바), 3-4(메인 영역) 명세와 정확히 일치함을 확인.

---

## Step 1 — 3분할 레이아웃 뼈대 (완료)

### 목표
`base.html`에 사이드바 / 상단바+탭바 / 메인영역 3분할을 CSS Grid로 구성하고, 더미 색상 블록으로 영역 배치만 우선 확인.

### 생성/수정한 파일

```
local_erp/
├── app.py                          [수정] /dashboard 라우트가 base.html 렌더링하도록 변경
├── static/
│   ├── css/
│   │   ├── layout.css              [신규] 3분할 CSS Grid 뼈대 + 더미 블록 스타일 (핵심)
│   │   ├── sidebar.css             [신규] 빈 파일 (Step 2~3에서 채울 예정)
│   │   ├── tabs.css                [신규] 빈 파일 (Step 4에서 채울 예정)
│   │   └── ag-grid-theme.css       [신규] 빈 파일 (Step 7에서 채울 예정)
│   ├── js/
│   │   ├── tab-manager.js          [신규] 빈 파일 (Step 4)
│   │   ├── sidebar-tree.js         [신규] 빈 파일 (Step 2~3)
│   │   ├── splitter.js             [신규] 빈 파일 (Step 8)
│   │   └── grid-init.js            [신규] 빈 파일 (Step 7)
│   └── vendor/                     [신규] 빈 폴더 (Step 7에서 ag-grid-community 배치 예정)
└── templates/
    ├── base.html                   [신규] 3분할 뼈대, Jinja2 block 구조로 이후 단계 확장 가능하게 설계
    └── partials/                   [신규] 빈 폴더 (Step 4 이후 탭별 콘텐츠 partial 배치 예정)
```

### `layout.css` 핵심 구조

```css
:root {
    --sidebar-width: 280px;   /* Step 3: 토글 시 이 값만 변경 -> transition 자동 적용 */
    --topbar-height: 48px;
    --tabbar-height: 40px;
    --statusbar-height: 28px;
    --transition-speed: 0.3s;
}

.app-shell {
    display: grid;
    grid-template-columns: var(--sidebar-width) 1fr;
    grid-template-rows: var(--topbar-height) var(--tabbar-height) 1fr var(--statusbar-height);
    grid-template-areas:
        "sidebar topbar"
        "sidebar tabbar"
        "sidebar main"
        "sidebar statusbar";
    height: 100vh;
    transition: grid-template-columns var(--transition-speed) ease;
}
```

지시서 원안(3분할: 사이드바/상단바+탭바/메인)에서 **하단 상태바를 별도 grid row로 추가**했음 (원본 와이어프레임에도 "상태바(하단)"이 명시되어 있어 처음부터 구조에 포함).

### `base.html` 설계 포인트

- 5개 영역(`area-sidebar`, `area-topbar`, `area-tabbar`, `area-main`, `area-statusbar`)을 각각 `dummy-block`으로 채워 색상으로 구분(사이드바: 연파랑, 상단바: 연노랑, 탭바: 연초록, 메인: 연회색, 상태바: 진한 남색).
- `{% block sidebar %}`, `{% block main_content %}` 등 Jinja2 block을 미리 배치해서, Step 2 이후 실제 트리/그리드 내용을 이 골격 위에 그대로 얹을 수 있도록 설계 (base.html 자체를 다시 갈아엎지 않아도 됨).
- 로그인 사용자 정보(`email`, `role`)와 로그아웃 버튼은 상단바 더미 블록 안에 임시 배치 — 지시서의 "우측: 검색, 알림, 로그아웃 등 보조 아이콘" 위치와 동일한 자리.

### 로그인 흐름 변경

기존: `login_process()` 성공 → `/dashboard` → `dashboard.html` (단순 정보 표시 페이지)
변경: `login_process()` 성공 → `/dashboard` → **`base.html`** (ERP UI 스켈레톤)

```python
@app.route("/dashboard")
@login_required
def dashboard():
    return render_template("base.html", email=session["email"], role=session["role"])
```

`dashboard.html`(기존 파일)은 코드 목록에서 참조가 제거되었으나, 파일 자체는 아직 삭제하지 않음 (필요 시 참고용으로 유지, 완전히 불필요해지면 추후 정리).

### 검증 방법

브라우저에서 로그인 후 `/dashboard` 진입 시, 5개 영역이 각각 다른 색상 블록으로 구분되어 보이면 Step 1 완료.

- [x] 사이드바(연파랑) / 상단바(연노랑) / 탭바(연초록) / 메인(연회색) / 상태바(남색) 5개 영역이 겹치지 않고 올바른 위치에 배치됨 — **사용자 확인 완료**

---

## Step 2 — 좌측 트리메뉴(3단계) + 펼침/접힘 애니메이션 (완료)

### 목표
좌측 사이드바에 3단계 계층 더미 트리 데이터를 렌더링하고, 폴더 펼침/접힘 애니메이션과 hover/active 스타일을 구현.

### 생성/수정한 파일

```
local_erp/
├── app.py                            [수정] tree_menu(DUMMY_TREE_MENU)를 base.html에 전달
├── menu_data.py                      [신규] 3단계 더미 트리 데이터 (회계관리 > 기초자료등록/전표관리 > 계정등록 등)
├── static/
│   ├── css/
│   │   └── sidebar.css               [작성] 트리 스타일, hover/active, 펼침/접힘 아이콘 회전
│   └── js/
│       └── sidebar-tree.js           [작성] 이벤트 위임 기반 폴더 토글 + 리프 선택 로직
└── templates/
    ├── base.html                     [수정] 사이드바 영역에 _sidebar_tree.html include, sidebar-tree.js 로드
    └── partials/
        └── _sidebar_tree.html        [신규] Jinja2 재귀 매크로로 트리 렌더링
```

### 더미 트리 데이터 구조 (`menu_data.py`)

지시서 3-3절 예시 그대로 반영:

```
회계관리
  기초자료등록
    계정등록
    사업자등록번호
  전표관리
    전표입력
세금계산서관리
  세금계산서조회
```

Python 리스트/딕셔너리 구조로 정의 (`type: folder|file`, `children`, 리프는 `key`로 menu 식별자 부여). Step 9(DB 연동) 시 이 더미 리스트를 실제 메뉴 테이블 조회 결과로 교체할 예정.

### 트리 렌더링 방식 (`_sidebar_tree.html`)

Jinja2 매크로가 자기 자신을 재귀 호출하는 방식으로 구현 — depth 제한 없이 몇 단계든 렌더링 가능:

```jinja2
{% macro render_tree(nodes) %}
<ul class="tree-list">
    {% for node in nodes %}
        {% if node.type == 'folder' %}
        <li class="tree-node tree-folder">
            <div class="tree-row" data-role="folder-toggle">...</div>
            <div class="tree-children">{{ render_tree(node.children) }}</div>
        </li>
        {% else %}
        <li class="tree-node tree-leaf" data-menu-key="{{ node.key }}">...</li>
        {% endif %}
    {% endfor %}
</ul>
{% endmacro %}
```

### 펼침/접힘 애니메이션 구현 방식 (`sidebar-tree.js`) — 최초 구현 (이후 max-height → CSS Grid fr 방식으로 교체됨)

- CSS `max-height` 트릭 사용: `.tree-children`은 기본 `max-height: 0; overflow: hidden;` + `transition: max-height 0.25s ease;`
- JS가 실제 콘텐츠 높이(`scrollHeight`)를 계산해서 `max-height`에 대입 → 콘텐츠 길이와 무관하게 정확한 slideDown/slideUp 효과
- 이벤트 위임(`treeRoot.addEventListener('click', ...)`) 방식 사용 — 트리 노드가 늘어나도 리스너 재등록 불필요

### hover / active 스타일 (`sidebar.css`)

- Hover: `.tree-row:hover { background-color: #eef4fb; }`
- 폴더 펼침 상태: `▶` 아이콘을 `transform: rotate(90deg)`로 회전시켜 `▼` 느낌 표현 (별도 이미지 없이 아이콘 회전만으로 처리)
- 리프 노드 선택(active): 진한 파란 배경(`#2563a8`) + 흰 글씨, hover로 덮이지 않도록 고정
- 트리 depth가 깊어질수록 `.tree-list .tree-list { padding-left: 16px; }`로 자동 들여쓰기

### 설계 결정 사항 (참고)

- **사이드바 배경/트리 스타일**: 참조 이미지(ERPiU)는 좌측 아이콘 바가 진한 남색이지만, 이번 단계는 지시서 3-3절 텍스트 명세(hover 연한 배경, active 진한 파란 배경 등)를 우선 기준으로 삼아 밝은 배경으로 구현.
- **초기 펼침 상태**: 모든 폴더를 기본 접힌 상태로 시작.
- **리프 노드 클릭 시 동작**: 현재는 선택 상태(active 클래스)만 반영하고 `console.log`로 menuKey 출력. Step 4에서 탭 생성 로직과 연동 예정.

### 검증 방법

- [x] 좌측에 "회계관리", "세금계산서관리" 최상위 폴더 2개 표시 — **사용자 확인 완료**
- [x] 폴더 펼침/접힘, 3단계 트리 정상 표시 — **사용자 확인 완료**
- [x] 리프 노드 클릭 시 선택 표시, hover 스타일 정상 — **사용자 확인 완료**

---

## 부록 — base.html → _sidebar_tree.html → menu_data.py 호출 흐름

**중요한 오해 정정**: `_sidebar_tree.html`이 `menu_data.py`를 직접 "호출"하는 게 아니다.
Jinja2 템플릿은 Python 모듈을 import할 수 없다. 실제로는 **`app.py`(Python)가 `menu_data.py`에서
데이터를 가져와 템플릿에 변수로 "전달"**하고, 템플릿들은 그 변수를 이름으로만 참조해서 그릴 뿐이다.

### 요청 1건 처리 순서

```
① 브라우저: GET /dashboard 요청
        │
        ▼
② app.py의 dashboard() 함수 실행
   - 파일 상단에서 이미 해둔 임포트: from menu_data import DUMMY_TREE_MENU
   - render_template("base.html", email=..., role=..., tree_menu=DUMMY_TREE_MENU)
     -> 여기서 딱 한 번, 데이터를 "tree_menu"라는 이름으로 템플릿에 전달
        │
        ▼
③ Jinja2 엔진이 base.html 렌더링 시작 (email, role, tree_menu 변수를 이미 가진 상태)
   - {% include 'partials/_sidebar_tree.html' %} 를 만나면 그 파일 내용을 이 자리에 삽입
   - include는 현재 갖고 있는 변수들을 그대로 물려줌 (별도 전달 코드 불필요)
        │
        ▼
④ _sidebar_tree.html 렌더링
   - "tree_menu라는 변수가 이미 context에 있다"고 가정하고 바로 사용: {{ render_tree(tree_menu) }}
   - 이 파일은 menu_data.py의 존재 자체를 전혀 모른다
        │
        ▼
⑤ render_tree(nodes) 매크로가 재귀적으로 HTML 문자열 생성
   - folder 노드 -> <li class="tree-folder">...하위 재귀 호출...</li>
   - file 노드   -> <li class="tree-leaf" data-menu-key="...">...</li>
        │
        ▼
⑥ 완성된 순수 HTML이 base.html 안에 삽입되어 최종 HTML 완성
        │
        ▼
⑦ Flask가 완성된 HTML을 브라우저로 응답 전송
        │
        ▼
⑧ 브라우저가 HTML을 그리고 <script src=".../sidebar-tree.js"> 로드
   -> DOMContentLoaded 시점에 트리 클릭 이벤트 리스너 등록
   -> 여기서부터는 서버와 무관한 순수 클라이언트(브라우저) 동작
```

### 각 구성요소가 아는 것 / 모르는 것

| 구성요소 | 아는 것 | 모르는 것 |
|---|---|---|
| `app.py` | `menu_data.py`(직접 import), Flask/Jinja2 렌더링 방법 | `_sidebar_tree.html` 내부 구조 |
| `base.html` | `tree_menu`라는 이름의 변수가 존재한다는 것, `_sidebar_tree.html`을 include한다는 것 | `menu_data.py`의 존재 자체 |
| `_sidebar_tree.html` | `tree_menu` 변수가 이미 context에 있다는 것 | `menu_data.py`의 존재 자체 (그냥 이름이 같은 변수를 쓸 뿐) |
| `menu_data.py` | 순수 Python 데이터 정의만 | Flask, Jinja2, HTML의 존재 자체 (완전히 독립적인 데이터 파일) |

### 연결고리는 오직 app.py의 두 줄

```python
from menu_data import DUMMY_TREE_MENU                          # ① 데이터 가져오기
render_template("base.html", tree_menu=DUMMY_TREE_MENU, ...)    # ② 템플릿에 이름 붙여서 전달
```

이 두 줄이 없으면 템플릿들은 `tree_menu`가 뭔지 몰라 `UndefinedError`가 난다.
반대로 나중에 `menu_data.py`의 더미 데이터를 실제 DB 조회 결과로 교체해도(Step 9),
템플릿 쪽(`base.html`, `_sidebar_tree.html`)은 한 글자도 안 고쳐도 된다 —
이것이 "데이터와 화면을 분리해서 설계"한 이유다.

### `include`가 변수를 자동으로 넘기는 이유

`{% include %}`는 "그 파일 내용을 여기 그대로 복사해서 붙여넣는다"에 가까운 동작이다.
그래서 `base.html`이 갖고 있던 `tree_menu`, `email`, `role` 변수가 `_sidebar_tree.html`에서도
자동으로 그대로 보인다 (PHP의 `include`와 유사한 개념).

---

## 보안 강화 작업 (완료, 사용자 직접 진행)

> UI 스켈레톤 작업과 별도로, 로그인/세션 관련 보안 취약점을 점검하고 수정.

### 1. `FLASK_SECRET_KEY` 랜덤 값 적용

- `.env`의 플레이스홀더 값을 `secrets.token_hex(32)` 생성 값으로 교체.
- `app.py`는 이미 환경변수 우선 사용 중이라 코드 수정 불필요, `.env` 값만 교체.

### 2. CSRF 보호 추가

`Flask-WTF`의 `CSRFProtect` 도입.

**수정한 파일**

```
local_erp/
├── requirements.txt              [수정] Flask-WTF==1.2.2 추가
├── app.py                        [수정] CSRFProtect(app) 초기화 추가
└── templates/
    ├── login.html                [수정] 로그인 폼에 csrf_token() hidden input 추가
    └── base.html                 [수정] 로그아웃 폼에 csrf_token() hidden input 추가
```

### 3. `debug` 모드 환경변수 분리

```python
if __name__ == "__main__":
    debug_mode = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=8080, debug=debug_mode)
```

기본값은 디버그 비활성화, 로컬 개발 시에만 `.env`에 `FLASK_DEBUG=1` 설정.

---

## DB 커넥션 풀(Connection Pool) 도입 (완료, 사용자 직접 진행)

`db.py`가 요청마다 `psycopg.connect()`로 새 연결을 맺던 구조를 `ConnectionPool`로 전환.

**수정한 파일**

```
local_erp/
├── requirements.txt              [수정] psycopg-pool==3.2.3 추가
└── db.py                         [수정] psycopg.connect() 직접 호출 → ConnectionPool로 전환
```

```python
from psycopg_pool import ConnectionPool

pool = ConnectionPool(
    conninfo=_conninfo,
    min_size=2,
    max_size=10,
    kwargs={"row_factory": dict_row},
)

def find_user_by_email(email: str):
    with pool.connection() as conn:
        with conn.cursor() as cur:
            ...
```

---

## 트리 펼침/접기 애니메이션을 max-height 방식에서 CSS Grid `fr` 방식으로 전환 (완료, 사용자 직접 진행)

> 중첩 트리 아코디언 버그(상위 폴더가 하위 폴더 펼쳐짐에 맞춰 높이를 재계산하지 못하는 문제)를 근본적으로 해결.

### 새 방식 — CSS Grid `grid-template-rows: 0fr <-> 1fr`

**수정한 파일**

```
local_erp/
├── static/css/sidebar.css        [수정] .tree-children을 max-height 트릭 → CSS Grid fr 트릭으로 교체
└── static/js/sidebar-tree.js     [수정] toggleFolder 단순화, 보정 로직 전부 제거
```

```css
.tree-children {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.25s ease;
}

.tree-children > .tree-list {
    overflow: hidden;
    min-height: 0;
}

.tree-folder.expanded > .tree-children {
    grid-template-rows: 1fr;
}
```

```js
function toggleFolder(folderEl) {
    folderEl.classList.toggle("expanded");
}
```

`updateAncestorsMaxHeight()`, `transitionend` 보정 로직이 모두 제거되어 코드가 훨씬 단순해졌음. 중첩 단계 수와 무관하게 잘림/부자연스러운 2단계 움직임 문제가 구조적으로 해소됨.

---

## Step 3 — 사이드바 접기/펴기(토글) 버튼 + transition (완료)

> 진행 전 사용자와 3가지 사항 확인 후 진행함. 사용자가 직접 수정한 CSRF/DB 커넥션 풀/트리 애니메이션(CSS Grid fr 방식) 코드는 일절 수정하지 않음.

### 확인된 사항

1. 접힌 상태 사이드바 폭: **0px**
2. `_sidebar_tree.html`의 `.sidebar-header` 안에 있던 기존 ✕(`.sidebar-close`) 아이콘 삭제 (토글 버튼이 상단바로 이동하면서 중복되는 컨트롤 제거)
3. 토글 버튼은 `area-topbar` 안, 타이틀("TOP MASTER BAR" 더미 텍스트) 옆에 배치, 아이콘은 `◀`(펼침) / `▶`(접힘)

### 수정한 파일

```
local_erp/
├── static/
│   ├── css/
│   │   ├── layout.css              [수정] .sidebar-toggle-btn 스타일 추가
│   │   └── sidebar.css             [수정] 안 쓰는 .sidebar-close 관련 규칙 제거
│   └── js/
│       └── sidebar-tree.js         [수정] 토글 버튼 클릭 이벤트(--sidebar-width 변경) 추가
└── templates/
    ├── base.html                   [수정] 상단바에 토글 버튼 엘리먼트 생성
    └── partials/
        └── _sidebar_tree.html      [수정] 기존 ✕ 아이콘 삭제
```

### 토글 구현 방식

Step 1에서 이미 `--sidebar-width`를 CSS 변수로 만들어둔 덕분에, JS는 이 변수 값만 바꾸면 된다. 그리드 컬럼 폭 전환은 이미 `.app-shell`에 걸려있는 `transition: grid-template-columns var(--transition-speed) ease;`가 자동으로 처리해준다.

```js
const expandedWidth = getComputedStyle(rootEl).getPropertyValue("--sidebar-width").trim();
let collapsed = false;

toggleBtn.addEventListener("click", function () {
    collapsed = !collapsed;
    rootEl.style.setProperty("--sidebar-width", collapsed ? "0px" : expandedWidth);
    toggleBtn.textContent = collapsed ? "▶" : "◀";
});
```

- 페이지 로드 시점의 `--sidebar-width` 값(layout.css에 정의된 폭, 현재 사용자가 180px로 수정해둔 값)을 "펼침 상태 폭"으로 자동 저장. 하드코딩하지 않았기 때문에, 나중에 CSS에서 이 값을 바꿔도 JS 수정 불필요.
- `.area-sidebar`에 이미 `overflow: hidden;`이 설정되어 있어서(사용자가 수정한 sidebar.css 그대로 유지), 폭이 0px가 되면 내부 트리 콘텐츠가 자연스럽게 잘려서 보이지 않게 된다. 별도 CSS 추가 불필요.

### 토글 버튼 배치 (`base.html`)

```html
<span>
    <button type="button" id="sidebar-toggle-btn" class="sidebar-toggle-btn" aria-label="사이드바 토글">◀</button>
    TOP MASTER BAR (툴바 영역 — Step 5에서 구현 예정)
</span>
```

### 삭제된 요소

- `_sidebar_tree.html`의 `.sidebar-header` 안 `<span class="sidebar-close">✕</span>` 삭제
- `sidebar.css`의 `.sidebar-close`, `.sidebar-close:hover` 규칙 삭제 (사용처가 사라졌으므로 동시에 정리)

### 검증 방법

- [x] 상단바 왼쪽 `◀` 버튼 클릭 시 사이드바가 부드럽게 0px로 접히고 메인 영역이 자동 확장 — **사용자 확인 완료**
- [x] 버튼 아이콘 `◀` ↔ `▶` 전환, 사이드바 헤더 ✕ 아이콘 제거 확인 — **사용자 확인 완료**

---

## Step 4 — 탭 매니저(트리 클릭 → 탭 생성/중복방지/닫기/전환) (완료)

> 직접 수정하신 CSRF/DB 커넥션 풀/트리 애니메이션(CSS Grid fr 방식) 코드는 일절 수정하지 않음.

### 목표

지시서 3-2절 명세대로: 트리 리프 클릭 시 새 탭 생성 및 즉시 활성화, 이미 열린 메뉴는 중복 탭 없이 기존 탭 포커스, 활성/비활성 탭 스타일 구분, 탭별 `✕` 닫기(닫으면 인접 탭으로 포커스 이동), 탭 전환 시 메인 콘텐츠 즉시 교체.

### 수정/생성한 파일

```
local_erp/
├── static/
│   ├── css/
│   │   └── tabs.css               [작성] 활성/비활성 탭 스타일, 탭별 콘텐츠(.tab-pane) 표시 토글
│   └── js/
│       ├── tab-manager.js         [작성] 탭 상태 관리(생성/중복방지/닫기/전환), window.TabManager로 공개
│       └── sidebar-tree.js        [수정] Step 2 때 남겨둔 "Step 4 연동 예정" 자리(console.log)를
│                                          TabManager.openTab() 호출로 교체
└── templates/
    └── base.html                  [수정] 탭바(#tab-bar)·탭별 콘텐츠 영역(#tab-content-area) 실제 구조로 교체,
                                           tab-manager.js 로드 추가
```

### 데이터 구조 (`tab-manager.js`)

지시서 예시 그대로 반영:

```js
tabs = [
    { id: "tab-home", title: "홈", menuKey: null, closable: false },  // 홈 탭: 항상 존재, 닫기 불가
    { id: "tab-xxx", title: "계정등록", menuKey: "account_register", closable: true },
]
activeTabId = "tab-xxx"
```

`menuKey`를 기준으로 중복 여부 판단 — 이미 열린 `menuKey`면 `activateTab()`만 호출하고 새 탭을 만들지 않음.

### 콘텐츠 전환 방식

지시서 3-2절이 제안한 두 방식(① 미리 렌더링해두고 display 토글, ② AJAX로 Jinja2 partial fetch) 중 **①번 방식** 채택:

```js
function ensureContentPane(tab) {
    // 탭마다 <div class="tab-pane" data-tab-id="...">를 최초 오픈 시 한 번만 생성
    // Step 4는 더미 단계라 내용은 "타이틀 + menuKey" 텍스트만 표시
}

function renderActiveContent() {
    contentAreaEl.querySelectorAll(":scope > .tab-pane").forEach(function (pane) {
        pane.classList.toggle("active", pane.dataset.tabId === activeTabId);
    });
}
```

Step 6~8에서 각 탭의 실제 콘텐츠(조회조건+AG Grid)를 채울 때, `ensureContentPane()`의 `innerHTML` 생성 부분만 교체하면 되는 구조로 설계.

### 닫기 시 포커스 이동 로직

```js
function closeTab(tabId) {
    const idx = tabs.findIndex(t => t.id === tabId);
    const wasActive = activeTabId === tabId;
    tabs.splice(idx, 1);
    // ...
    if (wasActive) {
        // 오른쪽 인접 탭 우선 -> 없으면 왼쪽 -> 그래도 없으면 마지막 탭(홈은 항상 남아있어 보장됨)
        const nextTab = tabs[idx] || tabs[idx - 1] || tabs[tabs.length - 1];
        activeTabId = nextTab.id;
    }
}
```

홈 탭이 `closable: false`라 항상 배열에 남아있으므로, `tabs`가 완전히 비는 경우는 발생하지 않음.

### 트리 ↔ 탭 연동 (`sidebar-tree.js` 수정)

```js
// 변경 전 (Step 2)
console.log("선택된 메뉴:", leafEl.dataset.menuKey);

// 변경 후 (Step 4)
const menuKey = leafEl.dataset.menuKey;
const title = leafEl.querySelector(".tree-label").textContent;
if (window.TabManager) {
    window.TabManager.openTab(menuKey, title);
}
```

### 탭 스타일 (`tabs.css`)

- 활성 탭: 배경 흰색 + `font-weight: bold` + 하단 2px 파란 보더(`::after` 가상요소)
- 비활성 탭: 연한 회색 배경(`#e4e9f0`)
- `✕` 클릭 시 `event.stopPropagation()`으로 탭 활성화 클릭 이벤트와 분리 처리 (닫기만 실행되고 탭이 활성화되지 않도록)

### 검증 방법

```bash
docker compose up -d --build
```

- [ ] "계정등록" 등 리프 노드 클릭 시 탭바에 새 탭 생성 + 즉시 활성화
- [ ] 같은 메뉴 재클릭 시 새 탭 안 생기고 기존 탭 포커스 이동
- [ ] 활성 탭 스타일(밝은 배경+bold+하단 파란 줄) 확인
- [ ] 탭 `✕` 클릭 시 해당 탭만 닫히고 인접 탭으로 포커스 이동
- [ ] "홈" 탭에는 `✕` 없어서 닫기 불가 확인
- [ ] 탭 전환 시 메인 영역 콘텐츠 즉시 교체 확인

---

## 다음 단계 예정 (지시서 기준)

| Step | 내용 | 상태 |
|---|---|---|
| 1 | 3분할 CSS Grid 뼈대 + 더미 색상 블록 | ✅ 완료 |
| 2 | 좌측 트리메뉴 더미 데이터(3단계) 렌더링 + 펼침/접힘 애니메이션 | ✅ 완료 |
| 3 | 사이드바 토글(접기/펴기) 버튼 + transition | ✅ 완료 |
| 4 | 탭 매니저 JS(트리 클릭 → 탭 생성/중복방지/닫기/전환) | ✅ 완료 |
| 5 | 상단 마스터바 툴바 버튼(조회/추가/삭제/저장) + 아이콘 | 진행 중 |
| 6 | 조회조건 영역 접기/펴기 + 그리드 영역 자동 확장 | 예정 |
| 7 | AG Grid Community 설치, 더미 데이터 렌더링, 엑셀풍 테마 | 예정 |
| 8 | 마스터/디테일 그리드 분할 + Splitter 드래그 리사이즈 | 예정 |
| 9 | PostgreSQL 연동 API 추가 (별도 요청 시 진행) | 보류 |

> 지시서 권장대로, Step 5부터는 한 단계씩 요청받아 진행하고 매 단계마다 확인 예정.
