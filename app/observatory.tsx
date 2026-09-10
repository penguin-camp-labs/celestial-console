'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Play,Pause,SkipBack,SkipForward,RotateCcw,SlidersHorizontal,Info,ShieldCheck,ArrowRight,ChevronRight,Maximize2,Clock3} from 'lucide-react';
import {Slider} from '@/components/ui/slider';
import {Switch} from '@/components/ui/switch';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Dialog,DialogTrigger,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Table,TableHeader,TableRow,TableHead,TableBody,TableCell} from '@/components/ui/table';
import Sky from './sky';
import {DAY,MIN_TIME,MAX_TIME,BODIES,ASPECTS,calculate,clampTime,validTime,localInput,parseInput,signPosition,validateSaved} from '@/lib/engine.mjs';
const STORAGE='celestial.observatory.v1';
const PLACES=[{id:'tokyo',name:'東京',lat:35.6812,lon:139.7671},{id:'osaka',name:'大阪',lat:34.6937,lon:135.5023},{id:'sapporo',name:'札幌',lat:43.0618,lon:141.3545},{id:'london',name:'ロンドン',lat:51.5074,lon:-.1278},{id:'ny',name:'ニューヨーク',lat:40.7128,lon:-74.006},{id:'sydney',name:'シドニー',lat:-33.8688,lon:151.2093}];
function Choice({label,value,onChange,items}: {label:string;value:string;onChange:(v:string)=>void;items:{value:string;label:string}[]}){
 return <Select value={value} onValueChange={v=>v!==null&&onChange(String(v))}><SelectTrigger aria-label={label} className="choice"><SelectValue>{items.find(i=>i.value===value)?.label??value}</SelectValue></SelectTrigger><SelectContent>{items.map(i=><SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent></Select>;
}
function Toggle({label,value,onChange}:{label:string;value:boolean;onChange:(v:boolean)=>void}){return <label className="toggle-row"><span>{label}</span><Switch checked={value} onCheckedChange={onChange} aria-label={label}/></label>;}
export default function Home(){
 const [time,setTime]=useState(Date.UTC(2026,8,10)),[anchor,setAnchor]=useState(Date.UTC(2026,8,10)),[ready,setReady]=useState(false);
 const [offset,setOffset]=useState(540),[offsetDraft,setOffsetDraft]=useState('9'),[dateDraft,setDateDraft]=useState(''),[dirty,setDirty]=useState(false);
 const [latitude,setLatitude]=useState(35.6812),[longitude,setLongitude]=useState(139.7671),[latDraft,setLatDraft]=useState('35.6812'),[lonDraft,setLonDraft]=useState('139.7671');
 const [playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1),[direction,setDirection]=useState(1),[span,setSpan]=useState(30);
 const [flat,setFlat]=useState(false),[showAspects,setShowAspects]=useState(true),[grid,setGrid]=useState(true),[horizon,setHorizon]=useState(true),[houses,setHouses]=useState(false),[houseSystem,setHouseSystem]=useState('equal');
 const [orb,setOrb]=useState(6),[selected,setSelected]=useState<string|null>(null),[reset,setReset]=useState(0),[fps,setFps]=useState(0),[reduced,setReduced]=useState(false),[persist,setPersist]=useState(false),[message,setMessage]=useState('');
 const actionRef=useRef<(t:number)=>void>(()=>{}),timeRef=useRef(time);timeRef.current=time;
 const setInstant=useCallback((t:number)=>{setPlaying(false);setTime(clampTime(t));setAnchor(clampTime(t));setDirty(false);setMessage('');},[]);
 actionRef.current=setInstant;
 useEffect(()=>{
  let t=Date.now(),lat=35.6812,lon=139.7671,o=-new Date().getTimezoneOffset();
  try{const raw=localStorage.getItem(STORAGE);if(raw){const saved=validateSaved(JSON.parse(raw));if(saved){({time:t,latitude:lat,longitude:lon,offset:o}=saved);setPersist(true);}else{localStorage.removeItem(STORAGE);setMessage('保存内容を読み込めなかったため、現在日時で開始しました。');}}}catch{setMessage('ブラウザ内の保存を利用できません。保存なしで使えます。');}
  setTime(clampTime(t));setAnchor(clampTime(t));setLatitude(lat);setLongitude(lon);setLatDraft(String(lat));setLonDraft(String(lon));setOffset(o);setOffsetDraft(String(o/60));setReady(true);
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');setReduced(media.matches);const change=()=>setReduced(media.matches);media.addEventListener('change',change);
  return()=>media.removeEventListener('change',change);
 },[]);
 useEffect(()=>{if(!dirty)setDateDraft(localInput(time,offset));},[time,offset,dirty]);
 useEffect(()=>{if(!ready||!persist)return;const id=setTimeout(()=>{try{localStorage.setItem(STORAGE,JSON.stringify({version:1,time,latitude,longitude,offset}));}catch{setPersist(false);setMessage('保存できませんでした。ブラウザの保存容量・設定を確認してください。');}},500);return()=>clearTimeout(id);},[time,latitude,longitude,offset,persist,ready]);
 const toggleSave=(v:boolean)=>{setPersist(v);if(!v){try{localStorage.removeItem(STORAGE);setMessage('このアプリの保存データを削除しました。');}catch{setMessage('保存データを削除できません。ブラウザのサイトデータ設定から削除してください。');}}};
 useEffect(()=>{
  if(!playing)return;let last=performance.now();
  const id=setInterval(()=>{const now=performance.now(),dt=Math.min((now-last)/1000,.25);last=now;if(document.hidden)return;setTime(t=>{const next=clampTime(t+dt*DAY*speed*direction);if(next===MIN_TIME||next===MAX_TIME)setPlaying(false);return next;});},100);
  const hidden=()=>{last=performance.now();};document.addEventListener('visibilitychange',hidden);
  return()=>{clearInterval(id);document.removeEventListener('visibilitychange',hidden);};
 },[playing,speed,direction]);
 useEffect(()=>{if(playing&&Math.abs(time-anchor)>span*DAY)setAnchor(time);},[time,anchor,span,playing]);
 useEffect(()=>{
  const context=(document as any).modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();
  try{Promise.resolve(context.registerTool({name:'set_observation_time',description:'Set this local horoscope to an ISO 8601 time with explicit timezone. No data is sent or saved unless local saving was enabled in the UI.',inputSchema:{type:'object',properties:{datetime:{type:'string'}},required:['datetime'],additionalProperties:false},annotations:{readOnlyHint:false},async execute(input:any){
   if(!input||Object.keys(input).length!==1||typeof input.datetime!=='string'||!/(Z|[+-]\d\d:\d\d)$/.test(input.datetime))throw Error('An ISO datetime with timezone is required.');
   const match=input.datetime.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)(Z|[+-]\d{2}:\d{2})$/);if(!match)throw Error('Use a complete ISO datetime with timezone.');const zone=match[2],o=zone==='Z'?0:(zone[0]==='-'?-1:1)*(Number(zone.slice(1,3))*60+Number(zone.slice(4)));if(zone!=='Z'&&Number(zone.slice(4))>=60)throw Error('Invalid timezone offset.');const t=parseInput(match[1],o);actionRef.current(t);
   await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
   return {datetime:new Date(timeRef.current).toISOString(),storage:'local browser only'};
  }},{signal:lifecycle.signal})).catch(()=>{});}catch{}
  return()=>lifecycle.abort();
 },[]);
 const chart=useMemo(()=>calculate(time,latitude,longitude,orb),[time,latitude,longitude,orb]);
 const body=chart.bodies.find((b:any)=>b.id===selected),visibleAspects=chart.aspects.filter((a:any)=>!selected||a.a===selected||a.b===selected);
 const fpsUpdate=useCallback((v:number)=>setFps(v),[]);
 const iso=localInput(time,offset),dateLabel=iso.slice(0,10).replaceAll('-','.'),clockLabel=iso.slice(11,19);
 const utcLabel='UTC'+(offset>=0?'+':'−')+String(Math.floor(Math.abs(offset)/60)).padStart(2,'0')+':'+String(Math.abs(offset)%60).padStart(2,'0');
 const applyDate=(e:React.FormEvent)=>{e.preventDefault();try{const h=Number(offsetDraft);if(!offsetDraft.trim()||!Number.isFinite(h)||h < -12||h > 14||!Number.isInteger(h*60))throw Error('UTC差は−12〜14時間で入力してください。');const o=Math.round(h*60),t=parseInput(dateDraft,o);setOffset(o);setInstant(t);}catch(e){setMessage((e as Error).message);}};
 const applyLocation=(e:React.FormEvent)=>{e.preventDefault();const lat=Number(latDraft),lon=Number(lonDraft);if(!latDraft.trim()||!lonDraft.trim()||!Number.isFinite(lat)||Math.abs(lat)>89||!Number.isFinite(lon)||Math.abs(lon)>180){setMessage('緯度は−89〜89°、経度は−180〜180°で入力してください。');return;}setLatitude(lat);setLongitude(lon);setMessage('観測地点を更新しました。');};
 const preset=PLACES.find(p=>p.lat===latitude&&p.lon===longitude)?.id??'custom';
 const resetNow=()=>setInstant(Date.now());
 return <main className="observatory">
  <header className="mast"><a className="brand" href="/" aria-label="CELESTIAL ホーム"><span className="brand-mark">◎</span>CELESTIAL<span className="brand-sub">天球ホロスコープ</span></a><div className="mast-right"><span className="status"><i/> LOCAL COMPUTATION</span><Dialog><DialogTrigger className="icon-button" aria-label="使い方とプライバシー"><Info size={19}/></DialogTrigger><DialogContent className="help-dialog"><DialogTitle>空を読むためのガイド</DialogTitle><DialogDescription>3Dと2Dは、同じ天体の配置を違う視点で表示しています。</DialogDescription><div className="help-copy"><p><strong>天球を探る</strong><br/>ドラッグで回転、ホイールまたはピンチで拡大。天体を選ぶと関連するアスペクトが強調されます。描画領域にフォーカスすると矢印キーで回転、＋／−で拡大縮小できます。</p><p><strong>2D ↔ 3D</strong><br/>3Dでは地球から見た方向を同じ半径の球に配置します。2Dでは黄緯を0°に投影し、ASCを左にした円形図になります。天体の大きさ、背景の星は模式表現です。</p><p><strong>計算条件</strong><br/>地球中心・トロピカル黄道。Astronomy Engineで太陽から冥王星までを計算します。目標精度は角度約1分。アスペクトは黄経差で判定し、詳細欄の「天球上の角距離」と区別します。ハウスはイコールまたはホールサインの黄道上の境界です。</p><p><strong>日時と地点</strong><br/>1800〜2200年。UTC差は固定値なので、出生地の当時の夏時間などを含む値を指定してください。地点は地平線・ASC・MCに反映されます。緯度の対応範囲は±89°です。</p><p><strong>プライバシー</strong><br/>日時・地点は端末内で計算し、アプリのサーバーへ送信しません。登録、広告、アクセス解析、外部フォントはありません。保存は初期状態ではオフ。有効にした場合のみ、このブラウザのlocalStorageに日時・地点・UTC差を保存します。オフにするとこのアプリの保存データを削除します。共用端末では保存をオフにしてください。ページの配信事業者には通常の接続情報が伝わります。</p><p>自動再生は別タブを見ている間は進みません。OSの動きを減らす設定にも対応します。</p><p className="credits">計算: <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noopener noreferrer">Astronomy Engine</a> · 描画: <a href="https://threejs.org/" target="_blank" rel="noopener noreferrer">Three.js</a></p></div></DialogContent></Dialog></div></header>
  <div className="workspace">
   <section className="stage" aria-label="天球ビュー">
    <div className="scene-heading"><p className="eyebrow">GEOCENTRIC OBSERVATORY / 01</p><h1>空を、立体で読み解く。</h1><p>地球中心 <span> / </span> トロピカル黄道</p></div>
    <div className="view-toggle" role="group" aria-label="表示形式"><button onClick={()=>setFlat(false)} aria-pressed={!flat}>3D <span>天球</span></button><button onClick={()=>setFlat(true)} aria-pressed={flat}>2D <span>ホロスコープ</span></button></div>
    {ready&&<Sky chart={chart} flat={flat} aspects={showAspects} grid={grid} horizon={horizon} houses={houses} houseSystem={houseSystem} selected={selected} onSelect={setSelected} reset={reset} reduced={reduced} onFps={fpsUpdate} onFlat={()=>setFlat(true)}/>}
    <div className="axis-readout" aria-label="アングル"><div><span>ASC</span><b>{chart.asc.toFixed(2)}<small>°</small></b></div><div><span>MC</span><b>{chart.mc.toFixed(2)}<small>°</small></b></div><div><span>LST</span><b>{(chart.lst/15).toFixed(3)}<small>h</small></b></div></div>
    <div className="scene-tools"><button className="icon-button" onClick={()=>setReset(v=>v+1)} aria-label="視点をリセット" title="視点をリセット"><RotateCcw size={17}/></button><Dialog><DialogTrigger className="icon-button" aria-label="表示設定" title="表示設定"><SlidersHorizontal size={18}/></DialogTrigger><DialogContent className="settings-dialog"><DialogTitle>表示設定</DialogTitle><DialogDescription>見たい情報を、天球に重ねる。</DialogDescription><Toggle label="アスペクト" value={showAspects} onChange={setShowAspects}/><Toggle label="天球グリッド・赤道" value={grid} onChange={setGrid}/><Toggle label="地平線・ASC・MC" value={horizon} onChange={setHorizon}/><Toggle label="ハウスの境界（黄道上）" value={houses} onChange={setHouses}/><Choice label="ハウス方式" value={houseSystem} onChange={setHouseSystem} items={[{value:'equal',label:'イコール / ASC起点'},{value:'whole',label:'ホールサイン'}]}/><div className="setting-orb"><label>アスペクトのオーブ <b>{orb.toFixed(1)}°</b></label><Slider aria-label="アスペクトのオーブ" min={0} max={10} step={.5} value={[orb]} onValueChange={v=>setOrb(Array.isArray(v)?v[0]:v)}/></div><Toggle label="アニメーションを控えめに" value={reduced} onChange={setReduced}/></DialogContent></Dialog></div>
    <div className="scene-caption"><span><i className="crosshair"/> {flat?'ECLIPTIC PROJECTION':'CELESTIAL SPHERE'} <span className="dim"> / </span> {fps||'—'} FPS</span><span>{selected?'天体の選択を解除するには空白をクリック':'ドラッグで回転 · スクロールで拡大'}</span></div>
    <div className="scene-legend"><span><i style={{background:'#83bfff'}}/>120°</span><span><i style={{background:'#ff917e'}}/>90°</span><span><i style={{background:'#eba8c2'}}/>180°</span><span><i style={{background:'#76e1c4'}}/>60°</span><span><i style={{background:'#ecd0fa'}}/>0°</span></div>
   </section>
   <aside className="telemetry">
    <div className="telemetry-heading"><span className="eyebrow">EPHEMERIS</span><span className="tag">10 BODIES</span></div>
    <div className="planet-table"><Table><TableHeader><TableRow><TableHead>天体</TableHead><TableHead>黄経 / サイン</TableHead><TableHead>運行</TableHead></TableRow></TableHeader><TableBody>{chart.bodies.map((b:any)=><TableRow key={b.id} data-selected={selected===b.id}><TableCell><button className="planet-button" onClick={()=>setSelected(selected===b.id?null:b.id)} aria-pressed={selected===b.id}><span style={{color:b.color}}>{b.symbol}</span>{b.name}</button></TableCell><TableCell className="position-cell">{signPosition(b.lon)}</TableCell><TableCell className={b.speed<0?'retro':'dim'}>{b.speed<0?'R':'D'}</TableCell></TableRow>)}</TableBody></Table></div>
    {body&&<div className="body-detail"><div><b style={{color:body.color}}>{body.symbol} {body.name}</b><button onClick={()=>setSelected(null)} aria-label="天体の選択を解除">×</button></div><dl><dt>黄経</dt><dd>{body.lon.toFixed(4)}°</dd><dt>黄緯</dt><dd>{body.lat.toFixed(4)}°</dd><dt>日速度</dt><dd>{body.speed.toFixed(4)}° / 日</dd><dt>地球からの距離</dt><dd>{body.distance.toFixed(5)} AU</dd></dl></div>}
    <div className="aspect-heading"><span className="eyebrow">ASPECT NETWORK</span><span className="tag">{visibleAspects.length} LINKS</span></div>
    <p className="section-note">黄経差で判定 · オーブ ±{orb}°</p>
    <div className="aspect-list">{visibleAspects.length?visibleAspects.map((a:any)=>{const left=BODIES.find((b:any)=>b.id===a.a)!,right=BODIES.find((b:any)=>b.id===a.b)!;return <div className="aspect-item" key={a.a+a.b}><div className="aspect-pair"><button onClick={()=>setSelected(a.a)} aria-label={left.name+'を選択'}>{left.symbol}</button><span style={{color:a.color}} title={a.name}>{a.symbol}</span><button onClick={()=>setSelected(a.b)} aria-label={right.name+'を選択'}>{right.symbol}</button></div><div className="aspect-info"><span>{a.name} <b>{a.angle}°</b></span><small>オーブ {a.orb.toFixed(2)}°{selected&&' / 天球 '+a.skyAngle.toFixed(2)+'°'}</small></div><div className="orb-meter"><i style={{width:Math.max(3,(1-a.orb/Math.max(orb,.001))*100)+'%',background:a.color}}/></div></div>;}):<p className="section-note">指定オーブ内のアスペクトはありません。</p>}</div>
   </aside>
  </div>
  <section className="timeline" aria-label="時間操作">
   <div className="time-top"><div className="time-display"><span className="eyebrow">{playing?'TIME IN MOTION':'OBSERVATION TIME'} <span className="dim">{utcLabel}</span></span><div><span className="date-number">{dateLabel}</span><time dateTime={new Date(time).toISOString()}>{clockLabel}</time></div></div><div className="transport"><button className="icon-button" onClick={()=>setInstant(time-DAY)} aria-label="1日前"><SkipBack size={19}/></button><button className="play-button" onClick={()=>{setDirty(false);setPlaying(v=>!v);}} aria-label={playing?'一時停止':'自動再生'} aria-pressed={playing}>{playing?<Pause size={20}/>:<Play size={20}/>}</button><button className="icon-button" onClick={()=>setInstant(time+DAY)} aria-label="1日後"><SkipForward size={19}/></button><button className="now-button" onClick={resetNow}><Clock3 size={16}/>今</button><Choice label="再生方向" value={String(direction)} onChange={v=>setDirection(Number(v))} items={[{value:'1',label:'未来へ →'},{value:'-1',label:'← 過去へ'}]}/><Choice label="再生速度" value={String(speed)} onChange={v=>setSpeed(Number(v))} items={[{value:String(1/24),label:'1時間 / 秒'},{value:'1',label:'1日 / 秒'},{value:'7',label:'1週 / 秒'},{value:'30',label:'30日 / 秒'},{value:'365',label:'1年 / 秒'}]}/></div></div>
   <div className="rail-wrap"><div className="rail-ticks" aria-hidden="true">{Array.from({length:41},(_,i)=><i key={i} className={i%5===0?'major':''}/>)}</div><Slider className="time-slider" aria-label="観測日時のスライダー" min={Math.max(-span,(MIN_TIME-anchor)/DAY)} max={Math.min(span,(MAX_TIME-anchor)/DAY)} step={1/1440} value={[(time-anchor)/DAY]} onValueChange={v=>{setPlaying(false);setDirty(false);setTime(clampTime(anchor+(Array.isArray(v)?v[0]:v)*DAY));}}/><div className="rail-labels"><span>{localInput(clampTime(anchor-span*DAY),offset).slice(0,10)}</span><button className="anchor-button" onClick={()=>setAnchor(time)}>現在の表示を中心に</button><span>{localInput(clampTime(anchor+span*DAY),offset).slice(0,10)}</span></div></div>
   <div className="timeline-bottom"><span className="section-note">スライダーを動かして、過去と未来を探る。</span><div className="range-control"><span>時間幅</span><Choice label="スライダーの時間幅" value={String(span)} onChange={v=>{setSpan(Number(v));setAnchor(time);}} items={[{value:'1',label:'±1日'},{value:'30',label:'±30日'},{value:'365',label:'±1年'},{value:'3650',label:'±10年'}]}/></div></div>
  </section>
  <section className="conditions" aria-label="観測条件">
   <div className="condition-block"><span className="eyebrow">01 / DATE & TIME</span><form onSubmit={applyDate}><label className="field"><span>年月日・時刻</span><input type="datetime-local" step="1" min="1800-01-01T00:00:00" max="2200-12-31T23:59:59" value={dateDraft} onChange={e=>{setDirty(true);setDateDraft(e.target.value);setPlaying(false);}} required/></label><label className="field offset-field"><span>UTC差（時間）</span><input type="number" min="-12" max="14" step=".25" value={offsetDraft} onChange={e=>setOffsetDraft(e.target.value)}/></label><button type="submit" className="apply-button">適用 <ArrowRight size={16}/></button></form><p className="section-note">当時の夏時間を含むUTC差を指定してください。</p></div>
   <div className="condition-block"><span className="eyebrow">02 / OBSERVER</span><div className="location-preset"><Choice label="観測地点のプリセット" value={preset} onChange={v=>{const p=PLACES.find(p=>p.id===v);if(p){setLatitude(p.lat);setLongitude(p.lon);setLatDraft(String(p.lat));setLonDraft(String(p.lon));}}} items={[...PLACES.map(p=>({value:p.id,label:p.name})),{value:'custom',label:'座標を指定'}]}/><span className="section-note">地平線・アングルの基準地点</span></div><form onSubmit={applyLocation}><label className="field"><span>緯度（北＋）</span><input type="number" step="any" min="-89" max="89" value={latDraft} onChange={e=>setLatDraft(e.target.value)} required/></label><label className="field"><span>経度（東＋）</span><input type="number" step="any" min="-180" max="180" value={lonDraft} onChange={e=>setLonDraft(e.target.value)} required/></label><button className="apply-button" type="submit">適用 <ArrowRight size={16}/></button></form></div>
  </section>
  <footer className="privacy-footer"><div><ShieldCheck size={17}/><span>入力情報は端末内で処理</span></div><Toggle label="このブラウザに日時・地点を保存" value={persist} onChange={toggleSave}/><span className="version">CELESTIAL / 1.0</span></footer>
  {message&&<div role="status" className="notice"><span>{message}</span><button aria-label="通知を閉じる" onClick={()=>setMessage('')}>×</button></div>}
 </main>;
}
