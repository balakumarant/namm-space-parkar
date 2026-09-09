#!/usr/bin/env python3
import trimesh
import numpy as np

pcd = trimesh.load("reconstruction/output/pointcloud/metric_sparse.ply")
pts = pcd.vertices
cols = pcd.colors

print(f"Total vertices: {len(pts)}")
print(f"X range: {pts[:,0].min():.2f} to {pts[:,0].max():.2f}")
print(f"Y range: {pts[:,1].min():.2f} to {pts[:,1].max():.2f}")
print(f"Z range: {pts[:,2].min():.2f} to {pts[:,2].max():.2f}")

# Check Y percentiles
percentiles = [1, 5, 10, 25, 50, 75, 90, 95, 99]
y_perc = np.percentile(pts[:, 1], percentiles)
for p, val in zip(percentiles, y_perc):
    print(f"  Y p{p:02d}: {val:.2f}")

# Check X percentiles
x_perc = np.percentile(pts[:, 0], percentiles)
for p, val in zip(percentiles, x_perc):
    print(f"  X p{p:02d}: {val:.2f}")
