"""service/approval_service.py
전자결재(기안) 관련 비즈니스 로직 계층.
routes(프레젠테이션)는 이 파일의 함수만 호출하면 되고, repository/DB 세부사항
(SQL, 커넥션, 조회 전용 강제 등)은 몰라도 된다.
"""
from datetime import date, timedelta

from repository.approval_repository import find_completed_approvals
from utils.logger import get_logger

logger = get_logger(__name__)


def get_recent_completed_approvals(days: int = 365):
    """
    최근 N일(기본 365일) 이내 완료된 기안 목록을 반환한다.

    "오늘 - days"로 since_date를 계산하는 규칙은 비즈니스 로직이므로 이 service 계층이
    책임진다 -- repository/approval_repository.py는 since_date를 받아 SQL만 실행할 뿐,
    날짜 계산 방식(N일 전인지, 이번 달 1일부터인지 등)은 전혀 모른다.
    이렇게 나눠두면, 나중에 "최근 30일"이 "이번 분기"로 바뀌어도 이 파일만 고치면 되고
    repository/routes는 손댈 필요가 없다.

    :param days: 오늘로부터 며칠 전까지 포함할지 (기본 365일)
    :return: repository가 반환한 dict 리스트 그대로 (가공 없음 -- 필요해지면 여기에 추가)
    """
    since_date = (date.today() - timedelta(days=days)).isoformat()
    logger.info("상용ERP 기안 조회 시작: since_date=%s (days=%d)", since_date, days)
    rows = find_completed_approvals(since_date)
    logger.info("상용ERP 기안 조회 완료: %d건", len(rows))
    return rows
