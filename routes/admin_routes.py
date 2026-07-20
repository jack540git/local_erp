"""routes/admin_routes.py
관리자 전용 라우트. 2단계: 사용자 목록/상세 조회 및 role 변경 API.
url_prefix="/admin"으로 app.py에서 등록되므로, 여기 라우트는 "/"부터 시작해도
실제로는 "/admin/..."으로 노출된다.
"""
from flask import Blueprint, render_template, jsonify, request

from auth import login_required, role_required
from service.user_service import get_user_list, get_user_detail, change_user_role
from utils.logger import get_logger

admin_bp = Blueprint("admin", __name__)
logger = get_logger(__name__)


@admin_bp.route("/users")
@login_required
@role_required("admin")
def user_settings_page():
    """사이드바 설정 버튼 → "설정" 탭에 로드되는 관리자 화면.
    직접 URL로 접근했을 때의 폴백 페이지 (3단계 이후 실제 UI는 SPA 탭에서
    content-renderers.js가 아래 JSON API들을 통해 그린다).
    """
    users = get_user_list()
    return render_template("admin_users.html", users=users)


@admin_bp.route("/users/list")
@login_required
@role_required("admin")
def user_list_api():
    """3단계: 좌측 AG Grid가 fetch로 불러오는 사용자 목록 JSON API.
    경로가 "/users/<int:user_id>"와 겹치지 않도록 정적 세그먼트 "list"로 구분한다.
    """
    users = get_user_list()
    return jsonify(users)


@admin_bp.route("/users/<int:user_id>")
@login_required
@role_required("admin")
def user_detail_api(user_id):
    """우측 상세 패널용 JSON API. 비밀번호는 포함하지 않는다."""
    user = get_user_detail(user_id)
    if not user:
        return jsonify({"error": "not found"}), 404
    return jsonify(user)


@admin_bp.route("/users/<int:user_id>/role", methods=["POST"])
@login_required
@role_required("admin")
def user_role_update_api(user_id):
    """role 변경 API. CSRFProtect가 앱 전역 적용되어 있으므로
    프론트에서 X-CSRFToken 헤더에 토큰을 실어서 보내야 한다.
    """
    new_role = request.json.get("role") if request.is_json else request.form.get("role")

    try:
        change_user_role(user_id, new_role)
    except ValueError as e:
        logger.warning("role 변경 실패(user_id=%s, role=%s): %s", user_id, new_role, e)
        return jsonify({"error": str(e)}), 400

    logger.info("role 변경 성공: user_id=%s -> role=%s", user_id, new_role)
    return jsonify({"ok": True})
