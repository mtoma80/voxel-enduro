import * as THREE from 'three';
import { LiveryId } from '../types/game';

function seededRand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function shadeHex(hex: string, factor: number): string {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, factor);
  return `#${c.getHexString()}`;
}

export function createVoxelBlockTexture(
  baseHex: string,
  accentHex: string,
  seed = 101,
  maxAnisotropy = 4
): THREE.CanvasTexture {
  const size = 16;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRand(seed);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = rand();
      let fill = baseHex;
      if (r > 0.82) {
        fill = accentHex;
      } else if (r > 0.55) {
        fill = shadeHex(baseHex, 0.04);
      } else if (r < 0.25) {
        fill = shadeHex(baseHex, -0.05);
      }
      // Subtle pixel border inside 16x16 block for unmistakable voxel tile look
      if (x === 0 || y === 0) {
        fill = shadeHex(fill, 0.04);
      } else if (x === size - 1 || y === size - 1) {
        fill = shadeHex(fill, -0.05);
      }
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createRoadSliceTexture(
  asphaltHex: string,
  stripeHex = '#FACC15',
  hasCenterDash = true,
  maxAnisotropy = 4
): THREE.CanvasTexture {
  const w = 64;
  const h = 16;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRand(hasCenterDash ? 42 : 77);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = rand();
      let fill = asphaltHex;
      if (r > 0.78) fill = shadeHex(asphaltHex, 0.035);
      else if (r < 0.2) fill = shadeHex(asphaltHex, -0.035);
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Crisp shoulder lines
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(2, 0, 2, h);
  ctx.fillRect(w - 4, 0, 2, h);

  // Lane dividers (3 lanes)
  if (hasCenterDash) {
    ctx.fillStyle = stripeHex;
    ctx.fillRect(21, 2, 2, h - 4);
    ctx.fillRect(41, 2, 2, h - 4);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createVehicleLiveryTexture(
  primaryHex: string,
  secondaryHex: string,
  livery: LiveryId,
  maxAnisotropy = 4
): THREE.CanvasTexture {
  const size = 16;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = seededRand(303);

  // Base fill with subtle voxel pixel variation
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = rand();
      let c = primaryHex;
      if (r > 0.8) c = shadeHex(primaryHex, 0.04);
      else if (r < 0.18) c = shadeHex(primaryHex, -0.04);
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  ctx.fillStyle = secondaryHex;
  if (livery === 'stripe') {
    ctx.fillRect(5, 0, 2, size);
    ctx.fillRect(9, 0, 2, size);
  } else if (livery === 'checker') {
    for (let y = 0; y < size; y += 2) {
      for (let x = 0; x < size; x += 2) {
        if (((x + y) / 2) % 2 === 0) {
          ctx.fillRect(x, y, 2, 2);
        }
      }
    }
  } else if (livery === 'blocks') {
    for (let y = 0; y < size; y += 4) {
      for (let x = 0; x < size; x += 4) {
        if (rand() > 0.45) {
          ctx.fillRect(x, y, 3, 3);
        }
      }
    }
  } else if (livery === 'flames') {
    for (let x = 0; x < size; x++) {
      const height = 4 + Math.floor(Math.sin(x * 1.1) * 3 + (x % 2) * 2);
      ctx.fillRect(x, size - height, 1, height);
    }
    ctx.fillStyle = '#FFFFFF';
    for (let x = 1; x < size; x += 3) {
      ctx.fillRect(x, size - 2, 1, 2);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    4,
    size / 2,
    size / 2,
    size / 2
  );
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
