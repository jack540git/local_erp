"""menu_data.py
Step 2: 좌측 트리메뉴 더미 데이터 (3단계 계층).
지시서 3-3절의 예시 구조를 그대로 반영:

회계관리
  기초자료등록
    계정등록
    사업자등록번호
  전표관리
    전표입력
세금계산서관리
  세금계산서조회

Step 9(DB 연동)에서는 이 더미 리스트 대신, 실제 메뉴 테이블 조회 결과로 교체 예정.
"""

DUMMY_TREE_MENU = [
    {
        "type": "folder",
        "label": "회계관리",
        "children": [
            {
                "type": "folder",
                "label": "기초자료등록",
                "children": [
                    {"type": "file", "label": "계정등록", "key": "account_register"},
                    {"type": "file", "label": "사업자등록번호", "key": "biz_reg_no"},
                ],
            },
            {
                "type": "folder",
                "label": "전표관리",
                "children": [
                    {"type": "file", "label": "전표입력", "key": "voucher_entry"},
                ],
            },
        ],
    },
    {
        "type": "folder",
        "label": "세금계산서관리",
        "children": [
            {"type": "file", "label": "세금계산서조회", "key": "tax_invoice_search"},
            {"type": "file", "label": "거래처정보관리", "key": "vendor_info"},
        ],
    },
    {
        "type": "folder",
        "label": "손익관리",
        "children": [
            {"type": "file", "label": "지급기준손익", "key": "profit_payment_date"},
            {"type": "file", "label": "손익현황(로컬)", "key": "local_profit_data"},
#            {"type": "file", "label": "기간기준손익", "key": "profit_period_date"},
        ],
    },    
]
