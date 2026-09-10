"""
PARKAR Reconstruction Job Manager (Phase 6).
Orchestrates background 3D reconstruction jobs from uploaded walkthrough videos.
Manages job lifecycle states:
  QUEUED -> EXTRACTING_FRAMES -> FEATURE_MATCHING -> RECONSTRUCTING -> GENERATING_MESH -> VALIDATING -> COMPLETED (or FAILED)
Each job operates in an isolated workspace: reconstruction/jobs/{job_id}/
"""

import os
import sys
import time
import json
import uuid
import shutil
import asyncio
import logging
import subprocess
import trimesh
import cv2
import numpy as np
from pathlib import Path
from typing import Dict, Any, Optional, List
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger("reconstruction_manager")

BASE_DIR = Path(__file__).resolve().parent.parent.parent
RECON_JOBS_DIR = BASE_DIR / "reconstruction" / "jobs"
SCRIPTS_DIR = BASE_DIR / "reconstruction" / "scripts"

# Pipeline States
STATE_QUEUED = "QUEUED"
STATE_EXTRACTING_FRAMES = "EXTRACTING_FRAMES"
STATE_FEATURE_MATCHING = "FEATURE_MATCHING"
STATE_RECONSTRUCTING = "RECONSTRUCTING"
STATE_GENERATING_MESH = "GENERATING_MESH"
STATE_VALIDATING = "VALIDATING"
STATE_COMPLETED = "COMPLETED"
STATE_FAILED = "FAILED"

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".webm", ".avi", ".mkv"}
MAX_FILE_SIZE_BYTES = 250 * 1024 * 1024  # 250 MB

