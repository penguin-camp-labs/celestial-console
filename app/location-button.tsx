import {t as tr} from './use-locale';
import {useEffect,useRef,useState} from 'react';
import {MapPin} from 'lucide-react';
export default function LocationButton({onLocation,onMessage}: {onLocation:(lat:number,lon:number)=>void;onMessage:(message:string)=>void}){
 const [busy,setBusy]=useState(false),request=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{request.current++;if(timer.current)clearTimeout(timer.current);},[]);
 const locate=()=>{
  if(busy)return;if(!navigator.geolocation){onMessage('このブラウザは現在地取得に対応していません。座標を直接入力できます。');return;}
  const id=++request.current;setBusy(true);onMessage('');
  const done=()=>{if(id!==request.current)return false;if(timer.current)clearTimeout(timer.current);setBusy(false);request.current++;return true;};
  timer.current=setTimeout(()=>{if(done())onMessage('現在地の取得がタイムアウトしました。位置情報の設定を確認して再試行してください。');},20000);
  try{navigator.geolocation.getCurrentPosition(position=>{
   if(!done())return;const {latitude,longitude,accuracy}=position.coords;
   if(!Number.isFinite(latitude)||Math.abs(latitude)>89||!Number.isFinite(longitude)||Math.abs(longitude)>180){onMessage('取得した位置が対応範囲外です。緯度±89°以内の地点を指定してください。');return;}
   onLocation(latitude,longitude);onMessage('現在地を反映しました。'+(Number.isFinite(accuracy)?'推定精度 ±'+Math.round(accuracy)+'m。':'')+' 表示日時はそのままです。');
  },error=>{if(!done())return;onMessage(error.code===1?'位置情報が許可されていません。ブラウザのサイト設定で許可するか、座標を直接入力してください。':error.code===3?'現在地の取得がタイムアウトしました。再試行するか座標を直接入力してください。':'現在地を取得できませんでした。端末の位置情報設定を確認してください。');},{enableHighAccuracy:true,timeout:15000,maximumAge:0});}
  catch{if(done())onMessage('現在地を取得できません。このサイトを通常のブラウザで開き、位置情報の許可を確認してください。');}
 };
 return <button className="location-button" type="button" onClick={locate} disabled={busy} aria-busy={busy}><MapPin size={15}/>{tr(busy?'現在地を取得中…':'現在地を取得（GPS）')}</button>;
}
