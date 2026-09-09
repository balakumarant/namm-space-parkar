#!/usr/bin/env python3
"""
Phase 5A Automated Test Suite: Real-World 3D Reconstruction Pipeline Prototype.
Tests:
1. Video input detection and format validation (.mp4, .mov, .avi)
2. Frame extraction and Laplacian blur filtering
3. 3D reconstruction engine and diagnostic reporting
4. GLB model generation, metric scale calibration, and metadata export
5. Semantic annotation schema validation
6. Dual-mode BuildingLoader asset availability
7. Procedural building fallback regression safety
"""

import os
import sys
import json
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).parent.resolve()
sys.path.append(str(backend_dir))
project_root = backend_dir.parent

def run_tests():
    print("=" * 60)
    print("PHASE 5A: 3D RECONSTRUCTION PIPELINE TEST SUITE")
    print("=" * 60)

    passed = 0
    total = 0

    def assert_test(name: str, condition: bool, detail: str = ""):
        nonlocal passed, total
        total += 1
        if condition:
            print(f"[PASS] {name} {detail}")
            passed += 1
        else:
            print(f"[FAIL] {name} - FAILED! {detail}")

    # 1. Video Input Detection
    video_path = project_root / "reconstruction" / "input" / "indoor_building.mp4"
    assert_test("Video Input Detected", video_path.exists() and video_path.stat().st_size > 1000, f"({video_path.name}, {video_path.stat().st_size if video_path.exists() else 0} bytes)")

    # Supported format validation
    supported_exts = {".mp4", ".mov", ".avi"}
    assert_test("Supported Video Format Check", video_path.suffix.lower() in supported_exts, f"(Extension: {video_path.suffix})")

    # 2. Frame Extraction & Metadata Verification
    frames_dir = project_root / "reconstruction" / "frames"
    extr_meta_path = frames_dir / "extraction_metadata.json"
    frames = list(frames_dir.glob("*.jpg"))
    has_frames = len(frames) >= 5 and extr_meta_path.exists()
    
    meta_data = {}
    if extr_meta_path.exists():
        with open(extr_meta_path, "r", encoding="utf-8") as f:
            meta_data = json.load(f)

    assert_test("Frame Extraction Verification", has_frames, f"({len(frames)} frames extracted, avg sharpness: {meta_data.get('average_sharpness', 'N/A')})")
    assert_test("Blur Filtering Verification", meta_data.get("average_sharpness", 0) > 25.0, f"(Laplacian variance: {meta_data.get('average_sharpness', 0):.1f})")

    # 3. 3D Reconstruction Diagnostics & Report
    output_dir = project_root / "reconstruction" / "output"
    report_path = output_dir / "reconstruction_report.json"
    raw_mesh_path = output_dir / "building_raw.ply"

    report_data = {}
    if report_path.exists():
        with open(report_path, "r", encoding="utf-8") as f:
            report_data = json.load(f)

    reconstruction_ok = report_path.exists() and raw_mesh_path.exists() and report_data.get("reconstructed_points", 0) > 100
    assert_test("3D Reconstruction Execution", reconstruction_ok, f"({report_data.get('reconstructed_points', 0)} points reconstructed, bounds: {report_data.get('bounding_dimensions', {})})")
    assert_test("Toolchain Diagnostics Captured", "diagnostics" in report_data, f"(Diagnostics: {report_data.get('diagnostics', {})})")

    # 4. GLB Model & Metadata Export
    glb_path = output_dir / "building.glb"
    metadata_path = output_dir / "metadata.json"

    export_meta = {}
    if metadata_path.exists():
        with open(metadata_path, "r", encoding="utf-8") as f:
            export_meta = json.load(f)

    glb_valid = glb_path.exists() and glb_path.stat().st_size > 500 and metadata_path.exists()
    assert_test("GLB Digital Twin Model Export", glb_valid, f"({glb_path.name}: {glb_path.stat().st_size if glb_path.exists() else 0} bytes, format: {export_meta.get('format', 'unknown')})")
    assert_test("Metric Scale Calibration", export_meta.get("scale_calibrated", False) and export_meta.get("units") == "meters", f"(Scale: {export_meta.get('units')}, Dimensions: {export_meta.get('dimensions', {})})")

    # 5. Semantic Annotation Schema Validation
    semantic_path = project_root / "reconstruction" / "semantic" / "building_metadata.json"
    semantic_data = {}
    if semantic_path.exists():
        with open(semantic_path, "r", encoding="utf-8") as f:
            semantic_data = json.load(f)

    has_semantic = (
        semantic_path.exists()
        and "building" in semantic_data
        and len(semantic_data.get("rooms", [])) >= 2
        and len(semantic_data.get("vertical_connectors", [])) >= 2
    )
    assert_test("Human-Assisted Semantic Schema", has_semantic, f"({len(semantic_data.get('rooms', []))} rooms, {len(semantic_data.get('vertical_connectors', []))} connectors, {len(semantic_data.get('navigation_seed_waypoints', []))} seed waypoints)")

    # 6. Frontend Public Asset Availability
    fe_glb = project_root / "frontend" / "public" / "models" / "reconstructed_building.glb"
    fe_meta = project_root / "frontend" / "public" / "models" / "reconstructed_metadata.json"
    fe_ok = fe_glb.exists() and fe_meta.exists()
    assert_test("Frontend Public Model Assets", fe_ok, f"(GLB: {fe_glb.exists()}, Metadata: {fe_meta.exists()})")

    # 7. Procedural Fallback Regression Safety
    procedural_graph = backend_dir / "data" / "spatial_graph.json"
    procedural_pois = backend_dir / "data" / "pois.json"
    proc_ok = procedural_graph.exists() and procedural_pois.exists()
    assert_test("Procedural Fallback Preservation", proc_ok, f"(spatial_graph.json: {procedural_graph.exists()}, pois.json: {procedural_pois.exists()})")

    print("=" * 60)
    print(f"TEST SUMMARY: {passed}/{total} TESTS PASSED ({int(passed/total*100)}%)")
    print("=" * 60)

    if passed == total:
        print("[SUCCESS] ALL PHASE 5A RECONSTRUCTION PIPELINE TESTS PASSED!")
        return 0
    else:
        print("[FAILURE] Some Phase 5A tests failed.")
        return 1

if __name__ == "__main__":
    sys.exit(run_tests())
