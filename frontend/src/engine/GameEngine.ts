import * as THREE from 'three';
import { SceneManager } from './SceneManager';
import { PhysicsWorld } from './PhysicsWorld';
import { BuildingLoader } from './BuildingLoader';
import { PlayerController } from './PlayerController';
import { RouteVisualizer } from './RouteVisualizer';
import { Waypoint } from '../services/pathfinding';
import { EngineCallbacks } from './types';

export class GameEngine {
  public sceneManager: SceneManager;
  public physicsWorld: PhysicsWorld;
  public buildingLoader: BuildingLoader;
  public playerController: PlayerController | null = null;
  public routeVisualizer: RouteVisualizer;

  private clock: THREE.Clock = new THREE.Clock();
  private isRunning: boolean = false;
  private animationFrameId: number | null = null;
  private callbacks: EngineCallbacks;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.callbacks = callbacks;
    this.sceneManager = new SceneManager(container);
    this.physicsWorld = new PhysicsWorld();
    this.buildingLoader = new BuildingLoader();
    this.routeVisualizer = new RouteVisualizer(this.sceneManager.scene);
  }

  public async init(): Promise<void> {
    // 1. Initialize Rapier 3D Physics WASM
    await this.physicsWorld.init();

    // 2. Build 3D Building Geometry and static colliders
    await this.buildingLoader.build(this.sceneManager.scene, this.physicsWorld);

    // 3. Initialize Player Avatar & Controller
    this.playerController = new PlayerController(
      this.sceneManager.camera,
      this.sceneManager.scene,
      this.physicsWorld,
      this.sceneManager.renderer.domElement,
      this.callbacks
    );

    // Register interactive zones with player controller
    this.playerController.setInteractiveZones(this.buildingLoader.getInteractiveZones());

    // 4. Start Render & Game Loop
    this.start();
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();
    this.loop();
  }

  private loop = (): void => {
    if (!this.isRunning) return;

    const delta = this.clock.getDelta();

    // 1. Step Physics World
    this.physicsWorld.step();

    // 2. Update Player Controller
    if (this.playerController) {
      this.playerController.update(delta, (y) => this.buildingLoader.getFloorByHeight(y));
    }

    // 3. Update Route Visualizer animation
    this.routeVisualizer.update(delta);

    // 4. Render Three.js Scene
    this.sceneManager.render();

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  public setNavigationRoute(waypoints: Waypoint[]): void {
    this.routeVisualizer.setRoute(waypoints);
  }

  public clearNavigationRoute(): void {
    this.routeVisualizer.clearRoute();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public dispose(): void {
    this.stop();
    this.routeVisualizer.dispose();
    if (this.playerController) {
      this.playerController.dispose();
    }
    this.buildingLoader.dispose();
    this.physicsWorld.dispose();
    this.sceneManager.dispose();
  }
}
