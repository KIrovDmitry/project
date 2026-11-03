import React, { useState } from 'react';

interface DegreeDistributionChartProps {
  nodesCount: number;
  links: number[][];
}

export const DegreeDistributionChart: React.FC<DegreeDistributionChartProps> = ({
  nodesCount,
  links,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (nodesCount <= 0) return null;

  const degrees = new Array(nodesCount).fill(0);
  links.forEach(([u, v]) => {
    if (u >= 0 && u < nodesCount) degrees[u]++;
    if (v >= 0 && v < nodesCount) degrees[v]++;
  });

  const freq: Record<number, number> = {};
  degrees.forEach((d) => {
    freq[d] = (freq[d] || 0) + 1;
  });

  const maxDegree = Math.max(...degrees, 0);
  const data: Array<{ degree: number; count: number; freq: number }> = [];
  for (let d = 0; d <= maxDegree; d++) {
    const count = freq[d] || 0;
    data.push({
      degree: d,
      count,
      freq: count / nodesCount,
    });
  }

  const isolatedCount = freq[0] || 0;
  const avgDegree = degrees.reduce((sum, d) => sum + d, 0) / (nodesCount || 1);
  const peakDegreeItem = [...data].sort((a, b) => b.count - a.count)[0];

  const width = 500;
  const height = 240;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxFreq = Math.max(...data.map((d) => d.freq), 0.01);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mt-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-100 pb-3 mb-4 gap-2">
        <div>
          <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
            Распределение степеней вершин P(k)
          </h4>
          <p className="text-[10px] text-gray-500 italic mt-0.5">
            Статистическая вероятность наличия k связей у случайного узла сети.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
          <span className="bg-gray-50 border border-gray-200 px-2 py-1 rounded text-gray-600">
            Ср. степень: <strong>{avgDegree.toFixed(2)}</strong>
          </span>
          <span className="bg-blue-50 border border-blue-100 px-2 py-1 rounded text-blue-700">
            Пик (k): <strong>{peakDegreeItem ? peakDegreeItem.degree : 0}</strong>
          </span>
          <span className="bg-amber-50 border border-amber-100 px-2 py-1 rounded text-amber-700">
            Изолированных (k=0): <strong>{isolatedCount}</strong>
          </span>
        </div>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const hVal = (maxFreq * ratio).toFixed(3);
            const y = paddingTop + chartHeight * (1 - ratio);
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#f0f0f0"
                  strokeWidth="1"
                  strokeDasharray="4,4"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-gray-400 font-mono text-[9px] font-bold"
                >
                  {hVal}
                </text>
              </g>
            );
          })}

          {data.map((item, idx) => {
            const barWidth = Math.max(2, Math.min(30, (chartWidth / (data.length || 1)) - 4));
            const x = paddingLeft + (chartWidth / (data.length || 1)) * idx + (chartWidth / (data.length || 1) - barWidth) / 2;
            const barHeight = (item.freq / maxFreq) * chartHeight;
            const y = paddingTop + chartHeight - barHeight;

            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-pointer group"
              >
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={hoveredIndex === idx ? '#3498db' : '#85c1e9'}
                  rx="2"
                  className="transition-colors duration-200"
                />

                <rect
                  x={x - 2}
                  y={paddingTop}
                  width={barWidth + 4}
                  height={chartHeight}
                  fill="transparent"
                />

                {(data.length <= 15 || idx % Math.ceil(data.length / 10) === 0 || hoveredIndex === idx) && (
                  <text
                    x={x + barWidth / 2}
                    y={paddingTop + chartHeight + 14}
                    textAnchor="middle"
                    className={`font-mono text-[9px] ${
                      hoveredIndex === idx ? 'fill-blue-600 font-bold' : 'fill-gray-500'
                    }`}
                  >
                    k={item.degree}
                  </text>
                )}
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
        </svg>

        <div className="h-6 mt-1 flex justify-center items-center font-mono text-[10px] text-gray-600 bg-gray-50 border border-gray-100 rounded-lg py-1">
          {hoveredIndex !== null ? (
            <span>
              Степень <strong className="text-blue-600 font-bold">k = {data[hoveredIndex].degree}</strong>: количество вершин ={' '}
              <strong className="text-gray-900 font-bold">{data[hoveredIndex].count}</strong> ({' '}
              {(data[hoveredIndex].freq * 100).toFixed(1)}% )
            </span>
          ) : (
            <span className="text-gray-400 italic">Наведите курсор на столбец распределения, чтобы узнать детали</span>
          )}
        </div>
      </div>
    </div>
  );
};
