import * as THREE from 'three';
import { Vector3Tuple } from './types';

export class DebugVisualizer {
  public group: THREE.Group = new THREE.Group();
  private scene: THREE.Scene;
  private isEnabled: boolean = false;
  private helpers: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group.name = 'DebugVisualizerGroup';
    this.group.visible = false;
    this.scene.add(this.group);

    // Auto-enable if URL has ?debug=true or ?debug=1
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('debug') === '1' || params.get('debug') === 'true') {
        this.setEnabled(true);
      }
    }
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.group.visible = enabled;
  }

  public toggle(): boolean {
    this.setEnabled(!this.isEnabled);
    return this.isEnabled;
  }

  public get isActive(): boolean {
    return this.isEnabled;
  }

  /**
   * Visualizes model bounding box
   */
  public addBoundingBox(min: THREE.Vector3, max: THREE.Vector3, color: number = 0x00f2fe): void {
    const box = new THREE.Box3(min, max);
    const helper = new THREE.Box3Helper(box, new THREE.Color(color));
    this.group.add(helper);
    this.helpers.push(helper);
  }

  /**
   * Visualizes player spawn position with a glowing marker pin and ring
   */
  public addSpawnMarker(pos: Vector3Tuple, color: number = 0x00ff88): void {
    const spawnGroup = new THREE.Group();
    spawnGroup.position.set(pos.x, pos.y, pos.z);

    // Glowing vertical pole
    const poleGeom = new THREE.CylinderGeometry(0.04, 0.04, 2.0, 8);
    const poleMat = new THREE.MeshBasicMaterial({ color, wireframe: false });
    const pole = new THREE.Mesh(poleGeom, poleMat);
    pole.position.y = 1.0;
    spawnGroup.add(pole);

    // Top sphere pin
    const pinGeom = new THREE.SphereGeometry(0.18, 12, 12);
    const pinMat = new THREE.MeshBasicMaterial({ color });
    const pin = new THREE.Mesh(pinGeom, pinMat);
    pin.position.y = 2.0;
    spawnGroup.add(pin);

    // Ground ring
    const ringGeom = new THREE.RingGeometry(0.4, 0.5, 24);
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.position.y = 0.02;
    spawnGroup.add(ring);

    this.group.add(spawnGroup);
    this.helpers.push(spawnGroup);
  }

  /**
   * Visualizes a static collision box
   */
  public addCollisionBox(
    posX: number,
    posY: number,
    posZ: number,
    halfW: number,
    halfH: number,
    halfD: number,
    color: number = 0xffaa00
  ): void {
    const geom = new THREE.BoxGeometry(halfW * 2, halfH * 2, halfD * 2);
    const edges = new THREE.EdgesGeometry(geom);
    const lineMat = new THREE.LineBasicMaterial({ color, linewidth: 1.5 });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    wireframe.position.set(posX, posY, posZ);

    this.group.add(wireframe);
    this.helpers.push(wireframe);
  }

  /**
   * Adds coordinate axes indicator (Red=X, Green=Y, Blue=Z)
   */
  public addAxes(size: number = 4.0): void {
    const axes = new THREE.AxesHelper(size);
    (axes.material as THREE.Material).depthTest = false;
    axes.renderOrder = 999;
    this.group.add(axes);
    this.helpers.push(axes);
  }

  /**
   * Adds floor plane reference grid
   */
  public addFloorGrid(size: number = 60, divisions: number = 60, posY: number = 0.0): void {
    const grid = new THREE.GridHelper(size, divisions, 0x00f2fe, 0x1e293b);
    grid.position.y = posY;
    this.group.add(grid);
    this.helpers.push(grid);
  }

  /**
   * Visualizes a single navigation node
   */
  public addNavigationNode(
    id: string,
    pos: Vector3Tuple,
    name: string,
    color: number = 0x00f2fe
  ): void {
    const nodeGroup = new THREE.Group();
    nodeGroup.name = `debug_node_${id}_${name}`;
    nodeGroup.position.set(pos.x, pos.y + 0.15, pos.z);

    const geom = new THREE.SphereGeometry(0.15, 10, 10);
    const mat = new THREE.MeshBasicMaterial({ color, wireframe: true });
    const sphere = new THREE.Mesh(geom, mat);
    nodeGroup.add(sphere);

    // Vertical anchor line to floor
    const lineGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -0.15, 0),
      new THREE.Vector3(0, 0.15, 0),
    ]);
    const lineMat = new THREE.LineBasicMaterial({ color, opacity: 0.7, transparent: true });
    const line = new THREE.Line(lineGeom, lineMat);
    nodeGroup.add(line);

    this.group.add(nodeGroup);
    this.helpers.push(nodeGroup);
  }

  /**
   * Visualizes a graph edge connecting two nodes
   */
  public addGraphEdge(
    from: Vector3Tuple,
    to: Vector3Tuple,
    color: number = 0xf59e0b
  ): void {
    const lineGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y + 0.15, from.z),
      new THREE.Vector3(to.x, to.y + 0.15, to.z),
    ]);
    const lineMat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
    const line = new THREE.Line(lineGeom, lineMat);

    this.group.add(line);
    this.helpers.push(line);
  }

  /**
   * Visualizes a POI Anchor with an elevated glowing diamond
   */
  public addPOIAnchor(
    name: string,
    pos: Vector3Tuple,
    color: number = 0x10b981
  ): void {
    const anchorGroup = new THREE.Group();
    anchorGroup.name = `debug_anchor_${name}`;
    anchorGroup.position.set(pos.x, pos.y, pos.z);

    // Diamond marker
    const diamondGeom = new THREE.OctahedronGeometry(0.25);
    const diamondMat = new THREE.MeshBasicMaterial({ color, wireframe: false });
    const diamond = new THREE.Mesh(diamondGeom, diamondMat);
    diamond.position.y = 1.2;
    anchorGroup.add(diamond);

    // Vertical dashed/thin pin
    const poleGeom = new THREE.CylinderGeometry(0.02, 0.02, 1.2, 6);
    const poleMat = new THREE.MeshBasicMaterial({ color, opacity: 0.8, transparent: true });
    const pole = new THREE.Mesh(poleGeom, poleMat);
    pole.position.y = 0.6;
    anchorGroup.add(pole);

    // Ground target ring
    const ringGeom = new THREE.RingGeometry(0.25, 0.35, 16);
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.position.y = 0.03;
    anchorGroup.add(ring);

    this.group.add(anchorGroup);
    this.helpers.push(anchorGroup);
  }

  /**
   * Helper to populate complete reconstructed graph and POIs into debug overlay
   */
  public visualizeReconstructedGraph(
    nodes: Array<{ id: string; name: string; x: number; y: number; z: number }>,
    edges: Array<{ from: string; to: string }>,
    anchors: Array<{ name: string; reconstructedCoord: Vector3Tuple }>
  ): void {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    // 1. Draw all edges
    for (const e of edges) {
      const fromN = nodeMap.get(e.from);
      const toN = nodeMap.get(e.to);
      if (fromN && toN) {
        this.addGraphEdge(
          { x: fromN.x, y: fromN.y, z: fromN.z },
          { x: toN.x, y: toN.y, z: toN.z }
        );
      }
    }

    // 2. Draw all nodes
    for (const n of nodes) {
      this.addNavigationNode(n.id, { x: n.x, y: n.y, z: n.z }, n.name);
    }

    // 3. Draw POI anchors
    for (const a of anchors) {
      this.addPOIAnchor(a.name, a.reconstructedCoord);
    }
  }

  public clear(): void {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      if ((child as any).geometry) (child as any).geometry.dispose();
    }
    this.helpers = [];
  }

  public dispose(): void {
    this.clear();
    if (this.scene) {
      this.scene.remove(this.group);
    }
  }
}
