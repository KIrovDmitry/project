import sqlite3
import json
import os
from datetime import datetime
from contextlib import contextmanager
import csv
from collections import defaultdict

DB_PATH = 'data/networks.db'
NETWORKS_DIR = 'data/networks'

os.makedirs(NETWORKS_DIR, exist_ok=True)
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS networks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                N INTEGER,
                C REAL,
                alpha REAL,
                lambda REAL,
                space_type TEXT,
                distribution_type TEXT,
                nodes_count INTEGER,
                links_count INTEGER,
                model_type TEXT DEFAULT 'lpn',
                er_p REAL,
                ba_m INTEGER,
                created_at TEXT,
                m_phys INTEGER,
                m_max INTEGER,
                l_total REAL,
                node_link_int INTEGER DEFAULT 1,
                nodes_as_points INTEGER DEFAULT 1,
                avg_link_length REAL,
                avg_degree REAL,
                avg_path_length REAL,
                diameter REAL,
                clustering_coef REAL,
                straightness REAL,
                closeness REAL,
                efficiency REAL,
                info_significance REAL,
                connected_components REAL
            )
        ''')
        
        # Добавляем колонки в существующую БД, если их нет
        for col_sql in [
            'ALTER TABLE networks ADD COLUMN m_phys INTEGER',
            'ALTER TABLE networks ADD COLUMN m_max INTEGER',
            'ALTER TABLE networks ADD COLUMN l_total REAL',
            'ALTER TABLE networks ADD COLUMN node_link_int INTEGER DEFAULT 1',
            'ALTER TABLE networks ADD COLUMN nodes_as_points INTEGER DEFAULT 1',
        ]:
            try:
                conn.execute(col_sql)
            except Exception:
                pass
        
        conn.execute('''
            CREATE TABLE IF NOT EXISTS experiments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                N INTEGER,
                lambdas TEXT,
                spaces TEXT,
                distributions TEXT,
                repetitions INTEGER,
                results TEXT,
                created_at TEXT
            )
        ''')
        conn.commit()


def create_network(data: dict) -> int:
    with get_db() as conn:
        cursor = conn.execute('''
            INSERT INTO networks (
                name, N, C, alpha, lambda, space_type, distribution_type,
                nodes_count, links_count, model_type, er_p, ba_m, created_at,
                m_phys, m_max, l_total, node_link_int, nodes_as_points
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data['name'], data['N'], data.get('C'), data.get('alpha'),
            data.get('lambda'), data['space_type'], data['distribution_type'],
            data['nodes_count'], data['links_count'],
            data.get('model_type', 'lpn'), data.get('er_p'), data.get('ba_m'),
            datetime.now().isoformat(),
            data.get('m_phys'), data.get('m_max'), data.get('l_total'),
            int(data.get('node_link_int', True)),
            int(data.get('nodes_as_points', True))
        ))
        conn.commit()
        return cursor.lastrowid


def save_network_topology(network_id: int, nodes: list, links: list):
    path = os.path.join(NETWORKS_DIR, f'{network_id}.json')
    with open(path, 'w') as f:
        json.dump({'nodes': nodes, 'links': links}, f)


def load_network_topology(network_id: int):
    path = os.path.join(NETWORKS_DIR, f'{network_id}.json')
    if not os.path.exists(path):
        return None
    with open(path, 'r') as f:
        return json.load(f)


def get_all_networks():
    with get_db() as conn:
        rows = conn.execute('SELECT * FROM networks ORDER BY id DESC').fetchall()
        result = []
        for row in rows:
            net = dict(row)
            net['characteristics'] = {
                'avg_link_length': net.pop('avg_link_length', None),
                'avg_degree': net.pop('avg_degree', None),
                'avg_path_length': net.pop('avg_path_length', None),
                'diameter': net.pop('diameter', None),
                'clustering_coef': net.pop('clustering_coef', None),
                'straightness': net.pop('straightness', None),
                'closeness': net.pop('closeness', None),
                'efficiency': net.pop('efficiency', None),
                'info_significance': net.pop('info_significance', None),
                'connected_components': net.pop('connected_components', None),
            }
            result.append(net)
        return result


