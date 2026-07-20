"""db/settings.py
.env에서 로컬DB / 상용DB(사내 별도 ERP) 접속 정보를 읽어온다.
이 파일은 "설정값을 정리해주는 역할"만 하고, 실제 커넥션 풀 생성은
local_db.py / prod_db.py에서 각각 담당한다 (SQL 쿼리도 여기 두지 않는다).
"""
import os


class LocalDBSettings:
    """로컬DB(myappdb) 접속 설정. 지금까지 쓰던 값 그대로."""

    host = os.environ.get("DB_HOST", "localhost")
    port = os.environ.get("DB_PORT", 5432)
    user = os.environ.get("DB_USER", "myapp_user")
    password = os.environ.get("DB_PASSWORD", "")
    dbname = os.environ.get("DB_NAME", "myappdb")
    min_pool_size = int(os.environ.get("DB_POOL_MIN_SIZE", 2))
    max_pool_size = int(os.environ.get("DB_POOL_MAX_SIZE", 10))

    @classmethod
    def conninfo(cls) -> str:
        return (
            f"host={cls.host} port={cls.port} user={cls.user} "
            f"password={cls.password} dbname={cls.dbname}"
        )


class ProdDBSettings:
    """
    사내 상용 ERP의 PostgreSQL 접속 설정.
    실제 값은 이 파일이 아니라 .env의 PROD_DB_* 항목에 입력한다.
    """

    host = os.environ.get("PROD_DB_HOST", "")
    port = os.environ.get("PROD_DB_PORT", 5432)
    user = os.environ.get("PROD_DB_USER", "")
    password = os.environ.get("PROD_DB_PASSWORD", "")
    dbname = os.environ.get("PROD_DB_NAME", "")
    connect_timeout = int(os.environ.get("PROD_DB_CONNECT_TIMEOUT", 5))            # 초 단위
    statement_timeout_ms = int(os.environ.get("PROD_DB_STATEMENT_TIMEOUT", 5000))  # ms 단위

    @classmethod
    def is_configured(cls) -> bool:
        """.env에 PROD_DB_* 접속 정보가 아직 입력되지 않았으면 False."""
        return bool(cls.host and cls.user and cls.dbname)

    @classmethod
    def conninfo(cls) -> str:
        return (
            f"host={cls.host} port={cls.port} user={cls.user} "
            f"password={cls.password} dbname={cls.dbname} "
            f"connect_timeout={cls.connect_timeout}"
        )
