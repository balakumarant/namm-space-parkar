import os
import json
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from config import settings
from core.pathfinding import pathfinder, RouteCalculationResponse

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="Backend API for PARKAR — AI-Powered Gamified 3D Indoor Spatial Guide (Techfest, IIT Bombay)"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).parent / "data"

class Position(BaseModel):
    x: float
    y: float
    z: float

class POI(BaseModel):
    id: str
    number: str
    name: str
    floor: int
    category: str
    position: Position
    door_position: Position
    accessible: bool
    description: str

def load_json_file(filename: str):
    file_path = DATA_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=500, detail=f"Data file {filename} not found")
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/")
def read_root():
    return {
        "project": "PARKAR",
        "description": "AI-Powered Gamified 3D Indoor Spatial Guide",
        "competition": "Namma Space | Techfest, IIT Bombay",
        "phase": 1,
        "status": "online",
        "docs_url": "/docs"
    }

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "parkar-backend"}

@app.get("/api/building/info")
def get_building_info():
    data = load_json_file("building_spec.json")
    return data["building"]

@app.get("/api/building/floors")
def get_floors():
    data = load_json_file("building_spec.json")
    return data["floors"]

@app.get("/api/building/pois", response_model=List[POI])
def get_pois(floor: Optional[int] = None):
    pois = load_json_file("pois.json")
    if floor is not None:
        pois = [p for p in pois if p["floor"] == floor]
    return pois

@app.get("/api/building/pois/{poi_id}", response_model=POI)
def get_poi_by_id(poi_id: str):
    pois = load_json_file("pois.json")
    for p in pois:
        if p["id"] == poi_id:
            return p
    raise HTTPException(status_code=404, detail=f"POI with ID '{poi_id}' not found")

class RouteRequest(BaseModel):
    start_x: float
    start_y: float
    start_z: float
    destination_id: str
    start_floor: Optional[int] = None

@app.get("/api/navigation/graph")
def get_spatial_graph():
    return load_json_file("spatial_graph.json")

@app.post("/api/navigation/route", response_model=RouteCalculationResponse)
def calculate_route(req: RouteRequest):
    try:
        return pathfinder.get_multi_routes(
            start_x=req.start_x,
            start_y=req.start_y,
            start_z=req.start_z,
            dest_node_id=req.destination_id,
            start_floor=req.start_floor
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pathfinding error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)
