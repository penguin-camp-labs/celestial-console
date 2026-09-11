import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {frame,delta,wrap} from '../lib/engine.mjs';
import {houseCusps} from '../lib/houses.mjs';
const reference=JSON.parse(readFileSync(new URL('./house-reference.json',import.meta.url),'utf8'));
test('four house systems match 210 independent Swiss Ephemeris fixtures',()=>{
 for(const s of reference.samples){const actual=houseCusps({...frame(Date.parse(s.iso),s.latitude,s.longitude),latitude:s.latitude},s.system);
  assert.ok(actual.available,JSON.stringify(s));assert.equal(actual.cusps.length,12);assert.equal(actual.centres.length,12);
  actual.cusps.forEach((c,i)=>{assert.ok(c>=0&&c<360);assert.ok(Math.abs(delta(c,s.cusps[i]))<.002,`${s.iso} ${s.latitude} ${s.system} cusp ${i+1}`);assert.ok(Math.abs(Math.abs(delta(actual.cusps[(i+6)%12],c))-180)<1e-7);});
 }
});
test('Placidus reports polar failure without silently substituting another system',()=>{
 for(const latitude of [-89,-78,78,89])for(const month of [0,3,6,9]){
  const f={...frame(Date.UTC(2026,month,1),latitude,15),latitude},p=houseCusps(f,'placidus');assert.equal(p.available,false);assert.deepEqual(p.cusps,[]);assert.match(p.message,/プラシーダス/);assert.ok(houseCusps(f,'campanus').available);assert.ok(houseCusps(f,'equal').available);
 }
});
test('Placidus converges near the polar boundary and through all sidereal quadrants',()=>{
 for(const latitude of [-66.5,-50,0,50,66.5])for(let hour=0;hour<24;hour++){
  const f={...frame(Date.UTC(2026,8,10,hour),latitude,139.7),latitude},h=houseCusps(f,'placidus');assert.ok(h.available,`${latitude} ${hour}`);
  assert.ok(Math.abs(delta(h.cusps[0],f.asc))<1e-8);assert.ok(Math.abs(delta(h.cusps[9],f.mc))<1e-8);
  h.cusps.forEach((c,i)=>{const width=wrap(h.cusps[(i+1)%12]-c);assert.ok(width>0&&width<180);assert.ok(wrap(h.centres[i]-c)<width);});
 }
});

test('Koch, Regiomontanus and Porphyry match 154 independent reference charts',()=>{
 const refs=JSON.parse(readFileSync(new URL('./house-additions-reference.json',import.meta.url),'utf8'));
 for(const sample of refs.samples){const f={...frame(Date.parse(sample.iso),sample.latitude,sample.longitude),latitude:sample.latitude},h=houseCusps(f,sample.system);assert.ok(h.available);h.cusps.forEach((v,i)=>assert.ok(Math.abs(delta(v,sample.cusps[i]))<.002,JSON.stringify({...sample,cusp:i})));}
});
test('Koch rejects polar charts without fallback and converges near the polar circle',()=>{
 for(const latitude of [-89,-78,78,89]){const h=houseCusps({...frame(Date.UTC(2026,8,11),latitude,15),latitude},'koch');assert.equal(h.available,false);assert.deepEqual(h.cusps,[]);assert.match(h.message,/コッホ/);}
 for(const latitude of [-66.5,-35,0,35,66.5])for(let hour=0;hour<24;hour++){const f={...frame(Date.UTC(2026,8,11,hour),latitude,139.7),latitude},h=houseCusps(f,'koch');assert.ok(h.available);assert.ok(Math.abs(delta(h.cusps[0],f.asc))<1e-8);assert.ok(Math.abs(delta(h.cusps[9],f.mc))<1e-8);h.cusps.forEach((c,i)=>assert.ok(Math.abs(Math.abs(delta(h.cusps[(i+6)%12],c))-180)<1e-8));}
});
