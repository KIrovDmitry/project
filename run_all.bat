@echo off
chcp 65001 >nul
echo ============================================================
echo   Запуск LPN Research
echo ============================================================
echo.

:: Проверка наличия venv
if not exist "venv\Scripts\activate.bat" (
    echo [ОШИБКА] Виртуальное окружение не найдено!
    echo Сначала запустите start.bat для установки зависимостей.
    pause
    exit /b 1
)

:: Проверка наличия frontend/node_modules
if not exist "frontend\node_modules" (
    echo [ОШИБКА] Фронтенд зависимости не установлены!
    echo Сначала запустите start.bat для установки зависимостей.
    pause
    exit /b 1
)

:: Запуск backend в отдельном окне
echo Запуск backend на http://localhost:8000 ...
start "LPN Backend" cmd /k "call venv\Scripts\activate.bat && cd backend && python main.py"

:: Ожидание запуска backend
timeout /t 3 /nobreak >nul

:: Запуск frontend в отдельном окне
echo Запуск frontend на http://localhost:5173 ...
start "LPN Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ============================================================
echo   Серверы запущены:
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:5173  ^<-- ОТКРОЙТЕ В БРАУЗЕРЕ
echo ============================================================
echo.
echo Не закрывайте открывшиеся окна!
echo Для остановки закройте окна LPN Backend и LPN Frontend.
echo.
pause