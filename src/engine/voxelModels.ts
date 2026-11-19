import * as THREE from 'three';
import { BiomeId, VehicleConfig } from '../types/game';
import {
  createContactShadowTexture,
  createVehicleLiveryTexture,
  createVoxelBlockTexture,
} from './textures';

export interface BuiltVehicle {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  wheels: THREE.Object3D[];
  headlightMat: THREE.MeshStandardMaterial;
  taillightMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

let sharedShadowTex: THREE.CanvasTexture | null = null;
function getShadowTexture(): THREE.CanvasTexture {
  if (!sharedShadowTex) {
    sharedShadowTex = createContactShadowTexture();
  }
  return sharedShadowTex;
}

function makeBox(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  castShadow = true
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildVehicleModel(
  config: VehicleConfig,
  maxAnisotropy = 4
): BuiltVehicle {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const wheels: THREE.Object3D[] = [];

  const trackMesh = (mesh: THREE.Mesh): THREE.Mesh => {
    geometries.push(mesh.geometry);
    return mesh;
  };

  // Materials with distinct PBR roughness/metalness contrast
  const liveryTex = createVehicleLiveryTexture(
    config.primaryColor,
    config.secondaryColor,
    config.livery,
    maxAnisotropy
  );
  textures.push(liveryTex);

  const primaryPaintMat = new THREE.MeshStandardMaterial({
    map: liveryTex,
    roughness: 0.38,
    metalness: 0.18,
  });
  const secondaryMat = new THREE.MeshStandardMaterial({
    color: config.secondaryColor,
    roughness: 0.35,
    metalness: 0.25,
  });
  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.72,
    metalness: 0.15,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.18,
    metalness: 0.88,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.1,
    metalness: 0.35,
    emissive: 0x1e293b,
    emissiveIntensity: 0.2,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.92,
    metalness: 0.04,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: config.wheelColor === '#1E293B' ? '#CBD5E1' : config.wheelColor,
    roughness: 0.22,
    metalness: 0.78,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfde047,
    emissiveIntensity: 0.4,
    roughness: 0.2,
    metalness: 0.1,
  });
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 0.9,
    roughness: 0.25,
    metalness: 0.1,
  });

  materials.push(
    primaryPaintMat,
    secondaryMat,
    darkTrimMat,
    chromeMat,
    glassMat,
    tireMat,
    rimMat,
    headlightMat,
    taillightMat
  );

  // Contact Shadow Plane (grounded at y = 0.02)
  const shadowGeo = new THREE.PlaneGeometry(2.6, 4.2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: getShadowTexture(),
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });
  geometries.push(shadowGeo);
  materials.push(shadowMat);
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  root.add(shadowPlane);

  // Wheel helper (round tire + metallic rim + hub + tread lug for spin visibility)
  const addWheel = (
    x: number,
    y: number,
    z: number,
    radius = 0.34,
    width = 0.28
  ) => {
    const wGroup = new THREE.Group();
    wGroup.position.set(x, y, z);

    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 18);
    tireGeo.rotateZ(Math.PI / 2);
    geometries.push(tireGeo);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;
    tire.receiveShadow = true;

    const rimGeo = new THREE.CylinderGeometry(
      radius * 0.58,
      radius * 0.58,
      width + 0.03,
      14
    );
    rimGeo.rotateZ(Math.PI / 2);
    geometries.push(rimGeo);
    const rim = new THREE.Mesh(rimGeo, rimMat);

    const hubGeo = new THREE.CylinderGeometry(
      radius * 0.26,
      radius * 0.26,
      width + 0.05,
      10
    );
    hubGeo.rotateZ(Math.PI / 2);
    geometries.push(hubGeo);
    const hub = new THREE.Mesh(hubGeo, chromeMat);

    const spoke = trackMesh(
      makeBox(width + 0.04, radius * 1.05, radius * 0.18, chromeMat, 0, 0, 0, false)
    );

    wGroup.add(tire, rim, hub, spoke);
    root.add(wGroup);
    wheels.push(wGroup);
  };

  // Chassis geometry by archetype (all grounded bottom-center at y = 0)
  // Note: vehicle faces -Z (forward into the screen)
  const chassis = config.chassis;

  if (chassis === 'formula') {
    // Wheels (open-wheel wide stance)
    addWheel(-0.98, 0.34, -1.05, 0.34, 0.32);
    addWheel(0.98, 0.34, -1.05, 0.34, 0.32);
    addWheel(-1.02, 0.38, 1.05, 0.38, 0.38);
    addWheel(1.02, 0.38, 1.05, 0.38, 0.38);

    // Undertray & suspension arms
    bodyGroup.add(trackMesh(makeBox(1.5, 0.14, 2.7, darkTrimMat, 0, 0.25, 0)));
    bodyGroup.add(trackMesh(makeBox(2.0, 0.1, 0.18, darkTrimMat, 0, 0.34, -1.05)));
    bodyGroup.add(trackMesh(makeBox(2.0, 0.12, 0.22, darkTrimMat, 0, 0.38, 1.05)));

    // Main monocoque + nose cone
    bodyGroup.add(trackMesh(makeBox(0.95, 0.42, 2.35, primaryPaintMat, 0, 0.52, 0.15)));
    bodyGroup.add(trackMesh(makeBox(0.65, 0.3, 0.95, primaryPaintMat, 0, 0.46, -1.35)));
    // Sidepods
    bodyGroup.add(trackMesh(makeBox(0.38, 0.32, 1.25, secondaryMat, -0.66, 0.46, 0.15)));
    bodyGroup.add(trackMesh(makeBox(0.38, 0.32, 1.25, secondaryMat, 0.66, 0.46, 0.15)));
    // Front wing
    bodyGroup.add(trackMesh(makeBox(1.95, 0.12, 0.42, secondaryMat, 0, 0.22, -1.72)));
    // Cockpit & voxel helmet
    bodyGroup.add(trackMesh(makeBox(0.58, 0.22, 0.55, glassMat, 0, 0.78, -0.15)));
    bodyGroup.add(trackMesh(makeBox(0.36, 0.34, 0.36, chromeMat, 0, 0.88, 0.15)));
    bodyGroup.add(trackMesh(makeBox(0.38, 0.14, 0.2, glassMat, 0, 0.9, -0.02)));
    // Airbox intake
    bodyGroup.add(trackMesh(makeBox(0.42, 0.34, 0.52, primaryPaintMat, 0, 0.88, 0.58)));

    // Headlights & Taillights
    bodyGroup.add(trackMesh(makeBox(0.22, 0.12, 0.1, headlightMat, -0.22, 0.46, -1.82, false)));
    bodyGroup.add(trackMesh(makeBox(0.22, 0.12, 0.1, headlightMat, 0.22, 0.46, -1.82, false)));
    bodyGroup.add(trackMesh(makeBox(0.34, 0.14, 0.1, taillightMat, 0, 0.46, 1.38, false)));
  } else if (chassis === 'muscle') {
    addWheel(-0.92, 0.34, -1.05, 0.34, 0.28);
    addWheel(0.92, 0.34, -1.05, 0.34, 0.28);
    addWheel(-0.94, 0.36, 1.05, 0.36, 0.32);
    addWheel(0.94, 0.36, 1.05, 0.36, 0.32);

    // Lower chassis & bumpers
    bodyGroup.add(trackMesh(makeBox(1.78, 0.18, 3.25, darkTrimMat, 0, 0.28, 0)));
    bodyGroup.add(trackMesh(makeBox(1.86, 0.16, 0.18, chromeMat, 0, 0.34, -1.62)));
    bodyGroup.add(trackMesh(makeBox(1.86, 0.16, 0.18, chromeMat, 0, 0.34, 1.62)));
    // Main sculpted muscle body
    bodyGroup.add(trackMesh(makeBox(1.82, 0.52, 3.15, primaryPaintMat, 0, 0.62, 0)));
    // Hood blower scoop
    bodyGroup.add(trackMesh(makeBox(0.55, 0.22, 0.65, chromeMat, 0, 0.94, -0.9)));
    // Cabin & windshield
    bodyGroup.add(trackMesh(makeBox(1.48, 0.48, 1.38, primaryPaintMat, 0, 1.1, 0.2)));
    bodyGroup.add(trackMesh(makeBox(1.36, 0.34, 1.42, glassMat, 0, 1.08, 0.2)));
    // Side stripe trim
    bodyGroup.add(trackMesh(makeBox(1.86, 0.12, 2.5, secondaryMat, 0, 0.62, 0)));

    // Headlights & Taillights
    bodyGroup.add(trackMesh(makeBox(0.32, 0.16, 0.1, headlightMat, -0.62, 0.65, -1.58, false)));
    bodyGroup.add(trackMesh(makeBox(0.32, 0.16, 0.1, headlightMat, 0.62, 0.65, -1.58, false)));
    bodyGroup.add(trackMesh(makeBox(0.42, 0.16, 0.1, taillightMat, -0.58, 0.66, 1.58, false)));
    bodyGroup.add(trackMesh(makeBox(0.42, 0.16, 0.1, taillightMat, 0.58, 0.66, 1.58, false)));
  } else if (chassis === 'pickup') {
    addWheel(-0.98, 0.42, -1.05, 0.42, 0.34);
    addWheel(0.98, 0.42, -1.05, 0.42, 0.34);
    addWheel(-0.98, 0.42, 1.05, 0.42, 0.34);
    addWheel(0.98, 0.42, 1.05, 0.42, 0.34);

    // High frame + bullbar
    bodyGroup.add(trackMesh(makeBox(1.75, 0.22, 3.3, darkTrimMat, 0, 0.44, 0)));
    bodyGroup.add(trackMesh(makeBox(1.65, 0.32, 0.18, chromeMat, 0, 0.65, -1.7)));
    // Front hood + cab + bed walls
    bodyGroup.add(trackMesh(makeBox(1.84, 0.54, 1.7, primaryPaintMat, 0, 0.8, -0.75)));
    bodyGroup.add(trackMesh(makeBox(1.64, 0.55, 1.0, primaryPaintMat, 0, 1.32, -0.25)));
    bodyGroup.add(trackMesh(makeBox(1.5, 0.4, 1.04, glassMat, 0, 1.32, -0.25)));
    // Rear open cargo bed
    bodyGroup.add(trackMesh(makeBox(1.84, 0.2, 1.55, darkTrimMat, 0, 0.64, 0.85)));
    bodyGroup.add(trackMesh(makeBox(0.2, 0.45, 1.55, primaryPaintMat, -0.82, 0.94, 0.85)));
    bodyGroup.add(trackMesh(makeBox(0.2, 0.45, 1.55, primaryPaintMat, 0.82, 0.94, 0.85)));
    bodyGroup.add(trackMesh(makeBox(1.84, 0.45, 0.2, secondaryMat, 0, 0.94, 1.52)));
    // Rollbar
    bodyGroup.add(trackMesh(makeBox(1.48, 0.45, 0.16, chromeMat, 0, 1.32, 0.42)));

    bodyGroup.add(trackMesh(makeBox(0.3, 0.18, 0.1, headlightMat, -0.64, 0.84, -1.62, false)));
    bodyGroup.add(trackMesh(makeBox(0.3, 0.18, 0.1, headlightMat, 0.64, 0.84, -1.62, false)));
    bodyGroup.add(trackMesh(makeBox(0.34, 0.2, 0.1, taillightMat, -0.66, 0.88, 1.62, false)));
    bodyGroup.add(trackMesh(makeBox(0.34, 0.2, 0.1, taillightMat, 0.66, 0.88, 1.62, false)));
  } else if (chassis === 'buggy') {
    addWheel(-1.02, 0.38, -1.0, 0.38, 0.32);
    addWheel(1.02, 0.38, -1.0, 0.38, 0.32);
    addWheel(-1.08, 0.44, 1.0, 0.44, 0.38);
    addWheel(1.08, 0.44, 1.0, 0.44, 0.38);

    // Angular frame
    bodyGroup.add(trackMesh(makeBox(1.45, 0.22, 2.75, darkTrimMat, 0, 0.36, 0)));
    bodyGroup.add(trackMesh(makeBox(1.25, 0.38, 2.4, primaryPaintMat, 0, 0.62, 0.05)));
    bodyGroup.add(trackMesh(makeBox(0.95, 0.28, 0.85, secondaryMat, 0, 0.54, -1.2)));
    // Rollcage
    bodyGroup.add(trackMesh(makeBox(1.16, 0.52, 0.14, chromeMat, 0, 1.05, -0.4)));
    bodyGroup.add(trackMesh(makeBox(1.16, 0.52, 0.14, chromeMat, 0, 1.05, 0.55)));
    bodyGroup.add(trackMesh(makeBox(1.16, 0.12, 1.08, secondaryMat, 0, 1.28, 0.08)));
    // Exposed rear engine block
    bodyGroup.add(trackMesh(makeBox(0.86, 0.46, 0.62, chromeMat, 0, 0.82, 1.08)));

    bodyGroup.add(trackMesh(makeBox(0.24, 0.16, 0.12, headlightMat, -0.35, 0.62, -1.62, false)));
    bodyGroup.add(trackMesh(makeBox(0.24, 0.16, 0.12, headlightMat, 0.35, 0.62, -1.62, false)));
    bodyGroup.add(trackMesh(makeBox(0.32, 0.14, 0.1, taillightMat, -0.45, 0.68, 1.38, false)));
    bodyGroup.add(trackMesh(makeBox(0.32, 0.14, 0.1, taillightMat, 0.45, 0.68, 1.38, false)));
  } else {
    // 'truck' — Turbo Rig
    addWheel(-0.98, 0.4, -1.1, 0.4, 0.34);
    addWheel(0.98, 0.4, -1.1, 0.4, 0.34);
    addWheel(-0.98, 0.4, 0.55, 0.4, 0.34);
    addWheel(0.98, 0.4, 0.55, 0.4, 0.34);
    addWheel(-0.98, 0.4, 1.3, 0.4, 0.34);
    addWheel(0.98, 0.4, 1.3, 0.4, 0.34);

    bodyGroup.add(trackMesh(makeBox(1.85, 0.24, 3.55, darkTrimMat, 0, 0.42, 0.1)));
    // Tall voxel cab
    bodyGroup.add(trackMesh(makeBox(1.9, 0.95, 1.6, primaryPaintMat, 0, 1.0, -0.65)));
    bodyGroup.add(trackMesh(makeBox(1.75, 0.46, 1.48, glassMat, 0, 1.24, -0.75)));
    // Front grille
    bodyGroup.add(trackMesh(makeBox(1.4, 0.55, 0.14, chromeMat, 0, 0.85, -1.48)));
    // Rear aero deck
    bodyGroup.add(trackMesh(makeBox(1.75, 0.42, 1.55, secondaryMat, 0, 0.74, 0.95)));

    bodyGroup.add(trackMesh(makeBox(0.32, 0.2, 0.1, headlightMat, -0.68, 0.68, -1.5, false)));
    bodyGroup.add(trackMesh(makeBox(0.32, 0.2, 0.1, headlightMat, 0.68, 0.68, -1.5, false)));
    bodyGroup.add(trackMesh(makeBox(0.38, 0.18, 0.1, taillightMat, -0.64, 0.64, 1.75, false)));
    bodyGroup.add(trackMesh(makeBox(0.38, 0.18, 0.1, taillightMat, 0.64, 0.64, 1.75, false)));
  }

  // Optional 3D Voxel Accessories (modular add-ons!)
  if (config.spoiler) {
    const wingY = chassis === 'truck' ? 1.52 : chassis === 'pickup' ? 1.24 : 1.08;
    const wingZ = chassis === 'truck' ? 1.52 : 1.36;
    bodyGroup.add(trackMesh(makeBox(0.14, 0.36, 0.18, darkTrimMat, -0.62, wingY - 0.16, wingZ)));
    bodyGroup.add(trackMesh(makeBox(0.14, 0.36, 0.18, darkTrimMat, 0.62, wingY - 0.16, wingZ)));
    bodyGroup.add(trackMesh(makeBox(1.88, 0.12, 0.38, secondaryMat, 0, wingY + 0.04, wingZ)));
    bodyGroup.add(trackMesh(makeBox(0.1, 0.26, 0.44, primaryPaintMat, -0.94, wingY + 0.04, wingZ)));
    bodyGroup.add(trackMesh(makeBox(0.1, 0.26, 0.44, primaryPaintMat, 0.94, wingY + 0.04, wingZ)));
  }

  if (config.roofLights) {
    const lightY =
      chassis === 'truck'
        ? 1.56
        : chassis === 'pickup'
        ? 1.66
        : chassis === 'buggy'
        ? 1.4
        : chassis === 'muscle'
        ? 1.4
        : 1.1;
    const lightZ = chassis === 'pickup' ? -0.3 : chassis === 'truck' ? -0.75 : 0.15;
    bodyGroup.add(trackMesh(makeBox(1.22, 0.12, 0.18, darkTrimMat, 0, lightY, lightZ)));
    for (const lx of [-0.42, -0.14, 0.14, 0.42]) {
      bodyGroup.add(
        trackMesh(makeBox(0.18, 0.16, 0.16, headlightMat, lx, lightY + 0.06, lightZ - 0.06, false))
      );
    }
  }

  if (config.twinExhaust) {
    const exZ = chassis === 'truck' ? 1.72 : 1.52;
    const exY = chassis === 'truck' ? 1.25 : 0.38;
    const exH = chassis === 'truck' ? 0.95 : 0.16;
    const exD = chassis === 'truck' ? 0.16 : 0.35;
    bodyGroup.add(trackMesh(makeBox(0.16, exH, exD, chromeMat, -0.48, exY, exZ)));
    bodyGroup.add(trackMesh(makeBox(0.16, exH, exD, chromeMat, 0.48, exY, exZ)));
  }

  if (config.antenna) {
    bodyGroup.add(trackMesh(makeBox(0.06, 0.65, 0.06, chromeMat, -0.72, 1.12, 1.15)));
    bodyGroup.add(trackMesh(makeBox(0.14, 0.14, 0.14, secondaryMat, -0.72, 1.48, 1.15, false)));
  }

  return {
    group: root,
    bodyGroup,
    wheels,
    headlightMat,
    taillightMat,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}

