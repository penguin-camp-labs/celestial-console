import {DEG,wrap,delta} from './engine.mjs';
export const HOUSE_SYSTEMS=[{value:'placidus',label:'プラシーダス'},{value:'campanus',label:'キャンパナス'},{value:'equal',label:'イコール / ASC起点'},{value:'whole',label:'ホールサイン'}];
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unavailable=message=>({cusps:[],centres:[],available:false,message});
const finish=cusps=>({cusps,centres:cusps.map((c,i)=>wrap(c+delta(cusps[(i+1)%12],c)/2)),available:true,message:''});

// Independently implement the geometric definitions. Swiss Ephemeris is used only
// as an external reference in fixtures, never as distributed runtime code.
export function houseCusps(f,system='equal'){
 if(system==='equal'||system==='whole'){
  const start=system==='whole'?Math.floor(f.asc/30)*30:f.asc;
  return finish(Array.from({length:12},(_,i)=>wrap(start+i*30)));
 }
 if(system==='campanus'){
  // Divide the prime vertical from east towards the nadir. Each house plane
  // contains the north/south horizon axis and one of these 30-degree divisions.
  const cusps=[];
  for(let i=0;i<12;i++){
   const a=-i*30*DEG,q=f.east.map((x,j)=>x*Math.cos(a)+f.zenith[j]*Math.sin(a));
   const normal=cross(f.north,q),v=[-normal[1],normal[0],0],length=Math.hypot(v[0],v[1]);
   if(length<1e-10)return unavailable('この地点・日時ではキャンパナスの境界が一意に定まりません。日時を変えるか、イコールを選んでください。');
   if(dot(v,q)<0){v[0]*=-1;v[1]*=-1;}
   cusps.push(wrap(Math.atan2(v[1],v[0])/DEG));
  }
  return finish(cusps);
 }
 if(system!=='placidus')return unavailable('ハウス方式を選んでください。');
 const eps=f.eps*DEG,pole=[0,Math.sin(eps),Math.cos(eps)];
 const latitude=f.latitude??Math.asin(Math.max(-1,Math.min(1,dot(f.zenith,pole))))/DEG;
 if(Math.abs(latitude)>=90-Math.abs(f.eps)-1e-7)return unavailable('この緯度ではプラシーダスを計算できません。キャンパナスまたはイコールを選んでください。');
 const tanPhi=Math.tan(latitude*DEG),mc=f.mc,asc=mc+wrap(f.asc-mc),ic=mc+180;
 // For each ecliptic point, trisect its own semi-diurnal / semi-nocturnal arc.
 function residual(lon,fraction,below){
  const l=lon*DEG,ra=Math.atan2(Math.sin(l)*Math.cos(eps),Math.cos(l))/DEG;
  const dec=Math.asin(Math.sin(eps)*Math.sin(l)),cosH=-tanPhi*Math.tan(dec);
  if(Math.abs(cosH)>1)return NaN;
  const semiDay=Math.acos(cosH)/DEG,target=below?semiDay+(180-semiDay)*fraction:semiDay*fraction;
  return delta(ra,f.lst+target);
 }
 function solve(lo,hi,fraction,below){
  let flo=residual(lo,fraction,below),fhi=residual(hi,fraction,below);
  if(!Number.isFinite(flo+fhi)||flo*fhi>0)return null;
  for(let i=0;i<48;i++){const mid=(lo+hi)/2,fm=residual(mid,fraction,below);if(!Number.isFinite(fm))return null;if(flo*fm<=0){hi=mid;fhi=fm;}else{lo=mid;flo=fm;}}
  return wrap((lo+hi)/2);
 }
 const h11=solve(mc,asc,1/3,false),h12=solve(mc,asc,2/3,false),h2=solve(asc,ic,1/3,true),h3=solve(asc,ic,2/3,true);
 if([h11,h12,h2,h3].some(x=>x===null))return unavailable('この地点・日時ではプラシーダスの解を確定できません。別の方式を選んでください。');
 return finish([f.asc,h2,h3,wrap(mc+180),wrap(h11+180),wrap(h12+180),wrap(f.asc+180),wrap(h2+180),wrap(h3+180),mc,h11,h12]);
}
