import React, { useRef, useEffect, useState } from 'react';

interface VisualizerProps {
  nodes: number[][] | number; // Support number of nodes or nodes array
  links: number[][];
}

export const NetworkVisualizer3D: React.FC<VisualizerProps> = ({ nodes, links }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [yaw, setYaw] = useState<number>(0.5);
  const [pitch, setPitch] = useState<number>(0.5);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const nodesArr = Array.isArray(nodes) ? nodes : [];

  useEffect(() => {
    setYaw(0.5);
    setPitch(0.5);
  }, [nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    if (nodesArr.length === 0) return;

    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);

    const degrees = new Array(nodesArr.length).fill(0);
    links.forEach(([u, v]) => {
      if (u < degrees.length) degrees[u]++;
      if (v < degrees.length) degrees[v]++;
    });

    const projected: { x: number; y: number; z: number; originalIdx: number }[] = nodesArr.map((node, i) => {
      const cx = (node[0] ?? 0.5) - 0.5;
      const cy = (node[1] ?? 0.5) - 0.5;
      const cz = (node[2] ?? 0.5) - 0.5;

      const x1 = cx * cosY - cz * sinY;
      const z1 = cx * sinY + cz * cosY;

      const y2 = cy * cosP - z1 * sinP;
      const z2 = cy * sinP + z1 * cosP;

      const distance = 1.3;
      const factor = (width * 0.72) / (distance + z2);
      const px = x1 * factor + width / 2;
      const py = y2 * factor + height / 2;

      return { x: px, y: py, z: z2, originalIdx: i };
    });

    ctx.lineWidth = 1.0;
    links.forEach(([u, v]) => {
      if (u >= projected.length || v >= projected.length) return;
      const p1 = projected[u];
      const p2 = projected[v];

      const avgZ = (p1.z + p2.z) / 2;
      const alpha = Math.max(0.12, Math.min(0.72, 1.0 - (avgZ + 0.5)));

      const r = Math.round(((nodesArr[u]?.[0] ?? 0) + (nodesArr[v]?.[0] ?? 0)) * 110 + 35);
      const g = Math.round(((nodesArr[u]?.[1] ?? 0) + (nodesArr[v]?.[1] ?? 0)) * 110 + 100);
      const b = Math.round(((nodesArr[u]?.[2] ?? 0) + (nodesArr[v]?.[2] ?? 0)) * 110 + 145);

      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    });

    const sortedProjected = [...projected].sort((a, b) => b.z - a.z);

    sortedProjected.forEach((p) => {
      const origNode = nodesArr[p.originalIdx];
      if (!origNode) return;
      const deg = degrees[p.originalIdx] || 0;
      
      const r = Math.round((origNode[0] ?? 0) * 120 + 40);
      const g = Math.round((origNode[1] ?? 0) * 120 + 100);
      const b = Math.round((origNode[2] ?? 0) * 120 + 135);

      const size = Math.max(2.5, Math.min(7.0, 2.0 + Math.log2(deg + 1)));

      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 1.5);
      grad.addColorStop(0, `rgb(${r}, ${g}, ${b})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`);
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size * 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, size * 0.45, 0, Math.PI * 2);
      ctx.fill();
    });

  }, [nodesArr, links, yaw, pitch]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    dragStart.current = { x: e.clientX, y: e.clientY };

    setYaw((prev) => prev + dx * 0.012);
    setPitch((prev) => Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, prev - dy * 0.012)));
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  return (
    <div className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-950 p-1 shadow-inner">
      <canvas
        ref={canvasRef}
        width={500}
        height={400}
        className="w-full h-auto cursor-grab active:cursor-grabbing block rounded-lg"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
      />
      <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur border border-slate-700/50 px-2 py-1 rounded text-[10px] font-mono text-slate-400 select-none pointer-events-none transition opacity-75 group-hover:opacity-100">
        Перетащите для вращения в 3D
      </div>
    </div>
  );
};
