import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from 'astronomy-engine';
import {frame,calculate,delta,DEG,DAY} from '../lib/engine.mjs';
import {lunarNodes,vertexOf,sensitivePoints,pointTrails,observerMatrix,topocentricDirection} from '../lib/observer.mjs';
function horizon(lon,lat,time,latitude,longitude){
 const t=A.MakeTime(new Date(time)),r=lon*DEG,p=lat*DEG,ect=new A.Vector(Math.cos(p)*Math.cos(r),Math.cos(p)*Math.sin(r),Math.sin(p),t);
 const eq=A.RotateVector(A.CombineRotation(A.Rotation_ECT_EQJ(t),A.Rotation_EQJ_EQD(t)),ect);
 return A.Horizon(t,new A.Observer(latitude,longitude,0),((Math.atan2(eq.y,eq.x)/DEG+360)%360)/15,Math.atan2(eq.z,Math.hypot(eq.x,eq.y))/DEG);
}
test('observer frame keeps ASC at altitude zero and zenith up in both hemispheres',()=>{
 for(const latitude of [-80,-33.8,0,35.68,80])for(const longitude of [-150,0,139.7]){
  const time=Date.UTC(2026,8,10,11),f=frame(time,latitude,longitude),m=observerMatrix(f);
  const y=m[3]*Math.cos(f.asc*DEG)-m[5]*Math.sin(f.asc*DEG);assert.ok(Math.abs(y)<1e-10);
  const z=f.zenith;assert.ok(Math.abs(m[3]*z[0]+m[4]*z[2]-m[5]*z[1]-1)<1e-10);
  const h=horizon(f.asc,0,time,latitude,longitude);assert.ok(Math.abs(h.altitude)<1e-6);assert.ok(h.azimuth<180);
 }
});
test('Vertex is the western ecliptic intersection with the prime vertical',()=>{
 for(const latitude of [-66,-33.8,0,35.68,66])for(const hour of [0,5,12,19]){
  const time=Date.UTC(2026,8,10,hour),f=frame(time,latitude,139.7),v=vertexOf(f);assert.ok(v!==null);
  const h=horizon(v,0,time,latitude,139.7);if(Math.abs(h.altitude)<89.999)assert.ok(Math.abs(delta(h.azimuth,270))<1e-6);
 }
 assert.equal(vertexOf({north:[0,0,1],east:[1,0,0]}),null,'undefined intersection is not fabricated');
});
test('true nodes agree with independent searches for lunar latitude crossings',()=>{
 let event=A.SearchMoonNode(new Date('2026-01-01T00:00:00Z'));
 for(let i=0;i<12;i++){
  const nodes=lunarNodes(event.time.date.getTime()),moon=A.EclipticGeoMoon(event.time),node=event.kind===A.NodeEventKind.Ascending?nodes.north:nodes.south;
  assert.ok(Math.abs(Math.abs(delta(nodes.north,nodes.south))-180)<1e-10);
  assert.ok(Math.abs(delta(node,moon.lon))<.01,'node follows the Moon crossing');
  assert.ok(Math.abs(moon.lat)<.001);
  for(const p of nodes.orbit)assert.ok(Math.abs(Math.hypot(...p)-1)<1e-10);
  event=A.NextMoonNode(event);
 }
});
test('ground display includes lunar parallax and matches Astronomy Engine topocentric coordinates',()=>{
 const time=Date.UTC(2026,8,10,12),latitude=35.68,longitude=139.7,c=calculate(time,latitude,longitude),moon=c.bodies.find(b=>b.id==='Moon');
 const actual=topocentricDirection(moon,c.observerVector),eq=A.Equator('Moon',new Date(time),new A.Observer(latitude,longitude,0),false,true),expected=A.Ecliptic(eq.vec);
 assert.ok(Math.abs(delta(actual.lon,expected.elon))<1e-7);assert.ok(Math.abs(actual.lat-expected.elat)<1e-7);
 assert.ok(Math.abs(delta(actual.lon,moon.lon))+Math.abs(actual.lat-moon.lat)>.1);
 const points=sensitivePoints(time,latitude,longitude);for(const p of points.points)assert.deepEqual(topocentricDirection(p,c.observerVector),{lon:p.lon,lat:0});
});
test('sensitive-point trails stay finite across wraparound and supported date boundaries',()=>{
 for(const time of [Date.UTC(1800,0,1),Date.UTC(2026,8,10),Date.UTC(2201,0,1)-1]){
 const p=sensitivePoints(time,35.68,139.7);assert.equal(p.points.length,3);assert.ok(p.points.every(p=>Number.isFinite(p.speed)&&p.distance===null));
 const trails=pointTrails(time,35.68,139.7);assert.equal(trails.length,3);assert.equal(trails[0].positions.length,73);assert.equal(trails[2].positions.length,97);
 for(const t of trails)for(const point of t.positions)if(point)assert.ok(point.every(Number.isFinite));
 }
});
