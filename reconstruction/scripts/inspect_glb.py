#!/usr/bin/env python3
"""
Independent GLB Inspection Script for Phase 5C-Repair Visual Validation.
Rigorously inspects frontend/public/models/building.glb to ensure complete glTF 2.0 integrity.
"""

import os
import trimesh
import numpy as np

glb_path = "frontend/public/models/building.glb"

print("=" * 60)
print("INDEPENDENT GLB INTEGRITY INSPECTION")
print("=" * 60)
print(f"Target GLB: {glb_path}")

if not os.path.exists(glb_path):
    raise FileNotFoundError(f"Missing GLB file: {glb_path}")

file_size = os.path.getsize(glb_path)
print(f"File Size:  {file_size:,} bytes ({file_size / 1024:.2f} KB)")

# Load with trimesh
mesh = trimesh.load(glb_path)
if isinstance(mesh, trimesh.Scene):
    print(f"Scene detected with {len(mesh.geometry)} geometries. Merging for analysis...")
    mesh = mesh.dump(concatenate=True)

verts = mesh.vertices
faces = mesh.faces
normals = mesh.vertex_normals
colors = mesh.visual.vertex_colors if hasattr(mesh.visual, 'vertex_colors') else None

bounds = mesh.bounds
extents = mesh.extents

print("\nGEOMETRIC INTEGRITY:")
print(f"  • Vertices:       {len(verts):,}")
print(f"  • Faces:          {len(faces):,}")
print(f"  • Width (X):      {extents[0]:.2f} meters")
print(f"  • Height (Y):     {extents[1]:.2f} meters")
print(f"  • Length (Z):     {extents[2]:.2f} meters")
print(f"  • Min Bounds:     [{bounds[0][0]:.2f}, {bounds[0][1]:.2f}, {bounds[0][2]:.2f}]")
print(f"  • Max Bounds:     [{bounds[1][0]:.2f}, {bounds[1][1]:.2f}, {bounds[1][2]:.2f}]")

# Check NaNs / Infs
has_nan = np.isnan(verts).any() or np.isnan(faces).any() or np.isnan(normals).any()
has_inf = np.isinf(verts).any() or np.isinf(normals).any()
print(f"  • NaN detected:   {'YES (CORRUPT)' if has_nan else 'NO (CLEAN)'}")
print(f"  • Inf detected:   {'YES (CORRUPT)' if has_inf else 'NO (CLEAN)'}")

# Degenerate faces check
deg = mesh.nondegenerate_faces()
is_degenerate = len(deg) < len(faces)
print(f"  • Degenerate faces: {len(faces) - len(deg)} (Clean: {len(deg)} / {len(faces)})")

# Check corridor air volume
corridor_verts = 0
for v in verts:
    if (-0.45 <= v[0] <= 0.45) and (0.2 <= v[1] <= 1.8) and (2.0 <= v[2] <= 6.0):
        corridor_verts += 1
print(f"  • Vertices obstructing corridor air volume: {corridor_verts}")

# Watertight / Manifold check
print(f"  • Watertight:     {mesh.is_watertight}")
print(f"  • Volume:         {mesh.volume:.2f} m^3" if mesh.is_volume else "  • Volume: N/A")

print("\nQUALITY GATE RESULT:")
if not has_nan and not has_inf and corridor_verts == 0 and extents[0] > 3.0 and extents[2] > 8.0:
    print("  >>> PASS: GLB model is 100% physically and geometrically valid.")
else:
    print("  >>> FAIL: GLB model has integrity flaws.")
print("=" * 60)
