import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from './PhysicsWorld';
import { CameraMode, EngineCallbacks, InteractiveZone, Vector3Tuple } from './types';

export class PlayerController {
  public camera: THREE.PerspectiveCamera;
  public cameraMode: CameraMode = 'fps';

  // Movement parameters
  public walkSpeed: number = 4.8;
  public sprintSpeed: number = 8.5;
  public jumpStrength: number = 7.0;
  public gravity: number = -20.0;
  public mouseSensitivity: number = 0.0022;
  public eyeHeight: number = 1.65;

  // Physics components
  private physics: PhysicsWorld;
  private body: RAPIER.RigidBody | null = null;
  private collider: RAPIER.Collider | null = null;
  private controller: RAPIER.KinematicCharacterController | null = null;

  // Input states
  private keys: { [key: string]: boolean } = {};
  private yaw: number = 0;
  private pitch: number = 0;
  private verticalVelocity: number = 0;
  private isGrounded: boolean = true;
  private isLocked: boolean = false;

  // Visual avatar placeholder (for shadows & 3rd person)
  private avatarMesh: THREE.Group = new THREE.Group();
  private scene: THREE.Scene;
  private domElement: HTMLElement;
  private callbacks: EngineCallbacks;

  // Interactive zones tracking
  private interactiveZones: InteractiveZone[] = [];
  private currentActiveZone: InteractiveZone | null = null;
  private spawnPosition: Vector3Tuple = { x: 0, y: 1.0, z: 22 };

  constructor(
    camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    physics: PhysicsWorld,
    domElement: HTMLElement,
    callbacks: EngineCallbacks,
    initialSpawn?: Vector3Tuple,
    initialYaw?: number
  ) {
    this.camera = camera;
    this.scene = scene;
    this.physics = physics;
    this.domElement = domElement;
    this.callbacks = callbacks;
    if (initialSpawn) {
      this.spawnPosition = { ...initialSpawn };
    }
    if (initialYaw !== undefined) {
      this.yaw = initialYaw;
    }

    this.initAvatar();
    this.initPhysics();
    this.initListeners();
  }

