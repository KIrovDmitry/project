import numpy as np
import networkx as nx
from typing import Dict, Optional


def analyze_network(nodes: list, links: list, characteristics: list) -> Dict[str, Optional[float]]:
    """
    Рассчитывает характеристики сети.
    
    КЛЮЧЕВОЕ УЛУЧШЕНИЕ: поддержка несвязных графов.
    - diameter и avg_path_length считаются по компонентам связности
    - closeness использует wf_improved=True для несвязных графов
    - Один проход BFS для нескольких метрик (ускорение)
    """
    result = {}
    N = len(nodes)
    
    if N == 0:
        return {c: None for c in characteristics}
    
    # === ПОСТРОЕНИЕ ГРАФА ===
    G = nx.Graph()
    G.add_nodes_from(range(N))
    for u, v in links:
        if 0 <= u < N and 0 <= v < N and u != v:
            G.add_edge(u, v)
    
    nodes_arr = np.array(nodes)
    links_arr = np.array(links) if len(links) > 0 else np.array([]).reshape(0, 2)
    
    # === БЫСТРЫЕ ХАРАКТЕРИСТИКИ ===
    
    if 'avg_link_length' in characteristics:
        if len(links_arr) > 0:
            valid_links = [(u, v) for u, v in links_arr if 0 <= u < N and 0 <= v < N]
            if valid_links:
                links_arr = np.array(valid_links)
                lengths = np.linalg.norm(
                    nodes_arr[links_arr[:, 0]] - nodes_arr[links_arr[:, 1]], axis=1
                )
                result['avg_link_length'] = float(np.mean(lengths))
            else:
                result['avg_link_length'] = 0.0
        else:
            result['avg_link_length'] = 0.0
    
    if 'avg_degree' in characteristics:
        degrees = [d for n, d in G.degree()]
        result['avg_degree'] = float(np.mean(degrees)) if degrees else 0.0
    
    if 'connected_components' in characteristics:
        result['connected_components'] = float(nx.number_connected_components(G))
    
    if 'clustering_coef' in characteristics:
        result['clustering_coef'] = float(nx.average_clustering(G))
    
    # === ХАРАКТЕРИСТИКИ, ТРЕБУЮЩИЕ КРАТЧАЙШИХ ПУТЕЙ ===
    # ОДИН проход BFS для avg_path_length, diameter, straightness
    
    need_paths = any(c in characteristics for c in [
        'avg_path_length', 'diameter', 'straightness'
    ])
    
    all_paths = None
    is_connected = nx.is_connected(G)
    
    if need_paths and N > 1:
        if is_connected:
            # Связный граф — один проход
            all_paths = dict(nx.all_pairs_shortest_path_length(G))
        else:
            # НЕСВЯЗНЫЙ граф — считаем по компонентам связности
            all_paths = {}
            for component in nx.connected_components(G):
                comp_list = list(component)
                if len(comp_list) > 1:
                    subgraph = G.subgraph(comp_list)
                    comp_paths = dict(nx.all_pairs_shortest_path_length(subgraph))
                    all_paths.update(comp_paths)
    
    # === СРЕДНЕЕ РАССТОЯНИЕ ===
    if 'avg_path_length' in characteristics:
        if all_paths and len(all_paths) > 0:
            total_length = 0
            count = 0
            for source in all_paths:
                for target, length in all_paths[source].items():
                    if source < target:
                        total_length += length
                        count += 1
            result['avg_path_length'] = float(total_length / count) if count > 0 else None
        else:
            result['avg_path_length'] = None
    
    # === ДИАМЕТР ===
    if 'diameter' in characteristics:
        if all_paths and len(all_paths) > 0:
            max_dist = 0
            for source in all_paths:
                for target, length in all_paths[source].items():
                    if length > max_dist:
                        max_dist = length
            result['diameter'] = float(max_dist)
        else:
            result['diameter'] = None
    
    # === БЛИЗОСТЬ (wf_improved=True для несвязных графов) ===
    if 'closeness' in characteristics:
        try:
            closeness = nx.closeness_centrality(G, wf_improved=True)
            result['closeness'] = float(np.mean(list(closeness.values())))
        except Exception:
            result['closeness'] = None
    
    # === ЭФФЕКТИВНОСТЬ (работает для несвязных графов) ===
    if 'efficiency' in characteristics:
        if N > 1:
            try:
                result['efficiency'] = float(nx.global_efficiency(G))
            except Exception:
                result['efficiency'] = None
        else:
            result['efficiency'] = None
    
    # === ПРЯМОЛИНЕЙНОСТЬ (через предвычисленные пути) ===
    if 'straightness' in characteristics:
        if all_paths and len(links_arr) > 0:
            straightness_vals = []
            for u, v in G.edges():
                if 0 <= u < N and 0 <= v < N:
                    geo_dist = np.linalg.norm(nodes_arr[u] - nodes_arr[v])
                    if geo_dist > 0 and u in all_paths and v in all_paths[u]:
                        path_length = all_paths[u][v]
                        straightness_vals.append(geo_dist / path_length)
            result['straightness'] = float(np.mean(straightness_vals)) if straightness_vals else 0.0
        else:
            result['straightness'] = None
    
    # === ИНФОРМАЦИОННАЯ ЗНАЧИМОСТЬ ===
    if 'info_significance' in characteristics:
        if N > 1:
            try:
                base_eff = nx.global_efficiency(G)
                significances = []
                for node in G.nodes():
                    G_temp = G.copy()
                    G_temp.remove_node(node)
                    if len(G_temp) > 1:
                        new_eff = nx.global_efficiency(G_temp)
                        significances.append(abs(base_eff - new_eff))
                    else:
                        significances.append(base_eff)
                result['info_significance'] = float(np.mean(significances))
            except Exception:
                result['info_significance'] = None
        else:
            result['info_significance'] = None
    
    for c in characteristics:
        if c not in result:
            result[c] = None
    
    return result