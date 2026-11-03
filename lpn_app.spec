# -*- mode: python ; coding: utf-8 -*-
import os
import sys
from pathlib import Path

block_cipher = None

backend_dir = os.path.abspath('backend')
frontend_dist_dir = os.path.join(backend_dir, 'frontend_dist')

# Собираем данные для упаковки
datas = []

# 1. Frontend (статические файлы)
if os.path.exists(frontend_dist_dir):
    datas.append((frontend_dist_dir, 'frontend_dist'))
else:
    print(f"WARNING: {frontend_dist_dir} не найден. Запустите build_exe.bat сначала!")

# 2. C++ модуль (.pyd файл)
pyd_files = list(Path(backend_dir).glob('randLPN_CPP*.pyd'))
for pyd in pyd_files:
    datas.append((str(pyd), '.'))
    print(f"Добавлен C++ модуль: {pyd}")

# 3. Все Python модули backend
py_files = [
    'main.py', 'database.py', 'lpn_generator.py', 'distributions.py',
    'networkx_models.py', 'analyzer.py', 'experiment_runner.py', 'run_app.py',
]
for py in py_files:
    path = os.path.join(backend_dir, py)
    if os.path.exists(path):
        datas.append((path, '.'))

# Скрытые импорты
hiddenimports = [
    'fastapi', 'fastapi.middleware', 'fastapi.middleware.cors',
    'fastapi.staticfiles', 'fastapi.responses',
    'starlette', 'starlette.staticfiles', 'starlette.responses',
    'starlette.middleware', 'starlette.middleware.cors',
    'uvicorn', 'uvicorn.main', 'uvicorn.loops', 'uvicorn.loops.auto',
    'uvicorn.protocols', 'uvicorn.protocols.http', 'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets', 'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan', 'uvicorn.lifespan.on',
    'pydantic', 'pydantic.fields', 'pydantic.main', 'pydantic.types',
    'numpy', 'numpy.core', 'numpy.linalg',
    'scipy', 'networkx', 'sqlite3',
    'randLPN_CPP',
    'json', 'asyncio', 'concurrent.futures', 'multiprocessing',
    'webbrowser', 'socket', 'threading',
]

a = Analysis(
    [os.path.join(backend_dir, 'run_app.py')],
    pathex=[backend_dir],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['matplotlib', 'PIL', 'pandas', 'IPython', 'jupyter', 'notebook', 'pytest'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='LPN_Research',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # Оставляем консоль для логов
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)