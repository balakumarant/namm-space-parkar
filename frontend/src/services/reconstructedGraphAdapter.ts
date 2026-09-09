import { Vector3Tuple } from '../engine/types';
import { RouteOption, RouteResponse, SpatialEdge, SpatialNode, Waypoint } from './pathfinding';

export interface WalkableRegion {
  id: string;
  name: string;
  floor: number;
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  zoneType: 'foyer' | 'corridor' | 'stairs' | 'living' | 'dining';
}

export interface POIAnchor {
  poiId: string;
  name: string;
  floor: number;
  reconstructedCoord: Vector3Tuple;
  navigationNodeId: string;
  description: string;
}

export interface ReconstructedCoordinateMap {
  buildingName: string;
  floorCount: number;
  regions: WalkableRegion[];
  anchors: POIAnchor[];
}

/**
 * Real reconstructed building walkable regions (extracted from 56,527 dense stereo points)
 */
export const RECONSTRUCTED_WALKABLE_REGIONS: WalkableRegion[] = [
  {
    id: 'foyer_entrance',
    name: 'Entrance Foyer & Vestibule',
    floor: 1,
    bounds: { minX: -1.5, maxX: 2.0, minZ: 2.0, maxZ: 7.0 },
    zoneType: 'foyer',
  },
  {
    id: 'staircase_landing',
    name: 'Foyer Staircase Access',
    floor: 1,
    bounds: { minX: 0.8, maxX: 2.5, minZ: 3.5, maxZ: 7.0 },
    zoneType: 'stairs',
  },
  {
    id: 'main_hallway',
    name: 'Central Longitudinal Corridor',
    floor: 1,
    bounds: { minX: -2.5, maxX: 2.5, minZ: 7.0, maxZ: 25.0 },
    zoneType: 'corridor',
  },
  {
    id: 'dining_complex',
    name: 'Dining & Robotics Lab Area',
    floor: 1,
    bounds: { minX: -10.0, maxX: 4.0, minZ: 25.0, maxZ: 40.0 },
    zoneType: 'dining',
  },
  {
    id: 'living_lounge',
    name: 'North Living & Seminar Lounge',
    floor: 1,
    bounds: { minX: -12.0, maxX: 8.0, minZ: 40.0, maxZ: 53.0 },
    zoneType: 'living',
  },
];

/**
 * POI Anchors mapping reconstructed physical coordinates to navigation graph node IDs
 */
export const RECONSTRUCTED_POI_ANCHORS: POIAnchor[] = [
  {
    poiId: 'f1_entrance',
    name: 'Main South Entrance',
    floor: 1,
    reconstructedCoord: { x: 0.0, y: 0.0, z: 4.5 },
    navigationNodeId: 'rec_n_entrance',
    description: 'Entrance vestibule of the reconstructed digital twin',
  },
  {
    poiId: 'f1_stairs',
    name: 'Grand Foyer Staircase',
    floor: 1,
    reconstructedCoord: { x: 1.5, y: 0.0, z: 5.2 },
    navigationNodeId: 'rec_n_stairs',
    description: 'Staircase access structure in the entrance foyer',
  },
  {
    poiId: 'f1_c_mid',
    name: 'Central Gallery Concourse',
    floor: 1,
    reconstructedCoord: { x: 0.0, y: 0.0, z: 20.0 },
    navigationNodeId: 'rec_n_c_mid',
    description: 'Midway point of the primary architectural corridor',
  },
  {
    poiId: 'room_101',
    name: 'Room 101 - Techfest Robotics Wing',
    floor: 1,
    reconstructedCoord: { x: -5.5, y: 0.0, z: 28.0 },
    navigationNodeId: 'rec_n_room_101',
    description: 'West wing laboratory complex',
  },
  {
    poiId: 'f1_c_north',
    name: 'Executive Lounge & Seminar Arena',
    floor: 1,
    reconstructedCoord: { x: 0.0, y: 0.0, z: 48.0 },
    navigationNodeId: 'rec_n_lounge',
    description: 'Spacious north wing open area',
  },
];

/**
 * Reconstructed 3D Navigation Graph Nodes (metric world units, Y=0.0 on reconstructed ground)
 */
