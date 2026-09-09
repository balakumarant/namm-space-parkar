import * as THREE from 'three';

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private domElement: HTMLElement;
  private dirLight: THREE.DirectionalLight | null = null;

  constructor(container: HTMLElement) {
    this.domElement = container;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080b10);
    // Subtle indoor fog for spatial depth
    this.scene.fog = new THREE.FogExp2(0x080b10, 0.012);

    // 2. Camera (default 75 deg FOV, appropriate for indoor FPS)
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 200);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.classList.add('game-canvas');
    container.appendChild(this.renderer.domElement);

    // 4. Lighting & Ambience
    this.setupLighting();

    // 5. Window Resize
    window.addEventListener('resize', this.onWindowResize);
  }

  private setupLighting(): void {
    // Ambient light for base visibility throughout building corridors
    const ambientLight = new THREE.AmbientLight(0xd9e4f2, 1.4);
    this.scene.add(ambientLight);

    // Hemisphere light for natural sky/ground contrast
    const hemiLight = new THREE.HemisphereLight(0x4facfe, 0x1a2130, 0.8);
    hemiLight.position.set(0, 30, 0);
    this.scene.add(hemiLight);

    // Key Directional Light (angled down through entrance / skylight)
    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
    this.dirLight.position.set(15, 25, 25);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 60;

    const d = 30;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;

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
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
