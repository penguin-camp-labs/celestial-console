import {useEffect,useMemo,useState} from 'react';
import {Dialog,DialogTrigger,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {localInput,parseInput,validTime} from '@/lib/engine.mjs';
import {resolveZonedTime,offsetLabel} from '@/lib/timezone.mjs';
type City={id:string;name:string;ascii:string;aliases:string[];country:string;region:string;lat:number;lon:number;zone:string;population:number};
let citiesPromise:Promise<City[]>|undefined;
function loadCities(){return citiesPromise??=fetch('/data/cities.json',{credentials:'same-origin',referrerPolicy:'no-referrer'}).then(r=>{if(!r.ok)throw Error('都市データを読み込めませんでした。座標を直接入力できます。');return r.json() as Promise<City[]>;}).catch(e=>{citiesPromise=undefined;throw e;});}
const normalized=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const regionNames=new Intl.DisplayNames(['ja'],{type:'region'});
function BirthForm({time,offset,latitude,longitude,onApply}:any){
 const initial=localInput(time,offset),[date,setDate]=useState(initial.slice(0,10)),[clock,setClock]=useState(initial.slice(11,19));
 const [country,setCountry]=useState('JP'),[query,setQuery]=useState(''),[cities,setCities]=useState<City[]>([]),[chosen,setChosen]=useState<City|null>(null),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState(''),[retry,setRetry]=useState(0);
 const [lat,setLat]=useState(String(latitude)),[lon,setLon]=useState(String(longitude)),[zone,setZone]=useState(''),[manual,setManual]=useState(true),[utc,setUtc]=useState(String(offset/60)),[ambiguity,setAmbiguity]=useState('reject'),[error,setError]=useState('');
 useEffect(()=>{let live=true;setLoading(true);loadCities().then(data=>{if(live){setCities(data);setLoadError('');}}).catch(e=>{if(live)setLoadError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[retry]);
 const countries=useMemo(()=>[...new Set(cities.map(c=>c.country))].sort((a,b)=>(regionNames.of(a)??a).localeCompare(regionNames.of(b)??b,'ja')),[cities]);
 const results=useMemo(()=>cities.filter(c=>c.country===country&&(!query||normalized([c.name,c.ascii,...c.aliases].join(' ')).includes(normalized(query)))).slice(0,25),[cities,country,query]);
 const selectCity=(c:City)=>{setChosen(c);setLat(String(c.lat));setLon(String(c.lon));setZone(c.zone);setManual(false);setError('');};
 const submit=(e:React.FormEvent)=>{e.preventDefault();try{
  if(!date||!clock)throw Error('年月日と時刻を入力してください。');const local=date+'T'+(clock.length===5?clock+':00':clock);
  const latitude=Number(lat),longitude=Number(lon);if(!lat.trim()||!lon.trim()||!Number.isFinite(latitude)||Math.abs(latitude)>89||!Number.isFinite(longitude)||Math.abs(longitude)>180)throw Error('緯度は−89〜89°、経度は−180〜180°で入力してください。');
  let result;if(manual){const hours=Number(utc);if(!utc.trim()||!Number.isFinite(hours))throw Error('UTC差を入力してください。');result={time:parseInput(local,hours*60),offset:hours*60};}else{if(!zone)throw Error('都市を選択するか、UTC差を指定してください。');result=resolveZonedTime(local,zone,ambiguity);}
  if(!validTime(result.time))throw Error('1800〜2200年の日時を入力してください。');
  onApply({...result,latitude,longitude});
 }catch(e){setError((e as Error).message);}};
 return <form onSubmit={submit} className="birth-form">
 <fieldset><legend>1 / 生年月日・出生時刻</legend><div className="birth-date-row">
 <label className="field"><span>生年月日</span><input aria-label="生年月日" type="date" min="1800-01-01" max="2200-12-31" required value={date} onChange={e=>setDate(e.target.value)}/></label>
 <label className="field"><span>出生時刻（24時間）</span><input aria-label="出生時刻" type="time" step="1" required value={clock} onChange={e=>setClock(e.target.value)}/></label></div></fieldset>
 <fieldset><legend>2 / 出生地</legend><div className="birth-date-row">
 <label className="field"><span>国・地域</span><select aria-label="出生国・地域" value={country} onChange={e=>{setCountry(e.target.value);setQuery('');setChosen(null);setZone('');setManual(true);}}>{countries.length?countries.map(c=><option key={c} value={c}>{regionNames.of(c)??c}</option>):<option value="JP">日本</option>}</select></label>
 <label className="field"><span>都市を検索</span><input aria-label="出生都市を検索" type="search" value={query} placeholder="東京 / Tokyo" onChange={e=>setQuery(e.target.value)}/></label></div>
 {loading&&<p role="status" className="section-note">都市データを読み込み中…</p>}
 {loadError&&<p role="alert">{loadError} <button type="button" className="anchor-button" onClick={()=>setRetry(n=>n+1)}>再読み込み</button></p>}
 <div className="city-results" aria-label="都市の候補">{results.map(c=><button type="button" key={c.id} aria-pressed={chosen?.id===c.id} onClick={()=>selectCity(c)}><span>{c.name} {c.aliases.slice(0,2).join(' / ')}</span><small>{c.region} · {c.zone}</small></button>)}</div>
 {!loading&&!loadError&&!results.length&&<p className="section-note">該当する都市がありません。ローマ字でも検索できます。未収録の地点は下の座標欄で指定できます。</p>}
 <p className="selected-city">{chosen?'選択中: '+chosen.name+' / '+chosen.zone:'現在の座標を使用中。都市を選ぶと座標と時差を設定します。'}</p>
 <p className="section-note">人口約1.5万人以上の都市・首都を収録。検索は端末内で行います。地名: <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames</a> / <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>（項目を抽出・加工）</p>
 </fieldset>
<fieldset><legend>3 / 時差と座標</legend>
 <div className="birth-date-row"><label className="field"><span>時差の設定</span><select aria-label="時差の設定" value={manual?'manual':'auto'} onChange={e=>setManual(e.target.value==='manual')}><option value="auto" disabled={!zone}>都市から自動計算{zone?' / '+zone:''}</option><option value="manual">UTC差を直接指定</option></select></label>
 {manual?<label className="field"><span>UTC差（時間）</span><input aria-label="出生時刻のUTC差" type="number" min="-12" max="14" step="any" value={utc} onChange={e=>setUtc(e.target.value)}/></label>:<label className="field"><span>重複する時刻</span><select aria-label="重複する時刻" value={ambiguity} onChange={e=>setAmbiguity(e.target.value)}><option value="reject">重複時は確認する</option><option value="earlier">前の時刻</option><option value="later">後の時刻</option></select></label>}</div>
 <p className="section-note">{manual?'現在の表示: '+offsetLabel(offset):'出生日時の夏時間を含め、ブラウザ内のタイムゾーン情報で計算します。古い年代は記録に合わせてUTC差を直接指定できます。'}</p>
 <details><summary>座標を確認・直接入力</summary><div className="birth-date-row"><label className="field"><span>緯度（北＋）</span><input aria-label="出生地の緯度" type="number" step="any" min="-89" max="89" value={lat} onChange={e=>{setLat(e.target.value);setChosen(null);setManual(true);}} required/></label><label className="field"><span>経度（東＋）</span><input aria-label="出生地の経度" type="number" step="any" min="-180" max="180" value={lon} onChange={e=>{setLon(e.target.value);setChosen(null);setManual(true);}} required/></label></div></details>
 </fieldset>
 {error&&<p role="alert" className="form-error">{error}</p>}
 <button className="birth-submit" type="submit">この出生データで表示</button>
 <p className="section-note">登録不要。入力情報は端末内で計算します。保存は画面下部の設定で選べます。</p>
 </form>;
}
export default function BirthInput(props:any){
 const [open,setOpen]=useState(false);
 return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger className="birth-trigger"><span>出生データを入力</span><small>生年月日・時刻・国と都市から設定</small></DialogTrigger><DialogContent className="birth-dialog"><DialogTitle>出生データ</DialogTitle><DialogDescription>その時、その場所から見た空を表示します。</DialogDescription><BirthForm {...props} onApply={(value:any)=>{props.onApply(value);setOpen(false);}}/></DialogContent></Dialog>;
}
