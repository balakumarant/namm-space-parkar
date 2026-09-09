import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from './PhysicsWorld';
import { InteractiveZone, RoomDefinition, FloorDefinition, Vector3Tuple } from './types';
import { BUILDING_CONFIG, BuildingMode, getInitialBuildingMode } from '../config/buildingConfig';
import { DebugVisualizer } from './DebugVisualizer';
import {
  RECONSTRUCTED_GRAPH_NODES,
  RECONSTRUCTED_GRAPH_EDGES,
  RECONSTRUCTED_POI_ANCHORS,
} from '../services/reconstructedGraphAdapter';

export interface IBuildingLoader {
  build(scene: THREE.Scene, physics: PhysicsWorld, debugVisualizer?: DebugVisualizer): Promise<void>;
  loadProceduralBuilding(): Promise<void>;
  loadReconstructedBuilding(glbUrl?: string, metadataUrl?: string, debugVisualizer?: DebugVisualizer): Promise<void>;
  setMode(mode: BuildingMode): void;
  getMode(): BuildingMode;
  getSpawnPosition(): Vector3Tuple;
  getSpawnYaw(): number;
  getInteractiveZones(): InteractiveZone[];
  getFloors(): FloorDefinition[];
  getFloorByHeight(y: number): number;
  dispose(): void;
}

export class BuildingLoader implements IBuildingLoader {
  private buildingMode: BuildingMode = getInitialBuildingMode();
  private interactiveZones: InteractiveZone[] = [];
  private floors: FloorDefinition[] = [];
  private buildingGroup: THREE.Group = new THREE.Group();
  private scene: THREE.Scene | null = null;
  private physics: PhysicsWorld | null = null;
  private materials: { [key: string]: THREE.Material } = {};
  private staticBodies: RAPIER.RigidBody[] = [];
  private reconstructedModel: THREE.Object3D | null = null;
  private reconstructedMetadata: any = null;
  private debugVisualizer: DebugVisualizer | null = null;

  constructor(initialMode?: BuildingMode) {
    if (initialMode) {
      this.buildingMode = initialMode;
    }
    this.initMaterials();
    this.initFloorSpecs();
  }

  public getReconstructedModel(): THREE.Object3D | null {
    return this.reconstructedModel;
  }

  public getReconstructedMetadata(): any {
    return this.reconstructedMetadata;
  }

  public setMode(mode: BuildingMode): void {
    this.buildingMode = mode;
  }

  public getMode(): BuildingMode {
    return this.buildingMode;
  }

  public getSpawnPosition(): Vector3Tuple {
    if (this.buildingMode === 'reconstructed') {
      return { ...BUILDING_CONFIG.reconstructedSpawn };
    }
    return { ...BUILDING_CONFIG.proceduralSpawn };
  }

  public getSpawnYaw(): number {
    if (this.buildingMode === 'reconstructed') {
      return Math.PI; // Facing forward (+Z) into the reconstructed foyer and corridors
    }
    return 0.0; // Facing north (-Z) towards Room 101-103
  }

