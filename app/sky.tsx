'use client';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {BODIES,GLYPHS,DEG,wrap} from '@/lib/engine.mjs';
import {spherePoint,morphPoint} from '@/lib/geometry.mjs';
type Props={chart:any;flat:boolean;aspects:boolean;grid:boolean;horizon:boolean;houses:boolean;houseSystem:string;selected:string|null;onSelect:(id:string|null)=>void;reset:number;reduced:boolean;onFps:(n:number)=>void;onFlat:()=>void;};
export default function Sky(props:Props){
 const mount=useRef<HTMLDivElement>(null),live=useRef(props);live.current=props;
 const [failure,setFailure]=useState('');
 useEffect(()=>{
  const host=mount.current;if(!host)return;
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch{setFailure('この環境では3D描画を開始できません。WebGLを有効にするか、対応するブラウザをお使いください。');return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setClearColor(0x060c12,0);
  renderer.domElement.setAttribute('aria-label','天球。ドラッグで回転、ホイールで拡大。天体をクリックして選択。');
  renderer.domElement.tabIndex=0;host.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),world=new THREE.Group();scene.add(world);
  const cam=new THREE.OrthographicCamera(-400,400,300,-300,.1,4000);cam.position.copy(live.current.flat?new THREE.Vector3(.001,750,0):new THREE.Vector3(430,300,470));cam.up.set(0,0,-1);
  const controls=new OrbitControls(cam,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.enablePan=false;controls.minZoom=.65;controls.maxZoom=2.1;controls.minPolarAngle=.005;controls.maxPolarAngle=Math.PI-.005;
  const disposable:(THREE.Material|THREE.BufferGeometry|THREE.Texture)[]=[];
  const materials:THREE.LineBasicMaterial[]=[];
  function line(points:THREE.Vector3[],color:string,opacity=.4,parent:THREE.Object3D=world){
   const geo=new THREE.BufferGeometry().setFromPoints(points),mat=new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false});
   const obj=new THREE.Line(geo,mat);parent.add(obj);disposable.push(geo,mat);materials.push(mat);return obj;
  }
  function v(lon:number,lat=0,r=218){return new THREE.Vector3(...spherePoint(lon,lat,r));}
  function circle(lat=0,r=218){return Array.from({length:181},(_,i)=>v(i*2,lat,r));}
  const sphere=new THREE.Group();world.add(sphere);
  for(let lat=-60;lat<=60;lat+=30)line(circle(lat),'#315562',.23,sphere);
  for(let lon=0;lon<180;lon+=30)line(Array.from({length:181},(_,i)=>v(lon,i*2)),'#315562',.23,sphere);
  line(circle(0,218),'#8ae7dc',.75);line(circle(0,256),'#487080',.45);line(circle(0,264),'#2f4d5d',.45);
  for(let i=0;i<360;i+=2)line([v(i,0,i%30===0?238:i%10===0?248:253),v(i,0,259)],'#7596a1',i%30===0?.7:.32);
  function label(text:string,color:string,size=24){
   const c=document.createElement('canvas');c.width=256;c.height=80;
   const ctx=c.getContext('2d')!;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='40px "Segoe UI Symbol", "Yu Gothic UI", sans-serif';ctx.fillStyle=color;ctx.fillText(text,128,40);
   const tex=new THREE.CanvasTexture(c),mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false});
   const sprite=new THREE.Sprite(mat);sprite.scale.set(size*3.2,size,1);world.add(sprite);disposable.push(tex,mat);return sprite;
  }
  GLYPHS.forEach((s:string,i:number)=>{const l=label(s,i%3===0?'#a5ded9':'#8daab7',22);l.position.copy(v(i*30+15,0,282));});
  const earthG=new THREE.SphereGeometry(9,24,16),earthM=new THREE.MeshBasicMaterial({color:'#8fe6e0',wireframe:true,transparent:true,opacity:.75}),earth=new THREE.Mesh(earthG,earthM);world.add(earth);disposable.push(earthG,earthM);
  const earthLabel=label('EARTH','#71989c',9);earthLabel.position.set(0,-23,0);
  const nodes=BODIES.map((b:any)=>{
   const geo=new THREE.SphereGeometry(b.id==='Sun'?5.7:b.id==='Moon'?4.8:4,16,12),mat=new THREE.MeshBasicMaterial({color:b.color}),mesh=new THREE.Mesh(geo,mat);mesh.userData.id=b.id;world.add(mesh);disposable.push(geo,mat);
   const l=label(b.symbol,b.color,23);
   const tether=line([v(0),v(0)],b.color,.2);
   return {mesh,label:l,tether,lon:0,lat:0,initialized:false};
  });
  const edges:{line:THREE.Line;mat:THREE.LineBasicMaterial;i:number;j:number}[]=[];
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const l=line([v(0),v(0)],'#78ddd1',0);l.userData.aspect=true;edges.push({line:l,mat:l.material as THREE.LineBasicMaterial,i,j});}
  const horizon=line(circle(),'#d9b177',.5);
  const equator=line(circle(),'#90a6d8',.3);
  const houseLines=Array.from({length:12},()=>line([v(0,0,18),v(0,0,236)],'#8195a3',.35));
  const houseLabels=Array.from({length:12},(_,i)=>label(String(i+1),'#7c96a6',11));
  const ascL=label('ASC','#f2c386',12),mcL=label('MC','#b6bceb',12);
  const selectionGeo=new THREE.RingGeometry(8,9,32),selectionMat=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.9,side:THREE.DoubleSide,depthTest:false});
  const selection=new THREE.Mesh(selectionGeo,selectionMat);world.add(selection);disposable.push(selectionGeo,selectionMat);
  const starGeo=new THREE.BufferGeometry();const stars:number[]=[];let seed=137;
  const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  for(let i=0;i<380;i++){const az=rand()*Math.PI*2,z=rand()*2-1,r=900;stars.push(r*Math.sqrt(1-z*z)*Math.cos(az),r*z,r*Math.sqrt(1-z*z)*Math.sin(az));}
  starGeo.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));const starMat=new THREE.PointsMaterial({color:'#8ca5b8',size:1.2,transparent:true,opacity:.45,sizeAttenuation:false});scene.add(new THREE.Points(starGeo,starMat));disposable.push(starGeo,starMat);
  const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();let downX=0,downY=0;
  function down(e:PointerEvent){downX=e.clientX;downY=e.clientY;}
  function up(e:PointerEvent){if(Math.hypot(e.clientX-downX,e.clientY-downY)>5)return;const rect=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(mouse,cam);const hits=ray.intersectObjects(nodes.map(n=>n.mesh));live.current.onSelect(hits[0]?.object.userData.id??null);}
  function key(e:KeyboardEvent){if(e.key==='Escape'){live.current.onSelect(null);return;}if(e.key==='+'||e.key==='=')cam.zoom=Math.min(2.1,cam.zoom*1.1);else if(e.key==='-')cam.zoom=Math.max(.65,cam.zoom/1.1);else if(e.key.startsWith('Arrow')&&!live.current.flat){const s=new THREE.Spherical().setFromVector3(cam.position);if(e.key==='ArrowLeft')s.theta-=.1;if(e.key==='ArrowRight')s.theta+=.1;if(e.key==='ArrowUp')s.phi=Math.max(.05,s.phi-.1);if(e.key==='ArrowDown')s.phi=Math.min(Math.PI-.05,s.phi+.1);cam.position.setFromSpherical(s);}else return;e.preventDefault();cam.updateProjectionMatrix();controls.update();}
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('keydown',key);
  const resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(w<=0||h<=0)return;renderer.setSize(w,h);const span=w<600?365:340,aspect=w/h;cam.left=-span*Math.max(1,aspect);cam.right=-cam.left;cam.top=span*Math.max(1,1/aspect);cam.bottom=-cam.top;cam.updateProjectionMatrix();});resize.observe(host);
  let morph=live.current.flat?1:0,last=0,fpsTime=0,frames=0,lastFlat=live.current.flat,reset=live.current.reset;
  let cameraStart=cam.position.clone(),cameraEnd=cam.position.clone(),savedCamera=new THREE.Vector3(430,300,470),transition=1;

  function updateLine(l:THREE.Line,points:THREE.Vector3[]){const a=l.geometry.getAttribute('position') as THREE.BufferAttribute;points.forEach((p,i)=>a.setXYZ(i,p.x,p.y,p.z));a.needsUpdate=true;l.geometry.computeBoundingSphere();}
  function animate(now:number){
   if(document.hidden){last=now;return;}
   const dt=Math.min(.06,last?(now-last)/1000:1/60);last=now;const p=live.current,c=p.chart;if(!c)return;
   if(p.reset!==reset){reset=p.reset;cam.zoom=1;cam.updateProjectionMatrix();if(p.flat){cam.position.set(.001,750,0);}else{cam.position.set(430,300,470);}controls.target.set(0,0,0);controls.update();transition=1;}
   if(p.flat!==lastFlat){if(p.flat)savedCamera.copy(cam.position);cameraStart.copy(cam.position);cameraEnd.copy(p.flat?new THREE.Vector3(.001,750,0):savedCamera);lastFlat=p.flat;transition=0;}
   const moving=transition<1;
   transition=Math.min(1,transition+dt/(p.reduced?.01:1.1));const ease=transition*transition*(3-2*transition);
   if(moving){cam.position.lerpVectors(cameraStart,cameraEnd,ease);cam.lookAt(0,0,0);}else controls.update();
   controls.enableRotate=!p.flat&&transition===1;controls.enabled=transition===1;
   const target=p.flat?1:0;morph=p.reduced?target:THREE.MathUtils.damp(morph,target,6,dt);if(Math.abs(morph-target)<.001)morph=target;
   const rotation=(180-c.asc)*DEG;world.rotation.y=rotation*morph;
   sphere.visible=p.grid&&morph<.995;sphere.traverse(o=>{if(o instanceof THREE.Line)(o.material as THREE.LineBasicMaterial).opacity=.23*(1-morph);});
   earth.visible=morph<.99;earthLabel.visible=morph<.5;earth.rotation.y+=dt*.08;
   const k=p.reduced?1:1-Math.exp(-dt*18);
   nodes.forEach((n,i)=>{const b=c.bodies[i];if(!n.initialized){n.lon=b.lon;n.lat=b.lat;n.initialized=true;}n.lon=wrap(n.lon+(((b.lon-n.lon+540)%360)-180)*k);n.lat+=(b.lat-n.lat)*k;n.mesh.position.set(...morphPoint(n.lon,n.lat,morph));n.label.position.copy(v(n.lon,n.lat*(1-morph),239-morph*23));n.label.position.y+=9*(1-morph);n.label.material.opacity=p.selected&&p.selected!==b.id?.4:1;(n.mesh.material as THREE.MeshBasicMaterial).color.set(b.color);n.mesh.scale.setScalar(p.selected===b.id?1.5:1);updateLine(n.tether,[v(n.lon,0,218),n.mesh.position]);n.tether.visible=p.grid&&morph<.99;});
   const active=new Map(c.aspects.map((a:any)=>[a.a+':'+a.b,a]));
   edges.forEach(e=>{const a:any=active.get(BODIES[e.i].id+':'+BODIES[e.j].id);const chosen=!p.selected||[BODIES[e.i].id,BODIES[e.j].id].includes(p.selected);const opacity=p.aspects&&a?(chosen?.65:.065):0;e.mat.opacity=THREE.MathUtils.damp(e.mat.opacity,opacity,10,dt);if(a)e.mat.color.set(a.color);e.line.visible=e.mat.opacity>.005;updateLine(e.line,[nodes[e.i].mesh.position,nodes[e.j].mesh.position]);});
   const hor=Array.from({length:181},(_,i)=>{const a=i*2*DEG;return new THREE.Vector3((c.east[0]*Math.cos(a)+c.north[0]*Math.sin(a))*218,(c.east[2]*Math.cos(a)+c.north[2]*Math.sin(a))*218,-(c.east[1]*Math.cos(a)+c.north[1]*Math.sin(a))*218);});
   updateLine(horizon,hor);horizon.visible=p.horizon&&morph<.99;(horizon.material as THREE.LineBasicMaterial).opacity=.5*(1-morph);
   updateLine(equator,Array.from({length:181},(_,i)=>{const a=i*2*DEG;return new THREE.Vector3(218*Math.cos(a),-218*Math.sin(a)*Math.sin(c.eps*DEG),-218*Math.sin(a)*Math.cos(c.eps*DEG));}));equator.visible=p.grid&&morph<.99;(equator.material as THREE.LineBasicMaterial).opacity=.3*(1-morph);
   const start=p.houseSystem==='whole'?Math.floor(c.asc/30)*30:c.asc;
   houseLines.forEach((l,i)=>{updateLine(l,[v(start+i*30,0,30),v(start+i*30,0,236)]);l.visible=p.houses;(l.material as THREE.LineBasicMaterial).opacity=.2+.15*morph;houseLabels[i].position.copy(v(start+i*30+15,0,164));houseLabels[i].visible=p.houses;});
   ascL.position.copy(v(c.asc,0,310));mcL.position.copy(v(c.mc,0,310));ascL.visible=p.horizon||p.houses;mcL.visible=p.horizon||p.houses;
   const selected=nodes.find((_,i)=>BODIES[i].id===p.selected);selection.visible=!!selected;if(selected){selection.position.copy(selected.mesh.position);selection.quaternion.copy(cam.quaternion);selection.rotateY(-world.rotation.y);}
   starMat.opacity=.4*(1-morph*.7);
   renderer.render(scene,cam);frames++;if(now-fpsTime>1000){p.onFps(Math.round(frames*1000/(now-fpsTime)));frames=0;fpsTime=now;}
  }
  renderer.setAnimationLoop(animate);
  const lost=(e:Event)=>{e.preventDefault();renderer.setAnimationLoop(null);setFailure('描画への接続が失われました。ページを再読み込みしてください。');};renderer.domElement.addEventListener('webglcontextlost',lost);
  return()=>{renderer.setAnimationLoop(null);resize.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointerup',up);renderer.domElement.removeEventListener('keydown',key);renderer.domElement.removeEventListener('webglcontextlost',lost);disposable.forEach(d=>d.dispose());renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <div className="sky-host" ref={mount}>{failure&&<div className="render-error" role="alert"><p>{failure}</p><p>天体位置とアスペクトは右の一覧でも確認できます。</p></div>}</div>;
}

