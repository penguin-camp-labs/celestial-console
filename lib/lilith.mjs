import * as A from 'astronomy-engine';
import {DEG,DAY,wrap,delta} from './engine.mjs';
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
// Osculating two-body apogee, not the mean or interpolated lunar apogee.
// State is geocentric EQJ, in AU and AU/day; both Earth and Moon contribute to GM.
export function apogeeFromState(state,mu=A.MassProduct(A.Body.EMB)){
 const r=[state.x,state.y,state.z],v=[state.vx,state.vy,state.vz],radius=Math.hypot(...r);
 if(!r.every(Number.isFinite)||!v.every(Number.isFinite)||!Number.isFinite(mu)||mu<=0||radius<=0)return null;
 const vxh=cross(v,cross(r,v)),ecc=vxh.map((x,i)=>x/mu-r[i]/radius),e=Math.hypot(...ecc);
 if(!Number.isFinite(e)||e<1e-8||e>=1)return null;
 return {direction:ecc.map(x=>-x/e),eccentricity:e};
}
export function trueLilithPosition(time){
 const t=A.MakeTime(new Date(time)),apogee=apogeeFromState(A.GeoMoonState(t));
 if(!apogee)return null;
 const d=apogee.direction,v=A.RotateVector(A.Rotation_EQJ_ECT(t),new A.Vector(d[0],d[1],d[2],t));
 return {lon:wrap(Math.atan2(v.y,v.x)/DEG),lat:Math.atan2(v.z,Math.hypot(v.x,v.y))/DEG};
}
export function trueLilith(time){
 const p=trueLilithPosition(time),step=DAY/24,before=trueLilithPosition(time-step),after=trueLilithPosition(time+step);
 if(!p||!before||!after)return null;
 return {id:'TrueLilith',name:'リリス（True Lilith）',symbol:'⚸',color:'#e8a9da',...p,speed:delta(after.lon,before.lon)/(2*step/DAY),distance:null,kind:'point',description:'月の接触軌道の遠地点（True Lilith・近似計算）'};
}
