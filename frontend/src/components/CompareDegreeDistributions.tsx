import React, { useState, useEffect } from 'react';
import { Network, ComparisonProfile, matchNetworkWithProfile } from '../types';
import { RefreshCw, Check } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';

interface CompareDegreeDistributionsProps {
  networks: Network[];
  profiles: ComparisonProfile[];
}

interface NetworkDetails {
  id: number;
  nodes: number[][];
  links: number[][];
}

export const CompareDegreeDistributions: React.FC<CompareDegreeDistributionsProps> = ({
  networks,
  profiles,
}) => {
  const [cache, setCache] = useState<Record<number, NetworkDetails>>({});
  const [loadingIds, setLoadingIds] = useState<number[]>([]);
  const [displayMode, setDisplayMode] = useState<'profiles' | 'networks'>('profiles');
  const [hoveredK, setHoveredK] = useState<number | null>(null);

  const enabledProfiles = profiles.filter((p) => p.enabled);
  const activeNetworks = networks.filter((net) =>
    enabledProfiles.some((prof) => matchNetworkWithProfile(net, prof))
  );

  useEffect(() => {
    activeNetworks.forEach((net) => {
      const id = net.id;
      if (!cache[id] && !loadingIds.includes(id)) {
        setLoadingIds((prev) => [...prev, id]);
        fetch(`/api/networks/${id}/details`)
          .then((res) => {
            if (!res.ok) throw new Error(`Failed to load network ${id} details`);
            return res.json();
          })
          .then((data: NetworkDetails) => {
            setCache((prev) => ({ ...prev, [id]: data }));
            setLoadingIds((prev) => prev.filter((loadingId) => loadingId !== id));
          })
          .catch((err) => {
            console.error(`Error loading network details for ${id}:`, err);
            setLoadingIds((prev) => prev.filter((loadingId) => loadingId !== id));
          });
      }
    });
  }, [activeNetworks, cache, loadingIds]);

  const getNetworkDistribution = (net: Network) => {
    const details = cache[net.id];
    if (!details) return [];
    const n = net.N || details.nodes.length;
    if (n === 0) return [];
    const degrees = new Array(n).fill(0);
    details.links.forEach(([u, v]) => {
      if (u >= 0 && u < n) degrees[u]++;
      if (v >= 0 && v < n) degrees[v]++;
    });

    const counts: Record<number, number> = {};
    degrees.forEach((d) => {
      counts[d] = (counts[d] || 0) + 1;
    });

    const maxDeg = Math.max(...degrees, 0);
    const distribution: { k: number; p: number }[] = [];
    for (let k = 0; k <= maxDeg; k++) {
      const c = counts[k] || 0;
      distribution.push({ k, p: c / n });
    }
    return distribution;
  };

  const netDistributions: Record<number, { k: number; p: number }[]> = {};
  let maxDegreeGlobal = 0;

  activeNetworks.forEach((net) => {
    if (!cache[net.id]) return;
    const dist = getNetworkDistribution(net);
    netDistributions[net.id] = dist;
    if (dist.length - 1 > maxDegreeGlobal) {
      maxDegreeGlobal = dist.length - 1;
    }
  });

  interface CurveData {
    id: string;
    name: string;
    profileName: string;
    color: string;
    distribution: { k: number; p: number }[];
    isProfileAverage: boolean;
    networkCount?: number;
  }

  const curves: CurveData[] = [];

  if (displayMode === 'profiles') {
    enabledProfiles.forEach((prof) => {
      const matchedAndCached = activeNetworks.filter(
        (net) => matchNetworkWithProfile(net, prof) && cache[net.id]
      );
      if (matchedAndCached.length === 0) return;

      const avgDistribution: { k: number; p: number }[] = [];
      for (let k = 0; k <= maxDegreeGlobal; k++) {
        let sumP = 0;
        let count = 0;
        matchedAndCached.forEach((net) => {
          const dist = netDistributions[net.id];
          if (dist) {
            const item = dist.find((d) => d.k === k);
            if (item) {
              sumP += item.p;
              count++;
            } else if (k <= dist.length - 1) {
              count++;
            }
          }
        });
        if (count > 0) {
          avgDistribution.push({ k, p: sumP / matchedAndCached.length });
        }
      }

      curves.push({
        id: prof.id,
        name: `${prof.name} (среднее)`,
        profileName: prof.name,
        color: prof.color,
        distribution: avgDistribution,
        isProfileAverage: true,
        networkCount: matchedAndCached.length,
      });
    });
  } else {
    enabledProfiles.forEach((prof) => {
      const matchedAndCached = activeNetworks.filter(
        (net) => matchNetworkWithProfile(net, prof) && cache[net.id]
      );
      matchedAndCached.forEach((net) => {
        const dist = netDistributions[net.id];
        if (!dist) return;

        curves.push({
          id: `${prof.id}-${net.id}`,
          name: `${prof.name} • ${net.name}`,
          profileName: prof.name,
          color: prof.color,
          distribution: dist,
          isProfileAverage: false,
        });
      });
    });
  }

  let maxPGlobal = 0.05;
  curves.forEach((c) => {
    c.distribution.forEach((item) => {
      if (item.p > maxPGlobal) maxPGlobal = item.p;
    });
  });
  maxPGlobal = Math.max(0.1, Math.ceil(maxPGlobal * 10) / 10);

  const width = 600;
  const height = 280;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 30;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const getX = (k: number) => {
    if (maxDegreeGlobal === 0) return paddingLeft;
    return paddingLeft + (k / maxDegreeGlobal) * chartWidth;
  };

  const getY = (p: number) => {
    return paddingTop + chartHeight * (1 - p / maxPGlobal);
  };

  const makePathD = (dist: { k: number; p: number }[]) => {
    const coordinates = dist.map((item) => `${getX(item.k)},${getY(item.p)}`);
    return coordinates.length > 0 ? `M ${coordinates.join(' L ')}` : '';
  };

  const makeAreaPathD = (dist: { k: number; p: number }[]) => {
    if (dist.length === 0) return '';
    const points = dist.map((item) => `${getX(item.k)},${getY(item.p)}`);
    const firstX = getX(dist[0].k);
    const lastX = getX(dist[dist.length - 1].k);
    const bottomY = paddingTop + chartHeight;
    return `M ${firstX},${bottomY} L ${points.join(' L ')} L ${lastX},${bottomY} Z`;
  };

  const xTicks: number[] = [];
  const stepX = maxDegreeGlobal <= 10 ? 1 : maxDegreeGlobal <= 25 ? 2 : maxDegreeGlobal <= 100 ? 10 : 20;
  for (let k = 0; k <= maxDegreeGlobal; k += stepX) {
    xTicks.push(k);
  }
  if (!xTicks.includes(maxDegreeGlobal)) {
    xTicks.push(maxDegreeGlobal);
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => r * maxPGlobal);
  const isSomeLoading = loadingIds.length > 0;

  return (
    <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 mt-6 font-sans">
      <div className="border-b border-gray-150 pb-3 mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#2c3e50] uppercase tracking-wider flex items-center gap-1.5">
            <span>Сравнение распределений степеней вершин P(k)</span>
            <InfoTooltip text="Показывает долю вершин, радиально соединенных с k рёбрами. Выявляет пуассоновскую топологию (ER/LPN при малых λ) или степенной безмасштабный закон (BA)." />
          </h3>
          <p className="text-[10px] text-gray-500 italic mt-0.5">
            Совмещение кривых распределения для различных сетевых топологий на одной масштабируемой гистограмме.
          </p>
        </div>

        <div className="flex items-center bg-gray-100 p-1 rounded-lg shrink-0">
          <button
            onClick={() => setDisplayMode('profiles')}
            className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md border-0 cursor-pointer ${
              displayMode === 'profiles'
                ? 'bg-white text-gray-800 shadow-xs'
                : 'text-gray-400 hover:text-gray-600 bg-transparent'
            }`}
          >
            Среднее по профилям
          </button>
          <button
            onClick={() => setDisplayMode('networks')}
            className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md border-0 cursor-pointer ${
              displayMode === 'networks'
                ? 'bg-white text-gray-800 shadow-xs'
                : 'text-gray-400 hover:text-gray-600 bg-transparent'
            }`}
          >
            Все сети раздельно
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 flex flex-col justify-between border-r border-gray-100 pr-0 lg:pr-5">
          <div className="space-y-3">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">Активные кривые</span>
            
            {enabledProfiles.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Нет активных (отмеченных флажком) профилей сравнения.</p>
            ) : (
              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                {enabledProfiles.map((prof) => {
                  const matched = activeNetworks.filter((n) => matchNetworkWithProfile(n, prof));
                  const loadedCount = matched.filter((n) => cache[n.id]).length;
                  const loadingCount = matched.length - loadedCount;

                  return (
                    <div
                      key={prof.id}
                      className="border border-gray-200 p-2 rounded-lg bg-gray-50/50 flex flex-col gap-1 text-[11px] font-bold"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full block shrink-0"
                          style={{ backgroundColor: prof.color }}
                        />
                        <span className="text-gray-800 truncate" title={prof.name}>
                          {prof.name}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] font-mono text-gray-400 font-semibold pl-4 font-bold">
                        <span>Сетей в БД: {matched.length}</span>
                        {loadingCount > 0 ? (
                          <span className="text-blue-500 animate-pulse">Загрузка {loadedCount}/{matched.length}...</span>
                        ) : (
                          <span className="text-gray-500 text-[10px] flex items-center gap-0.5">
                            <Check className="h-3 w-3 text-green-500" /> Готово
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {isSomeLoading && (
            <div className="mt-3 flex items-center font-mono font-bold text-[10px] text-blue-500 gap-1 bg-blue-50 border border-blue-100 p-2 rounded-lg shrink-0">
              <RefreshCw className="animate-spin h-3.5 w-3.5" />
              <span>Фоновая подгрузка реберных массивов из SQLite...</span>
            </div>
          )}
        </div>

        <div className="lg:col-span-8 flex flex-col items-center justify-center">
          {enabledProfiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-gray-400 italic text-xs h-64 border border-dashed border-gray-200 rounded-xl bg-gray-50/50 w-full col-span-3">
              Включите хотя бы один настроенный профиль в меню управления выше.
            </div>
          ) : activeNetworks.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-gray-400 italic text-xs h-64 border border-dashed border-gray-200 rounded-xl bg-gray-50/50 w-full col-span-3">
              Нет сетей в базе данных под критерии выбранных профилей. Сгенерируйте их во вкладке ГЕНЕРАЦИЯ.
            </div>
          ) : curves.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-blue-500 text-xs h-64 border border-dashed border-gray-200 rounded-xl bg-gray-50/50 w-full font-mono font-bold col-span-3">
              <RefreshCw className="animate-spin h-6 w-6 mb-2 text-blue-500" /> Загрузка графов и весов степеней из SQLite...
            </div>
          ) : (
            <div className="w-full relative">
              <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
                <defs>
                  <clipPath id="pk-compare-clip">
                    <rect x={paddingLeft} y={paddingTop} width={chartWidth} height={chartHeight} />
                  </clipPath>
                </defs>

                {yTicks.map((yVal, idx) => {
                  const y = getY(yVal);
                  return (
                    <g key={idx}>
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
                        className="fill-gray-400 font-mono text-[9px] font-bold"
                      >
                        {(yVal * 100).toFixed(0)}%
                      </text>
                    </g>
                  );
                })}

                {xTicks.map((kVal, idx) => {
                  const x = getX(kVal);
                  return (
                    <g key={idx}>
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
                        className="fill-gray-400 font-mono text-[9px] font-bold"
                      >
                        k={kVal}
                      </text>
                    </g>
                  );
                })}

                <line
                  x1={paddingLeft}
                  y1={paddingTop + chartHeight}
                  x2={width - paddingRight}
                  y2={paddingTop + chartHeight}
                  stroke="#ccc"
                  strokeWidth="1.5"
                />
                <line
                  x1={paddingLeft}
                  y1={paddingTop}
                  x2={paddingLeft}
                  y2={paddingTop + chartHeight}
                  stroke="#ccc"
                  strokeWidth="1.5"
                />

                <g clipPath="url(#pk-compare-clip)">
                  {curves.map((curve) => {
                    const pathD = makePathD(curve.distribution);
                    const areaD = makeAreaPathD(curve.distribution);

                    return (
                      <g key={curve.id}>
                        <path
                          d={areaD}
                          fill={curve.color}
                          fillOpacity={displayMode === 'profiles' ? 0.15 : 0.05}
                          className="transition-all duration-300"
                        />
                        <path
                          d={pathD}
                          fill="none"
                          stroke={curve.color}
                          strokeWidth={curve.isProfileAverage ? 3 : 1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeDasharray={curve.isProfileAverage ? "0" : "5,3"}
                          className="transition-all duration-300"
                        />
                        {curve.distribution.map((item, pIdx) => {
                          const cx = getX(item.k);
                          const cy = getY(item.p);
                          const isKHovered = hoveredK === item.k;
                          return (
                            <circle
                              key={`${curve.id}-dot-${pIdx}`}
                              cx={cx}
                              cy={cy}
                              r={isKHovered ? 5 : curve.isProfileAverage ? 3.5 : 2.5}
                              fill={curve.color}
                              stroke="#fff"
                              strokeWidth={isKHovered ? 2 : 1}
                              onMouseEnter={() => setHoveredK(item.k)}
                              onMouseLeave={() => setHoveredK(null)}
                              className="cursor-pointer transition-all duration-150"
                            />
                          );
                        })}
                      </g>
                    );
                  })}
                </g>
              </svg>

              <div className="h-10 mt-2.5 flex justify-center items-center font-mono text-[9px] text-gray-600 bg-gray-50 border border-gray-150 rounded-lg px-3">
                {hoveredK !== null ? (
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <span>Степень <strong className="text-gray-950 font-bold text-[10px]">k = {hoveredK}</strong></span>
                    <span className="text-gray-300">|</span>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 items-center">
                      {curves.slice(0, 5).map((curve) => {
                        const prob = curve.distribution.find((d) => d.k === hoveredK)?.p || 0;
                        return (
                          <span key={curve.id} style={{ color: curve.color }} className="font-bold">
                            {curve.name}: {(prob * 100).toFixed(1)}%
                          </span>
                        );
                      })}
                      {curves.length > 5 && <span className="text-gray-400 italic">и ещё {curves.length - 5} сетей</span>}
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-400 italic text-center leading-tight">
                    Наведите курсор мыши на маркеры на графике, чтобы в реальном времени считать точную удельную долю вершин P(k) при выбранной степени k.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
