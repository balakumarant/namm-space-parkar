import RAPIER from '@dimforge/rapier3d-compat';

export class PhysicsWorld {
  public world: RAPIER.World | null = null;
  public rapier: typeof RAPIER | null = null;
  public isReady: boolean = false;

  async init(): Promise<void> {
    await RAPIER.init();
    this.rapier = RAPIER;
    // Standard responsive indoor gravity
    const gravity = new RAPIER.Vector3(0.0, -18.0, 0.0);
    this.world = new RAPIER.World(gravity);
    this.isReady = true;
  }

  step(): void {
    if (this.world) {
      this.world.step();
    }
  }

  /**
   * Create a static box collider in the physics world
   */
  createStaticBox(
    posX: number,
    posY: number,
    posZ: number,
    halfWidth: number,
    halfHeight: number,
    halfDepth: number,
    friction: number = 0.5
  ): { body: RAPIER.RigidBody; collider: RAPIER.Collider } | null {
    if (!this.world || !this.rapier) return null;

    const bodyDesc = this.rapier.RigidBodyDesc.fixed().setTranslation(posX, posY, posZ);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = this.rapier.ColliderDesc.cuboid(halfWidth, halfHeight, halfDepth)
      .setFriction(friction)
      .setRestitution(0.0);
    const collider = this.world.createCollider(colliderDesc, body);

    return { body, collider };
  }

  /**
   * Create an inclined static collider (ramp / smooth stair support)
   */
  createStaticIncline(
    posX: number,
    posY: number,
    posZ: number,
    halfWidth: number,
    halfHeight: number,
    halfDepth: number,
    rotationX: number = 0,
    _rotationY: number = 0,
    _rotationZ: number = 0
  ): { body: RAPIER.RigidBody; collider: RAPIER.Collider } | null {
    if (!this.world || !this.rapier) return null;

    // Using Euler angles to quaternion in Rapier
    const qx = Math.sin(rotationX / 2);
    const qw = Math.cos(rotationX / 2);
    const bodyDesc = this.rapier.RigidBodyDesc.fixed()
      .setTranslation(posX, posY, posZ)
      .setRotation({ x: qx, y: 0, z: 0, w: qw });

    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = this.rapier.ColliderDesc.cuboid(halfWidth, halfHeight, halfDepth)
      .setFriction(0.3)
      .setRestitution(0.0);
    const collider = this.world.createCollider(colliderDesc, body);

    return { body, collider };
  }

  /**
   * Create a Kinematic Character Controller with autostep and slope sliding
   */
  createCharacterController(): RAPIER.KinematicCharacterController | null {
    if (!this.world) return null;

    const offset = 0.05;
    const controller = this.world.createCharacterController(offset);
    // Allow stepping up stairs up to 0.35m
    controller.enableAutostep(0.35, 0.2, true);
    // Snap to ground up to 0.5m down to prevent floating on descent
    controller.enableSnapToGround(0.5);
    controller.setSlideEnabled(true);
    controller.setMaxSlopeClimbAngle((48 * Math.PI) / 180);
    controller.setMinSlopeSlideAngle((50 * Math.PI) / 180);

    return controller;
  }

  /**
   * Create the Player Kinematic Rigid Body & Capsule Collider
   */
  createPlayerCapsule(
    startX: number,
    startY: number,
    startZ: number,
    radius: number = 0.4,
    halfHeight: number = 0.65
  ): { body: RAPIER.RigidBody; collider: RAPIER.Collider } | null {
    if (!this.world || !this.rapier) return null;

    const bodyDesc = this.rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(startX, startY, startZ);
    const body = this.world.createRigidBody(bodyDesc);

    // Total height = 2 * halfHeight + 2 * radius ~= 1.3 + 0.8 = 2.1m (player capsule)
    const colliderDesc = this.rapier.ColliderDesc.capsule(halfHeight, radius)
      .setFriction(0.0)
      .setRestitution(0.0);
    const collider = this.world.createCollider(colliderDesc, body);

    return { body, collider };
  }

  removeBody(body: RAPIER.RigidBody): void {
    if (this.world && body) {
      try {
        this.world.removeRigidBody(body);
      } catch (err) {
        console.warn('PhysicsWorld.removeBody warning:', err);
      }
    }
  }

  dispose(): void {
    if (this.world) {
      this.world.free();
      this.world = null;
    }
  }
}
