import math
import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import networkx as nx
from pydantic import BaseModel

DATA_FILE = Path(__file__).parent.parent / "data" / "spatial_graph.json"

class Waypoint(BaseModel):
    id: str
    name: str
    floor: int
    type: str
    x: float
    y: float
    z: float

class RouteOption(BaseModel):
    id: str
    title: str
    profile: str
    recommended: bool = False
    summary: str = ""
    total_distance_meters: float
    estimated_time_seconds: int
    floor_transitions: List[int]
    uses_stairs: bool
    uses_elevator: bool
    waypoints: List[Waypoint]
    instructions: List[str]

class RouteCalculationResponse(BaseModel):
    origin_node: str
    destination_node: str
    destination_name: str
    requested_preference: str = "fastest"
    routes: List[RouteOption]

class SpatialPathfinder:
    def __init__(self, data_path: Optional[Path] = None):
        self.data_path = data_path or DATA_FILE
        self.graph = nx.Graph()
        self.node_dict: Dict[str, Dict[str, Any]] = {}
        self.load_graph()

    def load_graph(self):
        with open(self.data_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.graph.clear()
        self.node_dict.clear()

        # Load Nodes
        for n in data["nodes"]:
            self.node_dict[n["id"]] = n
            self.graph.add_node(
                n["id"],
                name=n["name"],
                floor=n["floor"],
                type=n["type"],
                x=n["x"],
                y=n["y"],
                z=n["z"],
                accessible=n.get("accessible", True)
            )

        # Load Edges (undirected)
        for e in data["edges"]:
            self.graph.add_edge(
                e["from"],
                e["to"],
                weight=float(e["weight"]),
                type=e["type"],
                accessible=e.get("accessible", True)
            )

    def find_nearest_node(self, x: float, y: float, z: float, floor: Optional[int] = None) -> str:
        best_node = None
        min_dist = float("inf")

        for node_id, n in self.node_dict.items():
            # If floor is specified, prioritize nodes on the same floor
            if floor is not None and n["floor"] != floor:
                continue

            dx = n["x"] - x
            dy = (n["y"] - y) * 2.0  # Weight vertical distance higher
            dz = n["z"] - z
            dist = math.sqrt(dx * dx + dy * dy + dz * dz)

            if dist < min_dist:
                min_dist = dist
                best_node = node_id

        # Fallback to any node if floor filter had no matches
        if best_node is None:
            for node_id, n in self.node_dict.items():
                dx = n["x"] - x
                dy = (n["y"] - y) * 2.0
                dz = n["z"] - z
                dist = math.sqrt(dx * dx + dy * dy + dz * dz)
                if dist < min_dist:
                    min_dist = dist
                    best_node = node_id

        return best_node

    def calculate_path_profile(
        self,
        start_node: str,
        end_node: str,
        profile: str = "fastest"
    ) -> Optional[Tuple[List[str], float, bool, bool]]:
        """
        Computes path based on profile:
        - 'fastest': uses standard weights (elevator has slight 10s wait penalty)
        - 'avoid_stairs' / 'accessible': strictly filters out stair edges
        - 'stairs_only': strictly filters out elevator edges
        """
        # Build filtered/weighted subgraph
        subgraph = nx.Graph()

        for u, v, data in self.graph.edges(data=True):
            edge_type = data["type"]
            base_weight = data["weight"]

            if profile in ("avoid_stairs", "accessible") and edge_type == "stairs":
                continue  # Exclude stairs for accessible mode
            if profile == "stairs_only" and edge_type == "elevator":
                continue  # Exclude elevator for stairs-only mode

            # Weighting adjustments
            effective_weight = base_weight
            if profile == "fastest":
                if edge_type == "elevator":
                    effective_weight += 8.0  # 8m equivalent elevator wait penalty
                elif edge_type == "stairs":
                    effective_weight *= 1.15  # Stairs require slightly more effort
            elif profile in ("avoid_stairs", "accessible"):
                if edge_type == "elevator":
                    effective_weight *= 0.9  # Prioritize elevator

            subgraph.add_edge(u, v, weight=effective_weight, original_weight=base_weight, type=edge_type)

        if not nx.has_path(subgraph, start_node, end_node):
            return None

        # Run A* or Dijkstra
        path = nx.shortest_path(subgraph, source=start_node, target=end_node, weight="weight")

        # Compute physical distance and flags
        physical_dist = 0.0
        has_stairs = False
        has_elevator = False

        for i in range(len(path) - 1):
            edge_data = self.graph.get_edge_data(path[i], path[i + 1])
            physical_dist += edge_data["weight"]
            if edge_data["type"] == "stairs":
                has_stairs = True
            elif edge_data["type"] == "elevator":
                has_elevator = True

        return path, physical_dist, has_stairs, has_elevator

    def generate_turn_instructions(self, path: List[str]) -> List[str]:
        if not path or len(path) == 1:
            return ["You are already at your destination."]

        instructions: List[str] = []
        instructions.append(f"Start from {self.node_dict[path[0]]['name']}.")

        i = 0
        while i < len(path) - 1:
            curr_n = self.node_dict[path[i]]
            next_n = self.node_dict[path[i + 1]]
            edge = self.graph.get_edge_data(path[i], path[i + 1])
            edge_type = edge["type"]

            if edge_type == "stairs":
                target_floor = next_n["floor"]
                instructions.append(f"Ascend Staircase A up to Floor {target_floor}.")
                i += 1
                continue

            if edge_type == "elevator":
                target_floor = next_n["floor"]
                instructions.append(f"Take Elevator A to Floor {target_floor}.")
                i += 1
                continue

            # Flat movement - check for turn
            dist = edge["weight"]
            if i + 2 < len(path):
                after_next = self.node_dict[path[i + 2]]
                after_edge = self.graph.get_edge_data(path[i + 1], path[i + 2])

                # If subsequent movement is stairs or elevator, announce upcoming transition
                if after_edge["type"] in ("stairs", "elevator"):
                    facility = "Staircase A" if after_edge["type"] == "stairs" else "Elevator A"
                    instructions.append(f"Walk {dist:.1f}m along corridor towards {facility}.")
                    i += 1
                    continue

                # Compute relative turn angle between vectors (curr->next) and (next->after_next)
                v1 = (next_n["x"] - curr_n["x"], next_n["z"] - curr_n["z"])
                v2 = (after_next["x"] - next_n["x"], after_next["z"] - next_n["z"])
                cross_product = v1[0] * v2[1] - v1[1] * v2[0]
                dot_product = v1[0] * v2[0] + v1[1] * v2[1]
                angle_deg = math.degrees(math.atan2(cross_product, dot_product))

                if angle_deg > 35:
                    turn = "Turn right"
                elif angle_deg < -35:
                    turn = "Turn left"
                else:
                    turn = "Continue straight"

                instructions.append(f"{turn} and walk {dist:.1f}m to {next_n['name']}.")
            else:
                instructions.append(f"Walk {dist:.1f}m to {next_n['name']}.")

            i += 1

        dest_name = self.node_dict[path[-1]]["name"]
        instructions.append(f"Arrive at your destination: {dest_name}.")
        return instructions

    def get_multi_routes(
        self,
        start_x: float,
        start_y: float,
        start_z: float,
        dest_node_id: str,
        start_floor: Optional[int] = None
    ) -> RouteCalculationResponse:
        start_node = self.find_nearest_node(start_x, start_y, start_z, start_floor)
        dest_node = dest_node_id

        if dest_node not in self.node_dict:
            raise ValueError(f"Destination node '{dest_node}' not found")

        dest_info = self.node_dict[dest_node]
        routes: List[RouteOption] = []

        # 1. Fastest Route
        fastest_result = self.calculate_path_profile(start_node, dest_node, profile="fastest")
        if fastest_result:
            path, dist, stairs, elev = fastest_result
            floors = sorted(list(set(self.node_dict[nid]["floor"] for nid in path)))
            waypoints = [
                Waypoint(
                    id=nid,
                    name=self.node_dict[nid]["name"],
                    floor=self.node_dict[nid]["floor"],
                    type=self.node_dict[nid]["type"],
                    x=self.node_dict[nid]["x"],
                    y=self.node_dict[nid]["y"],
                    z=self.node_dict[nid]["z"]
                ) for nid in path
            ]
            eta = int(dist / 1.35) + (15 if elev else 0)
            instructions = self.generate_turn_instructions(path)

            via_desc = "via Elevator" if elev else ("via Stairs" if stairs else "Direct")
            routes.append(
                RouteOption(
                    id="route_fastest",
                    title=f"Fastest Route ({via_desc})",
                    profile="fastest",
                    total_distance_meters=round(dist, 1),
                    estimated_time_seconds=eta,
                    floor_transitions=floors,
                    uses_stairs=stairs,
                    uses_elevator=elev,
                    waypoints=waypoints,
                    instructions=instructions
                )
            )

        # 2. Accessible / Barrier-Free Route (strictly avoid stairs)
        access_result = self.calculate_path_profile(start_node, dest_node, profile="avoid_stairs")
        if access_result:
            path, dist, stairs, elev = access_result
            floors = sorted(list(set(self.node_dict[nid]["floor"] for nid in path)))
            waypoints = [
                Waypoint(
                    id=nid,
                    name=self.node_dict[nid]["name"],
                    floor=self.node_dict[nid]["floor"],
                    type=self.node_dict[nid]["type"],
                    x=self.node_dict[nid]["x"],
                    y=self.node_dict[nid]["y"],
                    z=self.node_dict[nid]["z"]
                ) for nid in path
            ]
            eta = int(dist / 1.35) + (18 if elev else 0)
            instructions = self.generate_turn_instructions(path)

            routes.append(
                RouteOption(
                    id="route_accessible",
                    title="Accessible Route (Elevator Only - No Stairs)",
                    profile="avoid_stairs",
                    total_distance_meters=round(dist, 1),
                    estimated_time_seconds=eta,
                    floor_transitions=floors,
                    uses_stairs=False,
                    uses_elevator=elev,
                    waypoints=waypoints,
                    instructions=instructions
                )
            )

        # 3. Stairs-Only Route (strictly avoid elevators)
        stairs_result = self.calculate_path_profile(start_node, dest_node, profile="stairs_only")
        if stairs_result:
            path, dist, stairs, elev = stairs_result
            # Only add if distinct from accessible route
            if not access_result or path != access_result[0]:
                floors = sorted(list(set(self.node_dict[nid]["floor"] for nid in path)))
                waypoints = [
                    Waypoint(
                        id=nid,
                        name=self.node_dict[nid]["name"],
                        floor=self.node_dict[nid]["floor"],
                        type=self.node_dict[nid]["type"],
                        x=self.node_dict[nid]["x"],
                        y=self.node_dict[nid]["y"],
                        z=self.node_dict[nid]["z"]
                    ) for nid in path
                ]
                eta = int(dist / 1.35)
                instructions = self.generate_turn_instructions(path)

                routes.append(
                    RouteOption(
                        id="route_stairs",
                        title="Stairs Only Route (Active Walking)",
                        profile="stairs_only",
                        total_distance_meters=round(dist, 1),
                        estimated_time_seconds=eta,
                        floor_transitions=floors,
                        uses_stairs=True,
                        uses_elevator=False,
                        waypoints=waypoints,
                        instructions=instructions
                    )
                )

        return RouteCalculationResponse(
            origin_node=start_node,
            destination_node=dest_node,
            destination_name=dest_info["name"],
            routes=routes
        )

RECONSTRUCTED_DATA_FILE = Path(__file__).parent.parent / "data" / "reconstructed_spatial_graph.json"

pathfinder = SpatialPathfinder()
reconstructed_pathfinder = SpatialPathfinder(RECONSTRUCTED_DATA_FILE) if RECONSTRUCTED_DATA_FILE.exists() else pathfinder

RECONSTRUCTED_POI_TO_NODE = {
    "f1_entrance": "rec_n_entrance",
    "f1_stairs": "rec_n_stairs",
    "f1_c_mid": "rec_n_c_mid",
    "room_101": "rec_n_room_101",
    "f1_c_north": "rec_n_lounge",
}

def get_routes_for_mode(
    start_x: float,
    start_y: float,
    start_z: float,
    dest_id: str,
    start_floor: Optional[int] = None,
    mode: str = "procedural"
) -> RouteCalculationResponse:
    if mode == "reconstructed" or dest_id.startswith("rec_") or dest_id in RECONSTRUCTED_POI_TO_NODE:
        actual_dest = RECONSTRUCTED_POI_TO_NODE.get(dest_id, dest_id)
        return reconstructed_pathfinder.get_multi_routes(
            start_x=start_x,
            start_y=start_y,
            start_z=start_z,
            dest_node_id=actual_dest,
            start_floor=1
        )
    return pathfinder.get_multi_routes(
        start_x=start_x,
        start_y=start_y,
        start_z=start_z,
        dest_node_id=dest_id,
        start_floor=start_floor
    )

