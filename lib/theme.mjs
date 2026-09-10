import {DEG} from './engine.mjs';
import {topocentricDirection} from './observer.mjs';

export const THEMES=[{value:'light',label:'ライト'},{value:'dark',label:'ダーク'},{value:'sky',label:'現地の空'}];
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const rgb=hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16));
const mixColor=(a,b,t)=>'#'+rgb(a).map((v,i)=>Math.round(v+(rgb(b)[i]-v)*t).toString(16).padStart(2,'0')).join('');

// Geometric altitude of the Sun's centre, at sea level, in the chart's true-of-date frame.
export function solarPosition(chart){
 const sun=chart.bodies.find(b=>b.id==='Sun');
 if(!sun)return {altitude:-90,direction:[0,-1,0]};
 const p=topocentricDirection(sun,chart.observerVector),lon=p.lon*DEG,lat=p.lat*DEG;
 const v=[Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)];
 const dot=a=>a.reduce((sum,x,i)=>sum+x*v[i],0);
 const up=clamp(dot(chart.zenith),-1,1);
 return {altitude:Math.asin(up)/DEG,direction:[dot(chart.east),up,-dot(chart.north)]};
}
// Twilight boundaries: https://aa.usno.navy.mil/faq/RST_defs
// Colours and star visibility are a clear-sky visual approximation, not photometry.
const stops=[
 [-18,'#060c12','#111b2c','#060c12'],
 [-12,'#101b35','#303957','#0b1421'],
 [-6,'#243e69','#976875','#152536'],
 [-1,'#648aac','#eebc98','#263d48'],
 [6,'#65a4d4','#c8dde4','#45606a'],
 [25,'#54a5df','#bedcec','#526c73']
];
export function skyAppearance(altitude){
 const h=Number.isFinite(altitude)?clamp(altitude,-90,90):-90;
 let i=stops.findIndex(s=>s[0]>=h);if(i<0)i=stops.length-1;
 const a=stops[Math.max(0,i-1)],b=stops[i],t=a===b?0:smooth(a[0],b[0],h);
 return {altitude:h,zenith:mixColor(a[1],b[1],t),horizon:mixColor(a[2],b[2],t),ground:mixColor(a[3],b[3],t),
  stars:1-smooth(-18,-2,h),light:h>=-1,
  glow:smooth(-16,-4,h)*(1-smooth(0,12,h)),
  phase:h>=-.833?'昼':h>=-6?'市民薄明':h>=-12?'航海薄明':h>=-18?'天文薄明':'夜'};
}
export function themeAppearance(theme,chart){
 const solar=solarPosition(chart),sky=skyAppearance(solar.altitude);
 return {...sky,direction:solar.direction,light:theme==='light'||(theme==='sky'&&sky.light)};
}
const inkCache=new Map();
export function inkColor(color,light=false){
 if(!light)return color;
 if(inkCache.has(color))return inkCache.get(color);
 // Retain the hue while darkening pale astronomical markers on the light chart.
 const channels=rgb(color);const max=Math.max(...channels),factor=Math.min(1,105/max);
 const result='#'+channels.map(v=>Math.round(v*factor).toString(16).padStart(2,'0')).join('');
 inkCache.set(color,result);return result;
}
