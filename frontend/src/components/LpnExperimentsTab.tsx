import React, { useState } from 'react';
import { Experiment } from '../types';
import { Play, RotateCw, History, HelpCircle } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';

interface ExperimentsTabProps {
  experiments: Experiment[];
  isLoading: boolean;
  onRunExperiment: (data: any) => Promise<any>;
  progress?: { current: number; total: number; message: string } | null;
}

export const LpnExperimentsTab: React.FC<ExperimentsTabProps> = ({
  experiments,
  isLoading,
  onRunExperiment,
  progress,
}) => {
  const [formData, setFormData] = useState({
  name: 'Научный Эксперимент #1',
  N: 150,
  lambdasString: '0.00001, 0.00333, 0.05774, 0.13583',
  spaces: ['cube'],
  distributions: ['random'],
  repetitions: 15,
  threads: 8,
  node_link_int: true,  // ← ДОБАВЛЕНО
  nodes_as_points: true,
  model_types: ['lpn'] as string[],
});

  const [activeExperiment, setActiveExperiment] = useState<Experiment | null>(
    experiments.length > 0 ? experiments[0] : null
  );

  const [compareList, setCompareList] = useState<number[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [customColors, setCustomColors] = useState<Record<string, string>>({});
  const [hoveredLine, setHoveredLine] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);
  const [hoveredBar, setHoveredBar] = useState<{
    field: string;
    curveKey: string;
    bIdx: number;
    freq: number;
    x: number;
    y: number;
    color: string;
    label: string;
    binRangeStr: string;
  } | null>(null);

  const [stringInputs, setStringInputs] = useState<Record<string, string>>({});

  const handleStringChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setStringInputs(prev => ({
      ...prev,
      [name]: value
    }));
    
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) {
      setFormData(prev => ({ ...prev, [name]: parsed }));
    } else if (value === '') {
      setFormData(prev => ({ ...prev, [name]: 0 }));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value,
    }));
  };

  const handleSpaceToggle = (space: string) => {
    setFormData((prev) => {
      const arr = prev.spaces.includes(space)
        ? prev.spaces.filter((s) => s !== space)
        : [...prev.spaces, space];
      return { ...prev, spaces: arr.length ? arr : [space] };
    });
  };

  const handleModelTypeToggle = (model: string) => {
    setFormData((prev) => {
      const arr = prev.model_types.includes(model)
        ? prev.model_types.filter((m) => m !== model)
        : [...prev.model_types, model];
      return { ...prev, model_types: arr.length ? arr : [model] };
    });
  };

  const handleDistToggle = (dist: string) => {
    setFormData((prev) => {
      const arr = prev.distributions.includes(dist)
        ? prev.distributions.filter((d) => d !== dist)
        : [...prev.distributions, dist];
      return { ...prev, distributions: arr.length ? arr : [dist] };
    });
  };

  const handleCompareToggle = (id: number) => {
    setCompareList((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lams = formData.lambdasString
      .split(',')
      .map((x) => parseFloat(x.trim()))
      .filter((x) => !isNaN(x) && x >= 0);
      
    if (lams.length === 0) {
      alert('Пожалуйста, введите корректные значения lambda.');
      return;
    }

    const getSpaceRu = (s: string) => {
      if (s === 'cube') return 'Куб';
      if (s === 'sphere') return 'Шар';
      return s;
    };
    const getDistRu = (d: string) => {
      if (d === 'random') return 'Случайное';
      if (d === 'gaussian') return 'Гауссово';
      if (d === 'grid') return 'Сетка';
      if (d === 'fractal_tetrahedron') return 'Тетраэдр (в кубе)';
      if (d === 'fractal_tetrahedron_cropped') return 'Тетраэдр (вырезан)';
      if (d === 'fractal_octahedron') return 'Октаэдр (в кубе)';
      if (d === 'fractal_octahedron_cropped') return 'Октаэдр (вырезан)';
      if (d === 'fractal_menger') return 'Губка Менгера';
      if (d === 'fractal_cube') return 'Канторова пыль';
      return d;
    };
    const getModelRu = (m: string) => {
      if (m === 'lpn') return 'LPN';
      if (m === 'er') return 'ER';
      if (m === 'ba') return 'BA';
      return m;
    };
    const formattedLambdas = lams.map(l => l.toString()).join('; ');
    const computedName = `N=${formData.N}, λ=[${formattedLambdas}], Модели: ${formData.model_types.map(getModelRu).join('+')}, Область: ${formData.spaces.map(getSpaceRu).join('+')}, Распределение: ${formData.distributions.map(getDistRu).join('+')}`;

    try {
      const res = await onRunExperiment({
        name: computedName,
        N: formData.N,
        lambdas: lams,
        spaces: formData.spaces,
        distributions: formData.distributions,
        repetitions: formData.repetitions,
        threads: formData.threads,
        nodes_as_points: formData.nodes_as_points,
        model_types: formData.model_types,
      });
      if (res) {
        setActiveExperiment(res);
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка во время запуска эксперимента.');
    }
  };

  const getSpaceRuLocal = (s: string) => {
    if (s === 'cube') return 'Куб';
    if (s === 'sphere') return 'Шар';
    return s;
  };

  const getDistRuLocal = (d: string) => {
    if (d === 'random') return 'Случайное';
    if (d === 'gaussian') return 'Гауссово';
    if (d === 'grid') return 'Сетка';
    if (d === 'fractal_tetrahedron') return 'Тетраэдр (в кубе)';
    if (d === 'fractal_tetrahedron_cropped') return 'Тетраэдр (вырезан)';
    if (d === 'fractal_octahedron') return 'Октаэдр (в кубе)';
    if (d === 'fractal_octahedron_cropped') return 'Октаэдр (вырезан)';
    if (d === 'fractal_menger') return 'Губка Менгера';
    if (d === 'fractal_cube') return 'Канторова пыль';
    return d;
  };

  const getCombinedResults = () => {
    const list: any[] = [];
    
    if (activeExperiment && activeExperiment.results) {
      activeExperiment.results.forEach((r) => {
        const mLabel = r.model_type ? r.model_type.toUpperCase() : 'LPN';
        const isLpn = mLabel === 'LPN';
        list.push({
          ...r,
          experiment_id: activeExperiment.id,
          label: `[${mLabel}] ${getSpaceRuLocal(r.space_type)} (${getDistRuLocal(r.distribution_type)})${isLpn ? `, λ=${r.lambda.toFixed(5)}` : ''} [Р:${activeExperiment.id}]`,
        } as any);
      });
    }

    compareList.forEach((id) => {
      if (id === activeExperiment?.id) return;
      const exp = experiments.find((e) => e.id === id);
      if (exp && exp.results) {
        exp.results.forEach((r) => {
          const mLabel = r.model_type ? r.model_type.toUpperCase() : 'LPN';
          const isLpn = mLabel === 'LPN';
          list.push({
            ...r,
            experiment_id: exp.id,
            label: `[${mLabel}] ${getSpaceRuLocal(r.space_type)} (${getDistRuLocal(r.distribution_type)})${isLpn ? `, λ=${r.lambda.toFixed(5)}` : ''} [Р:${exp.id}]`,
          } as any);
        });
      }
    });

    return list;
  };

  const combinedResults = getCombinedResults();

  const colors = [
    '#3498db',
    '#27ae60',
    '#e74c3c',
    '#9b59b6',
    '#f1c40f',
    '#1abc9c',
    '#e67e22',
    '#ec4899',
  ];

  const renderLineChart = (resultsList: any[]) => {
    let maxX = 1;
    let maxY = 0;
    
    resultsList.forEach((r) => {
      if (r.m_vs_length_edges && r.m_vs_length_edges.length > 0) {
        const lastX = r.m_vs_length_edges[r.m_vs_length_edges.length - 1];
        if (lastX > maxX) maxX = lastX;
      }
      if (r.m_vs_length_values && r.m_vs_length_values.length > 0) {
        const highestY = Math.max(...r.m_vs_length_values);
        if (highestY > maxY) maxY = highestY;
      }
    });

    if (maxY === 0) maxY = 1.0;
    maxY *= 1.1;

    const width = 500;
    const height = 260;
    const padding = 45;

    const scaleX = (x: number) => {
      if (x <= 0) return padding;
      const minLog = 0;
      const maxLog = Math.log10(maxX || 10000) === 0 ? 1 : Math.log10(maxX || 10000);
      const ratio = (Math.log10(x) - minLog) / (maxLog - minLog);
      return padding + ratio * (width - padding * 2);
    };

    const scaleY = (y: number) => {
      return height - padding - (y / maxY) * (height - padding * 2);
    };

    const hoveredLineResult = hoveredLine ? resultsList.find(r => {
      const rKey = `${r.experiment_id}_${r.space_type}_${r.distribution_type}_${r.lambda}`;
      return rKey === hoveredLine;
    }) : null;

    return (
      <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm">
        <div className="flex justify-between items-start mb-2">
          <h4 className="text-xs font-bold text-[#2c3e50] uppercase tracking-wider">
            Зависимость средней длины ребра от числа связей M (в лог. масштабе)
          </h4>
          <span className="text-[10px] text-gray-400 font-mono">[Лог. масштаб X]</span>
        </div>

        <div className="relative overflow-visible">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#bdc3c7" strokeWidth={1} />
            <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#bdc3c7" strokeWidth={1} />
            
            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((term) => {
              const val = term * maxY;
              const y = scaleY(val);
              return (
                <g key={term}>
                  <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#f0f3f4" strokeWidth={0.5} strokeDasharray="3,3" />
                  <text x={padding - 8} y={y + 3} textAnchor="end" className="text-[9px] fill-gray-500 font-mono font-semibold">
                    {val.toFixed(2)}
                  </text>
                </g>
              );
            })}

            {[1, 10, 100, 1000, 10000].map((mVal) => {
              if (mVal > maxX) return null;
              const x = scaleX(mVal);
              
              const getLogLabel = (val: number) => {
                if (val === 1) return '1';
                if (val === 10) return '10';
                if (val === 100) return '10²';
                if (val === 1000) return '10³';
                if (val === 10000) return '10⁴';
                if (val === 100000) return '10⁵';
                return `10^${Math.log10(val)}`;
              };

              return (
                <g key={mVal}>
                  <line x1={x} y1={padding} x2={x} y2={height - padding} stroke="#f0f3f4" strokeWidth={0.5} strokeDasharray="3,3" />
                  <text x={x} y={height - padding + 12} textAnchor="middle" className="text-[9px] fill-gray-500 font-mono font-semibold">
                    {getLogLabel(mVal)}
                  </text>
                </g>
              );
            })}

            <line 
              x1={padding} 
              y1={scaleY(0.662)} 
              x2={width - padding} 
              y2={scaleY(0.662)} 
              stroke="#95a5a6" 
              strokeWidth={1} 
              strokeDasharray="4,4" 
            />
            <text x={width - padding - 8} y={scaleY(0.662) - 4} textAnchor="end" className="text-[8px] fill-gray-400 font-mono">
              Ожидаемая для λ=0 (0.662)
            </text>

            {resultsList.map((r, rIdx) => {
              if (!r.m_vs_length_edges || r.m_vs_length_edges.length === 0) return null;
              
              const pointsStr = r.m_vs_length_edges
                .map((edgeCount: number, ptIdx: number) => {
                  const lenVal = r.m_vs_length_values[ptIdx];
                  return `${scaleX(edgeCount)},${scaleY(lenVal)}`;
                })
                .join(' ');

              const curveKey = `${r.experiment_id}_${r.space_type}_${r.distribution_type}_${r.lambda}`;
              const defaultColor = colors[rIdx % colors.length];
              const currentColor = customColors[curveKey] || defaultColor;

              const isLineActive = hoveredLine === curveKey;
              const hasSomeLineHovered = hoveredLine !== null;

              return (
                <g key={rIdx}>
                  <polyline
                    points={pointsStr}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={12}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredLine(curveKey)}
                    onMouseLeave={() => setHoveredLine(null)}
                  />

                  <polyline
                    points={pointsStr}
                    fill="none"
                    stroke={currentColor}
                    strokeWidth={isLineActive ? 4 : 2}
                    opacity={hasSomeLineHovered && !isLineActive ? 0.25 : 1}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all duration-155 cursor-pointer pointer-events-none"
                  />
                  
                  {r.m_vs_length_edges.map((edgeCount: number, ptIdx: number) => {
                    const lenVal = r.m_vs_length_values[ptIdx];
                    const isLast = ptIdx === r.m_vs_length_edges.length - 1;
                    if (ptIdx % 2 !== 0 && !isLast) return null;

                    const cx = scaleX(edgeCount);
                    const cy = scaleY(lenVal);

                    const isPointHovered = hoveredPoint && 
                      hoveredPoint.curveKey === curveKey && 
                      hoveredPoint.edgeCount === edgeCount;

                    return (
                      <circle
                        key={ptIdx}
                        cx={cx}
                        cy={cy}
                        r={isPointHovered ? 5.5 : 2.5}
                        fill={isPointHovered ? '#ffffff' : currentColor}
                        stroke={isPointHovered ? currentColor : 'none'}
                        strokeWidth={isPointHovered ? 2.5 : 0}
                        opacity={hasSomeLineHovered && !isLineActive ? 0.35 : 1}
                        className="transition-all duration-100 cursor-help"
                        onMouseEnter={() => {
                          setHoveredLine(curveKey);
                          setHoveredPoint({
                            curveKey,
                            edgeCount,
                            lenVal,
                            cx,
                            cy,
                            label: r.label,
                            space: r.space_type,
                            dist: r.distribution_type,
                            lambda: r.lambda,
                            m_phys_avg: r.m_phys_avg,
                            m_max_avg: r.m_max_avg,
                            color: currentColor,
                          });
                        }}
                        onMouseLeave={() => {
                          setHoveredLine(null);
                          setHoveredPoint(null);
                        }}
                      />
                    );
                  })}
                </g>
              );
            })}
          </svg>

          {hoveredPoint && (
            <div 
              className="absolute z-35 pointer-events-none bg-slate-900/95 backdrop-blur text-white border border-slate-700/80 p-3 rounded-lg shadow-xl text-[10px] leading-relaxed max-w-[200px]"
              style={{
                left: `${(hoveredPoint.cx / width) * 100}%`,
                top: `${(hoveredPoint.cy / height) * 100}%`,
                transform: 'translate(-50%, -100%) translateY(-10px)',
              }}
            >
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900/95" />
              
              <div className="flex items-center gap-1.5 font-bold mb-1 pb-1 border-b border-slate-800 text-slate-200">
                <span className="h-2 w-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: hoveredPoint.color }} />
                <span className="truncate">{hoveredPoint.label.split('[')[0]}</span>
              </div>
              
              <div className="space-y-1 font-mono">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-400">Связи M:</span>
                  <span className="text-emerald-400 font-bold">{hoveredPoint.edgeCount}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-400">Ср. длина:</span>
                  <span className="text-sky-300 font-bold">{hoveredPoint.lenVal.toFixed(5)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 bg-gray-50 border border-gray-150 p-2.5 rounded-lg text-xs min-h-[50px] flex flex-col justify-center transition-all duration-150 font-bold">
          {hoveredPoint ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded shadow-sm" style={{ backgroundColor: hoveredPoint.color }} />
                <span className="font-bold text-gray-800">{getSpaceRuLocal(hoveredPoint.space)} ({getDistRuLocal(hoveredPoint.dist)})</span>
                <span className="text-gray-400 font-mono">λ = {hoveredPoint.lambda.toFixed(5)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
                <div className="bg-sky-50 text-sky-800 border border-sky-100 px-2 py-0.5 rounded-md">
                  Связи M: <strong className="font-mono text-sky-900">{hoveredPoint.edgeCount}</strong>
                </div>
                <div className="bg-amber-50 text-amber-800 border border-amber-100 px-2 py-0.5 rounded-md">
                  Длина ребра d_avg: <strong className="font-mono text-amber-900">{hoveredPoint.lenVal.toFixed(6)}</strong>
                </div>
                <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded-md">
                  M_phys ср: <strong className="font-mono text-emerald-900">{hoveredPoint.m_phys_avg.toFixed(1)}</strong>
                </div>
                <div className="bg-indigo-50 text-indigo-800 border border-indigo-100 px-2 py-0.5 rounded-md">
                  M_max ср: <strong className="font-mono text-indigo-900">{hoveredPoint.m_max_avg.toFixed(1)}</strong>
                </div>
              </div>
            </div>
          ) : hoveredLineResult ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {(() => {
                  const curveKey = `${hoveredLineResult.experiment_id}_${hoveredLineResult.space_type}_${hoveredLineResult.distribution_type}_${hoveredLineResult.lambda}`;
                  const idx = resultsList.indexOf(hoveredLineResult);
                  const currentColor = customColors[curveKey] || colors[idx % colors.length];
                  return <span className="h-2.5 w-2.5 rounded shadow-sm" style={{ backgroundColor: currentColor }} />;
                })()}
                <span className="font-bold text-gray-800">{getSpaceRuLocal(hoveredLineResult.space_type)} ({getDistRuLocal(hoveredLineResult.distribution_type)})</span>
                <span className="text-gray-400 font-mono">λ = {hoveredLineResult.lambda.toFixed(5)}</span>
              </div>
              <div className="flex items-center gap-4 text-[11px] font-mono">
                <div>
                  <span className="text-gray-500">M_phys (ср):</span> <strong className="text-emerald-700">{hoveredLineResult.m_phys_avg.toFixed(2)}</strong>
                </div>
                <div>
                  <span className="text-gray-500">M_max (ср):</span> <strong className="text-indigo-700">{hoveredLineResult.m_max_avg.toFixed(2)}</strong>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-400 italic text-center text-[10px] py-1.5 uppercase tracking-wide font-bold">
              Наведите курсор на графическую линию или отдельную точку для получения подробных численных координат.
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderHistogram = (resultsList: any[], field: 'm_phys_list' | 'm_max_list', titleStr: string) => {
    let allValues: number[] = [];
    resultsList.forEach((r) => {
      if (r[field]) {
        allValues.push(...r[field]);
      }
    });

    if (allValues.length === 0) {
      allValues = [0, 100];
    }

    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const range = Math.max(1, maxVal - minVal);
    const valDiff = maxVal - minVal;
    
    const isAllIntegers = allValues.every((v) => Number.isInteger(v));
    const isSmallIntRange = isAllIntegers && valDiff >= 0 && valDiff <= 15;
    const binCount = isSmallIntRange ? Math.round(valDiff) + 1 : 12;
    const binWidth = isSmallIntRange ? 1 : (valDiff === 0 ? 1 : valDiff / binCount);

    const binnedSeries = resultsList.map((r, rIdx) => {
      const bins = new Array(binCount).fill(0);
      const values = r[field] || [];
      values.forEach((v: number) => {
        let bIdx = Math.floor((v - minVal) / binWidth);
        if (bIdx >= binCount) bIdx = binCount - 1;
        if (bIdx < 0) bIdx = 0;
        bins[bIdx]++;
      });

      const curveKey = `${r.experiment_id}_${r.space_type}_${r.distribution_type}_${r.lambda}`;
      const defaultColor = colors[rIdx % colors.length];
      const currentColor = customColors[curveKey] || defaultColor;

      return {
        rIdx,
        bins,
        color: currentColor,
        curveKey,
        label: r.label,
      };
    });

    let maxFreq = 0;
    binnedSeries.forEach((s) => {
      const peak = Math.max(...s.bins);
      if (peak > maxFreq) maxFreq = peak;
    });
    if (maxFreq === 0) maxFreq = 1;

    const width = 500;
    const height = 180;
    const padding = 35;

    const scaleX = (binIdx: number) => {
      return padding + (binIdx / binCount) * (width - padding * 2);
    };

    const scaleY = (freq: number) => {
      return height - padding - (freq / maxFreq) * (height - padding * 2);
    };

    const renderBinXLabel = (binIdx: number) => {
      const val = minVal + binIdx * binWidth;
      if (isSmallIntRange) {
        return val.toFixed(0);
      }
      if (range < 5) {
        return val.toFixed(2);
      }
      if (range < 50) {
        return val.toFixed(1);
      }
      return val >= 1000 ? `${(val/1000).toFixed(1)}k` : val.toFixed(0);
    };

    return (
      <div className="relative bg-white p-4 border border-gray-200 rounded-lg shadow-sm font-bold">
        <h4 className="text-xs font-bold text-[#2c3e50] uppercase mb-2">{titleStr}</h4>
        
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#bdc3c7" strokeWidth={1} />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#bdc3c7" strokeWidth={1} />
          
          {[0, 0.5, 1.0].map((term) => {
            const freq = Math.round(term * maxFreq);
            const y = scaleY(freq);
            return (
              <g key={term}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#f0f3f4" strokeWidth={0.5} strokeDasharray="2,2" />
                <text x={padding - 6} y={y + 3} textAnchor="end" className="text-[8px] fill-gray-500 font-mono font-semibold">
                  {freq}
                </text>
              </g>
            );
          })}

          {Array.from({ length: binCount }).map((_, bIdx) => {
            const xStart = scaleX(bIdx);
            const xEnd = scaleX(bIdx + 1);
            const wOuter = xEnd - xStart;
            
            return binnedSeries.map((s, idx) => {
              const freq = s.bins[bIdx];
              if (freq === 0) return null;
              
              const hValue = (freq / maxFreq) * (height - padding * 2);
              const yStart = height - padding - hValue;
              
              const seriesCount = binnedSeries.length;
              const barWidth = wOuter / seriesCount * 0.85;
              const xShifted = xStart + idx * (wOuter / seriesCount) + wOuter/seriesCount*0.075;

              const isBarHighlighted = hoveredLine === s.curveKey;
              const isSomeLineHighlighted = hoveredLine !== null;

              const labelClean = s.label?.split('[')[0] || '';
              const binRangeStr = isSmallIntRange
                ? `M = ${minVal + bIdx}`
                : `Интервал [${renderBinXLabel(bIdx)} - ${renderBinXLabel(bIdx + 1)}]`;

              const isBarHovered = hoveredBar && 
                hoveredBar.field === field && 
                hoveredBar.curveKey === s.curveKey && 
                hoveredBar.bIdx === bIdx;

              return (
                <rect
                  key={s.rIdx}
                  x={xShifted}
                  y={yStart}
                  width={barWidth}
                  height={hValue}
                  fill={s.color}
                  fillOpacity={isBarHovered ? 1.0 : (isSomeLineHighlighted ? (isBarHighlighted ? 0.9 : 0.15) : 0.65)}
                  stroke={isBarHovered || isBarHighlighted ? "#2c3e50" : "#7f8c8d"}
                  strokeWidth={isBarHovered ? 1.5 : (isBarHighlighted ? 1 : 0.5)}
                  className="transition duration-100 cursor-help"
                  onMouseEnter={() => {
                    setHoveredLine(s.curveKey);
                    setHoveredBar({
                      field,
                      curveKey: s.curveKey,
                      bIdx,
                      freq,
                      x: xShifted + barWidth / 2,
                      y: yStart,
                      color: s.color,
                      label: labelClean,
                      binRangeStr,
                    });
                  }}
                  onMouseLeave={() => {
                    setHoveredLine(null);
                    setHoveredBar(null);
                  }}
                />
              );
            });
          })}

          {Array.from({ length: binCount + 1 }).map((_, bIdx) => {
            if (binCount > 8 && bIdx % 2 !== 0 && bIdx !== binCount) return null;
            const x = scaleX(bIdx);
            return (
              <text key={bIdx} x={x} y={height - padding + 13} textAnchor="middle" className="text-[8px] fill-gray-500 font-mono font-semibold">
                {renderBinXLabel(bIdx)}
              </text>
            );
          })}
        </svg>

        {hoveredBar && hoveredBar.field === field && (
          <div 
            className="absolute z-35 pointer-events-none bg-slate-900/95 backdrop-blur text-white border border-slate-700/80 p-2.5 rounded-lg shadow-xl text-[10px] leading-relaxed max-w-[210px]"
            style={{
              left: `${(hoveredBar.x / width) * 100}%`,
              top: `${(hoveredBar.y / height) * 100}%`,
              transform: 'translate(-50%, -100%) translateY(-8px)',
            }}
          >
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900/95" />
            
            <div className="flex items-center gap-1.5 font-bold mb-1 pb-1 border-b border-slate-800 text-slate-200">
              <span className="h-2 w-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: hoveredBar.color }} />
              <span className="truncate">{hoveredBar.label}</span>
            </div>
            
            <div className="space-y-1 font-mono">
              <div className="text-amber-400 font-bold">
                {hoveredBar.binRangeStr}
              </div>
              <div className="flex justify-between gap-3 pt-0.5 border-t border-slate-800/50">
                <span className="text-slate-400">Частота:</span>
                <span className="text-sky-300 font-bold">
                  {hoveredBar.freq} {hoveredBar.freq === 1 ? 'повтор' : (hoveredBar.freq > 1 && hoveredBar.freq < 5 ? 'повтора' : 'повторов')}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-[#2c3e50] font-sans">
      <div className="lg:col-span-4 bg-white border border-[#e0e0e0] p-5 rounded-xl shadow-sm">
        <h2 className="text-sm font-bold text-[#2c3e50] uppercase tracking-wider mb-4 pb-2 border-b border-[#eee] flex items-center gap-1.5">
          <span>Параметры симуляции</span>
          <InfoTooltip text="Настройки масштабного статистического прогона экспериментов средней длины ребер на различных моделях (LPN, ER, BA) в пространстве." />
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-bold">
          <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg leading-relaxed shadow-inner">
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
              Название эксперимента (Формируется автоматически)
            </label>
            <div className="text-xs font-bold text-[#3498db] break-words">
              {`N=${formData.N}, λ=[${formData.lambdasString.split(',').map(x => x.trim()).filter(x => x.length > 0).join('; ')}], Модели: ${formData.model_types.map(m => m.toUpperCase()).join('+')}, Область: ${formData.spaces.map(s => s === 'cube' ? 'Куб' : s === 'sphere' ? 'Шар' : s).join('+')}, Распределение: ${formData.distributions.map(d => d === 'random' ? 'Равномерное' : d === 'gaussian' ? 'Гаусс' : d === 'grid' ? 'Сетка' : d === 'fractal_tetrahedron' ? 'Тетраэдр (в кубе)' : d === 'fractal_tetrahedron_cropped' ? 'Тетраэдр (вырезан)' : d === 'fractal_octahedron' ? 'Октаэдр (в кубе)' : d === 'fractal_octahedron_cropped' ? 'Октаэдр (вырезан)' : d === 'fractal_menger' ? 'Губка' : d === 'fractal_cube' ? 'Кантор' : d).join('+')}`}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center">
              <span>Количество узлов сети N</span>
              <InfoTooltip text="Количество генерируемых центров сфер (узлов сетей) на один прогон." />
            </label>
            <input
              type="text"
              name="N"
              value={stringInputs.N ?? formData.N ?? ''}
              onChange={handleStringChange}
              className="w-full bg-white border border-gray-300 px-3 py-1.5 text-black font-mono font-bold rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3498db]/50 focus:border-[#3498db] shadow-sm transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 border-b border-gray-200 pb-0.5 flex items-center">
              <span>Варьируемые значения λ (через запятую)</span>
              <InfoTooltip text="Шаг варьирования параметра исключения. Будет построена отдельная статистическая кривая усадки для каждого значения." />
            </label>
            <input
              type="text"
              name="lambdasString"
              value={formData.lambdasString}
              onChange={handleInputChange}
              className="w-full bg-white border border-gray-300 px-3 py-1.5 text-black font-mono text-xs font-bold rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3498db]/50 focus:border-[#3498db] shadow-sm transition-all"
              placeholder="0.0001, 0.05, 0.1"
            />
            <p className="text-[10px] text-gray-450 mt-1 italic leading-tight">
              Будет построена отдельная кривая усреднения для каждого аргумента Lambda.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Число прогонов для усреднения
            </label>
            <input
              type="text"
              name="repetitions"
              value={stringInputs.repetitions ?? formData.repetitions ?? ''}
              onChange={handleStringChange}
              className="w-full bg-white border border-gray-300 px-3 py-1.5 text-black font-mono font-bold rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3498db]/50 focus:border-[#3498db] shadow-sm transition-all"
            />
            <p className="text-[10px] text-gray-450 mt-1 italic leading-snug">Больше повторов — более точное распределение в гистограммах.</p>
          </div>

          <div className="bg-gray-50 p-3.5 border border-dashed border-gray-300 rounded-lg">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Физические ограничения</label>
            <div className="flex flex-col gap-2 font-bold text-gray-700">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.node_link_int}
                  onChange={() => setFormData(prev => ({ ...prev, node_link_int: !prev.node_link_int }))}
                  className="rounded text-[#3498db] border-gray-300 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                Исключать пересечения вершин с ребрами
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.nodes_as_points}
                  onChange={() => setFormData(prev => ({ ...prev, nodes_as_points: !prev.nodes_as_points }))}
                  className="rounded text-[#3498db] border-gray-300 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                Вершины как точки (без диаметра)
              </label>
            </div>
          </div>

          <div className="bg-gray-50 p-3.5 border border-dashed border-gray-300 rounded-lg">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Генерация сетевых моделей</label>
            <div className="flex flex-col gap-2 font-bold text-gray-700">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.model_types.includes('lpn')}
                  onChange={() => handleModelTypeToggle('lpn')}
                   className="rounded text-[#3498db] border-gray-300 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                LPN (Линейно-физическая сеть)
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.model_types.includes('er')}
                  onChange={() => handleModelTypeToggle('er')}
                   className="rounded text-[#3498db] border-gray-300 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                ER (Случайная Эрдёша-Реньи)
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.model_types.includes('ba')}
                  onChange={() => handleModelTypeToggle('ba')}
                   className="rounded text-[#3498db] border-gray-300 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                BA (Безмасштабная Барабаши-Альберт)
              </label>
            </div>
          </div>

          <div className="bg-gray-50 p-3.5 border border-dashed border-gray-300 rounded-lg">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Область локализации</label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer select-none font-bold">
                <input
                  type="checkbox"
                  checked={formData.spaces.includes('cube')}
                  onChange={() => handleSpaceToggle('cube')}
                  className="rounded text-[#3498db] border-gray-300 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                3D Куб
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer select-none font-bold">
                <input
                  type="checkbox"
                  checked={formData.spaces.includes('sphere')}
                  onChange={() => handleSpaceToggle('sphere')}
                  className="rounded text-[#3498db] border-gray-300 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                Шар
              </label>
            </div>
          </div>

          <div className="bg-gray-50 p-3.5 border border-dashed border-gray-300 rounded-lg">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Распределение вершин</label>
            <div className="space-y-1.5 text-xs text-gray-700 font-bold">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.distributions.includes('random')}
                  onChange={() => handleDistToggle('random')}
                  className="rounded text-[#3498db] border-gray-300 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                Случайное
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.distributions.includes('gaussian')}
                  onChange={() => handleDistToggle('gaussian')}
                  className="rounded text-[#3498db] border-gray-300 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                Нормальное (Гаусс)
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.distributions.includes('grid')}
                  onChange={() => handleDistToggle('grid')}
                  className="rounded text-[#3498db] border-gray-300 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                Периодическая решетка
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.distributions.includes('fractal_tetrahedron')}
                  onChange={() => handleDistToggle('fractal_tetrahedron')}
                  className="rounded text-[#3498db] border-gray-300 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                Тетраэдр Серпинского (в кубе)
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.distributions.includes('fractal_tetrahedron_cropped')}
                  onChange={() => handleDistToggle('fractal_tetrahedron_cropped')}
                  className="rounded text-[#3498db] border-gray-300 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                Тетраэдр Серпинского (вырезан)
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.distributions.includes('fractal_octahedron')}
                  onChange={() => handleDistToggle('fractal_octahedron')}
                  className="rounded text-[#3498db] border-gray-300 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                Октаэдр Серпинского (в кубе)
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.distributions.includes('fractal_octahedron_cropped')}
                  onChange={() => handleDistToggle('fractal_octahedron_cropped')}
                  className="rounded text-[#3498db] border-gray-300 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                Октаэдр Серпинского (вырезан)
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.distributions.includes('fractal_menger')}
                  onChange={() => handleDistToggle('fractal_menger')}
                  className="rounded text-[#3498db] border-gray-300 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                Губка Менгера
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.distributions.includes('fractal_cube')}
                  onChange={() => handleDistToggle('fractal_cube')}
                  className="rounded text-[#3498db] border-gray-300 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                Канторова пыль
              </label>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#3498db] hover:bg-[#2980b9] disabled:bg-gray-300 disabled:text-gray-500 text-white font-bold py-2.5 px-4 transition rounded-lg shadow-sm flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider text-xs border-0"
            >
              {isLoading ? (
                <>
                  <RotateCw className="animate-spin h-3.5 w-3.5" />
                  Вычисление... ({formData.repetitions} повтор.)
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Запустить расчеты
                </>
              )}
            </button>

            {progress && (
              <div className="mt-4 p-3 bg-indigo-50 border border-indigo-150 rounded-lg shadow-inner">
                <div className="flex justify-between items-center text-[10px] font-bold text-indigo-700 mb-1">
                  <span>Прогресс эксперимента:</span>
                  <span>{progress.current} / {progress.total || 100} ({Math.round((progress.current / (progress.total || 100)) * 100)}%)</span>
                </div>
                <div className="w-full bg-indigo-100 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / (progress.total || 100)) * 100}%` }}
                  />
                </div>
                <p className="text-[9px] text-indigo-500 mt-1 italic font-mono truncate" title={progress.message}>
                  {progress.message}
                </p>
              </div>
            )}
          </div>
        </form>

        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="w-full mt-4 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 font-bold py-2 rounded-lg transition text-xs flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-tight"
        >
          <History className="h-3.5 w-3.5" />
          {showHistory ? 'Скрыть архив экспериментов' : 'Открыть архив экспериментов'}
        </button>

        {showHistory && (
          <div className="mt-3 bg-gray-50 border border-gray-200 p-3 max-h-[220px] overflow-y-auto rounded-lg shadow-inner">
            <h4 className="text-xs font-bold text-[#2c3e50] uppercase mb-2 border-b border-gray-200 pb-1 flex items-center gap-1">
              <span>Архив результатов</span>
            </h4>
            {experiments.length === 0 ? (
              <p className="text-[10px] text-gray-400 text-center py-4">Архив пуст.</p>
            ) : (
              <div className="space-y-2">
                {experiments.map((exp) => (
                  <div 
                    key={exp.id}
                    onClick={() => setActiveExperiment(exp)}
                    className={`p-2 rounded-lg cursor-pointer border text-xs flex items-center justify-between transition-all duration-100 ${
                      activeExperiment?.id === exp.id 
                        ? 'bg-[#f4f7f6] border-[#3498db] text-[#2c3e50] font-bold' 
                        : 'bg-white border-gray-200 hover:border-gray-400 text-gray-600'
                    }`}
                  >
                    <div className="truncate max-w-[170px]">
                      <div className="font-bold truncate">{exp.name}</div>
                      <div className="text-[9px] text-gray-450 font-mono mt-0.5">N: {exp.N} | К-во: {exp.repetitions}</div>
                    </div>
                    
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCompareToggle(exp.id);
                      }}
                      className={`p-1 px-2.5 rounded text-[9px] font-bold transition-all duration-100 cursor-pointer select-none ${
                        compareList.includes(exp.id)
                          ? 'bg-[#f1fcf4] text-[#27ae60] border-0'
                          : 'border border-gray-300 text-gray-600 bg-white hover:bg-gray-50'
                      }`}
                      title="Выбрать для визуального наложения на графики"
                    >
                      {compareList.includes(exp.id) ? (
                        <span className="flex items-center gap-0.5">✓ Выбран</span>
                      ) : (
                        'Сравнить'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="lg:col-span-8 flex flex-col gap-6">
        <div className="bg-white border border-[#e0e0e0] p-5 rounded-xl shadow-sm animate-fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 border-b border-[#eee] pb-3 gap-2">
            <div>
              <h3 className="text-base font-bold text-[#2c3e50] uppercase tracking-wide">
                Графический вывод и верификация модели
              </h3>
              <p className="text-xs text-gray-500 italic mt-0.5">
                {activeExperiment 
                  ? `Активный набор: ${activeExperiment.name} (N = ${activeExperiment.N}, ${activeExperiment.repetitions} повторений)` 
                  : 'Запустите расчеты для построения аналитических зависимостей.'}
              </p>
            </div>
            {compareList.length > 0 && (
              <span className="text-[10px] font-bold bg-[#f1fcf4] text-[#27ae60] px-3 py-1 rounded-full border border-[#d4edda] shrink-0 font-bold">
                Сравнение: {compareList.length} наборов
              </span>
            )}
          </div>

          {combinedResults.length > 0 ? (
            <div className="space-y-6">
              <div className="bg-gray-50 p-3 border border-gray-200 rounded-lg shadow-inner">
                <div className="text-[10px] uppercase font-bold text-gray-500 mb-2 border-b border-gray-200 pb-1.5 flex flex-wrap justify-between items-center gap-2">
                  <span>Условные обозначения кривых (в один клик вы можете менять цвета линий):</span>
                  {Object.keys(customColors).length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCustomColors({})}
                      className="text-[9px] bg-white hover:bg-gray-100 border border-gray-300 text-gray-600 px-2 py-0.5 rounded font-sans cursor-pointer transition select-none"
                    >
                      Сбросить цвета
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {combinedResults.map((r, rIdx) => {
                    const curveKey = `${r.experiment_id}_${r.space_type}_${r.distribution_type}_${r.lambda}`;
                    const defaultColor = colors[rIdx % colors.length];
                    const currentColor = customColors[curveKey] || defaultColor;
                    const isLineActive = hoveredLine === curveKey;
                    return (
                      <div 
                        key={rIdx} 
                        className={`flex items-center gap-1.5 text-xs text-gray-700 font-bold bg-white border px-2.5 py-1 rounded-md shadow-xs transition duration-150 cursor-pointer ${
                          isLineActive ? 'border-[#3498db] ring-1 ring-[#3498db]/30 bg-blue-50/10' : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onMouseEnter={() => setHoveredLine(curveKey)}
                        onMouseLeave={() => setHoveredLine(null)}
                      >
                        <label 
                          className="relative inline-block h-4 w-4 rounded border border-gray-300 shadow-inner cursor-pointer flex-shrink-0"
                          style={{ backgroundColor: currentColor }}
                          title="Выбрать свой цвет для этой кривой"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="color"
                            value={currentColor}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomColors(prev => ({ ...prev, [curveKey]: val }));
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                        </label>
                        <span className="text-[11px] font-mono leading-tight">
                          {r.label || `${r.space_type === 'cube' ? 'Куб' : 'Фрак.'}, λ=${r.lambda.toFixed(5)}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {renderLineChart(combinedResults)}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderHistogram(
                  combinedResults,
                  'm_phys_list',
                  'Распределение M_phys (критическое заклинивание LPN)'
                )}
                {renderHistogram(
                  combinedResults,
                  'm_max_list',
                  'Распределение M_max (предельная емкость упаковки)'
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 border border-dashed border-gray-300 rounded-xl bg-gray-50 text-gray-400 font-sans">
              <HelpCircle className="h-10 w-10 text-gray-400 mb-2 animate-bounce" />
              <p className="text-sm font-bold">Эксперимент не выбран. Пожалуйста, проведите расчеты или выберите архивный набор.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
