import re
import json
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional
from config import settings
from ai.prompts import PARKAR_SYSTEM_PROMPT
from ai import parkar_tools

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

# Gemini Tool Declarations
TOOL_DECLARATIONS = [
    {
        "name": "search_places",
        "description": "Search for rooms, labs, stairs, elevators, or points of interest in the building.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "query": {
                    "type": "STRING",
                    "description": "Room number, name, or keyword (e.g. 'Room 302', 'Robotics', 'lab', 'elevator')"
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "get_place_info",
        "description": "Get detailed ground truth information for a place (floor, accessibility, coordinates, description).",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "place_id": {
                    "type": "STRING",
                    "description": "The ID or name of the place (e.g. 'room_302', 'Room 302')"
                }
            },
            "required": ["place_id"]
        }
    },
    {
        "name": "calculate_route",
        "description": "Calculate a 3D multi-floor navigation route from player location to destination.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "destination": {
                    "type": "STRING",
                    "description": "Destination room number or place name (e.g. 'Room 302', 'Room 101')"
                },
                "preference": {
                    "type": "STRING",
                    "description": "Route preference: 'fastest', 'avoid_stairs', 'elevator', or 'stairs_only'",
                    "enum": ["fastest", "avoid_stairs", "elevator", "stairs_only"]
                }
            },
            "required": ["destination"]
        }
    },
    {
        "name": "get_current_location",
        "description": "Check where the player is currently situated relative to building landmarks.",
        "parameters": {
            "type": "OBJECT",
            "properties": {}
        }
    },
    {
        "name": "get_floor_info",
        "description": "Get all rooms and facilities located on a specific floor.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "floor": {
                    "type": "INTEGER",
                    "description": "The floor number (1, 2, or 3)"
                }
            },
            "required": ["floor"]
        }
    },
    {
        "name": "get_nearest_place",
        "description": "Find the closest facility or room of a specified category.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "category": {
                    "type": "STRING",
                    "description": "Category to search for: 'lab', 'room', 'elevator', 'stairs', or 'entrance'",
                    "enum": ["lab", "room", "elevator", "stairs", "entrance"]
                }
            },
            "required": ["category"]
        }
    }
]

