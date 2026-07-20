# 3단계 — 프론트엔드 (템플릿 / CSS / JS)

> **구현 시 매핑 변경 안내**: 아래 본문은 원래 서버가 탭별로 HTML을 내려준다는 가정으로 작성된 초안이다.
> 실제로는 이 프로젝트의 탭 시스템(tab-manager.js)은 **완전히 클라이언트에서 렌더링되는 SPA** 구조다
> (menuKey -> screen-layouts.js의 SCREEN_LAYOUTS -> split-layout.js -> content-renderers.js의 contentId별 렌더 함수).
> 따라서 아래 계획은 실제로는 다음과 같이 구현했다:
> - `templates/admin_users.html` (신규) — SPA 탭이 아닌, **직접 URL로 접근했을 때의 폴백 페이지**로만 사용 (2단계에서 이미 생성)
> - `static/js/admin-users.js`를 따로 만들지 않고, 기존 관례대로 **`static/js/content-renderers.js`에 `admin_settings__*` 렌더 함수를 추가**
> - `static/js/screen-layouts.js`에 `admin_settings` 레이아웃(유형 C: 좌측 목록 + 우측 서브탭) 추가
> - 실제 백엔드 연동(fetch)은 이 화면이 이 프로젝트에서 유일하게 가진 예외다 (다른 화면은 더미 데이터)

아래의 원래 초안(서버 렌더 탭 방식)은 **참고용으로만** 남겨둔다.

---
## 목표
설정 탭 안에서 좌(사용자 목록)/우(기본정보·권한정보) 분할 화면 구현, 좌측 클릭 시 우측 연동.

## 대상 파일
- `templates/admin_users.html` (신규)
- `static/css/admin.css` (신규)
- `static/js/admin-users.js` (신규)
- `templates/base.html` — 필요 시 `admin.css` / `admin-users.js` include (탭 콘텐츠 로딩 방식에 따라 base.html이 아니라 admin_users.html 자체에 넣을 수도 있음, 2단계에서 확인한 탭 로딩 방식에 맞춤)

## 1) 화면 구조 (참고: 업로드된 거래처관리 조회화면과 동일 컨셉)

```
┌───────────────────────────────────────────────────────┐
│  좌측: 사용자 목록 (AG Grid)   │  우측: [기본정보][권한정보] 탭    │
│  - 이메일                      │  기본정보 탭:                    │
│  - role                        │    - 이메일 (readonly)           │
│  - (클릭 시 active 표시)        │    - role (select box)           │
│                                 │    - [저장] 버튼                 │
│                                 │  권한정보 탭:                    │
│                                 │    - 1단계: role 기반 안내 텍스트 │
│                                 │      만 표시 (매트릭스는 4단계    │
│                                 │      설계안 확정 후 다음 단계)    │
└───────────────────────────────────────────────────────┘
```

- 좌/우 분할은 `static/js/split-layout.js` 재사용 검토 (기존 검색조건/그리드 분할과 동일한 매커니즘인지 확인 후, 안 맞으면 admin 전용 간단 flex 2단 구성으로 대체)
- 우측 탭(`기본정보`/`권한정보`)은 업로드 이미지 속 `기본정보/부가정보/기타정보` 탭 UI와 톤 맞춤

## 2) `admin_users.html` (개략 구조)

```html
{% extends "base.html" %}
{% block main_content %}
<div class="admin-users-layout">
    <div class="admin-users-list">
        <div id="admin-users-grid"></div>
    </div>
    <div class="admin-users-detail">
        <div class="admin-detail-tabs">
            <button class="admin-detail-tab active" data-tab="basic">기본정보</button>
            <button class="admin-detail-tab" data-tab="permission">권한정보</button>
        </div>
        <div class="admin-detail-pane" data-pane="basic">
            <!-- 이메일 / role select / 저장버튼 -->
        </div>
        <div class="admin-detail-pane" data-pane="permission" hidden>
            <!-- 1단계: role 기반 안내만. 매트릭스 UI는 다음 단계 -->
        </div>
    </div>
</div>
{% endblock %}
{% block extra_scripts %}
<script src="{{ url_for('static', filename='js/admin-users.js') }}"></script>
{% endblock %}
```

## 3) `admin-users.js` (개략 로직)

```javascript
// 1. AG Grid로 좌측 사용자 목록 렌더 (users는 admin_users.html에서 초기 데이터로 주입되거나,
//    별도로 fetch('/admin/users')를 JSON으로 받도록 라우트를 하나 더 분리할 수도 있음 — 2단계 라우트와 일치시킬 것)

// 2. 행 클릭 시
async function onUserRowClick(userId) {
    const res = await fetch(`/admin/users/${userId}`);
    const user = await res.json();
    renderBasicInfo(user);
}

// 3. role 저장
async function saveUserRole(userId, newRole, csrfToken) {
    const res = await fetch(`/admin/users/${userId}/role`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken,
        },
        body: JSON.stringify({ role: newRole }),
    });
    if (!res.ok) {
        const err = await res.json();
        alert(err.error || "저장 실패");
        return;
    }
    // 좌측 그리드 해당 row도 갱신
}

// 4. 상단 기본정보/권한정보 탭 전환은 기존 조회화면의 탭 UI 패턴(있다면) 재사용
```

> CSRF: `base.html`에 이미 `{{ csrf_token() }}`을 폼에서 쓰고 있으므로, JS fetch에서도 동일한 토큰을 hidden input이나 meta 태그로 내려받아 헤더에 포함시켜야 함 (CSRFProtect가 앱 전역 적용 중).

## 4) `admin.css` (개략)
- `.admin-users-layout`: `display:flex; height:100%;`
- `.admin-users-list`: 고정 or 가변 폭 (예: 320px), 우측은 `flex:1`
- `.admin-detail-tabs` / `.admin-detail-tab.active`: 기존 톤(파란 액센트 `#2563a8`, 트리 active 색상과 통일)과 맞춤

## 완료 기준
- [ ] 좌측 목록에 실제 DB 사용자들이 그리드로 표시됨
- [ ] 행 클릭 시 우측 기본정보 탭에 해당 사용자 정보가 로드됨
- [ ] role 변경 후 저장 시 DB 반영 + 좌측 목록도 갱신됨
- [ ] 권한정보 탭은 1단계에서는 "현재 role 기반으로 동작 중" 안내 문구만 표시 (매트릭스 UI는 다음 단계)
