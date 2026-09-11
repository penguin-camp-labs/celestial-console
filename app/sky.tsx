'use client';
import {t as tr} from './use-locale';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLYPHS,DEG,wrap} from '@/lib/engine.mjs';
import {houseCusps} from '@/lib/houses.mjs';
import {PlaybackInterpolator} from '@/lib/playback.mjs';
import {observerMatrix,topocentricDirection} from '@/lib/observer.mjs';
import {edgeKey} from '@/lib/aspects.mjs';
import {spherePoint,morphPoint} from '@/lib/geometry.mjs';
import {BRIGHT_STARS,starPositions} from '@/lib/stars.mjs';
import {themeAppearance,inkColor,aspectInkColor} from '@/lib/theme.mjs';
type Props={locale?:string;theme?:string;focus?:boolean;autoRotate?:boolean;playing?:boolean;smoothPlayback?:boolean;houses2d?:boolean;observer?:boolean;showBelowHorizon?:boolean;level?:number;heading?:number;headings?:number;nodeOrbit?:boolean;primeVertical?:boolean;trails?:boolean;chart:any;flat:boolean;aspects:boolean;grid:boolean;horizon:boolean;houses:boolean;houseSystem:string;selected:string|null;onSelect:(id:string|null)=>void;reset:number;reduced:boolean;onFps:(n:number)=>void;onFlat:()=>void;};
export default function Sky(props:Props){
 const mount=useRef<HTMLDivElement>(null),live=useRef(props);live.current=props;
 const [failure,setFailure]=useState('');
 useEffect(()=>{
  const host=mount.current;if(!host)return;
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch{setFailure('この環境では3D描画を開始できません。WebGLを有効にするか、対応するブラウザをお使いください。');return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setClearColor(0x060c12,0);
  renderer.domElement.setAttribute('aria-label',tr('天球。ドラッグで回転、ホイールで拡大。天体をクリックして選択。'));
  renderer.domElement.tabIndex=0;host.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),world=new THREE.Group();scene.add(world);
  const cam=new THREE.OrthographicCamera(-400,400,300,-300,.1,4000);cam.position.copy(live.current.flat?new THREE.Vector3(.001,750,0):new THREE.Vector3(0,0,760));cam.up.set(0,1,0);
  const controls=new OrbitControls(cam,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.enablePan=false;controls.minZoom=.65;controls.maxZoom=2.1;controls.minPolarAngle=.005;controls.maxPolarAngle=Math.PI-.005;
  const eye=new THREE.PerspectiveCamera(85,1,.1,4000);eye.position.set(0,0,0);eye.up.set(0,1,0);let activeCamera:THREE.Camera=cam,azimuth=90,altitude=0,lastHeading=live.current.headings??0,lastLevel=live.current.level??0;const horizonClip=new THREE.Plane(new THREE.Vector3(0,1,0),.01);
  if(live.current.flat)cam.up.set(0,0,-1);
  const disposable:(THREE.Material|THREE.BufferGeometry|THREE.Texture)[]=[];
  const materials:THREE.LineBasicMaterial[]=[];
  // Camera-relative illustration lighting; no shadow maps or post-processing.
  const ambient=new THREE.AmbientLight('#dce9ff',.65),keyLight=new THREE.DirectionalLight('#fff5e5',2.2),fillLight=new THREE.DirectionalLight('#83b9e5',.55);
  scene.add(ambient,keyLight,fillLight);
  function line(points:THREE.Vector3[],color:string,opacity=.4,parent:THREE.Object3D=world){
   const geo=new THREE.BufferGeometry().setFromPoints(points),mat=new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false});
   const obj=new THREE.Line(geo,mat);parent.add(obj);mat.userData.themeColor=color;disposable.push(geo,mat);materials.push(mat);return obj;
  }
  function v(lon:number,lat=0,r=218){return new THREE.Vector3(...spherePoint(lon,lat,r));}
  function circle(lat=0,r=218){return Array.from({length:181},(_,i)=>v(i*2,lat,r));}
  const sphere=new THREE.Group();world.add(sphere);
  for(let lat=-60;lat<=60;lat+=30)line(circle(lat),'#315562',.23,sphere);
  for(let lon=0;lon<180;lon+=30)line(Array.from({length:181},(_,i)=>v(lon,i*2)),'#315562',.23,sphere);
  line(circle(0,218),'#8ae7dc',.75);line(circle(0,256),'#487080',.45);line(circle(0,264),'#2f4d5d',.45);
  for(let i=0;i<360;i+=2)line([v(i,0,i%30===0?238:i%10===0?248:253),v(i,0,259)],'#7596a1',i%30===0?.7:.32);
  const redrawLabels:(()=>void)[]=[];let labelsDisposed=false;
  let labelLocale=live.current.locale;
  const refreshLabels=()=>{if(!labelsDisposed)redrawLabels.forEach(draw=>draw());};
  document.fonts?.load('400 44px "BIZ UDPGothic"','東西南北天頂').then(refreshLabels).catch(()=>{});
  function label(text:string,color:string,size=24,minPixels=0){
   const c=document.createElement('canvas');c.width=256;c.height=80;
   const ctx=c.getContext('2d')!;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=(minPixels?'400 44px':'40px')+(minPixels||/^[0-9]+$/.test(text)?' Consolas, "Courier New", "BIZ UDPGothic", monospace':' "Segoe UI Symbol", "BIZ UDPGothic", sans-serif');ctx.fillStyle='#ffffff';ctx.fillText(tr(text),128,40);
   const tex=new THREE.CanvasTexture(c),mat=new THREE.SpriteMaterial({map:tex,color,transparent:true,depthTest:false,depthWrite:false});
   redrawLabels.push(()=>{ctx.clearRect(0,0,c.width,c.height);ctx.fillText(text,128,40);tex.needsUpdate=true;});
   mat.userData.themeColor=color;const sprite=new THREE.Sprite(mat);sprite.userData.minPixels=minPixels;sprite.userData.labelSize=size;sprite.scale.set(size*3.2,size,1);world.add(sprite);disposable.push(tex,mat);return sprite;
  }
  GLYPHS.forEach((s:string,i:number)=>{const l=label(s,i%3===0?'#a5ded9':'#8daab7',22);l.position.copy(v(i*30+15,0,282));});
  const earthG=new THREE.SphereGeometry(9,32,24),earthM=new THREE.MeshPhongMaterial({color:'#8fe6e0',specular:'#080b0e',shininess:8,emissive:'#8fe6e0',emissiveIntensity:.025}),earth=new THREE.Mesh(earthG,earthM);earthM.userData.bodyMaterial=true;world.add(earth);disposable.push(earthG,earthM);
  const earthLabel=label('EARTH','#71989c',9);earthLabel.position.set(0,-23,0);
  function makeNode(b:any){
   const point=b.kind==='point',radius=point?5.5:b.id==='Sun'?7.2:b.id==='Moon'?6.2:5.5;
   const geo=point?new THREE.OctahedronGeometry(radius):new THREE.SphereGeometry(radius,28,18);
   const mat=new THREE.MeshPhongMaterial({color:b.color,specular:'#080b0e',shininess:8,flatShading:point,emissive:b.color,emissiveIntensity:b.id==='Sun'?.12:.025});
   mat.userData.bodyMaterial=true;
   const mesh=new THREE.Mesh(geo,mat);mesh.userData.id=b.id;mesh.userData.radius=radius;world.add(mesh);disposable.push(geo,mat);
   if(point){const outlineGeometry=new THREE.EdgesGeometry(geo),outlineMaterial=new THREE.LineBasicMaterial({color:b.color,transparent:true,opacity:.6});outlineMaterial.userData.themeColor=b.color;const outline=new THREE.LineSegments(outlineGeometry,outlineMaterial);outline.raycast=()=>{};mesh.add(outline);disposable.push(outlineGeometry,outlineMaterial);}
   mat.userData.themeColor=b.color;const l=label(b.symbol,b.color,23);
   const tether=line([v(0),v(0)],b.color,.2);
   return {mesh,label:l,tether,lon:0,lat:0,initialized:false};
  }
  const nodes=live.current.chart.bodies.map(makeNode) as ReturnType<typeof makeNode>[];
  const edges:{line:THREE.Line;mat:THREE.LineBasicMaterial;i:number;j:number}[]=[];
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const l=line([v(0),v(0)],'#78ddd1',0);l.userData.aspect=true;edges.push({line:l,mat:l.material as THREE.LineBasicMaterial,i,j});}
  const horizon=line(circle(),'#d9b177',.7);horizon.userData.horizon=true;
  const lunarPath=line(circle(),'#9ae0ce',.55);lunarPath.userData.lunarOrbit=true;
  const primePath=line(circle(),'#f4c184',.55);primePath.userData.primeVertical=true;
  const trailLines=['NorthNode','SouthNode','Vertex'].map((id,i)=>{const geo=new THREE.BufferGeometry().setFromPoints(Array.from({length:i===2?192:144},()=>new THREE.Vector3())),mat=new THREE.LineBasicMaterial({color:['#9ae0ce','#c7b5ed','#f4c184'][i],transparent:true,opacity:.55,depthWrite:false}),l=new THREE.LineSegments(geo,mat);mat.userData.themeColor=['#9ae0ce','#c7b5ed','#f4c184'][i];l.userData.trail=id;world.add(l);disposable.push(geo,mat);return l;});
  const directions=[label('東 E','#c0d4d8',24,26),label('西 W','#c0d4d8',24,26),label('北 N','#c0d4d8',24,26),label('南 S','#c0d4d8',24,26),label('天頂','#93b8c0',24,26)];
  const equator=line(circle(),'#90a6d8',.3);
  const houseLines=Array.from({length:12},(_,i)=>{const l=line([v(0,0,18),v(0,0,236)],i%3===0?'#b2d6db':'#809ca9',.35);l.userData.house=i+1;return l;});
  const houseLabels=Array.from({length:12},(_,i)=>{const l=label(String(i+1),'#a7c1cb',12);l.userData.houseNumber=i+1;return l;});
  const ascL=label('ASC','#f2c386',24,26),mcL=label('MC','#b6bceb',24,26);
  const navigationLabels=[...directions,ascL,mcL];
  const selectionGeo=new THREE.RingGeometry(8,9,32),selectionMat=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.9,side:THREE.DoubleSide,depthTest:false});
  const selection=new THREE.Mesh(selectionGeo,selectionMat);world.add(selection);disposable.push(selectionGeo,selectionMat);
  const starField=new THREE.Group();starField.userData.starField=true;world.add(starField);
  const starLayers=[{min:-10,max:.3,size:3.4,opacity:.95},{min:.3,max:1,size:2.6,opacity:.8},{min:1,max:2,size:2,opacity:.65}].map(layer=>{
   const entries=BRIGHT_STARS.map((s,i)=>({...s,index:i})).filter(s=>s.mag>=layer.min&&s.mag<layer.max);
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(entries.length*3),3));
   const mat=new THREE.PointsMaterial({color:'#d5e6f2',size:layer.size,transparent:true,opacity:layer.opacity,sizeAttenuation:false,depthWrite:false});
   const points=new THREE.Points(geo,mat);points.userData.starIds=entries.map(s=>s.hip);starField.add(points);disposable.push(geo,mat);return {points,entries,opacity:layer.opacity};
  });

  // A cheap sky dome: no textures, weather requests, ray marching or extra render pass.
  const skyGeometry=new THREE.SphereGeometry(1800,24,16);
  const skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,depthTest:false,toneMapped:false,
   uniforms:{zenith:{value:new THREE.Color()},horizon:{value:new THREE.Color()},ground:{value:new THREE.Color()},sunDirection:{value:new THREE.Vector3()},glow:{value:0},groundView:{value:0}},
   vertexShader:'varying vec3 worldPosition; void main(){vec4 w=modelMatrix*vec4(position,1.0);worldPosition=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
   fragmentShader:`uniform vec3 zenith,horizon,ground,sunDirection;uniform float glow,groundView;varying vec3 worldPosition;
    void main(){vec3 direction=normalize(worldPosition-cameraPosition);float height=groundView>0.5?direction.y:abs(direction.y);
     vec3 bearing=normalize(vec3(direction.x,0.0,direction.z)+vec3(0.00001,0.0,0.0));
     vec3 sunBearing=normalize(vec3(sunDirection.x,0.0,sunDirection.z)+vec3(0.00001,0.0,0.0));
     float towards=pow(max(0.0,dot(bearing,sunBearing)),4.0);
     float haze=pow(1.0-clamp(height,0.0,1.0),3.0);
     vec3 colour=mix(zenith,horizon,haze*mix(1.0,0.25+0.75*towards,glow));
     colour=mix(colour,ground,groundView*smoothstep(0.0,0.16,-height));gl_FragColor=vec4(colour,1.0);
     #include <colorspace_fragment>
    }`});
  const skyDome=new THREE.Mesh(skyGeometry,skyMaterial);skyDome.userData.skyDome=true;skyDome.renderOrder=-1000;skyDome.frustumCulled=false;scene.add(skyDome);disposable.push(skyGeometry,skyMaterial);

  scene.traverse(o=>{const material=(o as THREE.Mesh).material;if(material&&!Array.isArray(material)&&'color' in material&&!(material instanceof THREE.PointsMaterial)){if(!material.userData.themeColor)material.userData.themeColor='#'+(material as THREE.MeshBasicMaterial).color.getHexString();}});
  let lastTheme='',starMinute=NaN;

  const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();let downX=0,downY=0;const pointers=new Map<number,{x:number;y:number}>();let pinch=0;
  function down(e:PointerEvent){rotationPauseUntil=last+5000;downX=e.clientX;downY=e.clientY;if(live.current.observer&&!live.current.flat){pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});renderer.domElement.setPointerCapture?.(e.pointerId);if(pointers.size===2){const a=[...pointers.values()];pinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}}}
  function move(e:PointerEvent){const prev=pointers.get(e.pointerId);if(!prev)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const a=[...pointers.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(pinch>0&&d>0)eye.fov=THREE.MathUtils.clamp(eye.fov*pinch/d,35,110);pinch=d;eye.updateProjectionMatrix();}else{azimuth-=(e.clientX-prev.x)*.18;altitude=THREE.MathUtils.clamp(altitude+(e.clientY-prev.y)*.18,-89,89);}}
  function cancel(e:PointerEvent){pointers.delete(e.pointerId);pinch=0;}
  function wheel(e:WheelEvent){rotationPauseUntil=last+5000;if(!live.current.observer||live.current.flat)return;e.preventDefault();eye.fov=THREE.MathUtils.clamp(eye.fov+e.deltaY*.03,35,110);eye.updateProjectionMatrix();}
  function up(e:PointerEvent){rotationPauseUntil=last+5000;cancel(e);if(Math.hypot(e.clientX-downX,e.clientY-downY)>5)return;const rect=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(mouse,activeCamera);const hits=ray.intersectObjects(nodes.filter(n=>n.mesh.visible).map(n=>n.mesh));live.current.onSelect(hits[0]?.object.userData.id??null);}
  function key(e:KeyboardEvent){rotationPauseUntil=last+5000;if(e.key==='Escape'){live.current.onSelect(null);return;}if(live.current.observer&&!live.current.flat){if(e.key==='ArrowLeft')azimuth-=5;else if(e.key==='ArrowRight')azimuth+=5;else if(e.key==='ArrowUp')altitude=Math.min(89,altitude+5);else if(e.key==='ArrowDown')altitude=Math.max(-89,altitude-5);else if(e.key==='+'||e.key==='=')eye.fov=Math.max(35,eye.fov-5);else if(e.key==='-')eye.fov=Math.min(110,eye.fov+5);else return;e.preventDefault();eye.updateProjectionMatrix();return;}if(e.key==='+'||e.key==='=')cam.zoom=Math.min(2.1,cam.zoom*1.1);else if(e.key==='-')cam.zoom=Math.max(.65,cam.zoom/1.1);else if(e.key.startsWith('Arrow')&&!live.current.flat){const s=new THREE.Spherical().setFromVector3(cam.position);if(e.key==='ArrowLeft')s.theta-=.1;if(e.key==='ArrowRight')s.theta+=.1;if(e.key==='ArrowUp')s.phi=Math.max(.05,s.phi-.1);if(e.key==='ArrowDown')s.phi=Math.min(Math.PI-.05,s.phi+.1);cam.position.setFromSpherical(s);}else return;e.preventDefault();cam.updateProjectionMatrix();controls.update();}
  renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointercancel',cancel);renderer.domElement.addEventListener('wheel',wheel,{passive:false});renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('keydown',key);
  const resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(w<=0||h<=0)return;renderer.setSize(w,h);eye.aspect=w/h;eye.updateProjectionMatrix();const span=w<600?365:340,aspect=w/h;cam.left=-span*Math.max(1,aspect);cam.right=-cam.left;cam.top=span*Math.max(1,1/aspect);cam.bottom=-cam.top;cam.updateProjectionMatrix();});resize.observe(host);
  let morph=live.current.flat?1:0,last=0,fpsTime=0,frames=0,lastFlat=live.current.flat,reset=live.current.reset;
  let cameraStart=cam.position.clone(),cameraEnd=cam.position.clone(),savedCamera=new THREE.Vector3(0,0,760),transition=1;
  let upStart=cam.up.clone(),upEnd=cam.up.clone();
  let lastFocus=false,rotationPauseUntil=0;let beforeFocus:{position:THREE.Vector3;up:THREE.Vector3;target:THREE.Vector3;zoom:number;saved:THREE.Vector3}|null=null;

  function updateLine(l:THREE.Line,points:THREE.Vector3[]){const a=l.geometry.getAttribute('position') as THREE.BufferAttribute;points.forEach((p,i)=>a.setXYZ(i,p.x,p.y,p.z));a.needsUpdate=true;l.geometry.computeBoundingSphere();}
  let houseFrame:any=null,houseMode='',houseResult=houseCusps(live.current.chart,live.current.houseSystem);
  const playback=new PlaybackInterpolator();let wasPlaying=!!live.current.playing;
  function animate(now:number){
   if(document.hidden){last=now;return;}
   const dt=Math.min(.06,last?(now-last)/1000:1/60);last=now;const p=live.current,c=playback.sample(p.chart,now,!!p.playing&&p.smoothPlayback!==false&&!p.reduced);if(!c)return;const stopped=wasPlaying&&!p.playing;wasPlaying=!!p.playing;const theme=p.theme??'dark',appearance=themeAppearance(theme,c),bright=appearance.light;const ground=!!p.observer&&!p.flat,hideBelow=ground&&p.showBelowHorizon===false;world.traverse(o=>{if(o.userData.hiddenByGround){o.visible=true;o.userData.hiddenByGround=false;}});
   if(!!p.focus!==lastFocus){
    if(p.focus)beforeFocus={position:cam.position.clone(),up:cam.up.clone(),target:controls.target.clone(),zoom:cam.zoom,saved:savedCamera.clone()};
    controls.autoRotate=false;controls.enableDamping=false;controls.update();
    if(p.focus){cam.position.set(430,180,620);cam.up.set(0,1,0);cam.zoom=1;controls.target.set(0,0,0);rotationPauseUntil=0;}
    else if(beforeFocus){cam.position.copy(beforeFocus.position);cam.up.copy(beforeFocus.up);cam.zoom=beforeFocus.zoom;controls.target.copy(beforeFocus.target);savedCamera.copy(beforeFocus.saved);}
    lastFocus=!!p.focus;lastFlat=p.flat;morph=p.flat?1:0;transition=1;cam.updateProjectionMatrix();cam.lookAt(controls.target);if(!p.flat)controls.update();controls.enableDamping=true;
   }
   controls.autoRotate=!!p.focus&&!!p.autoRotate&&!p.reduced&&now>=rotationPauseUntil;controls.autoRotateSpeed=.25;
   if((p.headings??0)!==lastHeading){lastHeading=p.headings??0;azimuth=p.heading??90;altitude=0;}
   if((p.level??0)!==lastLevel){lastLevel=p.level??0;controls.enableDamping=false;controls.update();controls.enableDamping=true;lastFlat=p.flat;morph=0;savedCamera.set(0,0,760);cam.position.set(0,0,760);cam.up.set(0,1,0);controls.target.set(0,0,0);transition=1;azimuth=p.heading??90;altitude=0;controls.update();}
   for(const b of c.bodies)if(!nodes.some(n=>n.mesh.userData.id===b.id)){const j=nodes.length;nodes.push(makeNode(b));for(let i=0;i<j;i++){const l=line([v(0),v(0)],'#78ddd1',0);l.userData.aspect=true;edges.push({line:l,mat:l.material as THREE.LineBasicMaterial,i,j});}}
   if(p.reset!==reset){reset=p.reset;cam.zoom=1;cam.updateProjectionMatrix();if(p.flat){cam.position.set(.001,750,0);cam.up.set(0,0,-1);}else{cam.position.set(0,0,760);cam.up.set(0,1,0);azimuth=90;altitude=0;eye.fov=85;eye.updateProjectionMatrix();}controls.target.set(0,0,0);if(!p.flat)controls.update();else cam.lookAt(0,0,0);transition=1;}
   if(p.flat!==lastFlat){if(p.flat)savedCamera.copy(cam.position);upStart.copy(cam.up);upEnd.set(0,p.flat?0:1,p.flat?-1:0);cameraStart.copy(cam.position);cameraEnd.copy(p.flat?new THREE.Vector3(.001,750,0):savedCamera);lastFlat=p.flat;transition=0;}
   const moving=transition<1;
   transition=Math.min(1,transition+dt/(p.reduced?.01:1.1));const ease=transition*transition*(3-2*transition);
   if(moving){cam.up.lerpVectors(upStart,upEnd,ease).normalize();cam.position.lerpVectors(cameraStart,cameraEnd,ease);cam.lookAt(0,0,0);}else if(!p.flat&&!ground){cam.up.set(0,1,0);controls.update(dt);}else cam.lookAt(0,0,0);
   controls.enableRotate=!p.flat&&transition===1;controls.enabled=transition===1&&!p.flat&&!ground;
   const target=p.flat?1:0;morph=p.reduced||ground?target:THREE.MathUtils.damp(morph,target,6,dt);if(Math.abs(morph-target)<.001)morph=target;
   const rotation=(180-c.asc)*DEG,m=observerMatrix(c),matrix=new THREE.Matrix4().set(m[0],m[1],m[2],0,m[3],m[4],m[5],0,m[6],m[7],m[8],0,0,0,0,1);
   const q3=new THREE.Quaternion().setFromRotationMatrix(matrix),q2=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),rotation);world.quaternion.copy(q3).slerp(q2,morph);
   sphere.visible=p.grid&&morph<.995;sphere.traverse(o=>{if(o instanceof THREE.Line)(o.material as THREE.LineBasicMaterial).opacity=(bright?.14:.23)*(1-morph);});
   earth.visible=!ground&&morph<.99;earthLabel.visible=!ground&&morph<.5;earth.rotation.y+=dt*.08;
   const k=p.reduced?1:1-Math.exp(-dt*18);
   nodes.forEach(n=>{const b=c.bodies.find((b:any)=>b.id===n.mesh.userData.id);n.mesh.visible=!!b;n.label.visible=!!b;if(!b){n.tether.visible=false;n.initialized=false;return;}const direction=ground?topocentricDirection(b,c.observerVector):b;if(!n.initialized){n.lon=direction.lon;n.lat=direction.lat;n.initialized=true;}const smooth=p.playing||stopped||b.kind==='point'?1:k;n.lon=wrap(n.lon+(((direction.lon-n.lon+540)%360)-180)*smooth);n.lat+=(direction.lat-n.lat)*smooth;n.mesh.position.set(...morphPoint(n.lon,n.lat,morph));n.label.position.copy(v(n.lon,n.lat*(1-morph),239-morph*23));if(!ground)n.label.position.y+=9*(1-morph);n.label.material.opacity=p.selected&&p.selected!==b.id?.4:1;n.mesh.material.color.set(b.color);n.mesh.scale.setScalar(p.selected===b.id?1.5:1);updateLine(n.tether,[v(n.lon,0,218),n.mesh.position]);n.tether.visible=p.grid&&morph<.99&&!ground;if(hideBelow&&n.mesh.position.clone().applyQuaternion(world.quaternion).y<-.01){n.mesh.visible=false;n.label.visible=false;}});
   const active=new Map([...c.aspects,...(c.patternEdges??[])].map((a:any)=>[edgeKey(a.a,a.b),a]));
   edges.forEach(e=>{const a:any=active.get(edgeKey(nodes[e.i].mesh.userData.id,nodes[e.j].mesh.userData.id));const chosen=!p.selected||[nodes[e.i].mesh.userData.id,nodes[e.j].mesh.userData.id].includes(p.selected);const opacity=p.aspects&&a&&nodes[e.i].mesh.visible&&nodes[e.j].mesh.visible?(p.focus?(bright?.42:.26):(chosen?(bright?.92:.65):(bright?.10:.065))):0;e.mat.opacity=THREE.MathUtils.damp(e.mat.opacity,opacity,10,dt);if(a){e.mat.color.set(a.color);e.mat.userData.themeColor=a.color;}e.line.visible=e.mat.opacity>.005;updateLine(e.line,[nodes[e.i].mesh.position,nodes[e.j].mesh.position]);});
   const hor=Array.from({length:181},(_,i)=>{const a=i*2*DEG;return new THREE.Vector3((c.east[0]*Math.cos(a)+c.north[0]*Math.sin(a))*218,(c.east[2]*Math.cos(a)+c.north[2]*Math.sin(a))*218,-(c.east[1]*Math.cos(a)+c.north[1]*Math.sin(a))*218);});
   updateLine(horizon,hor);horizon.visible=p.horizon&&morph<.99;(horizon.material as THREE.LineBasicMaterial).opacity=(bright?.85:.5)*(1-morph);
   updateLine(equator,Array.from({length:181},(_,i)=>{const a=i*2*DEG;return new THREE.Vector3(218*Math.cos(a),-218*Math.sin(a)*Math.sin(c.eps*DEG),-218*Math.sin(a)*Math.cos(c.eps*DEG));}));equator.visible=p.grid&&morph<.99;(equator.material as THREE.LineBasicMaterial).opacity=(bright?.20:.3)*(1-morph);

   const planeVector=(a:number[],r=218)=>new THREE.Vector3(a[0]*r,a[2]*r,-a[1]*r);
   const pathVector=(a:number[],r=225)=>{const lon=wrap(Math.atan2(a[1],a[0])/DEG),lat=Math.atan2(a[2],Math.hypot(a[0],a[1]))/DEG;return v(lon,lat*(1-morph),r-27*morph);};
   lunarPath.visible=!!p.nodeOrbit&&!!c.moonOrbit;if(c.moonOrbit)updateLine(lunarPath,c.moonOrbit.map((a:number[])=>pathVector(a,225)));
   primePath.visible=!!p.primeVertical&&morph<.995;updateLine(primePath,Array.from({length:181},(_,i)=>{const a=i*2*DEG;return planeVector(c.east.map((x:number,j:number)=>x*Math.cos(a)+c.zenith[j]*Math.sin(a)),227);}));
   const compass=[c.east,c.east.map((x:number)=>-x),c.north,c.north.map((x:number)=>-x),c.zenith];
   directions.forEach((l,i)=>{l.position.copy(planeVector(compass[i],ground?210:290));l.visible=p.horizon&&morph<.995;});
   trailLines.forEach((l,i)=>{const trail=c.pointTrails?.find((t:any)=>t.id===l.userData.trail);l.visible=!!p.trails&&!!trail;if(!trail)return;const points:THREE.Vector3[]=[];for(let j=1;j<trail.positions.length;j++){const a=trail.positions[j-1],b=trail.positions[j];if(!a||!b||Math.abs(((b[0]-a[0]+540)%360)-180)>60){points.push(new THREE.Vector3(),new THREE.Vector3());continue;}points.push(v(a[0],0,231+i*3-27*morph),v(b[0],0,231+i*3-27*morph));}updateLine(l,points);});

   const showHouses=p.flat?(p.houses2d??true):p.houses;
   if(showHouses&&(c!==houseFrame||p.houseSystem!==houseMode)){houseFrame=c;houseMode=p.houseSystem;houseResult=houseCusps(c,p.houseSystem);}
   houseLines.forEach((l,i)=>{const visible=showHouses&&houseResult.available;l.visible=visible;houseLabels[i].visible=visible;if(!visible)return;const cusp=houseResult.cusps[i];updateLine(l,[v(cusp,0,30),v(cusp,0,236)]);(l.material as THREE.LineBasicMaterial).opacity=bright?.65+.2*morph:.25+.4*morph;houseLabels[i].position.copy(v(houseResult.centres[i],0,164));});
   ascL.position.copy(v(c.asc,0,310));mcL.position.copy(v(c.mc,0,310));ascL.visible=p.horizon||showHouses;mcL.visible=p.horizon||showHouses;
   const selected=nodes.find(n=>n.mesh.visible&&n.mesh.userData.id===p.selected);selection.visible=!!selected;if(selected){selection.position.copy(selected.mesh.position);selection.quaternion.copy(world.quaternion).invert().multiply((ground?eye:cam).quaternion);}
   const minute=Math.floor((Number.isFinite(c.time)?c.time:Date.now())/60000);
   if(minute!==starMinute){starMinute=minute;const positions=starPositions(minute*60000);starLayers.forEach(({points,entries})=>{const attr=points.geometry.getAttribute('position') as THREE.BufferAttribute;entries.forEach((s,i)=>{const v=positions[s.index];attr.setXYZ(i,v[0]*325,v[1]*325,v[2]*325);});attr.needsUpdate=true;points.geometry.computeBoundingSphere();});}
   if(p.focus)world.traverse(o=>{if(o instanceof THREE.Sprite&&o.visible){o.visible=false;o.userData.hiddenByGround=true;}});
   activeCamera=ground?eye:cam;if(ground){const a=azimuth*DEG,h=altitude*DEG;eye.lookAt(Math.sin(a)*Math.cos(h),Math.sin(h),-Math.cos(a)*Math.cos(h));if(hideBelow)world.traverse(o=>{if(o instanceof THREE.Sprite&&o.visible&&o.position.clone().applyQuaternion(world.quaternion).y<-.01){o.visible=false;o.userData.hiddenByGround=true;}});}starField.visible=morph<.995;
   const themeKey=theme+':'+bright;
   if(lastTheme!==themeKey){lastTheme=themeKey;if(host?.parentElement)host.parentElement.dataset.skyScheme=bright?'light':'dark';}
   skyDome.visible=theme==='sky'&&morph<.995;skyDome.position.copy(activeCamera.position);
   skyMaterial.uniforms.zenith.value.set(appearance.zenith);skyMaterial.uniforms.horizon.value.set(appearance.horizon);skyMaterial.uniforms.ground.value.set(appearance.ground);skyMaterial.uniforms.sunDirection.value.fromArray(appearance.direction);skyMaterial.uniforms.glow.value=appearance.glow;skyMaterial.uniforms.groundView.value=ground?1:0;
   // Update colour, never recreate geometry/camera when switching themes.
   world.traverse(o=>{const mat=(o as THREE.Mesh).material as THREE.MeshBasicMaterial|undefined;if(mat?.userData.themeColor){mat.color.set(mat.userData.bodyMaterial?mat.userData.themeColor:o.userData.aspect?aspectInkColor(mat.userData.themeColor,bright):inkColor(mat.userData.themeColor,bright));}});
   keyLight.position.set(-350,450,650).applyQuaternion(activeCamera.quaternion);fillLight.position.set(400,-100,-250).applyQuaternion(activeCamera.quaternion);
   const viewHeight=Math.max(1,host?.clientHeight??660),cameraInverse=activeCamera.matrixWorldInverse;
   activeCamera.updateMatrixWorld();
   const unitsPerPixel=(position:THREE.Vector3)=>ground?2*Math.max(1,-position.clone().applyQuaternion(world.quaternion).applyMatrix4(cameraInverse).z)*Math.tan(eye.fov*DEG/2)/viewHeight:(cam.top-cam.bottom)/(viewHeight*cam.zoom);
   if(labelLocale!==p.locale){labelLocale=p.locale;refreshLabels();renderer.domElement.setAttribute('aria-label',tr('天球。ドラッグで回転、ホイールで拡大。天体をクリックして選択。'));}
   navigationLabels.forEach(l=>{const unit=unitsPerPixel(l.position),height=Math.min(32,Math.max(l.userData.minPixels,l.userData.labelSize/unit))*unit;l.scale.set(height*3.2,height,1);});
   nodes.forEach(n=>{const unit=unitsPerPixel(n.mesh.position),size=Math.max(1,Math.min(1.8,8*unit/(2*n.mesh.userData.radius)));n.mesh.scale.setScalar(size*(p.selected===n.mesh.userData.id?1.5:1));});
   starLayers.forEach(({points})=>{(points.material as THREE.PointsMaterial).opacity=.3*(p.focus?1:.85)*(1-morph)*(theme==='sky'?appearance.stars:1);(points.material as THREE.PointsMaterial).color.set(theme==='light'?'#385568':'#d5e6f2');});renderer.clippingPlanes=hideBelow?[horizonClip]:[];renderer.render(scene,activeCamera);frames++;if(now-fpsTime>1000){p.onFps(Math.round(frames*1000/(now-fpsTime)));frames=0;fpsTime=now;}
  }
  renderer.setAnimationLoop(animate);
  const lost=(e:Event)=>{e.preventDefault();renderer.setAnimationLoop(null);setFailure('描画への接続が失われました。ページを再読み込みしてください。');};renderer.domElement.addEventListener('webglcontextlost',lost);
  return()=>{labelsDisposed=true;redrawLabels.length=0;renderer.setAnimationLoop(null);resize.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointermove',move);renderer.domElement.removeEventListener('pointercancel',cancel);renderer.domElement.removeEventListener('wheel',wheel);renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointerup',up);renderer.domElement.removeEventListener('keydown',key);renderer.domElement.removeEventListener('webglcontextlost',lost);disposable.forEach(d=>d.dispose());renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <div className="sky-host" ref={mount}>{tr(failure&&<div className="render-error" role="alert"><p>{tr(failure)}</p><p>{tr("天体位置とアスペクトは右の一覧でも確認できます。")}</p></div>)}</div>;
}

