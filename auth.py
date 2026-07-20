"""auth.py
비밀번호 해시 검증(레거시 bcrypt + werkzeug 혼용 지원)과
로그인 필수 라우트를 위한 데코레이터, 그리고 role 기반 권한 검증 데코레이터.
"""
from functools import wraps
import bcrypt
from flask import session, redirect, url_for, jsonify
from werkzeug.security import check_password_hash


def verify_password(stored_hash: str, input_password: str) -> bool:
    """
    저장된 해시 접두사를 보고 알맞은 방식으로 검증.
    - $2y$/$2b$/$2a$  -> bcrypt (예: PHP password_hash() 등 레거시 계정)
    - 그 외            -> werkzeug (pbkdf2/scrypt, 신규 가입 계정)
    """
    if not stored_hash:
        return False

    if stored_hash.startswith(("$2y$", "$2b$", "$2a$")):
        return bcrypt.checkpw(input_password.encode("utf-8"), stored_hash.encode("utf-8"))

    return check_password_hash(stored_hash, input_password)


def login_required(view_func):
    """세션에 로그인 정보가 없으면 로그인 페이지로 리다이렉트."""

    @wraps(view_func)
    def wrapped(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("auth.login_page"))
        return view_func(*args, **kwargs)

    return wrapped


def role_required(*allowed_roles):
    """세션의 role이 allowed_roles 에 포함되지 않으면 403을 반환하는 데코레이터.

    반드시 @login_required 바로 아래(즉, 함수에 더 가깝게)에 붙여 사용한다.
    login_required가 먼저 실행되어 로그인 여부를 확인한 뒤,
    role_required가 권한(role)을 확인하는 순서로 동작한다.

    사용 예:
        @admin_bp.route("/users")
        @login_required
        @role_required("admin")
        def view(...):
            ...

    로그인은 되어있지만 권한이 부족한 경우, 모든 관리자 라우트는 JSON 기반(fetch)로만
    호출되므로(사이드바 → SPA 탭 진입이 기본, 직접 URL 접속은 폴백 페이지 또는 fetch 기반)
    일관되게 JSON 403 응답을 반환한다.
    """

    def decorator(view_func):
        @wraps(view_func)
        def wrapped(*args, **kwargs):
            user_role = session.get("role")
            if user_role not in allowed_roles:
                return jsonify({"error": "권한이 없습니다."}), 403
            return view_func(*args, **kwargs)

        return wrapped

    return decorator
