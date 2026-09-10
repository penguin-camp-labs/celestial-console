import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sensitivePoints,pointTrails} from '../lib/observer.mjs';
import {Vector3} from 'three';
import {calculate} from '../lib/engine.mjs';
const dom=new JSDOM('<div id="root"></div>',{url:'https://celestial.test/',pretendToBeVisual:true});
for(const k of ['window','document','HTMLElement','HTMLCanvasElement','Element','Node','Event','MouseEvent','KeyboardEvent'])globalThis[k]=dom.window[k];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
let viewportWidth=1000,viewportHeight=660;
Object.defineProperty(HTMLElement.prototype,'clientWidth',{get:()=>viewportWidth});
Object.defineProperty(HTMLElement.prototype,'clientHeight',{get:()=>viewportHeight});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.ResizeObserver=class{constructor(cb){this.cb=cb;} observe(){this.cb();} disconnect(){}};
HTMLCanvasElement.prototype.getContext=function(type){if(type==='2d')return {clearRect(){},fillText(){},measureText(){return {width:20}}};return null;};
const {act,createElement}=await import('react');const {createRoot}=await import('react-dom/client');
const realThree=import.meta.resolve('three');
await mkdir('.test-build',{recursive:true});
await build({entryPoints:['app/sky.tsx'],outfile:'.test-build/sky.mjs',bundle:true,platform:'node',format:'esm',packages:'external',alias:{'@':resolve('.')},plugins:[{name:'renderer-test-double',setup(b){
b.onResolve({filter:/^three$/},()=>({path:'renderer',namespace:'test'}));
b.onResolve({filter:/^real-three$/},()=>({path:realThree,external:true}));
b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:`export * from 'real-three'; export class WebGLRenderer {constructor(){this.domElement=document.createElement('canvas');globalThis.__renderer=this;}setPixelRatio(){}setClearColor(){}setSize(){}setAnimationLoop(fn){globalThis.__animate=fn;}render(scene,camera){globalThis.__scene=scene;globalThis.__camera=camera;scene.updateMatrixWorld();camera.updateMatrixWorld();}dispose(){globalThis.__disposed=true;}}`,loader:'js',resolveDir:resolve('.')}));
}}]});
const {default:Sky}=await import(pathToFileURL(resolve('.test-build/sky.mjs')).href);
await test('actual Three scene updates planets, aspects and continuous 2D/3D transitions',async()=>{
 const root=createRoot(document.getElementById('root'));const chart=calculate(Date.UTC(2026,8,10));let picked=null;
 let props={chart,flat:false,aspects:true,grid:true,horizon:true,houses:true,houseSystem:'equal',selected:null,onSelect:id=>picked=id,reset:0,reduced:false,onFps(){},onFlat(){}};
 const render=async()=>act(async()=>root.render(createElement(Sky,props)));
 await render();let tick=0;const frames=async(count)=>act(async()=>{for(let i=0;i<count;i++)globalThis.__animate(tick+=1000/60);});
 await frames(90);
 const bodies=[];const edges=[];globalThis.__scene.traverse(o=>{if(o.userData.id)bodies.push(o);if(o.userData.aspect)edges.push(o);});
 assert.equal(bodies.length,10);assert.equal(edges.length,45);
 for(const b of bodies)assert.ok(Math.abs(b.position.length()-218)<.001);
 assert.equal(edges.filter(e=>e.material.opacity>.1).length,chart.aspects.length);
 const before=bodies.map(b=>b.position.clone());props={...props,flat:true};await render();await frames(1);
 assert.ok(bodies.every((b,i)=>b.position.distanceTo(before[i])<10),'transition starts continuously');
 await frames(130);for(const b of bodies){assert.ok(Math.abs(b.position.y)<.001);assert.ok(Math.abs(b.position.length()-191)<.001);}
 const world=globalThis.__scene.children[0];assert.ok(Math.abs(world.rotation.y-(180-chart.asc)*Math.PI/180)<1e-6);
 props={...props,selected:'Sun'};await render();await frames(2);assert.equal(bodies.find(b=>b.userData.id==='Sun').scale.x,1.5);
 props={...props,flat:false,aspects:false};await render();await frames(140);
 assert.equal(edges.filter(e=>e.visible).length,0);for(const b of bodies)assert.ok(Math.abs(b.position.length()-218)<.001);
 assert.ok(bodies.some(b=>Math.abs(b.position.y)>1),'latitude returns in 3D');
 props={...props,chart:calculate(Date.UTC(2040,0,1))};await render();await frames(180);
 for(const b of bodies)assert.ok(Number.isFinite(b.position.x+b.position.y+b.position.z));
 await act(async()=>root.unmount());assert.equal(globalThis.__animate,null);assert.equal(globalThis.__disposed,true);
});

