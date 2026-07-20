"""db/test_prod_connection.py
상용ERP DB 접속 정보(.env의 PROD_DB_*)가 올바른지 빠르게 확인하는 스크립트.
전체 Flask 앱을 띄우지 않고 이 스크립트만 단독 실행해서 확인 가능.

실행 방법 (컨테이너 안에서):
    docker compose exec local-erp python -m db.test_prod_connection

주의: 반드시 "-m db.test_prod_connection" 형태로 실행할 것.
(python db/test_prod_connection.py 처럼 직접 실행하면 -- from db.settings import ... 가
 상대경로 문제로 실패한다. -m 옵션은 /app을 기준으로 패키지를 찾아서 이 문제가 없다.)
"""
from db.settings import ProdDBSettings
from db.prod_db import get_prod_db_connection, ProdDBNotConfiguredError


def main():
    print("=== 상용ERP DB 접속 정보 확인 ===")
    print(f"PROD_DB_HOST = {ProdDBSettings.host!r}")
    print(f"PROD_DB_PORT = {ProdDBSettings.port!r}")
    print(f"PROD_DB_USER = {ProdDBSettings.user!r}")
    print(f"PROD_DB_NAME = {ProdDBSettings.dbname!r}")
    print(f"CONNECT_TIMEOUT = {ProdDBSettings.connect_timeout}s / STATEMENT_TIMEOUT = {ProdDBSettings.statement_timeout_ms}ms")
    print()

    if not ProdDBSettings.is_configured():
        print("[결과] 미입력 상태입니다. .env의 PROD_DB_HOST / PROD_DB_USER / PROD_DB_NAME을 먼저 채워주세요.")
        return

    try:
        with get_prod_db_connection() as conn:
            row = conn.fetch_one("SELECT version()")
            print("[결과] 연결 성공!")
            print(f"PostgreSQL 버전: {row['version']}")
    except ProdDBNotConfiguredError as e:
        print(f"[결과] 설정 누락: {e}")
    except Exception as e:
        # 접속 정보 오타, 네트워크/방화벽 문제, 계정 권한 문제 등이 여기서 전부 잡힘
        print(f"[결과] 연결 실패: {type(e).__name__}: {e}")


if __name__ == "__main__":
    main()