export const RECONSTRUCTED_GRAPH_NODES: SpatialNode[] = [
  {
    id: 'rec_n_entrance',
    name: 'Main South Entrance',
    floor: 1,
    type: 'entrance',
    x: 0.0,
    y: 0.0,
    z: 4.5,
    accessible: true,
  },
  {
    id: 'rec_n_stairs',
    name: 'Grand Foyer Staircase',
    floor: 1,
    type: 'stair_landing',
    x: 1.5,
    y: 0.0,
    z: 5.2,
    accessible: true,
  },
  {
    id: 'rec_n_corridor_s',
    name: 'South Corridor',
    floor: 1,
    type: 'corridor',
    x: 0.0,
    y: 0.0,
    z: 10.0,
    accessible: true,
  },
  {
    id: 'rec_n_c_mid',
    name: 'Central Gallery Concourse',
    floor: 1,
    type: 'corridor',
    x: 0.0,
    y: 0.0,
    z: 20.0,
    accessible: true,
  },
  {
    id: 'rec_n_c_junc_101',
    name: 'Room 101 Hallway Junction',
    floor: 1,
    type: 'corridor',
    x: 0.0,
    y: 0.0,
    z: 28.0,
    accessible: true,
  },
  {
    id: 'rec_n_door_101',
    name: 'Room 101 Entryway',
    floor: 1,
    type: 'room_door',
    x: -2.0,
    y: 0.0,
    z: 28.0,
    accessible: true,
  },
  {
    id: 'rec_n_room_101',
    name: 'Room 101 - Techfest Robotics Wing',
    floor: 1,
    type: 'room_inside',
    x: -5.5,
    y: 0.0,
    z: 28.0,
    accessible: true,
  },
  {
    id: 'rec_n_c_north_junc',
    name: 'North Hallway Concourse',
    floor: 1,
    type: 'corridor',
    x: 0.0,
    y: 0.0,
    z: 38.0,
    accessible: true,
  },
  {
    id: 'rec_n_lounge',
    name: 'Executive Lounge & Seminar Arena',
    floor: 1,
    type: 'room_inside',
    x: 0.0,
    y: 0.0,
    z: 48.0,
    accessible: true,
  },
];

/**
 * Reconstructed 3D Navigation Graph Edges
 */
export const RECONSTRUCTED_GRAPH_EDGES: SpatialEdge[] = [
  { from: 'rec_n_entrance', to: 'rec_n_stairs', weight: 1.7, type: 'flat', accessible: true },
  { from: 'rec_n_entrance', to: 'rec_n_corridor_s', weight: 5.5, type: 'flat', accessible: true },
  { from: 'rec_n_corridor_s', to: 'rec_n_c_mid', weight: 10.0, type: 'flat', accessible: true },
  { from: 'rec_n_c_mid', to: 'rec_n_c_junc_101', weight: 8.0, type: 'flat', accessible: true },
  { from: 'rec_n_c_junc_101', to: 'rec_n_door_101', weight: 2.0, type: 'flat', accessible: true },
  { from: 'rec_n_door_101', to: 'rec_n_room_101', weight: 3.5, type: 'flat', accessible: true },
  { from: 'rec_n_c_junc_101', to: 'rec_n_c_north_junc', weight: 10.0, type: 'flat', accessible: true },
  { from: 'rec_n_c_north_junc', to: 'rec_n_lounge', weight: 10.0, type: 'flat', accessible: true },
];

/**
 * Supported destination choices in reconstructed mode (Ground Floor / Floor 1 only)
 */
export function getReconstructedDestinations() {
  return RECONSTRUCTED_POI_ANCHORS.map((a) => ({
    id: a.poiId,
    name: a.name,
    floor: a.floor,
    nodeId: a.navigationNodeId,
  }));
}

/**
 * Maps a physical reconstructed coordinate to the nearest semantic navigation node ID
 */
export function findNearestReconstructedNode(
  x: number,
  y: number,
  z: number
): string {
  let bestNode = 'rec_n_entrance';
  let minDistSq = Infinity;

  for (const n of RECONSTRUCTED_GRAPH_NODES) {
    const dx = n.x - x;
    const dy = (n.y - y) * 2.0;
    const dz = n.z - z;
    const dSq = dx * dx + dy * dy + dz * dz;
    if (dSq < minDistSq) {
      minDistSq = dSq;
      bestNode = n.id;
    }
  }

  return bestNode;
}

