#!/usr/bin/env python3
"""
Video Frame Extraction & Quality Filtering for Indoor 3D Reconstruction.
Extracts sharp, representative keyframes from smartphone indoor walkthrough videos.
Filters blurry frames using Laplacian variance and prevents redundant over-sampling.
Supports segment bounding (--start-frame, --end-frame) to prevent crossing scene cuts.
"""

import os
import sys
import glob
import json
import argparse
import cv2
import numpy as np
from pathlib import Path

def extract_frames(
    video_path: str,
    output_dir: str = "reconstruction/frames",
    target_fps: float = 2.7,
    max_frames: int = 60,
    min_sharpness: float = 35.0,
    start_frame: int = 0,
    end_frame: int = 560,
    resize_dims: tuple = None,
    clean_output: bool = True
) -> dict:
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Input video not found: {video_path}")

    # Create / clean destination directory
    os.makedirs(output_dir, exist_ok=True)
    if clean_output:
        for old_frame in glob.glob(os.path.join(output_dir, "frame_*.jpg")):
            try:
                os.remove(old_frame)
            except Exception:
                pass

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Failed to open video file: {video_path}")

    video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_video_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    video_duration = total_video_frames / video_fps if video_fps > 0 else 0

    actual_end_frame = min(end_frame if end_frame > 0 else total_video_frames - 1, total_video_frames - 1)
    segment_frame_count = max(1, actual_end_frame - start_frame + 1)
    segment_duration = segment_frame_count / video_fps

    # Calculate frame step based on target FPS
    frame_step = max(1, int(round(video_fps / target_fps)))

    print("=" * 65)
    print("PARKAR INDOOR FRAME EXTRACTION (PHASE 5A.2)")
    print("=" * 65)
    print(f"Input Video:        {video_path}")
    print(f"Total Video Frames: {total_video_frames} ({video_duration:.2f}s @ {video_fps:.1f} fps)")
    print(f"Extraction Range:   Frames {start_frame} to {actual_end_frame} ({segment_duration:.2f}s, Segment 1)")
    print(f"Target Extr. FPS:   {target_fps:.1f} (sampling every {frame_step} frames)")
    print(f"Max Frame Budget:   {max_frames}")
    print(f"Min Sharpness:      {min_sharpness} (Laplacian variance threshold)")
    print(f"Target Resolution:  {'Native' if not resize_dims else f'{resize_dims[0]}x{resize_dims[1]}'}")
    print(f"Output Directory:   {output_dir}")
    print("-" * 65)

    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
    frame_idx = start_frame
    saved_count = 0
    skipped_blur_count = 0
    skipped_interval_count = 0
    sharpness_scores = []
    saved_frame_paths = []
    saved_frame_metadata = []

    while frame_idx <= actual_end_frame and saved_count < max_frames:
        ret, frame = cap.read()
        if not ret:
            break

        # Check interval sampling
        if (frame_idx - start_frame) % frame_step != 0:
            skipped_interval_count += 1
            frame_idx += 1
            continue

        # Optional resize
        if resize_dims and (frame.shape[1] != resize_dims[0] or frame.shape[0] != resize_dims[1]):
            frame_processed = cv2.resize(frame, resize_dims, interpolation=cv2.INTER_AREA)
        else:
            frame_processed = frame

        # Compute blur / sharpness metric using Laplacian variance
        gray = cv2.cvtColor(frame_processed, cv2.COLOR_BGR2GRAY)
        sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())

        if sharpness < min_sharpness:
            skipped_blur_count += 1
            frame_idx += 1
            continue

        # Save valid sharp keyframe
        saved_count += 1
        frame_filename = f"frame_{saved_count:04d}.jpg"
        save_path = os.path.join(output_dir, frame_filename)
        cv2.imwrite(save_path, frame_processed, [cv2.IMWRITE_JPEG_QUALITY, 95])

        timestamp_sec = round(frame_idx / video_fps, 2)
        sharpness_scores.append(sharpness)
        saved_frame_paths.append(save_path)
        saved_frame_metadata.append({
            "frame_file": frame_filename,
            "source_frame_idx": frame_idx,
            "timestamp_sec": timestamp_sec,
            "sharpness": round(sharpness, 2)
        })

        if saved_count % 10 == 0 or saved_count == 1:
            print(f"  [SAVED] {frame_filename} (source frame #{frame_idx}, t={timestamp_sec:.2f}s, sharpness: {sharpness:.1f})")

        frame_idx += 1

    cap.release()

    avg_sharpness = float(np.mean(sharpness_scores)) if sharpness_scores else 0.0
    min_sharp = float(np.min(sharpness_scores)) if sharpness_scores else 0.0
    max_sharp = float(np.max(sharpness_scores)) if sharpness_scores else 0.0

    metadata = {
        "source_video": video_path,
        "total_source_frames": total_video_frames,
        "source_fps": video_fps,
        "segment": {
            "start_frame": start_frame,
            "end_frame": actual_end_frame,
            "segment_duration_seconds": round(segment_duration, 2)
        },
        "sampling": {
            "target_fps": target_fps,
            "frame_step": frame_step,
            "min_sharpness_threshold": min_sharpness,
            "max_frames_budget": max_frames
        },
        "frames_extracted": saved_count,
        "frames_skipped_blur": skipped_blur_count,
        "frames_skipped_interval": skipped_interval_count,
        "average_sharpness": round(avg_sharpness, 2),
        "sharpness_stats": {
            "average": round(avg_sharpness, 2),
            "min": round(min_sharp, 2),
            "max": round(max_sharp, 2)
        },
        "frame_width": frame_processed.shape[1] if saved_count > 0 else 0,
        "frame_height": frame_processed.shape[0] if saved_count > 0 else 0,
        "extracted_frames": saved_frame_metadata
    }

    metadata_path = os.path.join(output_dir, "extraction_metadata.json")
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print("-" * 65)
    print(f"[SUMMARY] Successfully extracted {saved_count} sharp keyframes.")
    print(f"          Frame Range: #{start_frame} to #{actual_end_frame} (Segment 1 only)")
    print(f"          Skipped Blurry Frames (< {min_sharpness}): {skipped_blur_count}")
    print(f"          Average Sharpness: {avg_sharpness:.1f} (min: {min_sharp:.1f}, max: {max_sharp:.1f})")
    print(f"          Extraction Metadata: {metadata_path}")
    print("=" * 65)

    return metadata

