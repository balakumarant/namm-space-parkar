import spatialGraphData from '../data/spatial_graph.json';

export interface SpatialNode {
  id: string;
  name: string;
  floor: number;
  type: string;
  x: number;
  y: number;
  z: number;
  accessible: boolean;
}

export interface SpatialEdge {
  from: string;
  to: string;
  weight: number;
  type: 'flat' | 'stairs' | 'elevator';
  accessible: boolean;
}

export interface Waypoint {
  id: string;
  name: string;
  floor: number;
  type: string;
  x: number;
  y: number;
  z: number;
}

export interface RouteOption {
  id: string;
  title: string;
  profile: string;
  total_distance_meters: number;
  estimated_time_seconds: number;
  floor_transitions: number[];
  uses_stairs: boolean;
  uses_elevator: boolean;
  waypoints: Waypoint[];
  instructions: string[];
}

export interface RouteResponse {
  origin_node: string;
  destination_node: string;
  destination_name: string;
  routes: RouteOption[];
}

const API_BASE_URL = 'http://127.0.0.1:8000';

export class ClientPathfinder {
  private nodes: Map<string, SpatialNode> = new Map();
  private edges: SpatialEdge[] = [];
  private adjacency: Map<string, { target: string; weight: number; type: string; accessible: boolean }[]> = new Map();

  constructor() {
    this.initGraph();
  }

  private initGraph(): void {
    // Load embedded JSON
    (spatialGraphData.nodes as SpatialNode[]).forEach((n) => {
      this.nodes.set(n.id, n);
      this.adjacency.set(n.id, []);
    });

    this.edges = spatialGraphData.edges as SpatialEdge[];
    this.edges.forEach((e) => {
      this.adjacency.get(e.from)?.push({
        target: e.to,
        weight: e.weight,
        type: e.type,
        accessible: e.accessible,
      });
      this.adjacency.get(e.to)?.push({
        target: e.from,
        weight: e.weight,
        type: e.type,
        accessible: e.accessible,
      });
    });
  }

  public getNodes(): SpatialNode[] {
    return Array.from(this.nodes.values());
  }

