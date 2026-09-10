/**
 * MaterialEnhancer.ts
 *
 * Phase 5D — Major Realism / ArchViz Quality PBR Material System
 *
 * Decomposes the reconstructed 3D architectural mesh into semantic
 * components based on vertex colors and spatial boundaries, applying
 * physically-based materials (ArchViz standard):
 *
 *   1. Floor:            Natural oak parquet/plank with high-res grain & seam roughness
 *   2. Baseboards:       Satin architectural wall skirting
 *   3. Walls:            Warm off-white architectural plaster with fine surface variation
 *   4. Fireplace:        Honed slate charcoal stone
 *   5. Ceiling:          Matte clean ceiling plaster
 *   6. Beams:            Finished walnut timber with longitudinal grain
 *   7. Columns:          Finished architectural white concrete
 *   8. Stair Treads:     Polished oak bullnose treads
 *   9. Stair Risers:     Dark architectural risers & structural stringers
 *  10. Stair Balustrade: Brushed stainless steel balusters & handrails
 *  11. Window Frames:    Dark anodized architectural aluminum
 *  12. Window Glass:     MeshPhysicalMaterial with physical transmission & IOR reflections
 *  13. Sofa:             Charcoal woven architectural upholstery fabric
 *  14. Tables:           Smooth finished walnut wood
 *  15. Furniture Metal:  Satin black architectural steel
 *  16. Surface Anchors:  Brushed steel photogrammetric keyframe tracking markers
 */

import * as THREE from 'three';

export class MaterialEnhancer {
  // PBR Materials
  private floorMat!: THREE.MeshStandardMaterial;
  private skirtingMat!: THREE.MeshStandardMaterial;
  private wallMat!: THREE.MeshStandardMaterial;
  private fireplaceMat!: THREE.MeshStandardMaterial;
  private ceilingMat!: THREE.MeshStandardMaterial;
  private beamMat!: THREE.MeshStandardMaterial;
  private columnMat!: THREE.MeshStandardMaterial;
  private stairTreadMat!: THREE.MeshStandardMaterial;
  private stairRiserMat!: THREE.MeshStandardMaterial;
  private stairRailMat!: THREE.MeshStandardMaterial;
  private windowFrameMat!: THREE.MeshStandardMaterial;
  private glassMat!: THREE.MeshPhysicalMaterial;
  private sofaMat!: THREE.MeshStandardMaterial;
  private tableMat!: THREE.MeshStandardMaterial;
  private furnMetalMat!: THREE.MeshStandardMaterial;
  private anchorMat!: THREE.MeshStandardMaterial;

  // Procedural Canvas Textures
  private floorDiffuseTex!: THREE.CanvasTexture;
  private floorRoughnessTex!: THREE.CanvasTexture;
  private wallDiffuseTex!: THREE.CanvasTexture;
  private beamDiffuseTex!: THREE.CanvasTexture;

  constructor() {
    this._buildMaterials();
  }

