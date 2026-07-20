# 관리자 설정 화면 흐름 정리 (사이드바 설정 버튼 → 사용자 목록 → 상세/권한)

> `login_flow.md`와 동일한 형식. 실제 코드는 이 문서에서 제외하고, 파일·함수 호출 흐름만 정리.
> 배경 계획은 `plans/admin_settings/00_overview.md` 및 01~04 참고.

---

## 전체 흐름 (파일 단위)

### 1. 진입 — 사이드바 하단 설정 버튼 클릭

```
사용자: 사이드바 하단 우측 ⚙ 버튼 클릭
```

`_sidebar_tree.html`에 렌더링되어 있는 `#sidebar-settings-btn`을 클릭하면, `sidebar-tree.js`에 별도로
등록해둔 클릭 리스너가 반응한다. 트리 리프 노드 클릭 흐름과 완전히 동일한 방식으로,
`TabManager.openTab("admin_settings", "설정")`을 호출한다.

> 트리메뉴의 `data-menu-key`를 읽어 탭을 여는 기존 로직과 별개의 새 코드가 아니라,
> "menuKey를 하드코딩(`admin_settings`)해서 같은 함수를 그대로 재사용"하는 방식이다.

### 2. 탭 생성 — `tab-manager.js`

`TabManager.openTab()`은 기존 로직 그대로 동작한다:
- 이미 "설정" 탭이 열려있으면 → 새로 안 만들고 기존 탭으로 포커스만 이동 (중복 방지)
- 처음 여는 경우 → 새 탭 생성, 빈 `tab-pane` DOM을 만들고 그 안에 `SplitLayout.render()` 호출

### 3. 레이아웃 결정 — `screen-layouts.js`

`SplitLayout.render()`는 `menuKey`(`admin_settings`)를 키로 `SCREEN_LAYOUTS`에서 레이아웃 정의를 찾는다.
`admin_settings`는 기존 "거래처정보관리"(유형 C)와 동일한 패턴으로 정의되어 있다:
- 좌측: 단일 pane (사용자 목록)
- 우측: 서브탭 2개(`기본정보`, `권한정보`), 각각 별도 `contentId`

여기서 결정되는 건 "레이아웃 뼈대"일 뿐이고, 실제 내용(그리드/폼)은 이 파일이 모른다 — `contentId` 문자열만
다음 단계로 넘겨준다.

### 4. 실제 렌더링 — `content-renderers.js`

`SplitLayout`이 각 pane을 실제 DOM에 배치한 뒤, `contentId`에 해당하는 렌더 함수를
`ScreenContentRenderers`에서 찾아 호출한다.

- `admin_settings__list_grid` → AG Grid 인스턴스 생성 (빈 상태로 먼저 그려짐)
- `admin_settings__basic` → "좌측에서 사용자를 선택해주세요" 안내 문구만 먼저 표시
- `admin_settings__permission` → "좌측에서 사용자를 선택하면 권한 정보가 표시됩니다" 안내 문구만 먼저 표시

### 5. 사용자 목록 로딩 — 프런트 → 백엔드 첫 통신

`admin_settings__list_grid` 렌더 함수 안에서, AG Grid를 빈 상태로 만든 직후 곧바로
`GET /admin/users/list`를 `fetch`로 호출한다.

```
content-renderers.js (admin_settings__list_grid)
        │  fetch GET /admin/users/list
        ▼
routes/admin_routes.py: user_list_api()
        │  @login_required 통과 확인
        ▼
service/user_service.py: get_user_list()
        ▼
repository/local_repository.py: find_all_users()
        │  (password 컬럼은 SELECT 절에서부터 제외)
        ▼
db/local_db.py: get_local_db_connection() → myappdb의 users 테이블 조회
```

응답으로 받은 JSON 배열을 AG Grid의 `rowData`로 채워 넣으면, 좌측 목록이 실제 DB 데이터로 채워진다.

### 6. 사용자 행 클릭 — 상세 정보 로딩

사용자가 좌측 그리드에서 행을 클릭하면(`onRowClicked` 이벤트), 그 사용자의 `id`로 다시 fetch한다.

