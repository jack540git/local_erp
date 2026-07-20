# 1단계 — 사이드바 설정 버튼

## 목표
사이드바 하단 오른쪽에 별도 클래스의 설정(⚙) 버튼을 추가하고, 클릭 시 기존 탭 오픈 방식으로 "설정" 탭을 연다.

## 대상 파일
- `templates/partials/_sidebar_tree.html`
- `static/css/sidebar.css`
- `static/js/sidebar-tree.js` (또는 `tab-manager.js`와 연동하는 별도 스크립트)

## 작업 내용

### 1) `_sidebar_tree.html`
- `.sidebar-tree` 아래, `.area-sidebar` flex 컨테이너 안에 하단 고정 영역 추가
```html
<div class="sidebar-footer">
    <button type="button" id="sidebar-settings-btn" class="sidebar-settings-btn" aria-label="설정">
        <i class="fa-solid fa-gear"></i>
    </button>
</div>
```

### 2) `sidebar.css`
- `.area-sidebar`는 이미 `display:flex; flex-direction:column`이므로 `.sidebar-footer`에 `flex-shrink:0`만 주면 자연스럽게 맨 아래 고정됨
```css
.sidebar-footer {
    flex-shrink: 0;
    display: flex;
    justify-content: flex-end;
    padding: 10px 12px;
    border-top: 1px solid #d8dde3;
    background: #eef2f7;
}

.sidebar-settings-btn {
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 16px;
    color: #555;
    padding: 6px;
    border-radius: 4px;
    transition: background-color 0.15s ease, color 0.15s ease;
}

.sidebar-settings-btn:hover {
    background-color: #dde6f0;
    color: #2563a8;
}
```

### 3) 탭 오픈 연동
- 기존 트리메뉴 leaf 클릭 시 탭이 열리는 로직(`tab-manager.js` / `sidebar-tree.js`의 `data-menu-key` 처리 방식)을 확인 후 동일 패턴으로 연결
- `sidebar-settings-btn` 클릭 이벤트 → `openTab({ key: 'admin_settings', label: '설정', url: '/admin/users' })` 형태로 기존 탭 오픈 함수 재사용
- 탭 콘텐츠 로딩 방식(서버 렌더 HTML을 fetch해서 tab-pane에 삽입하는지, iframe인지 등)은 기존 leaf 노드 클릭 흐름을 그대로 따름 — 새로운 방식을 만들지 않는다

## 완료 기준
- [ ] 설정 버튼이 사이드바 하단 우측에 고정 표시됨
- [ ] 클릭 시 기존 탭 오픈 방식과 동일하게 "설정" 탭이 열림
- [ ] 이미 열려 있으면 기존 탭으로 포커스 이동 (중복 탭 생성 방지 — 기존 leaf 클릭 로직과 동일해야 함)
