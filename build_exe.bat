@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ============================================================
echo   СБОРКА LPN Research в EXE-файл
echo ============================================================
echo.

echo [1/5] Проверка окружения...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Python не найден!
    pause
    exit /b 1
)

node --version >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Node.js не найден!
    pause
    exit /b 1
)

if not exist "venv\Scripts\activate.bat" (
    echo [ОШИБКА] Виртуальное окружение не найдено!
    pause
    exit /b 1
)
echo [OK] Окружение проверено.
echo.

echo [2/5] Установка PyInstaller...
call venv\Scripts\activate.bat
pip show pyinstaller >nul 2>&1
if errorlevel 1 (
    pip install pyinstaller
)
echo [OK] PyInstaller готов.
echo.

echo [3/5] Сборка фронтенда (npm run build)...
pushd frontend
if not exist "node_modules" call npm install
call npm run build
if errorlevel 1 (
    echo [ОШИБКА] Сборка фронтенда не удалась!
    popd
    pause
    exit /b 1
)
popd
echo [OK] Фронтенд собран.
echo.

echo [4/5] Копирование статики в backend...
if exist "backend\frontend_dist" rmdir /S /Q backend\frontend_dist
xcopy /E /I /Q "frontend\dist" "backend\frontend_dist" >nul
echo [OK] Статика скопирована.
echo.

echo [5/5] Сборка EXE-файла через PyInstaller...
echo      (Это может занять 5-15 минут)
echo.

rmdir /S /Q build 2>nul
rmdir /S /Q dist 2>nul

pyinstaller --clean lpn_app.spec
if errorlevel 1 (
    echo [ОШИБКА] PyInstaller завершился с ошибкой!
    pause
    exit /b 1
)

if not exist "dist\data\networks" mkdir dist\data\networks

echo.
echo ============================================================
echo   СБОРКА ЗАВЕРШЕНА УСПЕШНО!
echo ============================================================
echo.
echo   EXE-файл: dist\LPN_Research.exe
echo.
echo   Отправьте этот файл другому человеку.
echo   Он просто запустит его двойным кликом.
echo.
pause