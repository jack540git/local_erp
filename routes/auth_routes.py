"""routes/auth_routes.py
인증 관련 라우트: 로그인 페이지 표시, 로그인 처리, 로그아웃.
기존 app.py의 login_page()/login_process()/logout()을 그대로 이관.
비즈니스 로직(사용자 조회/비밀번호 검증)은 repository.local_repository / auth.py에 위임하고,
이 파일은 HTTP 요청/응답 처리만 담당한다.
"""
from flask import Blueprint, render_template, request, redirect, url_for, session, flash

from repository.local_repository import find_user_by_email
from auth import verify_password
from utils.logger import get_logger

auth_bp = Blueprint("auth", __name__)
logger = get_logger(__name__)


@auth_bp.route("/")
def login_page():
    # 이미 로그인된 상태면 바로 대시보드로
    if "user_id" in session:
        return redirect(url_for("erp.dashboard"))
    return render_template("login.html")


@auth_bp.route("/login", methods=["POST"])
def login_process():
    email = request.form.get("email", "").strip()
    password = request.form.get("password", "")

    if not email or not password:
        flash("이메일과 비밀번호를 모두 입력해주세요.")
        return redirect(url_for("auth.login_page"))

    user = find_user_by_email(email)

    if not user or not verify_password(user["password"], password):
        logger.warning("로그인 실패: %s", email)
        flash("이메일 또는 비밀번호가 올바르지 않습니다.")
        return redirect(url_for("auth.login_page"))

    # 로그인 성공 -> 서버 서명 세션 쿠키에 최소 정보만 저장
    session.clear()
    session["user_id"] = user["id"]
    session["email"] = user["email"]
    session["role"] = user["role"]
    logger.info("로그인 성공: %s (role=%s)", user["email"], user["role"])

    return redirect(url_for("erp.dashboard"))


@auth_bp.route("/logout", methods=["POST"])
def logout():
    if "email" in session:
        logger.info("로그아웃: %s", session["email"])
    session.clear()
    return redirect(url_for("auth.login_page"))
