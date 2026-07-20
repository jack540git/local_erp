"""db/prod_db.py
사내 상용 ERP의 PostgreSQL에 "조회 전용"으로 접속하기 위한 계층.

- .env의 PROD_DB_* 값이 아직 없으면(ProdDBSettings.is_configured() == False),
  앱 시작 시점에 연결을 시도하지 않고 실제 호출 시점까지 미룬다 (lazy 연결).
  -> 접속 정보가 없어도 앱 전체가 죽지 않는다.
- ReadOnlyConnection은 fetch_one()/fetch_all()만 제공하고 commit()/execute(DML) 등을
  아예 노출하지 않아, 코드 실수로 쓰기 쿼리가 섞여도 여기서 한 번 막아준다.
  (가장 확실한 방어는 DB 계정 자체에 SELECT 권한만 부여하는 것 -- 상용ERP DB
  관리자에게 "조회 전용 계정" 발급을 별도로 요청해야 한다.)
"""
from contextlib import contextmanager

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from db.settings import ProdDBSettings

_pool = None  # lazy 생성


class ProdDBNotConfiguredError(RuntimeError):
    """.env에 PROD_DB_* 접속 정보가 아직 입력되지 않은 상태에서 호출한 경우."""


class ReadOnlyConnection:
    """SELECT만 허용하는 얇은 래퍼. commit()/execute(DML) 등은 아예 제공하지 않는다."""

    def __init__(self, raw_conn):
        self._conn = raw_conn

    def fetch_all(self, sql: str, params: tuple = ()):
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql, params)
            return cur.fetchall()

    def fetch_one(self, sql: str, params: tuple = ()):
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql, params)
            return cur.fetchone()


def _get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        if not ProdDBSettings.is_configured():
            raise ProdDBNotConfiguredError(
                ".env의 PROD_DB_HOST / PROD_DB_USER / PROD_DB_NAME 등이 아직 입력되지 않았습니다. "
                "상용ERP DB 접속 정보를 .env에 입력한 뒤 다시 시도하세요."
            )
        _pool = ConnectionPool(
            conninfo=ProdDBSettings.conninfo(),
            min_size=1,
            max_size=5,
            kwargs={
                "row_factory": dict_row,
                # 세션 단위 statement_timeout 적용 (오래 걸리는 조회가 상용ERP에 부담 주지 않도록)
                "options": f"-c statement_timeout={ProdDBSettings.statement_timeout_ms}",
            },
        )
    return _pool


@contextmanager
def get_prod_db_connection():
    """
    상용ERP DB 커넥션(조회 전용 래퍼)을 빌려주는 컨텍스트매니저.
    접속 정보가 .env에 없으면 ProdDBNotConfiguredError 발생.

    사용 예:
        with get_prod_db_connection() as conn:
            rows = conn.fetch_all("SELECT * FROM some_table LIMIT 10")
    """
    pool = _get_pool()
    with pool.connection() as raw_conn:
        yield ReadOnlyConnection(raw_conn)