  public findNearestNode(x: number, y: number, z: number, floor?: number): string {
    let bestNode = 'n_f1_entrance';
    let minDist = Infinity;

    for (const [id, n] of this.nodes.entries()) {
      if (floor !== undefined && n.floor !== floor) continue;
      const dx = n.x - x;
      const dy = (n.y - y) * 2.0;
      const dz = n.z - z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < minDist) {
        minDist = dist;
        bestNode = id;
      }
    }
    return bestNode;
  }

  /**
   * Request multi-criteria routes from FastAPI backend,
   * falling back seamlessly to client-side A* if backend is offline.
   */
  public async getRoutes(
    startX: number,
    startY: number,
    startZ: number,
    destinationId: string,
    currentFloor?: number
  ): Promise<RouteResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/navigation/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_x: startX,
          start_y: startY,
          start_z: startZ,
          destination_id: destinationId,
          start_floor: currentFloor,
        }),
      });

      if (response.ok) {
        return (await response.json()) as RouteResponse;
      }
    } catch {
      console.warn('Backend route API unreachable; computing route locally via client A* graph.');
    }

    // Client-side fallback solver
    return this.computeClientRoutes(startX, startY, startZ, destinationId, currentFloor);
  }

  private computeClientRoutes(
    startX: number,
    startY: number,
    startZ: number,
    destId: string,
    currentFloor?: number
  ): RouteResponse {
    const originNode = this.findNearestNode(startX, startY, startZ, currentFloor);
    const destNode = this.nodes.get(destId);
    if (!destNode) throw new Error(`Destination ${destId} not found`);

    const routes: RouteOption[] = [];

    // 1. Fastest Profile
    const fastestPath = this.dijkstra(originNode, destId, 'fastest');
    if (fastestPath) {
      routes.push(this.buildRouteOption('route_fastest', 'Fastest Route', 'fastest', fastestPath));
    }

    // 2. Accessible Profile (Elevator only)
    const accessPath = this.dijkstra(originNode, destId, 'avoid_stairs');
    if (accessPath) {
      routes.push(
        this.buildRouteOption(
          'route_accessible',
          'Accessible Route (Elevator Only)',
          'avoid_stairs',
          accessPath
        )
      );
    }

    // 3. Stairs Only Profile
    const stairsPath = this.dijkstra(originNode, destId, 'stairs_only');
    if (stairsPath && (!accessPath || stairsPath.join() !== accessPath.join())) {
      routes.push(
        this.buildRouteOption(
          'route_stairs',
          'Stairs Only Route (Active Walking)',
          'stairs_only',
          stairsPath
        )
      );
    }

    return {
      origin_node: originNode,
      destination_node: destId,
      destination_name: destNode.name,
      routes,
    };
  }

  private dijkstra(start: string, end: string, profile: string): string[] | null {
    const distances = new Map<string, number>();
    const previous = new Map<string, string | null>();
    const unvisited = new Set<string>();

    for (const id of this.nodes.keys()) {
      distances.set(id, Infinity);
      previous.set(id, null);
      unvisited.add(id);
    }
    distances.set(start, 0);

    while (unvisited.size > 0) {
      let current: string | null = null;
      let minDistance = Infinity;

      for (const id of unvisited) {
        const d = distances.get(id)!;
        if (d < minDistance) {
          minDistance = d;
          current = id;
        }
      }

      if (!current || minDistance === Infinity) break;
      if (current === end) break;

      unvisited.delete(current);

      const neighbors = this.adjacency.get(current) || [];
      for (const edge of neighbors) {
        if (!unvisited.has(edge.target)) continue;

        if (profile === 'avoid_stairs' && edge.type === 'stairs') continue;
        if (profile === 'stairs_only' && edge.type === 'elevator') continue;

        let weight = edge.weight;
        if (profile === 'fastest') {
          if (edge.type === 'elevator') weight += 8.0;
          else if (edge.type === 'stairs') weight *= 1.15;
        }

        const alt = distances.get(current)! + weight;
        if (alt < distances.get(edge.target)!) {
          distances.set(edge.target, alt);
          previous.set(edge.target, current);
        }
      }
    }

    const path: string[] = [];
    let curr: string | null = end;
    while (curr) {
      path.unshift(curr);
      curr = previous.get(curr) || null;
    }
    return path[0] === start ? path : null;
  }

  private buildRouteOption(
    id: string,
    title: string,
    profile: string,
    path: string[]
  ): RouteOption {
    let totalDist = 0;
    let usesStairs = false;
    let usesElevator = false;

    const waypoints: Waypoint[] = path.map((nid) => {
      const n = this.nodes.get(nid)!;
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

    const floors = Array.from(new Set(waypoints.map((w) => w.floor))).sort((a, b) => a - b);

    for (let i = 0; i < path.length - 1; i++) {
      const neighbors = this.adjacency.get(path[i]) || [];
      const edge = neighbors.find((e) => e.target === path[i + 1]);
      if (edge) {
        totalDist += edge.weight;
        if (edge.type === 'stairs') usesStairs = true;
        if (edge.type === 'elevator') usesElevator = true;
      }
    }

    const instructions = waypoints.map((w, idx) => {
      if (idx === 0) return `Start at ${w.name}.`;
      if (idx === waypoints.length - 1) return `Arrive at ${w.name} (Floor ${w.floor}).`;
      if (w.type === 'stair_landing') return `Ascend Staircase A to Floor ${w.floor}.`;
      if (w.type === 'elevator_car') return `Take Elevator A to Floor ${w.floor}.`;
      return `Head to ${w.name}.`;
    });

    return {
      id,
      title,
      profile,
      total_distance_meters: Math.round(totalDist * 10) / 10,
      estimated_time_seconds: Math.round(totalDist / 1.35) + (usesElevator ? 15 : 0),
      floor_transitions: floors,
      uses_stairs: usesStairs,
      uses_elevator: usesElevator,
      waypoints,
      instructions,
    };
  }
}

export const clientPathfinder = new ClientPathfinder();