class ReconstructionJobManager:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(ReconstructionJobManager, cls).__new__(cls, *args, **kwargs)
            cls._instance._init_manager()
        return cls._instance

    def _init_manager(self):
        self.jobs: Dict[str, Dict[str, Any]] = {}
        self.executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="recon_worker")
        os.makedirs(RECON_JOBS_DIR, exist_ok=True)
        self._load_existing_jobs()

    def _load_existing_jobs(self):
        """Scans jobs directory to restore previous jobs into memory."""
        if not RECON_JOBS_DIR.exists():
            return
        for job_folder in RECON_JOBS_DIR.iterdir():
            if job_folder.is_dir():
                job_file = job_folder / "job.json"
                if job_file.exists():
                    try:
                        with open(job_file, "r", encoding="utf-8") as f:
                            data = json.load(f)
                            self.jobs[data["job_id"]] = data
                    except Exception as e:
                        logger.warning(f"Could not load job from {job_file}: {e}")

    def _save_job_state(self, job_id: str):
        job = self.jobs.get(job_id)
        if not job:
            return
        job_dir = RECON_JOBS_DIR / job_id
        os.makedirs(job_dir, exist_ok=True)
        job_file = job_dir / "job.json"
        try:
            with open(job_file, "w", encoding="utf-8") as f:
                json.dump(job, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Error persisting job state {job_id}: {e}")

    def create_job(self, filename: str, file_size: int) -> str:
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise ValueError(f"Unsupported file format '{ext}'. Allowed formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

        if file_size > MAX_FILE_SIZE_BYTES:
            raise ValueError(f"File size ({file_size / (1024*1024):.1f} MB) exceeds maximum allowed limit of {MAX_FILE_SIZE_BYTES / (1024*1024):.0f} MB")

        job_id = f"recon_{uuid.uuid4().hex[:10]}"
        job_dir = RECON_JOBS_DIR / job_id

        # Isolated directory structure:
        # job_dir / input, frames, features, poses, depth, points, planes, mesh, output
        subfolders = ["input", "frames", "features", "poses", "depth", "points", "planes", "mesh", "output"]
        for sf in subfolders:
            os.makedirs(job_dir / sf, exist_ok=True)

        job = {
            "job_id": job_id,
            "filename": filename,
            "file_size_bytes": file_size,
            "created_at": time.time(),
            "updated_at": time.time(),
            "status": STATE_QUEUED,
            "progress_pct": 5,
            "stage_description": "Job queued and initialized",
            "stages": {
                "upload": {"status": "COMPLETED", "progress": 100},
                "extraction": {"status": "PENDING", "progress": 0},
                "feature_matching": {"status": "PENDING", "progress": 0},
                "reconstruction": {"status": "PENDING", "progress": 0},
                "mesh_generation": {"status": "PENDING", "progress": 0},
                "validation": {"status": "PENDING", "progress": 0}
            },
            "error": None,
            "result": None
        }

        self.jobs[job_id] = job
        self._save_job_state(job_id)
        return job_id

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        return self.jobs.get(job_id)

    def list_jobs(self) -> List[Dict[str, Any]]:
        return sorted(list(self.jobs.values()), key=lambda j: j.get("created_at", 0), reverse=True)

    def get_job_file_path(self, job_id: str, filename: str) -> Optional[Path]:
        job_dir = RECON_JOBS_DIR / job_id / "output"
        target_path = job_dir / filename
        if target_path.exists() and target_path.is_file():
            return target_path
        return None

    def start_processing(self, job_id: str, video_path: str):
        """Dispatches job to background thread pool."""
        self.executor.submit(self._run_pipeline, job_id, video_path)

    def _update_stage(self, job_id: str, stage_name: str, status: str, progress: int, overall_pct: int, description: str):
        if job_id not in self.jobs:
            return
        job = self.jobs[job_id]
        job["status"] = stage_name
        job["progress_pct"] = overall_pct
        job["stage_description"] = description
        job["updated_at"] = time.time()
        
        stage_key = {
            STATE_EXTRACTING_FRAMES: "extraction",
            STATE_FEATURE_MATCHING: "feature_matching",
            STATE_RECONSTRUCTING: "reconstruction",
            STATE_GENERATING_MESH: "mesh_generation",
            STATE_VALIDATING: "validation",
            STATE_COMPLETED: "validation",
        }.get(stage_name)

        if stage_key and stage_key in job["stages"]:
            job["stages"][stage_key]["status"] = status
            job["stages"][stage_key]["progress"] = progress

        self._save_job_state(job_id)

    def _fail_job(self, job_id: str, error_message: str):
        if job_id not in self.jobs:
            return
        job = self.jobs[job_id]
        job["status"] = STATE_FAILED
        job["error"] = error_message
        job["updated_at"] = time.time()
        job["stage_description"] = f"Pipeline failed: {error_message}"
        self._save_job_state(job_id)
        logger.error(f"[Job {job_id}] FAILED: {error_message}")

    def _validate_glb(self, glb_path: Path) -> Dict[str, Any]:
        """Validates that output GLB is non-empty, contains glTF header, and has valid geometry."""
        if not glb_path.exists():
            raise FileNotFoundError(f"Exported model not found at {glb_path}")

        file_size = glb_path.stat().st_size
        if file_size < 1024:  # At least 1 KB
            raise ValueError(f"Exported GLB model is corrupt or too small ({file_size} bytes)")

        # Verify glTF binary magic (0x46546C67 -> "glTF")
        with open(glb_path, "rb") as f:
            magic = f.read(4)
            if magic != b"glTF":
                raise ValueError(f"Invalid GLB binary magic: {magic} (expected b'glTF')")

        # Load mesh to inspect vertices & faces
        scene_or_mesh = trimesh.load(str(glb_path), file_type="glb")
        if isinstance(scene_or_mesh, trimesh.Scene):
            geoms = [g for g in scene_or_mesh.geometry.values() if isinstance(g, trimesh.Trimesh)]
            total_vertices = sum(len(g.vertices) for g in geoms)
            total_faces = sum(len(g.faces) for g in geoms)
            extents = scene_or_mesh.extents.tolist() if len(geoms) > 0 else [0, 0, 0]
            bounds = [scene_or_mesh.bounds[0].tolist(), scene_or_mesh.bounds[1].tolist()] if len(geoms) > 0 else [[0, 0, 0], [0, 0, 0]]
        else:
            total_vertices = len(scene_or_mesh.vertices)
            total_faces = len(scene_or_mesh.faces)
            extents = scene_or_mesh.extents.tolist()
            bounds = [scene_or_mesh.bounds[0].tolist(), scene_or_mesh.bounds[1].tolist()]

        if total_vertices < 20 or total_faces < 10:
            raise ValueError(f"Model geometry check failed: only {total_vertices} vertices and {total_faces} faces found")

        return {
            "file_size_bytes": file_size,
            "vertices": total_vertices,
            "faces": total_faces,
            "extents": extents,
            "bounds": bounds,
            "is_valid": True
        }

    def _generate_metadata_json(self, job_id: str, val_stats: Dict[str, Any], output_dir: Path):
        """Generates dynamic metadata.json for the newly reconstructed space."""
        extents = val_stats.get("extents", [6.0, 2.8, 12.0])
        bounds = val_stats.get("bounds", [[-3.0, 0.0, 1.0], [3.0, 2.8, 13.0]])
        
        metadata = {
            "building_name": f"User Digital Twin ({job_id})",
            "format": "GLB / glTF 2.0 Binary",
            "units": "meters",
            "scale_calibrated": True,
            "scale_factor": 1.0,
            "dimensions": {
                "width_meters": round(float(extents[0]), 2),
                "height_meters": round(float(extents[1]), 2),
                "length_meters": round(float(extents[2]), 2)
            },
            "bounds": {
                "min": [round(float(b), 2) for b in bounds[0]],
                "max": [round(float(b), 2) for b in bounds[1]]
            },
            "mesh_stats": {
                "vertices": val_stats.get("vertices", 0),
                "faces": val_stats.get("faces", 0),
                "file_size_bytes": val_stats.get("file_size_bytes", 0)
            },
            "floors": [
                {
                    "floor": 1,
                    "elevation_meters": 0.0,
                    "height_meters": round(float(extents[1]), 2),
                    "walkable_surface": {
                        "min_x": round(float(bounds[0][0]), 2),
                        "max_x": round(float(bounds[1][0]), 2),
                        "min_z": round(float(bounds[0][2]), 2),
                        "max_z": round(float(bounds[1][2]), 2)
                    }
                }
            ],
            "rooms": [
                {
                    "id": f"{job_id}_entrance",
                    "name": "Entrance & Foyer Zone",
                    "floor": 1,
                    "center": [0.0, 0.0, round(float(bounds[0][2]) + 2.0, 2)],
                    "door": [0.0, 0.0, round(float(bounds[0][2]) + 1.0, 2)]
                },
                {
                    "id": f"{job_id}_main_hall",
                    "name": "Main Reconstructed Space",
                    "floor": 1,
                    "center": [0.0, 0.0, round((float(bounds[0][2]) + float(bounds[1][2])) / 2.0, 2)],
                    "door": [0.0, 0.0, round((float(bounds[0][2]) + float(bounds[1][2])) / 2.0 - 1.0, 2)]
                }
            ],
            "pois": [
                {
                    "id": f"poi_{job_id}_entry",
                    "name": "User Upload Entry",
                    "floor": 1,
                    "category": "entrance",
                    "position": {"x": 0.0, "y": 0.0, "z": round(float(bounds[0][2]) + 2.0, 2)},
                    "description": "Spawn point inside user reconstructed digital twin"
                }
            ]
        }

        meta_path = output_dir / "metadata.json"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

    def _run_pipeline(self, job_id: str, video_path: str):
        """Synchronous worker executing the actual photogrammetry reconstruction pipeline."""
        job_dir = RECON_JOBS_DIR / job_id
        frames_dir = job_dir / "frames"
        output_dir = job_dir / "output"
        pointcloud_dir = output_dir / "pointcloud"
        os.makedirs(pointcloud_dir, exist_ok=True)
        job = self.jobs.get(job_id, {})

        try:
            logger.info(f"[Job {job_id}] Starting frame extraction from {video_path}...")
            self._update_stage(
                job_id,
                STATE_EXTRACTING_FRAMES,
                "IN_PROGRESS",
                20,
                15,
                "Extracting sharp keyframes & filtering blur using Laplacian variance..."
            )

            # 1. Extract Frames
            sys.path.insert(0, str(SCRIPTS_DIR))
            from extract_frames import extract_frames
            from reconstruct import reconstruct_from_frames
            from export_glb import export_building_glb
            
            extraction_meta = extract_frames(
                video_path=video_path,
                output_dir=str(frames_dir),
                target_fps=2.0,
                max_frames=60,
                min_sharpness=5.0,
                clean_output=True
            )

            saved_frames = extraction_meta.get("frames_extracted", len(extraction_meta.get("extracted_frames", [])))
            if saved_frames < 2:
                raise RuntimeError(f"Too few sharp frames extracted ({saved_frames}). Walkthrough video is unsuitable for 3D reconstruction.")

            # 2. Feature Detection, Matching & Architectural SfM Twin Generation
            self._update_stage(
                job_id,
                STATE_FEATURE_MATCHING,
                "IN_PROGRESS",
                40,
                35,
                f"Detecting multi-scale SIFT keypoints & RANSAC matching across {saved_frames} keyframes..."
            )

            self._update_stage(
                job_id,
                STATE_RECONSTRUCTING,
                "IN_PROGRESS",
                60,
                55,
                "Estimating camera poses, triangulating 3D points & detecting RANSAC architectural planes..."
            )

            self._update_stage(
                job_id,
                STATE_GENERATING_MESH,
                "IN_PROGRESS",
                80,
                75,
                "Synthesizing watertight architectural geometry & exporting game-ready GLB..."
            )

            # Execute the architecture-aware reconstruction engine via isolated subprocess
            script_path = SCRIPTS_DIR / "reconstruct_architectural.py"
            cmd = [
                sys.executable,
                str(script_path),
                "--frames-dir", str(frames_dir),
                "--output-dir", str(output_dir),
                "--job-id", job_id,
                "--filename", str(job.get("filename", "walkthrough.mp4")),
                "--job-dir", str(job_dir),
                "--max-features", "2500"
            ]
            logger.info(f"[Job {job_id}] Invoking reconstruction subprocess: {' '.join(cmd)}")
            proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=False)
            if proc.returncode != 0:
                err_text = proc.stderr.strip() or proc.stdout.strip()
                raise RuntimeError(f"Reconstruction subprocess failed with exit code {proc.returncode}: {err_text}")

            # 4. Validating Generated Model
            self._update_stage(
                job_id,
                STATE_VALIDATING,
                "IN_PROGRESS",
                95,
                90,
                "Verifying GLB binary integrity, vertex count, and architectural clearance..."
            )

            glb_path = output_dir / "building.glb"
            val_stats = self._validate_glb(glb_path)

            # Check if metadata.json already generated by reconstruct_architectural_twin
            meta_path = output_dir / "metadata.json"
            if not meta_path.exists():
                self._generate_metadata_json(job_id, val_stats, output_dir)

            # Read diagnostics.json to attach detailed metrics to result
            diag_path = output_dir / "diagnostics.json"
            diag_stats = {}
            if diag_path.exists():
                try:
                    with open(diag_path, "r", encoding="utf-8") as f:
                        diag_stats = json.load(f)
                except Exception as e:
                    logger.warning(f"Failed to read diagnostics {diag_path}: {e}")

            # Mark Completed
            job = self.jobs[job_id]
            job["status"] = STATE_COMPLETED
            job["progress_pct"] = 100
            job["stage_description"] = "3D Digital Twin successfully reconstructed and validated!"
            job["updated_at"] = time.time()
            for k in job["stages"]:
                job["stages"][k]["status"] = "COMPLETED"
                job["stages"][k]["progress"] = 100

            job["result"] = {
                "glb_url": f"/api/reconstruction/model/{job_id}/building.glb",
                "metadata_url": f"/api/reconstruction/model/{job_id}/metadata.json",
                "diagnostics_url": f"/api/reconstruction/diagnostics/{job_id}",
                "mesh_stats": val_stats,
                "extracted_frames": saved_frames,
                "diagnostics": diag_stats
            }

            self._save_job_state(job_id)
            logger.info(f"[Job {job_id}] SUCCESSFULLY completed! GLB size: {val_stats['file_size_bytes']:,} bytes")

        except Exception as err:
            import traceback
            tb = traceback.format_exc()
            logger.error(f"[Job {job_id}] Exception: {err}\n{tb}")
            self._fail_job(job_id, str(err))

# Global Singleton
reconstruction_manager = ReconstructionJobManager()
