import test from 'node:test';
import assert from 'node:assert/strict';
import {apogeeFromState,trueLilith} from '../lib/lilith.mjs';
import {delta} from '../lib/engine.mjs';
import fixtures from './lilith-fixtures.json' with {type:'json'};

test('osculating apogee is opposite periapsis for an analytic inclined Kepler ellipse',()=>{
 const ecc=.2,tilt=.4;
 for(const anomaly of [0,.3,1.5,Math.PI,5]){
  const radius=(1-ecc*ecc)/(1+ecc*Math.cos(anomaly)),factor=1/Math.sqrt(1-ecc*ecc);
  const state={x:radius*Math.cos(anomaly),y:radius*Math.sin(anomaly)*Math.cos(tilt),z:radius*Math.sin(anomaly)*Math.sin(tilt),vx:-factor*Math.sin(anomaly),vy:factor*(ecc+Math.cos(anomaly))*Math.cos(tilt),vz:factor*(ecc+Math.cos(anomaly))*Math.sin(tilt)};
  const p=apogeeFromState(state,1);assert.ok(p);assert.ok(Math.abs(p.eccentricity-ecc)<1e-12);assert.ok(Math.hypot(p.direction[0]+1,p.direction[1],p.direction[2])<1e-12);
 }
 assert.equal(apogeeFromState({x:1,y:0,z:0,vx:0,vy:1,vz:0},1),null,'circular orbit has no defined apogee direction');
});

test('True Lilith agrees with 199 independent Swiss Ephemeris osculating-apogee samples within stated tolerances',()=>{
 assert.equal(fixtures.samples.length,199);let prograde=0,retrograde=0;
 for(const f of fixtures.samples){
  const p=trueLilith(f.time);assert.ok(p);assert.equal(p.kind,'point');assert.equal(p.distance,null);
  assert.ok(Math.abs(delta(p.lon,f.lon))<.2,'longitude '+new Date(f.time).toISOString());assert.ok(Math.abs(p.lat-f.lat)<.02,'latitude');assert.ok(Math.abs(p.speed-f.speed)<.06,'daily speed');
  if(p.speed>0)prograde++;else retrograde++;
 }
 assert.ok(prograde>0&&retrograde>0);
});
