"""service/test_approval_service.py
approval_service.get_recent_completed_approvals()가 실제로 정상 동작하는지
라우트 없이 단독으로 확인하는 스크립트.

실행 방법 (컨테이너 안에서, 반드시 -m 옵션으로 패키지 기준 실행):
    docker compose exec local-erp python -m service.test_approval_service
"""
from service.approval_service import get_recent_completed_approvals


def main():
    print("=== 최근 365일 완료 기안 조회 테스트 ===")
    try:
        rows = get_recent_completed_approvals(days=365)
        print(f"[결과] 조회 성공. {len(rows)}건")
        for row in rows[:5]:  # 앞 5건만 미리보기
            print(row)
        if len(rows) > 5:
            print(f"... 외 {len(rows) - 5}건 더 있음")
    except Exception as e:
        print(f"[결과] 조회 실패: {type(e).__name__}: {e}")


if __name__ == "__main__":
    main()
