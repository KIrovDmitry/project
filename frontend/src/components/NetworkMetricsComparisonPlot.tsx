import React, { useState, useMemo } from 'react';
import { Network, ComparisonProfile, matchNetworkWithProfile } from '../types';
import { InfoTooltip } from './InfoTooltip';

interface NetworkMetricsComparisonPlotProps {
  networks: Network[];
  profiles: ComparisonProfile[];
}

// Все доступные метрики для осей
const METRIC_OPTIONS: Record<string, { label: string; getValue: (n: Network) => number | null; desc: string }> = {
  N: {
    label: 'N (число узлов)',
    getValue: (n) => n.N,
    desc: 'Количество узлов в сети.',
  },
  M: {
    label: 'M (число связей)',
    getValue: (n) => n.links_count,
    desc: 'Количество связей (рёбер) в сети.',
  },
  lambda: {
    label: 'λ (параметр физичности)',
    getValue: (n) => n.lambda,
    desc: 'Параметр физичности λ.',
  },
  C: {
    label: 'C (константа)',
    getValue: (n) => n.C,
    desc: 'Константа C из соотношения λ = C / N^α.',
  },
  alpha: {
    label: 'α (экспонента)',
    getValue: (n) => n.alpha,
    desc: 'Экспонента α из соотношения λ = C / N^α.',
  },
  m_phys: {
    label: 'M_phys (момент физичности)',
    getValue: (n) => n.m_phys ?? null,
    desc: 'Количество связей до начала регулярного отклонения кандидатов.',
  },
  m_max: {
    label: 'M_max (предельная ёмкость)',
    getValue: (n) => n.m_max ?? null,
    desc: 'Максимальное число добавленных связей.',
  },
  l_total: {
    label: 'L_total (суммарная длина)',
    getValue: (n) => n.l_total ?? null,
    desc: 'Суммарная геометрическая длина всех связей.',
  },
  avg_link_length: {
    label: 'Средняя длина связи',
    getValue: (n) => n.characteristics.avg_link_length,
    desc: 'Усреднённая евклидова протяжённость рёбер.',
  },
  avg_degree: {
    label: 'Средняя степень вершин',
    getValue: (n) => n.characteristics.avg_degree,
    desc: 'Количество соединений на один узел.',
  },
  avg_path_length: {
    label: 'Среднее расстояние между вершинами',
    getValue: (n) => n.characteristics.avg_path_length,
    desc: 'Число прыжков (hops) по кратчайшим путям.',
  },
  diameter: {
    label: 'Диаметр графа',
    getValue: (n) => n.characteristics.diameter,
    desc: 'Максимальное расстояние в хопах.',
  },
  clustering_coef: {
    label: 'Средний коэффициент кластеризации',
    getValue: (n) => n.characteristics.clustering_coef,
    desc: 'Плотность треугольников в сети.',
  },
  straightness: {
    label: 'Прямолинейность',
    getValue: (n) => n.characteristics.straightness,
    desc: 'Геометрическое отклонение от идеальных прямых.',
  },
  closeness: {
    label: 'Близость',
    getValue: (n) => n.characteristics.closeness,
    desc: 'Скорость навигации к остальным узлам.',
  },
  efficiency: {
    label: 'Эффективность',
    getValue: (n) => n.characteristics.efficiency,
    desc: 'Общая проводимость физического трафика.',
  },
  info_significance: {
    label: 'Информационная значимость',
    getValue: (n) => n.characteristics.info_significance,
    desc: 'Влияние узлов на связность.',
  },
  connected_components: {
    label: 'Количество компонент связности',
    getValue: (n) => n.characteristics.connected_components,
    desc: 'Общее число изолированных подграфов.',
  },
};

