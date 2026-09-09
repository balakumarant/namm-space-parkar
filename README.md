# PARKAR — AI-Powered Gamified 3D Indoor Spatial Guide
**Competition:** Namma Space | Techfest, IIT Bombay

PARKAR is a web-based gamified 3D digital twin of a multi-floor indoor building. Visitors explore as a playable character using intuitive game controls, guided by an AI spatial assistant that understands natural-language requests, executes multi-criteria graph pathfinding, renders 3D navigation paths, and provides real-time turn-by-turn spoken guidance.

---

## 🏗️ Architecture Overview

```
                    🎮 PARKAR SYSTEM
                           |
              ┌────────────┼────────────┐
              ↓            ↓            ↓
           💬 Text       🎤 Voice     🧠 AI (Gemini 2.5 Flash)
              |            |            |
              └────────────┼────────────┘
                           ↓
                    Structured Intent
                           ↓
                     🗺️ Spatial Tools
              (search_places, calculate_route,
               get_current_location, get_floor_info)
                           ↓
                    FastAPI Engine
                           ↓
                     3D A* Solver
                     (NetworkX)
                           ↓
                   Route + Instructions
                           ↓
                    3D Three.js World
            (Glowing Ribbon + Minimap + HUD)
                           ↓
                        👤 Player
```

* **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons.
* **3D Engine:** Three.js with PBR materials, dynamic shadows, indoor depth fog, and 3D glowing spline visualizer.
* **Physics:** `@dimforge/rapier3d-compat` WASM character controller with stair auto-stepping and wall sliding.
* **Navigation Engine:** Multi-floor topological spatial graph (52 nodes, 53 edges) with multi-criteria A* pathfinding.
* **AI Layer (PARKAR):**
  - Gemini 2.5 Flash with structured tool calling.
  - Strict spatial grounding: the LLM never calculates raw distances or geometry; the spatial engine is the source of truth.
  - Deterministic local NLP fallback engine: 100% functionality even without an API key or when offline.
* **Voice Layer:** Web Speech API integration for real-time speech-to-text (STT) and voice speech synthesis (TTS).

---

## 🎮 Game Controls

| Action | Control | Description |
| :--- | :--- | :--- |
| **Move** | `W`, `A`, `S`, `D` / Arrow Keys | Forward, Left, Backward, Right |
| **Look** | Mouse Movement | 360° FPS mouse look with vertical pitch clamping |
| **Lock / Unlock** | Left Click / `ESC` | Locks mouse cursor for FPS look (ESC to release) |
| **Sprint** | `Shift` (Hold) | Increases speed from 4.8 m/s to 8.5 m/s |
| **Jump** | `Space` | Jump with gravity acceleration |
| **Interact** | `E` | Contextual interaction with Room doors, Elevators, and Kiosks |
| **Camera View** | `V` | Switch between First-Person (FPS) and Third-Person (TPS) |
| **AI Assistant** | Click `Talk to PARKAR` | Open the in-game conversational companion |

---

## 🏢 Multi-Floor Building Layout

### **Floor 1 (Ground Floor - 0.0m)**
- **Entrance:** Grand South Entrance with canopy and signage.
- **Corridor:** Main central axis (46m length).
- **Rooms:**
  - `Room 101`: Techfest Robotics Lab
  - `Room 102`: IoT Hardware Studio
  - `Room 103`: Admin & Registration
- **Vertical Connectors:** Staircase A & Elevator A.

### **Floor 2 (Second Floor - 4.5m)**
- **Rooms:**
  - `Room 201`: AI & Data Science Center
  - `Room 202`: Seminar Hall
  - `Room 203`: Cyber Security Arena
- **Vertical Connectors:** Staircase A & Elevator A.

### **Floor 3 (Third Floor - 9.0m)**
- **Rooms:**
  - `Room 301`: Innovation Incubation Cell
  - `Room 302`: Executive Board Room
  - `Room 303`: Dean & Faculty Lounge
- **Vertical Connectors:** Staircase A top landing & Elevator A.

---

## 🧠 PARKAR AI Spatial Assistant