export interface PropPoolAsset {
  group: THREE.Group;
  dispose: () => void;
}

export function buildBiomeProp(
  biome: BiomeId,
  variant: number,
  maxAnisotropy = 4
): PropPoolAsset {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const addBlock = (
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number
  ) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    geometries.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  if (biome === 'desert') {
    const cactusTex = createVoxelBlockTexture('#16A34A', '#15803D', 12 + variant, maxAnisotropy);
    textures.push(cactusTex);
    const cactusMat = new THREE.MeshStandardMaterial({
      map: cactusTex,
      roughness: 0.85,
      metalness: 0.02,
    });
    materials.push(cactusMat);

    const h = 3.2 + (variant % 3) * 0.9;
    addBlock(0.85, h, 0.85, cactusMat, 0, h / 2, 0);
    if (variant % 2 === 0) {
      addBlock(0.9, 0.65, 0.65, cactusMat, -0.75, h * 0.55, 0);
      addBlock(0.65, 1.2, 0.65, cactusMat, -1.0, h * 0.55 + 0.65, 0);
      addBlock(0.8, 0.65, 0.65, cactusMat, 0.72, h * 0.42, 0);
      addBlock(0.65, 1.0, 0.65, cactusMat, 0.95, h * 0.42 + 0.55, 0);
    } else {
      const rockTex = createVoxelBlockTexture('#B45309', '#92400E', 88, maxAnisotropy);
      textures.push(rockTex);
      const rockMat = new THREE.MeshStandardMaterial({ map: rockTex, roughness: 0.95 });
      materials.push(rockMat);
      addBlock(1.4, 1.1, 1.2, rockMat, 0.9, 0.55, 0.2);
    }
  } else if (biome === 'neon') {
    const pillarTex = createVoxelBlockTexture('#0F172A', '#334155', 55, maxAnisotropy);
    textures.push(pillarTex);
    const baseMat = new THREE.MeshStandardMaterial({
      map: pillarTex,
      roughness: 0.35,
      metalness: 0.6,
    });
    const glowColor = variant % 2 === 0 ? 0x06b6d4 : 0xec4899;
    const crystalMat = new THREE.MeshStandardMaterial({
      color: glowColor,
      emissive: glowColor,
      emissiveIntensity: 1.1,
      roughness: 0.2,
      metalness: 0.2,
    });
    materials.push(baseMat, crystalMat);

    addBlock(1.1, 0.8, 1.1, baseMat, 0, 0.4, 0);
    addBlock(0.75, 2.8 + (variant % 3) * 0.7, 0.75, crystalMat, 0, 2.1, 0);
    addBlock(1.2, 0.35, 1.2, baseMat, 0, 0.95, 0);
  } else {
    // Oak / Pine / Sakura tree
    const trunkHex = biome === 'sakura' ? '#57362A' : '#78350F';
    const leafHex =
      biome === 'tundra'
        ? '#15803D'
        : biome === 'sakura'
        ? '#F472B6'
        : '#16A34A';
    const leafAccent =
      biome === 'tundra'
        ? '#F8FAFC'
        : biome === 'sakura'
        ? '#FBCFE8'
        : '#4ADE80';

    const trunkTex = createVoxelBlockTexture(trunkHex, '#451A03', 21, maxAnisotropy);
    const leafTex = createVoxelBlockTexture(leafHex, leafAccent, 33 + variant, maxAnisotropy);
    textures.push(trunkTex, leafTex);

    const trunkMat = new THREE.MeshStandardMaterial({
      map: trunkTex,
      roughness: 0.92,
      metalness: 0.0,
    });
    const leafMat = new THREE.MeshStandardMaterial({
      map: leafTex,
      roughness: 0.8,
      metalness: 0.05,
    });
    materials.push(trunkMat, leafMat);

    if (biome === 'tundra') {
      // Tiered voxel pine tree
      addBlock(0.75, 1.6, 0.75, trunkMat, 0, 0.8, 0);
      addBlock(2.7, 1.1, 2.7, leafMat, 0, 2.0, 0);
      addBlock(2.0, 1.1, 2.0, leafMat, 0, 3.0, 0);
      addBlock(1.2, 1.0, 1.2, leafMat, 0, 3.9, 0);
      const snowMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.85,
      });
      materials.push(snowMat);
      addBlock(0.75, 0.4, 0.75, snowMat, 0, 4.55, 0);
    } else {
      // Classic Minecraft oak / sakura canopy
      const trunkH = 2.0 + (variant % 2) * 0.6;
      addBlock(0.8, trunkH, 0.8, trunkMat, 0, trunkH / 2, 0);
      addBlock(2.6, 1.3, 2.6, leafMat, 0, trunkH + 0.55, 0);
      addBlock(1.7, 0.95, 1.7, leafMat, 0, trunkH + 1.55, 0);
    }
  }

  return {
    group,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
