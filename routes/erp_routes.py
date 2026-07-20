"""routes/erp_routes.py
ERP 대시보드(트리메뉴/탭/그리드가 있는 메인 화면) 라우트.
기존 app.py의 dashboard()를 그대로 이관.
"""
from flask import Blueprint, render_template, session, jsonify, request

from auth import login_required
from menu_data import DUMMY_TREE_MENU
from service.profit_analysis_service import get_profit_by_payment_date
from service.local_profit_data_service import get_local_profit_data_list
from utils.logger import get_logger

erp_bp = Blueprint("erp", __name__)
logger = get_logger(__name__)


@erp_bp.route("/dashboard")
@login_required
def dashboard():
    # ERP UI 스켈레톤(base.html) 적용. 트리/탭/SplitLayout/AG Grid는
    # static/js 쪽(sidebar-tree.js, tab-manager.js, screen-layouts.js 등)에서 렌더링.
    return render_template(
        "base.html",
        email=session["email"],
        role=session["role"],
        tree_menu=DUMMY_TREE_MENU,
    )


# 향후 화면별 데이터 조회 API(예: /api/approvals)도 이 파일 또는
# 도메인이 늘어나면 routes/api_routes.py로 분리해서 추가한다.


@erp_bp.route("/api/profit-analysis/payment-date")
@login_required
def profit_analysis_payment_date_api():
    """지급기준손익 그리드(profit_payment_date__list_grid)가 fetch로 불러오는 JSON API.
    상용ERP DB를 직접 조회하므로(여러 테이블 조인, 무거운 쿼리) 응답 시간이 길 수 있음.
    """
    date_payment = request.args.get("date", "")

    try:
        rows = get_profit_by_payment_date(date_payment)
    except ValueError as e:
        logger.warning("손익조회 파라미터 오류(date=%s): %s", date_payment, e)
        return jsonify({"error": str(e)}), 400

    logger.info("손익조회 완료(date=%s): %d건", date_payment, len(rows))
    return jsonify(rows)


@erp_bp.route("/api/local-profit-data")
@login_required
def local_profit_data_api():
    """손익현황(로컬) 그리드(local_profit_data__list_grid)가 fetch로 불러오는 JSON API.
    로컬DB 조회이라 profit_analysis_payment_date_api보다 응답이 빠르다.
    """
    criteria_date = request.args.get("date", "")

    try:
        rows = get_local_profit_data_list(criteria_date)
    except ValueError as e:
        logger.warning("손익현황(로컬) 파라미터 오류(date=%s): %s", criteria_date, e)
        return jsonify({"error": str(e)}), 400

    logger.info("손익현황(로컬) 조회 완료(date=%s): %d건", criteria_date, len(rows))
    return jsonify(rows)
