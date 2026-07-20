"""repository/local_profit_data_repository.py
손익현황(로컬, local_profit_data) 도메인 — 로컬DB(myappdb) 대상 조회.
profit_analysis_repository.py(상용ERP)와 같은 데이터 성격이지만, 로컬DB에 저장/동기화된
스냅샷 테이블을 조회한다는 점이 다르다. local_repository.py와 동일하게
get_local_db_connection() + 커서 직접 사용 패턴을 따른다 (ReadOnlyConnection 래퍼는
상용DB 전용이라 여기선 쓰지 않음 — 로컬DB는 원래 읽기/쓰기 다 허용됨).

⚠ 사전 준비 필요: 아래 테이블이 아직 로컬DB(myappdb)에 없다. 이 프로젝트는 마이그레이션
도구(Alembic 등) 없이 직접 SQL을 실행하는 방식이므로, 최초 1회 아래 DDL을 수동 실행해야 한다.

    CREATE TABLE local_profit_data (
        id                SERIAL PRIMARY KEY,
        doc_id            VARCHAR(50),
        doc_name          VARCHAR(200),
        biz_done          BOOLEAN DEFAULT FALSE,
        expected_sale     NUMERIC(15, 0) DEFAULT 0,
        occurred_sale     NUMERIC(15, 0) DEFAULT 0,
        uncollected_sale  NUMERIC(15, 0) DEFAULT 0,
        profit            NUMERIC(15, 0) DEFAULT 0,
        profit_rate       NUMERIC(5, 1),
        total_cost        NUMERIC(15, 0) DEFAULT 0,
        biz_note          TEXT,
        criteria_date      DATE NOT NULL   -- 검색조건(기준일자)과 매칭되는 컬럼
    );
    CREATE INDEX idx_local_profit_data_criteria_date ON local_profit_data (criteria_date);
"""
from db.local_db import get_local_db_connection


def find_local_profit_data(criteria_date: str):
    """
    기준일자(criteria_date) 기준 손익현황 목록 조회 (로컬DB 스냅샷 테이블).

    :param criteria_date: 'YYYY-MM-DD' 형식 문자열
    :return: dict 리스트. local-profit-data.js의 컬럼 정의(doc_id, doc_name, biz_done,
             expected_sale, occurred_sale, uncollected_sale, profit, profit_rate,
             total_cost, biz_note)와 1:1로 대응
    """
    sql = """
        SELECT
            doc_id,
            doc_name,
            biz_done,
            expected_sale,
            occurred_sale,
            uncollected_sale,
            profit,
            profit_rate,
            total_cost,
            biz_note
        FROM local_profit_data
        WHERE criteria_date = %s
        ORDER BY doc_id
    """
    with get_local_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (criteria_date,))
            return cur.fetchall()