def get_network_by_id(network_id: int):
    with get_db() as conn:
        row = conn.execute('SELECT * FROM networks WHERE id = ?', (network_id,)).fetchone()
        if not row:
            return None
        net = dict(row)
        net['characteristics'] = {
            'avg_link_length': net.pop('avg_link_length', None),
            'avg_degree': net.pop('avg_degree', None),
            'avg_path_length': net.pop('avg_path_length', None),
            'diameter': net.pop('diameter', None),
            'clustering_coef': net.pop('clustering_coef', None),
            'straightness': net.pop('straightness', None),
            'closeness': net.pop('closeness', None),
            'efficiency': net.pop('efficiency', None),
            'info_significance': net.pop('info_significance', None),
            'connected_components': net.pop('connected_components', None),
        }
        return net


def update_characteristics(network_id: int, characteristics: dict):
    with get_db() as conn:
        set_clause = ', '.join([f'{k} = ?' for k in characteristics.keys()])
        values = list(characteristics.values()) + [network_id]
        conn.execute(f'UPDATE networks SET {set_clause} WHERE id = ?', values)
        conn.commit()


def delete_network(network_id: int):
    with get_db() as conn:
        conn.execute('DELETE FROM networks WHERE id = ?', (network_id,))
        conn.commit()
    path = os.path.join(NETWORKS_DIR, f'{network_id}.json')
    if os.path.exists(path):
        os.remove(path)


def find_duplicate_network(params: dict):
    """Ищет сеть с точно такими же параметрами (для проверки дубликатов)."""
    with get_db() as conn:
        query = 'SELECT * FROM networks WHERE N = ? AND model_type = ?'
        values = [params['N'], params.get('model_type', 'lpn')]
        
        if params.get('model_type', 'lpn') == 'lpn':
            query += ' AND space_type = ? AND distribution_type = ?'
            values.extend([params['space_type'], params['distribution_type']])
            if params.get('lambda') is not None:
                query += ' AND ABS(lambda - ?) < 1e-5'
                values.append(params['lambda'])
            # Учитываем физические ограничения
            if 'node_link_int' in params:
                query += ' AND node_link_int = ?'
                values.append(int(params['node_link_int']))
            if 'nodes_as_points' in params:
                query += ' AND nodes_as_points = ?'
                values.append(int(params['nodes_as_points']))
        elif params.get('model_type') == 'er':
            query += ' AND ABS(er_p - ?) < 1e-5'
            values.append(params['er_p'])
        elif params.get('model_type') == 'ba':
            query += ' AND ba_m = ?'
            values.append(params['ba_m'])
        
        return conn.execute(query, values).fetchone()


def count_existing_networks(params: dict) -> int:
    """Считает количество сетей с заданными параметрами в БД."""
    with get_db() as conn:
        query = 'SELECT COUNT(*) FROM networks WHERE N = ? AND model_type = ?'
        values = [params['N'], params.get('model_type', 'lpn')]
        
        if params.get('model_type', 'lpn') == 'lpn':
            query += ' AND space_type = ? AND distribution_type = ?'
            values.extend([params['space_type'], params['distribution_type']])
            if params.get('lambda') is not None:
                query += ' AND ABS(lambda - ?) < 1e-5'
                values.append(params['lambda'])
            if 'node_link_int' in params:
                query += ' AND node_link_int = ?'
                values.append(int(params['node_link_int']))
            if 'nodes_as_points' in params:
                query += ' AND nodes_as_points = ?'
                values.append(int(params['nodes_as_points']))
        elif params.get('model_type') == 'er':
            query += ' AND ABS(er_p - ?) < 1e-5'
            values.append(params['er_p'])
        elif params.get('model_type') == 'ba':
            query += ' AND ba_m = ?'
            values.append(params['ba_m'])
        
        row = conn.execute(query, values).fetchone()
        return row[0] if row else 0


