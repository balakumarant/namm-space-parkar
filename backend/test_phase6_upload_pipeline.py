"""
Self-contained unit and integration test suite for Phase 6.
Tests the reconstruction manager and endpoints directly without requiring external httpx client.
"""

import os
import sys
import unittest
import time
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from services.reconstruction_manager import (
    reconstruction_manager,
    STATE_QUEUED,
    STATE_COMPLETED,
    STATE_FAILED,
    RECON_JOBS_DIR
)

class TestPhase6Reconstruction(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_video_path = BASE_DIR.parent / "reconstruction" / "input" / "indoor_building.mp4"

    def test_01_reject_invalid_extension(self):
        with self.assertRaises(ValueError) as ctx:
            reconstruction_manager.create_job("document.pdf", 10000)
        self.assertIn("Unsupported file format", str(ctx.exception))

    def test_02_reject_oversized_file(self):
        huge_size = 300 * 1024 * 1024  # 300 MB > 250 MB
        with self.assertRaises(ValueError) as ctx:
            reconstruction_manager.create_job("huge_video.mp4", huge_size)
        self.assertIn("exceeds maximum allowed limit", str(ctx.exception))

    def test_03_job_creation_and_lifecycle(self):
        self.assertTrue(self.test_video_path.exists(), f"Test video not found: {self.test_video_path}")
        file_size = self.test_video_path.stat().st_size
        
        job_id = reconstruction_manager.create_job("indoor_building.mp4", file_size)
        self.assertTrue(job_id.startswith("recon_"))
        
        job = reconstruction_manager.get_job(job_id)
        self.assertIsNotNone(job)
        self.assertEqual(job["status"], STATE_QUEUED)
        self.assertIn("stages", job)

        # Copy video to job input directory
        job_input_dir = RECON_JOBS_DIR / job_id / "input"
        saved_video_path = job_input_dir / "indoor_building.mp4"
        import shutil
        shutil.copy2(self.test_video_path, saved_video_path)

        # Run pipeline synchronously in test
        reconstruction_manager._run_pipeline(job_id, str(saved_video_path))

        # Check job completion
        updated_job = reconstruction_manager.get_job(job_id)
        self.assertEqual(updated_job["status"], STATE_COMPLETED, f"Pipeline failed: {updated_job.get('error')}")
        self.assertEqual(updated_job["progress_pct"], 100)
        
        # Verify generated files
        output_dir = RECON_JOBS_DIR / job_id / "output"
        glb_path = output_dir / "building.glb"
        meta_path = output_dir / "metadata.json"
        
        self.assertTrue(glb_path.exists(), "building.glb must exist")
        self.assertGreater(glb_path.stat().st_size, 5000, "building.glb must be valid binary")
        with open(glb_path, "rb") as f:
            magic = f.read(4)
            self.assertEqual(magic, b"glTF", "GLB must start with glTF magic")

        self.assertTrue(meta_path.exists(), "metadata.json must exist")
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
            self.assertIn("dimensions", meta)
            self.assertIn("bounds", meta)
            self.assertIn("floors", meta)
            self.assertGreater(meta["mesh_stats"]["vertices"], 20)

    def test_04_list_jobs(self):
        jobs = reconstruction_manager.list_jobs()
        self.assertIsInstance(jobs, list)
        self.assertGreaterEqual(len(jobs), 1)

if __name__ == "__main__":
    unittest.main()
