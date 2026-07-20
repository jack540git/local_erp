"""repository/profit_analysis_repository.py
손익관리 도메인 — 상용ERP DB 대상 분석성 쿼리(여러 도메인 테이블 조인).
매출(revenue_sale)/매입(revenue_purchase)/납품(delivery_order)/계약(approval_approval) 등을
전부 조인하는 쿼리라 특정 업무 도메인(sales/purchase 등)에 억지로 귀속시키지 않고
별도 파일로 분리한다 (main_py_migration_structure_review.md 2절 원칙).
"""
from db.prod_db import get_prod_db_connection
from utils.logger import get_logger

logger = get_logger(__name__)


def find_profit_by_payment_date(date_payment: str):
    """
    지급기준일(date_payment) 기준 계약별 손익 목록 조회.

    쿼리 안에 동일한 지급일자 조건(%s)이 두 곳(contract CTE, purchase_sum CTE)에 있어서
    params에 같은 값을 두 번 넣는다.

    :param date_payment: 'YYYY-MM-DD' 형식 문자열
    :return: dict 리스트 (계약별 매출/매입/납품/손익 집계)
    """
    logger.info("지급일기준 손익조회 (date_payment=%s)", date_payment)
    sql = """
            WITH contract AS (
                SELECT 
                    a.id AS approval_id,
                    a.doc_id,
                    a.name,
                    ROUND(a.amount / 1.1) AS amount,
                    -- ✅ amount_type이 'tax_include'인 경우에만 1.1로 나눔
                    CASE 
                        WHEN aac.amount_type = 'tax_include' THEN ROUND(aac.cost_thr / 1.1)
                        ELSE aac.cost_thr
                    END AS cost_thr,
                    CASE 
                        WHEN aac.amount_type = 'tax_include' THEN ROUND(aac.cost_for / 1.1)
                        ELSE aac.cost_for
                    END AS cost_for,
                    a.biz_done,
                    a.biz_note,
                    a.opportunity_id,
                    as2.name AS team,
                    he.name AS user
                FROM approval_approval a
                INNER JOIN hr_employee he 
                    ON a.applier = he.id
                INNER JOIN approval_subdepartment as2 
                    ON he.subdepartment_id = as2.id
                LEFT JOIN approval_approval_contract aac 
                    ON a.id = aac.approval_id
                WHERE EXISTS (
                    SELECT 1 
                    FROM revenue_purchase rp 
                    WHERE rp.contract_doc_id = a.id 
                      AND rp.date_payment = %s
                )
            ),

            sale_sum AS (
                SELECT 
                    r.contract_doc_id,
                    COALESCE(SUM(r.price), 0) AS total_sale, COALESCE(SUM(r.amount_collected), 0) AS sale_collected, COALESCE(SUM(r.amount_remain), 0) AS sale_remain
                FROM revenue_sale r
                WHERE r.contract_doc_id IN (SELECT approval_id FROM contract)
                GROUP BY r.contract_doc_id
            ),

            purchase_sum AS (
                SELECT 
                    r.contract_doc_id,
                    COALESCE(SUM(r.price), 0) AS total_purchase,
                    COALESCE(SUM(CASE WHEN r.purchase_type_two = 27 THEN r.price ELSE 0 END), 0) AS sum_product,
                    COALESCE(SUM(CASE WHEN r.purchase_type_two = 28 THEN r.price ELSE 0 END), 0) AS sum_construction,
                    COALESCE(SUM(CASE WHEN r.purchase_type_two = 29 THEN r.price ELSE 0 END), 0) AS sum_fee,
                    COALESCE(SUM(CASE WHEN r.purchase_type_two = 30 THEN r.price ELSE 0 END), 0) AS sum_agency,
                    COALESCE(SUM(CASE WHEN r.purchase_order_id > 0 THEN r.price ELSE 0 END), 0) AS sum_po_account,
                    COALESCE(SUM(r.amount_payment), 0) AS sum_payment,
                    COALESCE(SUM(CASE WHEN r.date_payment = %s THEN r.amount_remain ELSE 0 END), 0) AS sum_remain
                FROM revenue_purchase r
                WHERE r.contract_doc_id IN (SELECT approval_id FROM contract)
                GROUP BY r.contract_doc_id
            ),

            delivery_orders AS (
                SELECT 
                    id, 
                    opportunity_id
                FROM delivery_order
                WHERE type = 'delivery'
                  AND opportunity_id IN (
                      SELECT opportunity_id 
                      FROM contract 
                      WHERE opportunity_id IS NOT NULL
                  )
            ),

            -- ✅ 최근 단가 정보 (product_id별 최신 1건)
            last_price AS (
                SELECT DISTINCT ON (product_id)
                       product_id, 
                       price_unit
                FROM purchase_order_line
                WHERE state = 'purchase'
                ORDER BY product_id, create_date DESC
            ),

            -- 예상 납품 금액
            expected_product_amount AS (
                SELECT 
                    dol.opportunity_id,
                    ROUND(SUM(
                        COALESCE(dol.quantity, 0) *
                        CASE 
                            WHEN pt.purchase_ok = TRUE THEN COALESCE(lp.price_unit, 0)
                            ELSE COALESCE(pt.list_price, 0)
                        END
                    )) AS total_dol_quantity_amount_all
                FROM delivery_order_line dol
                LEFT JOIN product_product pp 
                    ON dol.product_id = pp.id
                LEFT JOIN product_template pt 
                    ON pp.product_tmpl_id = pt.id
                LEFT JOIN last_price lp 
                    ON pp.id = lp.product_id
                WHERE dol.order_id IN (SELECT id FROM delivery_orders)
                  AND (dol.contract_cat != 'third' OR dol.contract_cat IS NULL)
                GROUP BY dol.opportunity_id
            ),

            -- 실제 납품 금액
            delivery_amounts AS (
                SELECT 
                    dol.opportunity_id,
                    ROUND(SUM(
                        COALESCE(sol.qty_delivered, 0) *
                        CASE 
                            WHEN pt.purchase_ok = TRUE THEN COALESCE(lp.price_unit, 0)
                            ELSE COALESCE(pt.list_price, 0)
                        END
                    )) AS total_qty_delivered_amount,
                    ROUND(SUM(
                        COALESCE(dol.quantity, 0) *
                        CASE 
                            WHEN pt.purchase_ok = TRUE THEN COALESCE(lp.price_unit, 0)
                            ELSE COALESCE(pt.list_price, 0)
                        END
                    )) AS total_dol_quantity_amount
                FROM delivery_order_line dol
                LEFT JOIN product_product pp 
                    ON dol.product_id = pp.id
                LEFT JOIN product_template pt 
                    ON pp.product_tmpl_id = pt.id
                LEFT JOIN (
                    SELECT DISTINCT ON (delivery_order_line_id)
                           delivery_order_line_id, 
                           order_id
                    FROM purchase_order_line
                    WHERE state = 'purchase'
                    ORDER BY delivery_order_line_id, create_date DESC
                ) pol 
                    ON dol.id = pol.delivery_order_line_id
                LEFT JOIN purchase_order po 
                    ON pol.order_id = po.id
                LEFT JOIN last_price lp 
                    ON pp.id = lp.product_id
                LEFT JOIN (
                    SELECT 
                        id, 
                        qty_delivered, 
                        delivery_order_line_id
                    FROM sale_order_line
                    WHERE state <> 'cancel'
                ) sol 
                    ON dol.id = sol.delivery_order_line_id
                WHERE dol.order_id IN (SELECT id FROM delivery_orders)
                  AND po.id IS NULL
                  AND (dol.contract_cat != 'third' OR dol.contract_cat IS NULL)
                GROUP BY dol.opportunity_id
            ),

            -- 판매 오더 금액
            saleoder_amounts AS (
                SELECT 
                    aa.id, 
                    aa.opportunity_id, 
                    ROUND(SUM(
                        sol.product_uom_qty * 
                        CASE 
                            WHEN pt.purchase_ok = TRUE THEN llp.price_unit
                            ELSE pt.list_price
                        END
                    )) AS total_so_price_amount,
                    ROUND(SUM(
                        sol.qty_delivered * 
                        CASE 
                            WHEN pt.purchase_ok = TRUE THEN llp.price_unit
                            ELSE pt.list_price
                        END
                    )) AS total_so_delivered_amount
                FROM sale_order_line sol
                LEFT JOIN product_product pp 
                    ON sol.product_id = pp.id
                LEFT JOIN product_template pt 
                    ON pp.product_tmpl_id = pt.id
                LEFT JOIN last_price llp 
                    ON llp.product_id = pp.id
                LEFT JOIN sale_order so 
                    ON sol.order_id = so.id
                LEFT JOIN approval_approval aa 
                    ON so.contract_doc_id = aa.id
                WHERE sol.order_id IN (
                    SELECT s.id 
                    FROM sale_order s 
                    WHERE s.contract_doc_id IN (SELECT approval_id FROM contract)
                ) and sol.state != 'cancel'
                GROUP BY aa.id, aa.opportunity_id
            ),

            -- 메인 데이터 통합
            main AS (
                SELECT 
                    c.approval_id AS id,
                    c.doc_id,
                    c.name AS doc_name,
                    c.team,
                    c.user,
                    c.amount AS expected_sale,
                    COALESCE(s.total_sale, 0) AS occurred_sale,
                    coalesce(s.sale_remain, 0) as uncollected_sale,
                    coalesce(s.sale_collected,0) - (coalesce(p.sum_payment,0) + coalesce(p.sum_remain,0)) as gain,
                    COALESCE(c.amount,0) - COALESCE(s.total_sale, 0) AS remain_sale,
                    c.biz_done,
                    c.biz_note,
                    COALESCE(p.total_purchase, 0) AS purchase_total,
                    COALESCE(p.sum_product, 0) AS sum_product,
                    COALESCE(p.sum_construction, 0) AS sum_construction,
                    c.cost_thr AS con_construct,
                    COALESCE(p.sum_fee, 0) AS sum_fee,
                    c.cost_for AS con_fee,
                    COALESCE(p.sum_agency, 0) AS sum_agency,
                    (COALESCE(p.total_purchase, 0)
                     - COALESCE(p.sum_product, 0)
                     - COALESCE(p.sum_construction, 0)
                     - COALESCE(p.sum_fee, 0)
                     - COALESCE(p.sum_agency, 0)) AS etc_purchase,
                    c.opportunity_id,
                    COALESCE(p.sum_remain, 0) AS sum_remain,
                    COALESCE(da.total_qty_delivered_amount, 0) AS total_qty_delivered_amount,
                    COALESCE(da.total_dol_quantity_amount, 0) AS total_dol_quantity_amount,
             -- product_value 정하는 방식 결정
                    COALESCE(da.total_qty_delivered_amount, 0) AS product_value,
             --       CASE 
             --           WHEN c.biz_done = TRUE THEN COALESCE(da.total_qty_delivered_amount, 0)
             --           ELSE COALESCE(da.total_dol_quantity_amount, 0)
             --       END AS product_value,
                    epa.total_dol_quantity_amount_all AS total_dol_amount_all,
                    COALESCE(sa.total_so_delivered_amount, 0) AS total_so_delivered_amount,
                    COALESCE(sa.total_so_price_amount, 0) AS total_so_price_amount,
                    COALESCE(sa.total_so_delivered_amount - p.sum_po_account, 0) AS product_value2,
             --      CASE 
             --         WHEN c.biz_done = TRUE 
             --             THEN COALESCE(sa.total_so_delivered_amount - p.sum_po_account, 0)
             --         ELSE COALESCE(sa.total_so_price_amount - p.sum_po_account, 0)
             --      END AS product_value2,
                    p.sum_po_account AS sum_po_account
                FROM contract c
                LEFT JOIN sale_sum s 
                    ON c.approval_id = s.contract_doc_id
                LEFT JOIN purchase_sum p 
                    ON c.approval_id = p.contract_doc_id
                LEFT JOIN delivery_amounts da 
                    ON c.opportunity_id = da.opportunity_id
                LEFT JOIN expected_product_amount epa 
                    ON c.opportunity_id = epa.opportunity_id 
                LEFT JOIN saleoder_amounts sa 
                    ON c.approval_id = sa.id
            )

            SELECT 
                m.*,
                (COALESCE(m.purchase_total, 0) + COALESCE(m.product_value, 0)) AS total_cost,
                (COALESCE(m.occurred_sale, 0) 
                 - (COALESCE(m.purchase_total, 0) + COALESCE(m.product_value, 0))) AS profit,
                CASE 
                    WHEN COALESCE(m.occurred_sale, 0) > 0 THEN ROUND(
                        ((COALESCE(m.occurred_sale, 0) 
                          - (COALESCE(m.purchase_total, 0) + COALESCE(m.product_value, 0))) 
                         / COALESCE(m.occurred_sale, 0) * 100), 1
                    )
                    ELSE NULL
                END AS profit_rate,
                (COALESCE(m.purchase_total, 0) + COALESCE(m.product_value2, 0)) AS total_cost2,
                (COALESCE(m.occurred_sale, 0) 
                 - (COALESCE(m.purchase_total, 0) + COALESCE(m.product_value2, 0))) AS profit2,
                CASE 
                    WHEN COALESCE(m.occurred_sale, 0) > 0 THEN ROUND(
                        ((COALESCE(m.occurred_sale, 0) 
                          - (COALESCE(m.purchase_total, 0) + COALESCE(m.product_value2, 0))) 
                         / COALESCE(m.occurred_sale, 0) * 100), 1
                    )
                    ELSE NULL
                END AS profit_rate2
            FROM main m
            ORDER BY 
                COALESCE(m.team, '') DESC, 
               -- COALESCE(m.user, '') ASC, 
                m.doc_id ASC
    """
    logger.info("[손익조회] SQL 실행 (date_payment=%s)", date_payment)
    logger.debug("[손익조회] 실행 SQL:\n%s", sql)

    with get_prod_db_connection() as conn:
        rows = conn.fetch_all(sql, (date_payment, date_payment))

    logger.info("[손익조회] 결과 %d건 (date_payment=%s)", len(rows), date_payment)
    logger.debug("[손익조회] 결과 데이터: %s", rows)
    return rows