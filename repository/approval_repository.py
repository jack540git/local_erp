"""repository/approval_repository.py
상용ERP(사내 별도 시스템) 대상 기안(전자결재) 조회 전용 쿼리 모음.
반드시 db.prod_db.get_prod_db_connection()을 통해서만 접근한다 (SELECT만 작성 —
ReadOnlyConnection 자체가 fetch_all/fetch_one만 제공하므로 쓰기 쿼리는 애초에 불가능).
"""
from db.prod_db import get_prod_db_connection

# 원본 쿼리(제공받은 그대로)의 컬럼 별칭 매핑 메모:
#   ad.name AS 문서유형   -> doc_type_name
#   he.name AS 상신자     -> applier_name
# 결과 dict의 key를 한글 별칭 그대로 두지 않고 영문 snake_case로 통일한 이유:
# repository 계층은 "일관된 필드명의 원시 데이터"만 책임지고, 화면 표시용 한글 라벨은
# service/화면 계층에서 붙이는 게 계층 책임 분리 원칙에 맞음.


def find_completed_approvals(since_date: str):
    """
    완료(progress='complete')된 기안 목록을, 완료일자(date_complete) 기준
    since_date 이후 건만 조회한다.

    :param since_date: 'YYYY-MM-DD' 형식 문자열 (예: '2026-07-09')
    :return: dict 리스트. 각 dict의 키:
             name, doc_id, doc_type_name, progress, applier_name, date_complete
    """
    sql = """
        SELECT
            a.name,
            a.doc_id,
            ad.name AS doc_type_name,
            a.progress,
            he.name AS applier_name,
            a.date_complete
        FROM approval_approval a
        LEFT JOIN approval_doctype ad ON a.doc_type = ad.id
        LEFT JOIN hr_employee he ON a.applier = he.id
        WHERE a.progress = %s
          AND a.date_complete >= %s
    """
    with get_prod_db_connection() as conn:
        return conn.fetch_all(sql, ("complete", since_date))


# 앞으로 기안 관련 다른 조회(예: 진행중 건만, 특정 상신자만 등)가 필요해지면
# 이 파일에 함수를 추가한다. WHERE 조건이 다양해지면 파라미터로 받는 함수 형태를 유지할 것
# (SQL 문자열 안에 값을 직접 이어붙이지 말 것 — SQL 인젝션 방지, %s 플레이스홀더만 사용).
