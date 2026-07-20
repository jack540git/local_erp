"""app.py
Flask 엔트리포인트 — 앱 초기화 + Blueprint 등록만 담당한다.
실제 라우트/비즈니스 로직은 routes/, service/, repository/, db/ 계층에 있음
(레이어드 구조 마이그레이션: erp_backend_migration_plan.md 참고).
"""
import os
import secrets
import time
from flask import Flask
from flask_wtf import CSRFProtect

from utils.logger import setup_logging, get_logger
from routes.auth_routes import auth_bp
from routes.erp_routes import erp_bp
from routes.admin_routes import admin_bp

app = Flask(__name__)

setup_logging(app)  # Phase 5: 앱 전체 로깅 초기화 (logs/app.log + 콘솔 동시 출력)
logger = get_logger(__name__)

# 정적 파일(css/js) 캐시버스팅용 버전값. 프로세스 시작 시각(=컴테이너 재기동/배포마다)마다 값이 바뀌어,
# base.html에서 이 값을 정적 파일 URL 뒤에 쿼리스트링(?v=...)으로 붙이면, css/js를 고칠 때마다
# 브라우저 캐시를 수동으로 지울 필요 없이 자동으로 새로 받아간다.
app.jinja_env.globals["ASSET_VERSION"] = os.environ.get("ASSET_VERSION") or str(int(time.time()))

# 운영 환경에서는 반드시 환경변수로 주입(코드에 하드코딩 금지).
# FLASK_SECRET_KEY가 설정되어 있지 않으면, 모든 배포에서 동일한 값을 공유하게 되는
# 고정 하드코딩 값(예: "dev-only-change-me") 대신, 프로세스마다 무작위 키를 생성해 사용한다.
# 이 경우 재시작마다 세션/CSRF 토큰이 무효화되므로, .env에 FLASK_SECRET_KEY를
# 명시적으로 설정하는 것이 정상이며, 미설정 상태는 경고 로그로 즉시 드러난다.
_secret_key = os.environ.get("FLASK_SECRET_KEY")
if not _secret_key:
    _secret_key = secrets.token_hex(32)
    logger.warning(
        "FLASK_SECRET_KEY 환경변수가 설정되지 않아 임시 키를 생성했습니다. "
        "이 임시 키는 프로세스 재시작 시마다 바뀌므로 기존 세션이 모두 무효화됩니다. "
        "반드시 .env 파일에 FLASK_SECRET_KEY를 설정하세요."
    )
app.config["SECRET_KEY"] = _secret_key

csrf = CSRFProtect(app)  # 모든 POST/PUT/PATCH/DELETE 요청에 CSRF 토큰 자동 검증

app.register_blueprint(auth_bp)
app.register_blueprint(erp_bp)
app.register_blueprint(admin_bp, url_prefix="/admin")

logger.info("Flask 앱 초기화 완료 (Blueprint: auth, erp, admin 등록됨)")


if __name__ == "__main__":
    debug_mode = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=8080, debug=debug_mode)
