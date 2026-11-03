import React, { useState } from 'react';
import { Network } from '../types';
import { RefreshCw, Play, BarChart2, RotateCw } from 'lucide-react';
import { UnifiedProfilesManager } from './UnifiedProfilesManager';
import { CompareDegreeDistributions } from './CompareDegreeDistributions';
import { NetworkMetricsComparisonPlot } from './NetworkMetricsComparisonPlot';
import { InfoTooltip } from './InfoTooltip';

interface AnalyzerTabProps {
  networks: Network[];
  isLoading: boolean;
  onAnalyze: (networkIds: number[], checkboxes: string[], threads: number) => Promise<void>;
  onAnalyzeAllUnanalyzed: (checkboxes: string[], threads: number) => Promise<void>;
  progress?: { current: number; total: number; message: string } | null;
  onSaveAveragedCompleted?: () => Promise<void>;
}

export const NetworkAnalyzerTab: React.FC<AnalyzerTabProps> = ({
  networks,
  isLoading,
  onAnalyze,
  onAnalyzeAllUnanalyzed,
  progress,
  onSaveAveragedCompleted,
}) => {
  const [selectedNetId, setSelectedNetId] = useState<number | null>(
    networks.length > 0 ? networks[0].id : null
  );

  const [threads, setThreads] = useState<number>(16);

  const [profiles, setProfiles] = useState<any[]>(() => {
    const stored = localStorage.getItem('lpn_comparison_profiles_v1');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse comparison profiles', e);
      }
    }
    return [
      {
        id: 'prof-all-nets',
        name: 'Все сети в БД',
        color: '#4f46e5',
        enabled: true,
        selection_type: 'formula',
        space_type: 'all',
        distribution_type: 'all',
        lambdaVal: 'all',
        alphaVal: 'all',
        model_type: 'all',
        er_pVal: 'all',
        ba_mVal: 'all',
        selectedNetworkIds: [],
      },
      {
        id: 'prof-1',
        name: 'Единичный куб (Случайное)',
        color: '#3498db',
        enabled: true,
        selection_type: 'formula',
        space_type: 'cube',
        distribution_type: 'random',
        lambdaVal: 'all',
        alphaVal: 'all',
        model_type: 'all',
        er_pVal: 'all',
        ba_mVal: 'all',
        selectedNetworkIds: [],
      },
      {
        id: 'prof-2',
        name: 'Тетраэдр Серпинского',
        color: '#e74c3c',
        enabled: true,
        selection_type: 'formula',
        space_type: 'cube',
        distribution_type: 'fractal_tetrahedron',
        lambdaVal: 'all',
        alphaVal: 'all',
        model_type: 'all',
        er_pVal: 'all',
        ba_mVal: 'all',
        selectedNetworkIds: [],
      },
    ];
  });

  const [checkboxes, setCheckboxes] = useState<Record<string, boolean>>({
    avg_link_length: true,
    avg_degree: true,
    avg_path_length: true,
    diameter: true,
    clustering_coef: true,
    straightness: true,
    closeness: true,
    efficiency: true,
    info_significance: false,
    connected_components: true,
  });

  const activeNetwork = networks.find((n) => n.id === selectedNetId) || networks[0] || null;

  const [activeNetworkDetails, setActiveNetworkDetails] = useState<{ nodes: number[][]; links: number[][] } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  React.useEffect(() => {
    if (activeNetwork) {
      setLoadingDetails(true);
      fetch(`/api/networks/${activeNetwork.id}/details`)
        .then((r) => {
          if (!r.ok) throw new Error('Failed to load details');
          return r.json();
        })
        .then((data) => {
          setActiveNetworkDetails(data);
          setLoadingDetails(false);
        })
        .catch((err) => {
          console.error('Error in details fetch:', err);
          setActiveNetworkDetails(null);
          setLoadingDetails(false);
        });
    } else {
      setActiveNetworkDetails(null);
    }
  }, [selectedNetId, activeNetwork?.id]);

  const toggleCheckbox = (key: string) => {
    setCheckboxes((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const getSelectedKeys = () => {
    return Object.keys(checkboxes).filter((k) => checkboxes[k]);
  };

  const handleCalculateSingle = async () => {
    if (!activeNetwork) return;
    const selectedKeys = getSelectedKeys();
    if (selectedKeys.length === 0) {
      alert('Пожалуйста, выберите хотя бы один показатель для расчета.');
      return;
    }
    try {
      await onAnalyze([activeNetwork.id], selectedKeys, threads);
    } catch (err: any) {
      alert(err.message || 'Ошибка во время анализа.');
    }
  };

  const handleCalculateAllUncalculated = async () => {
    const selectedKeys = getSelectedKeys();
    if (selectedKeys.length === 0) {
      alert('Пожалуйста, выберите хотя бы один показатель для расчета.');
      return;
    }
    try {
      await onAnalyzeAllUnanalyzed(selectedKeys, threads);
    } catch (err: any) {
      alert(err.message || 'Ошибка во время анализа.');
    }
  };

  const renderMetric = (label: string, value: number | null, desc: string) => {
    return (
      <div className="bg-white p-4 border border-gray-200 shadow-sm rounded-lg transition-all hover:shadow-md">
        <div className="flex justify-between items-start mb-2">
          <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">{label}</span>
          {value !== null ? (
            <span className="text-[10px] text-[#27ae60] font-bold uppercase rounded px-2 py-0.5 bg-[#f1fcf4]">
              РАССЧИТАН
            </span>
          ) : (
            <span className="text-[10px] text-[#b58900] font-bold uppercase rounded px-2 py-0.5 bg-[#fff9e6]">
              НЕ РАССЧИТАН
            </span>
          )}
        </div>
        <div className="text-2xl font-mono font-bold tracking-tight text-[#2c3e50] my-1">
          {value !== null ? value.toFixed(5) : '—'}
        </div>
        <p className="text-[10px] text-gray-500 leading-normal italic mt-2">{desc}</p>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-[#2c3e50] font-sans">
      <div className="lg:col-span-4 flex flex-col gap-6">
        <div className="bg-white border border-[#e0e0e0] p-5 rounded-xl shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#2c3e50] pb-2 border-b border-[#eee] mb-4 flex items-center">
            <span>Объект исследования</span>
            <InfoTooltip text="Выберите сгенерированную ранее сеть из SQLite БД для детального анализа топологических параметров." />
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Выберите граф из БД
              </label>
              {networks.length === 0 ? (
                <p className="text-xs text-gray-400 italic pb-1">Локальные графы не сгенерированы.</p>
              ) : (
                <>
                  <select
                    value={selectedNetId || ''}
                    onChange={(e) => setSelectedNetId(parseInt(e.target.value) || null)}
                    className="w-full bg-white border border-gray-300 px-3 py-2 text-black text-xs font-bold rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3498db]/50"
                  >
                    {networks.map((net) => (
                      <option key={net.id} value={net.id}>
                        {net.name} (N={net.N}, M={net.links_count}) {net.model_type ? `[${net.model_type.toUpperCase()}]` : ''}
                      </option>
                    ))}
                  </select>

                  {activeNetwork && (
                    <div className="mt-2.5 bg-gray-50 border border-gray-200 p-3 rounded-lg text-[11px] leading-relaxed shadow-inner">
                      <div className="font-bold text-gray-750 uppercase mb-1 border-b border-gray-250 pb-0.5">Параметры генерации графа</div>
                      <div><strong>Тип модели:</strong> <span className="uppercase text-[#3498db] font-bold">{activeNetwork.model_type || 'lpn'}</span></div>
                      {activeNetwork.model_type === 'er' && (
                        <div><strong>Вероятность связи p:</strong> <span className="font-mono font-bold text-black">{activeNetwork.er_p ?? 0.05}</span></div>
                      )}
                      {activeNetwork.model_type === 'ba' && (
                        <div><strong>Связей m за интервал:</strong> <span className="font-mono font-bold text-black">{activeNetwork.ba_m ?? 2}</span></div>
                      )}
                      {(!activeNetwork.model_type || activeNetwork.model_type === 'lpn') && (
                        <>
                          <div><strong>Константа С:</strong> <span className="font-mono font-bold text-black">{activeNetwork.C}</span></div>
                          <div><strong>Параметр α:</strong> <span className="font-mono font-bold text-black">{activeNetwork.alpha}</span></div>
                          <div><strong>Ширина λ:</strong> <span className="font-mono font-bold text-black">{activeNetwork.lambda ? activeNetwork.lambda.toFixed(6) : '0'}</span></div>
                        </>
                      )}
                      <div className="mt-1.5 pt-1 border-t border-gray-200 text-gray-500">
                        <div><strong>Область вложения:</strong> {activeNetwork.space_type === 'cube' ? '3D Куб' : activeNetwork.space_type === 'sphere' ? 'Шар' : activeNetwork.space_type}</div>
                        <div><strong>Распределение узлов:</strong> {
                          activeNetwork.distribution_type === 'random' ? 'Равномерное' :
                          activeNetwork.distribution_type === 'gaussian' ? 'Гаусс' :
                          activeNetwork.distribution_type === 'grid' ? 'Сетка с м.ш.' :
                          activeNetwork.distribution_type === 'fractal_tetrahedron' ? 'Тетраэдр (в кубе)' :
                          activeNetwork.distribution_type === 'fractal_tetrahedron_cropped' ? 'Тетраэдр (вырезан)' :
                          activeNetwork.distribution_type === 'fractal_octahedron' ? 'Октаэдр (в кубе)' :
                          activeNetwork.distribution_type === 'fractal_octahedron_cropped' ? 'Октаэдр (вырезан)' :
                          activeNetwork.distribution_type === 'fractal_menger' || activeNetwork.distribution_type === 'fractal_cube' ? 'Губка Менгера' :
                          activeNetwork.distribution_type
                        }</div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#e0e0e0] p-5 rounded-xl shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#2c3e50] pb-2 border-b border-[#eee] mb-3 flex items-center">
            <span>Определяемые параметры</span>
            <InfoTooltip text="Характеристики графа от средней длины связей до информационной значимости и эффективности." />
          </h3>
          
          <div className="space-y-2.5">
            {Object.entries({
              avg_link_length: 'Средняя длина связи',
              avg_degree: 'Средняя степень вершин',
              avg_path_length: 'Среднее расстояние между вершинами',
              diameter: 'Диаметр графа',
              clustering_coef: 'Средний коэффициент кластеризации',
              straightness: 'Прямолинейность',
              closeness: 'Близость',
              efficiency: 'Эффективность',
              info_significance: 'Информационная значимость',
              connected_components: 'Количество компонент связности',
            }).map(([key, label]) => (
              <div 
                key={key} 
                onClick={() => toggleCheckbox(key)}
                className="flex items-start gap-2.5 select-none cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={checkboxes[key]}
                  onChange={() => {}} 
                  className="rounded text-[#3498db] border-gray-300 focus:ring-0 mt-0.5 h-4 w-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-gray-600 group-hover:text-[#3498db] transition-colors">{label}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={handleCalculateSingle}
              disabled={isLoading || !activeNetwork}
              className="w-full bg-[#3498db] hover:bg-[#2980b9] disabled:bg-gray-305 disabled:text-gray-500 text-white font-bold py-2 px-3 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-tight text-xs border-0"
            >
              {isLoading ? (
                <>
                  <RotateCw className="animate-spin h-3.5 w-3.5" />
                  Расчет...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Запустить анализ
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleCalculateAllUncalculated}
              disabled={isLoading || networks.length === 0}
              className="w-full bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-gray-700 font-bold py-1.5 px-3 rounded-lg transition-colors border border-gray-200 text-xs flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-tight"
            >
              {isLoading ? (
                <>
                  <RotateCw className="animate-spin h-3.5 w-3.5" />
                  Обработка...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Анализ всех нерассчитанных
                </>
              )}
            </button>

            {progress && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-150 rounded-lg shadow-inner">
                <div className="flex justify-between items-center text-[10px] font-bold text-blue-700 mb-1">
                  <span>Прогресс расчета характеристик:</span>
                  <span>{progress.current} / {progress.total} ({Math.round((progress.current / progress.total) * 100)}%)</span>
                </div>
                <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
                <p className="text-[9px] text-blue-500 mt-1 italic font-mono truncate" title={progress.message}>
                  {progress.message}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-8 bg-white border border-[#e0e0e0] p-5 rounded-xl shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[#eee] pb-3 mb-5 gap-2">
          <div>
            <h3 className="text-base font-bold text-[#2c3e50] uppercase flex items-center">
              <span>Свойства</span>
              <InfoTooltip text="Свойства выбранной сети. Метрики рассчитываются в высокоскоростном TypeScript-рантайме." />
            </h3>
            <p className="text-xs text-gray-500 italic">
              {activeNetwork 
                ? `Детализация числовых характеристик для: ${activeNetwork.name}` 
                : 'Локальная база сетей пуста.'}
            </p>
          </div>
          {activeNetwork && (
            <div className="text-[10px] bg-gray-50 py-1.5 px-3 rounded-lg border border-gray-200 font-mono font-bold text-gray-600">
              ID: {activeNetwork.id} | N: {activeNetwork.N}
            </div>
          )}
        </div>

        {activeNetwork ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {renderMetric(
              'Средняя длина связи', 
              activeNetwork.characteristics.avg_link_length,
              'Среднее евклидово расстояние между всеми соединенными ребрами.'
            )}
            {renderMetric(
              'Средняя степень вершин', 
              activeNetwork.characteristics.avg_degree,
              'Усредненное количество связей, приходящихся на один узел графа.'
            )}
            {renderMetric(
              'Среднее расстояние между вершинами', 
              activeNetwork.characteristics.avg_path_length,
              'Расстояние по ребрам сети между всеми парами узлов.'
            )}
            {renderMetric(
              'Диаметр графа', 
              activeNetwork.characteristics.diameter,
              'Максимальное расстояние (по числу связей) между наиболее удаленными узлами.'
            )}
            {renderMetric(
              'Средний коэффициент кластеризации', 
              activeNetwork.characteristics.clustering_coef,
              'Характеристика локальной плотности связей между соседями узла.'
            )}
            {renderMetric(
              'Прямолинейность', 
              activeNetwork.characteristics.straightness,
              'Степень прямолинейного отклонения физического расстояния от топологического.'
            )}
            {renderMetric(
              'Близость', 
              activeNetwork.characteristics.closeness,
              'Мера близости узла ко всем остальным узлам на основе расстояний.'
            )}
            {renderMetric(
              'Эффективность', 
              activeNetwork.characteristics.efficiency,
              'Общая пропускная способность передачи физического трафика в LPN.'
            )}
            {renderMetric(
              'Информационная значимость', 
              activeNetwork.characteristics.info_significance,
              'Чувствительность сети ко взвешенному удалению связей у каждого отдельного узла.'
            )}
            {renderMetric(
              'Компоненты связности', 
              activeNetwork.characteristics.connected_components,
              'Количество изолированных подграфов в сети.'
            )}

            {loadingDetails ? (
              <div className="col-span-1 sm:col-span-2 md:col-span-3 flex justify-center items-center py-10 text-xs font-mono text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 mt-4">
                <RotateCw className="animate-spin h-6 w-6 text-blue-500 mb-2" />
                Идет чтение ребер графа из базы данных...
              </div>
            ) : (
              activeNetworkDetails && (
                <div className="col-span-1 sm:col-span-2 md:col-span-3">
                  <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/20 shadow-xs">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Гистограмма степеней вершины P(k)</span>
                    <BarChart2 className="h-6 w-6 text-blue-500 float-right opacity-30 mt-1" />
                    <p className="text-[11px] text-gray-500 leading-normal italic">
                      Данный статистический срез показывает плотность связей в текущем графе. Вы найдете детализацию распределения степеней во встроенной SVG-гистограмме ниже.
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-gray-300 rounded-xl bg-gray-50 text-gray-500 font-sans">
            <RefreshCw className="h-10 w-10 text-gray-400 mb-2 animate-spin" />
            <p className="text-sm font-semibold font-bold">База данных пуста. Сгенерируйте граф во вкладке ГЕНЕРАЦИЯ.</p>
          </div>
        )}
      </div>

      <div className="lg:col-span-12">
        <UnifiedProfilesManager 
          networks={networks} 
          profiles={profiles} 
          onProfilesChange={setProfiles} 
          onSaveAveragedCompleted={onSaveAveragedCompleted}
        />
      </div>

      <div className="lg:col-span-12">
        <CompareDegreeDistributions networks={networks} profiles={profiles} />
      </div>

      <div className="lg:col-span-12">
        <NetworkMetricsComparisonPlot networks={networks} profiles={profiles} />
      </div>
    </div>
  );
};