  private initMaterials(): void {
    // Floor material (modern polished concrete with slight reflection)
    this.materials['floor'] = new THREE.MeshStandardMaterial({
      color: 0x22262d,
      roughness: 0.35,
      metalness: 0.1,
    });

    // Outer and structural walls (clean off-white architectural paint)
    this.materials['wall'] = new THREE.MeshStandardMaterial({
      color: 0xd9e0ea,
      roughness: 0.7,
      metalness: 0.05,
    });

    // Accent walls (subtle slate / tech blue)
    this.materials['wallAccent'] = new THREE.MeshStandardMaterial({
      color: 0x1f3044,
      roughness: 0.6,
      metalness: 0.15,
    });

    // Doors & doorframes (warm architectural walnut / dark brushed metal)
    this.materials['door'] = new THREE.MeshStandardMaterial({
      color: 0x3d2b1f,
      roughness: 0.5,
      metalness: 0.1,
    });

    this.materials['doorFrame'] = new THREE.MeshStandardMaterial({
      color: 0x11161d,
      roughness: 0.3,
      metalness: 0.7,
    });

    // Stairs (textured grip graphite)
    this.materials['stair'] = new THREE.MeshStandardMaterial({
      color: 0x333b47,
      roughness: 0.4,
      metalness: 0.2,
    });

    this.materials['handrail'] = new THREE.MeshStandardMaterial({
      color: 0x00f2fe,
      roughness: 0.2,
      metalness: 0.8,
      emissive: 0x005577,
    });

    // Elevator (futuristic brushed chrome + cyan emissive lights)
    this.materials['elevatorShaft'] = new THREE.MeshStandardMaterial({
      color: 0x18202c,
      roughness: 0.3,
      metalness: 0.6,
      transparent: true,
      opacity: 0.9,
    });

    this.materials['elevatorDoor'] = new THREE.MeshStandardMaterial({
      color: 0x829ab1,
      roughness: 0.2,
      metalness: 0.85,
    });

    this.materials['elevatorGlow'] = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
    });

    // Ceiling lamps (emissive white glow)
    this.materials['ceilingLight'] = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });
  }

  private initFloorSpecs(): void {
    const floorHeight = 4.5;

    // Floor 1 definition
    const f1Rooms: RoomDefinition[] = [
      {
        id: 'room_101',
        number: '101',
        name: 'Room 101 - Techfest Robotics Lab',
        floor: 1,
        center: { x: -7.0, y: 0.0, z: -14.0 },
        size: { x: 8.0, y: floorHeight, z: 10.0 },
        doorPosition: { x: -2.3, y: 0.0, z: -14.0 },
      },
      {
        id: 'room_102',
        number: '102',
        name: 'Room 102 - IoT Hardware Studio',
        floor: 1,
        center: { x: -7.0, y: 0.0, z: -1.0 },
        size: { x: 8.0, y: floorHeight, z: 10.0 },
        doorPosition: { x: -2.3, y: 0.0, z: -1.0 },
      },
      {
        id: 'room_103',
        number: '103',
        name: 'Room 103 - Admin & Registration',
        floor: 1,
        center: { x: -7.0, y: 0.0, z: 12.0 },
        size: { x: 8.0, y: floorHeight, z: 10.0 },
        doorPosition: { x: -2.3, y: 0.0, z: 12.0 },
      },
    ];

    // Floor 2 definition
    const f2Rooms: RoomDefinition[] = [
      {
        id: 'room_201',
        number: '201',
        name: 'Room 201 - AI & Data Science Center',
        floor: 2,
        center: { x: -7.0, y: floorHeight, z: -14.0 },
        size: { x: 8.0, y: floorHeight, z: 10.0 },
        doorPosition: { x: -2.3, y: floorHeight, z: -14.0 },
      },
      {
        id: 'room_202',
        number: '202',
        name: 'Room 202 - Seminar Hall',
        floor: 2,
        center: { x: -7.0, y: floorHeight, z: -1.0 },
        size: { x: 8.0, y: floorHeight, z: 10.0 },
        doorPosition: { x: -2.3, y: floorHeight, z: -1.0 },
      },
      {
        id: 'room_203',
        number: '203',
        name: 'Room 203 - Cyber Security Arena',
        floor: 2,
        center: { x: -7.0, y: floorHeight, z: 12.0 },
        size: { x: 8.0, y: floorHeight, z: 10.0 },
        doorPosition: { x: -2.3, y: floorHeight, z: 12.0 },
      },
    ];

    // Floor 3 definition
    const f3Rooms: RoomDefinition[] = [
      {
        id: 'room_301',
        number: '301',
        name: 'Room 301 - Innovation Incubation Cell',
        floor: 3,
        center: { x: -7.0, y: floorHeight * 2, z: -14.0 },
        size: { x: 8.0, y: floorHeight, z: 10.0 },
        doorPosition: { x: -2.3, y: floorHeight * 2, z: -14.0 },
      },
      {
        id: 'room_302',
        number: '302',
        name: 'Room 302 - Executive Board Room',
        floor: 3,
        center: { x: -7.0, y: floorHeight * 2, z: -1.0 },
        size: { x: 8.0, y: floorHeight, z: 10.0 },
        doorPosition: { x: -2.3, y: floorHeight * 2, z: -1.0 },
      },
      {
        id: 'room_303',
        number: '303',
        name: 'Room 303 - Dean & Faculty Lounge',
        floor: 3,
        center: { x: -7.0, y: floorHeight * 2, z: 12.0 },
        size: { x: 8.0, y: floorHeight, z: 10.0 },
        doorPosition: { x: -2.3, y: floorHeight * 2, z: 12.0 },
      },
    ];

    this.floors = [
      {
        floorNumber: 1,
        elevation: 0.0,
        height: floorHeight,
        corridorLength: 46.0,
        corridorWidth: 4.6,
        rooms: f1Rooms,
        stairPosition: { x: 5.5, y: 0.0, z: -12.0 },
        elevatorPosition: { x: 5.5, y: 0.0, z: 2.0 },
      },
      {
        floorNumber: 2,
        elevation: floorHeight,
        height: floorHeight,
        corridorLength: 46.0,
        corridorWidth: 4.6,
        rooms: f2Rooms,
        stairPosition: { x: 5.5, y: floorHeight, z: -12.0 },
        elevatorPosition: { x: 5.5, y: floorHeight, z: 2.0 },
      },
      {
        floorNumber: 3,
        elevation: floorHeight * 2,
        height: floorHeight,
        corridorLength: 46.0,
        corridorWidth: 4.6,
        rooms: f3Rooms,
        stairPosition: { x: 5.5, y: floorHeight * 2, z: -12.0 },
        elevatorPosition: { x: 5.5, y: floorHeight * 2, z: 2.0 },
      },
    ];
  }

  private addStaticBox(
    posX: number,
    posY: number,
    posZ: number,
    halfWidth: number,
    halfHeight: number,
    halfDepth: number,
    friction: number = 0.5
  ): void {
    if (!this.physics) return;
    const res = this.physics.createStaticBox(posX, posY, posZ, halfWidth, halfHeight, halfDepth, friction);
    if (res) {
      this.staticBodies.push(res.body);
    }
  }

  private addStaticIncline(
    posX: number,
    posY: number,
    posZ: number,
    halfWidth: number,
    halfHeight: number,
    halfDepth: number,
    rotationX: number = 0,
    rotationY: number = 0,
    rotationZ: number = 0
  ): void {
    if (!this.physics) return;
    const res = this.physics.createStaticIncline(posX, posY, posZ, halfWidth, halfHeight, halfDepth, rotationX, rotationY, rotationZ);
    if (res) {
      this.staticBodies.push(res.body);
    }
  }

  private clearPhysicsBodies(): void {
    if (this.physics) {
      for (const body of this.staticBodies) {
        this.physics.removeBody(body);
      }
    }
    this.staticBodies = [];
  }

  async build(scene: THREE.Scene, physics: PhysicsWorld, debugVisualizer?: DebugVisualizer): Promise<void> {
    this.scene = scene;
    this.physics = physics;
    if (debugVisualizer) {
      this.debugVisualizer = debugVisualizer;
    }

    // Clear any previous geometry & colliders
    while (this.buildingGroup.children.length > 0) {
      const child = this.buildingGroup.children[0];
      this.buildingGroup.remove(child);
      if ((child as any).geometry) (child as any).geometry.dispose();
    }
    this.clearPhysicsBodies();

    if (!this.scene.children.includes(this.buildingGroup)) {
      this.scene.add(this.buildingGroup);
    }

    if (this.buildingMode === 'reconstructed') {
      try {
        await this.loadReconstructedBuilding(undefined, undefined, debugVisualizer);
      } catch (err) {
        console.warn('[Reconstruction Fallback] Reconstructed building failed to load, falling back to procedural building:', err);
        this.buildingMode = 'procedural';
        await this.loadProceduralBuilding();
      }
    } else {
      await this.loadProceduralBuilding();
    }
  }

  public async loadProceduralBuilding(): Promise<void> {
    // Build Ground & Floors
    this.buildFloorsAndCeilings();

    // Build Perimeter & Corridor Walls for each level
    this.buildWalls();

    // Build Rooms and Doors
    this.buildRooms();

    // Build Staircases connecting Floor 1 -> Floor 2 -> Floor 3
    this.buildStaircases();

    // Build Elevator Shaft and Doors
    this.buildElevatorShaft();

    // Add Architectural Lighting & Details
    this.buildLightingFixtures();

    // Register Interactive Zones
    this.registerInteractiveZones();
  }

  public async loadReconstructedBuilding(
    glbUrl: string = BUILDING_CONFIG.glbUrl,
    metadataUrl: string = BUILDING_CONFIG.metadataUrl,
    debugVisualizer?: DebugVisualizer
  ): Promise<void> {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();

    // 1. Fetch metadata if available
    try {
      const res = await fetch(metadataUrl);
      if (res.ok) {
        this.reconstructedMetadata = await res.json();
      }
    } catch (e) {
      console.warn('Could not load reconstructed metadata:', e);
    }

    // 2. Load GLB model
    const gltf = await new Promise<any>((resolve, reject) => {
      loader.load(glbUrl, resolve, undefined, reject);
    });

    const model = gltf.scene || gltf.scenes[0];
    this.reconstructedModel = model;

    // Apply vertical ground alignment:
    // In raw photogrammetry, entrance floor is at Y = -1.70m (camera at eye height Y = 0)
    // We elevate the model by +1.70m along Y so the entrance floor sits at Y = 0.0m
    model.position.set(
      BUILDING_CONFIG.reconstructedOffset.x,
      BUILDING_CONFIG.reconstructedOffset.y,
      BUILDING_CONFIG.reconstructedOffset.z
    );

    model.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.geometry) {
          child.geometry.computeVertexNormals();
        }
        if (child.material) {
          child.material.side = THREE.DoubleSide;
          if (child.geometry && child.geometry.attributes.color) {
            child.material.vertexColors = true;
          }
          child.material.roughness = 0.65;
          child.material.metalness = 0.1;
          child.material.needsUpdate = true;
        }
      }
    });

    this.buildingGroup.add(model);

    // 3. Register separated Rapier physics colliders
    // Top surface of walkable floor at Y = 0.0m
    // Bounds: X [-13.03, 10.37] (width 23.4m), Z [2.14, 54.37] (length 52.23m)
    const floorCenterX = -1.33;
    const floorCenterZ = 28.26;
    const floorHalfW = 11.70;
    const floorHalfL = 26.12;

    // Walkable floor slab (thickness 0.3m, top at Y = 0.0m)
    this.addStaticBox(floorCenterX, -0.15, floorCenterZ, floorHalfW, 0.15, floorHalfL, 0.6);

    // Outer boundary walls (prevent falling off or escaping the reconstructed building)
    const wallH = 2.5;
    this.addStaticBox(-13.1, wallH, floorCenterZ, 0.2, wallH, floorHalfL); // West wall
    this.addStaticBox(10.4, wallH, floorCenterZ, 0.2, wallH, floorHalfL);  // East wall
    this.addStaticBox(floorCenterX, wallH, 2.14, floorHalfW, wallH, 0.2); // South entrance back wall
    this.addStaticBox(floorCenterX, wallH, 54.37, floorHalfW, wallH, 0.2); // North far end wall

    // Hallway corridor partitions at the entrance foyer (creating natural guided hallway)
    this.addStaticBox(-1.3, 2.0, 4.75, 0.15, 2.0, 2.25); // West entrance partition
    this.addStaticBox(1.9, 2.0, 4.25, 0.15, 2.0, 1.75);  // East entrance partition

    // Foyer staircase incline & landing (staircase at X: 0.8 to 2.5, Z: 3.5 to 7.0)
    this.addStaticIncline(1.65, 0.8, 5.25, 0.8, 0.15, 1.6, 0.44); // Incline ramp
    this.addStaticBox(1.65, 1.6, 6.8, 0.8, 0.15, 0.5);            // Top landing

    // Major obstacles: Central fireplace column and dining table volume
    this.addStaticBox(-1.5, 2.0, 22.0, 0.6, 2.0, 0.6);  // Central structural column / fireplace
    this.addStaticBox(0.0, 0.45, 34.0, 1.2, 0.45, 1.8);  // Central dining table area

    // 4. Floating 3D Signage Badges for Reconstructed Areas
    const signFoyer = this.createFloatingTextBadge('MAIN SOUTH ENTRANCE', 4.0, 1.0, 0x00f2fe);
    signFoyer.position.set(0.0, 2.4, 4.5);
    this.buildingGroup.add(signFoyer);

    const signStairs = this.createFloatingTextBadge('FOYER STAIRCASE', 3.5, 0.9, 0xf59e0b);
    signStairs.position.set(1.65, 2.4, 5.25);
    this.buildingGroup.add(signStairs);

    const signLab = this.createFloatingTextBadge('ROOM 101 - ROBOTICS WING', 4.5, 1.0, 0x10b981);
    signLab.position.set(-5.5, 2.4, 28.0);
    this.buildingGroup.add(signLab);

    const signLounge = this.createFloatingTextBadge('EXECUTIVE SEMINAR ARENA', 4.5, 1.0, 0x8b5cf6);
    signLounge.position.set(0.0, 2.4, 48.0);
    this.buildingGroup.add(signLounge);

    // 5. Register interactive zones
    this.registerReconstructedInteractiveZones();

    // 6. Debug visualizer setup if active
    const dbg = debugVisualizer || this.debugVisualizer;
    if (dbg) {
      dbg.clear();
      // Model bounding box (offset by Y + 1.70)
      dbg.addBoundingBox(
        new THREE.Vector3(-13.03, -4.86, 2.14),
        new THREE.Vector3(10.37, 7.07, 54.37),
        0x00f2fe
      );
      dbg.addSpawnMarker(BUILDING_CONFIG.reconstructedSpawn, 0x00ff88);
      // Floor wireframe
      dbg.addCollisionBox(floorCenterX, -0.15, floorCenterZ, floorHalfW, 0.15, floorHalfL, 0x00aaff);
      // Outer walls
      dbg.addCollisionBox(-13.1, wallH, floorCenterZ, 0.2, wallH, floorHalfL, 0xffaa00);
      dbg.addCollisionBox(10.4, wallH, floorCenterZ, 0.2, wallH, floorHalfL, 0xffaa00);
      dbg.addCollisionBox(floorCenterX, wallH, 2.14, floorHalfW, wallH, 0.2, 0xffaa00);
      dbg.addCollisionBox(floorCenterX, wallH, 54.37, floorHalfW, wallH, 0.2, 0xffaa00);
      // Partitions
      dbg.addCollisionBox(-1.3, 2.0, 4.75, 0.15, 2.0, 2.25, 0xff5500);
      dbg.addCollisionBox(1.9, 2.0, 4.25, 0.15, 2.0, 1.75, 0xff5500);
      // Obstacles
      dbg.addCollisionBox(-1.5, 2.0, 22.0, 0.6, 2.0, 0.6, 0xff00ff);
      dbg.addCollisionBox(0.0, 0.45, 34.0, 1.2, 0.45, 1.8, 0xff00ff);
      // Axes and grid
      dbg.addAxes(5.0);
      dbg.addFloorGrid(60, 60, 0.0);

      // Reconstructed Navigation Graph & POI Anchors
      dbg.visualizeReconstructedGraph(
        RECONSTRUCTED_GRAPH_NODES,
        RECONSTRUCTED_GRAPH_EDGES,
        RECONSTRUCTED_POI_ANCHORS
      );
    }
  }

  private registerReconstructedInteractiveZones(): void {
    this.interactiveZones = [
      {
        id: 'rec_zone_entrance',
        name: 'Main South Entrance Portal',
        type: 'info',
        position: { x: 0.0, y: 0.0, z: 4.5 },
        radius: 3.0,
        prompt: 'Press [E] to Inspect Reconstructed IIT Bombay Twin Portal',
      },
      {
        id: 'rec_zone_stairs',
        name: 'Grand Foyer Staircase',
        type: 'stairs',
        position: { x: 1.5, y: 0.0, z: 5.2 },
        radius: 2.5,
        prompt: 'Press [E] to Climb Foyer Staircase',
      },
      {
        id: 'rec_zone_lab_101',
        name: 'Room 101 - Techfest Robotics Wing',
        type: 'room',
        position: { x: -5.5, y: 0.0, z: 28.0 },
        radius: 4.0,
        prompt: 'Press [E] to Enter Room 101 Robotics Wing',
      },
      {
        id: 'rec_zone_living_lounge',
        name: 'Executive Lounge & Seminar Arena',
        type: 'room',
        position: { x: 0.0, y: 0.0, z: 48.0 },
        radius: 5.0,
        prompt: 'Press [E] to Access Executive Seminar Arena',
      },
    ];
  }

  private buildFloorsAndCeilings(): void {
    if (!this.physics) return;

    // Building footprint: width 24m (from x = -12 to +12), length 50m (from z = -25 to +25)
    const buildingWidth = 24.0;
    const buildingLength = 50.0;
    const slabThickness = 0.3;

    // 1. Ground Floor Slab (Solid)
    const groundMesh = new THREE.Mesh(
      new THREE.BoxGeometry(buildingWidth, slabThickness, buildingLength),
      this.materials['floor']
    );
    groundMesh.position.set(0, -slabThickness / 2, 0);
    groundMesh.receiveShadow = true;
    this.buildingGroup.add(groundMesh);

    this.physics.createStaticBox(0, -slabThickness / 2, 0, buildingWidth / 2, slabThickness / 2, buildingLength / 2);

    // 2. Floor 2 & Floor 3 slabs (with stairwell cutout & elevator shaft cutout)
    [4.5, 9.0].forEach((elevation) => {
      // Split floor slab into segments around the stairwell (x: 2.5 to 8.5, z: -18 to -6) and elevator (x: 3.5 to 7.5, z: 0 to 4)
      // West segment (covers rooms 101-103 and corridor): x from -12 to 2.5 (width 14.5)
      const westWidth = 14.5;
      const westX = -12.0 + westWidth / 2; // -4.75
      const westSlab = new THREE.Mesh(
        new THREE.BoxGeometry(westWidth, slabThickness, buildingLength),
        this.materials['floor']
      );
      westSlab.position.set(westX, elevation - slabThickness / 2, 0);
      westSlab.receiveShadow = true;
      this.buildingGroup.add(westSlab);
      this.physics?.createStaticBox(westX, elevation - slabThickness / 2, 0, westWidth / 2, slabThickness / 2, buildingLength / 2);

      // East-North segment (beyond stairwell, z: -25 to -18)
      const enLength = 7.0;
      const enWidth = 9.5;
      const enMesh = new THREE.Mesh(
        new THREE.BoxGeometry(enWidth, slabThickness, enLength),
        this.materials['floor']
      );
      enMesh.position.set(2.5 + enWidth / 2, elevation - slabThickness / 2, -25 + enLength / 2);
      enMesh.receiveShadow = true;
      this.buildingGroup.add(enMesh);
      this.physics?.createStaticBox(2.5 + enWidth / 2, elevation - slabThickness / 2, -25 + enLength / 2, enWidth / 2, slabThickness / 2, enLength / 2);

      // East-South segment (z: 4 to 25)
      const esLength = 21.0;
      const esMesh = new THREE.Mesh(
        new THREE.BoxGeometry(enWidth, slabThickness, esLength),
        this.materials['floor']
      );
      esMesh.position.set(2.5 + enWidth / 2, elevation - slabThickness / 2, 4 + esLength / 2);
      esMesh.receiveShadow = true;
      this.buildingGroup.add(esMesh);
      this.physics?.createStaticBox(2.5 + enWidth / 2, elevation - slabThickness / 2, 4 + esLength / 2, enWidth / 2, slabThickness / 2, esLength / 2);

      // Landing bridge between stairs and elevator (z: -6 to 0)
      const bridgeLength = 6.0;
      const bridgeMesh = new THREE.Mesh(
        new THREE.BoxGeometry(enWidth, slabThickness, bridgeLength),
        this.materials['floor']
      );
      bridgeMesh.position.set(2.5 + enWidth / 2, elevation - slabThickness / 2, -6 + bridgeLength / 2);
      bridgeMesh.receiveShadow = true;
      this.buildingGroup.add(bridgeMesh);
      this.physics?.createStaticBox(2.5 + enWidth / 2, elevation - slabThickness / 2, -6 + bridgeLength / 2, enWidth / 2, slabThickness / 2, bridgeLength / 2);
    });

    // 3. Roof / Ceiling on Floor 3
    const roofY = 13.5;
    const roofMesh = new THREE.Mesh(
      new THREE.BoxGeometry(buildingWidth, slabThickness, buildingLength),
      this.materials['wallAccent']
    );
    roofMesh.position.set(0, roofY + slabThickness / 2, 0);
    this.buildingGroup.add(roofMesh);
    this.physics.createStaticBox(0, roofY + slabThickness / 2, 0, buildingWidth / 2, slabThickness / 2, buildingLength / 2);
  }

  private buildWalls(): void {
    if (!this.physics) return;

    const totalHeight = 13.5;
    const halfH = totalHeight / 2;
    const wallThick = 0.3;

    // Exterior Perimeter Walls
    // North Wall (z = -25)
    this.addWallMeshAndCollider(0, halfH, -25, 24.0, totalHeight, wallThick, this.materials['wall']);

    // South Wall (z = +25, with grand entrance doorway at center: x in [-2, 2])
    // Left South
    this.addWallMeshAndCollider(-7.0, halfH, 25, 10.0, totalHeight, wallThick, this.materials['wall']);
    // Right South
    this.addWallMeshAndCollider(7.0, halfH, 25, 10.0, totalHeight, wallThick, this.materials['wall']);
    // Lintel above entrance (from y = 3.5 to 13.5)
    this.addWallMeshAndCollider(0, 3.5 + (totalHeight - 3.5) / 2, 25, 4.0, totalHeight - 3.5, wallThick, this.materials['wallAccent']);

    // West Outer Wall (x = -12)
    this.addWallMeshAndCollider(-12, halfH, 0, wallThick, totalHeight, 50.0, this.materials['wall']);

    // East Outer Wall (x = +12)
    this.addWallMeshAndCollider(12, halfH, 0, wallThick, totalHeight, 50.0, this.materials['wall']);

    // Grand Entrance Arch / Canopy Signage on Floor 1
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(6.0, 0.4, 3.0),
      this.materials['doorFrame']
    );
    canopy.position.set(0, 3.7, 26.5);
    this.buildingGroup.add(canopy);

    const sign = this.createFloatingTextBadge('MAIN ENTRANCE • TECHFEST CAMPUS', 3.0, 0.5, 0x00f2fe);
    sign.position.set(0, 4.2, 26.6);
    this.buildingGroup.add(sign);
  }

  private buildRooms(): void {
    const floorH = 4.5;
    const wallThick = 0.2;

    this.floors.forEach((fl) => {
      const baseY = fl.elevation;
      const midY = baseY + floorH / 2;

      // West Corridor Wall (separating corridor from rooms 101/102/103 etc.)
      // Runs from z = -25 to +25 at x = -2.3, with door openings for each room
      fl.rooms.forEach((rm) => {
        // Room divider wall between rooms
        this.addWallMeshAndCollider(
          -7.0,
          midY,
          rm.center.z - rm.size.z / 2,
          8.0,
          floorH,
          wallThick,
          this.materials['wall']
        );

        // Corridor wall segment (with door opening)
        // Door opening is 1.6m wide, centered at rm.doorPosition.z
        const doorZ = rm.doorPosition.z;
        const halfDoorW = 0.8;
        const segmentZ1 = rm.center.z - rm.size.z / 2;
        const segmentZ2 = rm.center.z + rm.size.z / 2;

        // North segment of room's corridor wall
        const lenN = (doorZ - halfDoorW) - segmentZ1;
        if (lenN > 0.1) {
          const zN = segmentZ1 + lenN / 2;
          this.addWallMeshAndCollider(-2.3, midY, zN, wallThick, floorH, lenN, this.materials['wall']);
        }

        // South segment of room's corridor wall
        const lenS = segmentZ2 - (doorZ + halfDoorW);
        if (lenS > 0.1) {
          const zS = (doorZ + halfDoorW) + lenS / 2;
          this.addWallMeshAndCollider(-2.3, midY, zS, wallThick, floorH, lenS, this.materials['wall']);
        }

        // Door header (lintel above door)
        const doorH = 2.4;
        const lintelH = floorH - doorH;
        this.addWallMeshAndCollider(
          -2.3,
          baseY + doorH + lintelH / 2,
          doorZ,
          wallThick,
          lintelH,
          halfDoorW * 2,
          this.materials['doorFrame']
        );

        // Open door frame visual accent
        const doorFrame = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, doorH, halfDoorW * 2),
          this.materials['doorFrame']
        );
        doorFrame.position.set(-2.28, baseY + doorH / 2, doorZ);
        this.buildingGroup.add(doorFrame);

        // Subtle glowing Room Label Badge above door
        const labelBadge = this.createFloatingTextBadge(
          `ROOM ${rm.number}`,
          1.8,
          0.4,
          0x00f2fe
        );
        labelBadge.position.set(-2.15, baseY + doorH + 0.35, doorZ);
        labelBadge.rotation.y = Math.PI / 2;
        this.buildingGroup.add(labelBadge);

        // Subtle interior accent light for each room
        const roomLight = new THREE.PointLight(0xfff0dd, 0.4, 12);
        roomLight.position.set(rm.center.x, baseY + 3.8, rm.center.z);
        this.buildingGroup.add(roomLight);
      });

      // End divider for south-most room
      this.addWallMeshAndCollider(-7.0, midY, 17.0, 8.0, floorH, wallThick, this.materials['wall']);
      this.addWallMeshAndCollider(-7.0, midY, -19.0, 8.0, floorH, wallThick, this.materials['wall']);
    });
  }

  private buildStaircases(): void {
    if (!this.physics) return;

    // Staircase A: connects Floor 1 -> Floor 2 -> Floor 3
    // Position: East of corridor, around x = 5.5, running from z = -17 to z = -7
    const stairWidth = 2.8;
    const startZ = -16.5;
    const endZ = -7.5;
    const flightLength = endZ - startZ; // 9.0m
    const numSteps = 18;
    const stepDepth = flightLength / numSteps; // 0.5m
    const stepHeight = 4.5 / numSteps; // 0.25m

    [0.0, 4.5].forEach((baseElevation) => {
      // Build visual steps
      for (let i = 0; i < numSteps; i++) {
        const stepY = baseElevation + (i + 0.5) * stepHeight;
        const stepZ = startZ + (i + 0.5) * stepDepth;

        const stepMesh = new THREE.Mesh(
          new THREE.BoxGeometry(stairWidth, stepHeight, stepDepth),
          this.materials['stair']
        );
        stepMesh.position.set(5.5, stepY, stepZ);
        stepMesh.receiveShadow = true;
        this.buildingGroup.add(stepMesh);
      }

      // Physics Ramp Collider: smooth incline that enables the character controller
      // to walk up and down flawlessly without catching step edges!
      const slopeAngle = Math.atan2(4.5, flightLength);
      const inclineLength = Math.sqrt(flightLength * flightLength + 4.5 * 4.5);
      const rampThickness = 0.15;

      this.physics?.createStaticIncline(
        5.5,
        baseElevation + 2.25,
        (startZ + endZ) / 2,
        stairWidth / 2,
        rampThickness / 2,
        inclineLength / 2,
        slopeAngle,
        0,
        0
      );

      // Glowing handrails
      const railGeom = new THREE.CylinderGeometry(0.04, 0.04, inclineLength, 8);
      const leftRail = new THREE.Mesh(railGeom, this.materials['handrail']);
      leftRail.position.set(5.5 - stairWidth / 2, baseElevation + 2.25 + 0.9, (startZ + endZ) / 2);
      leftRail.rotation.x = Math.PI / 2 - slopeAngle;
      this.buildingGroup.add(leftRail);

      const rightRail = new THREE.Mesh(railGeom, this.materials['handrail']);
      rightRail.position.set(5.5 + stairWidth / 2, baseElevation + 2.25 + 0.9, (startZ + endZ) / 2);
      rightRail.rotation.x = Math.PI / 2 - slopeAngle;
      this.buildingGroup.add(rightRail);

      // Staircase Identification Signage
      const stairSign = this.createFloatingTextBadge(`STAIRCASE A • LEVEL UP`, 2.2, 0.45, 0x4facfe);
      stairSign.position.set(5.5, baseElevation + 3.2, startZ - 0.5);
      this.buildingGroup.add(stairSign);
    });

    // Guardrail around stairwell opening on Floor 2 and 3
    [4.5, 9.0].forEach((elev) => {
      // East railing along opening
      this.addWallMeshAndCollider(5.5 + stairWidth / 2 + 0.1, elev + 0.5, (startZ + endZ) / 2, 0.1, 1.0, flightLength, this.materials['handrail']);
      // North railing
      this.addWallMeshAndCollider(5.5, elev + 0.5, startZ, stairWidth, 1.0, 0.1, this.materials['handrail']);
    });
  }

  private buildElevatorShaft(): void {
    // Elevator A: Located at x = 5.5, z = 2.0
    // Multi-floor glass/metal structural enclosure
    const shaftW = 3.6;
    const shaftD = 3.6;
    const totalH = 13.5;
    const shaftX = 5.5;
    const shaftZ = 2.0;

    // Transparent structural glass frame
    const shaftMesh = new THREE.Mesh(
      new THREE.BoxGeometry(shaftW, totalH, shaftD),
      this.materials['elevatorShaft']
    );
    shaftMesh.position.set(shaftX, totalH / 2, shaftZ);
    this.buildingGroup.add(shaftMesh);

    // Colliders for back and sides of elevator shaft
    const wallT = 0.2;
    // East wall of shaft
    this.addWallMeshAndCollider(shaftX + shaftW / 2, totalH / 2, shaftZ, wallT, totalH, shaftD, this.materials['elevatorShaft']);
    // North wall of shaft
    this.addWallMeshAndCollider(shaftX, totalH / 2, shaftZ - shaftD / 2, shaftW, totalH, wallT, this.materials['elevatorShaft']);
    // South wall of shaft
    this.addWallMeshAndCollider(shaftX, totalH / 2, shaftZ + shaftD / 2, shaftW, totalH, wallT, this.materials['elevatorShaft']);

    // Elevator Doors & Interactive Call Panels on each floor (West face of shaft, facing corridor)
    [0.0, 4.5, 9.0].forEach((elev, idx) => {
      const doorH = 2.6;
      const doorW = 1.8;

      // Sliding brushed metal doors
      const doorMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, doorH, doorW),
        this.materials['elevatorDoor']
      );
      doorMesh.position.set(shaftX - shaftW / 2 + 0.05, elev + doorH / 2, shaftZ);
      this.buildingGroup.add(doorMesh);

      // Glowing Elevator Floor Indicator
      const floorIndicator = this.createFloatingTextBadge(`ELEVATOR A [L${idx + 1}]`, 2.0, 0.45, 0x00f2fe);
      floorIndicator.position.set(shaftX - shaftW / 2 - 0.1, elev + doorH + 0.35, shaftZ);
      floorIndicator.rotation.y = -Math.PI / 2;
      this.buildingGroup.add(floorIndicator);

      // Call button pedestal
      const callBtn = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.3, 0.15),
        this.materials['elevatorGlow']
      );
      callBtn.position.set(shaftX - shaftW / 2 - 0.1, elev + 1.2, shaftZ + 1.3);
      this.buildingGroup.add(callBtn);
    });
  }

  private buildLightingFixtures(): void {
    // Elegant corridor ceiling strip lights along Z axis
    const corridorLightsZ = [-20, -12, -4, 4, 12, 20];
    [0.0, 4.5, 9.0].forEach((elev) => {
      corridorLightsZ.forEach((z) => {
        // Light fixture mesh
        const fixture = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.08, 2.5),
          this.materials['ceilingLight']
        );
        fixture.position.set(0, elev + 4.4, z);
        this.buildingGroup.add(fixture);

        // Point light for realistic indoor illumination
        const pl = new THREE.PointLight(0xffffff, 0.55, 14);
        pl.position.set(0, elev + 4.1, z);
        this.buildingGroup.add(pl);
      });
    });
  }

  private registerInteractiveZones(): void {
    // Elevator interactive zones on all floors
    [1, 2, 3].forEach((floorNum) => {
      const elev = (floorNum - 1) * 4.5;
      this.interactiveZones.push({
        id: `elev_floor_${floorNum}`,
        name: `Elevator A (Floor ${floorNum})`,
        type: 'elevator',
        position: { x: 3.5, y: elev, z: 2.0 },
        radius: 2.4,
        prompt: `Press [E] to Call Elevator to Floor ${floorNum}`,
      });
    });

    // Room doors interactive zones
    this.floors.forEach((fl) => {
      fl.rooms.forEach((rm) => {
        this.interactiveZones.push({
          id: `door_${rm.id}`,
          name: rm.name,
          type: 'room',
          position: { x: rm.doorPosition.x + 0.8, y: rm.doorPosition.y, z: rm.doorPosition.z },
          radius: 2.0,
          prompt: `Press [E] to Enter ${rm.name}`,
        });
      });
    });

    // Entrance info zone
    this.interactiveZones.push({
      id: 'entrance_info',
      name: 'IIT Bombay Techfest Welcome Kiosk',
      type: 'info',
      position: { x: 0, y: 0, z: 22.0 },
      radius: 2.8,
      prompt: 'Press [E] to View Building Directory',
    });
  }

  private addWallMeshAndCollider(
    posX: number,
    posY: number,
    posZ: number,
    sizeX: number,
    sizeY: number,
    sizeZ: number,
    material: THREE.Material
  ): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(sizeX, sizeY, sizeZ),
      material
    );
    mesh.position.set(posX, posY, posZ);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.buildingGroup.add(mesh);

    this.physics?.createStaticBox(posX, posY, posZ, sizeX / 2, sizeY / 2, sizeZ / 2);
  }

  /**
   * Helper to create crisp high-resolution text badge sprites for room signage
   */
  private createFloatingTextBadge(
    text: string,
    width: number,
    height: number,
    glowColor: number = 0x00f2fe
  ): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Dark sleek background pill
    ctx.fillStyle = 'rgba(10, 15, 24, 0.88)';
    ctx.roundRect(10, 10, 492, 108, 20);
    ctx.fill();

    // Glowing border
    ctx.lineWidth = 6;
    ctx.strokeStyle = `#${glowColor.toString(16).padStart(6, '0')}`;
    ctx.stroke();

    // High contrast typography
    ctx.font = 'bold 36px Outfit, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const planeMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
    });

    return new THREE.Mesh(new THREE.PlaneGeometry(width, height), planeMat);
  }

  getInteractiveZones(): InteractiveZone[] {
    return this.interactiveZones;
  }

  getFloors(): FloorDefinition[] {
    return this.floors;
  }

  getFloorByHeight(y: number): number {
    if (y < 3.8) return 1;
    if (y < 8.3) return 2;
    return 3;
  }

  dispose(): void {
    this.clearPhysicsBodies();
    while (this.buildingGroup.children.length > 0) {
      const child = this.buildingGroup.children[0];
      this.buildingGroup.remove(child);
      if ((child as any).geometry) (child as any).geometry.dispose();
    }
    if (this.scene && this.buildingGroup) {
      this.scene.remove(this.buildingGroup);
    }
    Object.values(this.materials).forEach((m) => m.dispose());
  }
}
