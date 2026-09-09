# PARKAR — Real-World Indoor 3D Reconstruction Pipeline (Phase 5A)

**Project:** PARKAR — AI-Powered Gamified 3D Indoor Spatial Guide  
**Competition:** Namma Space | Techfest, IIT Bombay  
**Document Version:** 1.0.0 (Phase 5A Prototype Specification)  

---

## 1. Executive Summary & Architectural Vision

The core mission of PARKAR is to transform an indoor building into a playable, gamified 3D digital twin navigated by an autonomous AI spatial companion. Phases 1 through 4 established the 3-floor foundation, topological spatial graph, multi-criteria A* pathfinder, 3D route visualizer, HUD radar minimap, and PARKAR conversational assistant.

Phase 5 introduces the **Real-World Indoor 3D Reconstruction Pipeline**, transitioning from artificial procedural geometry to authentic physical structures captured via standard smartphone video:

```
+---------------------------------------------------------------------------------------------------+
| 1. SMARTPHONE INDOOR VIDEO CAPTURE (.mp4 / .mov / .avi)                                           |
|    - 1080p60 / 4K capture, steady forward walking, 75%+ frame overlap, loop-closure traversal     |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| 2. VIDEO KEYFRAME EXTRACTION & BLUR FILTERING                                                     |
|    - extract_frames.py: Configurable FPS, Laplacian variance blur threshold, aspect resizing      |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| 3. STRUCTURE ESTIMATION & SURFACE RECONSTRUCTION                                                 |
|    - reconstruct.py: Feature matching, camera trajectory tracking, point cloud generation,       |
|      architectural envelope fitting, and external toolchain diagnostics (COLMAP, CUDA, Open3D)    |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| 4. METRIC CALIBRATION, MESH DECIMATION & GLB EXPORT                                               |
|    - export_glb.py: Quadratic decimation (<45k faces for 60fps WebGL), metric anchoring,          |
|      standardized binary GLB export (building.glb) + spatial metadata (metadata.json)             |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| 5. HUMAN-ASSISTED SEMANTIC ANNOTATION LAYER                                                       |
|    - building_metadata.json: Verified floor elevations, room numbers, doors, elevators, stairs    |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| 6. INTEGRATION WITH THREE.JS, RAPIER PHYSICS & PARKAR AI                                          |
|    - BuildingLoader.ts: Dual-Mode (loadProceduralBuilding vs loadReconstructedBuilding)           |
|    - Rapier Colliders: Simplified static collision boxes for floors, walls, and stair ramps       |
|    - Spatial Graph Adapter: Grounded waypoints connected to existing A* pathfinder & PARKAR AI   |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Comprehensive Comparison of Reconstruction Technologies

A critical constraint of PARKAR is that the reconstructed output must be **physically navigable**. A visually impressive volumetric or point cloud representation that cannot be collided with or traversed is insufficient.

| Reconstruction Technology | Visual Quality | Mesh / Surface Generation | Metric Scale | Processing & Compute Requirements | Windows / Python Feasibility | Navigability & Collision Suitability |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **A. COLMAP (SfM + MVS)** | High | Poisson / Delaunay polygonal mesh (`.ply`, `.obj`) | Arbitrary / relative without GCPs | Heavy (Dense MVS requires dedicated NVIDIA CUDA GPU) | Pre-compiled Windows CLI available; PyCOLMAP compilation on Windows can be challenging | **High**: Outputs polygonal mesh directly convertible to GLB. |
| **B. NeRF (Nerfstudio / instant-ngp)** | Very High (views) | Poor (Volumetric radiance density; isosurface extraction is noisy & non-watertight) | Arbitrary | Very Heavy (RTX 3070+, high VRAM, multi-hour training) | Complex WSL / PyTorch / CUDA build toolchains | **Low**: Extremely difficult to generate clean collision geometry for physics. |
| **C. 3D Gaussian Splatting (3DGS)** | Photorealistic (real-time) | None (Represented as millions of 3D ellipsoidal Gaussian splats) | Arbitrary | Heavy (CUDA rasterizers, high GPU memory) | Python bindings require MSVC + CUDA toolchains | **Very Low directly**: Cannot perform Rapier raycasts or character movement without an auxiliary mesh. |
| **D. SLAM / RGB-D (RTAB-Map / Open3D)** | Moderate | Real-time TSDF voxel grid mesh | Metric (when depth sensor / LiDAR available) | Moderate (runs on standard GPU or multi-core CPU) | Excellent Python support (`open3d`, `pyrealsense2`) | **High**: Produces clean oriented floor and wall planes. |
| **E. Smartphone Depth / LiDAR** | Moderate to High | Direct textured mesh export (Scaniverse, Polycam, RealityCapture) | True Metric (hardware calibrated) | Zero local compute (processed on device or exported directly) | Outputs standard `.glb` directly compatible with Three.js | **Very High**: Provides millimeter-accurate scale and clean boundary geometry. |
| **F. Cloud / API Reconstruction Services** | High | Automated textured mesh | Metric (if reference scale supplied) | Zero local compute (offloaded to cloud) | Simple REST API integration | **High**: Rapid turnaround, but introduces API costs, internet dependency, and privacy issues. |
| **G. Monocular Structure & Depth Photogrammetry** | High | TSDF fusion & Poisson surface reconstruction | Calibrated via known physical reference (e.g. door height) | Moderate (runs cross-platform on standard CPU/GPU) | Excellent (100% native Python via OpenCV, NumPy, and Trimesh) | **Very High**: Produces lightweight, game-ready GLB meshes with verified bounds. |

---

## 3. Recommended Pipeline Selection

### Primary Pipeline: Monocular Feature Photogrammetry & Surface Meshing (Python Native)
* **Core Libraries:** OpenCV (`cv2`), NumPy, Trimesh, SciPy.
* **Why Selected:**
  1. **Cross-Platform Zero-Friction Setup:** Runs natively on any Windows, Linux, or macOS environment without requiring complex MSVC compilation, proprietary CUDA drivers, or external system binaries.
  2. **Navigable Mesh Output:** Generates clean, manifold polygonal meshes with calibrated Y-up coordinates, exportable directly to binary `.glb`.
  3. **Performance Optimization:** Features automated quadric edge-collapse decimation, maintaining polygon counts below 45,000 faces to ensure a constant 60 FPS in Three.js on standard laptops.
  4. **Diagnostic Transparency:** Automatically tests for external toolchains (COLMAP, CUDA, Open3D) and reports status without crashing.

### Fallback Pipeline: Pre-compiled COLMAP SfM + Poisson Surface Reconstruction
* **Workflow:** Automated CLI wrapper calling `colmap feature_extractor`, `colmap exhaustive_matcher`, `colmap mapper`, and `colmap poisson_mesher`.
* **Deployment Context:** Recommended when a workstation with a dedicated NVIDIA GPU and pre-installed COLMAP binary is available for high-density multi-view stereo reconstruction.

---

## 4. Smartphone Indoor Video Capture Guidelines

To achieve high reconstruction quality and prevent tracking failure during structure-from-motion, smartphone recordings should adhere to the following capture protocol:

1. **Resolution & Framerate:** 1080p at 60 FPS (recommended) or 4K at 30 FPS. Disable dynamic stabilization if it causes rolling shutter warping.
2. **Walking Speed:** 0.3 to 0.5 meters per second (slow, deliberate heel-to-toe walking). Rapid movement introduces motion blur that degrades feature detection.
3. **Motion Trajectory:** Walk forward along corridors with smooth serpentine translations rather than panning the camera in place. Rotate your whole body rather than flicking the phone.
4. **Visual Overlap:** Maintain 70% to 80% visual overlap between successive frames.
5. **Lighting:** Record under bright, uniform indoor lighting. Avoid direct glare into fluorescent fixtures or harsh backlit windows.
6. **Feature Coverage:** Focus the camera slightly downwards (approx. 15 degrees below eye level) so that floor textures, baseboards, and doorways are simultaneously visible.
7. **Vertical Transitions:** For staircases, ascend slowly with the camera oriented forward up the flight. For elevators, capture the elevator doors, lobby call button, and interior cab as distinct scenes.
8. **Loop Closure:** Always conclude the capture by returning to the initial starting landmark to enable global bundle adjustment closure.

---

## 5. Input & Output Data Specifications

### Input Directory Layout
```
reconstruction/
  ├── config/
  │   └── pipeline_config.json          # Master pipeline parameters
  ├── input/
  │   ├── indoor_building.mp4           # Primary smartphone video recording
  │   └── capture_metadata.json         # Optional camera intrinsics and capture notes
  ├── frames/                           # Extracted keyframes (frame_0001.jpg, ...)
  │   └── extraction_metadata.json      # Extraction statistics & blur metrics
  ├── output/
  │   ├── building_raw.ply              # Unfiltered 3D surface mesh
  │   ├── building.glb                  # Final optimized, scaled digital twin
  │   ├── metadata.json                 # Metric bounds, floor heights, and rooms
  │   └── reconstruction_report.json    # Pipeline execution report
  └── semantic/
      └── building_metadata.json        # Human-assisted verified annotations