def create_experiment(data: dict) -> int:
    with get_db() as conn:
        cursor = conn.execute('''
            INSERT INTO experiments (name, N, lambdas, spaces, distributions, repetitions, results, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data['name'], data['N'],
            json.dumps(data['lambdas']),
            json.dumps(data['spaces']),
            json.dumps(data['distributions']),
            data['repetitions'],
            json.dumps(data['results']),
            datetime.now().isoformat()
        ))
        conn.commit()
        return cursor.lastrowid


def get_all_experiments():
    with get_db() as conn:
        rows = conn.execute('SELECT * FROM experiments ORDER BY id DESC').fetchall()
        result = []
        for row in rows:
            exp = dict(row)
            exp['lambdas'] = json.loads(exp['lambdas'])
            exp['spaces'] = json.loads(exp['spaces'])
            exp['distributions'] = json.loads(exp['distributions'])
            exp['results'] = json.loads(exp['results'])
            result.append(exp)
        return result


def get_unanalyzed_networks(characteristics: list):
    with get_db() as conn:
        conditions = ' OR '.join([f'{c} IS NULL' for c in characteristics])
        query = f'SELECT * FROM networks WHERE {conditions}'
        rows = conn.execute(query).fetchall()
        result = []
        for row in rows:
            net = dict(row)
            net['characteristics'] = {
                'avg_link_length': net.pop('avg_link_length', None),
                'avg_degree': net.pop('avg_degree', None),
                'avg_path_length': net.pop('avg_path_length', None),
                'diameter': net.pop('diameter', None),
                'clustering_coef': net.pop('clustering_coef', None),
                'straightness': net.pop('straightness', None),
                'closeness': net.pop('closeness', None),
                'efficiency': net.pop('efficiency', None),
                'info_significance': net.pop('info_significance', None),
                'connected_components': net.pop('connected_components', None),
            }
            result.append(net)
        return result


def get_grouped_statistics():
    """
    Группирует сети по (N, alpha, lambda, distribution_type) и вычисляет
    среднее, минимальное и максимальное значение для каждой характеристики.
    """
    with get_db() as conn:
        rows = conn.execute('''
            SELECT N, C, alpha, lambda, space_type, distribution_type, model_type,
                   avg_link_length, avg_degree, avg_path_length, diameter,
                   clustering_coef, straightness, closeness, efficiency,
                   info_significance, connected_components
            FROM networks
            WHERE model_type = 'lpn'
              AND avg_link_length IS NOT NULL
            ORDER BY N, alpha, lambda, distribution_type
        ''').fetchall()
    
    characteristics_keys = [
        'avg_link_length', 'avg_degree', 'avg_path_length', 'diameter',
        'clustering_coef', 'straightness', 'closeness', 'efficiency',
        'info_significance', 'connected_components'
    ]
    
    groups = defaultdict(list)
    for row in rows:
        row = dict(row)
        key = (row['N'], row['alpha'], row['lambda'], row['distribution_type'])
        groups[key].append(row)
    
    result = []
    for key, networks in groups.items():
        N, alpha, lambda_val, dist_type = key
        space_type = networks[0]['space_type']
        count = len(networks)
        
        stats = {
            'N': N,
            'C': networks[0]['C'],
            'alpha': alpha,
            'lambda': lambda_val,
            'space_type': space_type,
            'distribution_type': dist_type,
            'count': count,
        }
        
        for char_key in characteristics_keys:
            values = [n[char_key] for n in networks if n[char_key] is not None]
            if values:
                stats[f'{char_key}_mean'] = sum(values) / len(values)
                stats[f'{char_key}_min'] = min(values)
                stats[f'{char_key}_max'] = max(values)
            else:
                stats[f'{char_key}_mean'] = None
                stats[f'{char_key}_min'] = None
                stats[f'{char_key}_max'] = None
        
        result.append(stats)
    
    return result


def export_statistics_to_csv(filepath: str) -> int:
    """
    Экспортирует сгруппированную статистику в CSV файл.
    Возвращает количество записей.
    """
    stats = get_grouped_statistics()
    if not stats:
        return 0
    
    characteristics_keys = [
        'avg_link_length', 'avg_degree', 'avg_path_length', 'diameter',
        'clustering_coef', 'straightness', 'closeness', 'efficiency',
        'info_significance', 'connected_components'
    ]
    
    headers = ['N', 'C', 'alpha', 'lambda', 'space_type', 'distribution_type', 'count']
    for char_key in characteristics_keys:
        headers.extend([
            f'{char_key}_mean',
            f'{char_key}_min',
            f'{char_key}_max'
        ])
    
    os.makedirs(os.path.dirname(filepath) if os.path.dirname(filepath) else '.', exist_ok=True)
    
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        for row in stats:
            formatted_row = {}
            for key, value in row.items():
                if isinstance(value, float):
                    formatted_row[key] = round(value, 6)
                else:
                    formatted_row[key] = value
            writer.writerow(formatted_row)
    
    return len(stats)