await test('reduced-motion 2D switch reaches the overhead camera and returns to 3D',async()=>{
 const root=createRoot(document.getElementById('root'));let props={chart:calculate(Date.UTC(2026,8,10)),flat:false,aspects:true,grid:true,horizon:true,houses:false,houseSystem:'equal',selected:null,onSelect(){},reset:0,reduced:true,onFps(){},onFlat(){}};
 await act(async()=>root.render(createElement(Sky,props)));
 await act(async()=>globalThis.__animate(1000));
 const before=globalThis.__camera.position.clone();props={...props,flat:true};await act(async()=>root.render(createElement(Sky,props)));
 await act(async()=>globalThis.__animate(1020));
 assert.ok(Math.hypot(globalThis.__camera.position.x,globalThis.__camera.position.z)<.01,'2D camera must be overhead even without a tween');
 props={...props,flat:false};await act(async()=>root.render(createElement(Sky,props)));await act(async()=>globalThis.__animate(1040));
 assert.ok(globalThis.__camera.position.distanceTo(before)<.01,'3D camera is restored');
 await act(async()=>root.unmount());
});
await test('initial 2D view and narrow-screen projection keep the chart in frame',async()=>{
 viewportWidth=320;viewportHeight=500;
 const root=createRoot(document.getElementById('root'));
 await act(async()=>root.render(createElement(Sky,{chart:calculate(Date.UTC(2026,8,10)),flat:true,aspects:true,grid:true,horizon:true,houses:true,houseSystem:'equal',selected:'Sun',onSelect(){},reset:0,reduced:true,onFps(){},onFlat(){}})));
 await act(async()=>globalThis.__animate(1000));
 assert.ok(Math.hypot(globalThis.__camera.position.x,globalThis.__camera.position.z)<.01);
 assert.ok(Math.min(globalThis.__camera.right,globalThis.__camera.top)>=310,'chart labels must fit the narrower viewport dimension');
 await act(async()=>root.unmount());viewportWidth=1000;viewportHeight=660;
});


await test('additional bodies and compound lines appear and disappear without recreating the camera',async()=>{
 const root=createRoot(document.getElementById('root')),chart=calculate(Date.UTC(2026,8,10));let props={chart,flat:false,aspects:true,grid:true,horizon:true,houses:false,houseSystem:'equal',selected:null,onSelect(){},reset:0,reduced:true,onFps(){},onFlat(){}};
 const render=async()=>act(async()=>root.render(createElement(Sky,props)));
 await render();let tick=1000;const frames=async()=>act(async()=>{for(let i=0;i<100;i++)globalThis.__animate(tick+=17);});await frames();
 const camera=globalThis.__camera;
 const added={id:'Ceres',name:'セレス',symbol:'⚳',color:'#c7dda0',lon:45,lat:15,speed:0,distance:2};
 props={...props,chart:{...chart,bodies:[...chart.bodies,added],aspects:[],patternEdges:[{a:'Sun',b:'Ceres',color:'#f4d08a',pattern:true}]}};
 await render();await frames();let extra;const edges=[];globalThis.__scene.traverse(o=>{if(o.userData.id==='Ceres')extra=o;if(o.userData.aspect)edges.push(o);});
 assert.ok(extra.visible);assert.equal(globalThis.__camera,camera);assert.equal(edges.filter(e=>e.visible).length,1);
 props={...props,aspects:false};await render();await frames();assert.equal(edges.filter(e=>e.visible).length,0);
 props={...props,chart,aspects:true};await render();await frames();assert.equal(extra.visible,false);
 await act(async()=>root.unmount());
});

