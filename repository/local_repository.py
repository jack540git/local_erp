"""repository/local_repository.py
로컬DB(myappdb) 대상 쿼리 함수 모음. 읽기/쓰기 모두 이 계층에서 작성한다.
DB 커넥션 자체는 db/local_db.py의 get_local_db_connection()을 통해서만 얻는다
(이 파일에서 ConnectionPool을 직접 만들거나 psycopg를 새로 import하지 않는다 —
접속 관리 책임은 db 계층에만 두고, repository는 "SQL을 어떻게 쓸지"만 담당).
"""
from db.local_db import get_local_db_connection


def find_user_by_email(email: str):
    """이메일로 사용자 한 명 조회. 없으면 None."""
    with get_local_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, password, role FROM users WHERE email = %s",
                (email,),
            )
            return cur.fetchone()


def find_all_users():
    """관리자 화면 좌측 목록용 전체 사용자 조회 (비밀번호 제외)."""
    with get_local_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, email, role FROM users ORDER BY id")
            return cur.fetchall()


def find_user_by_id(user_id: int):
    """관리자 화면 우측 상세 패널용 단건 조회 (비밀번호 제외)."""
    with get_local_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, email, role FROM users WHERE id = %s",
                (user_id,),
            )
            return cur.fetchone()


def update_user_role(user_id: int, role: str):
    """사용자 role 변경."""
    with get_local_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET role = %s WHERE id = %s",
                (role, user_id),
            )
        conn.commit()


# 앞으로 로컬 DB 대상 쿼리(거래처/전표/계정 등 실제 테이블이 생기면)는
# 전부 이 파일 또는 도메인별로 파일을 나눠서 이 자리에 추가한다.
