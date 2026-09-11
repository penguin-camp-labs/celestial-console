import * as A from 'astronomy-engine';
import {trueLilith,meanLilith} from './lilith.mjs';
import {DEG,DAY,wrap,delta,frame} from './engine.mjs';
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
export function lunarNodes(time){
 const t=A.MakeTime(new Date(time)),state=A.GeoMoonState(t),rotation=A.Rotation_EQJ_ECT(t);
 const r=A.RotateVector(rotation,new A.Vector(state.x,state.y,state.z,t)),v=A.RotateVector(rotation,new A.Vector(state.vx,state.vy,state.vz,t));
 const normal=unit(cross([r.x,r.y,r.z],[v.x,v.y,v.z])),ascending=unit([-normal[1],normal[0],0]);
 const north=wrap(Math.atan2(ascending[1],ascending[0])/DEG),tangent=cross(normal,ascending);
 return {north,south:wrap(north+180),normal,orbit:Array.from({length:181},(_,i)=>{const a=i*2*DEG;return ascending.map((x,j)=>x*Math.cos(a)+tangent[j]*Math.sin(a));})};
}
export function vertexOf(f){
 const length=Math.hypot(f.north[0],f.north[1]);if(length<1e-10)return null;
 let vertex=wrap(Math.atan2(-f.north[0],f.north[1])/DEG);
 if(Math.cos(vertex*DEG)*f.east[0]+Math.sin(vertex*DEG)*f.east[1]>0)vertex=wrap(vertex+180);
 return vertex;
}
export function sensitivePoints(time,latitude,longitude,f=frame(time,latitude,longitude),lilithType='true'){
 const nodes=lunarNodes(time),before=lunarNodes(time-DAY/2),after=lunarNodes(time+DAY/2),speed=delta(after.north,before.north);
 const vertex=vertexOf(f),vb=vertexOf(frame(time-30000,latitude,longitude)),va=vertexOf(frame(time+30000,latitude,longitude));
 const lilith=lilithType==='mean'?meanLilith(time):trueLilith(time);
 const points=[
 ...(lilith?[lilith]:[]),
 {id:'NorthNode',name:'ドラゴンヘッド',symbol:'☊',color:'#9ae0ce',lon:nodes.north,lat:0,speed,distance:null,kind:'point',description:'月の昇交点（真交点・接触軌道）'},
 {id:'SouthNode',name:'ドラゴンテイル',symbol:'☋',color:'#c7b5ed',lon:nodes.south,lat:0,speed,distance:null,kind:'point',description:'月の降交点（ヘッドの反対側）'},
 ...(vertex===null?[]:[{id:'Vertex',name:'バーテックス',symbol:'Vx',color:'#f4c184',lon:vertex,lat:0,speed:vb===null||va===null?0:delta(va,vb)*1440,distance:null,kind:'point',description:'黄道と卯酉線の西側の交点'}])
 ];
 return {points,moonOrbit:nodes.orbit,vertex};
}
export function pointTrails(time,latitude,longitude,{nodes=true,vertex=true}={}){
 const trails=[];
 if(nodes){const dates=Array.from({length:73},(_,i)=>time+(i-36)*10*DAY);for(const key of ['north','south'])trails.push({id:key==='north'?'NorthNode':'SouthNode',color:key==='north'?'#9ae0ce':'#c7b5ed',span:'前後360日',positions:dates.map(t=>[lunarNodes(t)[key],0])});}
 if(vertex)trails.push({id:'Vertex',color:'#f4c184',span:'前後12時間',positions:Array.from({length:97},(_,i)=>vertexOf(frame(time+(i-48)*15*60000,latitude,longitude))).map(lon=>lon===null?null:[lon,0])});
 return trails;
}
export function observerMatrix(f){
 // Input Three axes: ecliptic (X, Z, -Y); output: east, zenith, south.
 return [f.east[0],f.east[2],-f.east[1], f.zenith[0],f.zenith[2],-f.zenith[1], -f.north[0],-f.north[2],f.north[1]];
}
export function topocentricDirection(body,observer){
 if(body.kind==='point'||!body.distance||!observer)return {lon:body.lon,lat:body.lat};
 const lon=body.lon*DEG,lat=body.lat*DEG,r=body.distance;
 const [x,y,z]=[r*Math.cos(lat)*Math.cos(lon)-observer[0],r*Math.cos(lat)*Math.sin(lon)-observer[1],r*Math.sin(lat)-observer[2]];
 return {lon:wrap(Math.atan2(y,x)/DEG),lat:Math.atan2(z,Math.hypot(x,y))/DEG};
}
