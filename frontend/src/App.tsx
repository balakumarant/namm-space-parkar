import React, { useEffect, useRef } from 'react';
import { GameEngine } from './engine/GameEngine';
import { GameHUD } from './components/HUD/GameHUD';
import { useGameStore } from './stores/useGameStore';

export const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const setPlayerMove = useGameStore((state) => state.setPlayerMove);
  const setFloor = useGameStore((state) => state.setFloor);
  const setInteractionPrompt = useGameStore((state) => state.setInteractionPrompt);
  const setNotification = useGameStore((state) => state.setNotification);
  const setLocked = useGameStore((state) => state.setLocked);

  useEffect(() => {
    if (!containerRef.current) return;

    // Instantiate Game Engine
    const engine = new GameEngine(containerRef.current, {
      onPlayerMove: (pos, floor) => {
        setPlayerMove(pos, floor);
      },
      onFloorChange: (floor) => {
        setFloor(floor);
      },
      onInteractionPrompt: (prompt) => {
        setInteractionPrompt(prompt);
      },
      onNotification: (msg) => {
        setNotification(msg);
      },
      onLockStateChange: (isLocked) => {
        setLocked(isLocked);
      },
    });

    engineRef.current = engine;

    // Asynchronously initialize WASM physics & 3D building
    engine.init().catch((err) => {
      console.error('Failed to initialize 3D Game Engine:', err);
    });

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [setPlayerMove, setFloor, setInteractionPrompt, setNotification, setLocked]);

  // Synchronize 3D Route Visualizer with active navigation route
  const activeRoute = useGameStore((state) => state.activeRoute);
  useEffect(() => {
    if (!engineRef.current) return;
    if (activeRoute && activeRoute.waypoints.length > 0) {
      engineRef.current.setNavigationRoute(activeRoute.waypoints);
    } else {
      engineRef.current.clearNavigationRoute();
    }
  }, [activeRoute]);

  // Synchronize buildingMode changes (procedural <-> reconstructed)
  const buildingMode = useGameStore((state) => state.buildingMode);
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.switchBuildingMode(buildingMode).catch((err) => {
        console.warn('Failed to switch building mode:', err);
      });
    }
  }, [buildingMode]);

  const handlePlay = () => {
    engineRef.current?.requestPointerLock();
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#080b10]">
      {/* 3D WebGL Canvas Container */}
      <div 
        ref={containerRef} 
        className="w-full h-full cursor-crosshair"
        onClick={() => {
          if (useGameStore.getState().hasStarted) {
            engineRef.current?.requestPointerLock();
          }
        }}
      />

      {/* Modern Game HUD Overlay */}
      <GameHUD onPlay={handlePlay} />
    </div>
  );
};

export default App;