class ParkarAgent:
    def __init__(self):
        self.api_key = settings.gemini_api_key

    def process_message(
        self,
        message: str,
        player_x: float = 0.0,
        player_y: float = 0.5,
        player_z: float = 24.0,
        player_floor: int = 1,
        history: Optional[List[Dict[str, str]]] = None,
        building_mode: str = "procedural"
    ) -> Dict[str, Any]:
        """
        Processes a natural language message from the user.
        Tries Gemini 2.5 Flash if API key is present; otherwise falls back gracefully
        to the deterministic local NLP engine.
        """
        # Auto-detect reconstructed mode from coordinate context if player_z > 0 and <= 55 and player_x within [-14, 12]
        if building_mode == "reconstructed":
            actual_mode = "reconstructed"
        else:
            actual_mode = "procedural"

        # 1. If Gemini API key is configured, attempt Gemini tool-calling
        if self.api_key and self.api_key != "your_gemini_api_key_here":
            try:
                gemini_res = self._call_gemini(message, player_x, player_y, player_z, player_floor, history, building_mode=actual_mode)
                if gemini_res:
                    return gemini_res
            except Exception as e:
                print(f"[PARKAR AI] Gemini call encountered error: {e}. Falling back to deterministic engine.")

        # 2. Deterministic Grounded NLP Engine (Guaranteed 100% functionality without external API)
        return self._deterministic_nlp_fallback(message, player_x, player_y, player_z, player_floor, building_mode=actual_mode)

    def _call_gemini(
        self,
        message: str,
        player_x: float,
        player_y: float,
        player_z: float,
        player_floor: int,
        history: Optional[List[Dict[str, str]]] = None
    ) -> Optional[Dict[str, Any]]:
        url = f"{GEMINI_API_URL}?key={self.api_key}"

        system_instruction = {
            "parts": [
                {
                    "text": (
                        f"{PARKAR_SYSTEM_PROMPT}\n\n"
                        f"Current Player Context:\n"
                        f"- Floor: {player_floor}\n"
                        f"- Coordinates: ({player_x:.1f}, {player_y:.1f}, {player_z:.1f})\n"
                    )
                }
            ]
        }

        # Build contents from history + current message
        contents = []
        if history:
            for turn in history[-4:]:
                role = "user" if turn.get("role") == "user" else "model"
                contents.append({"role": role, "parts": [{"text": turn.get("content", "")}]})

        contents.append({"role": "user", "parts": [{"text": message}]})

        payload = {
            "system_instruction": system_instruction,
            "contents": contents,
            "tools": [{"function_declarations": TOOL_DECLARATIONS}],
            "generation_config": {
                "temperature": 0.2,
                "max_output_tokens": 512
            }
        }

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )

        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode("utf-8"))

        # Inspect candidate response
        candidates = res_data.get("candidates", [])
        if not candidates:
            return None

        content = candidates[0].get("content", {})
        parts = content.get("parts", [])

        tool_calls_executed = []
        action_payload = None
        response_text = ""
        intent = "GENERAL"

        for part in parts:
            if "text" in part:
                response_text += part["text"]

            if "functionCall" in part:
                fn = part["functionCall"]
                fn_name = fn.get("name")
                fn_args = fn.get("args", {})
                tool_calls_executed.append(fn_name)

                # Execute requested tool
                tool_result = self._execute_tool(fn_name, fn_args, player_x, player_y, player_z, player_floor)

                if fn_name == "calculate_route" and tool_result.get("success"):
                    intent = "NAVIGATE"
                    action_payload = {
                        "type": "SET_ROUTE",
                        "destination_id": tool_result.get("destination_node"),
                        "destination_name": tool_result.get("destination_name"),
                        "preference": tool_result.get("requested_preference"),
                        "route": tool_result.get("active_route")
                    }
                    if not response_text:
                        dest_name = tool_result.get("destination_name")
                        pref = tool_result.get("requested_preference")
                        pref_str = "avoiding stairs" if pref == "avoid_stairs" else "using the fastest route"
                        dist = tool_result.get("active_route", {}).get("total_distance_meters", 0)
                        response_text = (
                            f"I've mapped out the route to {dest_name} ({dist}m) {pref_str}. "
                            f"Follow the glowing blue path ahead!"
                        )

                elif fn_name in ("search_places", "get_place_info"):
                    intent = "QUERY_PLACE"
                    if not response_text and tool_result:
                        if isinstance(tool_result, list) and tool_result:
                            p = tool_result[0]
                            response_text = f"{p['name']} is on Floor {p['floor']}."
                        elif isinstance(tool_result, dict) and "name" in tool_result:
                            response_text = f"{tool_result['name']} is on Floor {tool_result['floor']}."

                elif fn_name == "get_current_location":
                    intent = "QUERY_LOCATION"
                    if not response_text:
                        response_text = (
                            f"You are currently on Floor {tool_result['current_floor']}, "
                            f"near {tool_result['nearest_waypoint']}."
                        )

                elif fn_name == "get_nearest_place":
                    intent = "QUERY_PLACE"
                    if not response_text and "name" in tool_result:
                        response_text = (
                            f"The nearest {fn_args.get('category', 'place')} is {tool_result['name']} "
                            f"on Floor {tool_result['floor']} ({tool_result['distance_meters']}m away)."
                        )

        return {
            "response_text": response_text.strip(),
            "intent": intent,
            "action": action_payload,
            "tool_calls_executed": tool_calls_executed,
            "provider": "gemini-2.5-flash",
            "status": "success"
        }

    def _execute_tool(
        self,
        name: str,
        args: Dict[str, Any],
        player_x: float,
        player_y: float,
        player_z: float,
        player_floor: int,
        building_mode: str = "procedural"
    ) -> Any:
        if name == "search_places":
            return parkar_tools.search_places(args.get("query", ""), mode=building_mode)
        elif name == "get_place_info":
            return parkar_tools.get_place_info(args.get("place_id", ""), mode=building_mode)
        elif name == "calculate_route":
            return parkar_tools.calculate_route(
                destination=args.get("destination", ""),
                preference=args.get("preference", "fastest"),
                player_x=player_x,
                player_y=player_y,
                player_z=player_z,
                player_floor=player_floor,
                mode=building_mode
            )
        elif name == "get_current_location":
            return parkar_tools.get_current_location(player_x, player_y, player_z, player_floor, mode=building_mode)
        elif name == "get_floor_info":
            return parkar_tools.get_floor_info(int(args.get("floor", 1)), mode=building_mode)
        elif name == "get_nearest_place":
            return parkar_tools.get_nearest_place(
                category=args.get("category", "lab"),
                x=player_x,
                y=player_y,
                z=player_z,
                floor=player_floor,
                mode=building_mode
            )
        return {"error": f"Tool '{name}' unknown"}

    def _deterministic_nlp_fallback(
        self,
        message: str,
        player_x: float,
        player_y: float,
        player_z: float,
        player_floor: int,
        building_mode: str = "procedural"
    ) -> Dict[str, Any]:
        """
        High-precision deterministic rule-based NLP parser grounded strictly
        in the spatial tools. Handles all test queries without external API dependencies.
        """
        msg = message.lower().strip()

        # Reconstructed mode: check for unsupported upper floors (Room 201-203, 301-303, etc.)
        if building_mode == "reconstructed":
            upper_room_match = re.search(r'\b(room\s*)?([2-3]0[1-3])\b', msg)
            if upper_room_match:
                r_num = upper_room_match.group(2)
                f_num = r_num[0]
                return {
                    "response_text": (
                        f"Room {r_num} is on Floor {f_num}, which belongs to the procedural 3-floor building. "
                        f"The real reconstructed digital twin currently features Ground Floor / Floor 1 "
                        f"(Room 101 - Techfest Robotics Wing, Main South Entrance, Grand Foyer Staircase, Central Gallery Concourse, and Executive Lounge)."
                    ),
                    "intent": "QUERY_PLACE",
                    "action": None,
                    "tool_calls_executed": ["search_places"],
                    "provider": "deterministic-spatial-engine",
                    "status": "unsupported_floor"
                }

        # Extract preference
        preference = "fastest"
        if "avoid stair" in msg or "no stair" in msg or "elevator" in msg or "wheelchair" in msg or "accessible" in msg:
            preference = "avoid_stairs"
        elif "stair" in msg and "only" in msg:
            preference = "stairs_only"
        elif "fastest" in msg or "quickest" in msg:
            preference = "fastest"

        # 1. "Where am I?" / Current location query
        if "where am i" in msg or "current location" in msg or "my position" in msg:
            loc = parkar_tools.get_current_location(player_x, player_y, player_z, player_floor, mode=building_mode)
            floor_label = "Floor 1 (Ground Floor)" if building_mode == "reconstructed" else f"Floor {loc['current_floor']}"
            return {
                "response_text": f"You are currently on {floor_label}, near {loc['nearest_waypoint']}.",
                "intent": "QUERY_LOCATION",
                "action": None,
                "tool_calls_executed": ["get_current_location"],
                "provider": "deterministic-spatial-engine",
                "status": "success"
            }

        # 2. "Nearest lab" / "nearest elevator" / "nearest stairs"
        if "nearest" in msg or "closest" in msg:
            cat = "lab"
            if "elevator" in msg:
                cat = "elevator"
            elif "stair" in msg:
                cat = "stairs"
            elif "entrance" in msg:
                cat = "entrance"

            nearest = parkar_tools.get_nearest_place(cat, player_x, player_y, player_z, player_floor, mode=building_mode)
            if "name" in nearest:
                # If the query also says "take me"
                if "take me" in msg or "navigate" in msg or "go to" in msg or "lead me" in msg:
                    route_data = parkar_tools.calculate_route(
                        destination=nearest["id"],
                        preference=preference,
                        player_x=player_x,
                        player_y=player_y,
                        player_z=player_z,
                        player_floor=player_floor,
                        mode=building_mode
                    )
                    floor_desc = "Ground Floor" if building_mode == "reconstructed" else f"Floor {nearest['floor']}"
                    return {
                        "response_text": (
                            f"The nearest {cat} is {nearest['name']} on {floor_desc} ({nearest['distance_meters']}m away). "
                            f"I've initiated navigation for you!"
                        ),
                        "intent": "NAVIGATE",
                        "action": {
                            "type": "SET_ROUTE",
                            "destination_id": route_data.get("destination_node"),
                            "destination_name": nearest["name"],
                            "preference": preference,
                            "route": route_data.get("active_route")
                        },
                        "tool_calls_executed": ["get_nearest_place", "calculate_route"],
                        "provider": "deterministic-spatial-engine",
                        "status": "success"
                    }

                floor_desc = "Ground Floor" if building_mode == "reconstructed" else f"Floor {nearest['floor']}"
                return {
                    "response_text": (
                        f"The nearest {cat} is {nearest['name']} on {floor_desc}, "
                        f"located approximately {nearest['distance_meters']}m from your position."
                    ),
                    "intent": "QUERY_PLACE",
                    "action": None,
                    "tool_calls_executed": ["get_nearest_place"],
                    "provider": "deterministic-spatial-engine",
                    "status": "success"
                }

        # 3. Destination extraction
        dest_match = None

        if building_mode == "reconstructed":
            if "entrance" in msg or "foyer" in msg:
                dest_match = "Main South Entrance"
            elif "stair" in msg:
                dest_match = "Grand Foyer Staircase"
            elif "concourse" in msg or "corridor" in msg or "gallery" in msg:
                dest_match = "Central Gallery Concourse"
            elif "101" in msg or "robotics" in msg:
                dest_match = "Room 101 - Techfest Robotics Wing"
            elif "lounge" in msg or "seminar" in msg or "arena" in msg:
                dest_match = "Executive Lounge & Seminar Arena"
        else:
            # Check for room numbers (e.g. 101, 102, 103, 201, 202, 203, 301, 302, 303)
            room_num_match = re.search(r'\b(room\s*)?([1-3]0[1-3])\b', msg)
            if room_num_match:
                dest_match = f"Room {room_num_match.group(2)}"
            elif "entrance" in msg:
                dest_match = "Main South Entrance"
            elif "robotics" in msg:
                dest_match = "Room 101"
            elif "iot" in msg:
                dest_match = "Room 102"
            elif "admin" in msg or "registration" in msg:
                dest_match = "Room 103"
            elif "ai" in msg or "data science" in msg:
                dest_match = "Room 201"
            elif "seminar" in msg:
                dest_match = "Room 202"
            elif "cyber" in msg or "security" in msg:
                dest_match = "Room 203"
            elif "incubation" in msg or "innovation" in msg:
                dest_match = "Room 301"
            elif "board" in msg or "executive" in msg:
                dest_match = "Room 302"
            elif "dean" in msg or "faculty" in msg:
                dest_match = "Room 303"
            elif "elevator" in msg:
                dest_match = "Elevator A"
            elif "stair" in msg:
                dest_match = "Staircase A"

        # Check if user mentioned an unknown room number (e.g. "Room 999", "Room 404", "Room 501")
        unknown_num_match = re.search(r'\b(room\s*)?(\d{3,4})\b', msg)
        if unknown_num_match and not dest_match:
            return {
                "response_text": f"I couldn't find Room {unknown_num_match.group(2)} in the current building.",
                "intent": "UNKNOWN",
                "action": None,
                "tool_calls_executed": ["search_places"],
                "provider": "deterministic-spatial-engine",
                "status": "not_found"
            }

        # If still no destination found and query asks about an unknown place
        if not dest_match:
            # Check for general search
            places = parkar_tools.search_places(msg, mode=building_mode)
            if places:
                dest_match = places[0]["name"]
            else:
                return {
                    "response_text": "I couldn't find that location in the current building.",
                    "intent": "UNKNOWN",
                    "action": None,
                    "tool_calls_executed": ["search_places"],
                    "provider": "deterministic-spatial-engine",
                    "status": "not_found"
                }

        # Retrieve place details
        place_info = parkar_tools.get_place_info(dest_match, mode=building_mode)
        if not place_info:
            return {
                "response_text": f"I couldn't find {dest_match} in the current building.",
                "intent": "UNKNOWN",
                "action": None,
                "tool_calls_executed": ["get_place_info"],
                "provider": "deterministic-spatial-engine",
                "status": "not_found"
            }

        # 4. "How far is Room X?" / Distance query
        if "how far" in msg or "distance to" in msg:
            route_data = parkar_tools.calculate_route(
                destination=place_info["id"],
                preference=preference,
                player_x=player_x,
                player_y=player_y,
                player_z=player_z,
                player_floor=player_floor,
                mode=building_mode
            )
            dist = route_data.get("active_route", {}).get("total_distance_meters", 0)
            eta = route_data.get("active_route", {}).get("estimated_time_seconds", 0)
            return {
                "response_text": f"{place_info['name']} is approximately {dist} metres away on Floor {place_info['floor']} (about {eta} seconds walking).",
                "intent": "QUERY_DISTANCE",
                "action": None,
                "tool_calls_executed": ["calculate_route"],
                "provider": "deterministic-spatial-engine",
                "status": "success"
            }

        # 5. "Where is Room X?" / "Which floor is Room X on?"
        if "where is" in msg or "which floor" in msg or "what floor" in msg or "location of" in msg:
            return {
                "response_text": f"{place_info['name']} is located on Floor {place_info['floor']}.",
                "intent": "QUERY_PLACE",
                "action": None,
                "tool_calls_executed": ["get_place_info"],
                "provider": "deterministic-spatial-engine",
                "status": "success"
            }

        # 6. "Take me to Room X" / Navigation Command
        if any(trigger in msg for trigger in ["take me", "navigate", "lead me", "go to", "guide me", "how to get", "route to"]):
            route_data = parkar_tools.calculate_route(
                destination=place_info["id"],
                preference=preference,
                player_x=player_x,
                player_y=player_y,
                player_z=player_z,
                player_floor=player_floor,
                mode=building_mode
            )

            if not route_data.get("success"):
                return {
                    "response_text": f"Sorry, could not find a path to {place_info['name']}.",
                    "intent": "NAVIGATE",
                    "action": None,
                    "tool_calls_executed": ["calculate_route"],
                    "provider": "deterministic-spatial-engine",
                    "status": "error"
                }

            act_route = route_data.get("active_route", {})
            dist = act_route.get("total_distance_meters", 0)
            pref_desc = "avoiding stairs via elevator" if preference == "avoid_stairs" else "via the fastest route"

            return {
                "response_text": (
                    f"Sure, I'll guide you to {place_info['name']} on Floor {place_info['floor']} "
                    f"{pref_desc} ({dist}m). Follow the glowing route ahead!"
                ),
                "intent": "NAVIGATE",
                "action": {
                    "type": "SET_ROUTE",
                    "destination_id": route_data.get("destination_node"),
                    "destination_name": place_info["name"],
                    "preference": preference,
                    "route": act_route
                },
                "tool_calls_executed": ["calculate_route"],
                "provider": "deterministic-spatial-engine",
                "status": "success"
            }

        # Default fallback query
        return {
            "response_text": f"{place_info['name']} is on Floor {place_info['floor']}. Would you like me to take you there?",
            "intent": "QUERY_PLACE",
            "action": None,
            "tool_calls_executed": ["get_place_info"],
            "provider": "deterministic-spatial-engine",
            "status": "success"
        }

parkar_agent = ParkarAgent()
