import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  BIOME_PRESETS,
  CameraMode,
  ChassisId,
  GameMode,
  HudTelemetry,
  TrackConfig,
  VIBRANT_SWATCHES,
  VehicleConfig,
  WeatherPhase,
} from '../types/game';
import { ArcadeAudio } from './audio';
import { createRoadSliceTexture, createVoxelBlockTexture } from './textures';
import {
  BuiltVehicle,
  PropPoolAsset,
  buildBiomeProp,
  buildVehicleModel,
} from './voxelModels';

// Reusable scratch math objects (zero GC in animation loop)
const _colorA = new THREE.Color();
const _colorB = new THREE.Color();
const _fogColor = new THREE.Color();
const _vec3 = new THREE.Vector3();

const ROAD_WIDTH = 13.5;
const SLICE_LEN = 2.6;
const NUM_SLICES = 74;
const PROP_SPACING = 11.5;
const NUM_PROPS = 32;
const DAY_DURATION_SEC = 64;

interface RivalCar {
  built: BuiltVehicle;
  worldZ: number;
  laneX: number;
  targetLaneX: number;
  speedMs: number;
  laneTimer: number;
  passed: boolean;
  nearMissed: boolean;
}

interface RoadSlice {
  group: THREE.Group;
  roadMesh: THREE.Mesh;
  curbLeft: THREE.Mesh;
  curbRight: THREE.Mesh;
  groundMesh: THREE.Mesh;
}

interface PropSlot {
  assetIndex: number;
  side: -1 | 1;
  offsetX: number;
  slotWorldIndex: number;
}

export interface InputState {
  left: boolean;
  right: boolean;
  accel: boolean;
  brake: boolean;
  turbo: boolean;
}

export interface EnduroCallbacks {
  onHudUpdate: (hud: HudTelemetry) => void;
  onModeChange: (mode: GameMode) => void;
  onContextLost: (lost: boolean) => void;
}

export class EnduroWorld {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private maxAnisotropy: number;
  private audio: ArcadeAudio;
  private callbacks: EnduroCallbacks;

  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;

  // Lighting
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;
  private headlightSpot: THREE.SpotLight;
  private headlightTarget: THREE.Object3D;

  // World Geometry Pools
  private roadSlices: RoadSlice[] = [];
  private roadMatDashed!: THREE.MeshStandardMaterial;
  private roadMatSolid!: THREE.MeshStandardMaterial;
  private curbMatA!: THREE.MeshStandardMaterial;
  private curbMatB!: THREE.MeshStandardMaterial;
  private groundMat!: THREE.MeshStandardMaterial;
  private sliceGeos: THREE.BufferGeometry[] = [];
  private worldTextures: THREE.Texture[] = [];

  // Biome Props & Horizon
  private propTemplates: PropPoolAsset[] = [];
  private propInstances: THREE.Group[] = [];
  private propSlots: PropSlot[] = [];
  private mountainGroup = new THREE.Group();
  private cloudGroup = new THREE.Group();
  private horizonMat!: THREE.MeshStandardMaterial;

  // Weather Particles (Snow / Speed dust)
  private snowPoints!: THREE.Points;
  private snowPositions!: Float32Array;
  private snowMat!: THREE.PointsMaterial;

  // Player & Rivals
  private playerVehicle!: BuiltVehicle;
  private rivals: RivalCar[] = [];

  // Configurations
  private vehicleConfig: VehicleConfig;
  private trackConfig: TrackConfig;

  // Live Game State
  private mode: GameMode = 'garage';
  private cameraMode: CameraMode = 'chase';
  private input: InputState = {
    left: false,
    right: false,
    accel: false,
    brake: false,
    turbo: false,
  };

  private playerWorldZ = 0;
  private playerLaneX = 0;
  private playerSpeedMs = 0; // m/s (max ~75 m/s = 270 km/h)
  private playerSteerVel = 0;
  private day = 1;
  private passedInDay = 0;
  private targetInDay = 28;
  private dayTimer = 0;
  private score = 0;
  private distanceMeters = 0;
  private turbo = 100;
  private isTurboActive = false;
  private crashInvuln = 0;
  private cameraShake = 0;
  private nearMissFlash = 0;
  private crashFlash = 0;
  private overtakeStreak = 0;
  private hudEmitAccum = 0;

  private boundResize: () => void;
  private boundContextLost: (e: Event) => void;
  private boundContextRestored: () => void;

