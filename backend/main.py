from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager
import json
import asyncio
import numpy as np
import logging
import os
import sys
from datetime import datetime

# Импорт из локальных модулей
from database import (
    init_db, create_network, save_network_topology, load_network_topology,
    get_all_networks, get_network_by_id, update_characteristics, delete_network,
    find_duplicate_network, count_existing_networks, create_experiment, 
    get_all_experiments, get_unanalyzed_networks, export_statistics_to_csv
)
from lpn_generator import generate_lpn
from networkx_models import generate_er, generate_ba
from analyzer import analyze_network
from experiment_runner import run_experiment

# ==========================================
# Настройка логирования автогенерации
# ==========================================
AUTOGEN_LOG_FILE = 'data/autogen.log'
os.makedirs('data', exist_ok=True)

autogen_logger = logging.getLogger('autogen')
autogen_logger.setLevel(logging.INFO)
file_handler = logging.FileHandler(AUTOGEN_LOG_FILE, encoding='utf-8')
file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
autogen_logger.addHandler(file_handler)

console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
autogen_logger.addHandler(console_handler)


# ==========================================
# Lifespan с автогенерацией
# ==========================================
auto_gen_task = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global auto_gen_task
    init_db()
    autogen_logger.info("=" * 60)
    autogen_logger.info("Сервер запущен. Инициализация автогенерации сетей...")
    autogen_logger.info("=" * 60)
    
    # Запускаем автогенерацию в фоне
    auto_gen_task = asyncio.create_task(auto_generate_networks())
    
    yield
    
    # При остановке сервера отменяем задачу
    if auto_gen_task and not auto_gen_task.done():
        auto_gen_task.cancel()
        try:
            await auto_gen_task
        except asyncio.CancelledError:
            autogen_logger.info("Автогенерация остановлена.")


