# ERP 개발 계획서 (Development Plan & Architecture Document) — 메인

> 대상 프로젝트: `E:\100_dev\local_erp`
> 작성 방식: 소스코드/문서 실사 기반, 추측 없이 작성. 단계별(Step-by-step) 진행.
> **현재 상태: STEP 1~8(분석/문서화) 전체 완료 + 보완개발(18-A) 진행 중.**

---

## 0. 📖 문서 관리 지침서 (반드시 먼저 읽을 것)

### 0-1. 파일 구조

이 개발계획서는 파일 크기 관리를 위해 **3계층**으로 분리되어 있다.

```
docs/
├── ERP_개발계획서.md              ★ 메인 문서 (이 파일)
│                                    - 진행현황, 문서 구조 지침, 전체 흐름 요약만 관리
│                                    - 이 파일 하나만 읽어도 프로젝트 전체 그림이 잡히도록 유지
│
├── analysis/                      ★ 분석 단계별 원본 기록 (raw finding, 근거자료) — 전체 완료
│   ├── STEP1_MD문서분석.md         - 완료
│   ├── STEP2_폴더구조분석.md       - 완료
│   ├── STEP3_Backend분석.md        - 완료
│   ├── STEP4_Frontend분석.md       - 완료
│   ├── STEP5_공통Framework분석.md  - 완료
│   ├── STEP6_Reference화면분석.md  - 완료 (profit_payment_date, admin_settings)
│   └── STEP7_데이터흐름분석.md     - 완료
│
└── toc/                            ★ 최종 개발계획서 목차 단위 원고 (완성본, 19개 챕터 + 18-A 보완개발 현황)
    ├── 01_프로젝트개요.md
    ├── 02_전체시스템구성.md
    ├── 03_폴더구조.md
    ├── 04_Backend_Architecture.md
    ├── 05_Frontend_Architecture.md
    ├── 06_공통Framework.md
    ├── 07_메뉴생성구조.md
    ├── 08_TabManager동작.md
    ├── 09_ContentRenderer구조.md
    ├── 10_API호출방식.md
    ├── 11_GridRendering구조.md
    ├── 12_Reference화면분석.md
    ├── 13_Backend_Frontend연결구조.md
    ├── 14_데이터흐름.md
    ├── 15_공통컴포넌트.md
    ├── 16_개발표준.md
    ├── 17_신규메뉴개발절차.md
    ├── 18_향후개발계획.md
    ├── 18-A_보완개발진행현황.md    ★ 18장 이슈들의 실제 보완개발 진행 상황(이슈ID·상태·작업이력)
    └── 19_체크리스트.md
```

### 0-2. 각 계층의 역할

