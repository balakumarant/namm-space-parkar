# PARKAR — AI-Powered Gamified 3D Indoor Spatial Guide
**Competition:** Namma Space | Techfest, IIT Bombay

PARKAR is a web-based gamified 3D digital twin of a multi-floor indoor building. Visitors explore as a playable character using intuitive game controls, guided by an AI spatial assistant that computes optimal multi-criteria routes, visualizes 3D navigation waypoints, and provides real-time contextual guidance.

---

## 🏗️ Phase 1 Architecture Overview

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS
- **3D Engine:** Three.js (Procedural 3-floor architectural geometry, PBR materials, dynamic shadows, indoor atmospheric depth)
- **Physics:** `@dimforge/rapier3d-compat` (WASM-powered character controller with auto-stepping stairs, ground snapping, wall sliding, and capsule colliders)
- **Backend:** Python FastAPI (Building specifications, multi-floor POI registry, CORS enabled)
- **State Management:** Zustand (60 FPS decoupled state sharing between 3D physics/telemetry and React HUD)

---

## 🎮 Game Controls

| Action | Control | Description |
| :--- | :--- | :--- |
| **Move** | `W`, `A`, `S`, `D` / Arrow Keys | Forward, Left, Backward, Right |
| **Look** | Mouse Movement | Full 360° FPS mouse look with pitch clamping |
| **Lock Cursor** | Left Click | Locks pointer to camera for FPS controls (ESC to unlock) |
| **Sprint** | `Shift` (Hold) | Increases movement speed from 4.8 m/s to 8.5 m/s |
| **Jump** | `Space` | Jump with realistic indoor gravity ($g = -20 \text{ m/s}^2$) |
| **Interact** | `E` | Contextual interaction with Room doors, Elevators, and Kiosks |
| **Camera Toggle** | `V` | Switch between First-Person (FPS) and Third-Person (TPS) |

---

## 🏢 Multi-Floor Building Structure

### **Floor 1 (Ground Floor - Elevation 0.0m)**
- **Entrance:** Grand South Entrance with welcome canopy and Techfest signage.
- **Corridor:** Main central axis (46m length, 4.6m width).
- **Rooms:**
  - `Room 101`: Techfest Robotics Lab
  - `Room 102`: IoT Hardware Studio
  - `Room 103`: Admin & Registration
- **Vertical Connectors:** Staircase A (Steps with ramp colliders) & Elevator A (Interactive glass shaft).

### **Floor 2 (Second Floor - Elevation 4.5m)**
- Accessible via Staircase A or Elevator A.
- **Rooms:**
  - `Room 201`: AI & Data Science Center
  - `Room 202`: Seminar Hall
  - `Room 203`: Cyber Security Arena

### **Floor 3 (Third Floor - Elevation 9.0m)**
- Accessible via Staircase A or Elevator A.
- **Rooms:**
  - `Room 301`: Innovation Incubation Cell
  - `Room 302`: Executive Board Room
  - `Room 303`: Dean & Faculty Lounge

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18+ and npm
- **Python**: v3.10+ and pip

---

### 1. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```
The frontend will start at **`http://localhost:5173`**.

---

### 2. Start the Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```
Or via uvicorn directly:
```bash
uvicorn main:app --reload --port 8000
```
The FastAPI backend will run at **`http://localhost:8000`** with interactive Swagger documentation at **`http://localhost:8000/docs`**.

---

## 🔮 Upcoming Phases (Roadmap)

- **Phase 2:** Graph-based multi-floor 3D pathfinding (A* with quickest and wheelchair-accessible modes) + client/server graph synchronization.
- **Phase 3:** 3D Route visualization (animated glowing spline ribbon, pulsing chevrons, vertical transition beacons) + 2D top-down minimap radar.
- **Phase 4:** PARKAR AI assistant integration (Gemini 2.5 Flash spatial tool calling) + Web Speech voice input/output.
- **Phase 5:** Modular replacement of procedural geometry with real-world smartphone photogrammetry/LiDAR reconstructed GLTF/GLB models.
