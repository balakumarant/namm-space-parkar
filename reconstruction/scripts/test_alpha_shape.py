#!/usr/bin/env python3
import trimesh
import numpy as np
from scipy.spatial import Delaunay
from collections import defaultdict

pcd_sparse = trimesh.load("reconstruction/output/pointcloud/metric_sparse.ply")
pcd_dense = trimesh.load("reconstruction/output/pointcloud/metric_dense.ply")
pts = np.vstack([pcd_sparse.vertices, pcd_dense.vertices])
cols = np.vstack([pcd_sparse.colors[:, :3], pcd_dense.colors[:, :3]])
print(f"Total input points: {len(pts)}")

# 1. Downsample points to ~0.06m spacing using voxel grid to prevent degenerate near-coincident points
voxel_size = 0.06
quantized = np.round(pts / voxel_size).astype(int)
_, unique_idx = np.unique(quantized, axis=0, return_index=True)
pts_down = pts[unique_idx]
cols_down = cols[unique_idx]
print(f"Downsampled points (voxel {voxel_size}m): {len(pts_down)}")

# 2. 3D Delaunay Triangulation
print("Computing 3D Delaunay triangulation...")
delaunay = Delaunay(pts_down)
tetrahedra = delaunay.simplices
print(f"Total tetrahedra: {len(tetrahedra):,}")

# 3. Compute circumradius for each tetrahedron
t_pts = pts_down[tetrahedra] # shape (N, 4, 3)
# Vectors from vertex 0 to 1, 2, 3
a = t_pts[:, 1] - t_pts[:, 0]
b = t_pts[:, 2] - t_pts[:, 0]
c = t_pts[:, 3] - t_pts[:, 0]

# Volume of tetrahedron = |det([a, b, c])| / 6
cross_bc = np.cross(b, c)
vol = np.abs(np.sum(a * cross_bc, axis=1)) / 6.0 + 1e-12

# Circumradius formula: R = |a|^2 (b x c) + |b|^2 (c x a) + |c|^2 (a x b) / (12 * Volume)
len_a2 = np.sum(a**2, axis=1, keepdims=True)
len_b2 = np.sum(b**2, axis=1, keepdims=True)
len_c2 = np.sum(c**2, axis=1, keepdims=True)

cross_ca = np.cross(c, a)
cross_ab = np.cross(a, b)

num = len_a2 * cross_bc + len_b2 * cross_ca + len_c2 * cross_ab
r_circum = np.linalg.norm(num, axis=1) / (12.0 * vol)

# Filter tetrahedra by alpha radius
alpha = 0.22  # 22cm radius limit
valid_tets = tetrahedra[r_circum < alpha]
print(f"Tetrahedra with circumradius < {alpha}m: {len(valid_tets):,}")

# 4. Extract boundary triangular faces (faces shared by exactly one valid tetrahedron)
face_counts = defaultdict(int)
for tet in valid_tets:
    # 4 faces of tetrahedron
    faces_tet = [
        tuple(sorted([tet[0], tet[1], tet[2]])),
        tuple(sorted([tet[0], tet[1], tet[3]])),
        tuple(sorted([tet[0], tet[2], tet[3]])),
        tuple(sorted([tet[1], tet[2], tet[3]]))
    ]
    for f in faces_tet:
        face_counts[f] += 1

# Boundary faces are those with count == 1
boundary_faces = [f for f, count in face_counts.items() if count == 1]
print(f"Extracted boundary faces: {len(boundary_faces):,}")

mesh = trimesh.Trimesh(vertices=pts_down, faces=np.array(boundary_faces), vertex_colors=cols_down)
mesh.remove_unreferenced_vertices()

print(f"Raw Alpha-Shape Mesh: {len(mesh.vertices):,} vertices, {len(mesh.faces):,} faces")
print(f"Extents: X={mesh.extents[0]:.2f}m, Y={mesh.extents[1]:.2f}m, Z={mesh.extents[2]:.2f}m")

# Connected components
components = mesh.split(only_watertight=False)
print(f"Total components: {len(components)}")
valid_comp = [c for c in components if len(c.faces) > 80]
print(f"Components with >80 faces: {len(valid_comp)}")

clean_mesh = trimesh.util.concatenate(valid_comp)
print(f"Filtered Clean Mesh: {len(clean_mesh.vertices):,} vertices, {len(clean_mesh.faces):,} faces")

clean_mesh.export("reconstruction/output/mesh/test_alpha_mesh.obj")
print("Saved reconstruction/output/mesh/test_alpha_mesh.obj successfully!")
