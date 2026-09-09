import { create } from 'zustand';
import { CameraMode, Vector3Tuple } from '../engine/types';
import { RouteOption } from '../services/pathfinding';
import { BUILDING_CONFIG, BuildingMode, getInitialBuildingMode } from '../config/buildingConfig';
import { isPointOffRoute, computeReconstructedRoutes } from '../services/reconstructedGraphAdapter';

const initialMode = getInitialBuildingMode();
const initialSpawn = initialMode === 'reconstructed' 
  ? BUILDING_CONFIG.reconstructedSpawn 
  : BUILDING_CONFIG.proceduralSpawn;

interface GameState {
  hasStarted: boolean;
  currentFloor: number;
  playerPosition: Vector3Tuple;
  interactionPrompt: string | null;
  notification: string | null;
  isLocked: boolean;
  cameraMode: CameraMode;
  buildingMode: BuildingMode;

  // Navigation state
  availableRoutes: RouteOption[];
  activeRoute: RouteOption | null;
  selectedProfile: string;
  targetPOI: string | null;
  targetPOIName: string | null;
  isNavigating: boolean;
  hasArrived: boolean;
  isOffRoute: boolean;
  currentStepIndex: number;
  currentInstruction: string | null;

  startGame: () => void;
  setBuildingMode: (mode: BuildingMode) => void;
  setPlayerMove: (pos: Vector3Tuple, floor: number) => void;
  setFloor: (floor: number) => void;
  setInteractionPrompt: (prompt: string | null) => void;
  setNotification: (notification: string | null) => void;
  setLocked: (isLocked: boolean) => void;
  setCameraMode: (mode: CameraMode) => void;

  setRoutes: (routes: RouteOption[], targetId: string, targetName: string) => void;
  setActiveRoute: (route: RouteOption) => void;
  selectProfile: (profile: string) => void;
  clearNavigation: () => void;
  updateNavigationStep: (stepIndex: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
  hasStarted: false,
  currentFloor: 1,
  playerPosition: { ...initialSpawn },
  interactionPrompt: null,
  notification: null,
  isLocked: false,
  cameraMode: 'fps',
  buildingMode: initialMode,

  availableRoutes: [],
  activeRoute: null,
  selectedProfile: 'fastest',
  targetPOI: null,
  targetPOIName: null,
  isNavigating: false,
  hasArrived: false,
  isOffRoute: false,
  currentStepIndex: 0,
  currentInstruction: null,

  startGame: () => set({ hasStarted: true }),
  setBuildingMode: (mode) => set({ buildingMode: mode }),

  setPlayerMove: (pos, floor) =>
    set((state) => {
      let newStepIndex = state.currentStepIndex;
      let newInstruction = state.currentInstruction;
      let isNav = state.isNavigating;
      let hasArr = state.hasArrived;
      let activeR = state.activeRoute;
      let availR = state.availableRoutes;
      let notif = state.notification;

      if (isNav && activeR && activeR.waypoints.length > 0) {
        const waypoints = activeR.waypoints;
        const destWp = waypoints[waypoints.length - 1];
        const distToDest = Math.sqrt((pos.x - destWp.x) ** 2 + (pos.z - destWp.z) ** 2);

        // 1. Arrival Detection (< 2.5m from destination)
        if (distToDest < 2.5 && !hasArr) {
          const arrivalMsg = `We've arrived at ${state.targetPOIName || 'your destination'}.`;
          return {
            playerPosition: pos,
            currentFloor: state.currentFloor !== floor ? floor : state.currentFloor,
            isNavigating: false,
            hasArrived: true,
            isOffRoute: false,
            currentInstruction: `ARRIVED: ${arrivalMsg}`,
            notification: arrivalMsg,
          };
        }

        // 2. Off-Route Detection & Dynamic Recalculation (> 4.0m from route)
        if (!hasArr && isPointOffRoute(pos, waypoints, 4.0)) {
          if (state.buildingMode === 'reconstructed' && state.targetPOI) {
            try {
              const resp = computeReconstructedRoutes(pos.x, pos.y, pos.z, state.targetPOI);
              const recalculated = resp.routes.find((r) => r.profile === state.selectedProfile) || resp.routes[0];
              if (recalculated) {
                return {
                  playerPosition: pos,
                  currentFloor: state.currentFloor !== floor ? floor : state.currentFloor,
                  activeRoute: recalculated,
                  availableRoutes: resp.routes,
                  currentStepIndex: 0,
                  currentInstruction: recalculated.instructions[0] || null,
                  isOffRoute: false,
                  notification: `OFF ROUTE: Recalculated route to ${state.targetPOIName}`,
                };
              }
            } catch (e) {
              console.warn('Reconstructed route recalculation error:', e);
            }
          }
        }

        // 3. Step Progression (< 2.5m from upcoming waypoint)
        const currentTargetWp = waypoints[newStepIndex];
        if (currentTargetWp) {
          const dx = pos.x - currentTargetWp.x;
          const dy = pos.y - currentTargetWp.y;
          const dz = pos.z - currentTargetWp.z;
          const distToWp = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (distToWp < 2.5 && newStepIndex < activeR.instructions.length - 1) {
            newStepIndex += 1;
            newInstruction = activeR.instructions[newStepIndex] || state.currentInstruction;
          }
        }
      }

      return {
        playerPosition: pos,
        currentFloor: state.currentFloor !== floor ? floor : state.currentFloor,
        currentStepIndex: newStepIndex,
        currentInstruction: newInstruction,
        isNavigating: isNav,
        hasArrived: hasArr,
        activeRoute: activeR,
        availableRoutes: availR,
        notification: notif,
      };
    }),

  setFloor: (floor) => set({ currentFloor: floor }),
  setInteractionPrompt: (prompt) => set({ interactionPrompt: prompt }),
  setNotification: (notification) => set({ notification }),
  setLocked: (isLocked) => set({ isLocked }),
  setCameraMode: (cameraMode) => set({ cameraMode }),

  setRoutes: (routes, targetId, targetName) =>
    set((state) => {
      const preferred = routes.find((r) => r.profile === state.selectedProfile) || routes[0] || null;
      return {
        availableRoutes: routes,
        activeRoute: preferred,
        targetPOI: targetId,
        targetPOIName: targetName,
        isNavigating: !!preferred,
        currentStepIndex: 0,
        currentInstruction: preferred && preferred.instructions.length > 0 ? preferred.instructions[0] : null,
      };
    }),

  setActiveRoute: (route) =>
    set({
      activeRoute: route,
      selectedProfile: route.profile,
      isNavigating: true,
      currentStepIndex: 0,
      currentInstruction: route.instructions.length > 0 ? route.instructions[0] : null,
    }),

  selectProfile: (profile) =>
    set((state) => {
      const route = state.availableRoutes.find((r) => r.profile === profile) || state.activeRoute;
      return {
        selectedProfile: profile,
        activeRoute: route,
        isNavigating: !!route,
        currentStepIndex: 0,
        currentInstruction: route && route.instructions.length > 0 ? route.instructions[0] : null,
      };
    }),

  clearNavigation: () =>
    set({
      availableRoutes: [],
      activeRoute: null,
      targetPOI: null,
      targetPOIName: null,
      isNavigating: false,
      currentStepIndex: 0,
      currentInstruction: null,
    }),

  updateNavigationStep: (stepIndex) =>
    set((state) => ({
      currentStepIndex: stepIndex,
      currentInstruction:
        state.activeRoute && state.activeRoute.instructions[stepIndex]
          ? state.activeRoute.instructions[stepIndex]
          : state.currentInstruction,
    })),
}));
