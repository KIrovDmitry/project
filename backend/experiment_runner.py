import numpy as np
from typing import List, Dict, Optional, Callable
from lpn_generator import generate_lpn
from networkx_models import generate_er, generate_ba


def run_experiment(
    N: int,
    lambdas: List[float],
    spaces: List[str],
    distributions: List[str],
    repetitions: int,
    model_types: Optional[List[str]] = None,
    node_link_int: bool = True,
    nodes_as_points: bool = True,
    progress_callback: Optional[Callable[[int, int, str], None]] = None
) -> List[Dict]:
    """
    Запуск серии экспериментов по генерации сетей с различными параметрами.
    
    Параметры:
        N: количество узлов в сети
        lambdas: список значений параметра физичности λ (для LPN) или p/m (для ER/BA)
        spaces: список типов пространств ('cube', 'sphere')
        distributions: список типов распределений узлов
        repetitions: количество повторений для каждого сочетания параметров
        model_types: список типов моделей ('lpn', 'er', 'ba')
        node_link_int: если True — проверяется пересечение связей с вершинами (связь-вершина)
        nodes_as_points: если True — вершины считаются точками без объёма
        progress_callback: функция обратного вызова для отслеживания прогресса
                            (current, total, message)
    
    Возвращает:
        Список словарей с результатами для каждого сочетания параметров
    """
    if model_types is None:
        model_types = ['lpn']
    
    results = []
    
    # Подсчёт общего количества задач для прогресс-бара
    total_tasks = 0
    for model_type in model_types:
        for space_type in spaces:
            for distribution_type in distributions:
                if model_type == 'lpn':
                    total_tasks += len(lambdas) * repetitions
                else:
                    total_tasks += len(lambdas) * repetitions
    
    current_task = 0
    
    for model_type in model_types:
        for space_type in spaces:
            for distribution_type in distributions:
                
                if model_type == 'lpn':
                    # Для LPN модели — перебираем значения λ
                    for lambda_val in lambdas:
                        m_phys_list = []
                        m_max_list = []
                        m_vs_length_edges = []
                        m_vs_length_values = []
                        
                        for rep in range(repetitions):
                            current_task += 1
                            
                            if progress_callback:
                                progress_callback(
                                    current_task,
                                    total_tasks,
                                    f"Генерация LPN λ={lambda_val:.5f} {distribution_type} "
                                    f"(повтор {rep + 1}/{repetitions})"
                                )
                            
                            try:
                                # Генерация LPN с учётом физических ограничений
                                points, links, time_added = generate_lpn(
                                    N=N,
                                    lambda_val=lambda_val,
                                    space_type=space_type,
                                    distribution_type=distribution_type,
                                    node_link_int=node_link_int,
                                    nodes_as_points=nodes_as_points
                                )
                                
                                # M_max — максимальное число добавленных связей
                                m_max = len(links)
                                m_max_list.append(m_max)
                                
                                # M_phys — число связей до момента, когда 1/6 кандидатов
                                # начинает отклоняться (критерий начала физичности)
                                if len(time_added) > 0:
                                    time_arr = np.array(time_added)
                                    # Находим момент, когда отклонение становится регулярным
                                    # (1.2 * номер попытки — порог, используемый в оригинальной статье)
                                    rejected_mask = time_arr >= 1.2 * np.arange(1, len(time_arr) + 1)
                                    # M_phys — число связей до первого регулярного отклонения
                                    if rejected_mask.any():
                                        first_reject_idx = np.argmax(rejected_mask)
                                        m_phys = first_reject_idx
                                    else:
                                        m_phys = len(time_arr)
                                else:
                                    m_phys = 0
                                m_phys_list.append(m_phys)
                                
                                # Расчёт средней длины связи по мере добавления рёбер
                                points_arr = np.array(points)
                                links_arr = np.array(links) if len(links) > 0 else np.array([]).reshape(0, 2)
                                
                                if len(links_arr) > 0:
                                    # Длины всех добавленных связей в порядке добавления
                                    lengths = np.linalg.norm(
                                        points_arr[links_arr[:, 0]] - points_arr[links_arr[:, 1]],
                                        axis=1
                                    )
                                    # Кумулятивная средняя длина
                                    cum_lengths = np.cumsum(lengths)
                                    edge_counts = np.arange(1, len(lengths) + 1)
                                    
                                    # Прореживание для графиков (не более 50 точек)
                                    step = max(1, len(lengths) // 50)
                                    indices = np.arange(0, len(lengths), step)
                                    if len(indices) == 0 or indices[-1] != len(lengths) - 1:
                                        indices = np.append(indices, len(lengths) - 1)
                                    
                                    m_vs_length_edges.extend(edge_counts[indices].tolist())
                                    m_vs_length_values.extend(
                                        (cum_lengths[indices] / edge_counts[indices]).tolist()
                                    )
                            
                            except Exception as e:
                                print(f"Ошибка при генерации LPN: {e}")
                                continue
                        
                        # Усреднение по всем повторам для каждого значения M
                        if m_vs_length_edges:
                            unique_edges = sorted(set(m_vs_length_edges))
                            avg_values = []
                            for e in unique_edges:
                                vals = [
                                    v for edge, v in zip(m_vs_length_edges, m_vs_length_values)
                                    if edge == e
                                ]
                                avg_values.append(np.mean(vals))
                            m_vs_length_edges = unique_edges
                            m_vs_length_values = avg_values
                        
                        results.append({
                            'lambda': lambda_val,
                            'space_type': space_type,
                            'distribution_type': distribution_type,
                            'model_type': model_type,
                            'm_phys_list': m_phys_list,
                            'm_max_list': m_max_list,
                            'm_phys_avg': float(np.mean(m_phys_list)) if m_phys_list else 0,
                            'm_max_avg': float(np.mean(m_max_list)) if m_max_list else 0,
                            'm_vs_length_edges': m_vs_length_edges,
                            'm_vs_length_values': m_vs_length_values,
                        })
                
                elif model_type == 'er':
                    # Для ER модели — перебираем значения вероятности p
                    for p in lambdas:
                        m_list = []
                        
                        for rep in range(repetitions):
                            current_task += 1
                            
                            if progress_callback:
                                progress_callback(
                                    current_task,
                                    total_tasks,
                                    f"Генерация ER p={p:.5f} "
                                    f"(повтор {rep + 1}/{repetitions})"
                                )
                            
                            try:
                                nodes, links = generate_er(N, p)
                                m_list.append(len(links))
                            except Exception as e:
                                print(f"Ошибка при генерации ER: {e}")
                                continue
                        
                        results.append({
                            'lambda': p,
                            'space_type': space_type,
                            'distribution_type': distribution_type,
                            'model_type': model_type,
                            'm_phys_list': m_list,
                            'm_max_list': m_list,
                            'm_phys_avg': float(np.mean(m_list)) if m_list else 0,
                            'm_max_avg': float(np.mean(m_list)) if m_list else 0,
                            'm_vs_length_edges': [],
                            'm_vs_length_values': [],
                        })
                
                elif model_type == 'ba':
                    # Для BA модели — перебираем значения m (число связей на новый узел)
                    for m in lambdas:
                        m_list = []
                        
                        for rep in range(repetitions):
                            current_task += 1
                            
                            if progress_callback:
                                progress_callback(
                                    current_task,
                                    total_tasks,
                                    f"Генерация BA m={int(m)} "
                                    f"(повтор {rep + 1}/{repetitions})"
                                )
                            
                            try:
                                nodes, links = generate_ba(N, int(m))
                                m_list.append(len(links))
                            except Exception as e:
                                print(f"Ошибка при генерации BA: {e}")
                                continue
                        
                        results.append({
                            'lambda': m,
                            'space_type': space_type,
                            'distribution_type': distribution_type,
                            'model_type': model_type,
                            'm_phys_list': m_list,
                            'm_max_list': m_list,
                            'm_phys_avg': float(np.mean(m_list)) if m_list else 0,
                            'm_max_avg': float(np.mean(m_list)) if m_list else 0,
                            'm_vs_length_edges': [],
                            'm_vs_length_values': [],
                        })
    
    return results