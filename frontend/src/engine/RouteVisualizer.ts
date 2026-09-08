import * as THREE from 'three';
import { Waypoint } from '../services/pathfinding';

export class RouteVisualizer {
  private scene: THREE.Scene;
  private routeGroup: THREE.Group = new THREE.Group();

  private pathMesh: THREE.Mesh | null = null;
  private chevronsGroup: THREE.Group = new THREE.Group();
  private destinationBeacon: THREE.Group = new THREE.Group();
  private transitionMarkers: THREE.Group = new THREE.Group();

  private tubeMaterial: THREE.MeshStandardMaterial;
  private beaconMaterial: THREE.MeshBasicMaterial;
  private ringMaterial: THREE.MeshBasicMaterial;

  private animationTime: number = 0;
  public currentWaypoints: Waypoint[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.scene.add(this.routeGroup);

    this.routeGroup.add(this.chevronsGroup);
    this.routeGroup.add(this.destinationBeacon);
    this.routeGroup.add(this.transitionMarkers);

    // Dynamic glowing material
    this.tubeMaterial = new THREE.MeshStandardMaterial({
      color: 0x00f2fe,
      emissive: 0x00a3cc,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.8,
    });

    this.beaconMaterial = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });

    this.ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x4facfe,
      wireframe: true,
    });
  }

  public setRoute(waypoints: Waypoint[]): void {
    this.clearRoute();
    if (!waypoints || waypoints.length < 2) return;

    this.currentWaypoints = waypoints;

    // 1. Build points array lifted 0.25m above floor surface
    const points: THREE.Vector3[] = waypoints.map((w) => {
      return new THREE.Vector3(w.x, w.y + 0.25, w.z);
    });

    // 2. Build smoothed CatmullRomCurve3
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.2);

    // 3. Glowing Tube Geometry
    const tubularSegments = Math.max(60, points.length * 15);
    const radius = 0.08;
    const radialSegments = 8;
    const tubeGeometry = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);

    this.pathMesh = new THREE.Mesh(tubeGeometry, this.tubeMaterial);
    this.routeGroup.add(this.pathMesh);

    // 4. Directional Chevron Markers spaced every 2 meters
    const curveLength = curve.getLength();
    const chevronCount = Math.floor(curveLength / 2.2);

    for (let i = 1; i < chevronCount; i++) {
      const t = i / chevronCount;
      const pos = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).normalize();

      // Mini arrow / cone pointer
      const coneGeom = new THREE.ConeGeometry(0.18, 0.35, 6);
      coneGeom.rotateX(Math.PI / 2); // Point forward

      const coneMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
      });

      const cone = new THREE.Mesh(coneGeom, coneMat);
      cone.position.copy(pos);

      // Orient cone in tangent direction
      const lookTarget = pos.clone().add(tangent);
      cone.lookAt(lookTarget);

      this.chevronsGroup.add(cone);
    }

    // 5. Vertical Transition Indicators (Stairs and Elevators)
    waypoints.forEach((w) => {
      if (w.type === 'stair_landing' || w.type === 'elevator_car' || w.type === 'elevator_lobby') {
        const ringGeom = new THREE.TorusGeometry(0.7, 0.05, 8, 24);
        ringGeom.rotateX(Math.PI / 2);
        const ringMesh = new THREE.Mesh(
          ringGeom,
          new THREE.MeshBasicMaterial({
            color: w.type.includes('stair') ? 0xffb703 : 0x00f2fe,
            wireframe: true,
          })
        );
        ringMesh.position.set(w.x, w.y + 0.3, w.z);
        this.transitionMarkers.add(ringMesh);
      }
    });

    // 6. Holographic Destination Beacon
    const dest = points[points.length - 1];
    this.buildDestinationBeacon(dest);
  }

  private buildDestinationBeacon(pos: THREE.Vector3): void {
    // Vertical light beam cylinder
    const beamGeom = new THREE.CylinderGeometry(0.35, 0.35, 3.5, 16, 1, true);
    beamGeom.translate(0, 1.75, 0);
    const beam = new THREE.Mesh(beamGeom, this.beaconMaterial);
    beam.position.copy(pos);
    this.destinationBeacon.add(beam);

    // Pulsating target rings
    const targetRingGeom = new THREE.RingGeometry(0.5, 0.75, 24);
    targetRingGeom.rotateX(-Math.PI / 2);
    const targetRing = new THREE.Mesh(targetRingGeom, this.ringMaterial);
    targetRing.position.set(pos.x, pos.y + 0.05, pos.z);
    this.destinationBeacon.add(targetRing);

    // Floating diamond indicator
    const diamondGeom = new THREE.OctahedronGeometry(0.35);
    const diamondMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
    const diamond = new THREE.Mesh(diamondGeom, diamondMat);
    diamond.position.set(pos.x, pos.y + 2.8, pos.z);
    this.destinationBeacon.add(diamond);
  }

  public update(delta: number): void {
    this.animationTime += delta;

    // Pulse tube emission intensity
    const pulse = 0.7 + Math.sin(this.animationTime * 4.0) * 0.3;
    this.tubeMaterial.emissiveIntensity = pulse;

    // Rotate destination beacon diamond and rings
    if (this.destinationBeacon.children.length >= 3) {
      const diamond = this.destinationBeacon.children[2];
      diamond.rotation.y += delta * 2.0;
      diamond.position.y += Math.sin(this.animationTime * 3.0) * 0.003;

      const ring = this.destinationBeacon.children[1];
      ring.rotation.z += delta * 1.5;
    }

    // Rotate transition markers
    this.transitionMarkers.children.forEach((m, idx) => {
      m.rotation.z += delta * (idx % 2 === 0 ? 1.8 : -1.8);
    });
  }

  public clearRoute(): void {
    this.currentWaypoints = [];

    if (this.pathMesh) {
      this.routeGroup.remove(this.pathMesh);
      this.pathMesh.geometry.dispose();
      this.pathMesh = null;
    }

    while (this.chevronsGroup.children.length > 0) {
      const child = this.chevronsGroup.children[0] as THREE.Mesh;
      this.chevronsGroup.remove(child);
      child.geometry.dispose();
    }

    while (this.destinationBeacon.children.length > 0) {
      const child = this.destinationBeacon.children[0] as THREE.Mesh;
      this.destinationBeacon.remove(child);
      child.geometry.dispose();
    }

    while (this.transitionMarkers.children.length > 0) {
      const child = this.transitionMarkers.children[0] as THREE.Mesh;
      this.transitionMarkers.remove(child);
      child.geometry.dispose();
    }
  }

  public dispose(): void {
    this.clearRoute();
    this.scene.remove(this.routeGroup);
    this.tubeMaterial.dispose();
    this.beaconMaterial.dispose();
    this.ringMaterial.dispose();
  }
}
