#!/usr/bin/env python3
import trimesh
import numpy as np

pcd_sparse = trimesh.load("reconstruction/output/pointcloud/metric_sparse.ply")
pcd_dense = trimesh.load("reconstruction/output/pointcloud/metric_dense.ply")
pts = np.vstack([pcd_sparse.vertices, pcd_dense.vertices])
cols = np.vstack([pcd_sparse.colors[:, :3], pcd_dense.colors[:, :3]])

# Transform to Three.js space:
# X: right
# Y: up (floor at Y = 0)
# Z: forward
pts_three = np.zeros_like(pts)
pts_three[:, 0] = pts[:, 0]
pts_three[:, 1] = -pts[:, 1] + 0.08
pts_three[:, 2] = pts[:, 2]

# 1. Floor: points with Y near 0.0
floor_mask = (pts_three[:, 1] >= -0.15) & (pts_three[:, 1] <= 0.20)
pts_f = pts_three[floor_mask]
print(f"Floor points: {len(pts_f)}")
print(f"  X span: [{pts_f[:,0].min():.2f}, {pts_f[:,0].max():.2f}] (width = {pts_f[:,0].max()-pts_f[:,0].min():.2f}m)")
print(f"  Z span: [{pts_f[:,2].min():.2f}, {pts_f[:,2].max():.2f}] (length = {pts_f[:,2].max()-pts_f[:,2].min():.2f}m)")

# 2. West Wall / Fireplace: points with X < -0.6
west_mask = (pts_three[:, 0] < -0.6) & (pts_three[:, 1] > 0.2)
pts_w = pts_three[west_mask]
print(f"West wall points: {len(pts_w)}")
if len(pts_w) > 0:
    print(f"  X median: {np.median(pts_w[:,0]):.2f}m (range: [{pts_w[:,0].min():.2f}, {pts_w[:,0].max():.2f}])")
    print(f"  Y range:  [{pts_w[:,1].min():.2f}, {pts_w[:,1].max():.2f}]")
    print(f"  Z range:  [{pts_w[:,2].min():.2f}, {pts_w[:,2].max():.2f}]")

# 3. East Wall / Dining: points with X > 0.6
east_mask = (pts_three[:, 0] > 0.6) & (pts_three[:, 1] > 0.2)
pts_e = pts_three[east_mask]
print(f"East wall / structure points: {len(pts_e)}")
if len(pts_e) > 0:
    print(f"  X median: {np.median(pts_e[:,0]):.2f}m (range: [{pts_e[:,0].min():.2f}, {pts_e[:,0].max():.2f}])")
    print(f"  Y range:  [{pts_e[:,1].min():.2f}, {pts_e[:,1].max():.2f}]")
    print(f"  Z range:  [{pts_e[:,2].min():.2f}, {pts_e[:,2].max():.2f}]")

# 4. North Wall (rear windows): points with Z > 10.0
north_mask = (pts_three[:, 2] > 10.0) & (pts_three[:, 1] > 0.2)
pts_n = pts_three[north_mask]
print(f"North end points: {len(pts_n)}")
if len(pts_n) > 0:
    print(f"  Z median: {np.median(pts_n[:,2]):.2f}m (range: [{pts_n[:,2].min():.2f}, {pts_n[:,2].max():.2f}])")
    print(f"  X range:  [{pts_n[:,0].min():.2f}, {pts_n[:,0].max():.2f}]")
    print(f"  Y range:  [{pts_n[:,1].min():.2f}, {pts_n[:,1].max():.2f}]")