```

### Reconstructed Metadata Specification (`metadata.json`)
```json
{
  "building_name": "Reconstructed Digital Twin - Main Wing",
  "format": "GLB / glTF 2.0 Binary",
  "units": "meters",
  "scale_calibrated": true,
  "scale_factor": 1.0,
  "dimensions": {
    "width_meters": 18.0,
    "height_meters": 4.5,
    "length_meters": 40.0
  },
  "bounds": {
    "min": [-9.0, 0.0, -20.0],
    "max": [9.0, 4.5, 20.0]
  },
  "mesh_stats": {
    "vertices": 12450,
    "faces": 24800,
    "file_size_bytes": 1048576
  },
  "floors": [
    {
      "floor": 1,
      "elevation_meters": 0.0,
      "height_meters": 4.5,
      "walkable_surface": {
        "min_x": -8.5,
        "max_x": 8.5,
        "min_z": -19.0,
        "max_z": 19.0
      }
    }
  ]
}
```

---

## 6. Navigable Geometry & Physics Collision Strategy

A raw photogrammetry mesh typically contains non-manifold edges, holes, and millions of micro-triangles that would cause physics simulations to stutter or collapse. PARKAR implements a **two-layer geometry strategy**:

1. **Visual Layer (Three.js WebGL):**
   * Loaded via `GLTFLoader`.
   * High-detail textured mesh with PBR materials, tone mapping, and directional shadow casting.
   * Rendered purely visually without direct physics attachment.
2. **Collision Layer (Rapier 3D WASM):**
   * Decoupled from visual polygon count.
   * Generated from `metadata.json` boundaries as simplified, solid physics primitives:
     * **Walkable Floors:** Static cuboid slabs (`createStaticBox`) positioned at floor elevations with realistic surface friction (0.5).
     * **Boundary Walls & Partitions:** Vertical static cuboid colliders preventing player avatar penetration.
     * **Stair Ramps:** Angled collision planes (`createStaticIncline`) enabling smooth vertical walking without avatar catching.
     * **Kinematic Character Controller:** Features automatic step climb up to 0.35m and downward ground-snapping up to 0.5m.

---

## 7. Human-Assisted Semantic Annotation Strategy

Raw video algorithms cannot autonomously deduce room numbers, departmental functions, or accessibility status without risk of hallucination. PARKAR adopts a **human-assisted semantic annotation layer**:

```
Raw Reconstructed Building (GLB)
              ↓
