#!/usr/bin/env python3
"""
Model Inspector & Preview Helper for PARKAR 3D Digital Twin (Phase 5A).
Reads generated GLB, OBJ, and PLY files, outputs geometric dimensions, and can
launch a local HTTP server for viewer.html.
"""

import os
import sys
import argparse
import http.server
import socketserver
import webbrowser
import trimesh

def inspect_model(glb_path: str = "reconstruction/output/building.glb"):
    if not os.path.exists(glb_path):
        print(f"[ERROR] GLB file not found: {glb_path}")
        return False

    print("=" * 60)
    print("PARKAR 3D MODEL GEOMETRIC INSPECTION")
    print("=" * 60)
    print(f"Target File: {glb_path} ({os.path.getsize(glb_path):,} bytes)")

    mesh = trimesh.load(glb_path)
    if isinstance(mesh, trimesh.Scene):
        print(f"GLTF Scene Nodes: {len(mesh.geometry)}")
        for name, geom in mesh.geometry.items():
            print(f"  • Geometry: {name}")
            print(f"    - Vertices: {len(geom.vertices):,}")
            print(f"    - Faces:    {len(geom.faces):,} triangles")
            print(f"    - Extents:  X={geom.extents[0]:.2f}m, Y={geom.extents[1]:.2f}m, Z={geom.extents[2]:.2f}m")
            print(f"    - Bounds:   Min={geom.bounds[0].round(2).tolist()}, Max={geom.bounds[1].round(2).tolist()}")
    else:
        print(f"Vertices: {len(mesh.vertices):,}")
        print(f"Faces:    {len(mesh.faces):,} triangles")
        print(f"Extents:  X={mesh.extents[0]:.2f}m, Y={mesh.extents[1]:.2f}m, Z={mesh.extents[2]:.2f}m")
        print(f"Bounds:   Min={mesh.bounds[0].round(2).tolist()}, Max={mesh.bounds[1].round(2).tolist()}")

    print("=" * 60)
    return True

def serve_viewer(port: int = 8085):
    reconstruction_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    os.chdir(reconstruction_dir)
    handler = http.server.SimpleHTTPRequestHandler
    
    print(f"[INFO] Serving reconstruction viewer at http://127.0.0.1:{port}/viewer.html")
    print("[INFO] Press Ctrl+C to stop.")
    with socketserver.TCPServer(("127.0.0.1", port), handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[INFO] Server stopped.")

def main():
    parser = argparse.ArgumentParser(description="Inspect or view reconstructed 3D digital twin.")
    parser.add_argument("--inspect", action="store_true", default=True, help="Inspect geometric properties of building.glb")
    parser.add_argument("--serve", action="store_true", help="Launch local preview web server")
    parser.add_argument("--port", type=int, default=8085, help="Port for preview web server")
    parser.add_argument("--glb", type=str, default="reconstruction/output/building.glb", help="Path to GLB file")
    args = parser.parse_args()

    inspect_model(args.glb)
    if args.serve:
        serve_viewer(args.port)

if __name__ == "__main__":
    main()