### Tool Calling & Grounding
PARKAR is equipped with 6 spatial grounding tools:
1. `search_places(query)`: Authoritative fuzzy search across rooms, facilities, and landmarks.
2. `get_place_info(place_id)`: Retrieves room floor, coordinates, and accessibility.
3. `calculate_route(destination, preference)`: Runs 3D A* pathfinding.
4. `get_current_location(x, y, z, floor)`: Determines player's current floor and closest landmark.
5. `get_floor_info(floor)`: Returns all rooms and facilities on a given floor.
6. `get_nearest_place(category)`: Locates closest lab, elevator, stairs, or entrance.

### Route Preferences Supported
- **⚡ Fastest:** Direct path optimizing for minimal travel time.
- **🛗 Accessible / Avoid Stairs:** 100% elevator-only route (bypasses all staircases).
- **🚶 Stairs Only:** Active walking route bypassing elevator queues.

---

## 🚀 Setup & Execution

### 1. Environment Configuration
Copy `.env.example` to `.env`:
```powershell
cp .env.example .env
```
Add your Gemini API key (optional — if omitted, PARKAR seamlessly uses the deterministic spatial NLP engine):
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. Run the Backend
```powershell
cd backend
python -m venv venv
.\venv\Scripts\pip install -r requirements.txt
.\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation available at: **`http://127.0.0.1:8000/docs`**

### 3. Run the Frontend
```powershell
cd frontend
npm install
npm run dev
```
Web Application available at: **`http://localhost:5173/`**

---

## 🧪 Testing Suite

Run all automated test suites from `backend/`:
```powershell
cd backend
.\venv\Scripts\python.exe test_api.py            # Phase 1: API and building spec tests (6/6 passed)
.\venv\Scripts\python.exe test_routing.py        # Phase 2-3: Graph and multi-criteria A* tests (4/4 passed)
.\venv\Scripts\python.exe test_parkar_ai.py      # Phase 4: 10 PARKAR AI conversational test cases (10/10 passed)
.\venv\Scripts\python.exe test_live_server.py    # Phase 4: 12 live end-to-end server tests (12/12 passed)
.\venv\Scripts\python.exe test_reconstruction.py # Phase 5A: Real-world reconstruction prototype suite
```

---

## 📷 Phase 5A: Real-World 3D Reconstruction Pipeline

PARKAR Phase 5A introduces the prototype pipeline for transforming a smartphone indoor video recording into a navigable 3D digital twin:

```
SMARTPHONE INDOOR VIDEO
          ↓
VIDEO FRAME EXTRACTION (extract_frames.py - Laplacian blur filtering)
          ↓
3D RECONSTRUCTION (reconstruct.py - trajectory tracking & point cloud meshing)
          ↓
GLB EXPORT & CALIBRATION (export_glb.py - decimation & metric scaling)
          ↓
DUAL-MODE THREE.JS LOADER (BuildingLoader.ts - procedural vs reconstructed)
          ↓
NAVIGABLE DIGITAL TWIN
```

### Smartphone Video Capture Best Practices
* **Resolution & FPS:** 1080p @ 60 FPS or 4K @ 30 FPS.
* **Movement:** Slow walking (0.3–0.5 m/s), steady forward translation with serpentine motion (avoid panning in place).
* **Overlap:** 75%+ visual overlap between consecutive keyframes.
* **Loop Closure:** Conclude video by revisiting the starting entrance or landmark.

### Prototype CLI Commands
1. **Generate Sample Test Video:**
   ```powershell
   .\backend\venv\Scripts\python.exe reconstruction\scripts\generate_sample_video.py
   ```
2. **Extract Filtered Keyframes:**
   ```powershell
   .\backend\venv\Scripts\python.exe -u reconstruction\scripts\extract_frames.py --video reconstruction\input\indoor_building.mp4 --fps 2.0
   ```
3. **Execute 3D Reconstruction Engine:**
   ```powershell
   .\backend\venv\Scripts\python.exe -u reconstruction\scripts\reconstruct.py --frames-dir reconstruction\frames
   ```
4. **Export Calibrated GLB Digital Twin:**
   ```powershell
   .\backend\venv\Scripts\python.exe -u reconstruction\scripts\export_glb.py
   ```
5. **Run Phase 5A Test Suite:**
   ```powershell
   .\backend\venv\Scripts\python.exe -u backend\test_reconstruction.py
   ```

For in-depth architectural details, technology trade-offs, and data schemas, see [`docs/RECONSTRUCTION_PIPELINE.md`](docs/RECONSTRUCTION_PIPELINE.md).

