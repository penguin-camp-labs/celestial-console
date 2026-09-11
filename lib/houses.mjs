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

// Unit vectors in the true ecliptic frame of date. Campanus uses great
// semicircles through the N/S horizon axis; Placidus uses semi-arc curves.
// Equal/Whole Sign are longitude sectors, extended to the ecliptic poles.
export function houseBoundaryCurves(f,system='equal',result=houseCusps(f,system)){
 if(!result.available)return [];
 const eps=f.eps*DEG,latitude=f.latitude??Math.asin(dot(f.zenith,[0,Math.sin(eps),Math.cos(eps)]))/DEG;
 const toEcliptic=(ra,dec)=>{const x=Math.cos(dec)*Math.cos(ra),y=Math.cos(dec)*Math.sin(ra),z=Math.sin(dec);return [x,y*Math.cos(eps)+z*Math.sin(eps),-y*Math.sin(eps)+z*Math.cos(eps)];};
 return result.cusps.map((cusp,i)=>{
  if(system==='campanus'){
   const angle=-i*30*DEG,q=f.east.map((v,j)=>v*Math.cos(angle)+f.zenith[j]*Math.sin(angle));
   const l=cusp*DEG,point=[Math.cos(l),Math.sin(l),0],at=Math.atan2(dot(point,q),dot(point,f.north));
   const angles=Array.from({length:129},(_,k)=>k*Math.PI/128);angles[Math.max(1,Math.min(127,Math.round(at*128/Math.PI)))]=at;angles.sort((a,b)=>a-b);
   return angles.map(a=>f.north.map((v,j)=>v*Math.cos(a)+q[j]*Math.sin(a)));
  }
  if(system==='equal'||system==='whole')return Array.from({length:129},(_,k)=>{const lat=(-90+k*180/128)*DEG,l=cusp*DEG;return [Math.cos(lat)*Math.cos(l),Math.cos(lat)*Math.sin(l),Math.sin(lat)];});
  const limit=Math.min(89.999999,90-Math.abs(latitude)),decs=Array.from({length:129},(_,k)=>(-limit+2*limit*k/128)*DEG);
  const cuspDec=Math.asin(Math.sin(eps)*Math.sin(cusp*DEG));decs[Math.max(1,Math.min(127,Math.round((cuspDec/DEG+limit)*128/(2*limit))))]=cuspDec;decs.sort((a,b)=>a-b);
  return decs.map(dec=>{
   const h=Math.acos(Math.max(-1,Math.min(1,-Math.tan(latitude*DEG)*Math.tan(dec))))/DEG,n=180-h;
   const offsets=[h,h+n/3,h+2*n/3,180,180+n/3,180+2*n/3,360-h,360-2*h/3,360-h/3,0,h/3,2*h/3];
   return toEcliptic((f.lst+offsets[i])*DEG,dec);
  });
 });
}
