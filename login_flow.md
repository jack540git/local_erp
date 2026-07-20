# 로그인 흐름 상세 정리 (localhost:8080 → 로그인 → 대시보드)

> 실제 코드(`app.py`, `routes/`, `auth.py`, `repository/`, `db/`, `templates/`) 기준으로 검증한 내용.
> 아키텍처 배경은 `erp_backend_migration_plan.md`, UI 렌더링 배경은 `erp_ui_progress.md` 참고.

---

## 전체 흐름 (파일 · 함수 단위)

### 1. 브라우저 접속

```
브라우저: GET http://localhost:8080/
```

### 2. Docker 포트 매핑 (nginx 미경유)

`local_erp/docker-compose.yml`에 `ports: - "8080:8080"`이 직접 열려있어서, Docker가 Windows의 8080번 포트를
컨테이너에 바로 연결한다. **공용 리버스 프록시(nginx)는 `erp.local`로 접속할 때만 거치는 별도 경로이고,
`localhost:8080` 접속은 nginx를 전혀 거치지 않는다.**

### 3. `/` 라우트 매칭 — Blueprint 등록 구조

`app.py`는 시작 시점에 이미 라우트를 전부 등록해둔 상태다.

```python
# app.py
from routes.auth_routes import auth_bp
from routes.erp_routes import erp_bp
from routes.admin_routes import admin_bp

app.register_blueprint(auth_bp)                       # "/" , "/login", "/logout"
app.register_blueprint(erp_bp)                         # "/dashboard"
app.register_blueprint(admin_bp, url_prefix="/admin")   # 빈 스텁
```

`GET /`은 `routes/auth_routes.py`의 `login_page()`가 처리한다:

```python
@auth_bp.route("/")
def login_page():
    if "user_id" in session:
        return redirect(url_for("erp.dashboard"))   # 이미 로그인된 상태면 대시보드로
    return render_template("login.html")            # 아니면 로그인 페이지
```

> **라우트가 어떤 조건으로 실행되는가**: URL 경로(`/`)와 HTTP 메서드(기본 GET)가 일치하는 함수를 Flask가 찾아 실행한다.
> 그 이후 "로그인 페이지를 보여줄지, 대시보드로 보낼지"는 함수 **내부의 `if "user_id" in session` 분기**가 결정한다.

### 4. `login.html` — 로그인 버튼 클릭

`login.html`에는 클릭을 감지하는 JavaScript가 없다. 순수 HTML `<form>`의 기본 동작을 그대로 쓴다.

```html
<form action="{{ url_for('auth.login_process') }}" method="post">
    <input type="hidden" name="csrf_token" value="{{ csrf_token() }}">
    <input type="email" name="email" ...>
    <input type="password" name="password" ...>
    <button type="submit">로그인</button>
</form>
```

`<button type="submit">` 클릭 → 브라우저가 폼 데이터를 담아 **풀 페이지 리로드 방식으로** `POST /login`을 요청한다.

### 5. `login_process()` 실행 — `routes/auth_routes.py`

```python
@auth_bp.route("/login", methods=["POST"])
def login_process():
    email = request.form.get("email", "").strip()
    password = request.form.get("password", "")

    if not email or not password:
        flash("이메일과 비밀번호를 모두 입력해주세요.")
        return redirect(url_for("auth.login_page"))

    user = find_user_by_email(email)                                     # (A) repository 호출

    if not user or not verify_password(user["password"], password):      # (B) auth.py 호출
        logger.warning("로그인 실패: %s", email)
        flash("이메일 또는 비밀번호가 올바르지 않습니다.")
        return redirect(url_for("auth.login_page"))

    session.clear()
    session["user_id"] = user["id"]
    session["email"] = user["email"]
    session["role"] = user["role"]
    logger.info("로그인 성공: %s (role=%s)", user["email"], user["role"])

    return redirect(url_for("erp.dashboard"))                             # (C) 302 응답, 함수 종료
```

### 6. (A) `find_user_by_email()` — `repository/local_repository.py`

```python
from db.local_db import get_local_db_connection

def find_user_by_email(email: str):
    with get_local_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, email, password, role FROM users WHERE email = %s", (email,))
            return cur.fetchone()
```

`auth_routes.py`가 `repository.local_repository`를 import했기 때문에 이 함수를 호출할 수 있다.

### 7. (B) `verify_password()` — `auth.py`

```python
def verify_password(stored_hash, input_password):
    if stored_hash.startswith(("$2y$", "$2b$", "$2a$")):
        return bcrypt.checkpw(input_password.encode("utf-8"), stored_hash.encode("utf-8"))
    return check_password_hash(stored_hash, input_password)
```

