import React from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Compass, CornerUpRight, ArrowUpCircle } from 'lucide-react';

export const TurnByTurnCard: React.FC = () => {
  const isNavigating = useGameStore((state) => state.isNavigating);
  const activeRoute = useGameStore((state) => state.activeRoute);
  const currentStepIndex = useGameStore((state) => state.currentStepIndex);
  const currentInstruction = useGameStore((state) => state.currentInstruction);
  const targetPOIName = useGameStore((state) => state.targetPOIName);

  if (!isNavigating || !activeRoute || !currentInstruction) {
    return null;
  }

  const instructions = activeRoute.instructions;
  const nextInstruction = currentStepIndex + 1 < instructions.length ? instructions[currentStepIndex + 1] : null;

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-auto z-20 animate-bounce-subtle">
      <div className="glass-panel px-6 py-3 border-cyan-400/50 bg-slate-900/90 shadow-2xl flex items-center gap-4 max-w-lg min-w-[340px]">
        {/* Step Direction Icon */}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-black flex items-center justify-center font-bold shadow-md shadow-cyan-500/40 shrink-0">
          {currentInstruction.toLowerCase().includes('stairs') || currentInstruction.toLowerCase().includes('ascend') ? (
            <ArrowUpCircle size={24} />
          ) : currentInstruction.toLowerCase().includes('turn') ? (
            <CornerUpRight size={22} />
          ) : (
            <Compass size={24} />
          )}
        </div>

        {/* Instructions Body */}
        <div className="flex-1 text-left">
          <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider uppercase text-cyan-400 mb-0.5">
            <span>
              Step {currentStepIndex + 1} of {instructions.length}
            </span>
            <span className="text-slate-400 truncate max-w-[140px]">
              → {targetPOIName}
            </span>
          </div>

          <div className="text-sm font-bold text-white tracking-wide leading-snug">
            {currentInstruction}
          </div>

          {nextInstruction && (
            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
              Then: <span className="text-slate-300 font-medium">{nextInstruction}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
