"""utils/logger.py
표준 logging 모듈 기반 로거 설정.
- logs/app.log 파일에 로테이션(RotatingFileHandler)하여 기록
- 동시에 콘솔(stdout)에도 출력 (docker compose logs로 실시간 확인 가능하도록)
- Flask의 app.logger도 같은 핸들러를 쓰도록 통합 (Flask 내부 에러 로그도 같은 파일에 남음)
"""
import logging
import os
from logging.handlers import RotatingFileHandler

# 이 파일(utils/logger.py) 기준으로 프로젝트 루트의 logs/ 폴더를 가리킴
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_DIR = os.path.join(_PROJECT_ROOT, "logs")
LOG_FILE = os.path.join(LOG_DIR, "app.log")

_configured = False


def setup_logging(app=None, level: int = logging.INFO) -> None:
    """
    애플리케이션 전역 로깅을 설정한다. 앱 시작 시 app.py에서 딱 한 번만 호출.
    Flask app 객체를 넘기면 app.logger(Flask 내부 에러 로그 포함)도 같은 곳에 기록되도록 통합한다.
    """
    global _configured
    if _configured:
        return

    os.makedirs(LOG_DIR, exist_ok=True)

    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # 파일: 5MB마다 로테이션, 최근 5개 파일까지 보관 (app.log, app.log.1, ... app.log.5)
    file_handler = RotatingFileHandler(
        LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=5, encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    file_handler.setLevel(level)

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(level)

    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)

    if app is not None:
        # Flask 자체 로그(app.logger)가 별도 핸들러를 갖지 않고, 위에서 설정한
        # 루트 로거의 핸들러(파일+콘솔)를 그대로 타도록 위임한다.
        app.logger.handlers = []
        app.logger.propagate = True

    _configured = True


def get_logger(name: str) -> logging.Logger:
    """모듈별 로거를 가져온다. 사용 예: logger = get_logger(__name__)"""
    return logging.getLogger(name)
