"""service/user_service.py
관리자 화면(사용자 목록/상세/role 변경) 비즈니스 로직.
routes/admin_routes.py는 이 서비스만 호출하고 repository를 직접 호출하지 않는다
(service/approval_service.py와 동일한 레이어드 패턴).
"""
from repository.local_repository import (
    find_all_users,
    find_user_by_id,
    update_user_role,
)

# 1단계: role 화이트리스트(하드코딩). 추후 role 관리 테이블이 생기면 그쪽 조회로 대체.
ALLOWED_ROLES = {"admin", "user"}


def get_user_list():
    """관리자 화면 좌측 목록용 전체 사용자 목록."""
    return find_all_users()


def get_user_detail(user_id: int):
    """관리자 화면 우측 상세 패널용 단건 조회. 없으면 None."""
    return find_user_by_id(user_id)


def change_user_role(user_id: int, new_role: str):
    """사용자 role 변경. 허용되지 않은 role이면 ValueError."""
    if new_role not in ALLOWED_ROLES:
        raise ValueError(f"허용되지 않은 role 값: {new_role}")
    update_user_role(user_id, new_role)
