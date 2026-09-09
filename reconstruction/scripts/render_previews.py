#!/usr/bin/env python3
import os
import trimesh
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D

mesh_path = "reconstruction/output/mesh/building_mesh.obj"
mesh = trimesh.load(mesh_path)
print(f"Loaded mesh: {len(mesh.vertices)} vertices, {len(mesh.faces)} faces")
print(f"Bounds: min={mesh.bounds[0]}, max={mesh.bounds[1]}")

preview_dir = "reconstruction/output/previews"
os.makedirs(preview_dir, exist_ok=True)

verts = mesh.vertices
faces = mesh.faces
center = mesh.centroid

# Subsample faces for rapid, clear matplotlib 3D rendering
step = max(1, len(faces) // 6000)
sample_faces = faces[::step]

views = [
    {
        "name": "view1_entrance.png",
        "title": "View 1: Looking Down Corridor from Entrance",
        "elev": 10,
        "azim": -85,
        "dist": 10
    },
    {
        "name": "view2_corridor_forward.png",
        "title": "View 2: Midway Looking Forward (Z+)",
        "elev": 5,
        "azim": -90,
        "dist": 8
    },
    {
        "name": "view3_corridor_backward.png",
        "title": "View 3: Looking Backward Towards Entrance (Z-)",
        "elev": 5,
        "azim": 90,
        "dist": 8
    },
    {
        "name": "view4_staircase.png",
        "title": "View 4: Staircase & Side Structure",
        "elev": 25,
        "azim": -45,
        "dist": 9
    },
    {
        "name": "view5_side_iso.png",
        "title": "View 5: Isometric Architectural Volume",
        "elev": 30,
        "azim": -120,
        "dist": 11
    }
]

for v in views:
    fig = plt.figure(figsize=(10, 7), dpi=120)
    ax = fig.add_subplot(111, projection='3d')
    ax.set_facecolor('#141721')
    fig.patch.set_facecolor('#141721')
    
    # Plot triangular faces
    ax.plot_trisurf(
        verts[:, 0], verts[:, 2], verts[:, 1],
        triangles=sample_faces,
        cmap='copper',
        edgecolor='#334155',
        linewidth=0.1,
        alpha=0.85
    )
    
    ax.set_title(v["title"], color='white', fontsize=14, pad=12, fontweight='bold')
    ax.set_xlabel('X (Width, m)', color='#94a3b8', labelpad=8)
    ax.set_ylabel('Z (Length, m)', color='#94a3b8', labelpad=8)
    ax.set_zlabel('Y (Height, m)', color='#94a3b8', labelpad=8)
    ax.tick_params(colors='#94a3b8')
    
    ax.view_init(elev=v["elev"], azim=v["azim"])
    
    out_path = os.path.join(preview_dir, v["name"])
    plt.savefig(out_path, bbox_inches='tight', facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close(fig)
    print(f"Rendered: {out_path}")

print("All 5 preview views rendered successfully!")