  private initAvatar(): void {
    // Low-poly futuristic human avatar capsule
    const bodyGeom = new THREE.CapsuleGeometry(0.35, 0.9, 8, 16);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      metalness: 0.7,
      roughness: 0.3,
    });
    const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
    bodyMesh.position.y = 0.8;
    bodyMesh.castShadow = true;
    this.avatarMesh.add(bodyMesh);

    // Visor with cyan tech glow
    const visorGeom = new THREE.BoxGeometry(0.35, 0.12, 0.25);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe });
    const visorMesh = new THREE.Mesh(visorGeom, visorMat);
    visorMesh.position.set(0, 1.35, -0.22);
    this.avatarMesh.add(visorMesh);

    this.scene.add(this.avatarMesh);
  }

  private initPhysics(): void {
    const { x: startX, y: startY, z: startZ } = this.spawnPosition;

    const playerPhysics = this.physics.createPlayerCapsule(startX, startY, startZ, 0.38, 0.55);
    if (playerPhysics) {
      this.body = playerPhysics.body;
      this.collider = playerPhysics.collider;
    }

    this.controller = this.physics.createCharacterController();
  }

  private initListeners(): void {
    // Key bindings
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    // Pointer lock & mouse look
    this.domElement.addEventListener('click', this.requestPointerLock);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('pointerlockerror', (e) => {
      console.warn('Pointer lock error/cancelled:', e);
    });
    window.addEventListener('mousemove', this.onMouseMove);
  }

  public requestPointerLock = (): void => {
    if (!this.isLocked && this.domElement) {
      try {
        const promise = this.domElement.requestPointerLock() as any;
        if (promise && typeof promise.catch === 'function') {
          promise.catch((err: any) => {
            console.warn('Pointer lock request rejected or cancelled:', err);
          });
        }
      } catch (err) {
        console.warn('Pointer lock invocation failed:', err);
      }
    }
  };

  private onPointerLockChange = (): void => {
    this.isLocked = document.pointerLockElement === this.domElement;
    this.callbacks.onLockStateChange(this.isLocked);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.isLocked) return;

    this.yaw -= e.movementX * this.mouseSensitivity;
    this.pitch -= e.movementY * this.mouseSensitivity;

    // Clamp pitch between -85 and +85 degrees
    const maxPitch = (85 * Math.PI) / 180;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    // Avoid capturing WASD/E/V while typing in input or textarea
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    this.keys[e.code] = true;

    // Interaction key E
    if (e.code === 'KeyE') {
      this.triggerInteraction();
    }

    // Toggle Camera mode (V key)
    if (e.code === 'KeyV') {
      this.cameraMode = this.cameraMode === 'fps' ? 'tps' : 'fps';
    }

    // Toggle Debug visualizer (B or F2 key)
    if (e.code === 'KeyB' || e.code === 'F2') {
      if (this.callbacks.onToggleDebug) {
        const active = this.callbacks.onToggleDebug();
        this.callbacks.onNotification(
          `Debug visualizer: ${active ? 'ENABLED (wireframes active)' : 'DISABLED'}`
        );
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys[e.code] = false;
  };

  public respawn(pos?: Vector3Tuple, yaw?: number): void {
    if (pos) {
      this.spawnPosition = { ...pos };
    }
    if (yaw !== undefined) {
      this.yaw = yaw;
      this.pitch = 0;
    }
    if (this.body) {
      this.body.setTranslation(
        new RAPIER.Vector3(this.spawnPosition.x, this.spawnPosition.y, this.spawnPosition.z),
        true
      );
    }
    this.verticalVelocity = 0;
    this.isGrounded = true;
    this.camera.position.set(this.spawnPosition.x, this.spawnPosition.y + this.eyeHeight, this.spawnPosition.z);
    this.avatarMesh.position.set(this.spawnPosition.x, this.spawnPosition.y, this.spawnPosition.z);
  }

  private triggerInteraction(): void {
    if (this.currentActiveZone) {
      if (this.currentActiveZone.type === 'elevator') {
        this.callbacks.onNotification(
          `Elevator A accessed! Doors opening... (${this.currentActiveZone.name})`
        );
      } else if (this.currentActiveZone.type === 'room') {
        this.callbacks.onNotification(
          `Entered ${this.currentActiveZone.name}!`
        );
      } else {
        this.callbacks.onNotification(
          `Viewing: ${this.currentActiveZone.name}`
        );
      }
    }
  }

  public setInteractiveZones(zones: InteractiveZone[]): void {
    this.interactiveZones = zones;
  }

  public update(delta: number, getFloorByHeight: (y: number) => number): void {
    if (!this.body || !this.collider || !this.controller) return;

    // Cap delta to avoid physics instability on tab switch
    const dt = Math.min(delta, 0.05);

    // Determine speed
    const isSprinting = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    const currentSpeed = isSprinting ? this.sprintSpeed : this.walkSpeed;

    // Directional vectors from yaw
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    // Compute input movement
    let moveX = 0;
    let moveZ = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) {
      moveX += forwardX;
      moveZ += forwardZ;
    }
    if (this.keys['KeyS'] || this.keys['ArrowDown']) {
      moveX -= forwardX;
      moveZ -= forwardZ;
    }
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
      moveX -= rightX;
      moveZ -= rightZ;
    }
    if (this.keys['KeyD'] || this.keys['ArrowRight']) {
      moveX += rightX;
      moveZ += rightZ;
    }

    // Normalize horizontal input
    const inputMag = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (inputMag > 0.001) {
      moveX = (moveX / inputMag) * currentSpeed;
      moveZ = (moveZ / inputMag) * currentSpeed;
    }

    // Handle jumping & gravity
    const wantJump = !!this.keys['Space'];
    if (this.isGrounded) {
      if (wantJump) {
        this.verticalVelocity = this.jumpStrength;
        this.isGrounded = false;
      } else {
        this.verticalVelocity = 0.0;
      }
    } else {
      this.verticalVelocity += this.gravity * dt;
    }

    // Total desired translation vector this frame
    const translation = new RAPIER.Vector3(
      moveX * dt,
      this.verticalVelocity * dt,
      moveZ * dt
    );

    // Calculate movement with Rapier collision resolution
    this.controller.computeColliderMovement(this.collider, translation);
    const corrected = this.controller.computedMovement();

    // Check grounded state
    this.isGrounded = this.controller.computedGrounded();

    // Apply translation to player kinematic rigid body
    const curPos = this.body.translation();
    const newPos = {
      x: curPos.x + corrected.x,
      y: curPos.y + corrected.y,
      z: curPos.z + corrected.z,
    };
    this.body.setNextKinematicTranslation(newPos);

    // Sync avatar mesh
    this.avatarMesh.position.set(newPos.x, newPos.y - 0.75, newPos.z);
    this.avatarMesh.rotation.y = this.yaw;

    // Update Camera position & orientation
    if (this.cameraMode === 'fps') {
      this.avatarMesh.visible = false;
      this.camera.position.set(newPos.x, newPos.y + this.eyeHeight - 0.75, newPos.z);
      const target = new THREE.Vector3(
        newPos.x - Math.sin(this.yaw) * Math.cos(this.pitch),
        newPos.y + this.eyeHeight - 0.75 + Math.sin(this.pitch),
        newPos.z - Math.cos(this.yaw) * Math.cos(this.pitch)
      );
      this.camera.lookAt(target);
    } else {
      // Third-person mode
      this.avatarMesh.visible = true;
      const tpsDist = 3.2;
      const camX = newPos.x + Math.sin(this.yaw) * Math.cos(this.pitch) * tpsDist;
      const camY = newPos.y + 1.6 - Math.sin(this.pitch) * tpsDist;
      const camZ = newPos.z + Math.cos(this.yaw) * Math.cos(this.pitch) * tpsDist;
      this.camera.position.set(camX, camY, camZ);
      this.camera.lookAt(new THREE.Vector3(newPos.x, newPos.y + 1.2, newPos.z));
    }

    // Check current floor level
    const currentFloor = getFloorByHeight(newPos.y);

    // Emit player move callback for HUD
    this.callbacks.onPlayerMove(
      { x: parseFloat(newPos.x.toFixed(2)), y: parseFloat(newPos.y.toFixed(2)), z: parseFloat(newPos.z.toFixed(2)) },
      currentFloor
    );

    // Check for nearest interactive zone
    this.checkInteractiveZones(newPos);
  }

  private checkInteractiveZones(playerPos: Vector3Tuple): void {
    let closestZone: InteractiveZone | null = null;
    let minDist = Infinity;

    for (const zone of this.interactiveZones) {
      const dx = playerPos.x - zone.position.x;
      const dy = playerPos.y - zone.position.y;
      const dz = playerPos.z - zone.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist <= zone.radius && dist < minDist) {
        minDist = dist;
        closestZone = zone;
      }
    }

    if (closestZone !== this.currentActiveZone) {
      this.currentActiveZone = closestZone;
      this.callbacks.onInteractionPrompt(closestZone ? closestZone.prompt : null, closestZone);
    }
  }

  public teleport(x: number, y: number, z: number): void {
    if (this.body) {
      this.body.setTranslation({ x, y, z }, true);
      this.verticalVelocity = 0;
    }
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.domElement.removeEventListener('click', this.requestPointerLock);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    window.removeEventListener('mousemove', this.onMouseMove);
  }
}
