#!/usr/bin/env python3
"""
Скрипт для многопоточного расчёта трёх характеристик сетей:
  - avg_link_length (средняя длина связи)
  - avg_degree (средняя степень вершины)
  - clustering_coef (коэффициент кластеризации)

Использует ProcessPoolExecutor для обхода GIL и реального ускорения.
Результаты записываются в БД networks.db.

Использование:
    python calculate_metrics.py                  # 4 процесса по умолчанию
    python calculate_metrics.py -w 8             # 8 процессов
    python calculate_metrics.py --sequential     # 1 процесс (для отладки)
    python calculate_metrics.py --limit 100      # обработать только 100 сетей
"""

import os
import sys
import json
import sqlite3
import time
import argparse
import logging
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed

import numpy as np

try:
    import networkx as nx
except ImportError:
    print("ОШИБКА: Не установлен networkx. Установите: pip install networkx")
    sys.exit(1)

try:
    from tqdm import tqdm
except ImportError:
    print("ОШИБКА: Не установлен tqdm. Установите: pip install tqdm")
    sys.exit(1)


# ==========================================
# Настройка логирования
# ==========================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)


# ==========================================
# Константы
# ==========================================
DB_PATH = 'data/networks.db'
NETWORKS_DIR = 'data/networks'

# Характеристики, которые будем рассчитывать
METRICS_TO_CALCULATE = ['avg_link_length', 'avg_degree', 'clustering_coef']


# ==========================================
# Worker-функция (выполняется в отдельном процессе)
# ==========================================
def calculate_network_metrics(args: tuple) -> dict:
    """
    Рассчитывает три характеристики для одной сети.
    
    Args:
        args: кортеж (network_id, networks_dir)
    
    Returns:
        dict с network_id, тремя характеристиками и статусом
    """
    network_id, networks_dir = args
    
    try:
        # Загрузка топологии из JSON
        json_path = os.path.join(networks_dir, f'{network_id}.json')
        if not os.path.exists(json_path):
            return {
                'network_id': network_id,
                'status': 'error',
                'error': 'Файл топологии не найден'
            }
        
        with open(json_path, 'r', encoding='utf-8') as f:
            topology = json.load(f)
        
        nodes = topology.get('nodes', [])
        links = topology.get('links', [])
        N = len(nodes)
        
        if N == 0:
            return {
                'network_id': network_id,
                'status': 'error',
                'error': 'Пустая сеть'
            }
        
        # === 1. Средняя длина связи (через numpy, быстро) ===
        avg_link_length = 0.0
        if len(links) > 0:
            nodes_arr = np.array(nodes)
            links_arr = np.array(links)
            # Фильтруем некорректные связи
            valid_mask = (
                (links_arr[:, 0] >= 0) & (links_arr[:, 0] < N) &
                (links_arr[:, 1] >= 0) & (links_arr[:, 1] < N)
            )
            valid_links = links_arr[valid_mask]
            if len(valid_links) > 0:
                lengths = np.linalg.norm(
                    nodes_arr[valid_links[:, 0]] - nodes_arr[valid_links[:, 1]],
                    axis=1
                )
                avg_link_length = float(np.mean(lengths))
        
        # === 2. Средняя степень и кластеризация (через networkx) ===
        # Создаём граф один раз, используем для обеих метрик
        G = nx.Graph()
        G.add_nodes_from(range(N))
        for u, v in links:
            if 0 <= u < N and 0 <= v < N and u != v:
                G.add_edge(u, v)
        
        # Средняя степень
        degrees = [d for _, d in G.degree()]
        avg_degree = float(np.mean(degrees)) if degrees else 0.0
        
        # Коэффициент кластеризации
        clustering_coef = float(nx.average_clustering(G))
        
        return {
            'network_id': network_id,
            'status': 'ok',
            'avg_link_length': avg_link_length,
            'avg_degree': avg_degree,
            'clustering_coef': clustering_coef,
        }
    
    except Exception as e:
        return {
            'network_id': network_id,
            'status': 'error',
            'error': str(e)
        }


