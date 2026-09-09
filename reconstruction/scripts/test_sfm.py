#!/usr/bin/env python3
import os
import glob
import cv2
import numpy as np

frames_dir = "reconstruction/frames"
frame_files = sorted(glob.glob(os.path.join(frames_dir, "*.jpg")))
print(f"Found {len(frame_files)} frames.")

# Camera Intrinsics
sample = cv2.imread(frame_files[0])
h, w = sample.shape[:2]
focal_length = w * 1.15
cx, cy = w / 2.0, h / 2.0
K = np.array([[focal_length, 0, cx], [0, focal_length, cy], [0, 0, 1]], dtype=np.float64)

# SIFT features
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

# Multi-view SfM
step_scale = 0.15 # ~15cm per frame

R_list = [np.eye(3)]
C_list = [np.zeros((3, 1))]
P_list = [K @ np.hstack((np.eye(3), np.zeros((3, 1))))]

all_pts3d = []
all_colors = []

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
    
    # Ensure forward motion along camera Z
    t_step = t_rel * step_scale
    if t_step[2] < 0: # If recovered translation has negative Z (backward), invert
        t_step = -t_step
        
    R_prev = R_list[-1]
    C_prev = C_list[-1]
    
    # In camera coordinates:
    # Camera next rotation: R_next = R_rel @ R_prev
    R_next = R_rel @ R_prev
    # Camera next position in world coordinates:
    delta_C = - R_prev.T @ (R_rel.T @ t_step)
    C_next = C_prev + delta_C
    
    R_list.append(R_next)
    C_list.append(C_next)
    
    P_prev = P_list[-1]
    P_next = K @ np.hstack((R_next, -R_next @ C_next))
    P_list.append(P_next)
    
    # Triangulate
    inliers = (pose_mask.ravel() > 0)
    if np.sum(inliers) > 0:
        pts1_in = pts1[inliers]
        pts2_in = pts2[inliers]
        
        pts4d = cv2.triangulatePoints(P_prev, P_next, pts1_in.T, pts2_in.T)
        w_coord = pts4d[3:4, :]
        pts3d = pts4d[:3, :] / np.where(np.abs(w_coord) > 1e-6, w_coord, 1e-6)
        
        # Check depth in both cameras
        pts_c_prev = R_prev @ (pts3d - C_prev)
        pts_c_next = R_next @ (pts3d - C_next)
        
        valid = (pts_c_prev[2] > 0.3) & (pts_c_prev[2] < 30.0) & (pts_c_next[2] > 0.3) & (pts_c_next[2] < 30.0)
        
        # Parallax angle check
        v1 = pts3d - C_prev
        v2 = pts3d - C_next
        len1 = np.linalg.norm(v1, axis=0) + 1e-6
        len2 = np.linalg.norm(v2, axis=0) + 1e-6
        cos_ang = np.sum(v1 * v2, axis=0) / (len1 * len2)
        valid = valid & (cos_ang < np.cos(np.radians(0.5)))
        
        valid_pts = pts3d[:, valid].T
        if len(valid_pts) > 0:
            all_pts3d.append(valid_pts)
            img1 = cv2.imread(frame_files[i])
            uv = pts1_in[valid].astype(int)
            uv[:, 0] = np.clip(uv[:, 0], 0, w - 1)
            uv[:, 1] = np.clip(uv[:, 1], 0, h - 1)
            col = img1[uv[:, 1], uv[:, 0], ::-1]
            all_colors.append(col)

pts = np.vstack(all_pts3d)
cols = np.vstack(all_colors)
print(f"Triangulated {len(pts)} 3D points.")
print(f"Bounds X: [{pts[:,0].min():.2f}, {pts[:,0].max():.2f}]")
print(f"Bounds Y: [{pts[:,1].min():.2f}, {pts[:,1].max():.2f}]")
print(f"Bounds Z: [{pts[:,2].min():.2f}, {pts[:,2].max():.2f}]")
C_arr = np.hstack(C_list)
print(f"Camera start: {C_arr[:,0]}")
print(f"Camera end:   {C_arr[:,-1]}")
print(f"Camera extent: X={C_arr[0].max()-C_arr[0].min():.2f}, Y={C_arr[1].max()-C_arr[1].min():.2f}, Z={C_arr[2].max()-C_arr[2].min():.2f}")