레거시 bcrypt 계정과 werkzeug(pbkdf2/scrypt) 계정 두 방식을 접두사로 구분해서 검증한다.

### 8. 리다이렉트의 실체 — "한 번"이 아니라 "두 번의 요청·응답"

```
브라우저 → POST /login              (login_process 실행)
서버     → 302 Found, Location: /dashboard   ← login_process()는 여기서 완전히 종료됨
브라우저 → (자동으로) GET /dashboard          ← 완전히 새로운 요청, 새로운 함수 호출
```

`redirect(...)`를 반환하는 순간 `login_process()` 함수는 끝난다. 그 이후는 **브라우저가 응답의 `Location` 헤더를 보고
스스로 새 요청을 보내는 것**이지, 서버 쪽에서 이어서 실행되는 게 아니다.

### 9. `GET /dashboard` — `routes/erp_routes.py`

```python
@erp_bp.route("/dashboard")
@login_required                              # auth.py의 데코레이터, dashboard() 본문보다 먼저 실행
def dashboard():
    return render_template(
        "base.html",
        email=session["email"],
        role=session["role"],
        tree_menu=DUMMY_TREE_MENU,            # menu_data.py의 더미 트리 데이터
    )
```

`@login_required`(`auth.py`)가 먼저 실행되어 `session`에 `user_id`가 있는지 확인한다. 방금 5단계에서 저장해뒀으니 통과.
통과하면 `dashboard()` 본문이 실행되어 `base.html`을 `email`/`role`/`tree_menu`와 함께 렌더링한다.

### 10. `base.html` 렌더링 — Jinja2

Jinja2는 Python용 템플릿 엔진으로, HTML/설정파일/SQL/텍스트 등에 변수와 제어문을 넣어 동적으로 문서를 생성하는 라이브러리다.
`render_template("base.html", tree_menu=..., email=..., role=...)` 호출 시점에 이 세 변수가 담긴
**컨텍스트(context)**가 만들어지고, `base.html` 렌더링 내내 이 컨텍스트를 사용할 수 있다.

`base.html`은 이 시점에:
- `{% include 'partials/_sidebar_tree.html' %}`로 트리 HTML을 이 자리에 삽입
- `layout.css`, `sidebar.css`, `tabs.css` 등 CSS `<link>` 태그 나열
- `tab-manager.js`, `sidebar-tree.js` 등 JS `<script>` 태그 나열
- AG Grid CDN 스크립트/스타일 로드

### 11. `_sidebar_tree.html`이 트리 HTML을 실제로 생성하는 방식

```jinja2
{% macro render_tree(nodes) %}
<ul class="tree-list">
    {% for node in nodes %}
        {% if node.type == 'folder' %}
        <li class="tree-node tree-folder">
            ...
            <div class="tree-children">{{ render_tree(node.children) }}</div>   {# 재귀 호출 #}
        </li>
        {% else %}
        <li class="tree-node tree-leaf" data-menu-key="{{ node.key }}">...</li>
        {% endif %}
    {% endfor %}
</ul>
{% endmacro %}

<div class="sidebar-tree" id="sidebar-tree">
    {{ render_tree(tree_menu) }}   {# 매크로 최초 호출 #}
</div>
```

- `{% for %}`는 `_sidebar_tree.html` 최상위가 아니라 **`render_tree` 매크로 내부**에 있다.
- `{{ render_tree(tree_menu) }}`: `tree_menu`(최상위 리스트 — 회계관리/세금계산서관리)를 매크로에 인자로 전달.
- 매크로 내부 `{% for node in nodes %}`: 전달받은 리스트를 순회하며 폴더/파일을 각각 `<li>`로 그림.
- 폴더인 경우 `{{ render_tree(node.children) }}`: 그 폴더의 하위 목록을 **같은 매크로에 다시 전달**(재귀) →
  트리 깊이가 3단계든 5단계든 코드 수정 없이 자동 처리됨.

`sidebar-tree.js`는 이 HTML을 만드는 게 아니라, **이미 완성되어 브라우저에 도착한 HTML에 나중에 클릭
이벤트(펼침/접힘, 탭 열기)만 붙이는 역할**이다.

### 12. 이후는 전부 클라이언트 사이드

`base.html`이 완성된 HTML로 브라우저에 도착하면, 트리 클릭 → `TabManager.openTab()` → `SplitLayout.render()` →
`ScreenContentRenderers[contentId]`(AG Grid/key-value 폼)로 이어지는 흐름은 **서버 재요청 없이** 브라우저 안에서만 진행된다.

---

## 진행 중 나온 의문점 Q&A