3D Coordinate Inspection
              ↓
Human-Assisted Annotation (reconstruction/semantic/building_metadata.json)
  * Room 101 - Robotics Lab: Center (-5.5, 0.0, -8.0), Door (-2.0, 0.0, -8.0)
  * Elevator A: Center (0.0, 0.0, -16.0), Accessible: true
              ↓
Spatial Graph Generation (reconstructed_spatial_graph.json)
              ↓
Deterministic A* Pathfinding Engine
              ↓
PARKAR Conversational Assistant
```

This guarantees 100% ground truth integrity for all navigation queries and zero hallucinated locations.

---

## 8. BuildingLoader Dual-Mode Architecture

The frontend `BuildingLoader` was upgraded to support seamless dual-mode execution without modifying existing systems:

```typescript
export interface IBuildingLoader {
  build(scene: THREE.Scene, physics: PhysicsWorld): Promise<void>;
  loadProceduralBuilding(): Promise<void>;
  loadReconstructedBuilding(glbUrl?: string, metadataUrl?: string): Promise<void>;
  setMode(mode: 'procedural' | 'reconstructed'): void;
  getMode(): 'procedural' | 'reconstructed';
  getInteractiveZones(): InteractiveZone[];
  getFloors(): FloorDefinition[];
  getFloorByHeight(y: number): number;
  dispose(): void;
}
```

* **Default Mode:** `buildingMode = 'procedural'` ensures all Phase 1–4 functionality remains active by default.
* **Reconstructed Mode:** `buildingMode = 'reconstructed'` dynamically fetches `/models/reconstructed_building.glb` and `/models/reconstructed_metadata.json`. If loading encounters any network or parsing error, it automatically falls back to the procedural building.

---

## 9. Security, Privacy & Local File Handling

* **Zero Cloud Video Leakage:** All video processing, frame extraction, and reconstruction scripts run locally on the user's workstation. No private indoor video footage is ever uploaded to external cloud endpoints.
* **Strict Git Exclusions:** `.gitignore` excludes `*.mp4`, `*.mov`, `*.avi`, `reconstruction/frames/`, and intermediate `*.ply`/`*.obj` point clouds, protecting repository cleanliness and user privacy.

---

## 10. Verification Commands & How to Run the Prototype

**1. Generate Sample Indoor Walkthrough Video:**
```powershell
.\backend\venv\Scripts\python.exe reconstruction\scripts\generate_sample_video.py
```

**2. Extract Clean Keyframes with Blur Filtering:**
```powershell
.\backend\venv\Scripts\python.exe -u reconstruction\scripts\extract_frames.py --video reconstruction\input\indoor_building.mp4 --fps 2.0 --max-frames 20
```

**3. Run 3D Reconstruction Engine:**
```powershell
.\backend\venv\Scripts\python.exe -u reconstruction\scripts\reconstruct.py --frames-dir reconstruction\frames --output-dir reconstruction\output
```

**4. Optimize, Scale & Export GLB to Frontend:**
```powershell
.\backend\venv\Scripts\python.exe -u reconstruction\scripts\export_glb.py
```

**5. Run Automated Phase 5A Pipeline Verification Suite:**
```powershell
.\backend\venv\Scripts\python.exe -u backend\test_reconstruction.py
```

---

## 11. Known Limitations & Phase 5B Roadmap

### Current Phase 5A Limitations:
1. Monocular depth scale requires a physical calibration reference (e.g. standard door frame height).
2. Highly specular surfaces (mirrors, glass partitions) require manual boundary annotation to avoid incomplete point clusters.
3. Multi-floor vertical transitions currently depend on semantic stair/elevator waypoint tagging.

### Recommended Phase 5B Focus:
1. Integration of live WebRTC smartphone camera streaming directly to the frame extractor.
2. In-browser 3D semantic annotation GUI allowing users to click rooms in the digital twin and assign room numbers interactively.
3. Automatic 2D floorplan slice extraction from the reconstructed 3D point cloud.
