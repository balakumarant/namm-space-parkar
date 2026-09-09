#!/usr/bin/env python3
import os
import glob
import cv2
import numpy as np

frames_dir = "reconstruction/frames"
frame_files = sorted(glob.glob(os.path.join(frames_dir, "*.jpg")))

sample = cv2.imread(frame_files[0])
h, w = sample.shape[:2]
focal_length = w * 1.15
cx, cy = w / 2.0, h / 2.0
K = np.array([[focal_length, 0, cx], [0, focal_length, cy], [0, 0, 1]], dtype=np.float64)

sift = cv2.SIFT_create(nfeatures=4000)
keypoints_list = []
descriptors_list = []
for fpath in frame_files:
    img = cv2.imread(fpath)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    kp, des = sift.detectAndCompute(gray, None)
    keypoints_list.append(kp)
    descriptors_list.append(des)

matcher = cv2.BFMatcher(cv2.NORM_L2)
step_scale = 0.14

# 1. Compute trajectory
C_w = np.zeros(3)
R_c2w = np.eye(3)

cam_centers = [C_w.copy()]
cam_rotations = [R_c2w.copy()]

for i in range(len(frame_files) - 1):
    des1, des2 = descriptors_list[i], descriptors_list[i+1]
    kp1, kp2 = keypoints_list[i], keypoints_list[i+1]
    if des1 is None or des2 is None:
        continue
    
    matches = matcher.knnMatch(des1, des2, k=2)
    good = [m for m, n in matches if m.distance < 0.75 * n.distance]
    if len(good) < 15:
        continue
    
    pts1 = np.float32([kp1[m.queryIdx].pt for m in good])
    pts2 = np.float32([kp2[m.trainIdx].pt for m in good])
    
    E, mask = cv2.findEssentialMat(pts1, pts2, K, method=cv2.RANSAC, prob=0.999, threshold=2.0)
    if E is None:
        continue
    
    _, R_rel, t_rel, pose_mask = cv2.recoverPose(E, pts1, pts2, K)
    
    d_cam1 = - R_rel.T @ t_rel
    if d_cam1[2] < 0:
        t_rel = -t_rel
        d_cam1 = -d_cam1
    
    d_world = R_c2w @ (d_cam1.flatten() * step_scale)
    C_w = C_w + d_world
    R_c2w = R_c2w @ R_rel.T
    
    cam_centers.append(C_w.copy())
    cam_rotations.append(R_c2w.copy())

# 2. Triangulate across frame pairs (step 1, step 2, step 3 for wider baseline)
all_pts3d = []
all_colors = []

P_matrices = []
for i in range(len(cam_centers)):
    R_w2c = cam_rotations[i].T
    C_i = cam_centers[i]
    t_w2c = -R_w2c @ C_i
    P = K @ np.hstack((R_w2c, t_w2c.reshape(3, 1)))
    P_matrices.append(P)

for delta in [1, 2, 3]:
    for i in range(0, len(cam_centers) - delta):
        j = i + delta
        des1, des2 = descriptors_list[i], descriptors_list[j]
        kp1, kp2 = keypoints_list[i], keypoints_list[j]
        if des1 is None or des2 is None:
            continue
        
        matches = matcher.knnMatch(des1, des2, k=2)
        good = [m for m, n in matches if m.distance < 0.72 * n.distance]
        if len(good) < 10:
            continue
        
        pts1 = np.float32([kp1[m.queryIdx].pt for m in good])
        pts2 = np.float32([kp2[m.trainIdx].pt for m in good])
        
        # Fundamental matrix check
        F, mask = cv2.findFundamentalMat(pts1, pts2, cv2.FM_RANSAC, 1.5, 0.99)
        if F is None or mask is None:
            continue
        
        inliers = (mask.ravel() > 0)
        if np.sum(inliers) < 8:
            continue
        
        pts1_in = pts1[inliers]
        pts2_in = pts2[inliers]
        
        pts4d = cv2.triangulatePoints(P_matrices[i], P_matrices[j], pts1_in.T, pts2_in.T)
        w_coord = pts4d[3:4, :]
        pts3d = pts4d[:3, :] / np.where(np.abs(w_coord) > 1e-6, w_coord, 1e-6)
        
        # Validation checks
        R_w2c_i = cam_rotations[i].T
        C_i = cam_centers[i]
        R_w2c_j = cam_rotations[j].T
        C_j = cam_centers[j]
        
        # In cam i coords
        p_ci = R_w2c_i @ (pts3d - C_i.reshape(3, 1))
        # In cam j coords
        p_cj = R_w2c_j @ (pts3d - C_j.reshape(3, 1))
        
        depth_ok = (p_ci[2] > 0.4) & (p_ci[2] < 15.0) & (p_cj[2] > 0.4) & (p_cj[2] < 15.0)
        
        # Reprojection error in cam i
        rvec_i, _ = cv2.Rodrigues(R_w2c_i)
        tvec_i = -R_w2c_i @ C_i
        proj_i, _ = cv2.projectPoints(pts3d.T, rvec_i, tvec_i, K, None)
        proj_i = proj_i.squeeze()
        err_i = np.linalg.norm(pts1_in - proj_i, axis=1)
        
        rvec_j, _ = cv2.Rodrigues(R_w2c_j)
        tvec_j = -R_w2c_j @ C_j
        proj_j, _ = cv2.projectPoints(pts3d.T, rvec_j, tvec_j, K, None)
        proj_j = proj_j.squeeze()
        err_j = np.linalg.norm(pts2_in - proj_j, axis=1)
        
        reproj_ok = (err_i < 2.5) & (err_j < 2.5)
        
        # Parallax angle check (at least 0.8 degrees)
        v_i = pts3d - C_i.reshape(3, 1)
        v_j = pts3d - C_j.reshape(3, 1)
        cos_ang = np.sum(v_i * v_j, axis=0) / (np.linalg.norm(v_i, axis=0) * np.linalg.norm(v_j, axis=0) + 1e-6)
        ang_ok = (cos_ang < np.cos(np.radians(0.8)))
        
        valid = depth_ok & reproj_ok & ang_ok
        if np.sum(valid) > 0:
            valid_pts = pts3d[:, valid].T
            all_pts3d.append(valid_pts)
            
            img_i = cv2.imread(frame_files[i])
            uv = pts1_in[valid].astype(int)
            uv[:, 0] = np.clip(uv[:, 0], 0, w - 1)
            uv[:, 1] = np.clip(uv[:, 1], 0, h - 1)
            cols = img_i[uv[:, 1], uv[:, 0], ::-1]
            all_colors.append(cols)

total_pts = np.vstack(all_pts3d)
total_cols = np.vstack(all_colors)

print(f"\nTriangulation complete!")
print(f"Total Triangulated Points: {len(total_pts):,}")
print(f"Point Cloud Bounds:")
print(f"  X: [{total_pts[:,0].min():.2f}, {total_pts[:,0].max():.2f}] (span = {total_pts[:,0].max()-total_pts[:,0].min():.2f}m)")
print(f"  Y: [{total_pts[:,1].min():.2f}, {total_pts[:,1].max():.2f}] (span = {total_pts[:,1].max()-total_pts[:,1].min():.2f}m)")
print(f"  Z: [{total_pts[:,2].min():.2f}, {total_pts[:,2].max():.2f}] (span = {total_pts[:,2].max()-total_pts[:,2].min():.2f}m)")

import trimesh
pcd = trimesh.points.PointCloud(vertices=total_pts, colors=total_cols)
pcd.export("reconstruction/output/pointcloud/metric_sparse.ply")
print("Saved metric_sparse.ply successfully!")