app = FastAPI(title="LPN Research Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# АВТОГЕНЕРАЦИЯ СЕТЕЙ
# ==========================================
AUTOGEN_PARAMS = {
    'N_range': None,      # 14 значений
    'C': 1.0,
    'alphas': [0.35, 0.5, 1.0],            # 3 значения
    'space_type': 'cube',
    'distributions': ['random'],
    'repetitions': 200,
    # Перебор всех 4 комбинаций физических ограничений
    'physical_constraints': [
        {'node_link_int': True, 'nodes_as_points': False},  # связь-связь + вершина-вершина
    ],
}


async def auto_generate_networks():
    """Фоновая задача: генерирует множество сетей с заданными параметрами."""
    await asyncio.sleep(2)
    
    params = AUTOGEN_PARAMS
    N_values = list(params['N_range'])
    alphas = params['alphas']
    distributions = params['distributions']
    target_repetitions = params['repetitions']
    C = params['C']
    physical_constraints = params['physical_constraints']
    
    total_combinations = (
        len(N_values) * len(alphas) * len(distributions) * len(physical_constraints)
    )
    total_planned = total_combinations * target_repetitions
    
    autogen_logger.info("=" * 60)
    autogen_logger.info(f"Планируется генерация:")
    autogen_logger.info(f"  N: {len(N_values)} значений")
    autogen_logger.info(f"  α: {len(alphas)} значений")
    autogen_logger.info(f"  Распределения: {len(distributions)}")
    autogen_logger.info(f"  Физ. ограничения: {len(physical_constraints)}")
    autogen_logger.info(f"  Повторений: {target_repetitions}")
    autogen_logger.info(f"  ИТОГО задач: {total_planned}")
    autogen_logger.info("=" * 60)
    
    generated = 0
    skipped = 0
    errors = 0
    
    for N in N_values:
        for alpha in alphas:
            lambda_val = C / (N ** alpha)
            
            for dist_type in distributions:
                for pc in physical_constraints:
                    node_link_int = pc['node_link_int']
                    nodes_as_points = pc['nodes_as_points']
                    
                    # Считаем, сколько уже есть таких сетей
                    existing_count = count_existing_networks({
                        'N': N,
                        'model_type': 'lpn',
                        'space_type': params['space_type'],
                        'distribution_type': dist_type,
                        'lambda': lambda_val,
                        'node_link_int': node_link_int,
                        'nodes_as_points': nodes_as_points,
                    })
                    
                    remaining = max(0, target_repetitions - existing_count)
                    
                    if remaining == 0:
                        skipped += target_repetitions
                        continue
                    
                    if existing_count > 0:
                        autogen_logger.info(
                            f"Найдено {existing_count} существующих сетей для "
                            f"N={N}, α={alpha}, λ={lambda_val:.6f}, {dist_type}, "
                            f"nl={node_link_int}, np={nodes_as_points}. "
                            f"Осталось сгенерировать: {remaining}"
                        )
                    
                    for rep in range(remaining):
                        try:
                            if asyncio.current_task().cancelled():
                                return
                            
                            points, links, time_added, m_phys, m_max, l_total = generate_lpn(
                                N=N,
                                lambda_val=lambda_val,
                                space_type=params['space_type'],
                                distribution_type=dist_type,
                                node_link_int=node_link_int,
                                nodes_as_points=nodes_as_points,
                            )
                            
                            pc_short = f"nl{int(node_link_int)}np{int(nodes_as_points)}"
                            net_name = (
                                f"AUTOGEN N={N} α={alpha} {dist_type} "
                                f"{pc_short} rep={existing_count + rep + 1}"
                            )
                            
                            net_data = {
                                'name': net_name,
                                'N': N,
                                'C': C,
                                'alpha': alpha,
                                'lambda': lambda_val,
                                'space_type': params['space_type'],
                                'distribution_type': dist_type,
                                'nodes_count': len(points),
                                'links_count': len(links),
                                'model_type': 'lpn',
                                'm_phys': m_phys,
                                'm_max': m_max,
                                'l_total': l_total,
                                'node_link_int': node_link_int,
                                'nodes_as_points': nodes_as_points,
                            }
                            
                            network_id = create_network(net_data)
                            save_network_topology(network_id, points, links)
                            
                            generated += 1
                            
                            if generated % 10 == 0:
                                autogen_logger.info(
                                    f"[СЕТЬ #{generated}] ID={network_id}: {net_name}, "
                                    f"M_max={m_max}, M_phys={m_phys}"
                                )
                            
                            if generated % 50 == 0:
                                await asyncio.sleep(0)
                                
                        except asyncio.CancelledError:
                            raise
                        except Exception as e:
                            errors += 1
                            autogen_logger.error(
                                f"[ОШИБКА] N={N}, α={alpha}, λ={lambda_val:.6f}, "
                                f"{dist_type}, pc={pc_short}, rep={rep+1}: {str(e)}"
                            )
    
    autogen_logger.info("=" * 60)
    autogen_logger.info(f"АВТОГЕНЕРАЦИЯ ЗАВЕРШЕНА!")
    autogen_logger.info(f"Создано: {generated}, Пропущено: {skipped}, Ошибок: {errors}")
    autogen_logger.info("=" * 60)


# ==========================================
# Pydantic модели запросов
# ==========================================
class GenerateRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    
    name: str = 'id = n'
    model_type: str = 'lpn'
    N: int = 300
    C: float = 1.0
    alpha: float = 0.5
    lambda_val: float = 0.05
    input_mode: str = 'lambda'
    space_type: str = 'cube'
    distribution_type: str = 'random'
    node_link_int: bool = True
    nodes_as_points: bool = True
    count: int = 1
    threads: int = 8
    range_enabled: bool = False
    n_from: int = 100
    n_to: int = 300
    n_step: int = 100
    param_from: float = 0.1
    param_to: float = 0.2
    param_step: float = 0.05
    c_from: float = 0.1
    c_to: float = 1.0
    c_step: float = 0.1
    lambda_from: float = 0.01
    lambda_to: float = 0.1
    lambda_step: float = 0.01
    er_p_from: float = 0.01
    er_p_to: float = 0.1
    er_p_step: float = 0.01
    ba_m_from: int = 1
    ba_m_to: int = 10
    ba_m_step: int = 2
    alpha_from: float = 0.1
    alpha_to: float = 0.5
    alpha_step: float = 0.1
    spaces: List[str] = ['cube']
    distributions: List[str] = ['random']
    skip_existing: bool = False
    er_p: float = 0.05
    ba_m: int = 2


class AnalyzeRequest(BaseModel):
    network_ids: List[int]
    checkboxes: List[str]
    threads: int = 8


class ExperimentRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    
    name: str
    N: int
    lambdas: List[float]
    spaces: List[str]
    distributions: List[str]
    repetitions: int
    threads: int = 8
    node_link_int: bool = True
    nodes_as_points: bool = True
    model_types: List[str] = ['lpn']


class AveragedNetworkRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    
    name: str
    N: float
    C: Optional[float] = None
    alpha: Optional[float] = None
    lambda_val: Optional[float] = None
    space_type: str
    distribution_type: str
    model_type: str = 'lpn'
    er_p: Optional[float] = None
    ba_m: Optional[int] = None
    characteristics: Dict[str, Any]


# ==========================================
# API Endpoints
# ==========================================

@app.post("/api/generate")
async def generate_networks(request: GenerateRequest):
    async def event_stream():
        try:
            jobs = []
            
            if request.range_enabled:
                spaces = request.spaces if request.spaces else [request.space_type]
                distributions = request.distributions if request.distributions else [request.distribution_type]
                n_vals = list(range(request.n_from, request.n_to + 1, request.n_step))
                
                if request.model_type == 'lpn':
                    if request.input_mode == 'c_alpha':
                        p_vals, alpha_vals = [], []
                        p = request.c_from
                        while p <= request.c_to + 1e-9:
                            p_vals.append(round(p, 5)); p += request.c_step
                        a = request.alpha_from
                        while a <= request.alpha_to + 1e-9:
                            alpha_vals.append(round(a, 5)); a += request.alpha_step
                        
                        for sp in spaces:
                            for dt in distributions:
                                for n in n_vals:
                                    for p in p_vals:
                                        for al in alpha_vals:
                                            jobs.append({
                                                'N': n, 'model_type': 'lpn', 'space_type': sp,
                                                'distribution_type': dt, 'C': p, 'alpha': al,
                                                'lambda': p / (n ** al)
                                            })
                    else:
                        p_vals = []
                        p = request.lambda_from
                        while p <= request.lambda_to + 1e-9:
                            p_vals.append(round(p, 5)); p += request.lambda_step
                            
                        for sp in spaces:
                            for dt in distributions:
                                for n in n_vals:
                                    for p in p_vals:
                                        jobs.append({
                                            'N': n, 'model_type': 'lpn', 'space_type': sp,
                                            'distribution_type': dt, 'C': request.C,
                                            'alpha': request.alpha, 'lambda': p
                                        })
                elif request.model_type == 'er':
                    p_vals = []
                    p = request.er_p_from
                    while p <= request.er_p_to + 1e-9:
                        p_vals.append(round(p, 5)); p += request.er_p_step
                    for n in n_vals:
                        for p in p_vals:
                            jobs.append({
                                'N': n, 'model_type': 'er', 'space_type': 'cube',
                                'distribution_type': 'random', 'er_p': p
                            })
                elif request.model_type == 'ba':
                    p_vals = []
                    p = request.ba_m_from
                    while p <= request.ba_m_to:
                        p_vals.append(int(p)); p += request.ba_m_step
                    for n in n_vals:
                        for p in p_vals:
                            jobs.append({
                                'N': n, 'model_type': 'ba', 'space_type': 'cube',
                                'distribution_type': 'random', 'ba_m': p
                            })
            else:
                for i in range(request.count):
                    if request.model_type == 'lpn':
                        lam = request.C / (request.N ** request.alpha) if request.input_mode == 'c_alpha' else request.lambda_val
                        jobs.append({
                            'N': request.N, 'model_type': 'lpn', 'space_type': request.space_type,
                            'distribution_type': request.distribution_type, 'C': request.C,
                            'alpha': request.alpha, 'lambda': lam
                        })
                    elif request.model_type == 'er':
                        jobs.append({
                            'N': request.N, 'model_type': 'er', 'space_type': 'cube',
                            'distribution_type': 'random', 'er_p': request.er_p
                        })
                    elif request.model_type == 'ba':
                        jobs.append({
                            'N': request.N, 'model_type': 'ba', 'space_type': 'cube',
                            'distribution_type': 'random', 'ba_m': request.ba_m
                        })
            
            total = len(jobs)
            generated, skipped = 0, 0
            
            for idx, job in enumerate(jobs):
                if request.skip_existing:
                    duplicate = find_duplicate_network(job)
                    if duplicate:
                        skipped += 1
                        yield json.dumps({
                            'type': 'log',
                            'message': f"Пропуск дубликата: {job.get('name', 'N/A')} (ID={duplicate['id']})",
                            'index': idx,
                            'total': total
                        }) + '\n'
                        continue
                
                try:
                    m_phys, m_max, l_total = None, None, None
                    
                    if job['model_type'] == 'lpn':
                        points, links, time_added, m_phys, m_max, l_total = generate_lpn(
                            job['N'], job['lambda'], job['space_type'],
                            job['distribution_type'], request.node_link_int,
                            request.nodes_as_points
                        )
                    elif job['model_type'] == 'er':
                        points, links = generate_er(job['N'], job['er_p'])
                        m_max = len(links)
                        points_arr = np.array(points)
                        links_arr = np.array(links) if links else np.empty((0, 2))
                        l_total = float(np.sum(np.linalg.norm(
                            points_arr[links_arr[:, 0]] - points_arr[links_arr[:, 1]], axis=1
                        ))) if len(links_arr) > 0 else 0.0
                    elif job['model_type'] == 'ba':
                        points, links = generate_ba(job['N'], job['ba_m'])
                        m_max = len(links)
                        points_arr = np.array(points)
                        links_arr = np.array(links) if links else np.empty((0, 2))
                        l_total = float(np.sum(np.linalg.norm(
                            points_arr[links_arr[:, 0]] - points_arr[links_arr[:, 1]], axis=1
                        ))) if len(links_arr) > 0 else 0.0
                    
                    net_name = request.name
                    if net_name == 'id = n':
                        net_name = f"{job['model_type'].upper()} N={job['N']}"
                    
                    net_data = {
                        'name': net_name,
                        'N': job['N'],
                        'C': job.get('C'),
                        'alpha': job.get('alpha'),
                        'lambda': job.get('lambda'),
                        'space_type': job['space_type'],
                        'distribution_type': job['distribution_type'],
                        'nodes_count': len(points),
                        'links_count': len(links),
                        'model_type': job['model_type'],
                        'er_p': job.get('er_p'),
                        'ba_m': job.get('ba_m'),
                        'm_phys': m_phys,
                        'm_max': m_max,
                        'l_total': l_total,
                        'node_link_int': request.node_link_int,
                        'nodes_as_points': request.nodes_as_points,
                    }
                    
                    network_id = create_network(net_data)
                    save_network_topology(network_id, points, links)
                    
                    generated += 1
                    yield json.dumps({
                        'type': 'log',
                        'message': f"Сгенерирована сеть ID={network_id}: {net_name} (M_max={m_max}, M_phys={m_phys}, L_total={l_total:.4f})",
                        'index': idx,
                        'total': total
                    }) + '\n'
                except Exception as e:
                    yield json.dumps({
                        'type': 'log',
                        'message': f"Ошибка генерации: {str(e)}",
                        'index': idx,
                        'total': total
                    }) + '\n'
            
            yield json.dumps({
                'type': 'summary',
                'message': f"Генерация завершена. Создано: {generated}, Пропущено: {skipped}"
            }) + '\n'
        except Exception as e:
            yield json.dumps({
                'type': 'error',
                'message': f"Критическая ошибка: {str(e)}"
            }) + '\n'
    
    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@app.post("/api/analyze")
async def analyze_networks(request: AnalyzeRequest):
    async def event_stream():
        try:
            total = len(request.network_ids)
            for idx, network_id in enumerate(request.network_ids):
                net = get_network_by_id(network_id)
                if not net:
                    yield json.dumps({
                        'type': 'log',
                        'message': f"Сеть ID={network_id} не найдена",
                        'index': idx,
                        'total': total
                    }) + '\n'
                    continue
                
                topology = load_network_topology(network_id)
                if not topology:
                    yield json.dumps({
                        'type': 'log',
                        'message': f"Топология сети ID={network_id} не найдена",
                        'index': idx,
                        'total': total
                    }) + '\n'
                    continue
                
                yield json.dumps({
                    'type': 'progress',
                    'message': f"Анализ сети ID={network_id} ({idx+1}/{total})",
                    'index': idx,
                    'total': total
                }) + '\n'
                
                try:
                    characteristics = analyze_network(
                        topology['nodes'], topology['links'], request.checkboxes
                    )
                    update_characteristics(network_id, characteristics)
                    
                    yield json.dumps({
                        'type': 'log',
                        'message': f"Сеть ID={network_id} проанализирована",
                        'index': idx,
                        'total': total
                    }) + '\n'
                except Exception as e:
                    yield json.dumps({
                        'type': 'log',
                        'message': f"Ошибка анализа сети ID={network_id}: {str(e)}",
                        'index': idx,
                        'total': total
                    }) + '\n'
            
            yield json.dumps({
                'type': 'summary',
                'message': f"Анализ завершён. Обработано сетей: {total}"
            }) + '\n'
        except Exception as e:
            yield json.dumps({
                'type': 'error',
                'message': f"Ошибка анализа: {str(e)}"
            }) + '\n'
    
    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@app.post("/api/analyze-all-unanalyzed")
async def analyze_all_unanalyzed(
    checkboxes: List[str] = Query(...),
    threads: int = Query(8)
):
    async def event_stream():
        try:
            networks = get_unanalyzed_networks(checkboxes)
            total = len(networks)
            
            if total == 0:
                yield json.dumps({
                    'type': 'summary',
                    'message': "Все сети уже проанализированы для выбранных характеристик."
                }) + '\n'
                return
            
            for idx, net in enumerate(networks):
                network_id = net['id']
                topology = load_network_topology(network_id)
                
                if not topology:
                    yield json.dumps({
                        'type': 'log',
                        'message': f"Топология сети ID={network_id} не найдена, пропуск",
                        'index': idx,
                        'total': total
                    }) + '\n'
                    continue
                
                yield json.dumps({
                    'type': 'progress',
                    'message': f"Анализ сети ID={network_id} ({idx+1}/{total})",
                    'index': idx,
                    'total': total
                }) + '\n'
                
                try:
                    characteristics = analyze_network(
                        topology['nodes'], topology['links'], checkboxes
                    )
                    update_characteristics(network_id, characteristics)
                    
                    yield json.dumps({
                        'type': 'log',
                        'message': f"Сеть ID={network_id} проанализирована",
                        'index': idx,
                        'total': total
                    }) + '\n'
                except Exception as e:
                    yield json.dumps({
                        'type': 'log',
                        'message': f"Ошибка анализа сети ID={network_id}: {str(e)}",
                        'index': idx,
                        'total': total
                    }) + '\n'
            
            yield json.dumps({
                'type': 'summary',
                'message': f"Анализ завершён. Обработано сетей: {total}"
            }) + '\n'
        except Exception as e:
            yield json.dumps({
                'type': 'error',
                'message': f"Ошибка: {str(e)}"
            }) + '\n'
    
    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@app.post("/api/run_experiment")
async def run_experiment_endpoint(request: ExperimentRequest):
    async def event_stream():
        try:
            def progress_callback(current, total, message):
                pass
            
            loop = asyncio.get_running_loop()
            results = await loop.run_in_executor(
                None,
                run_experiment,
                request.N,
                request.lambdas,
                request.spaces,
                request.distributions,
                request.repetitions,
                request.model_types,
                request.node_link_int,
                request.nodes_as_points,
                progress_callback
            )
            
            exp_data = {
                'name': request.name,
                'N': request.N,
                'lambdas': request.lambdas,
                'spaces': request.spaces,
                'distributions': request.distributions,
                'repetitions': request.repetitions,
                'results': results
            }
            exp_id = create_experiment(exp_data)
            
            yield json.dumps({
                'type': 'success',
                'results': {**exp_data, 'id': exp_id}
            }) + '\n'
        except Exception as e:
            yield json.dumps({
                'type': 'error',
                'message': f"Ошибка эксперимента: {str(e)}"
            }) + '\n'
    
    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


@app.get("/api/networks")
async def list_networks():
    return get_all_networks()


@app.get("/api/networks/{network_id}/details")
async def get_network_details(network_id: int):
    topology = load_network_topology(network_id)
    if not topology:
        raise HTTPException(status_code=404, detail="Network topology not found")
    return topology


@app.delete("/api/networks/{network_id}")
async def delete_network_endpoint(network_id: int):
    delete_network(network_id)
    return {"status": "deleted"}


@app.get("/api/experiments")
async def list_experiments():
    return get_all_experiments()


@app.post("/api/networks/save-averaged")
async def save_averaged_network(request: AveragedNetworkRequest):
    net_data = {
        'name': request.name,
        'N': int(request.N),
        'C': request.C,
        'alpha': request.alpha,
        'lambda': request.lambda_val,
        'space_type': request.space_type,
        'distribution_type': request.distribution_type,
        'nodes_count': int(request.N),
        'links_count': 0,
        'model_type': request.model_type,
        'er_p': request.er_p,
        'ba_m': request.ba_m
    }
    network_id = create_network(net_data)
    save_network_topology(network_id, [], [])
    update_characteristics(network_id, request.characteristics)
    
    return {"id": network_id, "status": "created"}


# ==========================================
# НОВЫЕ ENDPOINTS: Экспорт CSV и статус автогенерации
# ==========================================

@app.get("/api/export-csv")
async def export_csv():
    """Экспортирует сгруппированную статистику в CSV файл."""
    try:
        filepath = 'data/statistics_export.csv'
        count = export_statistics_to_csv(filepath)
        
        if count == 0:
            raise HTTPException(
                status_code=404,
                detail="Нет данных для экспорта. Сначала рассчитайте свойства сетей."
            )
        
        return FileResponse(
            path=filepath,
            media_type='text/csv',
            filename=f'lpn_statistics_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv',
            headers={'Content-Disposition': f'attachment; filename="lpn_statistics_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка экспорта: {str(e)}")


@app.get("/api/autogen/status")
async def autogen_status():
    """Возвращает статус автогенерации и информацию из лога."""
    status = {
        'log_file': AUTOGEN_LOG_FILE,
        'params': {
            'N_range': list(AUTOGEN_PARAMS['N_range']),
            'C': AUTOGEN_PARAMS['C'],
            'alphas': AUTOGEN_PARAMS['alphas'],
            'space_type': AUTOGEN_PARAMS['space_type'],
            'distributions': AUTOGEN_PARAMS['distributions'],
            'repetitions': AUTOGEN_PARAMS['repetitions'],
            'physical_constraints': len(AUTOGEN_PARAMS['physical_constraints']),
        },
        'total_planned': (
            len(list(AUTOGEN_PARAMS['N_range'])) *
            len(AUTOGEN_PARAMS['alphas']) *
            len(AUTOGEN_PARAMS['distributions']) *
            len(AUTOGEN_PARAMS['physical_constraints']) *
            AUTOGEN_PARAMS['repetitions']
        ),
    }
    
    if os.path.exists(AUTOGEN_LOG_FILE):
        try:
            with open(AUTOGEN_LOG_FILE, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                status['last_log_lines'] = [l.strip() for l in lines[-20:]]
                status['log_size_lines'] = len(lines)
                
                created = sum(1 for l in lines if '[СЕТЬ #' in l)
                skipped_lines = [l for l in lines if 'Всего пропущено:' in l]
                errors = sum(1 for l in lines if '[ОШИБКА]' in l)
                
                status['created_count'] = created
                status['errors_count'] = errors
                
                if skipped_lines:
                    try:
                        status['skipped_count'] = int(skipped_lines[-1].split('Всего пропущено:')[1].strip())
                    except:
                        status['skipped_count'] = 0
                else:
                    status['skipped_count'] = 0
        except Exception as e:
            status['log_error'] = str(e)
    
    return status


# ==========================================
# Раздача статики фронтенда (для десктопного режима)
# ==========================================
if getattr(sys, 'frozen', False):
    STATIC_DIR = os.path.join(sys._MEIPASS, 'frontend_dist')
else:
    STATIC_DIR = os.path.join(os.path.dirname(__file__), 'frontend_dist')

if os.path.exists(STATIC_DIR):
    app.mount('/assets', StaticFiles(directory=os.path.join(STATIC_DIR, 'assets')), name='assets')
    
    @app.get('/')
    async def serve_index():
        return FileResponse(os.path.join(STATIC_DIR, 'index.html'))
    
    @app.get('/{full_path:path}')
    async def serve_spa(full_path: str):
        file_path = os.path.join(STATIC_DIR, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, 'index.html'))

# ==========================================
# Раздача статики фронтенда (для десктопного режима)
# ==========================================
if getattr(sys, 'frozen', False):
    STATIC_DIR = os.path.join(sys._MEIPASS, 'frontend_dist')
else:
    STATIC_DIR = os.path.join(os.path.dirname(__file__), 'frontend_dist')

if os.path.exists(STATIC_DIR):
    app.mount('/assets', StaticFiles(directory=os.path.join(STATIC_DIR, 'assets')), name='assets')
    
    @app.get('/')
    async def serve_index():
        return FileResponse(os.path.join(STATIC_DIR, 'index.html'))
    
    @app.get('/{full_path:path}')
    async def serve_spa(full_path: str):
        file_path = os.path.join(STATIC_DIR, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, 'index.html'))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)