export const NetworkMetricsComparisonPlot: React.FC<NetworkMetricsComparisonPlotProps> = ({
  networks,
  profiles,
}) => {
  const [selectedMetricX, setSelectedMetricX] = useState<string>('N');
  const [selectedMetricY, setSelectedMetricY] = useState<string>('avg_path_length');
  const [showAllPoints, setShowAllPoints] = useState<boolean>(true);
  const [drawAverageLine, setDrawAverageLine] = useState<boolean>(false);
  const [averageLineColor, setAverageLineColor] = useState<string>('#e67e22');
  const [zoomMinX, setZoomMinX] = useState<number | ''>('');
  const [zoomMaxX, setZoomMaxX] = useState<number | ''>('');
  const [zoomMinY, setZoomMinY] = useState<number | ''>('');
  const [zoomMaxY, setZoomMaxY] = useState<number | ''>('');
  const [scaleX, setScaleX] = useState<'linear' | 'log'>('linear');
  const [scaleY, setScaleY] = useState<'linear' | 'log'>('linear');

  const enabledProfiles = profiles.filter((p) => p.enabled);

  const metricX = METRIC_OPTIONS[selectedMetricX];
  const metricY = METRIC_OPTIONS[selectedMetricY];

  // Вычисляем точки для каждого профиля
  const computedLines = useMemo(() => {
    return enabledProfiles.map((prof) => {
      const matchedNets = networks.filter((n) => {
        if (!matchNetworkWithProfile(n, prof)) return false;
        const xVal = metricX.getValue(n);
        const yVal = metricY.getValue(n);
        return xVal !== null && xVal !== undefined && yVal !== null && yVal !== undefined;
      });

      // Группируем по X для усреднения
      const groupedByX: Record<number, number[]> = {};
      matchedNets.forEach((n) => {
        const xVal = metricX.getValue(n) as number;
        const yVal = metricY.getValue(n) as number;
        const xKey = Math.round(xVal * 1000) / 1000;
        if (!groupedByX[xKey]) {
          groupedByX[xKey] = [];
        }
        groupedByX[xKey].push(yVal);
      });

      const averagePoints = Object.entries(groupedByX)
        .map(([xStr, values]) => {
          const xVal = parseFloat(xStr);
          const yVal = values.reduce((sum, v) => sum + v, 0) / (values.length || 1);
          return { x: xVal, y: yVal };
        })
        .sort((a, b) => a.x - b.x);

      const individualPoints = matchedNets.map((n) => ({
        id: n.id,
        name: n.name,
        x: metricX.getValue(n) as number,
        y: metricY.getValue(n) as number,
      }));

      return {
        profile: prof,
        averagePoints,
        individualPoints,
      };
    });
  }, [networks, enabledProfiles, selectedMetricX, selectedMetricY]);

  const allInPoints = computedLines.flatMap((cl) => cl.individualPoints);
  const allXs = allInPoints.map((p) => p.x);
  const allYs = allInPoints.map((p) => p.y);

  // Положительные значения для log-шкалы
  const positiveXs = allXs.filter((v) => v > 0);
  const positiveYs = allYs.filter((v) => v > 0);

  // Границы по умолчанию
  const defaultXMax = scaleX === 'log'
    ? (positiveXs.length > 0 ? Math.max(...positiveXs) * 1.2 : 10)
    : (allXs.length > 0 ? Math.max(...allXs) * 1.08 : 1000);

  const defaultXMin = scaleX === 'log'
    ? (positiveXs.length > 0 ? Math.min(...positiveXs) * 0.8 : 1)
    : 0;

  const defaultYMax = scaleY === 'log'
    ? (positiveYs.length > 0 ? Math.max(...positiveYs) * 1.2 : 10)
    : (allYs.length > 0 ? Math.max(...allYs) * 1.15 : 1.0);

  const defaultYMin = scaleY === 'log'
    ? (positiveYs.length > 0 ? Math.min(...positiveYs) * 0.8 : 0.1)
    : 0;

  const activeMinX = zoomMinX !== '' ? zoomMinX : defaultXMin;
  const activeMaxX = zoomMaxX !== '' ? zoomMaxX : defaultXMax;
  const activeMinY = zoomMinY !== '' ? zoomMinY : defaultYMin;
  const activeMaxY = zoomMaxY !== '' ? zoomMaxY : defaultYMax;

  const width = 600;
  const height = 320;
  const paddingLeft = 60;
  const paddingRight = 30;
  const paddingTop = 20;
  const paddingBottom = 50;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Функции масштабирования с поддержкой log
  const getXCoord = (x: number) => {
    if (scaleX === 'log') {
      if (x <= 0) return paddingLeft;
      const minLog = activeMinX > 0 ? Math.log10(activeMinX) : Math.log10(Math.min(...positiveXs) || 1);
      const maxLog = activeMaxX > 0 ? Math.log10(activeMaxX) : Math.log10(Math.max(...positiveXs) || 10);
      const logX = Math.log10(x);
      const ratio = (logX - minLog) / (maxLog - minLog || 1);
      return paddingLeft + ratio * chartWidth;
    }
    const range = activeMaxX - activeMinX;
    const ratio = range === 0 ? 0.5 : (x - activeMinX) / range;
    return paddingLeft + ratio * chartWidth;
  };

  const getYCoord = (y: number) => {
    if (scaleY === 'log') {
      if (y <= 0) return paddingTop + chartHeight;
      const minLog = activeMinY > 0 ? Math.log10(activeMinY) : Math.log10(Math.min(...positiveYs) || 1);
      const maxLog = activeMaxY > 0 ? Math.log10(activeMaxY) : Math.log10(Math.max(...positiveYs) || 10);
      const logY = Math.log10(y);
      const ratio = (logY - minLog) / (maxLog - minLog || 1);
      return paddingTop + chartHeight * (1 - ratio);
    }
    const range = activeMaxY - activeMinY;
    const ratio = range === 0 ? 0.5 : (y - activeMinY) / range;
    return paddingTop + chartHeight * (1 - ratio);
  };

  // Генерация тиков для осей
  const generateTicks = (min: number, max: number, isLog: boolean, count: number = 5): number[] => {
    if (isLog) {
      const ticks: number[] = [];
      const minVal = Math.max(min, 0.001);
      const maxVal = Math.max(max, minVal * 10);

      const minLog = Math.floor(Math.log10(minVal));
      const maxLog = Math.ceil(Math.log10(maxVal));

      for (let p = minLog; p <= maxLog; p++) {
        const tick = Math.pow(10, p);
        if (tick >= minVal && tick <= maxVal) {
          ticks.push(tick);
        }
      }

      if (ticks.length < 3 && maxLog - minLog <= 1) {
        const step = (maxVal - minVal) / 5;
        for (let i = 0; i <= 5; i++) {
          const tick = minVal + step * i;
          if (tick > 0) ticks.push(tick);
        }
      }

      return ticks.sort((a, b) => a - b);
    }

    const step = (max - min) / count;
    const ticks: number[] = [];
    for (let i = 0; i <= count; i++) {
      ticks.push(min + step * i);
    }
    return ticks;
  };

  const xTicks = generateTicks(activeMinX, activeMaxX, scaleX === 'log');
  const yTicks = generateTicks(activeMinY, activeMaxY, scaleY === 'log');

  // Форматирование тиков
  const formatTick = (val: number): string => {
    if (Math.abs(val) >= 10000) return val.toExponential(1);
    if (Math.abs(val) < 0.01 && val !== 0) return val.toExponential(1);
    if (Number.isInteger(val)) return val.toString();
    return val.toFixed(3);
  };

  // Усреднение по всем точкам для общей средней линии
  const overallGroupedByX: Record<number, number[]> = {};
  computedLines.forEach((line) => {
    line.individualPoints.forEach((p) => {
      const xKey = Math.round(p.x * 1000) / 1000;
      if (!overallGroupedByX[xKey]) {
        overallGroupedByX[xKey] = [];
      }
      overallGroupedByX[xKey].push(p.y);
    });
  });

  const averageLinePoints = Object.entries(overallGroupedByX)
    .map(([xStr, vals]) => {
      const x = parseFloat(xStr);
      const y = vals.reduce((sum, v) => sum + v, 0) / (vals.length || 1);
      return { x, y };
    })
    .sort((a, b) => a.x - b.x);

  const avgPathD = averageLinePoints
    .map((p, pIdx) => {
      const xText = getXCoord(p.x);
      const yText = getYCoord(p.y);
      return `${pIdx === 0 ? 'M' : 'L'} ${xText} ${yText}`;
    })
    .join(' ');

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mt-8">
      <div className="border-b border-gray-150 pb-4 mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
            <span>График зависимости свойств</span>
            <InfoTooltip text="График зависимости выбранной числовой метрики (Y) от другой метрики (X) по активным профилям. Можно выбрать любые свойства для обеих осей и переключать линейный/логарифмический масштаб." />
          </h3>
          <p className="text-[10px] text-gray-500 italic mt-0.5">
            Выберите метрики для осей X и Y, а также тип шкалы (линейная/логарифмическая).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-[10px] font-bold uppercase text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors">
            <input
              type="checkbox"
              checked={showAllPoints}
              onChange={(e) => setShowAllPoints(e.target.checked)}
              className="rounded text-indigo-500 border-indigo-300 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
            />
            Все точки
          </label>
        </div>
      </div>

      {/* Селекторы метрик для осей */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Ось X */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">
            Ось X (независимая переменная)
          </label>
          <select
            value={selectedMetricX}
            onChange={(e) => setSelectedMetricX(e.target.value)}
            className="w-full bg-white border border-gray-300 px-3 py-1.5 text-xs font-bold rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3498db]"
          >
            {Object.entries(METRIC_OPTIONS).map(([key, item]) => (
              <option key={key} value={key}>
                {item.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[9px] text-gray-500 font-bold">Шкала:</span>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={scaleX === 'log'}
                onChange={(e) => setScaleX(e.target.checked ? 'log' : 'linear')}
                className="rounded text-[#3498db] border-gray-300 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
              />
              <span className="text-[10px] font-bold text-gray-700">Логарифмическая</span>
            </label>
          </div>
        </div>

        {/* Ось Y */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">
            Ось Y (зависимая переменная)
          </label>
          <select
            value={selectedMetricY}
            onChange={(e) => setSelectedMetricY(e.target.value)}
            className="w-full bg-white border border-gray-300 px-3 py-1.5 text-xs font-bold rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3498db]"
          >
            {Object.entries(METRIC_OPTIONS).map(([key, item]) => (
              <option key={key} value={key}>
                {item.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[9px] text-gray-500 font-bold">Шкала:</span>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={scaleY === 'log'}
                onChange={(e) => setScaleY(e.target.checked ? 'log' : 'linear')}
                className="rounded text-[#3498db] border-gray-300 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
              />
              <span className="text-[10px] font-bold text-gray-700">Логарифмическая</span>
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 flex flex-col justify-between">
          <div className="relative border border-gray-50 p-2 rounded-lg bg-[#fafbfc]/30">
            {allInPoints.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-xs italic">
                Нет данных для отображения. Включите хотя бы один настроенный профиль в меню выше или рассчитайте свойства баз сетей.
              </div>
            ) : (
              <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
                <defs>
                  <clipPath id="chart-clip">
                    <rect x={paddingLeft} y={paddingTop} width={chartWidth} height={chartHeight} />
                  </clipPath>
                </defs>

                {/* Горизонтальные сетки и подписи Y */}
                {yTicks.map((yVal, idx) => {
                  const y = getYCoord(yVal);
                  if (y < paddingTop || y > paddingTop + chartHeight) return null;
                  return (
                    <g key={`y-${idx}`}>
                      <line
                        x1={paddingLeft}
                        y1={y}
                        x2={width - paddingRight}
                        y2={y}
                        stroke="#f0f0f0"
                        strokeWidth="1"
                      />
                      <text
                        x={paddingLeft - 8}
                        y={y + 3}
                        textAnchor="end"
                        className="fill-gray-400 font-mono text-[9px] font-semibold"
                      >
                        {formatTick(yVal)}
                      </text>
                    </g>
                  );
                })}

                {/* Вертикальные сетки и подписи X */}
                {xTicks.map((xVal, idx) => {
                  const x = getXCoord(xVal);
                  if (x < paddingLeft || x > width - paddingRight) return null;
                  return (
                    <g key={`x-${idx}`}>
                      <line
                        x1={x}
                        y1={paddingTop}
                        x2={x}
                        y2={paddingTop + chartHeight}
                        stroke="#f5f5f5"
                        strokeWidth="1"
                      />
                      <text
                        x={x}
                        y={paddingTop + chartHeight + 14}
                        textAnchor="middle"
                        className="fill-gray-400 font-mono text-[9px] font-semibold"
                      >
                        {formatTick(xVal)}
                      </text>
                    </g>
                  );
                })}

                {/* Оси */}
                <line
                  x1={paddingLeft}
                  y1={paddingTop + chartHeight}
                  x2={width - paddingRight}
                  y2={paddingTop + chartHeight}
                  stroke="#ddd"
                  strokeWidth="1.5"
                />
                <line
                  x1={paddingLeft}
                  y1={paddingTop}
                  x2={paddingLeft}
                  y2={paddingTop + chartHeight}
                  stroke="#ddd"
                  strokeWidth="1.5"
                />

                {/* Подписи осей */}
                <text
                  x={paddingLeft + chartWidth / 2}
                  y={height - 5}
                  textAnchor="middle"
                  className="fill-gray-600 font-sans text-[10px] font-bold"
                >
                  {metricX.label}
                </text>
                <text
                  x={12}
                  y={paddingTop + chartHeight / 2}
                  textAnchor="middle"
                  transform={`rotate(-90, 12, ${paddingTop + chartHeight / 2})`}
                  className="fill-gray-600 font-sans text-[10px] font-bold"
                >
                  {metricY.label}
                </text>

                <g clipPath="url(#chart-clip)">
                  {/* Общая средняя линия */}
                  {drawAverageLine && averageLinePoints.length > 1 && (
                    <g>
                      <path
                        d={avgPathD}
                        fill="none"
                        stroke={averageLineColor}
                        strokeWidth="3.5"
                        strokeDasharray="6,4"
                        strokeLinecap="round"
                        className="opacity-95"
                      />
                      {averageLinePoints.map((p, pIdx) => {
                        const cx = getXCoord(p.x);
                        const cy = getYCoord(p.y);
                        return (
                          <g key={`avg-${pIdx}`} className="group/dot cursor-pointer">
                            <circle
                              cx={cx}
                              cy={cy}
                              r="5"
                              fill={averageLineColor}
                              stroke="#fff"
                              strokeWidth="2"
                            />
                            <title>
                              Средний тренд: {metricX.label}={p.x.toFixed(3)}, {metricY.label}={p.y.toFixed(5)}
                            </title>
                          </g>
                        );
                      })}
                    </g>
                  )}

                  {/* Кривые по профилям */}
                  {computedLines.map((line) => {
                    const filteredAverages = line.averagePoints.filter((p) => {
                      if (scaleX === 'log' && p.x <= 0) return false;
                      if (scaleY === 'log' && p.y <= 0) return false;
                      return p.x >= activeMinX && p.x <= activeMaxX && p.y >= activeMinY && p.y <= activeMaxY;
                    });

                    const trendlineD = filteredAverages
                      .map((p, pIdx) => {
                        const xText = getXCoord(p.x);
                        const yText = getYCoord(p.y);
                        return `${pIdx === 0 ? 'M' : 'L'} ${xText} ${yText}`;
                      })
                      .join(' ');

                    return (
                      <g key={line.profile.id}>
                        {filteredAverages.length > 1 && (
                          <path
                            d={trendlineD}
                            fill="none"
                            stroke={line.profile.color}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="opacity-80"
                          />
                        )}
                        {showAllPoints &&
                          line.individualPoints
                            .filter((p) => {
                              if (scaleX === 'log' && p.x <= 0) return false;
                              if (scaleY === 'log' && p.y <= 0) return false;
                              return p.x >= activeMinX && p.x <= activeMaxX && p.y >= activeMinY && p.y <= activeMaxY;
                            })
                            .map((p, idx) => {
                              const cx = getXCoord(p.x);
                              const cy = getYCoord(p.y);
                              return (
                                <g key={`${p.id}-${idx}`} className="group/dot cursor-pointer">
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r="3.5"
                                    fill="transparent"
                                    stroke={line.profile.color}
                                    strokeWidth="1.2"
                                    className="opacity-60 group-hover/dot:opacity-100 transition-opacity"
                                  />
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r="10"
                                    fill="transparent"
                                    className="cursor-pointer"
                                  />
                                  <title>
                                    Сеть: {p.name}{'\n'}
                                    Профиль: {line.profile.name}{'\n'}
                                    {metricX.label} = {p.x.toFixed(5)}{'\n'}
                                    {metricY.label} = {p.y.toFixed(5)}
                                  </title>
                                </g>
                              );
                            })}
                        {filteredAverages.map((p, pIdx) => {
                          const cx = getXCoord(p.x);
                          const cy = getYCoord(p.y);
                          return (
                            <g key={pIdx} className="group/dot cursor-pointer">
                              <circle
                                cx={cx}
                                cy={cy}
                                r="5.5"
                                fill={line.profile.color}
                                stroke="#fff"
                                strokeWidth="2"
                                className="group-hover/dot:scale-110 origin-center transition-transform"
                                style={{ transformOrigin: `${cx}px ${cy}px` }}
                              />
                              <circle
                                cx={cx}
                                cy={cy}
                                r="14"
                                fill="transparent"
                                className="cursor-pointer"
                              />
                              <title>
                                Профиль: {line.profile.name} (Среднее){'\n'}
                                {metricX.label} = {p.x.toFixed(5)}{'\n'}
                                {metricY.label} = {p.y.toFixed(5)}
                              </title>
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}
                </g>
              </svg>
            )}
          </div>

          {/* Зум */}
          <div className="flex flex-wrap items-center justify-end gap-4 bg-gray-50 border border-gray-250 p-3.5 rounded-lg mt-3 text-xs shadow-inner">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold text-gray-700 uppercase text-[10px]">Масштабирование (Зум):</span>
              <div className="flex items-center gap-1">
                <span className="text-gray-400 font-mono text-[10px]">X:</span>
                <input
                  type="number"
                  placeholder="Min"
                  value={zoomMinX}
                  onChange={(e) => setZoomMinX(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-14 bg-white border border-gray-300 px-1.5 py-0.5 font-mono text-[10px] text-center rounded focus:outline-none focus:ring-1 focus:ring-[#3498db]"
                />
                <span className="text-gray-350 font-mono">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={zoomMaxX}
                  onChange={(e) => setZoomMaxX(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-16 bg-white border border-gray-300 px-1.5 py-0.5 font-mono text-[10px] text-center rounded focus:outline-none focus:ring-1 focus:ring-[#3498db]"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-400 font-mono text-[10px]">Y:</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Min"
                  value={zoomMinY}
                  onChange={(e) => setZoomMinY(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-14 bg-white border border-gray-300 px-1.5 py-0.5 font-mono text-[10px] text-center rounded focus:outline-none focus:ring-1 focus:ring-[#3498db]"
                />
                <span className="text-[#bbb] font-mono">-</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Max"
                  value={zoomMaxY}
                  onChange={(e) => setZoomMaxY(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-16 bg-white border border-gray-300 px-1.5 py-0.5 font-mono text-[10px] text-center rounded focus:outline-none focus:ring-1 focus:ring-[#3498db]"
                />
              </div>
              {(zoomMinX !== '' || zoomMaxX !== '' || zoomMinY !== '' || zoomMaxY !== '') && (
                <button
                  type="button"
                  onClick={() => {
                    setZoomMinX('');
                    setZoomMaxX('');
                    setZoomMinY('');
                    setZoomMaxY('');
                  }}
                  className="text-[9px] font-bold bg-[#e74c3c] hover:bg-red-600 text-white px-2 py-1 rounded cursor-pointer border-0"
                >
                  Сбросить зум
                </button>
              )}
            </div>
          </div>

          <div className="text-[10px] text-gray-500 leading-normal bg-gray-50 border border-gray-100 p-2.5 rounded-lg font-sans mt-3">
            <strong>Интерпретация:</strong> {metricY.desc}{' '}
            {showAllPoints && 'Если опция «Все точки» активна, вы увидите полупрозрачные ободки для каждой конкретной модели из SQLite базы данных. '}
            Линия отражает математически усредненное значение метрики для каждого значения X.
          </div>
        </div>

        {/* Правая панель */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          <div className="border border-gray-150 p-4 rounded-xl bg-gray-50/70">
            <h4 className="text-[11px] font-bold uppercase text-gray-650 tracking-wider mb-3">
              Линия общего среднего
            </h4>
            <div className="space-y-2 mb-4">
              <div
                className={`p-2.5 border rounded-lg transition-all flex justify-between items-center ${
                  drawAverageLine
                    ? 'bg-amber-50/70 border-amber-300 shadow-xs'
                    : 'bg-white border-gray-200 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="draw_average_line_comparison"
                    checked={drawAverageLine}
                    onChange={() => setDrawAverageLine(!drawAverageLine)}
                    className="rounded text-amber-500 border-gray-300 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                  />
                  <div>
                    <label
                      htmlFor="draw_average_line_comparison"
                      className="font-bold text-gray-800 text-[10px] cursor-pointer block leading-none"
                    >
                      Профиль: Линия средних
                    </label>
                    <span className="text-[9px] text-gray-400 font-semibold block mt-0.5">
                      Общее усреднение по всем сетям
                    </span>
                  </div>
                </div>
                <div className="flex items-center shrink-0">
                  <input
                    type="color"
                    value={averageLineColor}
                    onChange={(e) => setAverageLineColor(e.target.value)}
                    className="w-5 h-5 cursor-pointer border-0 rounded p-0 bg-transparent"
                    title="Выбрать цвет средней линии"
                  />
                </div>
              </div>
            </div>

            <h4 className="text-[11px] font-bold uppercase text-gray-650 tracking-wider mb-2">
              Активные фильтры профилей
            </h4>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {enabledProfiles.map((prof) => {
                const matchedCount = networks.filter((n) => {
                  if (!matchNetworkWithProfile(n, prof)) return false;
                  const xVal = metricX.getValue(n);
                  const yVal = metricY.getValue(n);
                  return xVal !== null && xVal !== undefined && yVal !== null && yVal !== undefined;
                }).length;
                return (
                  <div
                    key={prof.id}
                    className="p-2 border border-gray-200 rounded-lg bg-white flex flex-col gap-0.5 text-[10px] font-bold"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 rounded-full h-2 block shrink-0"
                        style={{ backgroundColor: prof.color }}
                      />
                      <span className="text-gray-800 truncate" title={prof.name}>
                        {prof.name}
                      </span>
                    </div>
                    <div className="text-[9px] text-gray-450 font-semibold font-mono pl-3.5 font-bold">
                      Учтено {matchedCount} рассчитанных сетей
                    </div>
                  </div>
                );
              })}
              {enabledProfiles.length === 0 && (
                <p className="text-[10px] text-gray-400 italic">Активные профили не отмечены.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};