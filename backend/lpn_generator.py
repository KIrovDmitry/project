import sys
import os
import numpy as np

try:
    import randLPN_CPP
    CPP_AVAILABLE = True
except ImportError:
    CPP_AVAILABLE = False
    print("Warning: randLPN_CPP module not available.")

from distributions import generate_distribution


def generate_lpn(N: int, lambda_val: float, space_type: str, distribution_type: str,
                 node_link_int: bool = True, nodes_as_points: bool = True,
                 max_links: int = None):
    """
    Генерация LPN.
    Возвращает кортеж:
        (points, links, time_added, m_phys, m_max, l_total)
    """
    if not CPP_AVAILABLE:
        raise RuntimeError("C++ module not available")
    
    if max_links is None:
        max_links = N * (N - 1) // 2
    
    # Определяем флаги для C++ функции
    check_node_node = not nodes_as_points
    check_node_link = node_link_int
    
    # Генерируем точки с нужным распределением
    points = generate_distribution(distribution_type, N)
    
    # Если выбрано пространство "sphere", обрезаем точки
    if space_type == 'sphere':
        points_arr = np.array(points)
        center = np.array([0.5, 0.5, 0.5])
        radius = 0.5
        mask = np.linalg.norm(points_arr - center, axis=1) <= radius
        points_arr = points_arr[mask]
        points = points_arr.tolist()
        N = len(points)
    
    # Используем новую функцию с внешними точками
    result = randLPN_CPP.LinPhysER_general_with_points(
        max_links, lambda_val,
        points,
        int(check_node_node), int(check_node_link)
    )
    
    cpp_links, time_added = result
    
    points_arr = np.array(points)
    links = np.array(cpp_links) if len(cpp_links) > 0 else np.array([]).reshape(0, 2)
    time_added = np.array(time_added) if len(time_added) > 0 else np.array([])
    
    # === РАСЧЁТ M_max ===
    m_max = int(len(links))
    
    # === РАСЧЁТ M_phys ===
    # Критерий из статьи Pósfai et al.: момент, когда 1/6 кандидатов начинает отклоняться
    # M_phys = количество связей, для которых time_added[i] < 1.2 * (i+1)
    if len(time_added) > 0:
        indices = np.arange(1, len(time_added) + 1)
        # Считаем связи, добавленные до регулярного отклонения
        valid_mask = time_added < 1.2 * indices
        m_phys = int(np.sum(valid_mask))
    else:
        m_phys = 0
    
    # === РАСЧЁТ L_total ===
    if len(links) > 0:
        link_lengths = np.linalg.norm(
            points_arr[links[:, 0]] - points_arr[links[:, 1]],
            axis=1
        )
        l_total = float(np.sum(link_lengths))
    else:
        l_total = 0.0
    
    # Если выбрано пространство "sphere", фильтруем связи
    if space_type == 'sphere':
        valid_nodes = set(range(N))
        new_links = []
        new_time_added = []
        for i, (u, v) in enumerate(links):
            if u in valid_nodes and v in valid_nodes:
                new_links.append([int(u), int(v)])
                new_time_added.append(int(time_added[i]))
        links = np.array(new_links) if new_links else np.array([]).reshape(0, 2)
        time_added = np.array(new_time_added) if new_time_added else np.array([])
        # Пересчитываем m_max и l_total
        m_max = int(len(links))
        if len(links) > 0:
            link_lengths = np.linalg.norm(
                points_arr[links[:, 0]] - points_arr[links[:, 1]],
                axis=1
            )
            l_total = float(np.sum(link_lengths))
        else:
            l_total = 0.0
    
    return (
        points, 
        links.tolist(), 
        time_added.tolist() if len(time_added) > 0 else [],
        m_phys,
        m_max,
        l_total
    )