import math
from typing import Dict, Any, List, Optional
from core.pathfinding import pathfinder

def search_places(query: str) -> List[Dict[str, Any]]:
    """
    Search for rooms, labs, stairs, elevators, or facilities in the 3D building.
    """
    q = query.lower().strip()
    results = []

    for node_id, n in pathfinder.node_dict.items():
        name = n["name"].lower()
        ntype = n["type"].lower()
        
        # Match against id, name, type
        if q in name or q in node_id.lower() or q in ntype:
            results.append({
                "id": node_id,
                "name": n["name"],
                "floor": n["floor"],
                "type": n["type"],
                "accessible": n.get("accessible", True),
                "coordinates": {"x": n["x"], "y": n["y"], "z": n["z"]}
            })
            continue

        # Number matching (e.g. "302" matches "Room 302")
        for word in q.split():
            if len(word) >= 3 and word.isdigit() and word in name:
                results.append({
                    "id": node_id,
                    "name": n["name"],
                    "floor": n["floor"],
                    "type": n["type"],
                    "accessible": n.get("accessible", True),
                    "coordinates": {"x": n["x"], "y": n["y"], "z": n["z"]}
                })
                break

    # Prioritize inside room nodes over door/corridor nodes
    results.sort(key=lambda x: 0 if "inside" in x["id"] else 1)
    return results[:8]

def get_place_info(place_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve authoritative ground truth details for a place in the building.
    """
    # Direct node lookup
    if place_id in pathfinder.node_dict:
        n = pathfinder.node_dict[place_id]
        return {
            "id": place_id,
            "name": n["name"],
            "floor": n["floor"],
            "type": n["type"],
            "accessible": n.get("accessible", True),
            "coordinates": {"x": n["x"], "y": n["y"], "z": n["z"]}
        }

    # Search by friendly name or room number
    matches = search_places(place_id)
    if matches:
        return matches[0]

    return None

def calculate_route(
    destination: str,
    preference: str = "fastest",
    player_x: float = 0.0,
    player_y: float = 0.5,
    player_z: float = 24.0,
    player_floor: int = 1
) -> Dict[str, Any]:
    """
    Execute multi-criteria A* pathfinding via the spatial navigation engine.
    """
    # Resolve destination to valid node_id
    dest_info = get_place_info(destination)
    if not dest_info:
        return {
            "error": f"Destination '{destination}' could not be resolved to any location in the building."
        }

    dest_node_id = dest_info["id"]

    # Map preference to pathfinder profiles
    norm_pref = preference.lower().replace("-", "_").replace(" ", "_")
    if "avoid_stair" in norm_pref or "elevator" in norm_pref or "access" in norm_pref or "wheelchair" in norm_pref:
        profile = "avoid_stairs"
    elif "stair" in norm_pref:
        profile = "stairs_only"
    else:
        profile = "fastest"

    try:
        route_resp = pathfinder.get_multi_routes(
            start_x=player_x,
            start_y=player_y,
            start_z=player_z,
            dest_node_id=dest_node_id,
            start_floor=player_floor
        )

        # Select the preferred route candidate
        chosen_route = None
        for r in route_resp.routes:
            if r.profile == profile:
                chosen_route = r
                break
        if not chosen_route and route_resp.routes:
            chosen_route = route_resp.routes[0]

        return {
            "success": True,
            "origin_node": route_resp.origin_node,
            "destination_node": route_resp.destination_node,
            "destination_name": route_resp.destination_name,
            "requested_preference": profile,
            "active_route": chosen_route.dict() if chosen_route else None,
            "all_routes": [r.dict() for r in route_resp.routes]
        }
    except Exception as e:
        return {"error": f"Failed to compute route: {str(e)}"}

def get_current_location(x: float, y: float, z: float, floor: int) -> Dict[str, Any]:
    """
    Determine the player's immediate spatial context and closest landmarks.
    """
    nearest_node_id = pathfinder.find_nearest_node(x, y, z, floor)
    node_info = pathfinder.node_dict.get(nearest_node_id, {})

    # Calculate distance to nearest node
    dx = node_info.get("x", x) - x
    dz = node_info.get("z", z) - z
    dist = math.sqrt(dx * dx + dz * dz)

    return {
        "current_floor": floor,
        "nearest_waypoint": node_info.get("name", "Corridor"),
        "distance_to_waypoint_meters": round(dist, 1),
        "coordinates": {"x": round(x, 1), "y": round(y, 1), "z": round(z, 1)}
    }

def get_floor_info(floor: int) -> Dict[str, Any]:
    """
    Get an authoritative breakdown of what exists on a given building floor.
    """
    rooms = []
    facilities = []

    for node_id, n in pathfinder.node_dict.items():
        if n["floor"] == floor:
            if n["type"] == "room_inside":
                rooms.append({"id": node_id, "name": n["name"]})
            elif n["type"] in ("elevator_lobby", "stair_landing", "entrance"):
                facilities.append({"id": node_id, "name": n["name"], "type": n["type"]})

    return {
        "floor": floor,
        "rooms_count": len(rooms),
        "rooms": rooms,
        "facilities": facilities
    }

def get_nearest_place(category: str, x: float, y: float, z: float, floor: int) -> Dict[str, Any]:
    """
    Find the closest POI of a given category (lab, room, elevator, stairs, entrance).
    """
    cat = category.lower()
    candidates = []

    for node_id, n in pathfinder.node_dict.items():
        name = n["name"].lower()
        ntype = n["type"].lower()

        match = False
        if "lab" in cat and ("lab" in name or "studio" in name or "center" in name or "arena" in name):
            match = True
        elif "elevator" in cat and "elevator" in ntype:
            match = True
        elif ("stair" in cat or "stairs" in cat) and "stair" in ntype:
            match = True
        elif "entrance" in cat and "entrance" in ntype:
            match = True
        elif "room" in cat and "inside" in ntype:
            match = True

        if match:
            dx = n["x"] - x
            dy = (n["y"] - y) * 2.0
            dz = n["z"] - z
            dist = math.sqrt(dx * dx + dy * dy + dz * dz)
            candidates.append((dist, node_id, n))

    if not candidates:
        return {"error": f"No places matching category '{category}' found."}

    candidates.sort(key=lambda item: item[0])
    best_dist, best_id, best_node = candidates[0]

    return {
        "id": best_id,
        "name": best_node["name"],
        "floor": best_node["floor"],
        "distance_meters": round(best_dist, 1),
        "same_floor": best_node["floor"] == floor
    }
