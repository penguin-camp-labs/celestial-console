import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from 'astronomy-engine';
import {BRIGHT_STARS,starDirection,starPositions} from '../lib/stars.mjs';
import {frame,DEG} from '../lib/engine.mjs';

test('bright star catalogue has 22 measured positions and propagates proper motion from J1991.25',()=>{
 assert.equal(BRIGHT_STARS.length,22);assert.equal(new Set(BRIGHT_STARS.map(s=>s.hip)).size,22);
 assert.ok(BRIGHT_STARS.every(s=>s.ra>=0&&s.ra<360&&Math.abs(s.dec)<=90&&s.mag<=1.5));
 assert.equal(BRIGHT_STARS.find(s=>s.hip===32349).ra,101.28854105,'Sirius catalogue coordinate');
 const epoch=A.AstroTime.FromTerrestrialTime((1991.25-2000)*365.25),time=epoch.date.getTime();
 for(const star of BRIGHT_STARS){
  const p=starDirection(star,time),v=A.RotateVector(A.Rotation_ECT_EQJ(epoch),new A.Vector(p[0],-p[2],p[1],epoch));
  const expected=[Math.cos(star.dec*DEG)*Math.cos(star.ra*DEG),Math.cos(star.dec*DEG)*Math.sin(star.ra*DEG),Math.sin(star.dec*DEG)];
  assert.ok(Math.hypot(v.x-expected[0],v.y-expected[1],v.z-expected[2])<1e-8,'catalogue epoch round trip');
 }
 for(const time of [Date.UTC(1800,0,1),Date.UTC(2026,8,10),Date.UTC(2200,11,31)])for(const p of starPositions(time))assert.ok(Math.abs(Math.hypot(...p)-1)<1e-12);
 const star=BRIGHT_STARS.find(s=>s.hip===32349),t=A.MakeTime(new Date('2091-04-02T00:00:00Z')),p=starDirection(star,t.date.getTime()),v=A.RotateVector(A.Rotation_ECT_EQJ(t),new A.Vector(p[0],-p[2],p[1],t));
 assert.ok(Math.atan2(v.y,v.x)/DEG<star.ra,'negative RA proper motion');assert.ok(Math.atan2(v.z,Math.hypot(v.x,v.y))/DEG<star.dec,'negative declination proper motion');
});

test('star directions share the observer frame and match independent horizon conversion',()=>{
 const time=Date.UTC(2026,8,10,12),t=A.MakeTime(new Date(time));
 for(const latitude of [-33.8,0,35.68])for(const star of BRIGHT_STARS){
  const p=starDirection(star,time),ecliptic=[p[0],-p[2],p[1]],f=frame(time,latitude,139.7);
  const height=ecliptic.reduce((sum,x,i)=>sum+x*f.zenith[i],0);
  const eq=A.RotateVector(A.CombineRotation(A.Rotation_ECT_EQJ(t),A.Rotation_EQJ_EQD(t)),new A.Vector(...ecliptic,t));
  const h=A.Horizon(t,new A.Observer(latitude,139.7,0),(Math.atan2(eq.y,eq.x)/DEG+360)%360/15,Math.atan2(eq.z,Math.hypot(eq.x,eq.y))/DEG);
  assert.ok(Math.abs(Math.asin(height)/DEG-h.altitude)<1e-6);
 }
});
