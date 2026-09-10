import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private domElement: HTMLElement;
  private dirLight: THREE.DirectionalLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;
  private ambientLight: THREE.AmbientLight | null = null;
  private envMapTexture: THREE.Texture | null = null;

  constructor(container: HTMLElement) {
    this.domElement = container;

    // 1. Scene setup
    this.scene = new THREE.Scene();
    // Warm deep charcoal background for interior focus
    this.scene.background = new THREE.Color(0x0a0e14);
    // Delicate atmospheric fog for indoor visual depth without obscuring corridor
    this.scene.fog = new THREE.FogExp2(0x0a0e14, 0.009);

    // 2. Camera (70 deg FOV — natural human architectural interior perspective)
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(70, aspect, 0.1, 200);

    // 3. High-performance PBR Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.domElement.classList.add('game-canvas');
    container.appendChild(this.renderer.domElement);

    // 4. Image-Based Lighting (IBL) via RoomEnvironment
    this.setupEnvironmentMap();

    // 5. Lighting & Ambience
    this.setupLighting();

    // 6. Window Resize
    window.addEventListener('resize', this.onWindowResize);
  }

  private setupEnvironmentMap(): void {
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    this.envMapTexture = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    this.scene.environment = this.envMapTexture;
    pmremGenerator.dispose();
  }

  private setupLighting(): void {
    // Warm ambient fill for balanced interior base illumination
    this.ambientLight = new THREE.AmbientLight(0xfff7ed, 0.35);
    this.scene.add(this.ambientLight);

    // Hemisphere light for subtle ceiling / floor thermal contrast
    this.hemiLight = new THREE.HemisphereLight(0xfffaed, 0x1f1914, 0.35);
    this.hemiLight.position.set(0, 20, 0);
    this.scene.add(this.hemiLight);

    // Sun / daylight entering from exterior openings
    this.dirLight = new THREE.DirectionalLight(0xfff6e8, 1.0);
    this.dirLight.position.set(8, 20, 14);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 40;

    const d = 16;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    // Bias settings tuned to prevent shadow acne and light leaks on architectural planes
    this.dirLight.shadow.bias = -0.0003;
    this.dirLight.shadow.normalBias = 0.02;

    this.scene.add(this.dirLight);
  }

  private onWindowResize = (): void => {
    if (!this.domElement) return;
    const width = this.domElement.clientWidth;
    const height = this.domElement.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    window.removeEventListener('resize', this.onWindowResize);
    if (this.envMapTexture) {
      this.envMapTexture.dispose();
      this.envMapTexture = null;
    }
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}