```
AG Grid onRowClicked
        │  fetch GET /admin/users/<id>
        ▼
routes/admin_routes.py: user_detail_api(user_id)
        ▼
service/user_service.py: get_user_detail(user_id)
        ▼
repository/local_repository.py: find_user_by_id(user_id)
        ▼
db/local_db.py 커넥션으로 단건 조회 (password 제외)
```

응답이 오면 우측 "기본정보" 탭에는 이메일(읽기 전용)과 role 선택박스+저장 버튼을,
"권한정보" 탭에는 현재 role 기반 안내 문구를 각각 채워 넣는다.

### 7. role 저장 — 쓰기 흐름

"저장" 버튼 클릭 시:

```
저장 버튼 클릭
        │  fetch POST /admin/users/<id>/role
        │  헤더에 X-CSRFToken 포함 (base.html의 <meta name="csrf-token"> 값 사용)
        │  본문: { "role": "admin" 또는 "user" }
        ▼
routes/admin_routes.py: user_role_update_api(user_id)
        │  CSRFProtect가 앱 전역 적용 중이라 토큰 검증을 여기서 자동으로 거침
        ▼
service/user_service.py: change_user_role(user_id, new_role)
        │  ALLOWED_ROLES 화이트리스트 검증 (admin/user 외 값이면 여기서 막힘)
        ▼
repository/local_repository.py: update_user_role(user_id, role)
        ▼
db/local_db.py 커넥션으로 UPDATE 실행 + commit()
```

성공 응답이 오면:
- 알림창("저장되었습니다.")
- 좌측 AG Grid의 해당 행만 `applyTransaction`으로 갱신 (전체 목록을 다시 fetch하지 않고 그 행만 즉시 갱신)

실패(허용 안 된 role 값 등) 시 400 응답 → 에러 메시지를 알림창으로 표시.

---

## 직접 URL 접속(`/admin/users`) 시의 별도 경로 — 폴백 페이지

SPA 탭이 아니라 브라우저 주소창에 `/admin/users`를 직접 치고 들어오는 경우를 대비해,
`routes/admin_routes.py`의 `user_settings_page()`가 별도로 존재한다.

```
GET /admin/users (직접 접속)
        │  @login_required 통과 확인
        ▼
service/user_service.py: get_user_list()
        ▼
render_template("admin_users.html", users=users)
```

이 경로는 평소 사이드바 버튼으로 들어올 때는 전혀 쓰이지 않는다 (그때는 항상 3~7단계의
SPA 흐름을 탄다). 즐겨찾기/새로고침/직접 링크 공유 등 예외적인 진입 경로에 대한 안전장치 성격.

---

## 전체 흐름 한 장 요약

```
①  사이드바 하단 ⚙ 버튼 클릭 [sidebar-tree.js]
②  TabManager.openTab("admin_settings", "설정") [tab-manager.js]
       이미 열려있으면 포커스만 이동, 처음이면 새 탭 생성
③  SCREEN_LAYOUTS["admin_settings"] 조회 → 레이아웃 뼈대 결정 [screen-layouts.js]
       좌: list_grid pane / 우: 기본정보·권한정보 서브탭
④  각 contentId별 렌더 함수 호출 [content-renderers.js]
       list_grid → AG Grid 빈 틀 생성 + GET /admin/users/list
       basic/permission → 안내 문구만 우선 표시
⑤  목록 조회 API 응답 → AG Grid rowData 채움
       routes/admin_routes.py → service/user_service.py → repository/local_repository.py → db/local_db.py
⑥  사용자 행 클릭 → GET /admin/users/<id> → 우측 기본정보/권한정보 채움
⑦  role 변경 후 저장 → POST /admin/users/<id>/role (CSRF 헤더 포함)
       → 성공 시 좌측 그리드 해당 행만 즉시 갱신, 실패 시 에러 메시지
※ 직접 URL(/admin/users) 접속 시에는 ①~② 없이 서버 렌더 폴백 페이지로 대체
```
