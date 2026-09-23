import * as THREE from 'three';
import land from './earth-land.json';

const WIDTH = 256;
const HEIGHT = 128;
type RGB = [number, number, number];
const surfaces = new Map<string, Uint8Array>();
// Fixed, stylized surface features; these do not model planetary rotation or weather.
const planets = new Set([
  'Sun',
  'Mercury',
  'Venus',
  'Earth',
  'Moon',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
]);
const blend = (a: RGB, b: RGB, t: number): RGB =>
  a.map((v, i) => v + (b[i] - v) * THREE.MathUtils.clamp(t, 0, 1)) as RGB;

function noise(x: number, y: number, z: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  const smooth = (n: number) => n * n * (3 - 2 * n);
  const tx = smooth(x - ix),
    ty = smooth(y - iy),
    tz = smooth(z - iz);
  const hash = (dx: number, dy: number, dz: number) => {
    let h =
      Math.imul(ix + dx, 374761393) ^
      Math.imul(iy + dy, 668265263) ^
      Math.imul(iz + dz, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const mix = THREE.MathUtils.lerp;
  return mix(
    mix(
      mix(hash(0, 0, 0), hash(1, 0, 0), tx),
      mix(hash(0, 1, 0), hash(1, 1, 0), tx),
      ty,
    ),
    mix(
      mix(hash(0, 0, 1), hash(1, 0, 1), tx),
      mix(hash(0, 1, 1), hash(1, 1, 1), tx),
      ty,
    ),
    tz,
  );
}

function surfacePixels(id: string) {
  const cached = surfaces.get(id);
  if (cached) return cached;
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4);
  const craters = Array.from({ length: 48 }, (_, i) => {
    const latitude = Math.asin(1 - (2 * (i + 0.5)) / 48);
    const longitude = i * 2.399963;
    return {
      x: Math.cos(latitude) * Math.cos(longitude),
      y: Math.sin(latitude),
      z: Math.cos(latitude) * Math.sin(longitude),
      radius: 0.025 + ((i * 17) % 11) * 0.008,
    };
  });
  for (let row = 0; row < HEIGHT; row++) {
    const lat = (row / (HEIGHT - 1) - 0.5) * Math.PI;
    for (let column = 0; column < WIDTH; column++) {
      const lon = (column / (WIDTH - 1) - 0.5) * Math.PI * 2;
      const x = Math.cos(lat) * Math.cos(lon),
        y = Math.sin(lat),
        z = Math.cos(lat) * Math.sin(lon);
      // Noise in spherical coordinates keeps the longitude seam and poles continuous.
      const broad = noise(x * 3 + 12, y * 3 + 8, z * 3 + 4);
      const detail = noise(x * 18 + 7, y * 18 + 3, z * 18 + 9);
      const terrain = broad * 0.8 + detail * 0.2;
      let color: RGB;
      switch (id) {
        case 'Earth': {
          const isLand =
            (parseInt(land.rows[row][column >> 2], 16) &
              (8 >> (column & 3))) !==
            0;
          color = isLand
            ? blend([92, 124, 90], [165, 157, 111], terrain)
            : blend([42, 92, 129], [72, 126, 158], terrain);
          if (isLand && Math.abs(lat - 0.4) < 0.22)
            color = blend(color, [195, 173, 128], 0.6);
          const clouds =
            Math.max(0, noise(x * 6 + y * 2, y * 8 + 14, z * 6) - 0.62) * 2;
          color = blend(color, [225, 229, 218], clouds);
          color = blend(
            color,
            [220, 230, 225],
            THREE.MathUtils.smoothstep(Math.abs(lat), 1.25, 1.5),
          );
          break;
        }
        case 'Jupiter': {
          const cloudLatitude =
            lat + (broad - 0.5) * 0.11 + Math.sin(lon * 10 + lat * 14) * 0.009;
          const bands =
            Math.sin(cloudLatitude * 20) * 0.23 +
            Math.sin(cloudLatitude * 41 + detail * 0.6) * 0.09 +
            Math.sin(cloudLatitude * 9) * 0.1 +
            0.5;
          color = blend([168, 126, 96], [231, 215, 184], bands);
          const spot =
            Math.pow((lon + 1.55) / 0.24, 2) + Math.pow((lat + 0.36) / 0.11, 2);
          color = blend(
            color,
            [181, 111, 80],
            (1 - THREE.MathUtils.smoothstep(spot, 0.4, 1.3)) * 0.8,
          );
          break;
        }
        case 'Saturn':
          color = blend(
            [186, 163, 121],
            [226, 209, 169],
            0.5 + Math.sin(lat * 36 + broad * 0.7) * 0.2 + terrain * 0.15,
          );
          break;
        case 'Uranus':
          color = blend(
            [137, 187, 189],
            [176, 211, 206],
            0.5 + Math.sin(lat * 10) * 0.12 + terrain * 0.15,
          );
          break;
        case 'Neptune':
          color = blend(
            [64, 101, 157],
            [111, 155, 197],
            0.4 + Math.sin(lat * 14 + broad * 0.9) * 0.14 + terrain * 0.2,
          );
          break;
        case 'Venus':
          color = blend(
            [197, 171, 126],
            [234, 217, 175],
            terrain * 0.6 + 0.25 + Math.sin(lat * 9 + broad * 3) * 0.1,
          );
          break;
        case 'Mars':
          color = blend([127, 74, 55], [207, 135, 91], terrain);
          color = blend(
            color,
            [227, 215, 189],
            THREE.MathUtils.smoothstep(Math.abs(lat), 1.34, 1.51),
          );
          break;
        case 'Moon':
        case 'Mercury': {
          color =
            id === 'Moon'
              ? blend([120, 126, 127], [201, 201, 187], terrain)
              : blend([118, 111, 103], [179, 170, 151], terrain);
          if (id === 'Moon')
            color = blend(
              color,
              [98, 107, 111],
              (1 - THREE.MathUtils.smoothstep(broad, 0.3, 0.48)) * 0.6,
            );
          for (const crater of craters) {
            const distance =
              Math.sqrt(
                Math.max(
                  0,
                  2 * (1 - x * crater.x - y * crater.y - z * crater.z),
                ),
              ) / crater.radius;
            if (distance < 1.2) {
              const shade =
                distance < 0.8
                  ? -0.14 * (1 - distance / 0.8)
                  : 0.065 * (1 - Math.abs(distance - 1) / 0.2);
              color = color.map((channel) => channel * (1 + shade)) as RGB;
            }
          }
          break;
        }
        case 'Pluto': {
          color = blend([148, 111, 88], [209, 187, 153], terrain);
          const ice = Math.exp(
            -Math.pow((lon + 0.65) / 0.36, 2) -
              Math.pow((lat - 0.15) / 0.32, 2),
          );
          color = blend(color, [222, 213, 187], ice * 0.75);
          break;
        }
        default:
          color = blend([234, 164, 69], [252, 205, 119], terrain);
      }
      const offset = (row * WIDTH + column) * 4;
      pixels.set([...color.map(Math.round), 255], offset);
    }
  }
  surfaces.set(id, pixels);
  return pixels;
}

export function createPlanetMaterial(id: string, fallback: string) {
  const material = new THREE.MeshPhongMaterial({
    color: fallback,
    specular: 0x000000,
    shininess: 0,
    emissive: fallback,
    emissiveIntensity: 0.025,
  });
  if (!planets.has(id)) return material;
  const map = new THREE.DataTexture(surfacePixels(id), WIDTH, HEIGHT);
  map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  material.color.set(0xffffff);
  material.map = map;
  material.emissive.set(0xffffff);
  material.emissiveMap = map;
  material.emissiveIntensity = id === 'Sun' ? 0.35 : 0.055;
  return material;
}

type RingStyle = {
  inner: number;
  outer: number;
  tilt: number;
  base: RGB;
  highlight: RGB;
  opacity: number;
};

function createRing(radius: number, style: RingStyle) {
  const geometry = new THREE.RingGeometry(
    radius * style.inner,
    radius * style.outer,
    64,
  );
  const positions = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < positions.count; i++)
    uv.setXY(
      i,
      (Math.hypot(positions.getX(i), positions.getY(i)) / radius -
        style.inner) /
        (style.outer - style.inner),
      0.5,
    );
  const pixels = new Uint8Array(128 * 4);
  for (let i = 0; i < 128; i++) {
    const r = i / 127;
    const color = blend(
      style.base,
      style.highlight,
      0.5 + Math.sin(r * 100) * 0.15,
    );
    const opacity =
      r > 0.61 && r < 0.67
        ? style.opacity * 0.12
        : r < 0.2
          ? style.opacity * 0.38
          : r > 0.95
            ? style.opacity * 0.3
            : style.opacity;
    pixels.set([...color.map(Math.round), Math.round(opacity * 255)], i * 4);
  }
  const map = new THREE.DataTexture(pixels, 128, 1);
  map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = THREE.LinearFilter;
  map.needsUpdate = true;
  const ring = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      map,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = style.tilt;
  return ring;
}

export function createSaturnRing(radius: number, equatorial = false) {
  return createRing(radius, {
    inner: 1.28,
    outer: 2.12,
    tilt: equatorial ? Math.PI / 2 : Math.PI / 2.35,
    base: [158, 143, 116],
    highlight: [218, 207, 181],
    opacity: 0.68,
  });
}

export function createUranusRing(radius: number, equatorial = false) {
  return createRing(radius, {
    inner: 1.14,
    outer: 1.7,
    tilt: equatorial ? Math.PI / 2 : Math.PI / 2.02,
    base: [105, 132, 134],
    highlight: [174, 197, 191],
    opacity: 0.34,
  });
}
