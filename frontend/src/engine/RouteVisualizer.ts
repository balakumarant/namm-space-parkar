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

    // Dynamic glowing material with enhanced visibility against architectural PBR floors
    this.tubeMaterial = new THREE.MeshStandardMaterial({
      color: 0x00f2fe,
      emissive: 0x00d8f0,
      emissiveIntensity: 1.2,
      roughness: 0.15,
      metalness: 0.4,
      toneMapped: false, // Ensures wayfinding glow remains vibrant under ACESFilmic
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

    // Detect if this is a reconstructed mode route
    const isReconstructed = waypoints.some(
      (w) => w.id.startsWith('rec_') || ['f1_entrance', 'f1_stairs', 'f1_c_mid', 'room_101', 'f1_c_north'].includes(w.id)
    );

    // Calibrate vertical offset: 0.08m for reconstructed mode to prevent z-fighting without floating
    const yOffset = isReconstructed ? 0.08 : 0.25;
    const tubeRadius = isReconstructed ? 0.065 : 0.08;

    // 1. Build points array lifted above floor surface
    const points: THREE.Vector3[] = waypoints.map((w) => {
      return new THREE.Vector3(w.x, w.y + yOffset, w.z);
    });

    // 2. Build smoothed CatmullRomCurve3
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.2);

    // 3. Glowing Tube Geometry
    const tubularSegments = Math.max(60, points.length * 15);
    const radialSegments = 8;
    const tubeGeometry = new THREE.TubeGeometry(curve, tubularSegments, tubeRadius, radialSegments, false);

    this.pathMesh = new THREE.Mesh(tubeGeometry, this.tubeMaterial);
    this.routeGroup.add(this.pathMesh);

    // 4. Directional Chevron Markers spaced along the route
    const curveLength = curve.getLength();
    const chevronSpacing = isReconstructed ? 1.8 : 2.2;
    const chevronCount = Math.floor(curveLength / chevronSpacing);

    for (let i = 1; i < chevronCount; i++) {
      const t = i / chevronCount;
      const pos = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).normalize();

      // Mini arrow / cone pointer
      const coneRadius = isReconstructed ? 0.12 : 0.18;
      const coneHeight = isReconstructed ? 0.25 : 0.35;
      const coneGeom = new THREE.ConeGeometry(coneRadius, coneHeight, 6);
      coneGeom.rotateX(Math.PI / 2); // Point forward

      const coneMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
      });

      const cone = new THREE.Mesh(coneGeom, coneMat);
      cone.position.copy(pos);
      // Small vertical lift above tube surface
      cone.position.y += tubeRadius + 0.02;

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
        ringMesh.position.set(w.x, w.y + (isReconstructed ? 0.15 : 0.3), w.z);
        this.transitionMarkers.add(ringMesh);
      }
    });

    // 6. Holographic Destination Beacon
    const dest = points[points.length - 1];
    this.buildDestinationBeacon(dest, isReconstructed);
  }

  private buildDestinationBeacon(pos: THREE.Vector3, isReconstructed: boolean = false): void {
    const beamHeight = isReconstructed ? 2.5 : 3.5;
    const beamRadius = isReconstructed ? 0.25 : 0.35;

    // Vertical light beam cylinder
    const beamGeom = new THREE.CylinderGeometry(beamRadius, beamRadius, beamHeight, 16, 1, true);
    beamGeom.translate(0, beamHeight / 2, 0);
    const beam = new THREE.Mesh(beamGeom, this.beaconMaterial);
    beam.position.copy(pos);
    this.destinationBeacon.add(beam);

    // Pulsating target rings
    const targetRingGeom = new THREE.RingGeometry(0.4, 0.65, 24);
    targetRingGeom.rotateX(-Math.PI / 2);
    const targetRing = new THREE.Mesh(targetRingGeom, this.ringMaterial);
    targetRing.position.set(pos.x, pos.y + 0.02, pos.z);
    this.destinationBeacon.add(targetRing);

    // Floating diamond indicator
    const diamondGeom = new THREE.OctahedronGeometry(0.25);
    const diamondMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
    const diamond = new THREE.Mesh(diamondGeom, diamondMat);
    diamond.position.set(pos.x, pos.y + beamHeight * 0.8, pos.z);
    this.destinationBeacon.add(diamond);
  }

  public update(delta: number): void {
    this.animationTime += delta;

    // Pulse tube emission intensity
    const pulse = 1.0 + Math.sin(this.animationTime * 4.0) * 0.35;
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
