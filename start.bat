@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ============================================================
echo   Установка и запуск проекта LPN Research
echo ============================================================
echo.

:: ============================================================
:: 1. Проверка структуры проекта
:: ============================================================
echo [1/6] Проверка структуры проекта...

if not exist "backend\main.py" (
    echo [ОШИБКА] Не найден backend\main.py
    echo Убедитесь, что скрипт запущен из корня проекта.
    pause
    exit /b 1
)

if not exist "frontend\package.json" (
    echo [ОШИБКА] Не найден frontend\package.json
    echo Убедитесь, что папка frontend существует.
    pause
    exit /b 1
)

if not exist "backend\requirements.txt" (
    echo [ОШИБКА] Не найден backend\requirements.txt
    pause
    exit /b 1
)

echo [OK] Структура проекта корректна.
echo.

:: ============================================================
:: 2. Проверка наличия Python
:: ============================================================
echo [2/6] Проверка наличия Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Python не найден!
    echo Установите Python 3.10+ с https://www.python.org/
    echo Обязательно отметьте "Add Python to PATH" при установке.
    pause
    exit /b 1
)
python --version
echo [OK] Python найден.
echo.

:: ============================================================
:: 3. Проверка наличия Node.js
:: ============================================================
echo [3/6] Проверка наличия Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Node.js не найден!
    echo Установите Node.js с https://nodejs.org/
    pause
    exit /b 1
)
node --version
echo [OK] Node.js найден.
echo.

:: ============================================================
:: 4. Установка Python зависимостей
:: ============================================================
echo [4/6] Установка Python зависимостей...
if not exist "venv" (
    echo Создание виртуального окружения...
    python -m venv venv
)

echo Активация виртуального окружения...
call venv\Scripts\activate.bat

echo Установка пакетов из backend\requirements.txt...
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
if errorlevel 1 (
    echo [ОШИБКА] Не удалось установить Python зависимости.
    pause
    exit /b 1
)
echo [OK] Python зависимости установлены.
echo.

:: ============================================================
:: 5. Компиляция C++ модуля randLPN_CPP
:: ============================================================
echo [5/6] Компиляция C++ модуля randLPN_CPP...
echo.
echo ВНИМАНИЕ: Для компиляции требуется:
echo   - Visual Studio Build Tools (C++ компилятор)
echo   - Библиотека CGAL (устанавливается через conda или vcpkg)
echo.

if exist "backend\randLPN_CPP.cpp" (
    if exist "backend\setup.py" (
        echo Переход в директорию backend для компиляции...
        pushd backend
        
        echo Попытка компиляции C++ модуля...
        python setup.py build_ext --inplace
        set COMPILE_RESULT=%errorlevel%
        
        popd
        
        if !COMPILE_RESULT! neq 0 (
            echo.
            echo [ПРЕДУПРЕЖДЕНИЕ] Не удалось скомпилировать C++ модуль.
            echo Возможные причины:
            echo   1. Не установлен Visual Studio Build Tools
            echo   2. Не установлена библиотека CGAL
            echo.
            echo Для установки CGAL рекомендуется использовать conda:
            echo   conda install -c conda-forge cgal
            echo.
            echo Или vcpkg:
            echo   vcpkg install cgal
            echo.
            echo Бэкенд будет работать, но генерация LPN будет недоступна.
            echo Можно использовать только модели ER и BA через networkx.
        ) else (
            echo [OK] C++ модуль успешно скомпилирован.
        )
    ) else (
        echo [ПРЕДУПРЕЖДЕНИЕ] backend\setup.py не найден. Компиляция пропущена.
    )
) else (
    echo [ПРЕДУПРЕЖДЕНИЕ] backend\randLPN_CPP.cpp не найден. Компиляция пропущена.
)
echo.

:: ============================================================
:: 6. Установка фронтенд зависимостей
:: ============================================================
echo [6/6] Установка фронтенд зависимостей...
pushd frontend

call npm install
if errorlevel 1 (
    echo [ОШИБКА] Не удалось установить фронтенд зависимости.
    popd
    pause
    exit /b 1
)

popd
echo [OK] Фронтенд зависимости установлены.
echo.

:: ============================================================
:: Создание необходимых директорий
:: ============================================================
echo Создание служебных директорий...
if not exist "backend\data" mkdir backend\data
if not exist "backend\data\networks" mkdir backend\data\networks
echo [OK] Директории созданы.
echo.

:: ============================================================
:: Запуск серверов
:: ============================================================
echo ============================================================
echo   Установка завершена!
echo ============================================================
echo.
echo Для запуска проекта выполните:
echo   run_all.bat
echo.
echo Или запустите серверы отдельно:
echo   Backend:  venv\Scripts\activate.bat ^&^& cd backend ^&^& python main.py
echo   Frontend: cd frontend ^&^& npm run dev
echo.

set /p LAUNCH="Запустить серверы сейчас? (y/n): "
if /i "%LAUNCH%"=="y" (
    call run_all.bat
) else (
    echo.
    echo Готово. Для запуска выполните run_all.bat
)

pause