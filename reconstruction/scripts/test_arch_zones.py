#!/usr/bin/env python3
import trimesh
import numpy as np

pcd_sparse = trimesh.load("reconstruction/output/pointcloud/metric_sparse.ply")
pcd_dense = trimesh.load("reconstruction/output/pointcloud/metric_dense.ply")
pts = np.vstack([pcd_sparse.vertices, pcd_dense.vertices])
cols = np.vstack([pcd_sparse.colors[:, :3], pcd_dense.colors[:, :3]])

print(f"Total points: {len(pts)}")

# Coordinate transformation to Three.js convention:
# In Three.js:
# X: right
# Y: up (floor is at Y = 0, camera is at Y = 1.6m eye height)
# Z: forward (+Z or -Z)
# In OpenCV:
# X_cv: right
# Y_cv: down (+Y is down towards floor)
# Z_cv: forward
# So:
# X_three = X_cv
# Y_three = -Y_cv + 0.10 (so floor is at Y = 0.0m)
# Z_three = Z_cv

pts_three = np.zeros_like(pts)
pts_three[:, 0] = pts[:, 0]
pts_three[:, 1] = -pts[:, 1] + 0.08  # shift floor to Y = 0.0
pts_three[:, 2] = pts[:, 2]

print("Three.js space bounds:")
print(f"  X: [{pts_three[:,0].min():.2f}, {pts_three[:,0].max():.2f}]")
print(f"  Y: [{pts_three[:,1].min():.2f}, {pts_three[:,1].max():.2f}]")
print(f"  Z: [{pts_three[:,2].min():.2f}, {pts_three[:,2].max():.2f}]")

# Check floor points (Y near 0.0)
floor_pts = pts_three[(pts_three[:, 1] >= -0.15) & (pts_three[:, 1] <= 0.20)]
print(f"Floor points (Y in [-0.15, 0.20]): {len(floor_pts)}")
print(f"  Floor X bounds: [{floor_pts[:,0].min():.2f}, {floor_pts[:,0].max():.2f}]")
print(f"  Floor Z bounds: [{floor_pts[:,2].min():.2f}, {floor_pts[:,2].max():.2f}]")

# Check staircase points (right side of foyer: X > 0.6, Z in [2.5, 6.5], Y in [0.2, 1.6])
stair_pts = pts_three[(pts_three[:, 0] >= 0.6) & (pts_three[:, 2] >= 2.5) & (pts_three[:, 2] <= 6.5) & (pts_three[:, 1] > 0.15)]
print(f"Staircase points: {len(stair_pts)}")

# Check west wall / fireplace points (X < -0.8, Y > 0.2)
west_pts = pts_three[(pts_three[:, 0] <= -0.8) & (pts_three[:, 1] > 0.15)]
print(f"West wall / fireplace points: {len(west_pts)}")

# Check east wall / dining points (X > 0.6, Z > 6.5, Y > 0.15)
east_pts = pts_three[(pts_three[:, 0] >= 0.6) & (pts_three[:, 2] > 6.5) & (pts_three[:, 1] > 0.15)]
print(f"East wall / dining points: {len(east_pts)}")

# Check ceiling points (Y > 1.2)
ceil_pts = pts_three[pts_three[:, 1] >= 1.2]
print(f"Ceiling points: {len(ceil_pts)}")
