import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from core.pathfinding import pathfinder

def test_routing():
    print("1. Testing Graph Loading...")
    assert len(pathfinder.graph.nodes) > 30, f"Expected >30 nodes, got {len(pathfinder.graph.nodes)}"
    assert len(pathfinder.graph.edges) > 30, f"Expected >30 edges, got {len(pathfinder.graph.edges)}"
    print(f"   Graph loaded with {len(pathfinder.graph.nodes)} nodes and {len(pathfinder.graph.edges)} edges.")

    print("\n2. Testing Nearest Node Lookup...")
    near_entrance = pathfinder.find_nearest_node(0.0, 0.5, 23.5, floor=1)
    assert near_entrance == "n_f1_entrance", f"Expected n_f1_entrance, got {near_entrance}"
    print(f"   Nearest node to entrance (0, 0.5, 23.5) = {near_entrance}")

    print("\n3. Testing Multi-Route Calculation to Room 301 (Floor 3)...")
    # Room 301 is Innovation Incubation Cell on Floor 3
    resp = pathfinder.get_multi_routes(
        start_x=0.0,
        start_y=0.5,
        start_z=24.0,
        dest_node_id="n_f3_r301_inside",
        start_floor=1
    )

    assert len(resp.routes) >= 2, f"Expected at least 2 route options, got {len(resp.routes)}"
    print(f"   Generated {len(resp.routes)} routes to {resp.destination_name}:")

    for r in resp.routes:
        print(f"   - [{r.title}] Dist: {r.total_distance_meters}m | ETA: {r.estimated_time_seconds}s | Stairs: {r.uses_stairs} | Elevator: {r.uses_elevator}")
        assert len(r.waypoints) > 3, "Expected waypoints in route"
        assert len(r.instructions) > 1, "Expected turn-by-turn instructions"

    # Verify Accessible route strictly avoids stairs
    accessible_route = next((r for r in resp.routes if r.profile == "avoid_stairs"), None)
    assert accessible_route is not None, "Accessible route must be present for multi-floor target"
    assert accessible_route.uses_stairs is False, "Accessible route must NOT use stairs"
    assert accessible_route.uses_elevator is True, "Accessible route MUST use elevator"
    print("   [VERIFIED] Accessible route strictly bypasses all stair flights and uses Elevator A.")

    print("\n4. Testing Same-Floor Route (F1 Entrance to Room 101)...")
    same_floor_resp = pathfinder.get_multi_routes(
        start_x=0.0,
        start_y=0.5,
        start_z=24.0,
        dest_node_id="n_f1_r101_inside",
        start_floor=1
    )
    assert len(same_floor_resp.routes) >= 1
    f_route = same_floor_resp.routes[0]
    assert f_route.uses_stairs is False
    assert f_route.uses_elevator is False
    print(f"   Same-floor distance: {f_route.total_distance_meters}m. Steps: {len(f_route.instructions)}")

    print("\n[SUCCESS] All spatial routing tests passed successfully!")

if __name__ == "__main__":
    test_routing()
