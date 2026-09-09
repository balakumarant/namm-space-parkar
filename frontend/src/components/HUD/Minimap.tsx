import React, { useRef, useEffect, useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Map, Maximize2, Minimize2 } from 'lucide-react';

export const Minimap: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const playerPos = useGameStore((state) => state.playerPosition);
  const currentFloor = useGameStore((state) => state.currentFloor);
  const activeRoute = useGameStore((state) => state.activeRoute);
  const targetPOIName = useGameStore((state) => state.targetPOIName);
  const buildingMode = useGameStore((state) => state.buildingMode);

  const width = isExpanded ? 260 : 170;
  const height = isExpanded ? 320 : 210;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear background
    ctx.fillStyle = '#0a0f18';
    ctx.fillRect(0, 0, width, height);

    const padding = 12;
    const drawW = width - padding * 2;
    const drawH = height - padding * 2;
    const isReconstructed = buildingMode === 'reconstructed';

    // World to canvas coordinate transform
    // Procedural: X in [-12, 12], Z in [-25, 25]
    // Reconstructed: X in [-14, 12] (span 26m), Z in [0, 56] (span 56m)
    const toCanvasX = (x: number) =>
      isReconstructed
        ? padding + ((x + 14) / 26) * drawW
        : padding + ((x + 12) / 24) * drawW;

    const toCanvasY = (z: number) =>
      isReconstructed
        ? padding + (z / 56) * drawH
        : padding + ((z + 25) / 50) * drawH;

    if (isReconstructed) {
      // ----------------------------------------------------
      // RECONSTRUCTED DIGITAL TWIN MINIMAP
      // ----------------------------------------------------
      // 1. Outer Perimeter
      ctx.strokeStyle = '#2d3748';
      ctx.lineWidth = 1.5;
      const rLeft = toCanvasX(-13.0);
      const rRight = toCanvasX(10.4);
      const rTop = toCanvasY(2.1);
      const rBottom = toCanvasY(54.4);
      ctx.strokeRect(rLeft, rTop, rRight - rLeft, rBottom - rTop);

      // 2. Entrance Vestibule & Hallway (Z: 2.5 - 7.0)
      ctx.fillStyle = 'rgba(25, 35, 50, 0.7)';
      ctx.fillRect(
        toCanvasX(-1.3),
        toCanvasY(2.5),
        toCanvasX(1.9) - toCanvasX(-1.3),
        toCanvasY(7.0) - toCanvasY(2.5)
      );

      // 3. Grand Foyer Staircase (East side of foyer)
      ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
      ctx.strokeStyle = '#f59e0b';
      ctx.fillRect(
        toCanvasX(0.8),
        toCanvasY(3.5),
        toCanvasX(2.5) - toCanvasX(0.8),
        toCanvasY(7.0) - toCanvasY(3.5)
      );
      ctx.strokeRect(
        toCanvasX(0.8),
        toCanvasY(3.5),
        toCanvasX(2.5) - toCanvasX(0.8),
        toCanvasY(7.0) - toCanvasY(3.5)
      );

      // 4. Central Hallway Corridor (Z: 7.0 - 25.0)
      ctx.fillStyle = 'rgba(20, 28, 42, 0.65)';
      ctx.fillRect(
        toCanvasX(-2.5),
        toCanvasY(7.0),
        toCanvasX(2.5) - toCanvasX(-2.5),
        toCanvasY(25.0) - toCanvasY(7.0)
      );

      // 5. West Robotics Wing / Dining Lab (Z: 22.0 - 38.0)
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.strokeStyle = '#10b981';
      ctx.fillRect(
        toCanvasX(-10.5),
        toCanvasY(22.0),
        toCanvasX(-1.5) - toCanvasX(-10.5),
        toCanvasY(38.0) - toCanvasY(22.0)
      );
      ctx.strokeRect(
        toCanvasX(-10.5),
        toCanvasY(22.0),
        toCanvasX(-1.5) - toCanvasX(-10.5),
        toCanvasY(38.0) - toCanvasY(22.0)
      );

      // 6. North Living & Seminar Arena (Z: 38.0 - 53.0)
      ctx.fillStyle = 'rgba(139, 92, 246, 0.15)';
      ctx.strokeStyle = '#8b5cf6';
      ctx.fillRect(
        toCanvasX(-12.0),
        toCanvasY(38.0),
        toCanvasX(9.0) - toCanvasX(-12.0),
        toCanvasY(53.0) - toCanvasY(38.0)
      );
      ctx.strokeRect(
        toCanvasX(-12.0),
        toCanvasY(38.0),
        toCanvasX(9.0) - toCanvasX(-12.0),
        toCanvasY(53.0) - toCanvasY(38.0)
      );

      // 7. Draw Supported Real POI Anchors
      const POI_PINS = [
        { label: 'ENTRY', x: 0.0, z: 4.5, color: '#00f2fe' },
        { label: 'STAIRS', x: 1.5, z: 5.2, color: '#f59e0b' },
        { label: 'CONCOURSE', x: 0.0, z: 20.0, color: '#94a3b8' },
        { label: 'ROOM 101', x: -5.5, z: 28.0, color: '#10b981' },
        { label: 'LOUNGE', x: 0.0, z: 48.0, color: '#a78bfa' },
      ];

      POI_PINS.forEach((pin) => {
        const px = toCanvasX(pin.x);
        const py = toCanvasY(pin.z);

        ctx.fillStyle = pin.color;
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = 'bold 7px monospace';
        ctx.fillStyle = pin.color;
        ctx.fillText(pin.label, px + 4, py + 2.5);
      });
    } else {
      // ----------------------------------------------------
      // PROCEDURAL TEST ENVIRONMENT MINIMAP
      // ----------------------------------------------------
      // 1. Draw Building Perimeter
      ctx.strokeStyle = '#2d3748';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(padding, padding, drawW, drawH);

      // 2. Draw Corridor
      ctx.fillStyle = 'rgba(25, 35, 50, 0.7)';
      const cLeft = toCanvasX(-2.3);
      const cRight = toCanvasX(2.3);
      const cTop = toCanvasY(-22);
      const cBottom = toCanvasY(24);
      ctx.fillRect(cLeft, cTop, cRight - cLeft, cBottom - cTop);

      // 3. Draw Room Blocks (West side)
      ctx.strokeStyle = '#1e293b';
      ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';

      // North room (101 / 201 / 301)
      ctx.fillRect(toCanvasX(-11.5), toCanvasY(-19), toCanvasX(-2.3) - toCanvasX(-11.5), toCanvasY(-9) - toCanvasY(-19));
      ctx.strokeRect(toCanvasX(-11.5), toCanvasY(-19), toCanvasX(-2.3) - toCanvasX(-11.5), toCanvasY(-9) - toCanvasY(-19));

      // Mid room (102 / 202 / 302)
      ctx.fillRect(toCanvasX(-11.5), toCanvasY(-6), toCanvasX(-2.3) - toCanvasX(-11.5), toCanvasY(4) - toCanvasY(-6));
      ctx.strokeRect(toCanvasX(-11.5), toCanvasY(-6), toCanvasX(-2.3) - toCanvasX(-11.5), toCanvasY(4) - toCanvasY(-6));

      // South room (103 / 203 / 303)
      ctx.fillRect(toCanvasX(-11.5), toCanvasY(7), toCanvasX(-2.3) - toCanvasX(-11.5), toCanvasY(17) - toCanvasY(7));
      ctx.strokeRect(toCanvasX(-11.5), toCanvasY(7), toCanvasX(-2.3) - toCanvasX(-11.5), toCanvasY(17) - toCanvasY(7));

      // 4. Draw Facilities (East side)
      // Staircase A
      ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
      ctx.strokeStyle = '#f59e0b';
      ctx.fillRect(toCanvasX(4.0), toCanvasY(-17), toCanvasX(7.0) - toCanvasX(4.0), toCanvasY(-7.5) - toCanvasY(-17));
      ctx.strokeRect(toCanvasX(4.0), toCanvasY(-17), toCanvasX(7.0) - toCanvasX(4.0), toCanvasY(-7.5) - toCanvasY(-17));

      // Elevator A
      ctx.fillStyle = 'rgba(0, 242, 254, 0.25)';
      ctx.strokeStyle = '#00f2fe';
      ctx.fillRect(toCanvasX(4.0), toCanvasY(0), toCanvasX(7.0) - toCanvasX(4.0), toCanvasY(4.0) - toCanvasY(0));
      ctx.strokeRect(toCanvasX(4.0), toCanvasY(0), toCanvasX(7.0) - toCanvasX(4.0), toCanvasY(4.0) - toCanvasY(0));
    }

    // 5. Draw Active Route on this floor
    if (activeRoute && activeRoute.waypoints.length > 1) {
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 6;
      ctx.beginPath();

      let started = false;
      for (const wp of activeRoute.waypoints) {
        if (wp.floor === currentFloor) {
          const cx = toCanvasX(wp.x);
          const cy = toCanvasY(wp.z);
          if (!started) {
            ctx.moveTo(cx, cy);
            started = true;
          } else {
            ctx.lineTo(cx, cy);
          }
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0; // Reset shadow
    }

    // 6. Draw Destination Pin (if on current floor)
    if (activeRoute && activeRoute.waypoints.length > 0) {
      const destWp = activeRoute.waypoints[activeRoute.waypoints.length - 1];
      if (destWp.floor === currentFloor) {
        const dx = toCanvasX(destWp.x);
        const dy = toCanvasY(destWp.z);
        ctx.fillStyle = '#ff0055';
        ctx.beginPath();
        ctx.arc(dx, dy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // 7. Draw Player Position & Direction
    const px = toCanvasX(playerPos.x);
    const py = toCanvasY(playerPos.z);

    // Glowing player beacon
    ctx.fillStyle = '#00f2fe';
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // White center pip
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }, [playerPos, currentFloor, activeRoute, isExpanded, width, height, buildingMode]);

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-1">
      <div className="glass-panel p-2 rounded-xl border-cyan-500/30 bg-slate-950/80 shadow-xl relative">
        <div className="flex items-center justify-between px-1 pb-1 mb-1 border-b border-slate-800 text-[10px] font-bold text-slate-400">
          <span className="flex items-center gap-1 text-cyan-400">
            <Map size={11} /> 2D Radar
          </span>
          <div className="flex items-center gap-2">
            <span className="mono text-cyan-300 font-semibold text-[9px]">
              {buildingMode === 'reconstructed' ? 'GROUND FLOOR / FLOOR 1' : `L${currentFloor}`}
            </span>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-slate-500 hover:text-white"
            >
              {isExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="rounded-lg block"
        />

        {targetPOIName && (
          <div className="mt-1 text-[9px] text-slate-400 truncate max-w-[170px] text-center font-medium">
            Pin: <span className="text-cyan-300">{targetPOIName}</span>
          </div>
        )}
      </div>
    </div>
  );
};
