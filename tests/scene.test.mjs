import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
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

dom.window.close();
