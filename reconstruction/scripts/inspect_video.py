import cv2
import os
import json
import numpy as np

def inspect_video(video_path: str, output_frames_dir: str = "reconstruction/input/inspection_frames"):
    if not os.path.exists(video_path):
        print(f"Error: Video file {video_path} not found.")
        return None

    file_size_bytes = os.path.getsize(video_path)
    file_size_mb = file_size_bytes / (1024 * 1024)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: Could not open {video_path}")
        return None

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fourcc_int = int(cap.get(cv2.CAP_PROP_FOURCC))
    fourcc_str = "".join([chr((fourcc_int >> 8 * i) & 0xFF) for i in range(4)])
    
    duration = total_frames / fps if fps > 0 else 0

    os.makedirs(output_frames_dir, exist_ok=True)

    # Sampling for metrics: sample every N frames or up to 200 frames across the video
    sample_step = max(1, total_frames // 150)
    
    sharpness_scores = []
    brightness_scores = []
    hist_diffs = []
    motion_vectors = []
    cuts = []

    prev_gray = None
    prev_hist = None
    frame_idx = 0
    sampled_count = 0

    # Representative frames to extract: 6 evenly spaced points (0%, 20%, 40%, 60%, 80%, 95%)
    extract_indices = [int(total_frames * p) for p in [0.05, 0.20, 0.40, 0.60, 0.80, 0.95]]
    extracted_frames = []

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Check if this frame should be saved as representative
        if frame_idx in extract_indices:
            frame_name = f"rep_frame_{frame_idx:05d}.jpg"
            frame_out_path = os.path.join(output_frames_dir, frame_name)
            cv2.imwrite(frame_out_path, frame)
            extracted_frames.append({
                "frame_idx": frame_idx,
                "timestamp_sec": round(frame_idx / fps, 2) if fps > 0 else 0,
                "path": frame_out_path
            })

        # Metric sampling
        if frame_idx % sample_step == 0:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # Sharpness (Laplacian variance)
            lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            sharpness_scores.append(lap_var)

            # Brightness (mean pixel intensity)
            brightness = np.mean(gray)
            brightness_scores.append(brightness)

            # Color histogram for scene cut detection
            hist = cv2.calcHist([frame], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256])
            cv2.normalize(hist, hist)

            if prev_hist is not None:
                # Correlation comparison: 1.0 is identical, < 0.4 usually indicates a cut
                corr = cv2.compareHist(prev_hist, hist, cv2.HISTCMP_CORREL)
                hist_diffs.append(corr)
                if corr < 0.45:
                    cuts.append({"frame": frame_idx, "time_sec": round(frame_idx / fps, 2), "correlation": round(corr, 3)})

            # Optical flow motion estimation on downsampled image for high speed
            if prev_gray is not None:
                small_prev = cv2.resize(prev_gray, (320, 180), interpolation=cv2.INTER_AREA)
                small_gray = cv2.resize(gray, (320, 180), interpolation=cv2.INTER_AREA)
                flow = cv2.calcOpticalFlowFarneback(small_prev, small_gray, None, 0.5, 2, 9, 2, 5, 1.1, 0)
                mag, ang = cv2.cartToPolar(flow[..., 0], flow[..., 1])
                mean_flow = np.mean(mag)
                mean_dx = np.mean(flow[..., 0])
                mean_dy = np.mean(flow[..., 1])
                motion_vectors.append({"dx": float(mean_dx), "dy": float(mean_dy), "magnitude": float(mean_flow)})

            prev_gray = gray
            prev_hist = hist
            sampled_count += 1

        frame_idx += 1

    cap.release()

    # Aggregate statistics
    avg_sharpness = np.mean(sharpness_scores) if sharpness_scores else 0
    min_sharpness = np.min(sharpness_scores) if sharpness_scores else 0
    max_sharpness = np.max(sharpness_scores) if sharpness_scores else 0
    low_sharpness_pct = (np.sum(np.array(sharpness_scores) < 50.0) / len(sharpness_scores) * 100) if sharpness_scores else 0

    avg_brightness = np.mean(brightness_scores) if brightness_scores else 0
    std_brightness = np.std(brightness_scores) if brightness_scores else 0
    min_brightness = np.min(brightness_scores) if brightness_scores else 0
    max_brightness = np.max(brightness_scores) if brightness_scores else 0

    avg_motion = np.mean([m["magnitude"] for m in motion_vectors]) if motion_vectors else 0
    avg_dx = np.mean([m["dx"] for m in motion_vectors]) if motion_vectors else 0
    avg_dy = np.mean([m["dy"] for m in motion_vectors]) if motion_vectors else 0

    results = {
        "filename": os.path.basename(video_path),
        "filepath": video_path,
        "file_size_bytes": file_size_bytes,
        "file_size_mb": round(file_size_mb, 2),
        "format": os.path.splitext(video_path)[1].lower(),
        "fourcc": fourcc_str,
        "duration_seconds": round(duration, 2),
        "resolution": {"width": width, "height": height, "aspect_ratio": f"{width}:{height}"},
        "fps": round(fps, 2),
        "total_frames": total_frames,
        "sharpness": {
            "average": round(float(avg_sharpness), 2),
            "min": round(float(min_sharpness), 2),
            "max": round(float(max_sharpness), 2),
            "pct_blurry_under_50": round(float(low_sharpness_pct), 1)
        },
        "lighting": {
            "average_brightness": round(float(avg_brightness), 2),
            "std_dev_brightness": round(float(std_brightness), 2),
            "min_brightness": round(float(min_brightness), 2),
            "max_brightness": round(float(max_brightness), 2)
        },
        "motion": {
            "average_flow_magnitude": round(float(avg_motion), 2),
            "mean_dx": round(float(avg_dx), 2),
            "mean_dy": round(float(avg_dy), 2),
            "detected_cuts_count": len(cuts),
            "cuts": cuts
        },
        "extracted_representative_frames": extracted_frames
    }

    print(json.dumps(results, indent=2))
    return results

if __name__ == "__main__":
    import sys
    target = sys.argv[1] if len(sys.argv) > 1 else "reconstruction/input/Screen Recording 2026-09-09 002610.mp4"
    inspect_video(target)
