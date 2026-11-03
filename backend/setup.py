from setuptools import setup, Extension
import numpy as np
import sys
import os
import platform

# Пути к CGAL
include_dirs = [np.get_include()]
library_dirs = []

# Вариант 1: CGAL через conda
conda_prefix = os.environ.get('CONDA_PREFIX', '')
if conda_prefix:
    if platform.system() == 'Windows':
        include_dirs.append(os.path.join(conda_prefix, 'Library', 'include'))
        library_dirs.append(os.path.join(conda_prefix, 'Library', 'lib'))
    else:
        include_dirs.append(os.path.join(conda_prefix, 'include'))
        library_dirs.append(os.path.join(conda_prefix, 'lib'))

# Вариант 2: CGAL через vcpkg
vcpkg_root = os.environ.get('VCPKG_ROOT', '')
if vcpkg_root:
    if platform.system() == 'Windows':
        include_dirs.append(os.path.join(vcpkg_root, 'installed', 'x64-windows', 'include'))
        library_dirs.append(os.path.join(vcpkg_root, 'installed', 'x64-windows', 'lib'))

# Определяем флаги компиляции в зависимости от платформы
if platform.system() == 'Windows':
    # MSVC (Visual Studio)
    compile_args = ['/std:c++17', '/O2', '/DCGAL_HEADER_ONLY', '/EHsc']
    link_args = []
else:
    # GCC/Clang (Linux/macOS)
    compile_args = ['-std=c++17', '-O3', '-DCGAL_HEADER_ONLY']
    link_args = []

ext_modules = [
    Extension(
        'randLPN_CPP',
        sources=['randLPN_CPP.cpp'],
        include_dirs=include_dirs,
        library_dirs=library_dirs,
        libraries=['gmp', 'mpfr'] if platform.system() != 'Windows' else [],
        extra_compile_args=compile_args,
        extra_link_args=link_args,
        language='c++',
    )
]

setup(
    name='randLPN_CPP',
    version='1.0.0',
    description='C++ module for LPN generation',
    ext_modules=ext_modules,
)