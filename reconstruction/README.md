# PARKAR 3D Reconstruction Pipeline (Phase 5A Prototype)

Welcome to the **PARKAR Real-World 3D Reconstruction Pipeline Prototype**. This system processes indoor walkthrough video recordings to extract sharp keyframes, track camera trajectory using Structure-from-Motion (SfM), generate sparse and dense 3D point clouds, reconstruct architectural surface geometry, and export a game-ready binary GLB digital twin.

> [!NOTE]
> **Phase 5A.2 Real Indoor Walkthrough Scope:**  
> The pipeline reconstructs real architectural indoor geometry from the approved video recording:  
> `reconstruction/input/Screen Recording 2026-09-09 134732.mp4` (Segment 1: frames 0–560, $t = 0.0\text{s} - 18.67\text{s}$).  
> The reconstruction covers the entrance foyer, staircase structure, dining/living complex, and structural boundary walls with 25,531 sparse SfM points, 56,527 dense stereo points, and 7,910 triangles (4,083 vertices). It serves as an independent prototype before Phase 5B game engine integration.

---

## 1. Required Software & System Specifications

| Component | Specification / Requirement |
|---|---|
| **Operating System** | Windows 10/11 (AMD64) or Linux |
| **Python Version** | Python 3.10 – 3.13 (`backend/venv`) |
| **OpenCV Engine** | `opencv-python-headless` >= 4.8.0 (v5.0.0.93 installed) |
| **3D Geometry Engine** | `trimesh` >= 4.0.0 (v5.1.0 installed) |
| **Numerical Processing** | `numpy` >= 1.24.0 (v2.5.3 installed) |
| **GPU / Acceleration** | CPU-optimized fallback enabled. NVIDIA GPU with CUDA optional for hardware acceleration. |
| **Photogrammetry Toolchain** | COLMAP CLI optional; self-contained OpenCV SfM + StereoSGBM engine utilized when COLMAP is absent. |

---

## 2. Directory Structure

```
reconstruction/
├── input/
│   ├── Screen Recording 2026-09-09 134732.mp4  # Approved 24.5s recording (1906x1024, 30fps)
│   ├── indoor_walkthrough.mp4                 # Baseline 5s indoor test video
│   └── .gitkeep
├── frames/                                     # Extracted sharp keyframes (51 frames, avg sharpness 65.94)
│   ├── frame_0001.jpg ... frame_0051.jpg
│   └── extraction_metadata.json                # Sharpness metrics, frame counts, and crop range
├── output/
│   ├── pointcloud/
│   │   ├── sparse_pointcloud.ply               # SIFT triangulated feature cloud (25,531 points)
│   │   └── dense_pointcloud.ply                # StereoSGBM disparity point cloud (56,527 points)
│   ├── mesh/
│   │   └── building_mesh.obj                   # Architectural surface mesh (7,910 faces, 4,083 vertices)
│   ├── building.glb                            # Game-ready binary glTF 2.0 digital twin (161.2 KB)
│   ├── building_raw.ply                        # Raw surface mesh
│   ├── metadata.json                           # Metric dimensions (X=23.40m, Y=11.93m, Z=52.23m)
│   └── reconstruction_report.json              # Complete diagnostics, Quality Gate: Level 3
├── scripts/
│   ├── extract_frames.py                       # Frame sampling and Laplacian blur filter
│   ├── reconstruct.py                          # SfM, multi-view pose recovery, dense stereo & mesh
│   ├── export_glb.py                           # Metric scale calibration and GLB packaging
│   ├── inspect_video.py                        # Optical flow & video quality auditor
│   └── view_model.py                           # Geometric inspector and preview server
├── config/
│   └── pipeline_config.json                    # Configurable thresholds and pipeline hyperparameters
├── viewer.html                                 # Standalone Three.js 3D web previewer
└── README.md                                   # Documentation
```

---

## 3. How to Repeat the Experiment (Step-by-Step Commands)

All commands are run from the project root directory using the virtual environment Python executable:

### Step 1: Video Pre-Flight Audit
Inspect video duration, resolution, FPS, optical flow, and blur metrics:
```powershell
backend\venv\Scripts\python.exe reconstruction/scripts/inspect_video.py "reconstruction/input/Screen Recording 2026-09-09 134732.mp4"
```

### Step 2: Frame Extraction
Extract sharp keyframes (Segment 1: frames 0–560) with Laplacian blur rejection:
```powershell
backend\venv\Scripts\python.exe reconstruction/scripts/extract_frames.py --video "reconstruction/input/Screen Recording 2026-09-09 134732.mp4" --fps 2.75 --max-frames 55 --end-frame 560
```
*Outputs 51 keyframes and `reconstruction/frames/extraction_metadata.json`.*

### Step 3: 3D Reconstruction (SfM + Dense Stereo + Mesh)
Execute camera trajectory estimation, sparse triangulation, dense stereo depth matching, and architectural surface meshing:
```powershell
backend\venv\Scripts\python.exe reconstruction/scripts/reconstruct.py --frames-dir reconstruction/frames --output-dir reconstruction/output
```
*Outputs:*
- `reconstruction/output/pointcloud/sparse_pointcloud.ply` (25,531 points)
- `reconstruction/output/pointcloud/dense_pointcloud.ply` (56,527 points)
- `reconstruction/output/mesh/building_mesh.obj` (7,910 faces, 4,083 vertices)
- `reconstruction/output/building_raw.ply`
- `reconstruction/output/reconstruction_report.json`

### Step 4: GLB Conversion & Metric Calibration
Convert the raw mesh to a game-ready binary `building.glb` with metric spatial bounds:
```powershell
backend\venv\Scripts\python.exe reconstruction/scripts/export_glb.py --input-mesh reconstruction/output/mesh/building_mesh.obj --output-glb reconstruction/output/building.glb --output-metadata reconstruction/output/metadata.json
```

### Step 5: Model Inspection & Preview
Inspect the resulting dimensions:
```powershell
backend\venv\Scripts\python.exe reconstruction/scripts/view_model.py --inspect
```
Launch the standalone Three.js viewer:
```powershell
backend\venv\Scripts\python.exe reconstruction/scripts/view_model.py --serve --port 8085
```
Open your browser at `http://127.0.0.1:8085/viewer.html`.

---

## 4. Automated Regression Tests

Verify the reconstruction pipeline automatically:
```powershell
backend\venv\Scripts\python.exe backend/test_reconstruction.py
```

---

## 5. Known Limitations of the 5-Second Test Video

1. **Spatial Coverage:** The 5-second video only captures approximately 15–25 meters of a single corridor heading. Multi-room layouts, stairwells, and multi-floor elevators are absent.
2. **Metric Scale Ground Truth:** Scale is derived from estimated camera walking velocity (~0.25m step per keyframe). Physical ground truth markers (e.g. ArUco tags or laser measurements) will calibrate real-world metric dimensions in later phases.
3. **Texture Detail:** The test footage features clean architectural corridor geometry; dense photorealistic photogrammetry of complex clutter requires longer, high-texture captures.
4. **Game Integration:** The reconstructed model is maintained strictly as an independent prototype and is **not** injected into the live game engine during Phase 5A. The procedural building remains active.
