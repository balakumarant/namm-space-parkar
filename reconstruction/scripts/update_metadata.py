#!/usr/bin/env python3
import json

metadata = {
  "building_name": "Reconstructed Digital Twin - Ground Floor Residence",
  "format": "GLB / glTF 2.0 Binary",
  "units": "meters",
  "scale_calibrated": True,
  "scale_factor": 1.0,
  "dimensions": {
    "width_meters": 6.04,
    "height_meters": 2.90,
    "length_meters": 12.10
  },
  "bounds": {
    "min": [-3.84, -0.10, 1.30],
    "max": [2.20, 2.80, 13.40]
  },
  "mesh_stats": {
    "vertices": 784,
    "faces": 1176,
    "file_size_bytes": 27628
  },
  "floors": [
    {
      "floor": 1,
      "elevation_meters": 0.0,
      "height_meters": 2.90,
      "walkable_surface": {
        "min_x": -1.60,
        "max_x": 2.00,
        "min_z": 1.50,
        "max_z": 13.20
      }
    }
  ],
  "rooms": [
    {
      "id": "rec_foyer",
      "name": "Entrance Foyer & Staircase",
      "floor": 1,
      "center": [0.0, 0.0, 3.5],
      "door": [0.0, 0.0, 2.0]
    },
    {
      "id": "rec_corridor",
      "name": "Central Structural Corridor",
      "floor": 1,
      "center": [0.0, 0.0, 6.8],
      "door": [0.0, 0.0, 5.5]
    },
    {
      "id": "rec_dining",
      "name": "East Dining Area",
      "floor": 1,
      "center": [1.2, 0.0, 9.5],
      "door": [0.3, 0.0, 9.0]
    },
    {
      "id": "rec_lounge",
      "name": "North Living & Fireplace Lounge",
      "floor": 1,
      "center": [-2.2, 0.0, 10.8],
      "door": [-0.5, 0.0, 10.0]
    }
  ],
  "pois": [
    {
      "id": "rec_poi_entrance",
      "name": "South Entrance Portal",
      "floor": 1,
      "coords": [0.0, 0.5, 2.5]
    },
    {
      "id": "rec_poi_stairs",
      "name": "Foyer Staircase",
      "floor": 1,
      "coords": [1.4, 0.5, 4.2]
    },
    {
      "id": "rec_poi_columns",
      "name": "Central Columns Concourse",
      "floor": 1,
      "coords": [0.0, 0.5, 6.8]
    },
    {
      "id": "rec_poi_dining",
      "name": "Dining Area",
      "floor": 1,
      "coords": [1.2, 0.5, 9.5]
    },
    {
      "id": "rec_poi_fireplace",
      "name": "Fireplace & Living Arena",
      "floor": 1,
      "coords": [-2.2, 0.5, 10.8]
    }
  ]
}

for path in ["reconstruction/output/metadata.json", "frontend/public/models/metadata.json"]:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"Updated: {path}")
