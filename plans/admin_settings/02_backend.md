# 2단계 — 백엔드 (라우트 / 서비스 / 레포지토리)

## 목표
현재 `users` 테이블(`id, email, password, role`)과 실제로 연동되는 관리자 화면 API 구현.
권한은 우선 `role` 컬럼 값(admin/user 등)을 그대로 조회/수정하는 수준까지만.

## 대상 파일
- `repository/local_repository.py` (쿼리 함수 추가)
- `service/user_service.py` (신규)
- `routes/admin_routes.py` (라우트 추가)

## 1) `repository/local_repository.py` — 추가할 쿼리 함수

```python
def find_all_users():
    """관리자 화면 좌측 목록용 전체 사용자 조회."""
    with get_local_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, role FROM users ORDER BY id"
            )
            return cur.fetchall()


def find_user_by_id(user_id: int):
    """관리자 화면 우측 상세 패널용 단건 조회 (비밀번호 제외)."""
    with get_local_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, role FROM users WHERE id = %s",
                (user_id,),
            )
            return cur.fetchone()


def update_user_role(user_id: int, role: str):
    """사용자 role 변경."""
    with get_local_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET role = %s WHERE id = %s",
                (role, user_id),
            )
        conn.commit()
```

> 주의: `password` 컬럼은 목록/상세 API 응답에 절대 포함하지 않는다 (SELECT 절에서부터 제외).

## 2) `service/user_service.py` (신규)

`service/approval_service.py`와 동일한 레이어드 패턴 유지 — 라우트는 이 서비스만 호출하고, 레포지토리를 직접 호출하지 않는다.

```python
"""service/user_service.py
관리자 화면(사용자 목록/상세/role 변경) 비즈니스 로직.
"""
from repository.local_repository import (
    find_all_users,
    find_user_by_id,
    update_user_role,
)

ALLOWED_ROLES = {"admin", "user"}  # 1단계: role 화이트리스트 (하드코딩, 추후 테이블화 가능)


def get_user_list():
    return find_all_users()


def get_user_detail(user_id: int):
    return find_user_by_id(user_id)


def change_user_role(user_id: int, new_role: str):
    if new_role not in ALLOWED_ROLES:
        raise ValueError(f"허용되지 않은 role 값: {new_role}")
    update_user_role(user_id, new_role)
```

## 3) `routes/admin_routes.py` — 라우트 추가

```python
from flask import Blueprint, render_template, jsonify, request, session
from auth import login_required
from service.user_service import get_user_list, get_user_detail, change_user_role

admin_bp = Blueprint("admin", __name__)


@admin_bp.route("/users")
@login_required
def user_settings_page():
    """설정 탭에 로드되는 관리자 화면. 좌측 목록 초기 데이터를 함께 내려준다."""
    users = get_user_list()
    return render_template("admin_users.html", users=users)


@admin_bp.route("/users/<int:user_id>")
@login_required
def user_detail_api(user_id):
    """우측 상세 패널용 JSON API."""
    user = get_user_detail(user_id)
    if not user:
        return jsonify({"error": "not found"}), 404
    return jsonify(user)


@admin_bp.route("/users/<int:user_id>/role", methods=["POST"])
@login_required
def user_role_update_api(user_id):
    """role 변경 API. (CSRFProtect가 app 전역 적용되어 있으므로 프론트에서 csrf_token 헤더 포함 필요)"""
    new_role = request.json.get("role") if request.is_json else request.form.get("role")
    try:
        change_user_role(user_id, new_role)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify({"ok": True})
```

## 권한(접근 제어) 관련 메모 — 이번 단계 범위
- 이번 단계에서는 "관리자 화면 자체에 누가 들어올 수 있는가"는 `@login_required`만 적용 (role 체크는 아직 없음)
- 다음 단계 후보: `@admin_required` 데코레이터를 `auth.py`에 추가해 `session["role"] != "admin"`이면 차단
  → 지금 바로 추가할지, 화면부터 완성 후 추가할지는 구현 시점에 재확인 필요

## 완료 기준
- [ ] `GET /admin/users` 접속 시 실제 DB의 사용자 목록이 렌더링됨
- [ ] `GET /admin/users/<id>` 호출 시 password 제외된 JSON 반환
- [ ] `POST /admin/users/<id>/role` 호출 시 실제 DB row가 업데이트됨 (허용되지 않은 role 값은 400 반환)
