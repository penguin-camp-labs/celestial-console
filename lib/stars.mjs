import * as A from 'astronomy-engine';
import catalogue from './bright-stars.json' with {type:'json'};
export const BRIGHT_STARS=catalogue.stars;
const DEG=Math.PI/180,MAS=DEG/3600000;
// Catalogue RA/Dec are ICRS at J1991.25; pmRA already includes cos(dec).
// Linear tangential proper motion, normalized before rotating into the true ecliptic of date.
export function starDirection(star,time){
 const t=A.MakeTime(new Date(time)),years=2000+t.tt/365.25-catalogue.epoch;
 const ra=star.ra*DEG,dec=star.dec*DEG,c=Math.cos(dec),s=Math.sin(dec),cr=Math.cos(ra),sr=Math.sin(ra);
 const base=[c*cr,c*sr,s],east=[-sr,cr,0],north=[-s*cr,-s*sr,c];
 const v=base.map((x,i)=>x+years*MAS*(star.pmRA*east[i]+star.pmDE*north[i]));
 const length=Math.hypot(...v),p=A.RotateVector(A.Rotation_EQJ_ECT(t),new A.Vector(v[0]/length,v[1]/length,v[2]/length,t));
 return [p.x,p.z,-p.y]; // Three axes used by the ecliptic scene.
}
export function starPositions(time){return BRIGHT_STARS.map(star=>starDirection(star,time));}
