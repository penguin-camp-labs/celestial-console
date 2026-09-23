'use client';
import { t as tr } from './use-locale';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createPlanetMaterial, createSaturnRing } from '@/lib/planet-materials';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  CSS2DObject,
  CSS2DRenderer,
} from 'three/addons/renderers/CSS2DRenderer.js';
import { DisplayClock } from '@/lib/clock.mjs';
import { planetRotationAngle } from '@/lib/engine.mjs';

type OrreryBody = {
  id: string;
  name: string;
  symbol: string;
  color: string;
  orbit: number;
  size: number;
  parent?: string;
  parentDistance?: number;
  orbitNormal?: number[];
  distance: number;
  x: number;
  y: number;
  z: number;
};

type Props = {
  bodies: OrreryBody[];
  orbits: { id: string; parent?: string; points: number[][] }[];
  geocentricBodies: { id: string; lon: number; lat: number }[];
  time: number;
  playing: boolean;
  light: boolean;
  locale: string;
  reset: number;
  reduced: boolean;
  exiting: boolean;
  onExitComplete: () => void;
};

const compressedDistance = (au: number) => 28 + Math.log1p(au * 2.4) * 82;
const MOON_ORBIT_RADIUS = 22;
const MEAN_MOON_DISTANCE = 0.00257;

function updateOrbitGeometry(
  line: THREE.Line,
  points: number[][],
  moon: boolean,
) {
  const positions = line.geometry.getAttribute(
    'position',
  ) as THREE.BufferAttribute;
  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    const distance = Math.hypot(...point);
    const scale = moon
      ? MOON_ORBIT_RADIUS / MEAN_MOON_DISTANCE
      : compressedDistance(distance) / distance;
    positions.setXYZ(
      index,
      point[0] * scale,
      point[1] * scale,
      point[2] * scale,
    );
  }
  positions.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}

function orbitGeometry(pointCount: number) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(pointCount * 3), 3),
  );
  return geometry;
}