await test('observer frame projects the horizon horizontally and supports an actual inside-sphere camera',async()=>{
 const root=createRoot(document.getElementById('root')),time=Date.UTC(2026,8,10),base=calculate(time),points=sensitivePoints(time,35.6812,139.7671,base);
 const chart={...base,bodies:[...base.bodies,...points.points],moonOrbit:points.moonOrbit,pointTrails:pointTrails(time,35.6812,139.7671)};
 let props={chart,flat:false,observer:false,level:0,heading:90,headings:0,nodeOrbit:true,primeVertical:true,trails:true,aspects:true,grid:true,horizon:true,houses:false,houseSystem:'equal',selected:null,onSelect(){},reset:0,reduced:true,onFps(){},onFlat(){}};
 const render=async()=>act(async()=>root.render(createElement(Sky,props)));await render();
 let tick=1000;const advance=async()=>act(async()=>globalThis.__animate(tick+=20));await advance();
 let horizon,orbit,prime;const trails=[];globalThis.__scene.traverse(o=>{if(o.userData.horizon)horizon=o;if(o.userData.lunarOrbit)orbit=o;if(o.userData.primeVertical)prime=o;if(o.userData.trail)trails.push(o);});
 const checkHorizon=()=>{const positions=horizon.geometry.getAttribute('position');for(let i=0;i<positions.count;i++){const v=new Vector3().fromBufferAttribute(positions,i).applyMatrix4(horizon.matrixWorld);assert.ok(Math.abs(v.y)<1e-4,'world horizon height');v.project(globalThis.__camera);assert.ok(Math.abs(v.y)<1e-5,'horizontal line on screen');}};
 checkHorizon();assert.ok(orbit.visible&&prime.visible);assert.ok(trails.every(t=>t.visible));
 props={...props,observer:true,headings:1,heading:90};await render();await advance();
 assert.ok(globalThis.__camera.isPerspectiveCamera);assert.equal(globalThis.__camera.position.length(),0);
 const forward=new Vector3();globalThis.__camera.getWorldDirection(forward);assert.ok(forward.distanceTo(new Vector3(1,0,0))<1e-8,'east is the requested direction');assert.equal(globalThis.__renderer.clippingPlanes.length,0,'ground view shows below the horizon by default');
 const allBodies=[],lowerLabels=[];globalThis.__scene.traverse(o=>{if(o.userData.id)allBodies.push(o);if(o.isSprite&&o.visible&&o.getWorldPosition(new Vector3()).y<-.1)lowerLabels.push(o);});
 assert.equal(allBodies.filter(b=>b.visible).length,chart.bodies.length);assert.ok(allBodies.some(b=>b.getWorldPosition(new Vector3()).y<-.1));assert.ok(lowerLabels.length>0);
 const groundCamera=globalThis.__camera;
 props={...props,showBelowHorizon:false};await render();await advance();assert.equal(globalThis.__renderer.clippingPlanes.length,1);assert.ok(lowerLabels.every(o=>!o.visible));
 const visibleBodies=[];globalThis.__scene.traverse(o=>{if(o.userData.id&&o.visible)visibleBodies.push(o);});assert.ok(visibleBodies.length>0);for(const b of visibleBodies)assert.ok(b.getWorldPosition(new Vector3()).y>=-.01);
 props={...props,showBelowHorizon:true};await render();for(let i=0;i<60;i++)await advance();
 assert.equal(globalThis.__camera,groundCamera,'toggle preserves the camera');assert.equal(globalThis.__renderer.clippingPlanes.length,0);assert.ok(allBodies.every(b=>b.visible));assert.ok(lowerLabels.every(o=>o.visible),'labels return after unclipping');
 const aspectLines=[];globalThis.__scene.traverse(o=>{if(o.userData.aspect&&o.visible)aspectLines.push(o);});assert.equal(aspectLines.length,chart.aspects.length,'all aspect lines return');
 globalThis.__renderer.domElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));await advance();globalThis.__camera.getWorldDirection(forward);assert.ok(forward.y<0,'can look beneath the horizon');
 props={...props,headings:2,heading:270};await render();await advance();globalThis.__camera.getWorldDirection(forward);assert.ok(forward.distanceTo(new Vector3(-1,0,0))<1e-8,'west orientation');
 props={...props,observer:false,level:1,nodeOrbit:false,primeVertical:false,trails:false};await render();await advance();
 assert.ok(globalThis.__camera.isOrthographicCamera);checkHorizon();assert.equal(globalThis.__renderer.clippingPlanes.length,0);assert.ok(!orbit.visible&&!prime.visible&&trails.every(t=>!t.visible));
 globalThis.__camera.position.set(300,250,500);await advance();props={...props,flat:true};await render();await advance();props={...props,flat:false,level:2};await render();await advance();checkHorizon();
 await act(async()=>root.unmount());
});

