"""service/profit_analysis_service.py
손익관리 도메인 비즈니스 로직. routes는 이 계층만 호출한다.
"""
import re

from repository.profit_analysis_repository import find_profit_by_payment_date

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def get_profit_by_payment_date(date_payment: str):
    """
    지급기준일 손익 목록 조회.

    :param date_payment: 'YYYY-MM-DD' 형식 문자열 (프론트 date 필드가 이 형식으로 넘겨줌)
    :raises ValueError: 형식이 잘못된 경우 (routes에서 400으로 변환)
    """
    if not date_payment or not _DATE_RE.match(date_payment):
        raise ValueError("date는 YYYY-MM-DD 형식이어야 합니다.")

    return find_profit_by_payment_date(date_payment)
