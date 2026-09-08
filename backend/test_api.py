import sys
from main import (
    read_root,
    health_check,
    get_building_info,
    get_floors,
    get_pois,
    get_poi_by_id
)

def test_all():
    print("Testing read_root()...")
    root = read_root()
    assert root["project"] == "PARKAR", f"Unexpected project: {root}"
    assert root["status"] == "online"

    print("Testing health_check()...")
    health = health_check()
    assert health["status"] == "healthy"

    print("Testing get_building_info()...")
    info = get_building_info()
    assert info["levels"] == 3
    assert "Techfest Academic Complex" in info["name"]

    print("Testing get_floors()...")
    floors = get_floors()
    assert len(floors) == 3
    assert floors[0]["floor"] == 1
    assert floors[1]["floor"] == 2
    assert floors[2]["floor"] == 3

    print("Testing get_pois()...")
    all_pois = get_pois()
    assert len(all_pois) == 9, f"Expected 9 POIs, got {len(all_pois)}"

    f1_pois = get_pois(floor=1)
    assert len(f1_pois) == 3

    f2_pois = get_pois(floor=2)
    assert len(f2_pois) == 3

    f3_pois = get_pois(floor=3)
    assert len(f3_pois) == 3

    print("Testing get_poi_by_id()...")
    r101 = get_poi_by_id("room_101")
    assert r101["number"] == "101"
    assert "Robotics" in r101["name"]

    r303 = get_poi_by_id("room_303")
    assert r303["number"] == "303"

    print("\n[SUCCESS] All 6 backend API tests passed successfully!")

if __name__ == "__main__":
    test_all()
