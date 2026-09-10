import * as Astronomy from 'astronomy-engine';
import metadata from './asteroid-meta.json' with {type:'json'};
export const ASTEROIDS=[
 {id:'Ceres',number:1,name:'セレス',symbol:'⚳',color:'#c7dda0',kind:'準惑星'},
 {id:'Pallas',number:2,name:'パラス',symbol:'⚴',color:'#91c9e3',kind:'小惑星'},
 {id:'Juno',number:3,name:'ジュノー',symbol:'⚵',color:'#e0a7bf',kind:'小惑星'},
 {id:'Vesta',number:4,name:'ベスタ',symbol:'⚶',color:'#e5bd8a',kind:'小惑星'},
 {id:'Chiron',number:2060,name:'キロン',symbol:'⚷',color:'#aadacf',kind:'ケンタウルス族'},
 {id:'Pholus',number:5145,name:'フォルス',symbol:'Ph',color:'#c2afe8',kind:'ケンタウルス族'},
 {id:'Eros',number:433,name:'エロス',symbol:'Er',color:'#e7a897',kind:'小惑星'},
 {id:'Psyche',number:16,name:'プシュケ',symbol:'Ps',color:'#bcbddf',kind:'小惑星'}
];
const DAY=86400000;
export function decodeEphemeris(buffer){
 const total=metadata.bodies.reduce((n,b)=>n+b.count*24,0);if(buffer.byteLength!==total)throw Error('天文データのサイズが一致しません。');
 const view=new DataView(buffer),values=new Float32Array(total/4);for(let i=0;i<values.length;i++){const n=view.getFloat32(i*4,true);if(!Number.isFinite(n))throw Error('天文データを読み込めません。');values[i]=n;}return values;
}
let dataPromise;
export function loadAsteroids(){
 if(!dataPromise)dataPromise=fetch('/ephemeris/asteroids.bin',{credentials:'same-origin',referrerPolicy:'no-referrer'}).then(r=>{if(!r.ok)throw Error('追加天体のデータを読み込めませんでした。');return r.arrayBuffer();}).then(decodeEphemeris).catch(e=>{dataPromise=undefined;throw e;});
 return dataPromise;
}
export function asteroidVector(id,time,data){
 const info=metadata.bodies.find(b=>b.id===id);if(!info||!data)throw Error('追加天体のデータがありません。');
 const u=(time/DAY+2440587.5-info.startJD)/metadata.stepDays,i=Math.floor(u),t=u-i,h=metadata.stepDays;
 if(i<0||i>=info.count-1)throw Error('追加天体の日時が範囲外です。');
 const start=info.offset/4+i*6,h00=2*t*t*t-3*t*t+1,h10=t*t*t-2*t*t+t,h01=-2*t*t*t+3*t*t,h11=t*t*t-t*t;
 return [0,1,2].map(k=>h00*data[start+k]+h10*h*data[start+3+k]+h01*data[start+6+k]+h11*h*data[start+9+k]);
}
export function asteroidPosition(id,time,data){
 const [x,y,z]=asteroidVector(id,time,data),e=Astronomy.Ecliptic(new Astronomy.Vector(x,y,z,Astronomy.MakeTime(new Date(time))));
 return {lon:(e.elon+360)%360,lat:e.elat,distance:Math.hypot(x,y,z)};
}
export function asteroidBodies(ids,time,data){
 return ASTEROIDS.filter(b=>ids.includes(b.id)).map(b=>{const p=asteroidPosition(b.id,time,data),before=asteroidPosition(b.id,time-DAY/2,data),after=asteroidPosition(b.id,time+DAY/2,data);return {...b,...p,speed:((after.lon-before.lon+540)%360)-180};});
}
