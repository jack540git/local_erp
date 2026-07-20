# main.py(상용 Odoo 컨트롤러) 반영 시 구조 재검토 — 핵심 요약

> 첨부된 `main.py`(Odoo 컨트롤러, 3,565줄, 컨트롤러 7개+, 쿼리 수십 개)가 향후 이 프로젝트에
> 포함된다는 전제로 기존 구조(`future_considerations.md` 3-1절)를 재검토한 결과.

## 1. 발견한 규모/복잡도

- 컨트롤러 7개 이상, 그중 `DataContainerController._get_data_by_container_id()`는 `container_id`별 **if/elif 10개 이상**, 각 분기가 100줄 안팎의 SQL 포함
- 손익조회류 쿼리는 **WITH절 7단계 이상의 재귀/다중 CTE**, 단일 쿼리가 150줄 이상
- 실제 업무 도메인 최소 9개 확인: 매출, 매입, 계약관리, 손익조회, 프로젝트수익, 납품관리(2버전), 오피스출고조회, 시스템내역, 결재문서(approval, 기확보)

## 2. 구조 변경 결정사항

| 항목 | 기존 계획 | 변경 |
|---|---|---|
| repository 분리 기준 | "함수 5개/파일 200줄" | **쿼리 복잡도 기준**으로 변경 — 재귀/다중 CTE 쿼리는 1함수 1파일도 허용 |
| 도메인 경계 | 도메인=repository 파일 1:1 | 여러 도메인 테이블을 조인하는 **분석/리포팅성 쿼리**(손익조회 등)는 `repository/analytics/`(가칭)로 별도 분리 — 특정 도메인에 억지로 귀속시키지 않음 |
| container_id 분기 | (미정) | if/elif 금지, **dict 기반 레지스트리 패턴** 사용 (`content-renderers.js`의 `registerRenderer()`와 동일 발상) |
| 권한 체크 | (미정) | `g.id == 135` 등 반복되는 권한 체크는 `auth.py`에 `@require_group(...)` 데코레이터로 공통화 |
| 쿼리 실행 보일러플레이트 | (미정) | try/execute/log/except 반복 패턴을 `db/query_utils.py`의 공통 헬퍼로 추출 |
| 내보내기(CSV/Excel) | (미정) | `utils/export.py`로 분리, 여러 도메인이 재사용 |
| 계산 로직 이중 구현 | (미정) | 동일 계산(예: 손익율)이 SQL과 Python 양쪽에 있는 경우, 이관 시 **한쪽으로 통일** (안 그러면 한쪽만 수정 시 결과 불일치 버그 발생) |

## 3. 이관 시 기술적 주의사항

- Odoo `request.env.cr.execute()`/`dictfetchall()` → 우리 프로젝트의 `get_prod_db_connection()`/`fetch_all()`로 교체 필요 (SQL 문자열 자체는 `%s` 플레이스홀더 방식이 같아 대부분 재사용 가능)
- `mogrify()`(Odoo의 SQL 디버그 로깅) 같은 Odoo 전용 메서드는 우리 `ReadOnlyConnection`에 없음 — 필요 시 별도 구현

## 4. 진행 방식

한 번에 전체 이관하지 않고, **approval 도메인 때처럼 실제 필요한 화면부터 도메인 단위로 우선순위를 매겨 하나씩 이관.**
