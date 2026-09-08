import { create } from 'zustand';
import { CameraMode, Vector3Tuple } from '../engine/types';
import { RouteOption } from '../services/pathfinding';

interface GameState {
  currentFloor: number;
  playerPosition: Vector3Tuple;
  interactionPrompt: string | null;
  notification: string | null;
  isLocked: boolean;
  cameraMode: CameraMode;

  // Navigation state
  availableRoutes: RouteOption[];
  activeRoute: RouteOption | null;
  selectedProfile: string;
  targetPOI: string | null;
  targetPOIName: string | null;
  isNavigating: boolean;
  currentStepIndex: number;
  currentInstruction: string | null;

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
  currentFloor: 1,
  playerPosition: { x: 0, y: 1.0, z: 22.0 },
  interactionPrompt: null,
  notification: null,
  isLocked: false,
  cameraMode: 'fps',

  availableRoutes: [],
  activeRoute: null,
  selectedProfile: 'fastest',
  targetPOI: null,
  targetPOIName: null,
  isNavigating: false,
  currentStepIndex: 0,
  currentInstruction: null,

  setPlayerMove: (pos, floor) =>
    set((state) => {
      let newStepIndex = state.currentStepIndex;
      let newInstruction = state.currentInstruction;

      // If actively navigating, check distance to upcoming waypoints
      if (state.isNavigating && state.activeRoute && state.activeRoute.waypoints.length > 0) {
        const waypoints = state.activeRoute.waypoints;
        const currentTargetWp = waypoints[newStepIndex];
        if (currentTargetWp) {
          const dx = pos.x - currentTargetWp.x;
          const dy = pos.y - currentTargetWp.y;
          const dz = pos.z - currentTargetWp.z;
          const distToWp = Math.sqrt(dx * dx + dy * dy + dz * dz);

          // If within 2.5m of waypoint, advance instruction
          if (distToWp < 2.5 && newStepIndex < state.activeRoute.instructions.length - 1) {
            newStepIndex += 1;
            newInstruction = state.activeRoute.instructions[newStepIndex] || state.currentInstruction;
          }
        }
      }

      return {
        playerPosition: pos,
        currentFloor: state.currentFloor !== floor ? floor : state.currentFloor,
        currentStepIndex: newStepIndex,
        currentInstruction: newInstruction,
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