await test('2D defaults to 12 house boundaries and playback moves between calculation ticks',async()=>{
 const root=createRoot(document.getElementById('root')),time=Date.UTC(2026,8,10),make=t=>({...calculate(t,35.68,139.7),time:t,latitude:35.68,longitude:139.7});
 const a=make(time),b=make(time+8640000);let props={chart:a,playing:true,smoothPlayback:true,flat:true,aspects:true,grid:true,horizon:true,houses:false,houseSystem:'equal',selected:null,onSelect(){},reset:0,reduced:false,onFps(){},onFlat(){}};
 const render=async()=>act(async()=>root.render(createElement(Sky,props))),advance=async t=>act(async()=>globalThis.__animate(t));
 await render();await advance(0);
 const houses=[],numbers=[];let moon;globalThis.__scene.traverse(o=>{if(o.userData.house)houses.push(o);if(o.userData.houseNumber)numbers.push(o);if(o.userData.id==='Moon')moon=o;});
 assert.equal(houses.length,12);assert.equal(numbers.length,12);assert.ok(houses.every(h=>h.visible));assert.ok(numbers.every(n=>n.visible));
 const first=new Vector3().fromBufferAttribute(houses[0].geometry.getAttribute('position'),1).applyMatrix4(houses[0].matrixWorld);assert.ok(first.x<0&&Math.abs(first.z)<1e-5,'equal house 1 starts at ASC on the left');
 props={...props,chart:b};await render();await advance(100);
 const positions=[];for(const t of [100,125,150,175,200]){await advance(t);positions.push(moon.position.clone());}
 const steps=positions.slice(1).map((p,i)=>p.distanceTo(positions[i]));assert.ok(steps.every(d=>d>.01),'body moves at every render step between chart updates');assert.ok(Math.max(...steps)/Math.min(...steps)<1.02,'linear interpolation removes stop/start pulses');
 props={...props,houses2d:false};await render();await advance(220);assert.ok(houses.every(h=>!h.visible)&&numbers.every(n=>!n.visible));
 props={...props,flat:false,playing:false};await render();await advance(240);assert.ok(houses.every(h=>!h.visible),'3D house setting stays separate');
 await act(async()=>root.unmount());
});
await test('real star field and live orbit preserve positions and restore the previous camera',async()=>{
 const root=createRoot(document.getElementById('root')),time=Date.UTC(2026,8,10),chart={...calculate(time),time};
 let props={chart,flat:true,focus:false,autoRotate:false,aspects:true,grid:true,horizon:true,houses:false,houseSystem:'equal',selected:null,onSelect(){},reset:0,reduced:false,onFps(){},onFlat(){}};
 const render=async()=>act(async()=>root.render(createElement(Sky,props)));await render();let tick=1000;
 const frames=async(n)=>act(async()=>{for(let i=0;i<n;i++)globalThis.__animate(tick+=1000/60);});await frames(2);
 const before=globalThis.__camera.position.clone();let stars;globalThis.__scene.traverse(o=>{if(o.userData.starField)stars=o;});assert.ok(stars);assert.equal(stars.visible,false);
 assert.equal(stars.children.reduce((n,o)=>n+o.geometry.getAttribute('position').count,0),22);
 const buffers=stars.children.map(o=>Array.from(o.geometry.getAttribute('position').array));
 props={...props,focus:true,autoRotate:true,flat:false};await render();await frames(2);assert.equal(stars.visible,true);
 const camera=globalThis.__camera,initial=camera.position.clone();await frames(120);assert.ok(camera.position.distanceTo(initial)>10,'slow continuous camera orbit');
 const visibleLabels=[];globalThis.__scene.traverse(o=>{if(o.isSprite&&o.visible)visibleLabels.push(o);});assert.equal(visibleLabels.length,0,'focus hides text labels');
 assert.deepEqual(stars.children.map(o=>Array.from(o.geometry.getAttribute('position').array)),buffers,'camera motion does not falsify star positions');
 props={...props,autoRotate:false};await render();await frames(180);const stopped=camera.position.clone();await frames(60);assert.ok(camera.position.distanceTo(stopped)<.001,'rotation can be stopped');
 props={...props,autoRotate:true,reduced:true};await render();await frames(60);assert.ok(camera.position.distanceTo(stopped)<.001,'reduced-motion preference suppresses automatic rotation');
 props={...props,focus:false,autoRotate:false,flat:true};await render();await frames(2);assert.ok(camera.position.distanceTo(before)<.001,'original 2D camera restored');assert.equal(stars.visible,false);
 props={...props,flat:false,observer:true,showBelowHorizon:false};await render();await frames(2);assert.equal(stars.visible,true,'real stars remain in ground view');assert.equal(globalThis.__renderer.clippingPlanes.length,1,'stars use the same horizon clipping');
 await act(async()=>root.unmount());
});

