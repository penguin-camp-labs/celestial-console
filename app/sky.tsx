'use client';
import { configureDepthDimming } from '@/lib/depth-dimming.mjs';
import { t as tr } from './use-locale';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createPlanetMaterial, createSaturnRing } from '@/lib/planet-materials';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLYPHS, DEG, wrap } from '@/lib/engine.mjs';
import { houseCusps, houseBoundaryCurves } from '@/lib/houses.mjs';
import { PlaybackInterpolator } from '@/lib/playback.mjs';
import { observerMatrix, topocentricDirection } from '@/lib/observer.mjs';
import { edgeKey } from '@/lib/aspects.mjs';
import { spherePoint, morphPoint } from '@/lib/geometry.mjs';
import { BRIGHT_STARS, starPositions } from '@/lib/stars.mjs';
import {
  themeAppearance,
  inkColor,
  aspectInkColor,
  bodyInkColor,
} from '@/lib/theme.mjs';
type Props = {
  dimBack?: boolean;
  gridMode?: string;
  locale?: string;
  theme?: string;
  focus?: boolean;
  autoRotate?: boolean;
  playing?: boolean;
  smoothPlayback?: boolean;
  houses2d?: boolean;
  observer?: boolean;
  showBelowHorizon?: boolean;
  level?: number;
  heading?: number;
  headings?: number;
  nodeOrbit?: boolean;
  primeVertical?: boolean;
  trails?: boolean;
  chart: any;
  flat: boolean;
  aspects: boolean;
  grid: boolean;
  horizon: boolean;
  houses: boolean;
  houseSystem: string;
  selected: string | null;
  onSelect: (id: string | null) => void;
  reset: number;
  reduced: boolean;
  onFps: (n: number) => void;
  onFlat: () => void;
};
export default function Sky(props: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const live = useRef(props);
  live.current = props;
  const [failure, setFailure] = useState('');
  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setFailure(
        'この環境では3D描画を開始できません。WebGLを有効にするか、対応するブラウザをお使いください。',
      );
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x060c12, 0);
    renderer.domElement.setAttribute(
      'aria-label',
      tr('天球。ドラッグで回転、ホイールで拡大。天体をクリックして選択。'),
    );
    renderer.domElement.tabIndex = 0;
    host.appendChild(renderer.domElement);
    const depthUniforms = {
      amount: { value: 0 },
      direction: { value: new THREE.Vector3(0, 0, 1) },
    };
    const scene = new THREE.Scene();
    const world = new THREE.Group();
    scene.add(world);
    const orbitCamera = new THREE.OrthographicCamera(
      -400,
      400,
      300,
      -300,
      0.1,
      4000,
    );
    orbitCamera.position.copy(
      live.current.flat
        ? new THREE.Vector3(0.001, 750, 0)
        : new THREE.Vector3(0, 0, 760),
    );
    orbitCamera.up.set(0, 1, 0);
    const controls = new OrbitControls(orbitCamera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minZoom = 0.65;
    controls.maxZoom = 2.1;
    controls.minPolarAngle = 0.005;
    controls.maxPolarAngle = Math.PI - 0.005;
    const groundCamera = new THREE.PerspectiveCamera(85, 1, 0.1, 4000);
    groundCamera.position.set(0, 0, 0);
    groundCamera.up.set(0, 1, 0);
    let activeCamera: THREE.Camera = orbitCamera;
    let azimuth = 90;
    let altitude = 0;
    let targetAzimuth = 90;
    let targetAltitude = 0;
    let lastHeading = live.current.headings ?? 0;
    let lastLevel = live.current.level ?? 0;
    const horizonClip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.01);
    if (live.current.flat) orbitCamera.up.set(0, 0, -1);
    const disposable: (
      | THREE.Material
      | THREE.BufferGeometry
      | THREE.Texture
    )[] = [];
    const materials: THREE.LineBasicMaterial[] = [];
    // Camera-relative illustration lighting; no shadow maps or post-processing.
    const ambient = new THREE.AmbientLight('#dce9ff', 0.65);
    const keyLight = new THREE.DirectionalLight('#fff5e5', 2.2);
    const fillLight = new THREE.DirectionalLight('#83b9e5', 0.55);
    scene.add(ambient, keyLight, fillLight);
    function line(
      points: THREE.Vector3[],
      color: string,
      opacity = 0.4,
      parent: THREE.Object3D = world,
    ) {
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
      });
      const obj = new THREE.Line(geo, mat);
      parent.add(obj);
      mat.userData.themeColor = color;
      disposable.push(geo, mat);
      materials.push(mat);
      return obj;
    }
    function v(lon: number, lat = 0, r = 218) {
      return new THREE.Vector3(...spherePoint(lon, lat, r));
    }
    function circle(lat = 0, r = 218) {
      return Array.from({ length: 181 }, (_, i) => v(i * 2, lat, r));
    }
    const sphere = new THREE.Group();
    world.add(sphere);
    for (let lat = -60; lat <= 60; lat += 30)
      line(circle(lat), '#315562', 0.23, sphere);
    for (let lon = 0; lon < 180; lon += 30)
      line(
        Array.from({ length: 181 }, (_, i) => v(lon, i * 2)),
        '#315562',
        0.23,
        sphere,
      );
    line(circle(0, 218), '#8ae7dc', 0.75);
    line(circle(0, 256), '#487080', 0.45);
    line(circle(0, 264), '#2f4d5d', 0.45);
    for (let i = 0; i < 360; i += 2)
      line(
        [v(i, 0, i % 30 === 0 ? 238 : i % 10 === 0 ? 248 : 253), v(i, 0, 259)],
        '#7596a1',
        i % 30 === 0 ? 0.7 : 0.32,
      );
    const redrawLabels: (() => void)[] = [];
    let labelsDisposed = false;
    let labelLocale = live.current.locale;
    const refreshLabels = () => {
      if (!labelsDisposed) redrawLabels.forEach((draw) => draw());
    };
    if (document.fonts)
      Promise.all([
        document.fonts.load('400 44px "BIZ UDPGothic"', '東西南北天頂'),
        document.fonts.load('400 44px "Source Code Pro"', 'ASC MC 123'),
        document.fonts.load('400 40px "Zodiac Symbols"', GLYPHS.join('')),
      ])
        .then(refreshLabels)
        .catch(() => {});
    function label(text: string, color: string, size = 24, minPixels = 0) {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 80;
      const ctx = c.getContext('2d')!;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font =
        (minPixels ? '400 44px' : '40px') +
        (minPixels || /^[0-9]+$/.test(text)
          ? ' "Source Code Pro", "BIZ UDPGothic", monospace'
          : ' "Zodiac Symbols", "Source Code Pro", "Segoe UI Symbol", "BIZ UDPGothic", sans-serif');
      ctx.fillStyle = '#ffffff';
      ctx.fillText(tr(text), 128, 40, 244);
      const tex = new THREE.CanvasTexture(c);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        color,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      redrawLabels.push(() => {
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.fillText(tr(text), 128, 40, 244);
        tex.needsUpdate = true;
      });
      mat.userData.themeColor = color;
      const sprite = new THREE.Sprite(mat);
      sprite.userData.minPixels = minPixels;
      sprite.userData.labelSize = size;
      sprite.scale.set(size * 3.2, size, 1);
      world.add(sprite);
      disposable.push(tex, mat);
      return sprite;
    }
    GLYPHS.forEach((s: string, i: number) => {
      const l = label(s, i % 3 === 0 ? '#a5ded9' : '#8daab7', 22);
      l.position.copy(v(i * 30 + 15, 0, 282));
    });
    const earthG = new THREE.SphereGeometry(9, 32, 24);
    const earthM = createPlanetMaterial('Earth', '#8fe6e0');
    const earth = new THREE.Mesh(earthG, earthM);
    earthM.userData.bodyMaterial = true;
    world.add(earth);
    disposable.push(earthG, earthM);
    if (earthM.map) disposable.push(earthM.map);
    const earthLabel = label('EARTH', '#71989c', 9);
    earthLabel.position.set(0, -23, 0);
    function makeNode(b: any) {
      const point = b.kind === 'point';
      const radius = point
        ? 5.5
        : b.id === 'Sun'
          ? 7.2
          : b.id === 'Moon'
            ? 6.2
            : 5.5;
      const geo = point
        ? new THREE.OctahedronGeometry(radius)
        : new THREE.SphereGeometry(radius, 28, 18);
      const mat = point
        ? new THREE.MeshPhongMaterial({
            color: b.color,
            specular: '#080b0e',
            shininess: 8,
            flatShading: point,
            emissive: b.color,
            emissiveIntensity: b.id === 'Sun' ? 0.12 : 0.025,
          })
        : createPlanetMaterial(b.id, b.color);
      mat.userData.bodyMaterial = true;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.id = b.id;
      mesh.userData.radius = radius;
      if (b.id === 'Saturn' && !point) {
        const ring = createSaturnRing(radius);
        mesh.add(ring);
        disposable.push(ring.geometry, ring.material as THREE.Material);
        if (ring.material.map) disposable.push(ring.material.map);
      }
      world.add(mesh);
      disposable.push(geo, mat);
      if (mat.map) disposable.push(mat.map);
      if (point) {
        const outlineGeometry = new THREE.EdgesGeometry(geo);
        const outlineMaterial = new THREE.LineBasicMaterial({
          color: b.color,
          transparent: true,
          opacity: 0.6,
        });
        outlineMaterial.userData.themeColor = b.color;
        const outline = new THREE.LineSegments(
          outlineGeometry,
          outlineMaterial,
        );
        outline.raycast = () => {};
        mesh.add(outline);
        disposable.push(outlineGeometry, outlineMaterial);
      }
      mat.userData.themeColor = b.color;
      const l = label(b.symbol, b.color, 23);
      l.material.userData.bodyGlyph = true;
      const tether = line([v(0), v(0)], b.color, 0.2);
      return { mesh, label: l, tether, lon: 0, lat: 0, initialized: false };
    }
    const nodes = live.current.chart.bodies.map(makeNode) as ReturnType<
      typeof makeNode
    >[];
    const edges: {
      line: THREE.Line;
      mat: THREE.LineBasicMaterial;
      i: number;
      j: number;
    }[] = [];
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const l = line([v(0), v(0)], '#78ddd1', 0);
        l.userData.aspect = true;
        edges.push({
          line: l,
          mat: l.material as THREE.LineBasicMaterial,
          i,
          j,
        });
      }
    const horizon = line(circle(), '#d9b177', 0.7);
    horizon.userData.horizon = true;
    const lunarPath = line(circle(), '#9ae0ce', 0.55);
    lunarPath.userData.lunarOrbit = true;
    const primePath = line(circle(), '#f4c184', 0.55);
    primePath.userData.primeVertical = true;
    const trailLines = ['NorthNode', 'SouthNode', 'Vertex'].map((id, i) => {
      const geo = new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: i === 2 ? 192 : 144 }, () => new THREE.Vector3()),
      );
      const mat = new THREE.LineBasicMaterial({
        color: ['#9ae0ce', '#c7b5ed', '#f4c184'][i],
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const l = new THREE.LineSegments(geo, mat);
      mat.userData.themeColor = ['#9ae0ce', '#c7b5ed', '#f4c184'][i];
      l.userData.trail = id;
      world.add(l);
      disposable.push(geo, mat);
      return l;
    });
    const directions = [
      label('東 E', '#c0d4d8', 24, 26),
      label('西 W', '#c0d4d8', 24, 26),
      label('北 N', '#c0d4d8', 24, 26),
      label('南 S', '#c0d4d8', 24, 26),
      label('天頂', '#93b8c0', 24, 26),
    ];
    const equator = line(circle(), '#90a6d8', 0.3);
    const houseLines = Array.from({ length: 12 }, (_, i) => {
      const l = line(
        [v(0, 0, 18), v(0, 0, 236)],
        i % 3 === 0 ? '#b2d6db' : '#809ca9',
        0.35,
      );
      l.userData.house = i + 1;
      return l;
    });
    const divisionLines = Array.from({ length: 12 }, (_, i) => {
      const l = line(
        Array.from({ length: 129 }, () => new THREE.Vector3()),
        i % 3 === 0 ? '#7596a1' : '#315562',
        0.23,
      );
      l.userData.houseBoundary = i + 1;
      l.geometry.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(new Float32Array(129 * 4).fill(1), 4),
      );
      (l.material as THREE.LineBasicMaterial).vertexColors = true;
      return l;
    });
    let divisionFrame: any = null;
    let divisionSystem = '';
    const houseLabels = Array.from({ length: 12 }, (_, i) => {
      const l = label(String(i + 1), '#a7c1cb', 22, 28);
      l.userData.houseNumber = i + 1;
      return l;
    });
    const ascL = label('ASC', '#f2c386', 24, 26);
    const mcL = label('MC', '#b6bceb', 24, 26);
    const polarLabels = [
      label('周極域', '#71989c', 18, 22),
      label('周極域', '#71989c', 18, 22),
    ];
    polarLabels.forEach((l) => (l.userData.circumpolar = true));
    const navigationLabels = [...directions, ascL, mcL, ...polarLabels];
    const selectionGeo = new THREE.RingGeometry(8, 9, 32);
    const selectionMat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthTest: false,
    });
    const selection = new THREE.Mesh(selectionGeo, selectionMat);
    world.add(selection);
    disposable.push(selectionGeo, selectionMat);
    const starField = new THREE.Group();
    starField.userData.starField = true;
    world.add(starField);
    const starLayers = [
      { min: -10, max: 0.3, size: 3.4, opacity: 0.95 },
      { min: 0.3, max: 1, size: 2.6, opacity: 0.8 },
      { min: 1, max: 2, size: 2, opacity: 0.65 },
    ].map((layer) => {
      const entries = BRIGHT_STARS.map((s, i) => ({ ...s, index: i })).filter(
        (s) => s.mag >= layer.min && s.mag < layer.max,
      );
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          new Float32Array(entries.length * 3),
          3,
        ),
      );
      const mat = new THREE.PointsMaterial({
        color: '#d5e6f2',
        size: layer.size,
        transparent: true,
        opacity: layer.opacity,
        sizeAttenuation: false,
        depthWrite: false,
      });
      const points = new THREE.Points(geo, mat);
      points.userData.starIds = entries.map((s) => s.hip);
      starField.add(points);
      disposable.push(geo, mat);
      return { points, entries, opacity: layer.opacity };
    });

    // A cheap sky dome: no textures, weather requests, ray marching or extra render pass.
    const skyGeometry = new THREE.SphereGeometry(1800, 24, 16);
    const skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      uniforms: {
        zenith: { value: new THREE.Color() },
        horizon: { value: new THREE.Color() },
        ground: { value: new THREE.Color() },
        sunDirection: { value: new THREE.Vector3() },
        glow: { value: 0 },
        groundView: { value: 0 },
      },
      vertexShader:
        'varying vec3 worldPosition; void main(){vec4 w=modelMatrix*vec4(position,1.0);worldPosition=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
      fragmentShader: `uniform vec3 zenith,horizon,ground,sunDirection;uniform float glow,groundView;varying vec3 worldPosition;
    void main(){vec3 direction=normalize(worldPosition-cameraPosition);float height=groundView>0.5?direction.y:abs(direction.y);
     vec3 bearing=normalize(vec3(direction.x,0.0,direction.z)+vec3(0.00001,0.0,0.0));
     vec3 sunBearing=normalize(vec3(sunDirection.x,0.0,sunDirection.z)+vec3(0.00001,0.0,0.0));
     float towards=pow(max(0.0,dot(bearing,sunBearing)),4.0);
     float haze=pow(1.0-clamp(height,0.0,1.0),3.0);
     vec3 colour=mix(zenith,horizon,haze*mix(1.0,0.25+0.75*towards,glow));
     colour=mix(colour,ground,groundView*smoothstep(0.0,0.16,-height));gl_FragColor=vec4(colour,1.0);
     #include <colorspace_fragment>
    }`,
    });
    const skyDome = new THREE.Mesh(skyGeometry, skyMaterial);
    skyDome.userData.skyDome = true;
    skyDome.renderOrder = -1000;
    skyDome.frustumCulled = false;
    scene.add(skyDome);
    disposable.push(skyGeometry, skyMaterial);

    scene.traverse((o) => {
      const material = (o as THREE.Mesh).material;
      if (
        material &&
        !Array.isArray(material) &&
        'color' in material &&
        !(material instanceof THREE.PointsMaterial)
      ) {
        if (!material.userData.themeColor)
          material.userData.themeColor =
            '#' + (material as THREE.MeshBasicMaterial).color.getHexString();
      }
    });
    let lastTheme = '';
    let starMinute = NaN;

    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let downX = 0;
    let downY = 0;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    function down(e: PointerEvent) {
      rotationPauseUntil = last + 5000;
      downX = e.clientX;
      downY = e.clientY;
      if (live.current.observer && !live.current.flat) {
        lastHeading = live.current.headings ?? lastHeading;
        targetAzimuth = azimuth;
        targetAltitude = altitude;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        renderer.domElement.setPointerCapture?.(e.pointerId);
        if (pointers.size === 2) {
          const a = [...pointers.values()];
          pinch = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        }
      }
    }
    function move(e: PointerEvent) {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const a = [...pointers.values()];
        const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        if (pinch > 0 && d > 0)
          groundCamera.fov = THREE.MathUtils.clamp(
            (groundCamera.fov * pinch) / d,
            35,
            110,
          );
        pinch = d;
        groundCamera.updateProjectionMatrix();
      } else {
        azimuth -= (e.clientX - prev.x) * 0.18;
        altitude = THREE.MathUtils.clamp(
          altitude + (e.clientY - prev.y) * 0.18,
          -89,
          89,
        );
        lastHeading = live.current.headings ?? lastHeading;
        targetAzimuth = azimuth;
        targetAltitude = altitude;
      }
    }
    function cancel(e: PointerEvent) {
      pointers.delete(e.pointerId);
      pinch = 0;
    }
    function wheel(e: WheelEvent) {
      rotationPauseUntil = last + 5000;
      if (!live.current.observer || live.current.flat) return;
      e.preventDefault();
      groundCamera.fov = THREE.MathUtils.clamp(
        groundCamera.fov + e.deltaY * 0.03,
        35,
        110,
      );
      groundCamera.updateProjectionMatrix();
    }
    function up(e: PointerEvent) {
      rotationPauseUntil = last + 5000;
      cancel(e);
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(mouse, activeCamera);
      const hits = ray.intersectObjects(
        nodes.filter((n) => n.mesh.visible).map((n) => n.mesh),
      );
      live.current.onSelect(hits[0]?.object.userData.id ?? null);
    }
    function key(e: KeyboardEvent) {
      rotationPauseUntil = last + 5000;
      if (e.key === 'Escape') {
        live.current.onSelect(null);
        return;
      }
      if (live.current.observer && !live.current.flat) {
        if (e.key === 'ArrowLeft') azimuth -= 5;
        else if (e.key === 'ArrowRight') azimuth += 5;
        else if (e.key === 'ArrowUp') altitude = Math.min(89, altitude + 5);
        else if (e.key === 'ArrowDown') altitude = Math.max(-89, altitude - 5);
        else if (e.key === '+' || e.key === '=')
          groundCamera.fov = Math.max(35, groundCamera.fov - 5);
        else if (e.key === '-')
          groundCamera.fov = Math.min(110, groundCamera.fov + 5);
        else return;
        targetAzimuth = azimuth;
        targetAltitude = altitude;
        e.preventDefault();
        groundCamera.updateProjectionMatrix();
        return;
      }
      if (e.key === '+' || e.key === '=')
        orbitCamera.zoom = Math.min(2.1, orbitCamera.zoom * 1.1);
      else if (e.key === '-')
        orbitCamera.zoom = Math.max(0.65, orbitCamera.zoom / 1.1);
      else if (e.key.startsWith('Arrow') && !live.current.flat) {
        const s = new THREE.Spherical().setFromVector3(orbitCamera.position);
        if (e.key === 'ArrowLeft') s.theta -= 0.1;
        if (e.key === 'ArrowRight') s.theta += 0.1;
        if (e.key === 'ArrowUp') s.phi = Math.max(0.05, s.phi - 0.1);
        if (e.key === 'ArrowDown')
          s.phi = Math.min(Math.PI - 0.05, s.phi + 0.1);
        orbitCamera.position.setFromSpherical(s);
      } else return;
      e.preventDefault();
      orbitCamera.updateProjectionMatrix();
      controls.update();
    }
    renderer.domElement.addEventListener('pointermove', move);
    renderer.domElement.addEventListener('pointercancel', cancel);
    renderer.domElement.addEventListener('wheel', wheel, { passive: false });
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointerup', up);
    renderer.domElement.addEventListener('keydown', key);
    const resize = new ResizeObserver(() => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w <= 0 || h <= 0) return;
      renderer.setSize(w, h);
      groundCamera.aspect = w / h;
      groundCamera.updateProjectionMatrix();
      const span = w < 600 ? 365 : 340;
      const aspect = w / h;
      orbitCamera.left = -span * Math.max(1, aspect);
      orbitCamera.right = -orbitCamera.left;
      orbitCamera.top = span * Math.max(1, 1 / aspect);
      orbitCamera.bottom = -orbitCamera.top;
      orbitCamera.updateProjectionMatrix();
    });
    resize.observe(host);
    let morph = live.current.flat ? 1 : 0;
    let last = 0;
    let fpsTime = 0;
    let frames = 0;
    let lastFlat = live.current.flat;
    let reset = live.current.reset;
    const cameraStart = orbitCamera.position.clone();
    const cameraEnd = orbitCamera.position.clone();
    const savedCamera = new THREE.Vector3(0, 0, 760);
    let savedZoom = 1;
    let transition = 1;
    const upStart = orbitCamera.up.clone();
    const upEnd = orbitCamera.up.clone();
    let lastFocus = false;
    let rotationPauseUntil = 0;
    let beforeFocus: {
      position: THREE.Vector3;
      up: THREE.Vector3;
      target: THREE.Vector3;
      zoom: number;
      saved: THREE.Vector3;
    } | null = null;

    function updateLine(l: THREE.Line, points: THREE.Vector3[]) {
      const a = l.geometry.getAttribute('position') as THREE.BufferAttribute;
      points.forEach((p, i) => a.setXYZ(i, p.x, p.y, p.z));
      a.needsUpdate = true;
      l.geometry.computeBoundingSphere();
    }
    let houseFrame: any = null;
    let houseMode = '';
    let houseResult = houseCusps(live.current.chart, live.current.houseSystem);
    const playback = new PlaybackInterpolator();
    let wasPlaying = !!live.current.playing;
    function updateFocusAndHeading(p: Props, now: number) {
      if (!!p.focus !== lastFocus) {
        if (p.focus)
          beforeFocus = {
            position: orbitCamera.position.clone(),
            up: orbitCamera.up.clone(),
            target: controls.target.clone(),
            zoom: orbitCamera.zoom,
            saved: savedCamera.clone(),
          };
        controls.autoRotate = false;
        controls.enableDamping = false;
        controls.update();
        if (p.focus) {
          orbitCamera.position.set(430, 180, 620);
          orbitCamera.up.set(0, 1, 0);
          orbitCamera.zoom = 1;
          controls.target.set(0, 0, 0);
          rotationPauseUntil = 0;
        } else if (beforeFocus) {
          orbitCamera.position.copy(beforeFocus.position);
          orbitCamera.up.copy(beforeFocus.up);
          orbitCamera.zoom = beforeFocus.zoom;
          controls.target.copy(beforeFocus.target);
          savedCamera.copy(beforeFocus.saved);
        }
        lastFocus = !!p.focus;
        lastFlat = p.flat;
        morph = p.flat ? 1 : 0;
        transition = 1;
        orbitCamera.updateProjectionMatrix();
        orbitCamera.lookAt(controls.target);
        if (!p.flat) controls.update();
        controls.enableDamping = true;
      }
      controls.autoRotate =
        !!p.focus && !!p.autoRotate && !p.reduced && now >= rotationPauseUntil;
      controls.autoRotateSpeed = 0.25;
      if ((p.headings ?? 0) !== lastHeading) {
        lastHeading = p.headings ?? 0;
        targetAzimuth = p.heading ?? 90;
        targetAltitude = 0;
      }
      if ((p.level ?? 0) !== lastLevel) {
        lastLevel = p.level ?? 0;
        controls.enableDamping = false;
        controls.update();
        controls.enableDamping = true;
        lastFlat = p.flat;
        morph = 0;
        savedCamera.set(0, 0, 760);
        orbitCamera.position.set(0, 0, 760);
        orbitCamera.up.set(0, 1, 0);
        controls.target.set(0, 0, 0);
        transition = 1;
        targetAzimuth = p.heading ?? 90;
        targetAltitude = 0;
        controls.update();
      }
    }

    function updateCameraTransition(p: Props, dt: number, ground: boolean) {
      if (p.reset !== reset) {
        reset = p.reset;
        orbitCamera.zoom = 1;
        orbitCamera.updateProjectionMatrix();
        if (p.flat) {
          orbitCamera.position.set(0.001, 750, 0);
          orbitCamera.up.set(0, 0, -1);
        } else {
          orbitCamera.position.set(0, 0, 760);
          orbitCamera.up.set(0, 1, 0);
          azimuth = 90;
          altitude = 0;
          targetAzimuth = 90;
          targetAltitude = 0;
          groundCamera.fov = 85;
          groundCamera.updateProjectionMatrix();
        }
        controls.target.set(0, 0, 0);
        if (!p.flat) controls.update();
        else orbitCamera.lookAt(0, 0, 0);
        transition = 1;
      }
      if (p.flat !== lastFlat) {
        if (p.flat) {
          savedCamera.copy(orbitCamera.position);
          savedZoom = orbitCamera.zoom;
          orbitCamera.zoom = 1;
        } else orbitCamera.zoom = savedZoom;
        orbitCamera.updateProjectionMatrix();
        upStart.copy(orbitCamera.up);
        upEnd.set(0, p.flat ? 0 : 1, p.flat ? -1 : 0);
        cameraStart.copy(orbitCamera.position);
        cameraEnd.copy(p.flat ? new THREE.Vector3(0.001, 750, 0) : savedCamera);
        lastFlat = p.flat;
        transition = 0;
      }
      const moving = transition < 1;
      transition = Math.min(1, transition + dt / (p.reduced ? 0.01 : 1.1));
      const ease = transition * transition * (3 - 2 * transition);
      if (moving) {
        orbitCamera.up.lerpVectors(upStart, upEnd, ease).normalize();
        orbitCamera.position.lerpVectors(cameraStart, cameraEnd, ease);
        orbitCamera.lookAt(0, 0, 0);
      } else if (!p.flat && !ground) {
        orbitCamera.up.set(0, 1, 0);
        controls.update(dt);
      } else orbitCamera.lookAt(0, 0, 0);
      controls.enableRotate = !p.flat && transition === 1;
      controls.enabled = transition === 1 && !p.flat && !ground;
      const target = p.flat ? 1 : 0;
      morph =
        p.reduced || ground
          ? target
          : THREE.MathUtils.damp(morph, target, 6, dt);
      if (Math.abs(morph - target) < 0.001) morph = target;
    }

    function updateAspectLines(
      p: Props,
      c: Props['chart'],
      dt: number,
      bright: boolean,
    ) {
      const active = new Map(
        [...c.aspects, ...(c.patternEdges ?? [])].map((a: any) => [
          edgeKey(a.a, a.b),
          a,
        ]),
      );
      edges.forEach((e) => {
        const a: any = active.get(
          edgeKey(nodes[e.i].mesh.userData.id, nodes[e.j].mesh.userData.id),
        );
        const chosen =
          !p.selected ||
          [nodes[e.i].mesh.userData.id, nodes[e.j].mesh.userData.id].includes(
            p.selected,
          );
        const opacity =
          p.aspects && a && nodes[e.i].mesh.visible && nodes[e.j].mesh.visible
            ? p.focus
              ? bright
                ? 0.42
                : 0.26
              : chosen
                ? bright
                  ? 0.92
                  : 0.65
                : bright
                  ? 0.1
                  : 0.065
            : 0;
        e.mat.opacity = THREE.MathUtils.damp(e.mat.opacity, opacity, 10, dt);
        if (a) {
          e.mat.color.set(a.color);
          e.mat.userData.themeColor = a.color;
        }
        e.line.visible = e.mat.opacity > 0.005;
        updateLine(e.line, [
          nodes[e.i].mesh.position,
          nodes[e.j].mesh.position,
        ]);
      });
    }

    function updateReferenceLines(
      p: Props,
      c: Props['chart'],
      ground: boolean,
      bright: boolean,
    ) {
      const hor = Array.from({ length: 181 }, (_, i) => {
        const a = i * 2 * DEG;
        return new THREE.Vector3(
          (c.east[0] * Math.cos(a) + c.north[0] * Math.sin(a)) * 218,
          (c.east[2] * Math.cos(a) + c.north[2] * Math.sin(a)) * 218,
          -(c.east[1] * Math.cos(a) + c.north[1] * Math.sin(a)) * 218,
        );
      });
      updateLine(horizon, hor);
      horizon.visible = p.horizon && morph < 0.99;
      (horizon.material as THREE.LineBasicMaterial).opacity =
        (bright ? 0.85 : 0.5) * (1 - morph);
      updateLine(
        equator,
        Array.from({ length: 181 }, (_, i) => {
          const a = i * 2 * DEG;
          return new THREE.Vector3(
            218 * Math.cos(a),
            -218 * Math.sin(a) * Math.sin(c.eps * DEG),
            -218 * Math.sin(a) * Math.cos(c.eps * DEG),
          );
        }),
      );
      equator.visible = p.grid && morph < 0.99;
      (equator.material as THREE.LineBasicMaterial).opacity =
        (bright ? 0.2 : 0.3) * (1 - morph);

      const planeVector = (a: number[], r = 218) =>
        new THREE.Vector3(a[0] * r, a[2] * r, -a[1] * r);
      const pathVector = (a: number[], r = 225) => {
        const lon = wrap(Math.atan2(a[1], a[0]) / DEG);
        const lat = Math.atan2(a[2], Math.hypot(a[0], a[1])) / DEG;
        return v(lon, lat * (1 - morph), r - 27 * morph);
      };
      lunarPath.visible = !!p.nodeOrbit && !!c.moonOrbit;
      if (c.moonOrbit)
        updateLine(
          lunarPath,
          c.moonOrbit.map((a: number[]) => pathVector(a, 225)),
        );
      primePath.visible = !!p.primeVertical && morph < 0.995;
      updateLine(
        primePath,
        Array.from({ length: 181 }, (_, i) => {
          const a = i * 2 * DEG;
          return planeVector(
            c.east.map(
              (x: number, j: number) =>
                x * Math.cos(a) + c.zenith[j] * Math.sin(a),
            ),
            227,
          );
        }),
      );
      const compass = [
        c.east,
        c.east.map((x: number) => -x),
        c.north,
        c.north.map((x: number) => -x),
        c.zenith,
      ];
      directions.forEach((l, i) => {
        l.position.copy(planeVector(compass[i], ground ? 210 : 290));
        l.visible = p.horizon && morph < 0.995;
      });
      trailLines.forEach((l, i) => {
        const trail = c.pointTrails?.find(
          (t: any) => t.id === l.userData.trail,
        );
        l.visible = !!p.trails && !!trail;
        if (!trail) return;
        const points: THREE.Vector3[] = [];
        for (let j = 1; j < trail.positions.length; j++) {
          const a = trail.positions[j - 1];
          const b = trail.positions[j];
          if (!a || !b || Math.abs(((b[0] - a[0] + 540) % 360) - 180) > 60) {
            points.push(new THREE.Vector3(), new THREE.Vector3());
            continue;
          }
          points.push(
            v(a[0], 0, 231 + i * 3 - 27 * morph),
            v(b[0], 0, 231 + i * 3 - 27 * morph),
          );
        }
        updateLine(l, points);
      });
    }

    function updateHouseLines(
      p: Props,
      c: Props['chart'],
      hideBelow: boolean,
      bright: boolean,
    ) {
      const showHouses = p.flat ? (p.houses2d ?? true) : p.houses;
      const showDivision = p.gridMode === 'houses' && morph < 0.995;
      const polarLatitude =
        c.latitude ??
        Math.asin(
          Math.max(
            -1,
            Math.min(
              1,
              c.zenith[1] * Math.sin(c.eps * DEG) +
                c.zenith[2] * Math.cos(c.eps * DEG),
            ),
          ),
        ) / DEG;
      const fadePolar =
        p.houseSystem === 'placidus' && Math.abs(polarLatitude) > 0.01;
      if (
        (showHouses || showDivision) &&
        (c !== houseFrame || p.houseSystem !== houseMode)
      ) {
        houseFrame = c;
        houseMode = p.houseSystem;
        houseResult = houseCusps(c, p.houseSystem);
      }
      if (
        showDivision &&
        (c !== divisionFrame || p.houseSystem !== divisionSystem)
      ) {
        divisionFrame = c;
        divisionSystem = p.houseSystem;
        const curves = houseBoundaryCurves(c, p.houseSystem, houseResult);
        curves.forEach((points: number[][], i: number) => {
          const l = divisionLines[i];
          updateLine(
            l,
            points.map(
              (p: number[]) =>
                new THREE.Vector3(p[0] * 218, p[2] * 218, -p[1] * 218),
            ),
          );
          const colors = l.geometry.getAttribute(
            'color',
          ) as THREE.BufferAttribute;
          for (let k = 0; k < 129; k++) {
            const a = fadePolar ? Math.min(1, k / 8, (128 - k) / 8) : 1;
            colors.setW(k, a * a * (3 - 2 * a));
          }
          colors.needsUpdate = true;
        });
      }
      divisionLines.forEach((l, i) => {
        l.visible = showDivision && houseResult.available;
        (l.material as THREE.LineBasicMaterial).opacity =
          (i % 3 === 0 ? (bright ? 0.3 : 0.4) : bright ? 0.14 : 0.23) *
          (1 - morph);
      });
      polarLabels.forEach((l, i) => {
        const sign = i === 0 ? 1 : -1;
        l.position.set(
          0,
          sign * 242 * Math.cos(c.eps * DEG),
          -sign * 242 * Math.sin(c.eps * DEG),
        );
        l.visible =
          showDivision &&
          houseResult.available &&
          fadePolar &&
          !(
            hideBelow &&
            l.position.clone().applyQuaternion(world.quaternion).y < 0
          );
        l.material.opacity = 0.8 * (1 - morph);
      });
      houseLines.forEach((l, i) => {
        const visible = showHouses && houseResult.available;
        l.visible = visible;
        houseLabels[i].visible = visible;
        houseLabels[i].material.opacity = bright ? 0.6 : 0.55;
        if (!visible) return;
        const cusp = houseResult.cusps[i];
        updateLine(l, [v(cusp, 0, 30), v(cusp, 0, 236)]);
        (l.material as THREE.LineBasicMaterial).opacity = bright
          ? 0.65 + 0.2 * morph
          : 0.25 + 0.4 * morph;
        houseLabels[i].position.copy(v(houseResult.centres[i], 0, 164));
      });
      ascL.position.copy(v(c.asc, 0, 310));
      mcL.position.copy(v(c.mc, 0, 310));
      ascL.visible = p.horizon || showHouses || showDivision;
      mcL.visible = p.horizon || showHouses || showDivision;
    }

    function animate(now: number) {
      if (document.hidden) {
        last = now;
        return;
      }
      const dt = Math.min(0.06, last ? (now - last) / 1000 : 1 / 60);
      last = now;
      const p = live.current;
      const c = playback.sample(
        p.chart,
        now,
        !!p.playing && p.smoothPlayback !== false && !p.reduced,
      );
      if (!c) return;
      const stopped = wasPlaying && !p.playing;
      wasPlaying = !!p.playing;
      const theme = p.theme ?? 'dark';
      const appearance = themeAppearance(theme, c);
      const bright = appearance.light;
      const ground = !!p.observer && !p.flat;
      const hideBelow = ground && p.showBelowHorizon === false;
      world.traverse((o) => {
        if (o.userData.hiddenByGround) {
          o.visible = true;
          o.userData.hiddenByGround = false;
        }
      });
      updateFocusAndHeading(p, now);
      for (const b of c.bodies)
        if (!nodes.some((n) => n.mesh.userData.id === b.id)) {
          const j = nodes.length;
          nodes.push(makeNode(b));
          for (let i = 0; i < j; i++) {
            const l = line([v(0), v(0)], '#78ddd1', 0);
            l.userData.aspect = true;
            edges.push({
              line: l,
              mat: l.material as THREE.LineBasicMaterial,
              i,
              j,
            });
          }
        }
      updateCameraTransition(p, dt, ground);
      const rotation = (180 - c.asc) * DEG;
      const m = observerMatrix(c);
      const matrix = new THREE.Matrix4().set(
        m[0],
        m[1],
        m[2],
        0,
        m[3],
        m[4],
        m[5],
        0,
        m[6],
        m[7],
        m[8],
        0,
        0,
        0,
        0,
        1,
      );
      const q3 = new THREE.Quaternion().setFromRotationMatrix(matrix);
      const q2 = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        rotation,
      );
      world.quaternion.copy(q3).slerp(q2, morph);
      sphere.visible = p.grid && morph < 0.995;
      sphere.traverse((o) => {
        if (o instanceof THREE.Line)
          (o.material as THREE.LineBasicMaterial).opacity =
            (bright ? 0.14 : 0.23) * (1 - morph);
      });
      earth.visible = !ground && morph < 0.99;
      earthLabel.visible = !ground && morph < 0.5;
      earth.rotation.y += dt * 0.08;
      const k = p.reduced ? 1 : 1 - Math.exp(-dt * 18);
      nodes.forEach((n) => {
        const b = c.bodies.find((b: any) => b.id === n.mesh.userData.id);
        n.mesh.visible = !!b;
        n.label.visible = !!b;
        if (!b) {
          n.tether.visible = false;
          n.initialized = false;
          return;
        }
        const direction = ground
          ? topocentricDirection(b, c.observerVector)
          : b;
        if (!n.initialized) {
          n.lon = direction.lon;
          n.lat = direction.lat;
          n.initialized = true;
        }
        const smooth = p.playing || stopped || b.kind === 'point' ? 1 : k;
        n.lon = wrap(
          n.lon + (((direction.lon - n.lon + 540) % 360) - 180) * smooth,
        );
        n.lat += (direction.lat - n.lat) * smooth;
        n.mesh.position.set(...morphPoint(n.lon, n.lat, morph));
        n.label.position.copy(v(n.lon, n.lat * (1 - morph), 239 - morph * 23));
        if (!ground) n.label.position.y += 9 * (1 - morph);
        n.label.material.opacity = p.selected && p.selected !== b.id ? 0.4 : 1;
        n.mesh.material.color.set(n.mesh.material.map ? '#ffffff' : b.color);
        n.mesh.scale.setScalar(p.selected === b.id ? 1.5 : 1);
        updateLine(n.tether, [v(n.lon, 0, 218), n.mesh.position]);
        n.tether.visible = p.grid && morph < 0.99 && !ground;
        if (
          hideBelow &&
          n.mesh.position.clone().applyQuaternion(world.quaternion).y < -0.01
        ) {
          n.mesh.visible = false;
          n.label.visible = false;
        }
      });
      updateAspectLines(p, c, dt, bright);
      updateReferenceLines(p, c, ground, bright);
      updateHouseLines(p, c, hideBelow, bright);
      const selected = nodes.find(
        (n) => n.mesh.visible && n.mesh.userData.id === p.selected,
      );
      selection.visible = !!selected;
      if (selected) {
        selection.position.copy(selected.mesh.position);
        selection.quaternion
          .copy(world.quaternion)
          .invert()
          .multiply((ground ? groundCamera : orbitCamera).quaternion);
      }
      const minute = Math.floor(
        (Number.isFinite(c.time) ? c.time : Date.now()) / 60000,
      );
      if (minute !== starMinute) {
        starMinute = minute;
        const positions = starPositions(minute * 60000);
        starLayers.forEach(({ points, entries }) => {
          const attr = points.geometry.getAttribute(
            'position',
          ) as THREE.BufferAttribute;
          entries.forEach((s, i) => {
            const v = positions[s.index];
            attr.setXYZ(i, v[0] * 325, v[1] * 325, v[2] * 325);
          });
          attr.needsUpdate = true;
          points.geometry.computeBoundingSphere();
        });
      }
      if (p.focus)
        world.traverse((o) => {
          if (o instanceof THREE.Sprite && o.visible) {
            o.visible = false;
            o.userData.hiddenByGround = true;
          }
        });
      activeCamera = ground ? groundCamera : orbitCamera;
      if (ground) {
        const turn = p.reduced ? 1 : 1 - Math.exp(-dt * 8);
        const delta = ((targetAzimuth - azimuth + 540) % 360) - 180;
        azimuth += delta * turn;
        altitude += (targetAltitude - altitude) * turn;
        const a = azimuth * DEG;
        const h = altitude * DEG;
        groundCamera.lookAt(
          Math.sin(a) * Math.cos(h),
          Math.sin(h),
          -Math.cos(a) * Math.cos(h),
        );
        if (hideBelow)
          world.traverse((o) => {
            if (
              o instanceof THREE.Sprite &&
              o.visible &&
              o.position.clone().applyQuaternion(world.quaternion).y < -0.01
            ) {
              o.visible = false;
              o.userData.hiddenByGround = true;
            }
          });
      }
      starField.visible = morph < 0.995;
      const themeKey = theme + ':' + bright;
      if (lastTheme !== themeKey) {
        lastTheme = themeKey;
        if (host?.parentElement)
          host.parentElement.dataset.skyScheme = bright ? 'light' : 'dark';
      }
      skyDome.visible = theme === 'sky' && morph < 0.995;
      skyDome.position.copy(activeCamera.position);
      skyMaterial.uniforms.zenith.value.set(appearance.zenith);
      skyMaterial.uniforms.horizon.value.set(appearance.horizon);
      skyMaterial.uniforms.ground.value.set(appearance.ground);
      skyMaterial.uniforms.sunDirection.value.fromArray(appearance.direction);
      skyMaterial.uniforms.glow.value = appearance.glow;
      skyMaterial.uniforms.groundView.value = ground ? 1 : 0;
      depthUniforms.amount.value = p.dimBack && !ground ? 1 - morph : 0;
      activeCamera.getWorldDirection(depthUniforms.direction.value).negate();
      // Update colour, never recreate geometry/camera when switching themes.
      world.traverse((o) => {
        const mat = (o as THREE.Mesh).material as
          | THREE.MeshBasicMaterial
          | undefined;
        if (mat?.userData.themeColor) {
          configureDepthDimming(mat, depthUniforms);
          mat.color.set(
            mat.userData.bodyMaterial
              ? mat.map
                ? '#ffffff'
                : mat.userData.themeColor
              : mat.userData.bodyGlyph
                ? bodyInkColor(mat.userData.themeColor, bright)
                : o.userData.aspect
                  ? aspectInkColor(mat.userData.themeColor, bright)
                  : inkColor(mat.userData.themeColor, bright),
          );
        }
      });
      keyLight.position
        .set(-350, 450, 650)
        .applyQuaternion(activeCamera.quaternion);
      fillLight.position
        .set(400, -100, -250)
        .applyQuaternion(activeCamera.quaternion);
      const viewHeight = Math.max(1, host?.clientHeight ?? 660);
      const cameraInverse = activeCamera.matrixWorldInverse;
      activeCamera.updateMatrixWorld();
      const unitsPerPixel = (position: THREE.Vector3) =>
        ground
          ? (2 *
              Math.max(
                1,
                -position
                  .clone()
                  .applyQuaternion(world.quaternion)
                  .applyMatrix4(cameraInverse).z,
              ) *
              Math.tan((groundCamera.fov * DEG) / 2)) /
            viewHeight
          : (orbitCamera.top - orbitCamera.bottom) /
            (viewHeight * orbitCamera.zoom);
      if (labelLocale !== p.locale) {
        labelLocale = p.locale;
        refreshLabels();
        renderer.domElement.setAttribute(
          'aria-label',
          tr('天球。ドラッグで回転、ホイールで拡大。天体をクリックして選択。'),
        );
      }
      [...navigationLabels, ...houseLabels].forEach((l) => {
        const unit = unitsPerPixel(l.position);
        const height =
          Math.min(
            32,
            Math.max(l.userData.minPixels, l.userData.labelSize / unit),
          ) * unit;
        l.scale.set(height * 3.2, height, 1);
      });
      nodes.forEach((n) => {
        const unit = unitsPerPixel(n.mesh.position);
        const size = Math.max(
          1,
          Math.min(1.8, (8 * unit) / (2 * n.mesh.userData.radius)),
        );
        n.mesh.scale.setScalar(
          size * (p.selected === n.mesh.userData.id ? 1.5 : 1),
        );
      });
      starLayers.forEach(({ points }) => {
        (points.material as THREE.PointsMaterial).opacity =
          0.3 *
          (p.focus ? 1 : 0.85) *
          (1 - morph) *
          (theme === 'sky' ? appearance.stars : 1);
        (points.material as THREE.PointsMaterial).color.set(
          theme === 'light' ? '#385568' : '#d5e6f2',
        );
      });
      renderer.clippingPlanes = hideBelow ? [horizonClip] : [];
      renderer.render(scene, activeCamera);
      frames++;
      if (now - fpsTime > 1000) {
        p.onFps(Math.round((frames * 1000) / (now - fpsTime)));
        frames = 0;
        fpsTime = now;
      }
    }
    renderer.setAnimationLoop(animate);
    const lost = (e: Event) => {
      e.preventDefault();
      renderer.setAnimationLoop(null);
      setFailure(
        '描画への接続が失われました。ページを再読み込みしてください。',
      );
    };
    renderer.domElement.addEventListener('webglcontextlost', lost);
    return () => {
      labelsDisposed = true;
      redrawLabels.length = 0;
      renderer.setAnimationLoop(null);
      resize.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('pointercancel', cancel);
      renderer.domElement.removeEventListener('wheel', wheel);
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('keydown', key);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      disposable.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <div className="sky-host" ref={mount}>
      {tr(
        failure && (
          <div className="render-error" role="alert">
            <p>{tr(failure)}</p>
            <p>{tr('天体位置とアスペクトは右の一覧でも確認できます。')}</p>
          </div>
        ),
      )}
    </div>
  );
}
