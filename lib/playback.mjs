import {DAY,delta,wrap,frame} from './engine.mjs';
import {vertexOf} from './observer.mjs';
const mix=(a,b,t)=>a+(b-a)*t;
export function phaseBetween(a,b,alpha,expected=0){
 const shortest=delta(b,a),travel=shortest+360*Math.round((expected-shortest)/360);
 return wrap(a+travel*alpha);
}
export function interpolateChart(a,b,alpha){
 if(alpha>=1)return b;if(alpha<=0)return {...b,...a,aspects:b.aspects,patternEdges:b.patternEdges};
 const time=mix(a.time,b.time,alpha),days=(b.time-a.time)/DAY,f=frame(time,b.latitude,b.longitude);
 const old=new Map(a.bodies.map(body=>[body.id,body]));
 const bodies=b.bodies.map(body=>{
  const prev=old.get(body.id);if(!prev)return body;
  const expected=days*(prev.speed+body.speed)/2,lon=body.id==='Vertex'?vertexOf(f):phaseBetween(prev.lon,body.lon,alpha,expected);
  return {...body,lon:lon??body.lon,lat:mix(prev.lat,body.lat,alpha),speed:mix(prev.speed,body.speed,alpha),distance:body.distance===null?null:mix(prev.distance??body.distance,body.distance,alpha)};
 });
 const result={...b,...f,time,bodies};
 if(a.moonOrbit&&b.moonOrbit)result.moonOrbit=b.moonOrbit.map((p,i)=>{const q=a.moonOrbit[i]??p,v=p.map((x,j)=>mix(q[j],x,alpha)),n=Math.hypot(...v);return n>0?v.map(x=>x/n):p;});
 if(a.pointTrails&&b.pointTrails)result.pointTrails=b.pointTrails.map(trail=>{
  const prev=a.pointTrails.find(p=>p.id===trail.id);if(!prev)return trail;
  return {...trail,positions:trail.positions.map((p,i)=>{const q=prev.positions[i];if(!p||!q)return p;return [phaseBetween(q[0],p[0],alpha,trail.id==='Vertex'?360*days:0),mix(q[1],p[1],alpha)];})};
 });
 return result;
}
// Reuse 10 Hz ephemeris samples. Only interpolate render coordinates between arrivals.
// Never extrapolate past the newest calculated date, including after tab suspension.
export class PlaybackInterpolator{
 constructor(){this.from=null;this.to=null;this.start=0;this.arrived=0;this.duration=100;this.active=false;}
 value(now){if(!this.to)return null;return interpolateChart(this.from,this.to,Math.max(0,Math.min(1,(now-this.start)/this.duration)));}
 sample(chart,now,enabled){
  if(!enabled||!Number.isFinite(chart.time)||!this.active||!this.to||chart.latitude!==this.to.latitude||chart.longitude!==this.to.longitude){
   this.from=this.to=chart;this.start=this.arrived=now;this.active=!!enabled;return chart;
  }
  if(chart.time!==this.to.time){this.from=this.value(now);this.duration=Math.max(50,Math.min(200,now-this.arrived));this.start=this.arrived=now;this.to=chart;}
  else this.to=chart;
  return this.value(now);
 }
}
