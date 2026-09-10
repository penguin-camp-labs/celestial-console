import {Switch} from '@/components/ui/switch';
import {ALL_ASPECTS,MAJOR_ASPECTS,PATTERNS} from '@/lib/aspects.mjs';
import {ASTEROIDS} from '@/lib/asteroids.mjs';
export function Toggle({label,value,onChange}:{label:string;value:boolean;onChange:(v:boolean)=>void}){return <label className="toggle-row"><span>{label}</span><Switch checked={value} onCheckedChange={onChange} aria-label={label}/></label>;}
export default function NetworkSettings({settings,setSettings,major,setMajor,minor,setMinor,compound,setCompound,patterns,setPatterns,asteroids,setAsteroids,loading,error,retry}:any){
 const update=(angle:number,patch:any)=>setSettings((old:any)=>({...old,[angle]:{...old[angle],...patch}}));
 return <div className="network-settings">
 <p className="section-note">オーブは基準角度からの許容差です。0°にすると完全一致のみを表示します。</p>
 <Toggle label="主要アスペクト" value={major} onChange={setMajor}/>
 <Toggle label="マイナーアスペクト" value={minor} onChange={setMinor}/>
 <div className="aspect-options"><div className="option-columns"><span>種類 / 表示</span><span>オーブ ±°</span></div>{ALL_ASPECTS.map(a=><div className="aspect-option" key={a.angle}>
 <Toggle label={a.name+' '+a.angle+'°'} value={settings[a.angle].enabled} onChange={v=>update(a.angle,{enabled:v})}/>
 <input type="number" aria-label={a.name+'のオーブ'} min="0" max="10" step=".5" value={settings[a.angle].orb} onChange={e=>{const n=e.target.valueAsNumber;if(Number.isFinite(n)&&n>=0&&n<=10)update(a.angle,{orb:n});}}/>
 </div>)}</div>
 <p className="section-note">種類のスイッチと、その種類が属するグループのスイッチが両方ONのときに通常のラインを表示します。</p>
 <Toggle label="複合アスペクト" value={compound} onChange={setCompound}/>
 <div className="pattern-options">{PATTERNS.map(p=><Toggle key={p.id} label={p.name} value={patterns.includes(p.id)} onChange={v=>setPatterns((old:string[])=>v?[...old,p.id]:old.filter(id=>id!==p.id))}/>)}</div>
 <p className="section-note">複合判定にも上の種類別オーブを使います。通常ラインの種類別ON/OFFとは独立して検出し、構成ラインを金色で表示します。</p>
 <h3>追加天体を選ぶ</h3><p className="section-note">選んだ天体を天球・一覧・アスペクト判定に追加します。</p>
 {loading&&<p role="status" className="section-note">天文データを読み込み中…</p>}
 {error&&<div role="alert"><p>{error}</p><button className="apply-button" onClick={retry}>再読み込み</button></div>}
 <div className="asteroid-options">{ASTEROIDS.map(b=><div key={b.id}><Toggle label={b.name+' / '+b.number} value={asteroids.includes(b.id)} onChange={v=>setAsteroids((old:string[])=>v?[...old,b.id]:old.filter(id=>id!==b.id))}/><small>{b.kind}</small></div>)}</div>
 <p className="section-note">NASA/JPL Horizonsの固定データを使い、1800〜2200年を端末内で補間します。データ読込時にも入力日時・地点は送信しません。現在はこの8天体に対応しています。</p>
 </div>;
}
