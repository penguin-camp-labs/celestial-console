'use client';
import { t as tr } from './use-locale';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  CSS2DObject,
  CSS2DRenderer,
} from 'three/addons/renderers/CSS2DRenderer.js';

type OrreryBody = {
  id: string;
  name: string;
  symbol: string;
  color: string;
  orbit: number;
  size: number;
  distance: number;
  x: number;
  y: number;
  z: number;
};

type Props = {
  bodies: OrreryBody[];
  light: boolean;
  locale: string;
  reset: number;
  reduced: boolean;
};

const compressedDistance = (au: number) => 28 + Math.log1p(au * 2.4) * 82;

function orbitGeometry(radius: number) {
  const points = Array.from({ length: 129 }, (_, index) => {
    const angle = (index / 128) * Math.PI * 2;
    return new THREE.Vector3(
      Math.cos(angle) * radius,
      0,
      Math.sin(angle) * radius,
    );
  });
  return new THREE.BufferGeometry().setFromPoints(points);
}

export default function Orrery({
  bodies,
  light,
  locale,
  reset,
  reduced,
}: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const liveBodies = useRef(bodies);
  liveBodies.current = bodies;
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

    world.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(12, 32, 20),
        new THREE.MeshStandardMaterial({
          color: 0xffc86b,
          emissive: 0xff9e3d,
          emissiveIntensity: light ? 0.75 : 1.3,
          roughness: 0.72,
        }),
      ),
    );

    const ecliptic = new THREE.Mesh(
      new THREE.CircleGeometry(compressedDistance(39.482) + 28, 96),
      new THREE.MeshBasicMaterial({
        color: light ? 0x8da3ad : 0x244652,
        transparent: true,
        opacity: light ? 0.05 : 0.08,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ecliptic.rotation.x = -Math.PI / 2;
    world.add(ecliptic);

    const markerById = new Map<string, THREE.Group>();
    for (const body of liveBodies.current) {
      world.add(
        new THREE.Line(
          orbitGeometry(compressedDistance(body.orbit)),
          new THREE.LineBasicMaterial({
            color: light ? 0x607984 : 0x41616d,
            transparent: true,
            opacity: light ? 0.34 : 0.42,
          }),
        ),
      );
      const group = new THREE.Group();
      group.add(
        new THREE.Mesh(
          new THREE.SphereGeometry(body.size, 24, 16),
          new THREE.MeshStandardMaterial({
            color: body.color,
            roughness: 0.82,
            metalness: 0.02,
          }),
        ),
      );
      if (body.id === 'Saturn') {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(body.size * 1.35, body.size * 2.05, 40),
          new THREE.MeshBasicMaterial({
            color: body.color,
            transparent: true,
            opacity: 0.62,
            side: THREE.DoubleSide,
          }),
        );
        ring.rotation.x = Math.PI / 2.35;
        group.add(ring);
      }
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

    const updateBodies = () => {
      for (const body of liveBodies.current) {
        const marker = markerById.get(body.id);
        if (!marker) continue;
        const scale = compressedDistance(body.distance) / body.distance;
        marker.position.set(body.x * scale, body.y * scale, body.z * scale);
        const label = marker.children.find(
          (child) => child instanceof CSS2DObject,
        );
        if (label instanceof CSS2DObject) {
          label.element.title = `${body.distance.toFixed(3)} AU`;
        }
      }
    };
    updateBodies();

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
    const render = () => {
      frame = requestAnimationFrame(render);
      updateBodies();
      controls.update();
      renderer.render(scene, camera);
      labels.render(scene, camera);
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
          materials.forEach((material) => material.dispose());
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
        <span>{tr('距離は対数圧縮・天体サイズは模式表示')}</span>
      </div>
    </div>
  );
}
