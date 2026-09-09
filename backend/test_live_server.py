import urllib.request
import urllib.error
import json
import sys

BACKEND_BASE = "http://127.0.0.1:8000"
FRONTEND_BASE = "http://localhost:5173"

def http_get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "ParkarLiveTester/1.0"})
    with urllib.request.urlopen(req, timeout=5) as response:
        status = response.status
        body = response.read().decode("utf-8")
        return status, body

def http_post(url, data):
    payload = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "ParkarLiveTester/1.0"
        }
    )
    with urllib.request.urlopen(req, timeout=5) as response:
        status = response.status
        body = response.read().decode("utf-8")
        return status, body

def run_tests():
    print("=" * 60)
    print("PARKAR LIVE END-TO-END SERVER TEST SUITE")
    print("=" * 60)
    
    passed = 0
    total = 0

    def assert_test(name, condition, detail=""):
        nonlocal passed, total
        total += 1
        if condition:
            print(f"[PASS] {name} {detail}")
            passed += 1
        else:
            print(f"[FAIL] {name} - FAILED! {detail}")

    # 1. Live Frontend Health Check
    try:
        status, body = http_get(f"{FRONTEND_BASE}/")
        assert_test("Frontend Vite Server Live", status == 200 and "PARKAR" in body, f"(Status: {status})")
    except Exception as e:
        assert_test("Frontend Vite Server Live", False, str(e))

    # 2. Live Backend Health Check
    try:
        status, body = http_get(f"{BACKEND_BASE}/api/health")
        data = json.loads(body)
        assert_test("Backend Health Check", status == 200 and data.get("status") == "healthy", f"(Status: {status})")
    except Exception as e:
        assert_test("Backend Health Check", False, str(e))

    # 3. Live AI Status Check
    try:
        status, body = http_get(f"{BACKEND_BASE}/api/parkar/status")
        data = json.loads(body)
        assert_test("AI Status Endpoint", status == 200 and data.get("status") == "online", f"(Agent: {data.get('agent')}, Mode: {data.get('mode')})")
    except Exception as e:
        assert_test("AI Status Endpoint", False, str(e))

    # 4. Live Spatial Graph Endpoint
    try:
        status, body = http_get(f"{BACKEND_BASE}/api/navigation/graph")
        data = json.loads(body)
        nodes = len(data.get("nodes", []))
        edges = len(data.get("edges", []))
        assert_test("Spatial Graph API", status == 200 and nodes >= 50, f"({nodes} nodes, {edges} edges)")
    except Exception as e:
        assert_test("Spatial Graph API", False, str(e))

    # 5. Live Pathfinding Route Calculation
    try:
        status, body = http_post(f"{BACKEND_BASE}/api/navigation/route", {
            "start_x": 0.0,
            "start_y": 0.5,
            "start_z": 23.5,
            "destination_id": "n_f3_r302_inside",
            "start_floor": 1
        })
        data = json.loads(body)
        routes = data.get("routes", [])
        assert_test("Multi-Route Calculation API", status == 200 and len(routes) >= 2, f"({len(routes)} route candidates calculated)")
    except Exception as e:
        assert_test("Multi-Route Calculation API", False, str(e))

    # 6. Live AI Chat: Location Query ("Where is Room 302?")
    try:
        status, body = http_post(f"{BACKEND_BASE}/api/parkar/chat", {
            "message": "Where is Room 302?",
            "player_state": {"x": 0.0, "y": 0.5, "z": 23.5, "floor": 1}
        })
        data = json.loads(body)
        reply = data.get("response_text", "")
        assert_test("AI Location Query: Room 302", "Floor 3" in reply and "Room 302" in reply, f"Reply: '{reply}'")
    except Exception as e:
        assert_test("AI Location Query: Room 302", False, str(e))

    # 7. Live AI Chat: Navigation Action ("Take me to Room 302")
    try:
        status, body = http_post(f"{BACKEND_BASE}/api/parkar/chat", {
            "message": "Take me to Room 302",
            "player_state": {"x": 0.0, "y": 0.5, "z": 23.5, "floor": 1}
        })
        data = json.loads(body)
        action = data.get("action", {}) or {}
        route = action.get("route", {}) or {}
        dist = route.get("total_distance_meters", 0)
        assert_test("AI Navigation Action: Room 302", action.get("type") == "SET_ROUTE" and dist > 0, f"(Action: {action.get('type')}, Dist: {dist}m)")
    except Exception as e:
        assert_test("AI Navigation Action: Room 302", False, str(e))

    # 8. Live AI Chat: Constraint Handling ("Avoid stairs and take me to Room 301")
    try:
        status, body = http_post(f"{BACKEND_BASE}/api/parkar/chat", {
            "message": "Avoid stairs and take me to Room 301",
            "player_state": {"x": 0.0, "y": 0.5, "z": 23.5, "floor": 1}
        })
        data = json.loads(body)
        action = data.get("action", {}) or {}
        route = action.get("route", {}) or {}
        uses_stairs = route.get("uses_stairs", True)
        dist = route.get("total_distance_meters", 0)
        assert_test("AI Barrier-Free / Avoid Stairs", action.get("type") == "SET_ROUTE" and not uses_stairs, f"(Uses Stairs: {uses_stairs}, Dist: {dist}m)")
    except Exception as e:
        assert_test("AI Barrier-Free / Avoid Stairs", False, str(e))

    # 9. Live AI Chat: Distance & ETA Query ("How far is Room 302?")
    try:
        status, body = http_post(f"{BACKEND_BASE}/api/parkar/chat", {
            "message": "How far is Room 302?",
            "player_state": {"x": 0.0, "y": 0.5, "z": 23.5, "floor": 1}
        })
        data = json.loads(body)
        reply = data.get("response_text", "")
        assert_test("AI Distance/ETA Query", "metres" in reply.lower() and "seconds" in reply.lower(), f"Reply: '{reply}'")
    except Exception as e:
        assert_test("AI Distance/ETA Query", False, str(e))

    # 10. Live AI Chat: Self-Location Resolution ("Where am I?")
    try:
        status, body = http_post(f"{BACKEND_BASE}/api/parkar/chat", {
            "message": "Where am I?",
            "player_state": {"x": 0.0, "y": 0.5, "z": 23.5, "floor": 1}
        })
        data = json.loads(body)
        reply = data.get("response_text", "")
        assert_test("AI Current Location Resolution", "Floor 1" in reply and "Entrance" in reply, f"Reply: '{reply}'")
    except Exception as e:
        assert_test("AI Current Location Resolution", False, str(e))

    # 11. Live AI Chat: Nearest Facility ("Take me to the nearest lab")
    try:
        status, body = http_post(f"{BACKEND_BASE}/api/parkar/chat", {
            "message": "Take me to the nearest lab",
            "player_state": {"x": 0.0, "y": 4.5, "z": 5.0, "floor": 2}
        })
        data = json.loads(body)
        action = data.get("action", {}) or {}
        reply = data.get("response_text", "")
        assert_test("AI Nearest Lab Resolution", action.get("type") == "SET_ROUTE" and "nearest lab" in reply.lower(), f"Reply: '{reply}'")
    except Exception as e:
        assert_test("AI Nearest Lab Resolution", False, str(e))

    # 12. Live AI Chat: Anti-Hallucination ("Where is Room 999?")
    try:
        status, body = http_post(f"{BACKEND_BASE}/api/parkar/chat", {
            "message": "Where is Room 999?",
            "player_state": {"x": 0.0, "y": 0.5, "z": 23.5, "floor": 1}
        })
        data = json.loads(body)
        reply = data.get("response_text", "")
        assert_test("AI Anti-Hallucination on Unknown Room", "couldn't find" in reply.lower(), f"Reply: '{reply}'")
    except Exception as e:
        assert_test("AI Anti-Hallucination on Unknown Room", False, str(e))

    print("=" * 60)
    print(f"LIVE TEST SUMMARY: {passed}/{total} TESTS PASSED ({int(passed/total*100)}%)")
    print("=" * 60)

    if passed == total:
        print("[SUCCESS] ALL LIVE SERVER TESTS COMPLETED SUCCESSFULLY!")
        return 0
    else:
        print("[FAILURE] Some live tests failed.")
        return 1

if __name__ == "__main__":
    sys.exit(run_tests())
