import * as Astronomy from 'astronomy-engine';
export const DAY=86400000;
export const MIN_TIME=Date.UTC(1800,0,1), MAX_TIME=Date.UTC(2201,0,1)-1;
export const DEG=Math.PI/180;
export const SIGNS=['牡羊座','牡牛座','双子座','蟹座','獅子座','乙女座','天秤座','蠍座','射手座','山羊座','水瓶座','魚座'];
export const GLYPHS=['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'];
export const BODIES=[
{id:'Sun',name:'太陽',symbol:'☉',color:'#ffd48a'},{id:'Moon',name:'月',symbol:'☽',color:'#e8efff'},
{id:'Mercury',name:'水星',symbol:'☿',color:'#a2d0d9'},{id:'Venus',name:'金星',symbol:'♀',color:'#efb8d3'},
{id:'Mars',name:'火星',symbol:'♂',color:'#ff9079'},{id:'Jupiter',name:'木星',symbol:'♃',color:'#eac28f'},
{id:'Saturn',name:'土星',symbol:'♄',color:'#d7d395'},{id:'Uranus',name:'天王星',symbol:'♅',color:'#8ff3e4'},
{id:'Neptune',name:'海王星',symbol:'♆',color:'#99b9ff'},{id:'Pluto',name:'冥王星',symbol:'♇',color:'#c9a4eb'}];
export const ASPECTS=[{angle:0,name:'合',symbol:'☌',color:'#ecd0fa'},{angle:60,name:'セクスタイル',symbol:'⚹',color:'#76e1c4'},{angle:90,name:'スクエア',symbol:'□',color:'#ff917e'},{angle:120,name:'トライン',symbol:'△',color:'#83bfff'},{angle:180,name:'オポジション',symbol:'☍',color:'#eba8c2'}];
export const wrap=n=>((n%360)+360)%360;
export const delta=(a,b)=>wrap(a-b+180)-180;
export const clampTime=t=>Math.max(MIN_TIME,Math.min(MAX_TIME,t));
export function validTime(t){return typeof t==='number'&&Number.isFinite(t)&&t>=MIN_TIME&&t<=MAX_TIME;}
export function localInput(t,offset){return new Date(t+offset*60000).toISOString().slice(0,19);}
export function parseInput(s,offset){
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s)||!Number.isFinite(offset)||offset < -720||offset>840) throw Error('日時とUTC差を確認してください。');
 const normalized=s.length===16?s+':00':s, wall=Date.parse(normalized+'Z'), t=wall-offset*60000;
 if(!Number.isFinite(wall)||new Date(wall).toISOString().slice(0,19)!==normalized||!validTime(t))throw Error('1800年〜2200年の有効な日時を入力してください。');
 return t;
}
export function position(id,time){const e=Astronomy.Ecliptic(Astronomy.GeoVector(id,new Date(time),true));return {lon:wrap(e.elon),lat:e.elat,distance:Math.hypot(e.vec.x,e.vec.y,e.vec.z)};}
export function aspectsOf(bodies,orb=6){
 const list=[];
 for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
  const a=bodies[i],b=bodies[j],sep=Math.abs(delta(a.lon,b.lon));
  const aspect=ASPECTS.find(v=>Math.abs(sep-v.angle)<=orb);
  if(aspect){const actual=Math.acos(Math.max(-1,Math.min(1,Math.sin(a.lat*DEG)*Math.sin(b.lat*DEG)+Math.cos(a.lat*DEG)*Math.cos(b.lat*DEG)*Math.cos((a.lon-b.lon)*DEG))))/DEG;
   list.push({...aspect,a:a.id,b:b.id,orb:Math.abs(sep-aspect.angle),separation:sep,skyAngle:actual});}
 }
 return list.sort((a,b)=>a.orb-b.orb);
}
export function frame(time,latitude,longitude){
 const astroTime=Astronomy.MakeTime(new Date(time));
 const rotation=Astronomy.CombineRotation(Astronomy.Rotation_EQD_EQJ(astroTime),Astronomy.Rotation_EQJ_ECT(astroTime));
 const theta=wrap(Astronomy.SiderealTime(new Date(time))*15+longitude)*DEG,phi=latitude*DEG;
 const rot=([x,y,z])=>{const v=Astronomy.RotateVector(rotation,new Astronomy.Vector(x,y,z,astroTime));return [v.x,v.y,v.z];};
 const pole=rot([0,0,1]),eps=Math.atan2(pole[1],pole[2]);
 const zenith=rot([Math.cos(phi)*Math.cos(theta),Math.cos(phi)*Math.sin(theta),Math.sin(phi)]);
 const east=rot([-Math.sin(theta),Math.cos(theta),0]);
 const north=rot([-Math.sin(phi)*Math.cos(theta),-Math.sin(phi)*Math.sin(theta),Math.cos(phi)]);
 let asc=wrap(Math.atan2(-zenith[0],zenith[1])/DEG);
 if(Math.cos(asc*DEG)*east[0]+Math.sin(asc*DEG)*east[1]<0) asc=wrap(asc+180);
 const mc=wrap(Math.atan2(Math.sin(theta),Math.cos(theta)*Math.cos(eps))/DEG);
 const observer=Astronomy.RotateVector(Astronomy.Rotation_EQJ_ECT(astroTime),Astronomy.ObserverVector(astroTime,new Astronomy.Observer(latitude,longitude,0),false));
 return {asc,mc,zenith,east,north,observerVector:[observer.x,observer.y,observer.z],eps:eps/DEG,lst:wrap(theta/DEG)};
}
export function calculate(time,latitude=35.6812,longitude=139.7671,orb=6){
 if(!validTime(time)||!Number.isFinite(latitude)||Math.abs(latitude)>89||!Number.isFinite(longitude)||Math.abs(longitude)>180||!Number.isFinite(orb)||orb<0||orb>10)throw Error('計算条件が範囲外です。');
 const bodies=BODIES.map(b=>{const p=position(b.id,time),before=position(b.id,time-DAY/2),after=position(b.id,time+DAY/2);return {...b,...p,speed:delta(after.lon,before.lon)};});
 return {bodies,aspects:aspectsOf(bodies,orb),...frame(time,latitude,longitude)};
}
export function signPosition(lon){const total=Math.floor(wrap(lon)*60);return SIGNS[Math.floor(total/1800)]+' '+String(Math.floor(total/60)%30).padStart(2,'0')+'°'+String(total%60).padStart(2,'0')+'′';}
export function validateSaved(x){
 if(!x||x.version!==1||!validTime(x.time)||!Number.isFinite(x.latitude)||Math.abs(x.latitude)>89||!Number.isFinite(x.longitude)||Math.abs(x.longitude)>180||!Number.isFinite(x.offset)||x.offset < -720||x.offset>840)return null;
 return {time:x.time,latitude:x.latitude,longitude:x.longitude,offset:x.offset};
}
