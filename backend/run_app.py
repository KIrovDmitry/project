"""
Entry point для десктопного приложения LPN Research.
Запускает FastAPI-сервер и открывает браузер.
"""
import sys
import os
import webbrowser
import threading
import time
import socket
import uvicorn

# Определяем базовую директорию
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
    RESOURCE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    RESOURCE_DIR = BASE_DIR

# Добавляем путь к C++ модулю
if RESOURCE_DIR not in sys.path:
    sys.path.insert(0, RESOURCE_DIR)

# Переходим в рабочую директорию
os.chdir(BASE_DIR)

# Создаём необходимые директории
os.makedirs('data/networks', exist_ok=True)

import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def find_free_port(start_port: int = 8000, max_tries: int = 10) -> int:
    """Находит свободный порт."""
    for port in range(start_port, start_port + max_tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('127.0.0.1', port))
                return port
            except OSError:
                continue
    return start_port


def open_browser(port: int):
    """Открывает браузер через 1.5 секунды."""
    time.sleep(1.5)
    url = f'http://127.0.0.1:{port}'
    logger.info(f"Открываю браузер: {url}")
    try:
        webbrowser.open(url)
    except Exception as e:
        logger.error(f"Не удалось открыть браузер: {e}")


def main():
    """Главная функция запуска приложения."""
    from main import app
    
    port = find_free_port(8000)
    logger.info(f"Используется порт: {port}")
    
    # Запускаем открытие браузера в отдельном потоке
    threading.Thread(target=open_browser, args=(port,), daemon=True).start()
    
    logger.info("=" * 60)
    logger.info("  LPN Research Desktop Application")
    logger.info(f"  URL: http://127.0.0.1:{port}")
    logger.info("  Не закрывайте это окно для работы приложения!")
    logger.info("=" * 60)
    
    uvicorn.run(
        app,
        host='127.0.0.1',
        port=port,
        log_level='info',
        access_log=False
    )


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Приложение остановлено пользователем.")
        sys.exit(0)
    except Exception as e:
        logger.exception(f"Критическая ошибка: {e}")
        input("Нажмите Enter для выхода...")
        sys.exit(1)