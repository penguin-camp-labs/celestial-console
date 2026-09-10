import {request,rows,targets,common} from './build-asteroids.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {decodeEphemeris,asteroidVector,asteroidPosition} from '../lib/asteroids.mjs';
const raw=await readFile('public/ephemeris/asteroids.bin'),data=decodeEphemeris(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
const times=[Date.UTC(1800,0,1),Date.UTC(1931,0,30,12),Date.UTC(1975,0,23),Date.UTC(2000,1,29,3),Date.UTC(2026,8,10,12),Date.UTC(2200,11,31,23)];
let seed=137;for(let i=0;i<24;i++){seed=seed*16807%2147483647;times.push(Date.UTC(1800,0,1)+Math.floor(seed/2147483647*(Date.UTC(2201,0,1)-Date.UTC(1800,0,1))));}
times.sort((a,b)=>a-b);const fixtures=[];
for(const [id,number] of targets){
 const result=await request(number,{TLIST:times.map(t=>"'"+(t/86400000+2440587.5)+"'").join(' '),TLIST_TYPE:"'JD'"});
 let worst=0;const records=rows(result).map((row,i)=>{const t=times[i],expected=row.slice(1,4),actual=asteroidVector(id,t,data),an=Math.hypot(...actual),en=Math.hypot(...expected),cross=[actual[1]*expected[2]-actual[2]*expected[1],actual[2]*expected[0]-actual[0]*expected[2],actual[0]*expected[1]-actual[1]*expected[0]];const error=Math.asin(Math.min(1,Math.hypot(...cross)/an/en))*180/Math.PI*3600;worst=Math.max(worst,error);return {time:t,vector:expected};});
 console.log(id,'max interpolation error',worst.toFixed(3),'arcsec');if(worst>60)throw Error('Interpolation exceeded 1 arcminute');fixtures.push({id,records});
}
await writeFile('tests/asteroid-fixtures.json',JSON.stringify({source:'NASA/JPL Horizons ICRF geocentric LT+S, UT; independently requested off-grid timestamps',retrieved:new Date().toISOString(),fixtures}));
