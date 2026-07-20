"""service/local_profit_data_service.py
손익현황(로컬) 도메인 비즈니스 로직. routes는 이 계층만 호출한다.
"""
import re

from repository.local_profit_data_repository import find_local_profit_data

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def get_local_profit_data_list(criteria_date: str):
    """
    기준일자 손익현황(로컬) 목록 조회.

    :param criteria_date: 'YYYY-MM-DD' 형식 문자열 (프론트 date 필드가 이 형식으로 넘겨줌)
    :raises ValueError: 형식이 잘못된 경우 (routes에서 400으로 변환)
    """
    if not criteria_date or not _DATE_RE.match(criteria_date):
        raise ValueError("date는 YYYY-MM-DD 형식이어야 합니다.")

    return find_local_profit_data(criteria_date)
