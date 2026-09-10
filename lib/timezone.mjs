const DAY=86400000;
export function zoneOffset(time,zone){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(time));
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));const wall=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second));
 return (wall-Math.floor(time/1000)*1000)/60000;
}
export function resolveZonedTime(local,zone,ambiguity='reject'){
 const wall=Date.parse(local+'Z');if(!Number.isFinite(wall)||new Date(wall).toISOString().slice(0,19)!==local)throw Error('有効な年月日・時刻を入力してください。');
 const offsets=new Set();for(let d=-36;d<=36;d+=3)offsets.add(zoneOffset(wall+d*3600000,zone));
 const candidates=[...offsets].map(offset=>({time:wall-offset*60000,offset})).filter(c=>zoneOffset(c.time,zone)===c.offset).sort((a,b)=>a.time-b.time);
 if(!candidates.length)throw Error('夏時間の開始などにより、この地域に存在しない時刻です。時刻を修正してください。');
 if(candidates.length>1&&ambiguity==='reject')throw Error('夏時間の終了などで同じ時刻が2回あります。「重複する時刻」で前後を選んでください。');
 return ambiguity==='later'?candidates[candidates.length-1]:candidates[0];
}
export function offsetLabel(offset){
 const seconds=Math.round(Math.abs(offset)*60),h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;
 return 'UTC'+(offset>=0?'+':'−')+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+(s?':'+String(s).padStart(2,'0'):'');
}