await test('themes preserve camera and chart geometry while solar daylight controls the background stars',async()=>{
 const root=createRoot(document.getElementById('root'));
 const day={...calculate(Date.parse('2026-03-20T12:00:00Z'),0,0),time:Date.parse('2026-03-20T12:00:00Z')};
 let props={chart:day,theme:'dark',flat:false,aspects:true,grid:true,horizon:true,houses:true,houseSystem:'equal',selected:'Sun',onSelect(){},reset:0,reduced:true,onFps(){},onFlat(){}};
 let tick=1000;const render=async()=>{await act(async()=>root.render(createElement(Sky,props)));await act(async()=>globalThis.__animate(tick+=20));};
 await render();const camera=globalThis.__camera,position=camera.position.clone();let stars,dome,sun;globalThis.__scene.traverse(o=>{if(o.userData.starField)stars=o;if(o.userData.skyDome)dome=o;if(o.userData.id==='Sun')sun=o;});
 const original=sun.position.clone();assert.equal(dome.visible,false);assert.equal(stars.children[0].material.opacity,.255);
 props={...props,theme:'light'};await render();assert.equal(globalThis.__camera,camera);assert.ok(camera.position.distanceTo(position)<.0001);assert.ok(sun.position.distanceTo(original)<.0001);assert.equal(dome.visible,false);assert.notEqual(sun.material.color.getHexString(),day.bodies[0].color.slice(1));
 props={...props,theme:'sky'};await render();assert.equal(dome.visible,true);assert.equal(stars.children[0].material.opacity,0);assert.ok(sun.visible,'markers remain available to read the horoscope');
 const night={...calculate(Date.parse('2026-03-20T00:00:00Z'),0,0),time:Date.parse('2026-03-20T00:00:00Z')};
 props={...props,chart:night};await render();assert.equal(stars.children[0].material.opacity,.255);
 props={...props,flat:true};await render();assert.equal(dome.visible,false);assert.equal(stars.visible,false);
 props={...props,flat:false,theme:'dark',chart:day};await render();assert.equal(dome.visible,false);assert.equal(sun.material.color.getHexString(),day.bodies[0].color.slice(1));
 await act(async()=>root.unmount());
});

dom.window.close();
