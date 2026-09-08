import React, { useEffect } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Layers, Compass, Footprints, Eye } from 'lucide-react';
import { RoutePanel } from './RoutePanel';
import { TurnByTurnCard } from './TurnByTurnCard';

export const GameHUD: React.FC = () => {
  const currentFloor = useGameStore((state) => state.currentFloor);
  const playerPosition = useGameStore((state) => state.playerPosition);
  const interactionPrompt = useGameStore((state) => state.interactionPrompt);
  const notification = useGameStore((state) => state.notification);
  const isLocked = useGameStore((state) => state.isLocked);
  const cameraMode = useGameStore((state) => state.cameraMode);

  // Auto-dismiss notification after 3.5 seconds
  const setNotification = useGameStore((state) => state.setNotification);
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [notification, setNotification]);

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-6">
      {/* 1. TOP BAR */}
      <div className="flex justify-between items-start w-full">
        {/* Top-Left: Current Floor Badge & Route Panel */}
        <div className="flex flex-col gap-3 items-start">
          <div className="glass-panel px-5 py-3 flex items-center gap-3 border-l-4 border-l-cyan-400">
            <div className="p-2 rounded-lg bg-cyan-950/60 text-cyan-400">
              <Layers size={22} />
            </div>
            <div>
              <div className="text-xs tracking-widest uppercase text-slate-400 font-semibold">
                Current Level
              </div>
              <div className="text-xl font-bold tracking-wide text-white glow-text">
                FLOOR {currentFloor}
              </div>
            </div>
          </div>

          {/* Indoor Route Panel */}
          <RoutePanel />
        </div>

        {/* Turn-by-Turn Dynamic Navigation Guidance */}
        <TurnByTurnCard />

        {/* Top-Center: Notification Toast */}
        {notification && (
          <div className="glass-panel px-6 py-3 border-cyan-500/50 bg-cyan-950/80 text-cyan-300 font-medium text-sm animate-pulse-subtle flex items-center gap-2 shadow-lg shadow-cyan-900/30">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            {notification}
          </div>
        )}

        {/* Top-Right: Coordinates & Telemetry */}
        <div className="glass-panel px-5 py-3 flex items-center gap-3 border-r-4 border-r-blue-500">
          <div className="text-right">
            <div className="text-xs tracking-widest uppercase text-slate-400 font-semibold flex items-center justify-end gap-1">
              <Compass size={13} className="text-blue-400" /> Player Position
            </div>
            <div className="mono text-sm font-semibold tracking-wider text-slate-200 mt-0.5">
              X: <span className="text-cyan-400">{playerPosition.x.toFixed(1)}</span>{' '}
              Y: <span className="text-cyan-400">{playerPosition.y.toFixed(1)}</span>{' '}
              Z: <span className="text-cyan-400">{playerPosition.z.toFixed(1)}</span>
            </div>
          </div>
          <div className="text-xs font-bold px-2 py-1 rounded bg-slate-800 text-cyan-400 uppercase tracking-wider">
            {cameraMode}
          </div>
        </div>
      </div>

      {/* 2. CENTER: RETICLE / CROSSHAIR */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
        <div className="relative flex items-center justify-center">
          {/* Subtle outer target ring */}
          <div className="w-6 h-6 rounded-full border border-cyan-400/40"></div>
          {/* Center pinpoint */}
          <div className="absolute w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f2fe]"></div>
        </div>
      </div>

      {/* 3. CENTER BOTTOM: INTERACTION PROMPT */}
      {interactionPrompt && (
        <div className="self-center mb-4">
          <div className="glass-panel px-6 py-2.5 border-cyan-400/60 bg-slate-900/90 flex items-center gap-3 animate-bounce">
            <div className="w-7 h-7 rounded bg-cyan-500 text-black font-bold flex items-center justify-center text-sm shadow-md shadow-cyan-500/50">
              E
            </div>
            <span className="text-sm font-semibold tracking-wide text-cyan-100">
              {interactionPrompt.replace(/^Press \[E\] to\s*/i, '')}
            </span>
          </div>
        </div>
      )}

      {/* 4. BOTTOM BAR */}
      <div className="flex justify-between items-end w-full">
        {/* Bottom-Left: Game Controls Guide */}
        <div className="glass-panel p-4 flex flex-col gap-2 max-w-xs text-xs text-slate-300">
          <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 mb-1 flex items-center gap-1.5">
            <Footprints size={14} /> Exploration Controls
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mono">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-bold text-white">WASD</span>
              <span className="text-slate-400">Move</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-bold text-white">Mouse</span>
              <span className="text-slate-400">Look</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-bold text-white">Shift</span>
              <span className="text-slate-400">Sprint</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-bold text-white">Space</span>
              <span className="text-slate-400">Jump</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-bold text-white">E</span>
              <span className="text-slate-400">Interact</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-bold text-white">V</span>
              <span className="text-slate-400">FPS/TPS</span>
            </div>
          </div>
        </div>

        {/* Bottom-Right: Project Badge */}
        <div className="glass-panel px-4 py-2.5 text-right">
          <div className="text-[10px] uppercase font-bold tracking-widest text-cyan-400">
            Namma Space • Techfest
          </div>
          <div className="text-xs font-semibold text-slate-300">
            PARKAR Indoor Twin v0.1
          </div>
        </div>
      </div>

      {/* 5. POINTER LOCK START OVERLAY (When user hasn't clicked canvas) */}
      {!isLocked && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto flex items-center justify-center">
          <div className="glass-panel p-8 max-w-md text-center flex flex-col items-center border-cyan-500/40 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400 mb-4 animate-pulse">
              <Eye size={32} />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white mb-1">
              PARKAR 3D TWIN
            </h1>
            <p className="text-xs font-medium text-cyan-400 uppercase tracking-widest mb-4">
              AI-Powered Indoor Spatial Guide • IIT Bombay
            </p>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              Explore the reconstructed 3-floor building. Climb the staircase to reach Floors 2 and 3, inspect rooms, and test interactive zones.
            </p>
            <div className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-extrabold text-sm uppercase tracking-wider cursor-pointer hover:opacity-90 transition-all transform hover:scale-105 shadow-lg shadow-cyan-500/30 flex items-center gap-2">
              <Footprints size={18} /> Click Anywhere to Play
            </div>
            <div className="text-xs text-slate-400 mt-4">
              Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-white font-mono">ESC</kbd> anytime to release mouse cursor
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