  constructor(
    container: HTMLElement,
    initialVehicle: VehicleConfig,
    initialTrack: TrackConfig,
    audio: ArcadeAudio,
    callbacks: EnduroCallbacks
  ) {
    this.container = container;
    this.vehicleConfig = { ...initialVehicle };
    this.trackConfig = { ...initialTrack };
    this.audio = audio;
    this.callbacks = callbacks;

    // 1. Software WebGL Detection (renderer string probe)
    this.isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. WebGLRenderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();

    container.appendChild(this.renderer.domElement);

    // 3. Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x38bdf8);
    this.scene.fog = new THREE.FogExp2(0x7dd3fc, 0.0085);

    this.camera = new THREE.PerspectiveCamera(58, width / height, 0.2, 300);
    this.camera.position.set(4.5, 2.8, 6.2);

    // 4. Studio Environment Map via PMREM
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmremGenerator.dispose();

    // 5. Three-Point + Headlight Rig
    this.hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x3f6212, 0.85);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfffbeb, 1.85);
    this.sunLight.position.set(22, 36, 18);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 110;
    this.sunLight.shadow.camera.left = -28;
    this.sunLight.shadow.camera.right = 28;
    this.sunLight.shadow.camera.top = 28;
    this.sunLight.shadow.camera.bottom = -28;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);

    this.rimLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
    this.rimLight.position.set(-18, 12, -26);
    this.scene.add(this.rimLight);

    this.headlightTarget = new THREE.Object3D();
    this.headlightTarget.position.set(0, 0, -28);
    this.scene.add(this.headlightTarget);

    this.headlightSpot = new THREE.SpotLight(
      0xfef08a,
      0,
      95,
      Math.PI / 4.5,
      0.45,
      1.1
    );
    this.headlightSpot.position.set(0, 1.2, -1.2);
    this.headlightSpot.target = this.headlightTarget;
    this.scene.add(this.headlightSpot);

    // 6. Build World & Entities
    this.initRoadSlices();
    this.initHorizonAndClouds();
    this.initWeatherParticles();
    this.rebuildPlayerVehicle();
    this.rebuildBiomeProps();
    this.rebuildRivals();
    this.applyTrackMaterials();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // 7. Listeners
    this.boundResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.boundResize);

    this.boundContextLost = (e: Event) => {
      e.preventDefault();
      this.callbacks.onContextLost(true);
    };
    this.boundContextRestored = () => {
      this.callbacks.onContextLost(false);
    };
    this.renderer.domElement.addEventListener(
      'webglcontextlost',
      this.boundContextLost
    );
    this.renderer.domElement.addEventListener(
      'webglcontextrestored',
      this.boundContextRestored
    );

    // 8. Start Loop
    this.clock.start();
    this.tick();
  }

  // --- Spline Math for Authentic Winding & Hilly Voxel Road ---

  private getCurveAmplitude(): number {
    switch (this.trackConfig.curves) {
      case 'gentle':
        return 4.5;
      case 'winding':
        return 14.5;
      default:
        return 9.2;
    }
  }

  private getHillAmplitude(): number {
    switch (this.trackConfig.hills) {
      case 'flat':
        return 0;
      case 'mountain':
        return 5.4;
      default:
        return 2.6;
    }
  }

  private getRawCurveX(z: number): number {
    const amp = this.getCurveAmplitude();
    if (amp === 0) return 0;
    return (
      Math.sin(z * 0.0095) * amp +
      Math.sin(z * 0.023 + 1.1) * (amp * 0.45)
    );
  }

  private getRawHillY(z: number): number {
    const amp = this.getHillAmplitude();
    if (amp === 0) return 0;
    return Math.sin(z * 0.013) * amp + Math.cos(z * 0.029) * (amp * 0.4);
  }

  private getRelativeRoadPoint(
    worldZ: number,
    baseWorldZ: number,
    baseX: number,
    slopeX: number,
    baseY: number,
    slopeY: number
  ): { x: number; y: number } {
    const dist = worldZ - baseWorldZ;
    const x = this.getRawCurveX(worldZ) - baseX - slopeX * dist;
    const y = this.getRawHillY(worldZ) - baseY - slopeY * dist;
    return { x, y };
  }

  // --- Initialization & Material Updates ---

  private initRoadSlices(): void {
    const roadGeo = new THREE.BoxGeometry(ROAD_WIDTH, 0.28, SLICE_LEN + 0.06);
    const curbGeo = new THREE.BoxGeometry(0.95, 0.4, SLICE_LEN + 0.06);
    const groundGeo = new THREE.BoxGeometry(140, 0.24, SLICE_LEN + 0.08);
    this.sliceGeos.push(roadGeo, curbGeo, groundGeo);

    this.roadMatDashed = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.05,
    });
    this.roadMatSolid = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.05,
    });
    this.curbMatA = new THREE.MeshStandardMaterial({
      roughness: 0.65,
      metalness: 0.08,
    });
    this.curbMatB = new THREE.MeshStandardMaterial({
      roughness: 0.65,
      metalness: 0.08,
    });
    this.groundMat = new THREE.MeshStandardMaterial({
      roughness: 0.94,
      metalness: 0.02,
    });

    for (let i = 0; i < NUM_SLICES; i++) {
      const group = new THREE.Group();
      const roadMesh = new THREE.Mesh(roadGeo, this.roadMatSolid);
      roadMesh.position.y = -0.14;
      roadMesh.receiveShadow = true;

      const curbLeft = new THREE.Mesh(curbGeo, this.curbMatA);
      curbLeft.position.set(-ROAD_WIDTH / 2 - 0.45, -0.06, 0);
      curbLeft.receiveShadow = true;

      const curbRight = new THREE.Mesh(curbGeo, this.curbMatA);
      curbRight.position.set(ROAD_WIDTH / 2 + 0.45, -0.06, 0);
      curbRight.receiveShadow = true;

      const groundMesh = new THREE.Mesh(groundGeo, this.groundMat);
      groundMesh.position.y = -0.24;
      groundMesh.receiveShadow = true;

      group.add(groundMesh, roadMesh, curbLeft, curbRight);
      this.scene.add(group);
      this.roadSlices.push({ group, roadMesh, curbLeft, curbRight, groundMesh });
    }
  }

  private initHorizonAndClouds(): void {
    this.horizonMat = new THREE.MeshStandardMaterial({
      color: 0x3b6e5c,
      roughness: 0.92,
      metalness: 0.04,
    });
    // Stepped Minecraft voxel mountain chain on horizon
    const peaks = 18;
    for (let i = 0; i < peaks; i++) {
      const x = (i - peaks / 2 + 0.5) * 26;
      const h = 14 + ((i * 19) % 24);
      const w = 18 + ((i * 7) % 12);
      const baseGeo = new THREE.BoxGeometry(w, h, 18);
      const topGeo = new THREE.BoxGeometry(w * 0.55, h * 0.45, 12);
      this.sliceGeos.push(baseGeo, topGeo);

      const base = new THREE.Mesh(baseGeo, this.horizonMat);
      base.position.set(x, h * 0.45 - 2, -188 - (i % 3) * 10);
      const top = new THREE.Mesh(topGeo, this.horizonMat);
      top.position.set(x, h * 0.95, -188 - (i % 3) * 10);
      this.mountainGroup.add(base, top);
    }
    this.scene.add(this.mountainGroup);

    // Blocky Minecraft sky clouds
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      emissive: 0xffffff,
      emissiveIntensity: 0.15,
    });
    for (let i = 0; i < 10; i++) {
      const cg = new THREE.Group();
      const b1 = new THREE.Mesh(
        new THREE.BoxGeometry(10 + (i % 3) * 4, 2.2, 6),
        cloudMat
      );
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(6, 1.8, 5), cloudMat);
      b2.position.set(1.5, 1.5, 0);
      this.sliceGeos.push(b1.geometry, b2.geometry);
      cg.add(b1, b2);
      cg.position.set((i - 5) * 28, 28 + (i % 4) * 5, -70 - (i % 5) * 26);
      this.cloudGroup.add(cg);
    }
    this.scene.add(this.cloudGroup);
  }

  private initWeatherParticles(): void {
    const count = 320;
    this.snowPositions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.snowPositions[i * 3] = (Math.random() - 0.5) * 60;
      this.snowPositions[i * 3 + 1] = Math.random() * 24;
      this.snowPositions[i * 3 + 2] = -Math.random() * 75 + 6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.snowPositions, 3)
    );
    this.sliceGeos.push(geo);

    this.snowMat = new THREE.PointsMaterial({
      color: 0xf8fafc,
      size: 0.36,
      transparent: true,
      opacity: 0,
    });
    this.snowPoints = new THREE.Points(geo, this.snowMat);
    this.scene.add(this.snowPoints);
  }

  private applyTrackMaterials(): void {
    const biome = BIOME_PRESETS[this.trackConfig.biome];

    // Clear old procedural textures
    this.worldTextures.forEach((t) => t.dispose());
    this.worldTextures = [];

    const roadDashedTex = createRoadSliceTexture(
      this.trackConfig.roadColor,
      '#FACC15',
      true,
      this.maxAnisotropy
    );
    const roadSolidTex = createRoadSliceTexture(
      this.trackConfig.roadColor,
      '#FACC15',
      false,
      this.maxAnisotropy
    );
    const curbTexA = createVoxelBlockTexture(
      this.trackConfig.curbColorA,
      '#FFFFFF',
      15,
      this.maxAnisotropy
    );
    const curbTexB = createVoxelBlockTexture(
      this.trackConfig.curbColorB,
      '#CBD5E1',
      29,
      this.maxAnisotropy
    );
    const groundTex = createVoxelBlockTexture(
      biome.groundColor,
      biome.groundAccent,
      64,
      this.maxAnisotropy
    );
    groundTex.repeat.set(32, 1);

    this.worldTextures.push(
      roadDashedTex,
      roadSolidTex,
      curbTexA,
      curbTexB,
      groundTex
    );

    this.roadMatDashed.map = roadDashedTex;
    this.roadMatDashed.needsUpdate = true;

    this.roadMatSolid.map = roadSolidTex;
    this.roadMatSolid.needsUpdate = true;

    this.curbMatA.map = curbTexA;
    this.curbMatA.needsUpdate = true;

    this.curbMatB.map = curbTexB;
    this.curbMatB.needsUpdate = true;

    this.groundMat.map = groundTex;
    this.groundMat.needsUpdate = true;

    this.horizonMat.color.set(biome.mountainColor);
  }

  private rebuildPlayerVehicle(): void {
    if (this.playerVehicle) {
      this.scene.remove(this.playerVehicle.group);
      this.playerVehicle.dispose();
    }
    this.playerVehicle = buildVehicleModel(
      this.vehicleConfig,
      this.maxAnisotropy
    );
    this.scene.add(this.playerVehicle.group);
  }

  private rebuildBiomeProps(): void {
    this.propInstances.forEach((g) => this.scene.remove(g));
    this.propInstances = [];
    this.propTemplates.forEach((p) => p.dispose());
    this.propTemplates = [];
    this.propSlots = [];

    for (let v = 0; v < 4; v++) {
      this.propTemplates.push(
        buildBiomeProp(this.trackConfig.biome, v, this.maxAnisotropy)
      );
    }

    for (let i = 0; i < NUM_PROPS; i++) {
      const variant = i % 4;
      const clone = this.propTemplates[variant].group.clone();
      const side: -1 | 1 = i % 2 === 0 ? -1 : 1;
      const offsetX = ROAD_WIDTH / 2 + 3.2 + ((i * 7) % 11);
      this.scene.add(clone);
      this.propInstances.push(clone);
      this.propSlots.push({
        assetIndex: i,
        side,
        offsetX,
        slotWorldIndex: i,
      });
    }
  }

  private getTargetRivalCount(): number {
    switch (this.trackConfig.traffic) {
      case 'light':
        return 10;
      case 'intense':
        return 18;
      default:
        return 14;
    }
  }

  private rebuildRivals(): void {
    this.rivals.forEach((r) => {
      this.scene.remove(r.built.group);
      r.built.dispose();
    });
    this.rivals = [];

    const count = this.getTargetRivalCount();
    const chassisPool: ChassisId[] = [
      'formula',
      'muscle',
      'pickup',
      'buggy',
      'truck',
    ];
    const lanes = [-4.2, 0, 4.2];

    for (let i = 0; i < count; i++) {
      const primary =
        VIBRANT_SWATCHES[(i * 3 + 1) % (VIBRANT_SWATCHES.length - 1)].hex;
      const secondary =
        VIBRANT_SWATCHES[(i * 5 + 3) % (VIBRANT_SWATCHES.length - 2)].hex;
      const rivalCfg: VehicleConfig = {
        name: `Rival ${i + 1}`,
        chassis: chassisPool[i % chassisPool.length],
        primaryColor: primary,
        secondaryColor: secondary,
        wheelColor: '#1E293B',
        livery: i % 2 === 0 ? 'stripe' : 'solid',
        spoiler: i % 3 === 0,
        roofLights: false,
        twinExhaust: false,
        antenna: false,
      };
      const built = buildVehicleModel(rivalCfg, this.maxAnisotropy);
      this.scene.add(built.group);

      const lane = lanes[i % lanes.length];
      this.rivals.push({
        built,
        worldZ: this.playerWorldZ + 28 + i * (155 / count),
        laneX: lane,
        targetLaneX: lane,
        speedMs: 24 + (i % 5) * 4.5,
        laneTimer: 1 + (i % 4),
        passed: false,
        nearMissed: false,
      });
    }
  }

  // --- Public API for React UI ---

  public updateVehicleConfig(config: VehicleConfig): void {
    this.vehicleConfig = { ...config };
    this.rebuildPlayerVehicle();
  }

  public updateTrackConfig(config: TrackConfig): void {
    const biomeChanged = config.biome !== this.trackConfig.biome;
    const trafficChanged = config.traffic !== this.trackConfig.traffic;
    this.trackConfig = { ...config };
    this.applyTrackMaterials();
    if (biomeChanged) {
      this.rebuildBiomeProps();
    }
    if (trafficChanged) {
      this.rebuildRivals();
    }
  }

  public setInput(next: Partial<InputState>): void {
    Object.assign(this.input, next);
  }

  public setCameraMode(cam: CameraMode): void {
    this.cameraMode = cam;
    if (this.playerVehicle) {
      this.playerVehicle.group.visible =
        this.mode === 'garage' || cam === 'chase';
    }
  }

  public getCameraMode(): CameraMode {
    return this.cameraMode;
  }

  public startRace(): void {
    this.day = 1;
    this.passedInDay = 0;
    this.targetInDay = 28;
    this.dayTimer = 0;
    this.score = 0;
    this.distanceMeters = 0;
    this.playerWorldZ = 0;
    this.playerLaneX = 0;
    this.playerSpeedMs = 18;
    this.playerSteerVel = 0;
    this.turbo = 100;
    this.crashInvuln = 0;
    this.overtakeStreak = 0;
    this.mode = 'racing';
    this.setCameraMode(this.cameraMode);
    this.rebuildRivals();
    this.audio.startEngine();
    this.callbacks.onModeChange('racing');
    this.emitHud();
  }

  public continueNextDay(): void {
    this.day += 1;
    this.passedInDay = 0;
    this.targetInDay = 28 + (this.day - 1) * 12;
    this.dayTimer = 0;
    this.turbo = Math.min(100, this.turbo + 35);
    this.mode = 'racing';
    this.audio.startEngine();
    this.callbacks.onModeChange('racing');
    this.emitHud();
  }

  public togglePause(): void {
    if (this.mode === 'racing') {
      this.mode = 'paused';
      this.audio.stopEngine();
      this.callbacks.onModeChange('paused');
    } else if (this.mode === 'paused') {
      this.mode = 'racing';
      this.audio.startEngine();
      this.callbacks.onModeChange('racing');
    }
  }

  public returnToGarage(): void {
    this.mode = 'garage';
    this.playerSpeedMs = 0;
    this.playerLaneX = 0;
    this.playerVehicle.group.visible = true;
    this.audio.stopEngine();
    this.callbacks.onModeChange('garage');
  }

  // --- Weather & Atmosphere Interpolation ---

  private resolveWeatherPhase(): {
    phase: WeatherPhase;
    skyHex: string;
    fogHex: string;
    fogDensity: number;
    sunIntensity: number;
    hemiIntensity: number;
    nightFactor: number;
    snowFactor: number;
    gripFactor: number;
  } {
    const biome = BIOME_PRESETS[this.trackConfig.biome];
    let t = (this.dayTimer / DAY_DURATION_SEC) % 1;

    if (this.mode === 'garage') {
      if (this.trackConfig.weatherMode === 'night') t = 0.45;
      else if (this.trackConfig.weatherMode === 'fog') t = 0.62;
      else if (this.trackConfig.weatherMode === 'snow') t = 0.78;
      else t = 0.05;
    } else if (this.trackConfig.weatherMode !== 'dynamic') {
      if (this.trackConfig.weatherMode === 'day') t = 0.05;
      if (this.trackConfig.weatherMode === 'night') t = 0.45;
      if (this.trackConfig.weatherMode === 'fog') t = 0.62;
      if (this.trackConfig.weatherMode === 'snow') t = 0.78;
    }

    // 6 classic Enduro phases across t = 0..1
    if (t < 0.2) {
      return {
        phase: 'morning',
        skyHex: biome.skyDay,
        fogHex: biome.fogDay,
        fogDensity: 0.0068,
        sunIntensity: 1.85,
        hemiIntensity: 0.85,
        nightFactor: 0,
        snowFactor: 0,
        gripFactor: 1,
      };
    } else if (t < 0.36) {
      return {
        phase: 'sunset',
        skyHex: '#FB7185',
        fogHex: '#FDBA74',
        fogDensity: 0.0085,
        sunIntensity: 1.4,
        hemiIntensity: 0.65,
        nightFactor: 0.35,
        snowFactor: 0,
        gripFactor: 1,
      };
    } else if (t < 0.56) {
      return {
        phase: 'night',
        skyHex: '#090D1A',
        fogHex: '#0F172A',
        fogDensity: 0.0115,
        sunIntensity: 0.32,
        hemiIntensity: 0.25,
        nightFactor: 1,
        snowFactor: 0,
        gripFactor: 1,
      };
    } else if (t < 0.72) {
      return {
        phase: 'fog',
        skyHex: '#94A3B8',
        fogHex: '#CBD5E1',
        fogDensity: 0.024,
        sunIntensity: 0.9,
        hemiIntensity: 0.75,
        nightFactor: 0.55,
        snowFactor: 0,
        gripFactor: 0.94,
      };
    } else if (t < 0.88) {
      return {
        phase: 'snow',
        skyHex: '#BAE6FD',
        fogHex: '#E0F2FE',
        fogDensity: 0.014,
        sunIntensity: 1.15,
        hemiIntensity: 0.85,
        nightFactor: 0.2,
        snowFactor: 1,
        gripFactor: 0.76,
      };
    }
    return {
      phase: 'dawn',
      skyHex: '#F472B6',
      fogHex: '#FDE68A',
      fogDensity: 0.008,
      sunIntensity: 1.55,
      hemiIntensity: 0.75,
      nightFactor: 0.25,
      snowFactor: 0,
      gripFactor: 1,
    };
  }

  // --- Main Simulation & Render Loop ---

  private tick = (): void => {
    if (this.disposed) return;

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);

    this.updateAtmosphere(dt);

    if (this.mode === 'racing') {
      this.updateRacePhysics(dt);
    } else if (this.mode === 'garage') {
      this.updateGarageShowcase();
    }

    this.updateRoadAndProps();
    this.updateCamera(dt);

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateAtmosphere(dt: number): void {
    const env = this.resolveWeatherPhase();
    const lerpRate = 1 - Math.exp(-2.2 * dt);

    _colorA.set(env.skyHex);
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.lerp(_colorA, lerpRate);
    }

    _colorB.set(env.fogHex);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.lerp(_colorB, lerpRate);
      this.scene.fog.density = THREE.MathUtils.lerp(
        this.scene.fog.density,
        env.fogDensity,
        lerpRate
      );
    }

    this.sunLight.intensity = THREE.MathUtils.lerp(
      this.sunLight.intensity,
      env.sunIntensity,
      lerpRate
    );
    this.hemiLight.intensity = THREE.MathUtils.lerp(
      this.hemiLight.intensity,
      env.hemiIntensity,
      lerpRate
    );

    // Player & Rival lights
    this.headlightSpot.intensity = THREE.MathUtils.lerp(
      this.headlightSpot.intensity,
      env.nightFactor * 48,
      lerpRate
    );
    this.playerVehicle.headlightMat.emissiveIntensity =
      0.4 + env.nightFactor * 2.8;
    this.playerVehicle.taillightMat.emissiveIntensity =
      0.9 + env.nightFactor * 2.2;

    for (const r of this.rivals) {
      r.built.taillightMat.emissiveIntensity = 0.8 + env.nightFactor * 3.0;
      r.built.headlightMat.emissiveIntensity = 0.4 + env.nightFactor * 2.2;
    }

    // Snow Particles
    this.snowMat.opacity = THREE.MathUtils.lerp(
      this.snowMat.opacity,
      env.snowFactor * 0.85,
      lerpRate
    );
    if (this.snowMat.opacity > 0.04) {
      const speedMove = this.mode === 'racing' ? this.playerSpeedMs * 0.7 : 4;
      for (let i = 0; i < this.snowPositions.length; i += 3) {
        this.snowPositions[i + 1] -= dt * 7.5;
        this.snowPositions[i + 2] += dt * speedMove;
        if (this.snowPositions[i + 1] < 0) {
          this.snowPositions[i + 1] = 22;
          this.snowPositions[i] = (Math.random() - 0.5) * 58;
        }
        if (this.snowPositions[i + 2] > 8) {
          this.snowPositions[i + 2] = -72;
        }
      }
      this.snowPoints.geometry.attributes.position.needsUpdate = true;
    }
  }

  private updateGarageShowcase(): void {
    this.playerVehicle.group.position.set(0, 0, 0);
    this.playerVehicle.bodyGroup.rotation.set(0, 0, 0);
    for (const r of this.rivals) {
      r.built.group.visible = false;
    }
  }

  private updateRacePhysics(dt: number): void {
    const env = this.resolveWeatherPhase();

    // 1. Day clock & end-of-day check
    this.dayTimer += dt;
    if (this.passedInDay >= this.targetInDay) {
      this.score += 500 * this.day;
      this.mode = 'day_clear';
      this.audio.stopEngine();
      this.audio.playDayComplete();
      this.callbacks.onModeChange('day_clear');
      this.emitHud();
      return;
    }

    if (this.dayTimer >= DAY_DURATION_SEC) {
      this.mode = 'gameover';
      this.audio.stopEngine();
      this.callbacks.onModeChange('gameover');
      this.emitHud();
      return;
    }

    // 2. Turbo & Speed
    const wantsTurbo = this.input.turbo && this.turbo > 4;
    this.isTurboActive = wantsTurbo && this.playerSpeedMs > 12;
    if (this.isTurboActive) {
      this.turbo = Math.max(0, this.turbo - dt * 28);
    } else {
      this.turbo = Math.min(100, this.turbo + dt * 4.5);
    }

    const maxSpeed = this.isTurboActive ? 82 : 66; // ~295 km/h turbo, 238 km/h normal
    const accelRate = this.isTurboActive ? 42 : 24;
    const coastDrag = 7.5;
    const brakeRate = 48;

    if (this.input.accel || this.isTurboActive) {
      this.playerSpeedMs = Math.min(
        maxSpeed,
        this.playerSpeedMs + accelRate * dt
      );
    } else if (this.input.brake) {
      this.playerSpeedMs = Math.max(8, this.playerSpeedMs - brakeRate * dt);
    } else {
      // Auto-cruise minimum speed in arcade Enduro so it feels effortless
      const minCruise = 22;
      if (this.playerSpeedMs > minCruise) {
        this.playerSpeedMs = Math.max(
          minCruise,
          this.playerSpeedMs - coastDrag * dt
        );
      } else {
        this.playerSpeedMs = Math.min(
          minCruise,
          this.playerSpeedMs + 12 * dt
        );
      }
    }

    // Off-road rumble & speed cap if driving on grass/sand shoulder
    const onShoulder = Math.abs(this.playerLaneX) > ROAD_WIDTH * 0.48;
    if (onShoulder && this.playerSpeedMs > 36) {
      this.playerSpeedMs = THREE.MathUtils.damp(
        this.playerSpeedMs,
        34,
        4.5,
        dt
      );
      this.cameraShake = Math.max(this.cameraShake, 0.04);
    }

    // 3. Steering & Centrifugal Curve Drift
    const steerInput = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    const speedRatio = THREE.MathUtils.clamp(this.playerSpeedMs / 66, 0, 1.25);

    // Road curvature pulls car slightly toward outside of turn
    const c0 = this.getRawCurveX(this.playerWorldZ);
    const c1 = this.getRawCurveX(this.playerWorldZ + 2);
    const c2 = this.getRawCurveX(this.playerWorldZ + 4);
    const curvature = c2 - 2 * c1 + c0;
    const centrifugalPull = -curvature * speedRatio * 5.2;

    const targetSteerVel =
      steerInput * (14.5 * env.gripFactor + speedRatio * 4.5) + centrifugalPull;
    this.playerSteerVel = THREE.MathUtils.damp(
      this.playerSteerVel,
      targetSteerVel,
      8.5 * env.gripFactor,
      dt
    );

    this.playerLaneX += this.playerSteerVel * dt;
    this.playerLaneX = THREE.MathUtils.clamp(
      this.playerLaneX,
      -ROAD_WIDTH * 0.62,
      ROAD_WIDTH * 0.62
    );

    // Advance World Z
    const dz = this.playerSpeedMs * dt;
    this.playerWorldZ += dz;
    this.distanceMeters += dz;
    this.score += dz * 0.25;

    // Spin player wheels & tilt chassis body on turn
    const wheelSpin = dz * 1.9;
    for (const w of this.playerVehicle.wheels) {
      w.rotation.x -= wheelSpin;
    }
    this.playerVehicle.group.position.set(this.playerLaneX, 0, 0);
    this.playerVehicle.bodyGroup.rotation.z = THREE.MathUtils.damp(
      this.playerVehicle.bodyGroup.rotation.z,
      -steerInput * 0.11,
      10,
      dt
    );
    this.playerVehicle.bodyGroup.rotation.y = THREE.MathUtils.damp(
      this.playerVehicle.bodyGroup.rotation.y,
      -steerInput * 0.08,
      10,
      dt
    );

    // Update Headlight position
    this.headlightSpot.position.set(this.playerLaneX, 1.2, -1.2);
    this.headlightTarget.position.set(this.playerLaneX, 0.2, -26);

    // Audio engine update
    this.audio.updateEngine(speedRatio, this.isTurboActive);

    // 4. Update Rivals, Overtakes & Collisions
    if (this.crashInvuln > 0) this.crashInvuln -= dt;
    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 1.4);
    }

    const baseX = this.getRawCurveX(this.playerWorldZ);
    const slopeX = (this.getRawCurveX(this.playerWorldZ + 2) - baseX) / 2;
    const baseY = this.getRawHillY(this.playerWorldZ);
    const slopeY = (this.getRawHillY(this.playerWorldZ + 2) - baseY) / 2;

    const lanes = [-4.2, 0, 4.2];

    for (const r of this.rivals) {
      r.built.group.visible = true;
      r.worldZ += r.speedMs * dt;

      // Occasional lane switching
      r.laneTimer -= dt;
      if (r.laneTimer <= 0) {
        r.laneTimer = 2.2 + Math.random() * 3.0;
        r.targetLaneX = lanes[Math.floor(Math.random() * lanes.length)];
      }
      r.laneX = THREE.MathUtils.damp(r.laneX, r.targetLaneX, 2.5, dt);

      const relZ = this.playerWorldZ - r.worldZ; // negative = ahead of player

      // Overtake detection
      if (!r.passed && relZ > 2.2) {
        r.passed = true;
        this.passedInDay += 1;
        this.overtakeStreak += 1;
        this.score += 100 + this.day * 25;
        this.audio.playOvertake();
      } else if (r.passed && relZ < -2.2) {
        // Rival passed player from behind
        r.passed = false;
        this.passedInDay = Math.max(0, this.passedInDay - 1);
        this.overtakeStreak = 0;
      }

      // Near-miss ("Fino!") turbo reward
      if (
        !r.nearMissed &&
        Math.abs(relZ) < 2.2 &&
        Math.abs(this.playerLaneX - r.laneX) >= 1.85 &&
        Math.abs(this.playerLaneX - r.laneX) < 3.05 &&
        this.playerSpeedMs > 36
      ) {
        r.nearMissed = true;
        this.turbo = Math.min(100, this.turbo + 18);
        this.score += 75;
        this.nearMissFlash = Date.now();
        this.audio.playNearMiss();
      }

      // Collision detection
      if (
        this.crashInvuln <= 0 &&
        Math.abs(relZ) < 2.95 &&
        Math.abs(this.playerLaneX - r.laneX) < 1.82
      ) {
        this.crashInvuln = 0.75;
        this.playerSpeedMs = Math.max(14, this.playerSpeedMs * 0.36);
        const pushDir = this.playerLaneX >= r.laneX ? 1 : -1;
        this.playerLaneX = THREE.MathUtils.clamp(
          this.playerLaneX + pushDir * 1.4,
          -ROAD_WIDTH * 0.55,
          ROAD_WIDTH * 0.55
        );
        this.overtakeStreak = 0;
        this.cameraShake = 0.45;
        this.crashFlash = Date.now();
        this.audio.playCrash();
      }

      // Recycle rival ahead when far behind or far ahead
      if (relZ > 16) {
        r.worldZ = this.playerWorldZ + 125 + Math.random() * 75;
        r.laneX = lanes[Math.floor(Math.random() * lanes.length)];
        r.targetLaneX = r.laneX;
        r.passed = false;
        r.nearMissed = false;
      } else if (relZ < -210) {
        r.worldZ = this.playerWorldZ + 140 + Math.random() * 40;
        r.passed = false;
        r.nearMissed = false;
      }

      // Position rival on curved/hilly road
      const pt = this.getRelativeRoadPoint(
        r.worldZ,
        this.playerWorldZ,
        baseX,
        slopeX,
        baseY,
        slopeY
      );
      r.built.group.position.set(pt.x + r.laneX, pt.y, relZ);

      // Rival wheel spin
      for (const w of r.built.wheels) {
        w.rotation.x -= r.speedMs * dt * 1.8;
      }
    }

    // 5. Emit HUD state smoothly (~15Hz)
    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.065) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private updateRoadAndProps(): void {
    const baseX = this.getRawCurveX(this.playerWorldZ);
    const slopeX = (this.getRawCurveX(this.playerWorldZ + 2) - baseX) / 2;
    const baseY = this.getRawHillY(this.playerWorldZ);
    const slopeY = (this.getRawHillY(this.playerWorldZ + 2) - baseY) / 2;

    const firstSliceWorldZ =
      Math.floor(this.playerWorldZ / SLICE_LEN) * SLICE_LEN - SLICE_LEN * 4;

    for (let i = 0; i < NUM_SLICES; i++) {
      const sliceWorldZ = firstSliceWorldZ + i * SLICE_LEN;
      const relZ = this.playerWorldZ - sliceWorldZ; // +10 down to -182
      const segIdx = Math.round(sliceWorldZ / SLICE_LEN);

      const pt = this.getRelativeRoadPoint(
        sliceWorldZ,
        this.playerWorldZ,
        baseX,
        slopeX,
        baseY,
        slopeY
      );
      const nextPt = this.getRelativeRoadPoint(
        sliceWorldZ + SLICE_LEN,
        this.playerWorldZ,
        baseX,
        slopeX,
        baseY,
        slopeY
      );

      const slice = this.roadSlices[i];
      slice.group.position.set(pt.x, pt.y, relZ);

      const dx = nextPt.x - pt.x;
      const dy = nextPt.y - pt.y;
      slice.group.rotation.y = -Math.atan2(dx, SLICE_LEN);
      slice.group.rotation.x = Math.atan2(dy, SLICE_LEN);

      // Alternating voxel curb colors & dashed lane markings
      const isCurbA = ((segIdx % 2) + 2) % 2 === 0;
      const curbMat = isCurbA ? this.curbMatA : this.curbMatB;
      slice.curbLeft.material = curbMat;
      slice.curbRight.material = curbMat;

      const isDash = ((segIdx % 3) + 3) % 3 !== 0;
      slice.roadMesh.material = isDash ? this.roadMatDashed : this.roadMatSolid;
    }

    // Update Biome Props along roadside
    const firstPropIdx = Math.floor(this.playerWorldZ / PROP_SPACING) - 1;
    for (let i = 0; i < NUM_PROPS; i++) {
      const slot = this.propSlots[i];
      const worldPropIdx =
        firstPropIdx +
        ((((i - firstPropIdx) % NUM_PROPS) + NUM_PROPS) % NUM_PROPS);
      const propWorldZ = worldPropIdx * PROP_SPACING;
      const relZ = this.playerWorldZ - propWorldZ;

      const pt = this.getRelativeRoadPoint(
        propWorldZ,
        this.playerWorldZ,
        baseX,
        slopeX,
        baseY,
        slopeY
      );

      const meshGroup = this.propInstances[i];
      meshGroup.position.set(
        pt.x + slot.side * slot.offsetX,
        pt.y - 0.12,
        relZ
      );
    }

    // Parallax Voxel Mountain Horizon
    this.mountainGroup.position.x = -slopeX * 55;
    this.mountainGroup.position.y = -slopeY * 30;
  }

  private updateCamera(dt: number): void {
    if (this.mode === 'garage') {
      this.camera.position.x = THREE.MathUtils.damp(
        this.camera.position.x,
        0,
        8,
        dt
      );
      this.camera.position.y = THREE.MathUtils.damp(
        this.camera.position.y,
        3.15,
        8,
        dt
      );
      this.camera.position.z = THREE.MathUtils.damp(
        this.camera.position.z,
        6.4,
        8,
        dt
      );
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 58, 8, dt);
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(0, 0.95, -24);
      this.camera.rotation.z = 0;
      return;
    }

    // Racing Camera (Chase or Hood)
    const speedRatio = THREE.MathUtils.clamp(this.playerSpeedMs / 75, 0, 1.1);
    const shakeX =
      this.cameraShake > 0 ? (Math.random() - 0.5) * this.cameraShake : 0;
    const shakeY =
      this.cameraShake > 0 ? (Math.random() - 0.5) * this.cameraShake : 0;

    if (this.cameraMode === 'hood') {
      this.camera.position.set(
        this.playerLaneX + shakeX,
        1.48 + shakeY,
        -0.45
      );
      const targetFov = 66 + speedRatio * 14 + (this.isTurboActive ? 6 : 0);
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
      this.camera.updateProjectionMatrix();
      _vec3.set(this.playerLaneX * 0.9, 1.15, -36);
      this.camera.lookAt(_vec3);
    } else {
      const targetCamX = this.playerLaneX * 0.76 + shakeX;
      const targetCamY = 3.25 + shakeY;
      const targetCamZ = 6.45;
      this.camera.position.x = THREE.MathUtils.damp(
        this.camera.position.x,
        targetCamX,
        10,
        dt
      );
      this.camera.position.y = THREE.MathUtils.damp(
        this.camera.position.y,
        targetCamY,
        10,
        dt
      );
      this.camera.position.z = THREE.MathUtils.damp(
        this.camera.position.z,
        targetCamZ,
        10,
        dt
      );

      const targetFov = 58 + speedRatio * 13 + (this.isTurboActive ? 7 : 0);
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
      this.camera.updateProjectionMatrix();

      _vec3.set(this.playerLaneX * 0.52, 0.9, -24);
      this.camera.lookAt(_vec3);
    }

    const steerTilt =
      ((this.input.left ? 1 : 0) - (this.input.right ? 1 : 0)) * 0.025;
    this.camera.rotation.z = THREE.MathUtils.damp(
      this.camera.rotation.z,
      steerTilt,
      8,
      dt
    );
  }

  private emitHud(): void {
    const env = this.resolveWeatherPhase();
    this.callbacks.onHudUpdate({
      speedKmh: Math.round(this.playerSpeedMs * 3.6),
      maxSpeedKmh: 295,
      day: this.day,
      passedInDay: this.passedInDay,
      targetInDay: this.targetInDay,
      dayProgress: THREE.MathUtils.clamp(this.dayTimer / DAY_DURATION_SEC, 0, 1),
      phase: env.phase,
      score: Math.floor(this.score),
      distanceKm: Number((this.distanceMeters / 1000).toFixed(2)),
      turbo: Math.round(this.turbo),
      isTurboActive: this.isTurboActive,
      nearMissFlash: this.nearMissFlash,
      crashFlash: this.crashFlash,
      overtakeStreak: this.overtakeStreak,
    });
  }

  private handleResize(): void {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.boundResize);

    const dom = this.renderer.domElement;
    dom.removeEventListener('webglcontextlost', this.boundContextLost);
    dom.removeEventListener('webglcontextrestored', this.boundContextRestored);

    this.playerVehicle?.dispose();
    this.rivals.forEach((r) => r.built.dispose());
    this.propTemplates.forEach((p) => p.dispose());
    this.sliceGeos.forEach((g) => g.dispose());
    this.worldTextures.forEach((t) => t.dispose());

    this.roadMatDashed.dispose();
    this.roadMatSolid.dispose();
    this.curbMatA.dispose();
    this.curbMatB.dispose();
    this.groundMat.dispose();
    this.horizonMat.dispose();
    this.snowMat.dispose();

    this.renderer.dispose();
    if (dom.parentElement === this.container) {
      this.container.removeChild(dom);
    }
  }
}
