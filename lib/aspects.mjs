export const MAJOR_ASPECTS=[
 {angle:0,name:'合',symbol:'☌',color:'#ecd0fa'},{angle:60,name:'セクスタイル',symbol:'⚹',color:'#76e1c4'},
 {angle:90,name:'スクエア',symbol:'□',color:'#ff917e'},{angle:120,name:'トライン',symbol:'△',color:'#83bfff'},
 {angle:180,name:'オポジション',symbol:'☍',color:'#eba8c2'}];
export const MINOR_ASPECTS=[
 {angle:30,name:'セミセクスタイル',symbol:'⚺',color:'#aecf85'},{angle:45,name:'セミスクエア',symbol:'∠',color:'#ddad73'},
 {angle:72,name:'クインタイル',symbol:'Q',color:'#bfacf1'},{angle:135,name:'セスキコードレイト',symbol:'⚼',color:'#e3b596'},
 {angle:144,name:'バイクインタイル',symbol:'bQ',color:'#baa2d9'},{angle:150,name:'クインカンクス',symbol:'⚻',color:'#b7d496'}];
export const ALL_ASPECTS=[...MAJOR_ASPECTS,...MINOR_ASPECTS];
export const PATTERNS=[
 {id:'grand-trine',name:'グランドトライン',size:3,edges:[[0,1,120],[1,2,120],[0,2,120]]},
 {id:'t-square',name:'Tスクエア',size:3,edges:[[0,1,180],[0,2,90],[1,2,90]]},
 {id:'yod',name:'ヨッド',size:3,edges:[[0,1,60],[0,2,150],[1,2,150]]},
 {id:'grand-cross',name:'グランドクロス',size:4,edges:[[0,1,90],[1,2,90],[2,3,90],[0,3,90],[0,2,180],[1,3,180]]},
 {id:'kite',name:'カイト',size:4,edges:[[0,1,120],[1,2,120],[0,2,120],[0,3,180],[1,3,60],[2,3,60]]},
 {id:'rectangle',name:'ミスティックレクタングル',size:4,edges:[[0,1,60],[1,2,120],[2,3,60],[0,3,120],[0,2,180],[1,3,180]]}
];
export function defaultAspectSettings(){return Object.fromEntries(ALL_ASPECTS.map(a=>[a.angle,{enabled:true,orb:MAJOR_ASPECTS.includes(a)?6:2}]));}
const delta=(a,b)=>((a-b+540)%360+360)%360-180;
export const edgeKey=(a,b)=>[a,b].sort().join(':');
// The lunar nodes define one axis; their mutual opposition is not an aspect.
const isNodePair=(a,b)=>(a.id==='NorthNode'&&b.id==='SouthNode')||(a.id==='SouthNode'&&b.id==='NorthNode');
export function aspectEdges(bodies,settings,group={major:true,minor:false}){
 const enabled=ALL_ASPECTS.filter(a=>settings[a.angle]?.enabled&&(MAJOR_ASPECTS.includes(a)?group.major:group.minor)),list=[];
 for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
  const a=bodies[i],b=bodies[j];if(isNodePair(a,b))continue;
  const sep=Math.abs(delta(a.lon,b.lon));
  const match=enabled.map(v=>({...v,orb:Math.abs(sep-v.angle),limit:settings[v.angle].orb})).filter(v=>v.orb<=v.limit+1e-9).sort((a,b)=>a.orb-b.orb||a.angle-b.angle)[0];
  if(match){const d=Math.PI/180;const skyAngle=Math.acos(Math.max(-1,Math.min(1,Math.sin(a.lat*d)*Math.sin(b.lat*d)+Math.cos(a.lat*d)*Math.cos(b.lat*d)*Math.cos((a.lon-b.lon)*d))))/d;list.push({...match,a:a.id,b:b.id,separation:sep,skyAngle});}
 }
 return list.sort((a,b)=>a.orb-b.orb);
}
// Pattern detection uses each required angle's orb, independently of ordinary line visibility.
// Search all role assignments; deduplicate the same set of bodies for the same pattern.
export function findPatterns(bodies,settings,enabled){
 const found=[];
 for(const pattern of PATTERNS.filter(p=>enabled.includes(p.id))){
  const seen=new Set(),chosen=[];
  function visit(){
   if(chosen.length===pattern.size){
    const ids=chosen.map(i=>bodies[i].id),key=pattern.id+':'+[...ids].sort().join(':');if(seen.has(key))return;seen.add(key);
    const edges=pattern.edges.map(([i,j,angle])=>{const a=bodies[chosen[i]],b=bodies[chosen[j]],def=ALL_ASPECTS.find(x=>x.angle===angle);return {...def,a:a.id,b:b.id,orb:Math.abs(Math.abs(delta(a.lon,b.lon))-angle),limit:settings[angle].orb};});
    found.push({id:key,type:pattern.id,name:pattern.name,bodies:ids,edges,orb:Math.max(...edges.map(e=>e.orb))});return;
   }
   for(let k=0;k<bodies.length;k++){
    if(chosen.includes(k))continue;const role=chosen.length;
    const fits=pattern.edges.every(([i,j,angle])=>{
     let other;if(i===role&&j<role)other=chosen[j];else if(j===role&&i<role)other=chosen[i];else return true;
     return !isNodePair(bodies[k],bodies[other])&&Math.abs(Math.abs(delta(bodies[k].lon,bodies[other].lon))-angle)<=settings[angle].orb+1e-9;
    });if(fits){chosen.push(k);visit();chosen.pop();}
   }
  }
  visit();
 }
 return found.sort((a,b)=>a.orb-b.orb);
}
