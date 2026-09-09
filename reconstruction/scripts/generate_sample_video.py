"""
Generates a synthetic 5-second indoor corridor walkthrough video clip (1280x720, 30fps)
for automated pipeline testing and frame extraction verification.
"""
import cv2
import numpy as np
import os
import sys

def generate_corridor_video(output_path: str = "reconstruction/input/indoor_building.mp4", duration_seconds: int = 5):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    width, height = 1280, 720
    fps = 30
    total_frames = duration_seconds * fps

    # Use MP4V fourcc codec for standard cross-platform Windows compatibility
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    if not out.isOpened():
        print(f"[ERROR] Could not open VideoWriter for path: {output_path}")
        return False

    print(f"[INFO] Generating synthetic indoor walkthrough video: {output_path} ({total_frames} frames)...")

    for i in range(total_frames):
        # Base frame (dark modern architectural corridor)
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        
        # Vanishing point simulation: perspective lines for ceiling, walls, floor
        # Forward translation along corridor with camera bobbing
        t = i / total_frames
        bobbing = int(np.sin(i * 0.25) * 4)
        vp_x = width // 2
        vp_y = (height // 2) + bobbing

        # Floor (slate gray with grid lines)
        cv2.fillPoly(frame, [np.array([[0, height], [width, height], [vp_x + 80, vp_y + 30], [vp_x - 80, vp_y + 30]])], (35, 40, 48))
        
        # Ceiling (dark charcoal)
        cv2.fillPoly(frame, [np.array([[0, 0], [width, 0], [vp_x + 80, vp_y - 30], [vp_x - 80, vp_y - 30]])], (20, 22, 28))

        # Left wall (tech cyan tint)
        cv2.fillPoly(frame, [np.array([[0, 0], [vp_x - 80, vp_y - 30], [vp_x - 80, vp_y + 30], [0, height]])], (45, 52, 60))

        # Right wall (slate)
        cv2.fillPoly(frame, [np.array([[width, 0], [vp_x + 80, vp_y - 30], [vp_x + 80, vp_y + 30], [width, height]])], (40, 48, 55))

        # Passing simulated doorway markers
        door_offset = int((t * 300) % 200)
        door_x = 100 + door_offset
        cv2.rectangle(frame, (door_x, 150), (door_x + 60, height - 80), (25, 30, 38), -1)
        cv2.putText(frame, "LAB 101", (door_x + 5, 200), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 242, 254), 1)

        # Overhead lights passing
        for light_idx in range(4):
            ly = int(80 + ((light_idx * 50 + i * 2) % 250))
            lx1 = int(vp_x - (ly - vp_y + 30) * 0.3)
            lx2 = int(vp_x + (ly - vp_y + 30) * 0.3)
            cv2.line(frame, (lx1, ly), (lx2, ly), (220, 240, 255), 2)

        # Subtle telemetry HUD indicator simulating smartphone capture
        cv2.putText(frame, f"SMARTPHONE INDOOR CAPTURE - FRAME {i+1:04d}/{total_frames}", (30, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 242, 254), 2)
        cv2.putText(frame, f"TIME: {i/fps:.2f}s | ACCEL: OK | GYRO: LOCKED", (30, 70),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 200, 220), 1)

        out.write(frame)

    out.release()
    print(f"[SUCCESS] Synthetic indoor walkthrough video successfully generated at: {output_path}")
    return True

if __name__ == "__main__":
    generate_corridor_video()
