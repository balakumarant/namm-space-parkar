#!/usr/bin/env python3
import os
import glob
import cv2
import numpy as np
import trimesh

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

# 1. Recover trajectory from SIFT
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

P_matrices = []
for i in range(len(cam_centers)):
    R_w2c = cam_rotations[i].T
    C_i = cam_centers[i]
    t_w2c = -R_w2c @ C_i
    P = K @ np.hstack((R_w2c, t_w2c.reshape(3, 1)))
    P_matrices.append(P)

print("Trajectory computed. Now running dense multi-view tracking (Shi-Tomasi + KLT optical flow)...")

# 2. Dense tracking with Shi-Tomasi corners and KLT forward-backward tracking
all_pts3d = []
all_colors = []

# Parameters for Shi-Tomasi
feature_params = dict(maxCorners=4000, qualityLevel=0.01, minDistance=8, blockSize=7)
# Parameters for Lucas-Kanade optical flow
lk_params = dict(winSize=(21, 21), maxLevel=3, criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, 0.01))

for i in range(0, len(cam_centers) - 2, 1):
    j = i + 2  # Baseline of 2 frames (~0.28m) for solid triangulation parallax
    
    img_i = cv2.imread(frame_files[i])
    img_j = cv2.imread(frame_files[j])
    gray_i = cv2.cvtColor(img_i, cv2.COLOR_BGR2GRAY)
    gray_j = cv2.cvtColor(img_j, cv2.COLOR_BGR2GRAY)
    
    # Detect dense corners in image i
    p0 = cv2.goodFeaturesToTrack(gray_i, mask=None, **feature_params)
    if p0 is None or len(p0) < 20:
        continue
    
    # Forward tracking i -> j
    p1, st, err = cv2.calcOpticalFlowPyrLK(gray_i, gray_j, p0, None, **lk_params)
    # Backward tracking j -> i for cyclic verification
    p0_back, st_back, err_back = cv2.calcOpticalFlowPyrLK(gray_j, gray_i, p1, None, **lk_params)
    
    # Distance between original p0 and back-tracked p0_back
    fb_dist = np.linalg.norm(p0 - p0_back, axis=2).ravel()
    
    valid_lk = (st.ravel() == 1) & (st_back.ravel() == 1) & (fb_dist < 1.0)
    if np.sum(valid_lk) < 20:
        continue
    
    pts1_valid = p0[valid_lk].reshape(-1, 2)
    pts2_valid = p1[valid_lk].reshape(-1, 2)
    
    # Fundamental matrix RANSAC check to remove moving objects or occlusions
    F, f_mask = cv2.findFundamentalMat(pts1_valid, pts2_valid, cv2.FM_RANSAC, 1.5, 0.99)
    if F is None or f_mask is None:
        continue
    
    inliers = (f_mask.ravel() > 0)
    if np.sum(inliers) < 15:
        continue
    
    pts1_in = pts1_valid[inliers]
    pts2_in = pts2_valid[inliers]
    
    # Triangulate
    pts4d = cv2.triangulatePoints(P_matrices[i], P_matrices[j], pts1_in.T, pts2_in.T)
    w_coord = pts4d[3:4, :]
    pts3d = pts4d[:3, :] / np.where(np.abs(w_coord) > 1e-6, w_coord, 1e-6)
    
    # Validation checks
    R_w2c_i = cam_rotations[i].T
    C_i = cam_centers[i]
    R_w2c_j = cam_rotations[j].T
    C_j = cam_centers[j]
    
    p_ci = R_w2c_i @ (pts3d - C_i.reshape(3, 1))
    p_cj = R_w2c_j @ (pts3d - C_j.reshape(3, 1))
    
    depth_ok = (p_ci[2] > 0.4) & (p_ci[2] < 12.0) & (p_cj[2] > 0.4) & (p_cj[2] < 12.0)
    
    # Reprojection error in cam i and j
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
    
    reproj_ok = (err_i < 2.0) & (err_j < 2.0)
    
    # Parallax angle (at least 0.6 deg)
    v_i = pts3d - C_i.reshape(3, 1)
    v_j = pts3d - C_j.reshape(3, 1)
    cos_ang = np.sum(v_i * v_j, axis=0) / (np.linalg.norm(v_i, axis=0) * np.linalg.norm(v_j, axis=0) + 1e-6)
    ang_ok = (cos_ang < np.cos(np.radians(0.6)))
    
    valid = depth_ok & reproj_ok & ang_ok
    if np.sum(valid) > 0:
        valid_pts = pts3d[:, valid].T
        all_pts3d.append(valid_pts)
        
        uv = pts1_in[valid].astype(int)
        uv[:, 0] = np.clip(uv[:, 0], 0, w - 1)
        uv[:, 1] = np.clip(uv[:, 1], 0, h - 1)
        cols = img_i[uv[:, 1], uv[:, 0], ::-1]
        all_colors.append(cols)

dense_pts = np.vstack(all_pts3d)
dense_cols = np.vstack(all_colors)

print(f"\nDense Optical Flow Triangulation complete!")
print(f"Total Dense 3D Points: {len(dense_pts):,}")
print(f"Point Cloud Bounds:")
print(f"  X: [{dense_pts[:,0].min():.2f}, {dense_pts[:,0].max():.2f}] (span = {dense_pts[:,0].max()-dense_pts[:,0].min():.2f}m)")
print(f"  Y: [{dense_pts[:,1].min():.2f}, {dense_pts[:,1].max():.2f}] (span = {dense_pts[:,1].max()-dense_pts[:,1].min():.2f}m)")
print(f"  Z: [{dense_pts[:,2].min():.2f}, {dense_pts[:,2].max():.2f}] (span = {dense_pts[:,2].max()-dense_pts[:,2].min():.2f}m)")

dense_ply = "reconstruction/output/pointcloud/metric_dense.ply"
pcd = trimesh.points.PointCloud(vertices=dense_pts, colors=dense_cols)
pcd.export(dense_ply)
print(f"Saved {dense_ply} successfully!")
