#!/usr/bin/env python3
import trimesh
import numpy as np

pcd_sparse = trimesh.load("reconstruction/output/pointcloud/metric_sparse.ply")
pcd_dense = trimesh.load("reconstruction/output/pointcloud/metric_dense.ply")
pts = np.vstack([pcd_sparse.vertices, pcd_dense.vertices])
cols = np.vstack([pcd_sparse.colors[:, :3], pcd_dense.colors[:, :3]])

print(f"Total points: {len(pts)}")

# RANSAC plane detector
def find_plane_ransac(points, max_dist=0.08, num_iterations=1000):
    best_inliers = []
    best_plane = None
    n = len(points)
    for _ in range(num_iterations):
        sample_idx = np.random.choice(n, 3, replace=False)
        p1, p2, p3 = points[sample_idx]
        v1 = p2 - p1
        v2 = p3 - p1
        normal = np.cross(v1, v2)
        norm = np.linalg.norm(normal)
        if norm < 1e-6:
            continue
        normal /= norm
        d = -np.dot(normal, p1)
        dists = np.abs(np.dot(points, normal) + d)
        inliers = np.where(dists < max_dist)[0]
        if len(inliers) > len(best_inliers):
            best_inliers = inliers
            best_plane = (normal, d)
    return best_plane, best_inliers

remaining_pts = pts.copy()
remaining_cols = cols.copy()

planes = []
for p_idx in range(8):
    if len(remaining_pts) < 100:
        break
    plane, inliers = find_plane_ransac(remaining_pts, max_dist=0.08, num_iterations=800)
    if plane is None or len(inliers) < 150:
        break
    normal, d = plane
    # Normalize normal direction
    if normal[1] < 0:
        normal = -normal
        d = -d
    inlier_pts = remaining_pts[inliers]
    inlier_cols = remaining_cols[inliers]
    
    # Classify plane orientation
    ny = abs(normal[1])
    nx = abs(normal[0])
    nz = abs(normal[2])
    if ny > 0.7:
        plane_type = f"Horizontal (Floor/Ceiling) [Y={-d/normal[1]:.2f}]"
    elif nx > 0.6:
        plane_type = f"Vertical (Wall X) [X={-d/normal[0]:.2f}]"
    elif nz > 0.6:
        plane_type = f"Vertical (Wall Z) [Z={-d/normal[2]:.2f}]"
    else:
        plane_type = f"Slanted (Stairs/Roof) [normal={normal.round(2)}]"
        
    print(f"Plane {p_idx+1}: {plane_type}, inliers={len(inliers)} ({len(inliers)/len(pts)*100:.1f}%), normal={normal.round(3)}, d={d:.2f}")
    planes.append((plane, inliers, plane_type))
    
    # Remove inliers
    remaining_mask = np.ones(len(remaining_pts), dtype=bool)
    remaining_mask[inliers] = False
    remaining_pts = remaining_pts[remaining_mask]
    remaining_cols = remaining_cols[remaining_mask]

print(f"Remaining non-planar points: {len(remaining_pts)}")
