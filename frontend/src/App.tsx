import React, { useEffect, useRef } from 'react';
import { GameEngine } from './engine/GameEngine';
import { GameHUD } from './components/HUD/GameHUD';
import { useGameStore } from './stores/useGameStore';
import { clientPathfinder } from './services/pathfinding';

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

    // Check for custom job URL parameter before initial build so custom GLB loads immediately
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      const customJob = params.get('job');
      if (customJob) {
        const glbUrl = `http://127.0.0.1:8000/api/reconstruction/model/${customJob}/building.glb`;
        const metaUrl = `http://127.0.0.1:8000/api/reconstruction/model/${customJob}/metadata.json`;
        engine.buildingLoader.setCustomModel(glbUrl, metaUrl);
        engine.buildingLoader.setMode('reconstructed');
        useGameStore.getState().setCustomModel(customJob, glbUrl, metaUrl);
        useGameStore.getState().setNotification(`Loaded Custom User Digital Twin (${customJob})`);
      }
    }

    // Asynchronously initialize WASM physics & 3D building
    engine.init().then(() => {
      (window as any).gameEngine = engine;
      if (typeof window !== 'undefined' && window.location) {
        const params = new URLSearchParams(window.location.search);
        const view = params.get('view');
        if (view === 'entrance') {
          engine.playerController?.respawn({ x: 0.0, y: 1.0, z: 3.2 }, Math.PI);
        } else if (view === 'corridor') {
          engine.playerController?.respawn({ x: 0.0, y: 1.0, z: 6.0 }, Math.PI);
        } else if (view === 'stairs') {
          engine.playerController?.respawn({ x: 0.6, y: 1.0, z: 3.8 }, Math.PI * 0.72);
        } else if (view === 'lounge') {
          engine.playerController?.respawn({ x: -1.8, y: 1.0, z: 9.8 }, Math.PI * 0.85);
        } else if (view === 'dining') {
          engine.playerController?.respawn({ x: 0.8, y: 1.0, z: 8.8 }, Math.PI * 1.25);
        } else if (view === 'window') {
          engine.playerController?.respawn({ x: -0.8, y: 1.0, z: 11.2 }, Math.PI);
        } else if (view === 'column') {
          engine.playerController?.respawn({ x: 0.0, y: 1.0, z: 5.2 }, Math.PI);
        }

        const routeTarget = params.get('route');
        if (routeTarget) {
          clientPathfinder.getRoutes(0.0, 1.0, 4.5, routeTarget, 1, 'reconstructed').then((resp) => {
            if (resp && resp.routes.length > 0) {
              useGameStore.getState().setRoutes(resp.routes, routeTarget, routeTarget);
              useGameStore.getState().selectProfile('fastest');
            }
          }).catch((e) => console.warn('Auto route failed:', e));
        }

        if (params.get('upload') === '1' || params.get('upload') === 'true') {
          useGameStore.getState().setUploadModalOpen(true);
        }

        const customJob = params.get('job');
        if (customJob) {
          const glbUrl = `http://127.0.0.1:8000/api/reconstruction/model/${customJob}/building.glb`;
          const metaUrl = `http://127.0.0.1:8000/api/reconstruction/model/${customJob}/metadata.json`;
          useGameStore.getState().setCustomModel(customJob, glbUrl, metaUrl);
          useGameStore.getState().setNotification(`Loaded Custom User Digital Twin (${customJob})`);
        }

        if (params.get('play') === '1' || params.get('play') === 'true' || customJob) {
          useGameStore.getState().startGame();
        }
      }
    }).catch((err) => {
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
  const customGlbUrl = useGameStore((state) => state.customGlbUrl);
  const customMetadataUrl = useGameStore((state) => state.customMetadataUrl);

  useEffect(() => {
    if (!engineRef.current) return;
    if (customGlbUrl) {
      engineRef.current.loadCustomModel(customGlbUrl, customMetadataUrl || undefined).catch((err) => {
        console.warn('Failed to load custom digital twin model:', err);
      });
    } else {
      engineRef.current.switchBuildingMode(buildingMode).catch((err) => {
        console.warn('Failed to switch building mode:', err);
      });
    }
  }, [buildingMode, customGlbUrl, customMetadataUrl]);

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