| 계층 | 역할 | 갱신 시점 |
|---|---|---|
| **메인 (`ERP_개발계획서.md`)** | 진행현황 관리 + "전체 흐름 요약"(요약본)으로 전체 그림 제공 | STEP/이슈가 진행될 때마다 "진행현황" 표와 "전체 흐름 요약" 섹션만 갱신 (상세 내용은 여기 안 씀) |
| **analysis/*.md** | 코드/문서를 실제로 읽고 조사한 상세 원본 기록 (파일명·함수·호출흐름 등 세부사항 전부 포함) | 해당 STEP 진행 시 새로 작성, 이후 거의 수정 안 함(근거자료로 고정). 코드가 바뀌어도 원문은 보존하고 "추가 확인" 섹션으로 덧붙임 |
| **toc/*.md** | 최종 산출물인 "개발계획서" 그 자체. STEP 8에서 analysis 폴더의 근거자료를 재료로 목차 단위로 정리해서 작성 | STEP 8(최종 작성) 단계에서 채움, 이후 코드가 바뀌면 해당 챕터를 최신 상태로 갱신 |
| **toc/18-A_보완개발진행현황.md** | 18장에서 식별된 이슈의 **실제 보완개발 작업 로그**(이슈ID, 상태, 변경 파일·이유·검증방법) | 이슈 착수/완료 시마다 갱신. 18장과 함께 읽으면 "왜 문제였고 무엇을 어떻게 고쳤는지"가 파악되도록 유지 |

### 0-3. 작업 원칙

1. **메인 파일은 가볍게 유지한다.** 상세 분석 내용(코드 스니펫, 함수 목록, 호출 체인 등)은 절대 메인에 직접 쓰지 않고 `analysis/` 또는 `toc/`에 작성 후 메인에서는 링크와 1~3줄 요약만 남긴다.
2. **analysis 파일 = 근거, toc 파일 = 결과물.** analysis는 "무엇을 발견했는가"를 기록하고, toc는 "새 개발자가 읽을 최종 문서"로 재구성한다. 같은 내용이라도 목적이 다르므로 두 번 쓰는 게 맞다(중복이 아니라 역할 분리).
3. **모든 내용은 실제 소스코드/문서를 읽고 작성한다.** 추측 금지.
4. **진행은 항상 1 STEP씩(또는 1 이슈씩).** 사용자가 "계속"이라고 하면 다음 STEP/이슈로 진행한다.
5. **파일이 커지면 추가로 분할한다.** 이 경우 메인의 파일 구조 표도 함께 갱신한다.
6. **경로 표기**: 이 문서의 모든 파일 참조는 `docs/` 기준 상대경로로 표기한다 (예: `analysis/STEP1_MD문서분석.md`).
7. **문서 유지보수**: 코드가 변경되면 해당 `toc/*.md` 챕터를 갱신하고, 큰 변경이면 `analysis/`에 새 분석 파일을 추가한다. 보안/버그 수정처럼 실제 코드 변경이 수반되는 작업은 **[toc/18-A_보완개발진행현황.md](./toc/18-A_보완개발진행현황.md)**에 이슈ID로 기록한다. 상세 유지보수 절차는 [toc/19_체크리스트.md](./toc/19_체크리스트.md) 19-5절 참고.

---

## 1. 진행현황

### 1-1. 분석/문서화 (STEP 1~8)

| Step | 내용 | 상태 | 분석 파일 |
|---|---|---|---|
| 1 | MD 문서 전수 분석 | ☑ 완료 | [analysis/STEP1_MD문서분석.md](./analysis/STEP1_MD문서분석.md) |
| 2 | 프로젝트 폴더 구조 분석 | ☑ 완료 | [analysis/STEP2_폴더구조분석.md](./analysis/STEP2_폴더구조분석.md) |
| 3 | Backend 구조 분석 | ☑ 완료 | [analysis/STEP3_Backend분석.md](./analysis/STEP3_Backend분석.md) |
| 4 | Frontend 구조 분석 | ☑ 완료 | [analysis/STEP4_Frontend분석.md](./analysis/STEP4_Frontend분석.md) |
| 5 | 공통 Framework 분석 | ☑ 완료 | [analysis/STEP5_공통Framework분석.md](./analysis/STEP5_공통Framework분석.md) |
| 6 | Reference 화면 분석 (profit_payment_date, admin_settings) | ☑ 완료 | [analysis/STEP6_Reference화면분석.md](./analysis/STEP6_Reference화면분석.md) |
| 7 | 전체 데이터 흐름 분석 | ☑ 완료 | [analysis/STEP7_데이터흐름분석.md](./analysis/STEP7_데이터흐름분석.md) |
| 8 | 개발계획서 최종 작성 (toc/ 19개 챕터 완성) | ☑ 완료 | [toc/](./toc/) 전체 (19/19) |

### 1-2. 보완개발 (18-A, STEP 8 이후 실제 코드 수정 단계)

> 상세 이슈 목록·진행 이력은 **[toc/18-A_보완개발진행현황.md](./toc/18-A_보완개발진행현황.md)** 참고. 아래는 요약.

| ID | 이슈 | 상태 | 작업일 |
|---|---|---|---|
| ISSUE-01 | `admin_routes.py` role 검증 부재(권한 상승 취약점) | ☑ 완료 | 2026-07-18 |
| ISSUE-02~11 | SECRET_KEY 하드코딩 외 9건 | ☐ 대기 | - |

**진행률: 11개 중 1개 완료.**

---

## 2. 목차 (최종 개발계획서 — `toc/` 폴더, 전체 완성)

1. [프로젝트 개요](./toc/01_프로젝트개요.md)
2. [전체 시스템 구성](./toc/02_전체시스템구성.md)
3. [폴더 구조](./toc/03_폴더구조.md)
4. [Backend Architecture](./toc/04_Backend_Architecture.md)
5. [Frontend Architecture](./toc/05_Frontend_Architecture.md)
6. [공통 Framework](./toc/06_공통Framework.md)
7. [메뉴 생성 구조](./toc/07_메뉴생성구조.md)
8. [Tab Manager 동작](./toc/08_TabManager동작.md)
9. [Content Renderer 구조](./toc/09_ContentRenderer구조.md)
10. [API 호출 방식](./toc/10_API호출방식.md)
11. [Grid Rendering 구조](./toc/11_GridRendering구조.md)
12. [Reference 화면 분석 (profit_payment_date / admin_settings)](./toc/12_Reference화면분석.md)
13. [Backend ↔ Frontend 연결 구조](./toc/13_Backend_Frontend연결구조.md)
14. [데이터 흐름](./toc/14_데이터흐름.md)
15. [공통 컴포넌트](./toc/15_공통컴포넌트.md)
16. [개발 표준](./toc/16_개발표준.md)
17. [신규 메뉴 개발 절차](./toc/17_신규메뉴개발절차.md)
18. [향후 개발 계획](./toc/18_향후개발계획.md)
18-A. [보완개발 진행 현황](./toc/18-A_보완개발진행현황.md) ★ 실제 코드 수정 작업 로그
19. [체크리스트](./toc/19_체크리스트.md)

---

## 3. 전체 흐름 요약 (이 섹션만 읽어도 프로젝트 전체 그림이 잡히도록 유지)

> ⚠️ 아래는 STEP 1~7의 **압축 요약**이다. 상세 내용/근거는 각 `analysis/*.md` 링크, 최종 정리본은 `toc/*.md` 링크 참고.

### 3-1. 프로젝트 정체성 (STEP 1 근거: [analysis/STEP1_MD문서분석.md](./analysis/STEP1_MD문서분석.md), 최종정리: [toc/01_프로젝트개요.md](./toc/01_프로젝트개요.md))

- Flask + Jinja2 + PostgreSQL + AG Grid Community + Vanilla JS 기반 사내 ERP.
- 백엔드는 `app.py` 단일 구조 → **`routes → service → repository → db` 4단 레이어드 구조**로 마이그레이션 완료(Phase 0~5), 회귀 검증(Phase 6) 진행 중.
- DB는 2개: 로컬 PostgreSQL(myappdb, 읽기/쓰기) + 사내 상용 ERP(Odoo)의 PostgreSQL(**조회 전용 강제**, 코드+DB계정 이중 방어).
- 프론트는 사이드바 트리메뉴 → 탭 매니저(MDI) → `SplitLayout` 엔진(유형 A/B/C) → `content-renderers/*.js`(contentId별 렌더 함수) → AG Grid/Key-Value폼 순서로 완성된 스켈레톤(UI Step 1~9 전부 완료).
- 핵심 설계 원칙: **엔진(SplitLayout, TabManager, registry)은 절대 수정하지 않고, 화면 추가는 설정 데이터(`SCREEN_LAYOUTS`, `registerRenderer` 등)만 추가**하는 방식.
- git 미사용 → 폴더 백업으로 버전관리 대체.

### 3-2. 알아야 할 중요 함정 (실사 중 발견된 사실, 최종정리: [toc/18-A_보완개발진행현황.md](./toc/18-A_보완개발진행현황.md) / [toc/19_체크리스트.md](./toc/19_체크리스트.md) 19-4절)

- **✅ [보안, 해결됨] role 검증 부재**: `admin_settings`의 관리자 API(`/admin/users/*`) 4개 라우트 전부 `@login_required`만 있고 role 검증이 없어, 일반 유저가 URL로 직접 호출해 자기 자신을 admin으로 승격 가능했던 문제(STEP 3·5·6에서 코드로 최종 확증). **2026-07-18, `auth.py`에 `role_required` 공통 데코레이터를 추가하고 4개 라우트에 적용해 해결됨.** 상세: [18-A ISSUE-01](./toc/18-A_보완개발진행현황.md#2-1-issue-01-admin_routespy-role-검증-부재--완료).
- **🔴 [보안, 미해결] SECRET_KEY 하드코딩**: `app.py`의 `SECRET_KEY` 기본값이 `"dev-only-change-me"`. `.env` 미설정 시 위험 (STEP 7, ISSUE-02).
- **ℹ️ profit_payment_date 자동조회 미적용(의도적 설계, 버그 아님)**: 계획 단계에서는 "탭 오픈 시 기본일자로 1차 자동조회"로 서술되었으나, 실운영 관점에서 무거운 상용ERP 분석 쿼리가 탭을 열 때마다 자동으로 돌 필요가 없다고 판단되어, 사용자가 "조회" 버튼을 직접 누를 때만 조회되도록 개발방향이 변경되어 최종 확정되었다. 해당 호출 코드는 삭제 대신 주석으로 남겨두었으며, 향후 다시 필요해지면 주석만 해제하면 된다 (STEP 6).
- **⚠️ 문서-코드 불일치**: (1) `erp_ui_next_steps.md`는 Step 6~9를 "예정"으로 표기하지만 실제로는 전부 완료됨. (2) `profit_payment_date`는 계획 문서상 유형 A(단일 그리드)로 서술되나 실제 코드는 유형 C(좌우 2단+서브탭) — 문서보다 코드가 항상 최종 진실 (STEP 1, 4).
- **🟡 [미해결] 레거시 파일 존재**: `db_legacy_backup.py`, `content-renderers.js.bak`, `static/js/splitter.js`, `static/js/grid-init.js`(빈파일), `templates/base - 복사본.html` 등은 삭제되지 않고 보관 중 (git 미사용 환경 특성, STEP 2, ISSUE-09).
- **🟡 [미해결] 세션 role staleness**: `session["role"]`은 로그인 시점 값이 고정되어, admin_settings에서 role을 변경해도 재로그인 전까지 반영 안 됨. role 검증 데코레이터는 도입되었으나(ISSUE-01) 이 staleness 자체는 아직 미해결 (STEP 7, ISSUE-06).
- **🟡 [미해결] 로깅 버그**: `profit_analysis_repository.py`의 `logger.info("지급일기준 손익조회", date_payment)`가 포맷 인자 없이 인자를 넘겨 `TypeError` 유발 가능성 (STEP 6, 7, ISSUE-07).

> 전체 이슈 목록·진행 상태·상세 작업 이력은 **[toc/18-A_보완개발진행현황.md](./toc/18-A_보완개발진행현황.md)**, 향후 계획 방향은 **[toc/18_향후개발계획.md](./toc/18_향후개발계획.md)** 참고.

### 3-3. Reference 화면 2개 (상세: [analysis/STEP6_Reference화면분석.md](./analysis/STEP6_Reference화면분석.md), 최종정리: [toc/12_Reference화면분석.md](./toc/12_Reference화면분석.md))

| 화면 | menuKey | 레이아웃 유형 | 특징 |
|---|---|---|---|
| 지급기준손익 | `profit_payment_date` | **C**(좌우 2단+서브탭 — 계획 문서상 A로 서술되었으나 실제는 C임을 코드로 확인) | 상용ERP(Odoo) 조회. **탭 오픈 시 자동조회는 의도적으로 비활성**(3-2 참고), 사용자가 "조회" 버튼을 직접 눌러야 함. 서브탭(매입/관련문서)은 하드코딩 더미로 미연동 |
| 관리자 설정 | `admin_settings` | C(좌우+서브탭) | 로컬DB 실 CRUD(R/U) 연동, Lazy Loading 대상, role 변경 API. **보안 이슈는 2026-07-18 조치 완료**(3-2, 18-A ISSUE-01 참고). 서브탭은 profit 화면과 달리 실제 API로 연동됨 |

### 3-4. STEP별 요약 (전체 완료)

- **STEP 2 폴더 구조**: `routes→service→repository→db` 3계층 + 정적자원(css/js) 엔진/설정/도메인렌더러 분리 구조가 실측으로 확인됨. 레거시 파일 다수가 삭제되지 않고 보관 중임을 실측 확인. 상세: [analysis/STEP2_폴더구조분석.md](./analysis/STEP2_폴더구조분석.md) · [toc/03_폴더구조.md](./toc/03_폴더구조.md)
- **STEP 3 Backend**: `routes→service→repository→db` 4단 구조가 로그인/profit_payment_date/admin_settings/approval 도메인 전부에서 일관되게 구현됨을 코드로 확인. `admin_routes.py` 보안 이슈를 코드에서 직접 확인(이후 18-A ISSUE-01로 조치). 상세: [analysis/STEP3_Backend분석.md](./analysis/STEP3_Backend분석.md) · [toc/04_Backend_Architecture.md](./toc/04_Backend_Architecture.md)
- **STEP 4 Frontend**: 앱 셸(`base.html`) → 사이드바 → `TabManager.openTab()` → `ensureContentPane()`(Lazy Loading 판단) → `SplitLayout.render()` → `screen-layouts.js` → `content-renderers/*` 렌더링 파이프라인을 코드로 확인. `profit_payment_date`가 실제로는 유형 C임을 발견, `split-layout.js` 드래그 리사이즈 버그 수정사항이 실제 코드에 반영됨도 확인. 상세: [analysis/STEP4_Frontend분석.md](./analysis/STEP4_Frontend분석.md) · [toc/05_Frontend_Architecture.md](./toc/05_Frontend_Architecture.md)
- **STEP 5 공통 Framework**: Frontend는 `apiFetch()` 단일 창구로 통신 통일(CSRF는 meta 태그 출처로 코드 확정), `registry.js`가 렌더러 중복등록/함수유효성을 즉시 `throw`로 방어. Backend는 `settings→pool→repository` 3단 책임분리가 코드로 강제, 상용DB는 `ReadOnlyConnection`으로 조회전용 강제. 당시 `auth.py`에 `role_required` 공통 데코레이터가 없어 admin_routes.py 보안 이슈의 근본 원인이 되었음을 확인(이후 18-A ISSUE-01로 데코레이터 추가 완료). 상세: [analysis/STEP5_공통Framework분석.md](./analysis/STEP5_공통Framework분석.md) · [toc/06_공통Framework.md](./toc/06_공통Framework.md)
- **STEP 6 Reference 화면**: 두 화면의 진입~DB 전체 호출 흐름을 코드로 추적 완료. `profit_payment_date`는 무거운 다중 CTE 조인 쿼리이며 자동조회 비활성(의도적), 서브탭 더미. `admin_settings`는 로컬DB 실 CRUD 연동되며 role 변경 보안 취약점을 실제 호출 흐름으로 최종 확증(이후 조치 완료). 상세: [analysis/STEP6_Reference화면분석.md](./analysis/STEP6_Reference화면분석.md) · [toc/12_Reference화면분석.md](./toc/12_Reference화면분석.md)
- **STEP 7 데이터 흐름**: 앱 초기화부터 로그인→세션→화면접근→로깅까지 관통하는 공통 흐름을 코드로 종합 확인. `SECRET_KEY` 하드코딩, 세션 role staleness, 로깅 포맷 버그의 실제 영향을 추가로 확인. 상세: [analysis/STEP7_데이터흐름분석.md](./analysis/STEP7_데이터흐름분석.md) · [toc/14_데이터흐름.md](./toc/14_데이터흐름.md)
- **STEP 8 개발계획서 최종 작성**: `analysis/*.md` 7개 파일의 근거자료를 재료로 `toc/` 폴더에 19개 챕터를 모두 작성 완료. 전체 미해결 이슈 목록은 이후 [toc/18-A_보완개발진행현황.md](./toc/18-A_보완개발진행현황.md)로 이관되어 실제 보완개발 작업 로그로 관리 중.

---

## 4. 다음 진행

**STEP 1~8(분석/문서화) 완료. 이후 18-A(보완개발)를 이슈 단위로 진행 중.**

- 처음 읽는 개발자는 위 "3. 전체 흐름 요약"을 읽은 뒤, [toc/01_프로젝트개요.md](./toc/01_프로젝트개요.md)부터 [toc/19_체크리스트.md](./toc/19_체크리스트.md)까지 순서대로 읽으면 프로젝트 전체를 이해할 수 있습니다.
- **실제 코드 수정이 필요한 미해결 이슈**는 [toc/18_향후개발계획.md](./toc/18_향후개발계획.md)에서 우선순위를 확인하고, [toc/18-A_보완개발진행현황.md](./toc/18-A_보완개발진행현황.md)에 이슈ID(`ISSUE-02`~)로 진행 상황을 기록하며 "계속" 요청 시 다음 이슈부터 이어서 진행합니다.
- 코드가 변경되면 해당 `toc/*.md` 챕터를 갱신하고(유지보수 절차: [toc/19_체크리스트.md](./toc/19_체크리스트.md) 19-5절), 필요 시 `analysis/`에 새 분석 파일을 추가해주세요.