export default function Orrery({
  bodies,
  orbits,
  geocentricBodies,
  time,
  playing,
  light,
  locale,
  reset,
  reduced,
  exiting,
  onExitComplete,
}: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const liveBodies = useRef(bodies);
  liveBodies.current = bodies;
  const liveOrbits = useRef(orbits);
  liveOrbits.current = orbits;
  const liveGeocentric = useRef(geocentricBodies);
  liveGeocentric.current = geocentricBodies;
  const livePlayback = useRef({ time, playing });
  livePlayback.current = { time, playing };
  const liveTransition = useRef({ exiting, onExitComplete });
  liveTransition.current = { exiting, onExitComplete };
  const resetCamera = useRef<(() => void) | null>(null);
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
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute(
      'aria-label',
      tr('太陽系儀。ドラッグで回転、ホイールで拡大。'),
    );
    renderer.domElement.tabIndex = 0;
    host.appendChild(renderer.domElement);

    const labels = new CSS2DRenderer();
    labels.domElement.className = 'orrery-label-layer';
    host.appendChild(labels.domElement);

    const scene = new THREE.Scene();
    const world = new THREE.Group();
    scene.add(world);
    const camera = new THREE.PerspectiveCamera(38, 1, 1, 2200);
    const controls = new OrbitControls(camera, labels.domElement);
    controls.enableDamping = !reduced;
    controls.dampingFactor = 0.075;
    controls.minDistance = 150;
    controls.maxDistance = 1050;

    const setInitialCamera = () => {
      camera.position.set(0, 360, 520);
      controls.target.set(0, 0, 0);
      controls.update();
    };
    resetCamera.current = setInitialCamera;
    setInitialCamera();

    scene.add(new THREE.HemisphereLight(0xffffff, 0x203040, light ? 2.2 : 1.5));
    scene.add(new THREE.PointLight(0xffe3a8, light ? 70 : 95, 1200, 1.3));

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(12, 32, 20),
      createPlanetMaterial('Sun', '#ffc86b'),
    );
    world.add(sun);
    const rotatorById = new Map<string, THREE.Object3D>([['Sun', sun]]);

    const orbitGuides = new THREE.Group();
    world.add(orbitGuides);
    const orbitMaterials: THREE.Material[] = [];
    const eclipticMaterial = new THREE.MeshBasicMaterial({
      color: light ? 0x8da3ad : 0x244652,
      transparent: true,
      opacity: light ? 0.05 : 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    eclipticMaterial.userData.baseOpacity = eclipticMaterial.opacity;
    orbitMaterials.push(eclipticMaterial);
    const ecliptic = new THREE.Mesh(
      new THREE.CircleGeometry(compressedDistance(39.482) + 28, 96),
      eclipticMaterial,
    );
    ecliptic.rotation.x = -Math.PI / 2;
    orbitGuides.add(ecliptic);

    const markerById = new Map<string, THREE.Group>();
    const orbitById = new Map<string, THREE.Line>();
    let moonOrbit: THREE.Line | null = null;
    for (const body of liveBodies.current) {
      const path = liveOrbits.current.find((orbit) => orbit.id === body.id);
      if (!path) continue;
      if (body.parent) {
        const material = new THREE.LineBasicMaterial({
          color: light ? 0x71858e : 0x7995a2,
          transparent: true,
          opacity: light ? 0.56 : 0.68,
        });
        material.userData.baseOpacity = material.opacity;
        orbitMaterials.push(material);
        moonOrbit = new THREE.Line(orbitGeometry(path.points.length), material);
        world.add(moonOrbit);
        orbitById.set(body.id, moonOrbit);
      } else {
        const material = new THREE.LineBasicMaterial({
          color: light ? 0x607984 : 0x41616d,
          transparent: true,
          opacity: light ? 0.34 : 0.42,
        });
        material.userData.baseOpacity = material.opacity;
        orbitMaterials.push(material);
        const line = new THREE.Line(
          orbitGeometry(path.points.length),
          material,
        );
        orbitGuides.add(line);
        orbitById.set(body.id, line);
      }
      const group = new THREE.Group();
      const rotator = new THREE.Group();
      rotator.add(
        new THREE.Mesh(
          new THREE.SphereGeometry(body.size, 32, 24),
          createPlanetMaterial(body.id, body.color),
        ),
      );
      if (body.id === 'Saturn') {
        rotator.add(createSaturnRing(body.size));
      }
      group.add(rotator);
      rotatorById.set(body.id, rotator);
      const label = document.createElement('span');
      label.className = 'orrery-label';
      label.textContent = `${body.symbol} ${tr(body.name)}`;
      label.title = `${body.distance.toFixed(3)} AU`;
      const labelObject = new CSS2DObject(label);
      labelObject.position.set(0, body.size + 8, 0);
      group.add(labelObject);
      markerById.set(body.id, group);
      world.add(group);
    }

    let renderedOrbits: typeof orbits | null = null;
    const updateOrbits = () => {
      if (renderedOrbits === liveOrbits.current) return;
      renderedOrbits = liveOrbits.current;
      for (const orbit of renderedOrbits) {
        const line = orbitById.get(orbit.id);
        if (line)
          updateOrbitGeometry(line, orbit.points, Boolean(orbit.parent));
      }
    };
    updateOrbits();
    const spinClock = new DisplayClock();
    const updateRotation = (now: number) => {
      const spinTime = spinClock.sample(
        livePlayback.current.time,
        now,
        livePlayback.current.playing && !reduced,
      );
      rotatorById.forEach((rotator, id) => {
        rotator.rotation.y = planetRotationAngle(id, spinTime);
      });
    };

    const geocentricPosition = (id: string) => {
      if (id === 'Earth') return new THREE.Vector3();
      const body = liveGeocentric.current.find((item) => item.id === id);
      if (!body) return new THREE.Vector3();
      const lon = THREE.MathUtils.degToRad(body.lon);
      const lat = THREE.MathUtils.degToRad(body.lat);
      const radial = Math.cos(lat) * 150;
      return new THREE.Vector3(
        Math.cos(lon) * radial,
        Math.sin(lat) * 150,
        -Math.sin(lon) * radial,
      );
    };
    const updateBodies = (progress: number) => {
      const currentBodies = liveBodies.current;
      const earth = currentBodies.find((body) => body.id === 'Earth');
      if (!earth) return;
      const earthScale = compressedDistance(earth.distance) / earth.distance;
      const earthPosition = new THREE.Vector3(
        earth.x * earthScale,
        earth.y * earthScale,
        earth.z * earthScale,
      );
      sun.position.lerpVectors(
        geocentricPosition('Sun'),
        new THREE.Vector3(),
        progress,
      );
      for (const body of currentBodies) {
        const marker = markerById.get(body.id);
        if (!marker) continue;
        const target = new THREE.Vector3();
        if (body.parent === 'Earth') {
          const relative = new THREE.Vector3(
            body.x - earth.x,
            body.y - earth.y,
            body.z - earth.z,
          );
          const radius =
            MOON_ORBIT_RADIUS *
            ((body.parentDistance ?? MEAN_MOON_DISTANCE) / MEAN_MOON_DISTANCE);
          target
            .copy(earthPosition)
            .add(relative.normalize().multiplyScalar(radius));
        } else {
          const scale = compressedDistance(body.distance) / body.distance;
          target.set(body.x * scale, body.y * scale, body.z * scale);
        }
        marker.position.lerpVectors(
          geocentricPosition(body.id),
          target,
          progress,
        );
        const label = marker.children.find(
          (child) => child instanceof CSS2DObject,
        );
        if (label instanceof CSS2DObject) {
          label.element.title = body.parentDistance
            ? `${Math.round(body.parentDistance * 149597870.7).toLocaleString()} km`
            : `${body.distance.toFixed(3)} AU`;
        }
      }
      const moon = currentBodies.find((body) => body.id === 'Moon');
      if (moonOrbit && moon) {
        moonOrbit.position.copy(earthPosition);
      }
      const orbitScale = 0.18 + progress * 0.82;
      orbitGuides.scale.setScalar(orbitScale);
      orbitMaterials.forEach((material) => {
        material.opacity = material.userData.baseOpacity * progress;
      });
    };
    let transition = reduced ? 1 : 0;
    updateBodies(transition);
    updateRotation(performance.now());

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      labels.setSize(width, height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let frame = 0;
    let previous = performance.now();
    let exitNotified = false;
    const render = () => {
      frame = requestAnimationFrame(render);
      updateOrbits();
      const now = performance.now();
      const dt = Math.min(0.06, (now - previous) / 1000);
      previous = now;
      updateRotation(now);
      const leaving = liveTransition.current.exiting;
      const direction = leaving ? -1 : 1;
      transition = THREE.MathUtils.clamp(
        transition + (direction * dt) / 1.1,
        0,
        1,
      );
      const progress = transition * transition * (3 - 2 * transition);
      updateBodies(progress);
      controls.enabled = transition === 1 && !leaving;
      controls.update();
      renderer.render(scene, camera);
      labels.render(scene, camera);
      if (leaving && transition === 0 && !exitNotified) {
        exitNotified = true;
        queueMicrotask(() => liveTransition.current.onExitComplete());
      } else if (!leaving) {
        exitNotified = false;
      }
    };
    render();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      resetCamera.current = null;
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => {
            (material as THREE.MeshBasicMaterial).map?.dispose();
            material.dispose();
          });
        }
      });
      labels.domElement.remove();
      renderer.domElement.remove();
      renderer.dispose();
    };
  }, [light, locale, reduced]);

  useEffect(() => resetCamera.current?.(), [reset]);

  return (
    <div className="sky-host orrery-host" ref={mount}>
      {failure && <p className="scene-error">{tr(failure)}</p>}
      <div className="orrery-scale-note">
        <b>{tr('太陽中心')}</b>
        <span>
          {tr(
            '軌道線は指定日時の接触軌道・距離は対数圧縮・天体サイズと月までの距離は拡大表示',
          )}
        </span>
      </div>
    </div>
  );
}