def main():
    parser = argparse.ArgumentParser(description="Extract clean frames from indoor video for 3D reconstruction.")
    parser.add_argument("--video", type=str, default="reconstruction/input/Screen Recording 2026-09-09 134732.mp4", help="Path to input video")
    parser.add_argument("--output-dir", type=str, default="reconstruction/frames", help="Output directory for frames")
    parser.add_argument("--fps", type=float, default=2.7, help="Target extraction FPS")
    parser.add_argument("--max-frames", type=int, default=60, help="Maximum number of frames to extract")
    parser.add_argument("--min-sharpness", type=float, default=35.0, help="Minimum Laplacian variance threshold")
    parser.add_argument("--start-frame", type=int, default=0, help="Start frame index")
    parser.add_argument("--end-frame", type=int, default=560, help="End frame index (before cut)")
    parser.add_argument("--width", type=int, default=None, help="Output frame width")
    parser.add_argument("--height", type=int, default=None, help="Output frame height")
    
    args = parser.parse_args()
    resize = (args.width, args.height) if (args.width and args.height) else None

    try:
        extract_frames(
            video_path=args.video,
            output_dir=args.output_dir,
            target_fps=args.fps,
            max_frames=args.max_frames,
            min_sharpness=args.min_sharpness,
            start_frame=args.start_frame,
            end_frame=args.end_frame,
            resize_dims=resize
        )
    except Exception as e:
        print(f"[ERROR] Frame extraction failed: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