# ==========================================
# Получение списка сетей для обработки
# ==========================================
def get_networks_to_process(db_path: str, limit: int = None) -> list:
    """
    Возвращает список ID сетей, у которых хотя бы одна из трёх
    характеристик равна NULL.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    
    conditions = ' OR '.join([f'{m} IS NULL' for m in METRICS_TO_CALCULATE])
    query = f'SELECT id FROM networks WHERE {conditions} ORDER BY id'
    
    if limit:
        query += f' LIMIT {limit}'
    
    rows = conn.execute(query).fetchall()
    conn.close()
    
    return [row[0] for row in rows]


# ==========================================
# Обновление БД
# ==========================================
def update_database(db_path: str, results: list) -> dict:
    """
    Записывает результаты расчётов в БД.
    Возвращает статистику обновлений.
    """
    conn = sqlite3.connect(db_path)
    
    updated = 0
    errors = 0
    
    for result in results:
        if result['status'] != 'ok':
            continue
        
        try:
            conn.execute(
                '''UPDATE networks 
                   SET avg_link_length = ?, 
                       avg_degree = ?, 
                       clustering_coef = ?
                   WHERE id = ?''',
                (
                    result['avg_link_length'],
                    result['avg_degree'],
                    result['clustering_coef'],
                    result['network_id']
                )
            )
            updated += 1
        except Exception as e:
            logger.error(f"Ошибка обновления ID={result['network_id']}: {e}")
            errors += 1
    
    conn.commit()
    conn.close()
    
    return {'updated': updated, 'errors': errors}


# ==========================================
# Главная функция
# ==========================================
def main():
    parser = argparse.ArgumentParser(
        description='Многопоточный расчёт характеристик сетей'
    )
    parser.add_argument(
        '-w', '--workers',
        type=int,
        default=4,
        help='Количество процессов (по умолчанию: 4)'
    )
    parser.add_argument(
        '--sequential',
        action='store_true',
        help='Последовательный режим (1 процесс)'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=None,
        help='Ограничить количество обрабатываемых сетей'
    )
    parser.add_argument(
        '--db',
        type=str,
        default=DB_PATH,
        help=f'Путь к БД (по умолчанию: {DB_PATH})'
    )
    
    args = parser.parse_args()
    workers = 1 if args.sequential else args.workers
    
    logger.info("=" * 70)
    logger.info("  РАСЧЁТ ХАРАКТЕРИСТИК СЕТЕЙ")
    logger.info("=" * 70)
    logger.info(f"  Процессов: {workers}")
    logger.info(f"  База данных: {args.db}")
    logger.info(f"  Характеристики: {', '.join(METRICS_TO_CALCULATE)}")
    logger.info("=" * 70)
    
    # Проверка существования БД
    if not os.path.exists(args.db):
        logger.error(f"База данных не найдена: {args.db}")
        sys.exit(1)
    
    # Проверка существования папки с топологиями
    if not os.path.exists(NETWORKS_DIR):
        logger.error(f"Папка с топологиями не найдена: {NETWORKS_DIR}")
        sys.exit(1)
    
    # Получение списка сетей для обработки
    logger.info("\n[1/3] Поиск сетей для обработки...")
    network_ids = get_networks_to_process(args.db, args.limit)
    
    if not network_ids:
        logger.info("✓ Все сети уже рассчитаны. Нечего делать.")
        return
    
    logger.info(f"  Найдено сетей для обработки: {len(network_ids)}")
    if args.limit:
        logger.info(f"  (ограничение: {args.limit})")
    
    # Формирование задач
    tasks = [(net_id, NETWORKS_DIR) for net_id in network_ids]
    
    # Обработка
    logger.info(f"\n[2/3] Расчёт характеристик ({workers} процессов)...")
    start_time = time.time()
    
    results = []
    errors_count = 0
    
    try:
        with ProcessPoolExecutor(max_workers=workers) as executor:
            # Отправляем задачи
            futures = {
                executor.submit(calculate_network_metrics, task): task[0]
                for task in tasks
            }
            
            # Обрабатываем результаты с прогресс-баром
            with tqdm(total=len(tasks), desc="Расчёт", unit="сеть",
                     bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt} '
                               '[{elapsed}<{remaining}, {rate_fmt}]') as pbar:
                
                for future in as_completed(futures):
                    result = future.result()
                    results.append(result)
                    
                    if result['status'] != 'ok':
                        errors_count += 1
                        if errors_count <= 5:
                            logger.warning(
                                f"Ошибка для ID={result['network_id']}: "
                                f"{result.get('error', 'неизвестно')}"
                            )
                    
                    pbar.update(1)
    
    except KeyboardInterrupt:
        logger.warning("\n⚠ Прервано пользователем. Сохраняем уже рассчитанные...")
    
    elapsed = time.time() - start_time
    
    # Статистика расчёта
    ok_count = sum(1 for r in results if r['status'] == 'ok')
    logger.info(f"\n  ✓ Расчёт завершён за {elapsed:.1f} сек")
    logger.info(f"  ✓ Успешно рассчитано: {ok_count}")
    logger.info(f"  ✗ Ошибок: {errors_count}")
    if ok_count > 0:
        logger.info(f"  ⚡ Скорость: {ok_count / elapsed:.1f} сетей/сек")
    
    if not ok_count:
        logger.warning("Нет результатов для записи в БД.")
        return
    
    # Запись в БД
    logger.info(f"\n[3/3] Запись результатов в БД...")
    update_stats = update_database(args.db, results)
    
    logger.info(f"  ✓ Обновлено записей: {update_stats['updated']}")
    if update_stats['errors'] > 0:
        logger.warning(f"  ✗ Ошибок обновления: {update_stats['errors']}")
    
    # Итог
    total_elapsed = time.time() - start_time
    logger.info("\n" + "=" * 70)
    logger.info("  ГОТОВО!")
    logger.info("=" * 70)
    logger.info(f"  Всего обработано: {ok_count} сетей")
    logger.info(f"  Общее время: {total_elapsed:.1f} сек")
    logger.info(f"  База данных обновлена: {args.db}")
    logger.info("=" * 70)


if __name__ == '__main__':
    # Важно для Windows: защита entry point для multiprocessing
    if sys.platform == 'win32':
        import multiprocessing
        multiprocessing.freeze_support()
    
    main()