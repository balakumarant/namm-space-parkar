import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from ai.parkar_agent import parkar_agent

def test_ai_test_cases():
    print("==================================================")
    print("RUNNING PARKAR AI 10 TEST CASES")
    print("==================================================")

    # Test Case 1: "Where is Room 302?"
    print("\nTest Case 1: 'Where is Room 302?'")
    res1 = parkar_agent.process_message("Where is Room 302?", player_x=0.0, player_y=0.5, player_z=24.0, player_floor=1)
    print(f"Response: {res1['response_text']}")
    assert "Floor 3" in res1["response_text"], "Expected Room 302 to be identified on Floor 3"
    assert res1["intent"] == "QUERY_PLACE"
    print("-> PASSED")

    # Test Case 2: "Take me to Room 302."
    print("\nTest Case 2: 'Take me to Room 302.'")
    res2 = parkar_agent.process_message("Take me to Room 302.", player_x=0.0, player_y=0.5, player_z=24.0, player_floor=1)
    print(f"Response: {res2['response_text']}")
    assert res2["intent"] == "NAVIGATE"
    assert res2["action"] is not None
    assert res2["action"]["type"] == "SET_ROUTE"
    assert "302" in res2["action"]["destination_name"]
    print("-> PASSED")

    # Test Case 3: "Take me to Room 302 using the elevator."
    print("\nTest Case 3: 'Take me to Room 302 using the elevator.'")
    res3 = parkar_agent.process_message("Take me to Room 302 using the elevator.", player_x=0.0, player_y=0.5, player_z=24.0, player_floor=1)
    print(f"Response: {res3['response_text']}")
    assert res3["intent"] == "NAVIGATE"
    assert res3["action"]["preference"] == "avoid_stairs"
    assert res3["action"]["route"]["uses_elevator"] is True
    assert res3["action"]["route"]["uses_stairs"] is False
    print("-> PASSED")

    # Test Case 4: "Avoid stairs and take me to Room 301."
    print("\nTest Case 4: 'Avoid stairs and take me to Room 301.'")
    res4 = parkar_agent.process_message("Avoid stairs and take me to Room 301.", player_x=0.0, player_y=0.5, player_z=24.0, player_floor=1)
    print(f"Response: {res4['response_text']}")
    assert res4["intent"] == "NAVIGATE"
    assert res4["action"]["preference"] == "avoid_stairs"
    assert res4["action"]["route"]["uses_stairs"] is False
    print("-> PASSED")

    # Test Case 5: "What's the fastest route to Room 303?"
    print("\nTest Case 5: 'What's the fastest route to Room 303?'")
    res5 = parkar_agent.process_message("What's the fastest route to Room 303?", player_x=0.0, player_y=0.5, player_z=24.0, player_floor=1)
    print(f"Response: {res5['response_text']}")
    assert res5["intent"] == "NAVIGATE"
    assert res5["action"]["preference"] == "fastest"
    assert res5["action"]["route"] is not None
    print("-> PASSED")

    # Test Case 6: "How far is Room 302?"
    print("\nTest Case 6: 'How far is Room 302?'")
    res6 = parkar_agent.process_message("How far is Room 302?", player_x=0.0, player_y=0.5, player_z=24.0, player_floor=1)
    print(f"Response: {res6['response_text']}")
    assert res6["intent"] == "QUERY_DISTANCE"
    assert "metres away" in res6["response_text"] or "m away" in res6["response_text"]
    print("-> PASSED")

    # Test Case 7: "Where am I?"
    print("\nTest Case 7: 'Where am I?'")
    res7 = parkar_agent.process_message("Where am I?", player_x=0.0, player_y=0.5, player_z=24.0, player_floor=1)
    print(f"Response: {res7['response_text']}")
    assert res7["intent"] == "QUERY_LOCATION"
    assert "Floor 1" in res7["response_text"]
    print("-> PASSED")

    # Test Case 8: "Take me to the nearest lab."
    print("\nTest Case 8: 'Take me to the nearest lab.'")
    res8 = parkar_agent.process_message("Take me to the nearest lab.", player_x=0.0, player_y=0.5, player_z=24.0, player_floor=1)
    print(f"Response: {res8['response_text']}")
    assert res8["intent"] == "NAVIGATE"
    assert res8["action"] is not None
    print("-> PASSED")

    # Test Case 9: Unknown destination: "Where is Room 999?"
    print("\nTest Case 9: Unknown destination: 'Where is Room 999?'")
    res9 = parkar_agent.process_message("Where is Room 999?", player_x=0.0, player_y=0.5, player_z=24.0, player_floor=1)
    print(f"Response: {res9['response_text']}")
    assert "couldn't find" in res9["response_text"].lower()
    assert res9["status"] == "not_found"
    print("-> PASSED")

    # Test Case 10: AI unavailable fallback verification
    print("\nTest Case 10: Deterministic Engine Fallback")
    # Verify processing works seamlessly without Gemini API key
    fallback_agent = parkar_agent
    fallback_agent.api_key = "" # Simulate offline / unconfigured API key
    res10 = fallback_agent.process_message("Take me to Room 202", player_x=0.0, player_y=0.5, player_z=24.0, player_floor=1)
    assert res10["intent"] == "NAVIGATE"
    assert res10["action"] is not None
    assert "202" in res10["action"]["destination_name"]
    print(f"Fallback response: {res10['response_text']}")
    print("-> PASSED")

    print("\n==================================================")
    print("[SUCCESS] ALL 10 PARKAR AI TEST CASES PASSED!")
    print("==================================================")

if __name__ == "__main__":
    test_ai_test_cases()