### Q1. `auth_bp.login_process`가 아니라 왜 `auth.login_process`로 호출하는가?

`auth_bp`는 파이썬 코드에서 이 Blueprint 객체를 가리키는 **변수명**일 뿐이고, `url_for()`가 실제로 참조하는
**등록 이름(네임스페이스)**은 `Blueprint(...)`의 첫 번째 인자로 넘긴 **문자열**이다.

```python
auth_bp = Blueprint("auth", __name__)
#          ^^^^^^^^   ^^^^^^
#          변수명     등록 이름 (url_for가 참조하는 실제 이름표)
```

`url_for("auth.login_process")`는 "등록 이름이 `auth`인 Blueprint 안의 `login_process` 함수"를 가리킨다.
변수명(`auth_bp`)과 등록 이름(`"auth"`)은 서로 다르게 지어도 코드는 정상 동작한다 — 헷갈리지 않도록 보통 맞춰서 지을 뿐이다.

### Q2. DB 커넥션은 언제 연결되고, 언제 끊기는가? 매 요청마다 새로 연결하는가?

`db/local_db.py`:
```python
pool = ConnectionPool(conninfo=..., min_size=2, max_size=10, ...)

def get_local_db_connection():
    return pool.connection()
```

| 오해 | 실제 동작 |
|---|---|
| 요청마다 새로 TCP 연결(connect)한다 | ❌ 아님 — 앱 시작 시점에 `min_size=2`만큼 미리 연결을 맺어두고 대기시킨다 |
| 요청이 끝나면 연결을 완전히 끊는다(close) | ❌ 아님 — `with` 블록이 끝나면 연결을 **풀에 반납**할 뿐, 연결 자체는 살아있다 |
| 한 번 빌려서 쓰고 반납, 다음 요청이 다시 빌려씀 | ✅ 정확함 |

- **연결 시점**: `ConnectionPool(...)` 객체가 생성되는 순간(Flask 앱 시작 시)에 최소 연결 수만큼 미리 연결.
- **빌리는 시점**: `with get_local_db_connection() as conn:` 진입 시, 풀에서 대기 중인 연결 하나를 빌려옴.
- **반납 시점**: `with` 블록을 벗어날 때(`repository/local_repository.py`의 `return cur.fetchone()` 직전),
  연결을 끊는 게 아니라 풀에 돌려줘서 다음 요청이 재사용할 수 있게 함.
- **진짜로 끊기는 경우**: 앱 자체가 종료되거나, 풀이 오래 유휴 상태인 연결을 정리하는 경우 정도.

이게 "커넥션 풀"을 쓰는 이유 — 매 요청마다 PostgreSQL과 TCP+인증 핸드셰이크를 새로 하는 비용을 없애고,
이미 열려있는 연결을 여러 요청이 돌려가며 재사용한다.

---

## 전체 흐름 한 장 요약

```
①  브라우저 GET localhost:8080/
②  Docker 포트매핑 (nginx 무관) → Flask 컨테이너
③  auth_bp.login_page() [routes/auth_routes.py]
       session 없음 → render_template("login.html")
④  사용자가 로그인 버튼 클릭 → <form method="post"> 기본 제출 (JS 이벤트 없음)
⑤  auth_bp.login_process() [routes/auth_routes.py]
       → find_user_by_email() [repository/local_repository.py]
            → get_local_db_connection() [db/local_db.py] → myappdb 조회 (풀에서 연결 빌림 → 반납)
⑥      → verify_password() [auth.py] → bcrypt/werkzeug 판별 후 검증
       → session["user_id"/"email"/"role"] 저장
       → redirect(url_for("erp.dashboard"))  ← 302 응답, 여기서 함수 완전히 종료
⑦  브라우저가 자동으로 GET /dashboard 재요청 (완전히 새로운 요청)
⑧  @login_required [auth.py] 통과 확인
    → erp_bp.dashboard() [routes/erp_routes.py]
    → render_template("base.html", email=..., role=..., tree_menu=DUMMY_TREE_MENU)
⑨  base.html: {% include 'partials/_sidebar_tree.html' %} + CSS/JS 태그 나열
⑩  _sidebar_tree.html: {{ render_tree(tree_menu) }}
       → 매크로 내부 {% for node in nodes %}로 순회, 폴더면 재귀 호출
       → 완성된 트리 HTML이 base.html 안에 삽입되어 최종 HTML 완성
⑪  브라우저: 완성된 HTML 표시 + CSS/JS 로드
    → 이후는 전부 클라이언트 사이드 (트리 클릭 → TabManager → SplitLayout → AG Grid, 서버 재요청 없음)
```
