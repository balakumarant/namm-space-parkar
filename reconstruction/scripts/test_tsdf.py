#!/usr/bin/env python3
import os
import glob
import cv2
import numpy as np
import trimesh
from scipy.spatial import cKDTree
from skimage.measure import marching_cubes
import fast_simplification

print("Loading metric point clouds...")
pcd_sparse = trimesh.load("reconstruction/output/pointcloud/metric_sparse.ply")
pcd_dense = trimesh.load("reconstruction/output/pointcloud/metric_dense.ply")

pts = np.vstack([pcd_sparse.vertices, pcd_dense.vertices])
cols = np.vstack([pcd_sparse.colors[:, :3], pcd_dense.colors[:, :3]])
print(f"Combined points: {len(pts)}")

# 1. Statistical Outlier Removal (SOR)
tree = cKDTree(pts)
k_sor = 20
distances, _ = tree.query(pts, k=k_sor)
mean_dist = np.mean(distances[:, 1:], axis=1)
global_mean = np.mean(mean_dist)
global_std = np.std(mean_dist)
sor_inliers = mean_dist <= (global_mean + 1.5 * global_std)

pts_sor = pts[sor_inliers]
cols_sor = cols[sor_inliers]
print(f"After SOR: {len(pts_sor)} inliers ({len(pts) - len(pts_sor)} outliers removed)")

# 2. Radius Outlier Removal (ROR)
tree_sor = cKDTree(pts_sor)
counts = tree_sor.query_ball_point(pts_sor, r=0.35, return_sorted=False)
num_neighbors = np.array([len(c) for c in counts])
ror_inliers = num_neighbors >= 6

pts_clean = pts_sor[ror_inliers]
cols_clean = cols_sor[ror_inliers]
print(f"After ROR: {len(pts_clean)} inliers")

# 3. PCA Normal Estimation
print("Estimating surface normals via PCA...")
clean_tree = cKDTree(pts_clean)
k_norm = 25
dists, indices = clean_tree.query(pts_clean, k=k_norm)

normals = np.zeros_like(pts_clean)
for i in range(len(pts_clean)):
    neighbors = pts_clean[indices[i]]
    cov = np.cov(neighbors, rowvar=False)
    eigenvalues, eigenvectors = np.linalg.eigh(cov)
    # The normal is the eigenvector with smallest eigenvalue
    normal = eigenvectors[:, 0]
    normals[i] = normal

# Orient normals towards corridor center line (X=0, Y=0, Z along corridor)
corridor_axis_pts = np.zeros_like(pts_clean)
corridor_axis_pts[:, 2] = pts_clean[:, 2]  # (0, 0, Z)
to_center = corridor_axis_pts - pts_clean
dot = np.sum(normals * to_center, axis=1)
normals[dot < 0] = -normals[dot < 0]

# 4. Volumetric TSDF Grid
voxel_size = 0.12  # 12cm voxels for crisp architectural surfaces
bbox_min = np.min(pts_clean, axis=0) - 0.3
bbox_max = np.max(pts_clean, axis=0) + 0.3

# Grid coordinates
xs = np.arange(bbox_min[0], bbox_max[0], voxel_size)
ys = np.arange(bbox_min[1], bbox_max[1], voxel_size)
zs = np.arange(bbox_min[2], bbox_max[2], voxel_size)

nx, ny, nz = len(xs), len(ys), len(zs)
print(f"Grid dimensions: {nx} x {ny} x {nz} = {nx*ny*nz:,} voxels (spacing {voxel_size}m)")

grid_x, grid_y, grid_z = np.meshgrid(xs, ys, zs, indexing='ij')
grid_pts = np.stack([grid_x.ravel(), grid_y.ravel(), grid_z.ravel()], axis=1)

# Query nearest surface points
grid_dists, grid_idx = clean_tree.query(grid_pts)
nearest_pts = pts_clean[grid_idx]
nearest_normals = normals[grid_idx]

# Vector from surface to grid point
diff = grid_pts - nearest_pts
# Signed distance: positive in front of surface (towards center), negative behind
signed_dist = np.sum(diff * nearest_normals, axis=1)

# Truncate at +/- 0.4m
trunc = 0.36
tsdf = np.clip(signed_dist, -trunc, trunc)
tsdf_grid = tsdf.reshape(nx, ny, nz)

# 5. Marching Cubes Isosurface Extraction
print("Extracting isosurface via Marching Cubes...")
verts_idx, faces, face_normals, _ = marching_cubes(tsdf_grid, level=0.0, spacing=(voxel_size, voxel_size, voxel_size))
verts = verts_idx + bbox_min

print(f"Marching Cubes extracted: {len(verts):,} vertices, {len(faces):,} faces")

# 6. Simplify mesh
print("Simplifying mesh with fast_simplification...")
target_faces = min(35000, max(5000, len(faces) // 2))
verts_simple, faces_simple = fast_simplification.simplify(verts.astype(np.float32), faces.astype(np.int32), target_count=target_faces)

print(f"Simplified mesh: {len(verts_simple):,} vertices, {len(faces_simple):,} faces")

# Build trimesh
mesh = trimesh.Trimesh(vertices=verts_simple, faces=faces_simple)

# Keep only large connected components (remove isolated floating artifacts)
components = mesh.split(only_watertight=False)
print(f"Total connected components: {len(components)}")
valid_comp = [c for c in components if len(c.faces) > 50]
print(f"Components with >50 faces: {len(valid_comp)}")

if valid_comp:
    clean_mesh = trimesh.util.concatenate(valid_comp)
else:
    clean_mesh = mesh

print(f"Final Clean Mesh: {len(clean_mesh.vertices):,} vertices, {len(clean_mesh.faces):,} faces")
print(f"Extents: X={clean_mesh.extents[0]:.2f}m, Y={clean_mesh.extents[1]:.2f}m, Z={clean_mesh.extents[2]:.2f}m")

# Export test mesh
clean_mesh.export("reconstruction/output/mesh/test_tsdf_mesh.obj")
print("Saved reconstruction/output/mesh/test_tsdf_mesh.obj successfully!")
