import { Vector3Tuple } from '../engine/types';

export type BuildingMode = 'procedural' | 'reconstructed';

export interface BuildingConfig {
  defaultMode: BuildingMode;
  glbUrl: string;
  metadataUrl: string;
  reconstructedSpawn: Vector3Tuple;
  proceduralSpawn: Vector3Tuple;
  reconstructedOffset: Vector3Tuple;
}

export const BUILDING_CONFIG: BuildingConfig = {
  // Can be 'reconstructed' or 'procedural'
  defaultMode: 'reconstructed',
  glbUrl: '/models/building.glb',
  metadataUrl: '/models/metadata.json',
  // Calibrated spawn position inside the entrance hallway of the reconstructed building
  // Width X [-1.6, 2.0], Length Z [1.5, 13.2], Floor aligned to Y = 0.0
  reconstructedSpawn: { x: 0.0, y: 1.0, z: 4.5 },
  // Procedural building spawn near Main South Entrance
  proceduralSpawn: { x: 0.0, y: 1.0, z: 22.0 },
  // Vertical ground alignment offset: model floor is already at Y = 0.00m (calibrated from raw 1.7m)
  reconstructedOffset: { x: 0.0, y: 0.0, z: 0.0 },
};

/**
 * Resolves building mode from URL search parameter (e.g. ?mode=procedural or ?mode=reconstructed)
 * or falls back to BUILDING_CONFIG.defaultMode.
 */
export function getInitialBuildingMode(): BuildingMode {
  if (typeof window !== 'undefined' && window.location) {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    if (modeParam === 'procedural' || modeParam === 'reconstructed') {
      return modeParam;
    }
  }
  return BUILDING_CONFIG.defaultMode;
}
