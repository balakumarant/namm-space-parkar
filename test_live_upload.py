import urllib.request
import json
import time

video_path = r"reconstruction/input/indoor_building.mp4"
with open(video_path, "rb") as f:
    file_bytes = f.read()

boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
body = bytearray()
body.extend(f"--{boundary}\r\n".encode("utf-8"))
body.extend(b'Content-Disposition: form-data; name="video"; filename="indoor_walkthrough_test.mp4"\r\n')
body.extend(b"Content-Type: video/mp4\r\n\r\n")
body.extend(file_bytes)
body.extend(f"\r\n--{boundary}--\r\n".encode("utf-8"))

req = urllib.request.Request(
    "http://127.0.0.1:8000/api/reconstruction/upload",
    data=bytes(body),
    headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    method="POST"
)

with urllib.request.urlopen(req) as resp:
    res_data = json.loads(resp.read().decode("utf-8"))
    print("UPLOAD SUCCESSFUL:", res_data)
    job_id = res_data["job_id"]

print(f"Monitoring job {job_id}...")
start_t = time.time()
while time.time() - start_t < 40:
    with urllib.request.urlopen(f"http://127.0.0.1:8000/api/reconstruction/status/{job_id}") as s_resp:
        st = json.loads(s_resp.read().decode("utf-8"))
        print(f"[{time.time() - start_t:.1f}s] status={st['status']} ({st['progress_pct']}%) - {st['stage_description']}")
        if st["status"] in ["COMPLETED", "FAILED"]:
            break
    time.sleep(1.5)

with urllib.request.urlopen(f"http://127.0.0.1:8000/api/reconstruction/status/{job_id}") as s_resp:
    final_st = json.loads(s_resp.read().decode("utf-8"))
    print("FINAL JOB STATUS:", json.dumps(final_st, indent=2))
