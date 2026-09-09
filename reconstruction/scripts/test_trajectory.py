#!/usr/bin/env python3
import os
import glob
import cv2
import numpy as np

frames_dir = "reconstruction/frames"
frame_files = sorted(glob.glob(os.path.join(frames_dir, "*.jpg")))
print(f"Total keyframes: {len(frame_files)}")

sample = cv2.imread(frame_files[0])
h, w = sample.shape[:2]
focal_length = w * 1.15
cx, cy = w / 2.0, h / 2.0
K = np.array([[focal_length, 0, cx], [0, focal_length, cy], [0, 0, 1]], dtype=np.float64)

sift = cv2.SIFT_create(nfeatures=3000)
keypoints_list = []
descriptors_list = []
for fpath in frame_files:
    img = cv2.imread(fpath)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    kp, des = sift.detectAndCompute(gray, None)
    keypoints_list.append(kp)
    descriptors_list.append(des)

matcher = cv2.BFMatcher(cv2.NORM_L2)

step_scale = 0.14  # ~0.14m per keyframe (approx 7.14 meters over 51 frames)

# Camera poses in world frame:
# C_w: camera center in world coordinates
# R_c2w: rotation from camera frame to world frame (columns are camera axes in world)
# R_w2c: rotation from world to camera = R_c2w.T
C_w = np.zeros(3)
R_c2w = np.eye(3)

cam_centers = [C_w.copy()]
all_points = []
all_colors = []

# Match consecutive pairs AND skip-1 pairs (i, i+2) for wider baseline!
# First pass: consecutive pairs to estimate trajectory
relative_poses = [] # (R_rel, t_rel, inliers)

for i in range(len(frame_files) - 1):
    des1, des2 = descriptors_list[i], descriptors_list[i+1]
    kp1, kp2 = keypoints_list[i], keypoints_list[i+1]
    if des1 is None or des2 is None:
        relative_poses.append(None)
        continue
    
    matches = matcher.knnMatch(des1, des2, k=2)
    good = [m for m, n in matches if m.distance < 0.75 * n.distance]
    if len(good) < 15:
        relative_poses.append(None)
        continue
    
    pts1 = np.float32([kp1[m.queryIdx].pt for m in good])
    pts2 = np.float32([kp2[m.trainIdx].pt for m in good])
    
    E, mask = cv2.findEssentialMat(pts1, pts2, K, method=cv2.RANSAC, prob=0.999, threshold=2.0)
    if E is None:
        relative_poses.append(None)
        continue
    
    _, R_rel, t_rel, pose_mask = cv2.recoverPose(E, pts1, pts2, K)
    
    # Check if t_rel has negative Z (camera moved forward, so world points move backward, tz < 0)
    # Camera step in camera 1 coordinates: d = - R_rel.T @ t_rel
    # For forward motion, d[2] > 0
    d_cam1 = - R_rel.T @ t_rel
    if d_cam1[2] < 0:
        t_rel = -t_rel
        d_cam1 = -d_cam1
    
    relative_poses.append((R_rel, t_rel, good, pts1, pts2, pose_mask))
    
    # Displace camera center by d_cam1 * step_scale rotated into world coordinates
    d_world = R_c2w @ (d_cam1.flatten() * step_scale)
    C_w = C_w + d_world
    # Update rotation
    R_c2w = R_c2w @ R_rel.T
    cam_centers.append(C_w.copy())

cam_centers = np.array(cam_centers)
print(f"Computed trajectory for {len(cam_centers)} frames.")
print(f"Camera Start: {cam_centers[0]}")
print(f"Camera End:   {cam_centers[-1]}")
print(f"Total Trajectory Length: {np.sum(np.linalg.norm(np.diff(cam_centers, axis=0), axis=1)):.2f}m")
print(f"Bounding Box of Trajectory: X=[{cam_centers[:,0].min():.2f}, {cam_centers[:,0].max():.2f}], Y=[{cam_centers[:,1].min():.2f}, {cam_centers[:,1].max():.2f}], Z=[{cam_centers[:,2].min():.2f}, {cam_centers[:,2].max():.2f}]")