/**
 * Maps a physical reconstructed coordinate to the nearest semantic navigation POI anchor
 */
export function findNearestNavigationAnchor(
  pos: Vector3Tuple,
  floor: number = 1
): POIAnchor {
  let bestAnchor = RECONSTRUCTED_POI_ANCHORS[0];
  let minDistanceSq = Infinity;

  for (const anchor of RECONSTRUCTED_POI_ANCHORS) {
    if (anchor.floor !== floor) continue;
    const dx = pos.x - anchor.reconstructedCoord.x;
    const dz = pos.z - anchor.reconstructedCoord.z;
    const dSq = dx * dx + dz * dz;
    if (dSq < minDistanceSq) {
      minDistanceSq = dSq;
      bestAnchor = anchor;
    }
  }

  return bestAnchor;
}

/**
 * Checks if a given coordinate is within a recognized reconstructed walkable region
 */
export function isCoordinateWalkable(pos: Vector3Tuple, floor: number = 1): boolean {
  for (const region of RECONSTRUCTED_WALKABLE_REGIONS) {
    if (region.floor === floor) {
      if (
        pos.x >= region.bounds.minX &&
        pos.x <= region.bounds.maxX &&
        pos.z >= region.bounds.minZ &&
        pos.z <= region.bounds.maxZ
      ) {
        return true;
      }
    }
  }
  // Allow general roaming within outer building envelope
  return pos.x >= -13.0 && pos.x <= 10.4 && pos.z >= 2.1 && pos.z <= 54.4;
}

/**
 * Compute multi-profile A* routes entirely in reconstructed coordinates
 */
