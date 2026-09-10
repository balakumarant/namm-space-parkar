import os
import json
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from config import settings
from core.pathfinding import pathfinder, RouteCalculationResponse, get_routes_for_mode
from services.reconstruction_manager import reconstruction_manager, RECON_JOBS_DIR

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
    building_mode: Optional[str] = "procedural"

@app.get("/api/navigation/graph")
def get_spatial_graph(mode: Optional[str] = "procedural"):
    filename = "reconstructed_spatial_graph.json" if mode == "reconstructed" else "spatial_graph.json"
    return load_json_file(filename)

@app.post("/api/navigation/route", response_model=RouteCalculationResponse)
def calculate_route(req: RouteRequest):
    try:
        return get_routes_for_mode(
            start_x=req.start_x,
            start_y=req.start_y,
            start_z=req.start_z,
            dest_id=req.destination_id,
            start_floor=req.start_floor,
            mode=req.building_mode or "procedural"
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
from ai.parkar_agent import parkar_agent

class PlayerState(BaseModel):
    x: float = 0.0
    y: float = 0.5
    z: float = 24.0
    floor: int = 1

class ChatMessage(BaseModel):
    role: str
    content: str

class ParkarChatRequest(BaseModel):
    message: str
    player_state: Optional[PlayerState] = None
    history: Optional[List[ChatMessage]] = None
    building_mode: Optional[str] = "procedural"

@app.get("/api/parkar/status")
def get_ai_status():
    has_gemini = bool(settings.gemini_api_key and settings.gemini_api_key != "your_gemini_api_key_here")
    return {
        "status": "online",
        "agent": "PARKAR Spatial Assistant",
        "gemini_enabled": has_gemini,
        "mode": "gemini-2.5-flash" if has_gemini else "deterministic-grounded-nlp"
    }

@app.post("/api/parkar/chat")
def parkar_chat(req: ParkarChatRequest):
    ps = req.player_state or PlayerState()
    history_dicts = [h.dict() for h in req.history] if req.history else []
    
    return parkar_agent.process_message(
        message=req.message,
        player_x=ps.x,
        player_y=ps.y,
        player_z=ps.z,
        player_floor=ps.floor,
        history=history_dicts,
        building_mode=req.building_mode or "procedural"
    )

# -------------------------------------------------------------
# PHASE 6: Video Upload & Automatic 3D Reconstruction Pipeline
# -------------------------------------------------------------

@app.post("/api/reconstruction/upload")
async def upload_walkthrough_video(video: UploadFile = File(...)):
    """
    Accepts user walkthrough video (.mp4, .mov, .webm), validates format and size,
    creates an isolated reconstruction job, and launches background processing.
    """
    filename = video.filename or "upload.mp4"
    ext = os.path.splitext(filename)[1].lower()
    allowed_extensions = {".mp4", ".mov", ".webm", ".avi", ".mkv"}
    
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file format '{ext}'. Supported formats: {', '.join(sorted(allowed_extensions))}"
        )

    # Read contents into memory/temp file with size checking
    temp_bytes = await video.read()
    file_size = len(temp_bytes)
    max_size = 250 * 1024 * 1024  # 250 MB

    if file_size < 1000:
        raise HTTPException(status_code=400, detail="Uploaded file is empty or corrupted.")

    if file_size > max_size:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum size limit of 250 MB ({file_size / (1024*1024):.1f} MB)."
        )

    try:
        job_id = reconstruction_manager.create_job(filename=filename, file_size=file_size)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Save uploaded video into job's isolated input directory
    job_input_dir = RECON_JOBS_DIR / job_id / "input"
    saved_video_path = job_input_dir / filename
    with open(saved_video_path, "wb") as f:
        f.write(temp_bytes)

    # Dispatch to background reconstruction pipeline
    reconstruction_manager.start_processing(job_id, str(saved_video_path))

    return {
        "job_id": job_id,
        "filename": filename,
        "file_size_bytes": file_size,
        "status": "QUEUED",
        "message": "Video successfully uploaded. 3D reconstruction pipeline initiated."
    }

@app.get("/api/reconstruction/status/{job_id}")
def get_reconstruction_status(job_id: str):
    """Returns live status, stage progress, and results for a reconstruction job."""
    job = reconstruction_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Reconstruction job '{job_id}' not found.")
    return job

@app.get("/api/reconstruction/jobs")
def list_reconstruction_jobs():
    """Lists all historical reconstruction jobs and their statuses."""
    return reconstruction_manager.list_jobs()

@app.get("/api/reconstruction/model/{job_id}/building.glb")
def serve_reconstructed_glb(job_id: str):
    """Serves the validated GLB binary model generated by a specific reconstruction job."""
    job = reconstruction_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Reconstruction job '{job_id}' not found.")

    glb_file = reconstruction_manager.get_job_file_path(job_id, "building.glb")
    if not glb_file or not glb_file.exists():
        raise HTTPException(
            status_code=404,
            detail=f"3D model for job '{job_id}' is not ready yet or failed to generate."
        )

    return FileResponse(
        path=str(glb_file),
        media_type="model/gltf-binary",
        filename=f"building_{job_id}.glb",
        headers={"Cache-Control": "public, max-age=3600"}
    )

@app.get("/api/reconstruction/model/{job_id}/metadata.json")
def serve_reconstructed_metadata(job_id: str):
    """Serves the metadata.json generated for a specific reconstruction job."""
    meta_file = reconstruction_manager.get_job_file_path(job_id, "metadata.json")
    if not meta_file or not meta_file.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Metadata for job '{job_id}' not found."
        )

    return FileResponse(
        path=str(meta_file),
        media_type="application/json",
        filename="metadata.json"
    )

@app.get("/api/reconstruction/diagnostics/{job_id}")
def serve_reconstructed_diagnostics(job_id: str):
    """Serves the auditable reconstruction diagnostics report for a job."""
    diag_file = reconstruction_manager.get_job_file_path(job_id, "diagnostics.json")
    if not diag_file or not diag_file.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Diagnostics for job '{job_id}' not found."
        )

    return FileResponse(
        path=str(diag_file),
        media_type="application/json",
        filename=f"diagnostics_{job_id}.json"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)

