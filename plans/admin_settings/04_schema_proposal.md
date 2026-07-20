# 4단계 — User 테이블 확장 및 권한 매트릭스 설계안 (제안만, 구현은 다음 단계)

> 이 문서는 **설계 제안**만 담는다. 이번 단계에서는 구현하지 않으며, 실제 마이그레이션은
> 별도 단계에서 `erp_backend_migration_plan.md`와 함께 재검토 후 진행한다.

## 1. 현재 상태 (실제 코드 기준 확인됨 — repository/local_repository.py의 SELECT 구문에서 일관되게 사용 중)
```sql
-- 현재 users 테이블
users (
    id       INTEGER PRIMARY KEY,
    email    VARCHAR,
    password VARCHAR,   -- bcrypt/werkzeug 혼용, auth.py의 verify_password()가 분기
    role     VARCHAR    -- 현재 'admin' / 'user' 두 값만 사용 중 (service/user_service.py의 ALLOWED_ROLES)
)
```

## 2. `users` 테이블 확장안

```sql
ALTER TABLE users ADD COLUMN name VARCHAR(100);          -- 사용자명 (현재 이메일만 표시 가능한 상태)
ALTER TABLE users ADD COLUMN is_active CHAR(1) DEFAULT 'Y'; -- 사용여부 Y/N (업로드 이미지의 거래처 조회화면과 동일 패턴)
ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT now(); -- 등록일
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP;     -- 마지막 로그인 시각 (로그인 성공 시 갱신)
```

- `last_login_at`은 `routes/auth_routes.py`의 `login_process()` 로그인 성공 분기에서
  `UPDATE users SET last_login_at = now() WHERE id = %s` 형태로 갱신하는 것을 함께 제안
  (이번 단계 범위 아님 — 다음 단계에서 auth_routes.py 수정 필요)

## 3. `user_login_history` 테이블 (신규, 로그인 이력/현재 로그인 상태 관리)

```sql
CREATE TABLE user_login_history (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    login_at    TIMESTAMP NOT NULL DEFAULT now(),
    logout_at   TIMESTAMP,              -- NULL이면 "현재 로그인 상태"로 판단 가능
    ip_address  VARCHAR(45),
    session_id  VARCHAR(255)
);
```

**왜 users 테이블에 로그인 상태를 바로 두지 않고 분리하는가**
- 로그인/로그아웃은 이력성 데이터라, 컬럼 하나(`is_logged_in` 같은)로 덮어쓰면 동시 로그인/다중 세션 관리가 안 됨
- 향후 "현재 로그인 상태" 요구사항이 늘어날 걸 감안해 로그 테이블로 분리하는 편이 감사(audit)에도 유리
- 관리자 화면 좌측 목록의 "현재 로그인 상태"는 `logout_at IS NULL`인 최신 row 존재 여부로 판단하는 쿼리로 조회 가능

## 4. 권한 매트릭스 — `menu_permissions` (신규, RBAC 확장형)

```sql
CREATE TABLE menu_permissions (
    id          SERIAL PRIMARY KEY,
    menu_key    VARCHAR(100) NOT NULL,   -- menu_data.py의 leaf node "key"와 매칭 (예: 'voucher_entry')
    role        VARCHAR(50) NOT NULL,    -- 1단계는 role 기준. 추후 user_id 기준으로 확장 가능하도록 컬럼만 남겨둠
    can_view    BOOLEAN DEFAULT true,
    can_add     BOOLEAN DEFAULT false,
    can_edit    BOOLEAN DEFAULT false,
    can_delete  BOOLEAN DEFAULT false,
    can_print   BOOLEAN DEFAULT false,
    UNIQUE (menu_key, role)
);
```

- `menu_data.py`의 각 leaf(`{"type": "file", "label": "...", "key": "..."}`)와 `menu_key`를 1:1 매칭시키면,
  현재 더미로 되어 있는 트리메뉴가 실제 DB 메뉴 테이블로 바뀌는 시점(코드 주석에 "Step 9(DB 연동)"로 예고되어 있음)에
  권한 매트릭스도 자연스럽게 같은 key로 join 가능
- 향후 "역할별"이 아니라 "사용자 개인별" 예외 권한이 필요해지면, `role` 컬럼 대신/추가로 `user_id` 컬럼을 넣은
  `user_menu_permissions` 테이블을 별도로 얹는 구조 확장 가능 (지금 당장 만들지는 않음)

## 5. 관리자 화면과의 연결 지점 (다음 단계 구현 시 참고)
- 좌측 목록: `is_active`, `last_login_at`(또는 `user_login_history` 기반 "현재 로그인" 여부) 컬럼 추가 표시
- 우측 "권한정보" 탭: `menu_permissions`을 `menu_key` 기준 체크박스 그리드로 렌더 → 저장 시 role 단위 upsert

## 6. 적용 시점 제안
1. 지금 단계(00~03 문서): role 기반 뼈대 완성
2. 다음 단계: 위 스키마 마이그레이션 적용 + `auth_routes.py`(last_login_at 갱신) + 관리자 화면 컬럼/탭 확장
3. 그다음 단계: `menu_data.py` DB 전환과 맞물려 `menu_permissions` 실제 연동