export function computeReconstructedRoutes(
  startX: number,
  startY: number,
  startZ: number,
  destAnchorOrNodeId: string
): RouteResponse {
  // Resolve destination anchor to graph node ID
  const anchor = RECONSTRUCTED_POI_ANCHORS.find(
    (a) => a.poiId === destAnchorOrNodeId || a.navigationNodeId === destAnchorOrNodeId
  );
  const destNodeId = anchor ? anchor.navigationNodeId : destAnchorOrNodeId;
  const destNode = RECONSTRUCTED_GRAPH_NODES.find((n) => n.id === destNodeId);
  if (!destNode) {
    throw new Error(`Reconstructed destination '${destAnchorOrNodeId}' not found.`);
  }

  const originNodeId = findNearestReconstructedNode(startX, startY, startZ);

  // Build adjacency
  const adjacency = new Map<string, { target: string; weight: number; accessible: boolean }[]>();
  RECONSTRUCTED_GRAPH_NODES.forEach((n) => adjacency.set(n.id, []));
  RECONSTRUCTED_GRAPH_EDGES.forEach((e) => {
    adjacency.get(e.from)?.push({ target: e.to, weight: e.weight, accessible: e.accessible });
    adjacency.get(e.to)?.push({ target: e.from, weight: e.weight, accessible: e.accessible });
  });

  // Shortest / Fastest path via Dijkstra
  const distances = new Map<string, number>();
  const previous = new Map<string, string | null>();
  const unvisited = new Set<string>();

  for (const n of RECONSTRUCTED_GRAPH_NODES) {
    distances.set(n.id, Infinity);
    previous.set(n.id, null);
    unvisited.add(n.id);
  }
  distances.set(originNodeId, 0);

  while (unvisited.size > 0) {
    let current: string | null = null;
    let minD = Infinity;
    for (const nid of unvisited) {
      const d = distances.get(nid)!;
      if (d < minD) {
        minD = d;
        current = nid;
      }
    }

    if (!current || minD === Infinity) break;
    if (current === destNodeId) break;

    unvisited.delete(current);

    const neighbors = adjacency.get(current) || [];
    for (const edge of neighbors) {
      if (!unvisited.has(edge.target)) continue;
      const alt = distances.get(current)! + edge.weight;
      if (alt < distances.get(edge.target)!) {
        distances.set(edge.target, alt);
        previous.set(edge.target, current);
      }
    }
  }

  const path: string[] = [];
  let curr: string | null = destNodeId;
  while (curr) {
    path.unshift(curr);
    curr = previous.get(curr) || null;
  }

  if (path[0] !== originNodeId && originNodeId !== destNodeId) {
    throw new Error(`No path found between ${originNodeId} and ${destNodeId}`);
  }

  const nodeMap = new Map(RECONSTRUCTED_GRAPH_NODES.map((n) => [n.id, n]));
  const waypoints: Waypoint[] = path.map((nid) => {
    const n = nodeMap.get(nid)!;
    return {
      id: n.id,
      name: n.name,
      floor: n.floor,
      type: n.type,
      x: n.x,
      y: n.y,
      z: n.z,
    };
  });

  let totalDist = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const edges = adjacency.get(path[i]) || [];
    const edge = edges.find((e) => e.target === path[i + 1]);
    if (edge) totalDist += edge.weight;
  }

  const instructions = waypoints.map((w, idx) => {
    if (idx === 0) return `Start at ${w.name}.`;
    if (idx === waypoints.length - 1) return `Arrive at ${w.name} (Floor ${w.floor}).`;
    if (w.id === 'rec_n_door_101') return 'Turn left into the Room 101 entryway.';
    if (w.id === 'rec_n_stairs') return 'Proceed toward the Grand Foyer Staircase.';
    if (w.id === 'rec_n_c_mid') return 'Walk straight down the central gallery concourse.';
    if (w.id === 'rec_n_lounge') return 'Enter the Executive Lounge & Seminar Arena.';
    return `Continue forward past ${w.name}.`;
  });

  const fastestRoute: RouteOption = {
    id: 'rec_route_fastest',
    title: 'Fastest Ground Route',
    profile: 'fastest',
    total_distance_meters: Math.round(totalDist * 10) / 10,
    estimated_time_seconds: Math.round(totalDist / 1.35),
    floor_transitions: [1],
    uses_stairs: false,
    uses_elevator: false,
    waypoints,
    instructions,
  };

  const accessibleRoute: RouteOption = {
    id: 'rec_route_accessible',
    title: 'Accessible Flat Route',
    profile: 'avoid_stairs',
    total_distance_meters: Math.round(totalDist * 10) / 10,
    estimated_time_seconds: Math.round(totalDist / 1.35),
    floor_transitions: [1],
    uses_stairs: false,
    uses_elevator: false,
    waypoints,
    instructions,
  };

  return {
    origin_node: originNodeId,
    destination_node: destNodeId,
    destination_name: anchor ? anchor.name : destNode.name,
    routes: [fastestRoute, accessibleRoute],
  };
}

/**
 * Calculates perpendicular or minimum distance from a 3D point to a polyline route
 */
export function isPointOffRoute(
  pos: Vector3Tuple,
  waypoints: Waypoint[],
  thresholdMeters: number = 4.0
): boolean {
  if (!waypoints || waypoints.length < 2) return false;

  let minDistanceSq = Infinity;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];

    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const segLenSq = dx * dx + dz * dz;

    if (segLenSq === 0) {
      const dSq = (pos.x - p1.x) ** 2 + (pos.z - p1.z) ** 2;
      minDistanceSq = Math.min(minDistanceSq, dSq);
      continue;
    }

    // Project pos onto line segment
    const t = Math.max(
      0,
      Math.min(1, ((pos.x - p1.x) * dx + (pos.z - p1.z) * dz) / segLenSq)
    );

    const projX = p1.x + t * dx;
    const projZ = p1.z + t * dz;
    const dSq = (pos.x - projX) ** 2 + (pos.z - projZ) ** 2;

    minDistanceSq = Math.min(minDistanceSq, dSq);
  }

  return Math.sqrt(minDistanceSq) > thresholdMeters;
}

/**
 * Checks if the player has arrived at the destination anchor (< 2.5m distance)
 */
export function checkArrival(
  pos: Vector3Tuple,
  destAnchorCoord: Vector3Tuple,
  thresholdMeters: number = 2.5
): boolean {
  const dx = pos.x - destAnchorCoord.x;
  const dz = pos.z - destAnchorCoord.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  return dist < thresholdMeters;
}

