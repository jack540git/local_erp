"""db/local_db.py
로컬DB(myappdb) 커넥션 풀. 읽기/쓰기 모두 허용.
이 파일은 순수하게 "커넥션 풀 관리"만 담당한다. SQL 쿼리 함수는 여기 두지 않고
repository/ 계층(예: repository/local_repository.py)에 작성한다.
"""
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from db.settings import LocalDBSettings

pool = ConnectionPool(
    conninfo=LocalDBSettings.conninfo(),
    min_size=LocalDBSettings.min_pool_size,
    max_size=LocalDBSettings.max_pool_size,
    kwargs={"row_factory": dict_row},
)


def get_local_db_connection():
    """
    로컬DB 커넥션 풀에서 커넥션 하나를 빌려주는 컨텍스트매니저.
    사용 예: with get_local_db_connection() as conn: ...
    (이름에 "session" 대신 "db_connection"을 쓴 이유: auth.py가 이미 Flask의
    session 객체를 쓰고 있어서, DB 쪽에 session이라는 이름을 또 쓰면 혼동됨)
    """
    return pool.connection()