  public enhance(model: THREE.Object3D): void {
    const meshesToProcess: THREE.Mesh[] = [];
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        meshesToProcess.push(child as THREE.Mesh);
      }
    });

    meshesToProcess.forEach((mesh) => {
      const parent = mesh.parent || model;
      const subMeshes = this._decomposeMesh(mesh);
      if (subMeshes.length > 0) {
        const subGroup = new THREE.Group();
        subGroup.name = 'ArchViz_PBR_DigitalTwin';
        subMeshes.forEach((sm) => subGroup.add(sm));
        parent.remove(mesh);
        parent.add(subGroup);
      }
    });
  }

  private _decomposeMesh(mesh: THREE.Mesh): THREE.Mesh[] {
    const geom = mesh.geometry;
    if (!geom || !geom.attributes.position) return [mesh];

    const posAttr = geom.attributes.position;
    const colAttr = geom.attributes.color;
    const indexAttr = geom.index;

    const numTriangles = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;

    const buckets: { [key: string]: number[] } = {
      floor: [],
      skirting: [],
      wall: [],
      fireplace: [],
      ceiling: [],
      beam: [],
      column: [],
      stair_tread: [],
      stair_riser: [],
      stair_rail: [],
      window_frame: [],
      glass: [],
      sofa: [],
      table: [],
      furn_metal: [],
      anchors: [],
    };

    for (let t = 0; t < numTriangles; t++) {
      const i0 = indexAttr ? indexAttr.getX(t * 3) : t * 3;
      const i1 = indexAttr ? indexAttr.getX(t * 3 + 1) : t * 3 + 1;
      const i2 = indexAttr ? indexAttr.getX(t * 3 + 2) : t * 3 + 2;

      const y0 = posAttr.getY(i0), y1 = posAttr.getY(i1), y2 = posAttr.getY(i2);
      const centY = (y0 + y1 + y2) / 3.0;

      const z0 = posAttr.getZ(i0), z1 = posAttr.getZ(i1), z2 = posAttr.getZ(i2);
      const centZ = (z0 + z1 + z2) / 3.0;

      let r = 255, g = 255, b = 255;
      if (colAttr) {
        const mult = colAttr.getX(i0) <= 1.0 ? 255.0 : 1.0;
        r = Math.round(((colAttr.getX(i0) + colAttr.getX(i1) + colAttr.getX(i2)) / 3.0) * mult);
        g = Math.round(((colAttr.getY(i0) + colAttr.getY(i1) + colAttr.getY(i2)) / 3.0) * mult);
        b = Math.round(((colAttr.getZ(i0) + colAttr.getZ(i1) + colAttr.getZ(i2)) / 3.0) * mult);
      }

      const category = this._classify(r, g, b, centY, centZ);
      buckets[category].push(i0, i1, i2);
    }

    const materialMap: { [key: string]: THREE.Material } = {
      floor: this.floorMat,
      skirting: this.skirtingMat,
      wall: this.wallMat,
      fireplace: this.fireplaceMat,
      ceiling: this.ceilingMat,
      beam: this.beamMat,
      column: this.columnMat,
      stair_tread: this.stairTreadMat,
      stair_riser: this.stairRiserMat,
      stair_rail: this.stairRailMat,
      window_frame: this.windowFrameMat,
      glass: this.glassMat,
      sofa: this.sofaMat,
      table: this.tableMat,
      furn_metal: this.furnMetalMat,
      anchors: this.anchorMat,
    };

    const result: THREE.Mesh[] = [];

    for (const [key, indices] of Object.entries(buckets)) {
      if (indices.length === 0) continue;

      const subGeom = this._extractSubGeometry(geom, indices, key === 'anchors');
      subGeom.computeVertexNormals();

      // Planar UV projection for architectural materials
      if (key === 'floor') {
        this._generatePlanarUVs(subGeom, 'XZ', 0.40);
      } else if (key === 'wall' || key === 'fireplace') {
        this._generatePlanarUVs(subGeom, 'ZY', 0.35);
      } else if (key === 'beam') {
        this._generatePlanarUVs(subGeom, 'ZY', 0.50);
      }

      const subMesh = new THREE.Mesh(subGeom, materialMap[key]);
      subMesh.name = `ArchViz_${key}`;
      subMesh.castShadow = key !== 'glass';
      subMesh.receiveShadow = true;
      result.push(subMesh);
    }

    return result;
  }

  private _classify(r: number, g: number, b: number, centY: number, centZ: number): string {
    // 1. Floor: Oak hardwood [212,178,140] or [185,150,115]
    if (((r >= 170 && r <= 225 && g >= 135 && g <= 195 && b >= 100 && b <= 160) || centY <= 0.02) && centY < 0.15) {
      return 'floor';
    }

    // 2. Baseboards (skirting): [70,75,82]
    if (r >= 65 && r <= 75 && g >= 70 && g <= 80 && b >= 77 && b <= 88 && centY < 0.20) {
      return 'skirting';
    }

    // 3. Ceiling beams: Walnut timber [139,90,43]
    if (r >= 120 && r <= 155 && g >= 75 && g <= 110 && b >= 30 && b <= 60 && centY > 2.2) {
      return 'beam';
    }

    // 4. Ceiling slab: High elevation
    if (centY >= 2.55) {
      return 'ceiling';
    }

    // 5. Columns: White structural column [245,247,250]
    if (r >= 240 && g >= 245 && b >= 248 && Math.abs(centZ - 6.8) < 1.3) {
      return 'column';
    }

    // 6. Stair Treads: Oak tread [205,172,132]
    if (r >= 195 && r <= 215 && g >= 162 && g <= 182 && b >= 122 && b <= 142 && centZ < 6.5) {
      return 'stair_tread';
    }

    // 7. Stair Risers & Stringers: Dark riser [55,60,68]
    if (r >= 50 && r <= 62 && g >= 55 && g <= 68 && b >= 62 && b <= 75 && centZ < 6.5) {
      return 'stair_riser';
    }

    // 8. Stair Railing & Balusters: Brushed steel [100,116,139]
    if (r >= 90 && r <= 115 && g >= 105 && g <= 125 && b >= 130 && b <= 150) {
      return 'stair_rail';
    }

    // 9. Window Frame: Dark anodized aluminum [30,35,42]
    if (r >= 25 && r <= 38 && g >= 30 && g <= 42 && b >= 36 && b <= 48 && centZ > 12.0) {
      return 'window_frame';
    }

    // 10. Window Glass: [160,210,235] at north end
    if (b > 200 && g > 175 && centZ > 12.0) {
      return 'glass';
    }

    // 11. Sofa: Charcoal fabric [64,70,78] in living area
    if (r >= 58 && r <= 70 && g >= 64 && g <= 76 && b >= 72 && b <= 84 && centZ > 7.5) {
      return 'sofa';
    }

    // 12. Tables: Walnut wood [120,85,50] in living/dining
    if (r >= 110 && r <= 135 && g >= 75 && g <= 95 && b >= 40 && b <= 60) {
      return 'table';
    }

    // 13. Furniture Metal: [45,50,55]
    if (r >= 40 && r <= 52 && g >= 45 && g <= 56 && b >= 50 && b <= 62 && centZ > 7.0) {
      return 'furn_metal';
    }

    // 14. Fireplace Wall & Hearth: Slate stone [65,75,88]
    if (r >= 55 && r <= 75 && g >= 68 && g <= 85 && b >= 78 && b <= 95 && centZ > 8.0) {
      return 'fireplace';
    }

    // 15. General Architectural Wall: Off-white paint [238,242,246]
    if (r >= 225 && g >= 230 && b >= 235) {
      return 'wall';
    }

    // 16. Photogrammetric Surface Anchors
    return 'anchors';
  }

  private _extractSubGeometry(srcGeom: THREE.BufferGeometry, indices: number[], preserveColors: boolean): THREE.BufferGeometry {
    const subGeom = new THREE.BufferGeometry();
    const srcPos = srcGeom.attributes.position;
    const srcCol = srcGeom.attributes.color;

    const newPositions = new Float32Array(indices.length * 3);
    const newColors = preserveColors && srcCol ? new Float32Array(indices.length * 3) : null;

    for (let k = 0; k < indices.length; k++) {
      const idx = indices[k];
      newPositions[k * 3]     = srcPos.getX(idx);
      newPositions[k * 3 + 1] = srcPos.getY(idx);
      newPositions[k * 3 + 2] = srcPos.getZ(idx);

      if (newColors && srcCol) {
        const mult = srcCol.getX(idx) <= 1.0 ? 1.0 : 1.0 / 255.0;
        newColors[k * 3]     = srcCol.getX(idx) * mult;
        newColors[k * 3 + 1] = srcCol.getY(idx) * mult;
        newColors[k * 3 + 2] = srcCol.getZ(idx) * mult;
      }
    }

    subGeom.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
    if (newColors) {
      subGeom.setAttribute('color', new THREE.BufferAttribute(newColors, 3));
    }

    return subGeom;
  }

  private _generatePlanarUVs(geom: THREE.BufferGeometry, plane: 'XZ' | 'ZY', scale: number): void {
    const pos = geom.attributes.position;
    const count = pos.count;
    const uvs = new Float32Array(count * 2);

    for (let i = 0; i < count; i++) {
      if (plane === 'XZ') {
        uvs[i * 2]     = pos.getX(i) * scale;
        uvs[i * 2 + 1] = pos.getZ(i) * scale;
      } else {
        uvs[i * 2]     = pos.getZ(i) * scale;
        uvs[i * 2 + 1] = pos.getY(i) * scale;
      }
    }

    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }

  private _buildMaterials(): void {
    // 1. Hardwood Floor (ArchViz high-res oak plank with staggered joints)
    this.floorDiffuseTex   = this._makeFloorTexture();
    this.floorRoughnessTex = this._makeFloorRoughnessTexture();

    this.floorMat = new THREE.MeshStandardMaterial({
      color:           0xd6ae76,
      map:             this.floorDiffuseTex,
      roughnessMap:    this.floorRoughnessTex,
      roughness:       0.50,
      metalness:       0.04,
      envMapIntensity: 0.85,
    });

    // 2. Baseboards (Skirting)
    this.skirtingMat = new THREE.MeshStandardMaterial({
      color:           0x383e46,
      roughness:       0.60,
      metalness:       0.05,
      envMapIntensity: 0.30,
    });

    // 3. Walls (Warm modern cream architectural plaster)
    this.wallDiffuseTex = this._makeWallTexture();

    this.wallMat = new THREE.MeshStandardMaterial({
      color:           0xf5f2ec,
      map:             this.wallDiffuseTex,
      roughness:       0.82,
      metalness:       0.01,
      envMapIntensity: 0.25,
    });

    // 4. Fireplace Stone (Slate charcoal granite)
    this.fireplaceMat = new THREE.MeshStandardMaterial({
      color:           0x3a424e,
      roughness:       0.70,
      metalness:       0.10,
      envMapIntensity: 0.40,
    });

    // 5. Ceiling (Matte white plaster)
    this.ceilingMat = new THREE.MeshStandardMaterial({
      color:           0xf8f9fa,
      roughness:       0.94,
      metalness:       0.00,
      envMapIntensity: 0.15,
    });

    // 6. Beams (Walnut timber)
    this.beamDiffuseTex = this._makeWoodTexture();

    this.beamMat = new THREE.MeshStandardMaterial({
      color:           0x7a4820,
      map:             this.beamDiffuseTex,
      roughness:       0.58,
      metalness:       0.04,
      envMapIntensity: 0.50,
    });

    // 7. Columns (Smooth white concrete)
    this.columnMat = new THREE.MeshStandardMaterial({
      color:           0xf0f3f6,
      roughness:       0.75,
      metalness:       0.02,
      envMapIntensity: 0.30,
    });

    // 8. Stair Treads (Polished oak bullnose)
    this.stairTreadMat = new THREE.MeshStandardMaterial({
      color:           0xcfa676,
      roughness:       0.52,
      metalness:       0.04,
      envMapIntensity: 0.65,
    });

    // 9. Stair Risers & Stringers (Dark architectural contrast)
    this.stairRiserMat = new THREE.MeshStandardMaterial({
      color:           0x383d44,
      roughness:       0.68,
      metalness:       0.06,
      envMapIntensity: 0.30,
    });

    // 10. Stair Balustrade & Railing (Brushed stainless steel)
    this.stairRailMat = new THREE.MeshStandardMaterial({
      color:           0xd0d5dc,
      roughness:       0.28,
      metalness:       0.85,
      envMapIntensity: 1.10,
    });

    // 11. Window Frame (Dark anodized architectural aluminum)
    this.windowFrameMat = new THREE.MeshStandardMaterial({
      color:           0x24282f,
      roughness:       0.45,
      metalness:       0.75,
      envMapIntensity: 0.80,
    });

    // 12. Window Glass (Physical architectural double-pane glass)
    this.glassMat = new THREE.MeshPhysicalMaterial({
      color:           0xd2eaff,
      transmission:    0.92,
      roughness:       0.03,
      metalness:       0.05,
      ior:             1.52,
      thickness:       0.06,
      transparent:     true,
      opacity:         0.90,
      side:            THREE.DoubleSide,
      envMapIntensity: 1.30,
    });

    // 13. Sofa (Woven architectural upholstery fabric)
    this.sofaMat = new THREE.MeshStandardMaterial({
      color:           0x454b54,
      roughness:       0.88,
      metalness:       0.02,
      envMapIntensity: 0.20,
    });

    // 14. Tables (Smooth finished walnut)
    this.tableMat = new THREE.MeshStandardMaterial({
      color:           0x825428,
      roughness:       0.48,
      metalness:       0.05,
      envMapIntensity: 0.60,
    });

    // 15. Furniture Metal (Satin black steel)
    this.furnMetalMat = new THREE.MeshStandardMaterial({
      color:           0x282c32,
      roughness:       0.40,
      metalness:       0.70,
      envMapIntensity: 0.70,
    });

    // 16. Photogrammetric Surface Anchors (Real video tracking points)
    this.anchorMat = new THREE.MeshStandardMaterial({
      vertexColors:    true,
      roughness:       0.45,
      metalness:       0.35,
      envMapIntensity: 0.60,
    });
  }

  private _makeFloorTexture(): THREE.CanvasTexture {
    const W = 1024, H = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#c79868';
    ctx.fillRect(0, 0, W, H);

    const plankH = 48;
    const numPlanks = Math.ceil(H / plankH) + 1;

    for (let p = 0; p < numPlanks; p++) {
      const y0 = p * plankH;
      const toneVariation = Math.sin(p * 2.7) * 16 + Math.cos(p * 1.3) * 8;
      const r = Math.min(255, Math.max(160, Math.floor(205 + toneVariation)));
      const g = Math.min(255, Math.max(120, Math.floor(r * 0.75)));
      const b = Math.min(255, Math.max(80, Math.floor(r * 0.52)));

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(0, y0, W, plankH - 2);

      // Staggered vertical plank end joints every 256px with offset per row
      const xOffset = (p % 4) * 64;
      ctx.strokeStyle = 'rgba(60, 35, 20, 0.35)';
      ctx.lineWidth = 1.2;
      for (let x = xOffset; x < W; x += 256) {
        ctx.beginPath();
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y0 + plankH - 2);
        ctx.stroke();
      }

      // Fine wood grain streaks
      for (let gx = 0; gx < W; gx += 6 + Math.floor(Math.random() * 8)) {
        ctx.strokeStyle = `rgba(${Math.floor(r * 0.75)},${Math.floor(g * 0.75)},${Math.floor(b * 0.75)},0.18)`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(gx, y0);
        ctx.lineTo(gx + (Math.random() - 0.5) * 6, y0 + plankH - 2);
        ctx.stroke();
      }

      // Horizontal plank seam
      ctx.strokeStyle = 'rgba(65, 38, 22, 0.40)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, y0 + plankH - 1);
      ctx.lineTo(W, y0 + plankH - 1);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
  }

  private _makeFloorRoughnessTexture(): THREE.CanvasTexture {
    const W = 512, H = 512;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#8a8a8a';
    ctx.fillRect(0, 0, W, H);

    const plankH = 24;
    const numPlanks = Math.ceil(H / plankH) + 1;
    for (let p = 0; p < numPlanks; p++) {
      const y0 = p * plankH;
      // Dark seam = rougher
      ctx.fillStyle = '#555555';
      ctx.fillRect(0, y0 + plankH - 2, W, 3);
      // Plank body = smoother
      ctx.fillStyle = '#a2a2a2';
      ctx.fillRect(0, y0 + 3, W, plankH - 8);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  private _makeWallTexture(): THREE.CanvasTexture {
    const W = 256, H = 256;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#f5f2ec';
    ctx.fillRect(0, 0, W, H);

    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const noise = (Math.random() - 0.5) * 8;
      d[i]     = Math.min(255, Math.max(0, d[i] + noise));
      d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + noise * 0.9));
      d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + noise * 0.8));
    }
    ctx.putImageData(img, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  private _makeWoodTexture(): THREE.CanvasTexture {
    const W = 256, H = 256;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#7a4820';
    ctx.fillRect(0, 0, W, H);

    for (let y = 0; y < H; y += 4) {
      ctx.strokeStyle = `rgba(${Math.floor(100 + Math.random() * 30)},${Math.floor(55 + Math.random() * 20)},${Math.floor(25 + Math.random() * 15)},0.25)`;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  public dispose(): void {
    if (this.floorDiffuseTex) this.floorDiffuseTex.dispose();
    if (this.floorRoughnessTex) this.floorRoughnessTex.dispose();
    if (this.wallDiffuseTex) this.wallDiffuseTex.dispose();
    if (this.beamDiffuseTex) this.beamDiffuseTex.dispose();

    [
      this.floorMat, this.skirtingMat, this.wallMat, this.fireplaceMat,
      this.ceilingMat, this.beamMat, this.columnMat, this.stairTreadMat,
      this.stairRiserMat, this.stairRailMat, this.windowFrameMat,
      this.glassMat, this.sofaMat, this.tableMat, this.furnMetalMat,
      this.anchorMat,
    ].forEach((m) => {
      if (m) m.dispose();
    });
  }
}
