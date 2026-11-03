import React, { useState } from 'react';
import { Network, ComparisonProfile, matchNetworkWithProfile } from '../types';
import { Plus, Trash2, Edit2, Check, X, CheckSquare, Square, Search, Calculator } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';

interface UnifiedProfilesManagerProps {
  networks: Network[];
  profiles: ComparisonProfile[];
  onProfilesChange: (newProfiles: ComparisonProfile[]) => void;
  onSaveAveragedCompleted?: () => Promise<void>;
}

const COLOR_PALETTE = [
  '#3498db', // Blue
  '#e74c3c', // Red
  '#2ecc71', // Green
  '#9b59b6', // Purple
  '#f1c40f', // Yellow
  '#1abc9c', // Teal
  '#e67e22', // Orange
  '#4f46e5', // Indigo
  '#d35400', // Rust
];

export const UnifiedProfilesManager: React.FC<UnifiedProfilesManagerProps> = ({
  networks,
  profiles,
  onProfilesChange,
  onSaveAveragedCompleted,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSavingAveraged, setIsSavingAveraged] = useState<string | null>(null);

  const handleCreateAveragedNetwork = async (prof: ComparisonProfile) => {
    const matched = networks.filter((n) => matchNetworkWithProfile(n, prof));
    if (matched.length === 0) return;

    setIsSavingAveraged(prof.id);
    try {
      const sumN = matched.reduce((sum, n) => sum + (n.N || 0), 0);
      const avgN = Math.round(sumN / matched.length);

      const sumC = matched.reduce((sum, n) => sum + (n.C || 0), 0);
      const avgC = sumC / matched.length;

      const sumAlpha = matched.reduce((sum, n) => sum + (n.alpha || 0), 0);
      const avgAlpha = sumAlpha / matched.length;

      const sumLambda = matched.reduce((sum, n) => sum + (n.lambda || 0), 0);
      const avgLambda = sumLambda / matched.length;

      const sumErP = matched.reduce((sum, n) => sum + (n.er_p || 0), 0);
      const avgErP = sumErP / matched.length;

      const sumBaM = matched.reduce((sum, n) => sum + (n.ba_m || 0), 0);
      const avgBaM = Math.round(sumBaM / matched.length);

      const averages: Record<string, number | null> = {};
      const keys = [
        'avg_link_length', 'avg_degree', 'avg_path_length', 'diameter',
        'clustering_coef', 'straightness', 'closeness', 'efficiency',
        'info_significance', 'connected_components'
      ];
      keys.forEach(k => {
        const validVals = matched
          .map(n => n.characteristics[k as keyof typeof n.characteristics])
          .filter(v => v !== null && v !== undefined) as number[];
        if (validVals.length > 0) {
          averages[k] = validVals.reduce((sum, v) => sum + v, 0) / validVals.length;
        } else {
          averages[k] = null;
        }
      });

      const payload = {
        name: `🎯 Среднее: ${prof.name}`,
        N: avgN,
        C: avgC,
        alpha: avgAlpha,
        lambda_val: avgLambda,
        space_type: prof.space_type === 'all' ? 'mixed' : prof.space_type,
        distribution_type: prof.distribution_type === 'all' ? 'mixed' : prof.distribution_type,
        model_type: prof.model_type,
        er_p: avgErP,
        ba_m: avgBaM,
        characteristics: averages,
      };

      const res = await fetch('/api/networks/save-averaged', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Failed to save averaged profile network');
      }

      if (onSaveAveragedCompleted) {
        await onSaveAveragedCompleted();
      }
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении усредненной сети: ' + (err as Error).message);
    } finally {
      setIsSavingAveraged(null);
    }
  };

  const [name, setName] = useState('');
  const [color, setColor] = useState('#3498db');
  const [selectionType, setSelectionType] = useState<'formula' | 'manual'>('formula');
  
  const [modelType, setModelType] = useState<'all' | 'lpn' | 'er' | 'ba'>('all');
  const [spaceType, setSpaceType] = useState<'all' | 'cube' | 'sphere'>('all');
  const [distributionType, setDistributionType] = useState<'all' | 'random' | 'gaussian' | 'grid' | 'fractal_tetrahedron' | 'fractal_tetrahedron_cropped' | 'fractal_octahedron' | 'fractal_octahedron_cropped' | 'fractal_menger' | 'fractal_cube'>('all');
  const [lambdaVal, setLambdaVal] = useState<'all' | number>('all');
  const [alphaVal, setAlphaVal] = useState<'all' | number>('all');
  const [erPVal, setErPVal] = useState<'all' | number>('all');
  const [baMVal, setBaMVal] = useState<'all' | number>('all');

  const [selectedNetworkIds, setSelectedNetworkIds] = useState<number[]>([]);
  const [netSearch, setNetSearch] = useState('');

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setColor(COLOR_PALETTE[profiles.length % COLOR_PALETTE.length] || '#3498db');
    setSelectionType('formula');
    setModelType('all');
    setSpaceType('all');
    setDistributionType('all');
    setLambdaVal('all');
    setAlphaVal('all');
    setErPVal('all');
    setBaMVal('all');
    setSelectedNetworkIds([]);
    setNetSearch('');
  };

  const startEdit = (prof: ComparisonProfile) => {
    setEditingId(prof.id);
    setName(prof.name);
    setColor(prof.color);
    setSelectionType(prof.selection_type);
    setModelType(prof.model_type);
    setSpaceType(prof.space_type);
    setDistributionType(prof.distribution_type);
    setLambdaVal(prof.lambdaVal);
    setAlphaVal(prof.alphaVal);
    setErPVal(prof.er_pVal);
    setBaMVal(prof.ba_mVal);
    setSelectedNetworkIds(prof.selectedNetworkIds || []);
    setNetSearch('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const targetName = name.trim() || (selectionType === 'manual' ? 'Черновик (Ручной выбор)' : 'Профиль по формуле');

    if (editingId) {
      const updated = profiles.map((p) => {
        if (p.id === editingId) {
          return {
            ...p,
            name: targetName,
            color,
            selection_type: selectionType,
            model_type: modelType,
            space_type: spaceType,
            distribution_type: distributionType,
            lambdaVal,
            alphaVal,
            er_pVal: erPVal,
            ba_mVal: baMVal,
            selectedNetworkIds,
          };
        }
        return p;
      });
      onProfilesChange(updated);
    } else {
      const newProf: ComparisonProfile = {
        id: `prof-${Date.now()}`,
        name: targetName,
        color,
        enabled: true,
        selection_type: selectionType,
        model_type: modelType,
        space_type: spaceType,
        distribution_type: distributionType,
        lambdaVal,
        alphaVal,
        er_pVal: erPVal,
        ba_mVal: baMVal,
        selectedNetworkIds,
      };
      onProfilesChange([...profiles, newProf]);
    }

    resetForm();
  };

  const handleDelete = (id: string) => {
    onProfilesChange(profiles.filter((p) => p.id !== id));
    if (editingId === id) {
      resetForm();
    }
  };

  const toggleProfileEnabled = (id: string) => {
    onProfilesChange(
      profiles.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const handleManualNetworkToggle = (netId: number) => {
    setSelectedNetworkIds((prev) =>
      prev.includes(netId) ? prev.filter((id) => id !== netId) : [...prev, netId]
    );
  };

  const filteredNetworksManual = networks.filter((net) => {
    if (!netSearch) return true;
    const term = netSearch.toLowerCase();
    const matchesName = net.name.toLowerCase().includes(term);
    const matchesModel = (net.model_type || 'lpn').toLowerCase().includes(term);
    const matchesN = net.N.toString().includes(term);
    return matchesName || matchesModel || matchesN;
  });

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 mt-6 font-sans text-[#2c3e50]" id="unified-profiles-card">
      <div className="border-b border-gray-150 pb-3 mb-4">
        <h3 className="text-sm font-bold text-[#2c3e50] uppercase tracking-wider flex items-center gap-1.5">
          <span>Управление графиками и профилями сравнения</span>
          <InfoTooltip text="Задается общее меню фильтрации. Выберите базовые формульные свойства или конкретные сетевые модели вручную для совмещенного анализа графиков." />
        </h3>
        <p className="text-[10px] text-gray-500 italic mt-0.5">
          Созданные здесь профили одновременно управляют графиком усадки свойств от N и графиком сравнения распределений степеней P(k).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 flex flex-col justify-between border-r border-gray-100 pr-0 lg:pr-5">
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Настроенные кривые ({profiles.length})</span>
              <button 
                type="button"
                onClick={resetForm}
                className="text-[9px] font-bold text-[#3498db] hover:underline cursor-pointer bg-transparent border-0"
              >
                Сбросить форму
              </button>
            </div>

            {profiles.length === 0 ? (
              <div className="text-center py-8 text-gray-400 italic text-xs border border-dashed border-gray-200 rounded-lg bg-gray-50">
                Задайте хотя бы один профиль сравнения на панели справа.
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {profiles.map((prof) => {
                  const matchedCount = networks.filter((n) => matchNetworkWithProfile(n, prof)).length;
                  const isEditing = editingId === prof.id;

                  return (
                    <div
                      key={prof.id}
                      className={`p-2.5 border rounded-lg transition-all flex flex-col gap-1.5 ${
                        isEditing
                          ? 'bg-blue-50/50 border-[#4f46e5]/40 ring-1 ring-[#4f46e5]/20'
                          : prof.enabled
                          ? 'bg-white border-gray-200 hover:border-gray-300'
                          : 'bg-gray-50/60 border-gray-150 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 max-w-[75%]">
                          <input
                            type="checkbox"
                            checked={prof.enabled}
                            onChange={() => toggleProfileEnabled(prof.id)}
                            className="rounded text-[#3498db] border-gray-300 focus:ring-0 w-3.5 h-3.5 cursor-pointer shrink-0"
                            title="Включить/отключить отображение на графиках"
                          />
                          <span
                            className="w-2.5 h-2.5 rounded-full block shrink-0"
                            style={{ backgroundColor: prof.color }}
                          />
                          <span className="font-bold text-xs truncate text-gray-800" title={prof.name}>
                            {prof.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEdit(prof)}
                            className="p-1 hover:bg-gray-100 text-gray-400 hover:text-blue-500 rounded transition-colors border-0 bg-transparent cursor-pointer"
                            title="Редактировать параметры"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(prof.id)}
                            className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded transition-colors border-0 bg-transparent cursor-pointer"
                            title="Удалить профиль"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[9px] font-semibold text-gray-500 font-mono mt-0.5 font-bold">
                        <div className="truncate max-w-[70%]">
                          {prof.selection_type === 'manual' ? (
                            <span className="text-indigo-600 bg-indigo-50 border border-indigo-100 px-1 py-0.5 rounded">Ручной выбор</span>
                          ) : (
                            <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-1 py-0.5 rounded">
                              Модель: {prof.model_type.toUpperCase()}
                              {prof.model_type === 'lpn' && prof.lambdaVal !== 'all' && `, λ=${prof.lambdaVal}`}
                            </span>
                          )}
                        </div>
                        <span className="bg-gray-100 border border-gray-250 text-gray-600 font-bold px-1.5 py-0.5 rounded-full font-sans">
                          {matchedCount} графов в БД
                        </span>
                      </div>

                      {matchedCount > 0 && (
                        <div className="mt-2 pt-1.5 border-t border-gray-100 flex justify-between items-center">
                          <span className="text-[9px] text-gray-400 font-bold flex items-center gap-0.5">
                            <Calculator className="h-2.5 w-2.5 text-emerald-600" /> Усредненное свойство:
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCreateAveragedNetwork(prof)}
                            disabled={isSavingAveraged === prof.id}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[8px] tracking-tight uppercase px-1.5 py-0.5 rounded transition-all border-0 cursor-pointer disabled:opacity-50 shadow-sm"
                            title="Рассчитать средние характеристики совпавших сетей и сохранить как виртуальный граф для сравнения"
                          >
                            {isSavingAveraged === prof.id ? 'Расчет...' : 'Создать среднюю сеть'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-[10px] text-blue-800 leading-relaxed font-sans shrink-0 font-bold">
            <span className="font-bold">Как это работает:</span> Любые изменения в профилях (добавление, скрытие, выбор сетей) мгновенно применяются к гистограмме P(k) и всем кривым на графиках свойств от N. Выберите нужные кривые флажками.
          </div>
        </div>

        <form onSubmit={handleSave} className="lg:col-span-7 flex flex-col justify-between bg-gray-50/60 border border-gray-200 p-4 rounded-xl">
          <div className="space-y-3.5">
            <div className="flex justify-between items-center">
              <span className="text-[11px] uppercase font-bold text-gray-500 tracking-wider">
                {editingId ? 'Редактирование профиля' : 'Новая кривая / Профиль'}
              </span>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-[9px] font-bold text-red-500 flex items-center gap-0.5 cursor-pointer bg-transparent border-none"
                >
                  <X className="h-3 w-3" /> Отменить редактирование
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-3">
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Название профиля на графике</label>
                <input
                  type="text"
                  placeholder="Например: Сетка LPN (Куб), λ=0.05"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-gray-300 px-3 py-1.5 text-xs font-bold rounded focus:ring-1 focus:ring-blue-400 focus:outline-none placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Цвет кривой</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-300 p-0.5 bg-transparent"
                  />
                  <span className="text-[10px] font-mono font-bold">{color.toUpperCase()}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Способ выбора графов для профиля</label>
              <div className="grid grid-cols-2 gap-2 bg-gray-250 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setSelectionType('formula')}
                  className={`py-1 px-2.5 text-xs font-bold rounded-md transition-all border-0 cursor-pointer ${
                    selectionType === 'formula'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900 bg-transparent'
                  }`}
                >
                  По характеристикам (Формула)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectionType('manual')}
                  className={`py-1 px-2.5 text-xs font-bold rounded-md transition-all border-0 cursor-pointer ${
                    selectionType === 'manual'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900 bg-transparent'
                  }`}
                >
                  Вручную из списка БД
                </button>
              </div>
            </div>

            {selectionType === 'formula' && (
              <div className="space-y-3 p-3 bg-white border border-gray-200 rounded-lg shadow-inner text-xs font-bold">
                <div>
                  <label className="text-gray-550 block mb-0.5 font-bold">Модель сети (Классификатор)</label>
                  <select
                    value={modelType}
                    onChange={(e) => setModelType(e.target.value as any)}
                    className="w-full bg-white border border-gray-300 px-2 py-1 text-[11px] font-bold rounded focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="all">Все модели вместе (LPN + ER + BA)</option>
                    <option value="lpn">Физическая сеть LPN (Линейно-физическая)</option>
                    <option value="er">Случайный граф Эрдёша-Реньи (ER)</option>
                    <option value="ba">Безмасштабная сеть Барабаши-Альберт (BA)</option>
                  </select>
                </div>

                {modelType === 'lpn' && (
                  <>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-gray-500 block mb-0.5 font-bold">Область</label>
                        <select
                          value={spaceType}
                          onChange={(e) => setSpaceType(e.target.value as any)}
                          className="w-full bg-white border border-gray-300 px-2 py-1 text-[10px] font-bold rounded"
                        >
                          <option value="all">Любое пространство</option>
                          <option value="cube">3D Куб</option>
                          <option value="sphere">Шар</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-gray-500 block mb-0.5 font-bold">Координаты</label>
                        <select
                          value={distributionType}
                          onChange={(e) => setDistributionType(e.target.value as any)}
                          className="w-full bg-white border border-gray-300 px-2 py-1 text-[10px] font-bold rounded"
                        >
                          <option value="all">Любое</option>
                          <option value="random">Равномерное</option>
                          <option value="gaussian">Гауссово</option>
                          <option value="grid">Сетка с м.ш.</option>
                          <option value="fractal_tetrahedron">Тетраэдр (в кубе)</option>
                          <option value="fractal_tetrahedron_cropped">Тетраэдр (вырезан)</option>
                          <option value="fractal_octahedron">Октаэдр (в кубе)</option>
                          <option value="fractal_octahedron_cropped">Октаэдр (вырезан)</option>
                          <option value="fractal_menger">Губка Менгера</option>
                          <option value="fractal_cube">Канторова пыль</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-gray-500 block mb-0.5 font-bold">Параметр исключения λ</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="Любая λ (напр. 0.05)"
                          value={lambdaVal === 'all' ? '' : lambdaVal}
                          onChange={(e) =>
                            setLambdaVal(e.target.value === '' ? 'all' : parseFloat(e.target.value))
                          }
                          className="w-full bg-white border border-gray-300 px-2 py-1 text-[10px] font-bold rounded focus:ring-1 focus:ring-blue-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-gray-500 block mb-0.5 font-bold">Коэффициент α</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="Любая α (напр. 2.0)"
                          value={alphaVal === 'all' ? '' : alphaVal}
                          onChange={(e) =>
                            setAlphaVal(e.target.value === '' ? 'all' : parseFloat(e.target.value))
                          }
                          className="w-full bg-white border border-gray-300 px-2 py-1 text-[10px] font-bold rounded focus:ring-1 focus:ring-blue-400 focus:outline-none"
                        />
                      </div>
                    </div>
                  </>
                )}

                {modelType === 'er' && (
                  <div>
                    <label className="text-gray-500 block mb-0.5 font-bold">Вероятность p (ER)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Любое p (напр. 0.05)"
                      value={erPVal === 'all' ? '' : erPVal}
                      onChange={(e) =>
                        setErPVal(e.target.value === '' ? 'all' : parseFloat(e.target.value))
                      }
                      className="w-full bg-white border border-gray-300 px-2 py-1 text-[11px] font-bold rounded focus:ring-1 focus:ring-blue-400 focus:outline-none"
                    />
                  </div>
                )}

                {modelType === 'ba' && (
                  <div>
                    <label className="text-gray-500 block mb-0.5 font-bold">Количество связей m за шаг (BA)</label>
                    <input
                      type="number"
                      step="1"
                      placeholder="Любое m (напр. 2)"
                      value={baMVal === 'all' ? '' : baMVal}
                      onChange={(e) =>
                        setBaMVal(e.target.value === '' ? 'all' : parseInt(e.target.value))
                      }
                      className="w-full bg-white border border-gray-300 px-2 py-1 text-[11px] font-bold rounded focus:ring-1 focus:ring-blue-400 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )}

            {selectionType === 'manual' && (
              <div className="space-y-2 p-3 bg-white border border-gray-200 rounded-lg shadow-inner text-xs font-bold">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Поиск сети в БД по имени, N или ID..."
                    value={netSearch}
                    onChange={(e) => setNetSearch(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 pl-8 pr-2 py-1 text-[11px] rounded focus:ring-1 focus:ring-blue-400 focus:outline-none placeholder-gray-400"
                  />
                </div>

                {networks.length === 0 ? (
                  <p className="text-[11px] text-gray-400 italic py-4 text-center">
                    В БД нет сетей. Сгенерируйте их во вкладке "ГЕНЕРАЦИЯ".
                  </p>
                ) : (
                  <div className="max-h-[160px] overflow-y-auto pr-1 space-y-1">
                    {filteredNetworksManual.map((net) => {
                      const isChecked = selectedNetworkIds.includes(net.id);
                      return (
                        <div
                          key={net.id}
                          onClick={() => handleManualNetworkToggle(net.id)}
                          className="flex items-center justify-between p-1.5 rounded border border-gray-100 hover:bg-gray-50 cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-1.5 truncate max-w-[80%]">
                            {isChecked ? (
                              <CheckSquare className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            ) : (
                              <Square className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                            )}
                            <span className="font-bold truncate text-[11px] text-gray-700">
                              {net.name}
                            </span>
                          </div>
                          <span className="text-[9px] font-mono font-bold bg-gray-50 hover:bg-gray-100 border px-1 rounded text-gray-500">
                            N={net.N} {net.model_type ? `[${net.model_type.toUpperCase()}]` : '[LPN]'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold border-t border-gray-100 pt-1.5 px-0.5">
                  <span>Выбрано вручную сетей: {selectedNetworkIds.length}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedNetworkIds(networks.map((n) => n.id))}
                      className="text-blue-500 hover:underline bg-transparent border-none p-0 cursor-pointer font-bold text-[10px]"
                    >
                      Выбрать все
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedNetworkIds([])}
                      className="text-red-400 hover:underline bg-transparent border-none p-0 cursor-pointer font-bold text-[10px]"
                    >
                      Очистить
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-gray-200 flex justify-between items-center mt-3 shrink-0">
            <span className="text-[10px] text-gray-400 leading-none font-bold">
              * Нажмите "Добавить" для вывода кривой
            </span>
            <button
              type="submit"
              className="bg-[#3498db] hover:bg-[#2980b9] text-white font-bold text-xs uppercase py-2 px-4 rounded-lg flex items-center gap-1 transition-all border-0 shadow-sm cursor-pointer"
            >
              {editingId ? (
                <>
                  <Check className="h-4 w-4" /> Сохранить изменения
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Добавить профиль
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
