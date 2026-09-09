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

sift = cv2.SIFT_create(nfeatures=2000)
img1 = cv2.imread(frame_files[0])
img2 = cv2.imread(frame_files[1])
kp1, des1 = sift.detectAndCompute(cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY), None)
kp2, des2 = sift.detectAndCompute(cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY), None)

matcher = cv2.BFMatcher(cv2.NORM_L2)
matches = matcher.knnMatch(des1, des2, k=2)
good = [m for m, n in matches if m.distance < 0.75 * n.distance]
print(f"Good matches between frame 0 and 1: {len(good)}")

pts1 = np.float32([kp1[m.queryIdx].pt for m in good])
pts2 = np.float32([kp2[m.trainIdx].pt for m in good])

E, mask = cv2.findEssentialMat(pts1, pts2, K, method=cv2.RANSAC, prob=0.999, threshold=2.0)
inliers = int(np.sum(mask))
print(f"Inliers: {inliers}")

_, R_rel, t_rel, pose_mask = cv2.recoverPose(E, pts1, pts2, K)
print(f"R_rel:\n{R_rel}")
print(f"t_rel:\n{t_rel}")

# Scale t_rel by step_scale = 0.15m
step_scale = 0.15
t_metric = t_rel * step_scale

P1 = K @ np.hstack((np.eye(3), np.zeros((3, 1))))
P2 = K @ np.hstack((R_rel, t_metric))

val = (pose_mask.ravel() > 0)
pts1_in = pts1[val]
pts2_in = pts2[val]

pts4d = cv2.triangulatePoints(P1, P2, pts1_in.T, pts2_in.T)
w_coord = pts4d[3:4, :]
pts3d = pts4d[:3, :] / np.where(np.abs(w_coord) > 1e-6, w_coord, 1e-6)

print(f"pts3d shape: {pts3d.shape}")
print(f"Z stats: min={pts3d[2].min():.3f}, max={pts3d[2].max():.3f}, median={np.median(pts3d[2]):.3f}")
print(f"Number of points with Z in (0.3, 20): {np.sum((pts3d[2] > 0.3) & (pts3d[2] < 20))}")

# Check reprojection error
pts1_reproj, _ = cv2.projectPoints(pts3d.T, np.zeros(3), np.zeros(3), K, None)
pts1_reproj = pts1_reproj.squeeze()
err1 = np.linalg.norm(pts1_in - pts1_reproj, axis=1)
print(f"Reprojection error in cam 1: mean={np.mean(err1):.2f}px, median={np.median(err1):.2f}px")

rvec, _ = cv2.Rodrigues(R_rel)
pts2_reproj, _ = cv2.projectPoints(pts3d.T, rvec, t_metric.squeeze(), K, None)
pts2_reproj = pts2_reproj.squeeze()
err2 = np.linalg.norm(pts2_in - pts2_reproj, axis=1)
print(f"Reprojection error in cam 2: mean={np.mean(err2):.2f}px, median={np.median(err2):.2f}px")
