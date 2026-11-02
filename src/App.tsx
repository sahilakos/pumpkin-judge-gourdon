import {Component,lazy,Suspense,useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {Bell,CheckCircle2,Clock3,ImageDown,Radio,Video,Skull,WandSparkles,ArrowRight,ArrowUpRight,Check,ChevronRight,Download,ExternalLink,Gavel,Leaf,LoaderCircle,Mic,MonitorUp,Pencil,Play,RotateCcw,Settings2,ShieldCheck,Sparkles,Trophy,Upload,Users,X} from 'lucide-react';
import {categories,csv,displayName,newContest,parseContest,rankTeams,STORAGE_KEY,total,validScore,winners,type Contest,type Scores,type Team} from './contest';
import CarvingClock from './CarvingClock';
import TeamScoreCard from './TeamScoreCard';
import {scorecardPng} from './score-image';
import {validateEmbed,type EmbedConfig} from './runway';
const LiveJudge=lazy(()=>import('./LiveJudge'));
class JudgeFrameBoundary extends Component<{children:ReactNode;onError:(message:string)=>void},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(){this.props.onError('The judge video could not open. Reload the page and try again. Your scores are saved.');}
 render(){return this.state.failed?<div className="loading-stage">The judge connection needs a fresh start.</div>:this.props.children;}
}

type ToolLog={id:string;tool:string;phase:'started'|'success'|'error';message:string;at:string};
type Phase='carve'|'judge'|'results';
type ModalName='roster'|'scores'|'settings'|'transcript'|'activity'|null;
function download(name:string,text:string,type='application/json'){
 const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function Modal({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{ref.current?.showModal();return()=>ref.current?.close();},[]);
 return <dialog ref={ref} className={wide?'modal wide':'modal'} onCancel={onClose} onClose={onClose}>
  <header className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={21}/></button></header>{children}
 </dialog>;
}
function Roster({teams,onSave,onClose}:{teams:Team[];onSave:(teams:Team[])=>void;onClose:()=>void}){
 const [draft,setDraft]=useState(()=>structuredClone(teams));const [error,setError]=useState('');
 function update(index:number,key:string,value:string){setDraft(old=>old.map((t,i)=>{if(i!==index)return t;if(key==='name')return {...t,name:value};const memberIndex=Number(key);return {...t,members:t.members.map((n,j)=>j===memberIndex?value:n)};}));}
 function save(){const names=draft.map(t=>t.name.trim().toLowerCase()).filter(Boolean);if(new Set(names).size!==names.length){setError('Each team needs its own name.');return;}onSave(draft);onClose();}
 return <><p className="modal-intro">Four teams, nine artists. Team names are chosen by the teams themselves. Gourdon can register them during introductions.</p><div className="roster-form">{draft.map((t,i)=><fieldset key={t.id}><legend>TEAM {i+1} · {t.size} ARTISTS</legend><label>Team name<input value={t.name} placeholder="Let the team choose" maxLength={80} onChange={e=>update(i,'name',e.target.value)}/></label><div className="member-inputs">{t.members.map((name,j)=><label key={j}>Artist {j+1}<input value={name} onChange={e=>update(i,String(j),e.target.value)} maxLength={60}/></label>)}</div></fieldset>)}</div>{error?<p className="form-error">{error}</p>:null}<div className="modal-footer"><button className="button ghost" onClick={onClose}>Cancel</button><button className="button primary" onClick={save}>Save teams <Check size={17}/></button></div></>;
}
function ScoreForm({team,index,onSave,onClose}:{team:Team;index:number;onSave:(team:Team)=>void;onClose:()=>void}){
 const [draft,setDraft]=useState(()=>structuredClone(team));const [error,setError]=useState('');
 function save(){
  if(!categories.every(c=>validScore(draft.scores[c.key]))){setError('Enter all four scores as whole numbers from 1 to 10.');return;}
  onSave({...draft,judged:true});onClose();
 }
 return <><p className="modal-intro">Review or record the scores Gourdon announces for <strong>{displayName(team,index)}</strong>. Everyone uses the same four criteria.</p>
 <label className="full-label">Pumpkin’s name <span>(optional)</span><input value={draft.pumpkin} onChange={e=>setDraft({...draft,pumpkin:e.target.value})} maxLength={100} placeholder="What is this masterpiece called?"/></label>
 <div className="score-inputs">{categories.map(c=><label key={c.key}><span><strong>{c.label}</strong><small>{c.hint}</small></span><span className="score-number"><input type="number" min={1} max={10} step={1} aria-label={c.label+' score'} value={draft.scores[c.key]??''} onChange={e=>setDraft({...draft,scores:{...draft.scores,[c.key]:e.target.value===''?null:Number(e.target.value)}})}/><span>/ 10</span></span></label>)}</div>
 <div className="score-total"><span>Total score</span><strong>{total(draft)??'—'} <small>/ 40</small></strong></div>
 <label className="full-label">Gourdon’s comments <span>(optional)</span><textarea value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})} maxLength={2000} placeholder="A detail that stood out, a compliment, a very good pumpkin pun…"/></label>
 {error?<p className="form-error" role="alert">{error}</p>:null}<div className="modal-footer"><button className="button ghost" onClick={onClose}>Cancel</button><button className="button primary" onClick={save}>Save scorecard <Check size={17}/></button></div></>;
}
export default function App(){
 const [phase,setPhase]=useState<Phase>(()=>{const p=localStorage.getItem('pumpkin-court:phase:v1');return p==='judge'||p==='results'?p:'carve';});
 const [contest,setContest]=useState<Contest>(()=>{
  try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)return parseContest(raw);}catch{/* A clean contest remains usable if browser storage is unavailable. */}
  return newContest();
 });
 const [listenOnly,setListenOnly]=useState(false);
 const [judgeOpen,setJudgeOpen]=useState(false);
 const [exporting,setExporting]=useState('');

 const [toolLog,setToolLog]=useState<ToolLog[]>(()=>{try{return JSON.parse(localStorage.getItem('pumpkin-court:tools:v1')||'[]');}catch{return [];}});
 const [storageError,setStorageError]=useState(false);
 const [serverReady,setServerReady]=useState(false);
 const serverContest=useRef<Contest|null>(null);
 const saveQueue=useRef<Promise<void>>(Promise.resolve());
 const [modal,setModal]=useState<ModalName>(null);
 const [scoreIndex,setScoreIndex]=useState(0);
 const [config,setConfig]=useState<EmbedConfig|null>(null);
 const [connectionError,setConnectionError]=useState('');
 const [call,setCall]=useState(false);
 const [starting,setStarting]=useState(false);
 const [callState,setCallState]=useState('idle');
 const [transcript,setTranscript]=useState<string[]>([]);
 const [message,setMessage]=useState('');
 const [resetPending,setResetPending]=useState(false);
 const importRef=useRef<HTMLInputElement>(null);
 const stageRef=useRef<HTMLDivElement>(null);
 const completed=contest.teams.filter(t=>t.judged&&total(t)!==null).length;
 const current=contest.teams[contest.current];
 const ranked=rankTeams(contest.teams);
 const champions=contest.revealed?winners(contest.teams):[];
 useEffect(()=>{
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(contest));}catch{setStorageError(true);}
 },[contest]);
 useEffect(()=>{
  const controller=new AbortController();
  validateEmbed(controller.signal).then(setConfig).catch(e=>{if(e.name!=='AbortError')setConnectionError(e.message||'The connection check could not finish.');});
  return()=>controller.abort();
 },[]);
 useEffect(()=>{
  const events=new EventSource('/api/events');
  const apply=(raw:string)=>{try{const c=parseContest(raw);serverContest.current=c;setContest(c);setServerReady(true);setStorageError(false);}catch{setStorageError(true);}};
  events.addEventListener('contest',event=>apply((event as MessageEvent).data));
  events.addEventListener('tool',event=>{try{const entry=JSON.parse((event as MessageEvent).data) as ToolLog;if(entry.phase==='success'&&['register_team','set_category_score','save_pumpkin_score'].includes(entry.tool))setPhase('judge');setToolLog(old=>[...old.filter(t=>t.id!==entry.id),entry].slice(-60));}catch{}});
  events.addEventListener('notice',event=>{try{setMessage(JSON.parse((event as MessageEvent).data).message);}catch{/* Ignore malformed notices. */}});
  events.onerror=()=>setStorageError(true);
  return()=>events.close();
 },[]);
 useEffect(()=>{try{localStorage.setItem('pumpkin-court:tools:v1',JSON.stringify(toolLog));}catch{}},[toolLog]);
 async function exportImage(index:number|'all',name:string){if(exporting)return;setExporting(name);try{const entries=index==='all'?contest.teams.map((team,index)=>({team,index})):[{team:contest.teams[index],index}];const url=await scorecardPng(entries);const a=document.createElement('a');a.href=url;a.download=name+'.png';a.click();setMessage('Scorecard image downloaded.');}catch{setMessage('The image could not be exported. Please try again.');}finally{setExporting('');}}
 function update(updater:(c:Contest)=>Contest,success?:string){
  saveQueue.current=saveQueue.current.catch(()=>{}).then(async()=>{
   try{
    const base=serverContest.current;if(!base)throw new Error('The local score server is still connecting. Please try again.');
    const next=updater(structuredClone(base));
    const response=await fetch('/api/contest',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':base.updatedAt},body:JSON.stringify(next)});
    const data=await response.json();
    if(!response.ok){if(data.contest){serverContest.current=data.contest;setContest(data.contest);}throw new Error(data.error||'The scorecard could not be saved.');}
    serverContest.current=data;setContest(data);setStorageError(false);if(success)setMessage(success);
   }catch(e){setStorageError(true);setMessage(e instanceof Error?e.message:'The local score server could not save that change.');}
  });
 }
 useEffect(()=>{localStorage.setItem('pumpkin-court:phase:v1',phase);},[phase]);
 useEffect(()=>{if(contest.revealed)setPhase('results');},[contest.revealed]);
 const endCall=useCallback(()=>{setCall(false);setStarting(false);setCallState('idle');void fetch('/api/session/end',{method:'POST'});},[]);
 const failCall=useCallback((text:string)=>{setConnectionError(text);setCall(false);setStarting(false);setCallState('idle');void fetch('/api/session/end',{method:'POST'});},[]);
 const receiveTranscript=useCallback((lines:string[])=>setTranscript(lines),[]);
 const receiveState=useCallback((state:string)=>{setCallState(state);if(state==='active')setStarting(false);},[]);
 async function startCall(preview=false){
  if(starting||call)return;setPhase('judge');setStarting(true);setConnectionError('');
  try{
   const checked=await validateEmbed();setConfig(checked);
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('Use a browser with microphone support on a secure connection.');
   const stream=await navigator.mediaDevices.getUserMedia({audio:true});stream.getTracks().forEach(t=>t.stop());setListenOnly(preview);
   setTranscript([]);setCallState('connecting');setCall(true);
  }catch(e){setStarting(false);setConnectionError(e instanceof DOMException&&e.name==='NotAllowedError'?'Microphone access is blocked. Allow it in your browser, then start again.':e instanceof Error?e.message:'Could not start the judge.');}
 }
 function exportContest(){download('pumpkin-court-backup.json',JSON.stringify(contest,null,2));setMessage('Contest backup downloaded.');}
 async function importContest(file?:File){
  if(!file)return;
  try{const next=parseContest(await file.text());update(()=>next,'Contest restored from your backup.');setModal(null);}catch(e){setMessage(e instanceof Error?e.message:'Could not read that contest file.');}
  if(importRef.current)importRef.current.value='';
 }


 const showDock=call||contest.teams.some(t=>t.judged||t.name||Object.values(t.scores).some(n=>n!==null));
 const finished=contest.teams.map((team,index)=>({team,index})).filter(x=>x.team.judged&&x.team.id!==current.id);
 const lastTool=toolLog.at(-1);
 const card=(team:Team,index:number,active=false)=><TeamScoreCard key={team.id} team={team} index={index} active={active} onEdit={()=>{setScoreIndex(index);setModal('scores');}} onDownload={()=>exportImage(index,displayName(team,index).replace(/[^a-z0-9]/gi,'-')+'-scorecard')}/>;
 return <div className={'app-shell halloween full-frame'+(phase==='carve'?' timer-sky-active':'')}>
  <div className="night-sky" aria-hidden="true"><div className="moon"/>{phase==='carve'?<div className="outer-bat-swarm">{[1,2,3,4,5].map(n=><svg key={n} className={'outer-bat outer-bat-'+n} viewBox="0 0 80 40"><path d="M40 15 35 8 33 16C23 7 10 7 2 3c4 10 5 16 4 25 8-5 15-4 19 3 5-5 10-1 15 6 5-7 10-11 15-6 4-7 11-8 19-3-1-9 0-15 4-25-8 4-21 4-31 13l-2-8z"/></svg>)}</div>:null}<svg className="flying-bats" viewBox="0 0 800 220"><path d="M100 100q15 4 22 18 10-19 23-17-6-16-2-29-16 2-21 15-10-14-26-17 7 15 4 30m480-22q12 4 18 15 8-15 19-14-5-13-2-24-13 2-17 13-8-12-21-14 6 12 3 24"/></svg></div>
  <header className="site-header"><button className="brand brand-button" onClick={()=>{if(!call)setPhase('carve');}}><img src="/pumpkin.svg" alt=""/><span>PUMPKIN COURT<small>THE HALLOWEEN CARVING CHAMPIONSHIP</small></span></button><div className="header-right">{call?<button className="button danger header-end" onClick={endCall}>End judge call</button>:<span className="edition"><span className="pulse-dot"/> NINE ARTISTS · FOUR TEAMS</span>}<button className="icon-button" aria-label="Open host settings" onClick={()=>{setResetPending(false);setModal('settings');}}><Settings2 size={20}/></button></div></header>
  <nav className="phase-nav" aria-label="Competition stages"><button className={phase==='carve'?'selected':''} onClick={()=>setPhase('carve')} disabled={call} aria-current={phase==='carve'?'step':undefined}><span>01</span><Clock3 size={15}/> The carving hour</button><ChevronRight size={14}/><button className={phase==='judge'?'selected':''} onClick={()=>setPhase('judge')} aria-current={phase==='judge'?'step':undefined}><span>02</span><Gavel size={15}/> The judging chamber</button><ChevronRight size={14}/><button className={phase==='results'?'selected':''} onClick={()=>setPhase('results')} aria-current={phase==='results'?'step':undefined}><span>03</span><Trophy size={15}/> The final verdict</button></nav>
  <main className="phase-main">
   <section className="phase-view carving-view" hidden={phase!=='carve'} aria-label="Carving phase">
    <div className="phase-title"><div><p className="eyebrow"><Skull size={13}/> A LITTLE CREATIVITY. A LITTLE SUSPENSE.</p><h1>The <em>carving hour.</em></h1></div><button className="button outline" onClick={()=>setModal('roster')}><Users size={15}/> Meet the teams</button></div>
    <CarvingClock onReadyForJudge={()=>setPhase('judge')}/>
    <div className="creation-bottom"><div><Bell size={17}/><p><strong>A surprise every five minutes.</strong><span>A tiny story, a Halloween fact, and a time check. Gourdon joins later.</span></p></div><button className="button primary" onClick={()=>setPhase('judge')}>Finished carving? Go to judging <ArrowRight size={16}/></button></div>
   </section>
   <section className="phase-view judging-view" hidden={phase!=='judge'} aria-label="Judging phase">
    <div className="phase-title judging-title"><div><p className="eyebrow"><Gavel size={13}/> THE COURT IS IN SESSION</p><h1>Bring forth your <em>masterpiece.</em></h1></div><div className="judging-title-actions"><span className="progress-pill">{completed}/4 judged</span><label className="active-team-picker"><span>At the bench</span><select aria-label="Team at the bench" value={contest.current} onChange={e=>update(c=>({...c,current:Number(e.target.value)}))}>{contest.teams.map((t,i)=><option value={i} key={t.id}>{displayName(t,i)}{t.judged?' · judged':''}</option>)}</select></label></div></div>
    <div className={'judging-workspace '+(showDock?'with-score':'')}>
     <div className="judge-frame-column"><section className="judge-stage" ref={stageRef} aria-label="Judge Gourdon video stage">{call?<JudgeFrameBoundary onError={failCall}><Suspense fallback={<div className="loading-stage"><LoaderCircle className="spin"/><span>The court is opening…</span></div>}><LiveJudge preview={listenOnly} maxDuration={listenOnly?30:config?.maxDuration??1200} onEnd={endCall} onError={failCall} onState={receiveState} onTranscript={receiveTranscript}/></Suspense></JudgeFrameBoundary>:<><img className="judge-portrait" src="/judge-gourdon.png" alt="Judge Gourdon, the pumpkin god and judge"/><div className="stage-start"><div><span className="eyebrow">JUDGE GOURDON</span><p>{config?'Ready when the artists are.':'Checking your Runway connection…'}</p></div><button className="button primary" disabled={starting} onClick={()=>void startCall()}>{starting?<LoaderCircle size={17} className="spin"/>:<WandSparkles size={17}/>} {starting?'Opening the court…':'Summon Judge Gourdon'}</button></div></>}
      {call&&callState!=='active'?<div className="connection-overlay" role="status"><LoaderCircle size={28} className="spin"/><strong>Gourdon is taking his seat…</strong><span>This can take a moment.</span><button className="button outline" onClick={endCall}>Cancel connection</button></div>:null}
     </section><div className="stage-footnote"><span><Mic size={12}/> Speak naturally</span><span><Video size={12}/> Camera on to show your pumpkin</span><button className="text-button" onClick={()=>setModal('transcript')} disabled={transcript.length===0}>Conversation <ArrowUpRight size={12}/></button></div></div>
     {showDock?<aside className="active-score-dock" aria-label="Current team live scorecard"><div className="dock-label"><span className="pulse-dot"/> LIVE VERDICT <span>TEAM {contest.current+1}</span></div>{card(current,contest.current,true)}</aside>:null}
    </div>
    {connectionError?<div className="connection-error" role="alert"><span>{connectionError}</span><button className="text-button" onClick={()=>void startCall()} disabled={starting}>Try again</button></div>:null}
    <div className="completed-team-strip"><div className="completed-strip-title"><CheckCircle2 size={15}/><span>FINISHED<br/>PUMPKINS</span></div>{finished.length>0?<div className="completed-team-cards">{finished.map(({team,index})=><button key={team.id} className="completed-team-card" onClick={()=>{setScoreIndex(index);setModal('scores');}}><span className="completed-card-index">0{index+1}</span><div><strong>{displayName(team,index)}</strong><small>{team.members.join(' · ')}</small></div><span className="completed-card-total">{total(team)}<small>/40</small></span><CheckCircle2 size={14}/></button>)}</div>:<p className="completed-empty">Finished scorecards move here as the next team steps forward.</p>}<button className="text-button strip-export" onClick={()=>exportImage('all','pumpkin-court-all-scorecards')}><ImageDown size={14}/> Save all</button></div>
    <button className="live-action-bar" onClick={()=>setModal('activity')}><Radio size={14}/><span>LIVE ACTIONS</span>{lastTool?<><code>{lastTool.tool}</code><p>{lastTool.message}</p>{lastTool.phase==='started'?<LoaderCircle className="spin" size={14}/>:<Check size={14}/>}</>:<p>Team names and scores will appear here as Gourdon calls his tools.</p>}<ChevronRight size={15}/></button>
   </section>
   <section className="phase-view results-view" hidden={phase!=='results'} aria-label="Results phase">
    <div className="phase-title"><div><p className="eyebrow"><Trophy size={13}/> THE FINAL VERDICT</p><h1>{contest.revealed?'All hail the ':'The crown '}<em>{contest.revealed?'grand gourd.':'awaits.'}</em></h1><p className="winner-caption">{contest.revealed?champions.map(t=>displayName(t,contest.teams.findIndex(x=>x.id===t.id))).join(' & ')+(champions.length>1?' share the crown.':' takes the crown.'):completed<4?'Preview the scorecards. Scores appear here as Gourdon judges each pumpkin.':'Four scorecards. One fair verdict. Gourdon announces the winner.'}</p></div><div className="results-actions">{!contest.revealed?<button className="button primary" disabled={completed!==4} onClick={()=>update(c=>({...c,revealed:true}))}>Reveal the winner <Sparkles size={15}/></button>:null}<button className="button outline" onClick={()=>exportImage('all','pumpkin-court-all-scorecards')}><ImageDown size={15}/> Download all</button></div></div>
    <div className="results-card-grid">{contest.teams.map((team,index)=>card(team,index))}</div>
   </section>
  </main>
  <footer className="frame-footer"><span><ShieldCheck size={12}/>{storageError?'Saving needs attention — download a backup.':serverReady?'Scores saved in this browser & on this computer.':'Connecting to the local score server…'}</span><span>THE MIDNIGHT PUMPKIN COURT <span>✦</span> HALLOWEEN EDITION</span></footer>
  {message?<div className="toast" role="status"><span>{message}</span><button className="icon-button" onClick={()=>setMessage('')} aria-label="Dismiss notification"><X size={16}/></button></div>:null}
  <input hidden ref={importRef} type="file" accept=".json,application/json" onChange={e=>void importContest(e.target.files?.[0])}/>
  {modal==='activity'?<Modal title="Gourdon’s spellbook" onClose={()=>setModal(null)} wide><p className="modal-intro">Real tool calls from this competition. Scores are saved before success is shown.</p><div className="tool-events">{toolLog.slice().reverse().map(event=><div className={'tool-event '+event.phase} key={event.id}><span className="tool-event-icon">{event.phase==='started'?<LoaderCircle className="spin" size={16}/>:event.phase==='error'?<X size={16}/>:<Check size={16}/>}</span><div><code>{event.tool}</code><p>{event.message}</p></div><time>{new Date(event.at).toLocaleTimeString()}</time></div>)}</div></Modal>:null}
  {modal==='roster'?<Modal title="The creatures of the court" onClose={()=>setModal(null)}><Roster teams={contest.teams} onSave={teams=>update(c=>({...c,teams}))} onClose={()=>setModal(null)}/></Modal>:null}
  {modal==='scores'?<Modal title={displayName(contest.teams[scoreIndex],scoreIndex)+' · scorecard'} onClose={()=>setModal(null)}><ScoreForm team={contest.teams[scoreIndex]} index={scoreIndex} onSave={team=>update(c=>({...c,teams:c.teams.map(t=>t.id===team.id?team:t)}),'Scorecard saved on this computer.')} onClose={()=>setModal(null)}/></Modal>:null}
  {modal==='transcript'?<Modal title="Voices from the court" onClose={()=>setModal(null)} wide><p className="modal-intro">This call’s conversation. Download it before leaving to keep a copy.</p><div className="transcript">{transcript.map((text,i)=><p key={i}>{text}</p>)}</div><div className="modal-footer"><button className="button primary" onClick={()=>download('gourdon-conversation.txt',transcript.join('\n\n'),'text/plain')}>Download conversation <Download size={16}/></button></div></Modal>:null}
  {modal==='settings'?<Modal title="The keeper’s desk" onClose={()=>setModal(null)}>
   <p className="modal-intro">The carving clock and Halloween interludes run on this device. Gourdon is summoned separately when you’re ready to score.</p><div className="settings-info"><span className="ready-dot"/><div><strong>Judge Gourdon · Runway SDK</strong><p>{config?'Account connection verified':'Connection needs checking'} · {Math.round((config?.maxDuration??1200)/60)} minute judge call</p></div><a className="icon-button" href={config?.characterUrl||'https://dev.runway.com/'} target="_blank" rel="noreferrer" aria-label="Open Judge Gourdon in Runway"><ExternalLink size={18}/></a></div>
   <h3 className="settings-heading">Check the judge’s sound & frame</h3><p className="settings-note">A 30-second call using your microphone, with your camera off initially. Gourdon speaks a sound check. If prompted, click Enable judge sound.</p><button className="button outline" disabled={call||starting} onClick={()=>{setModal(null);setJudgeOpen(true);void startCall(true);}}><Video size={16}/> Test judge sound & video</button><h3 className="settings-heading">Keep your scorecards</h3><p className="settings-note">Tool calls update names and scores live. Scorecards are saved in this browser and in a file on this computer. New judge calls load the saved roster and scores. No repository or hosted deployment is used.</p><div className="settings-actions"><button className="button outline" onClick={exportContest}><Download size={17}/> Download backup</button><button className="button outline" onClick={()=>importRef.current?.click()} disabled={call}><Upload size={17}/> Restore backup</button><button className="button outline" onClick={()=>download('pumpkin-court-results.csv',csv(contest),'text/csv;charset=utf-8')}><Download size={17}/> Scores as CSV</button></div>
   <div className="reset-area">{resetPending?<><p>Start a fresh contest? Download a backup first if you want to keep these scores. The carving clock has a separate reset.</p><div className="settings-actions"><button className="button ghost" onClick={()=>setResetPending(false)}>Keep this contest</button><button className="button danger" onClick={()=>{update(()=>newContest(),'A fresh contest is ready.');setPhase('carve');setToolLog([]);setTranscript([]);setModal(null);}}>Start a fresh contest</button></div></>:<button className="text-button" disabled={call} onClick={()=>setResetPending(true)}><RotateCcw size={15}/> Start a fresh contest</button>}</div>
  </Modal>:null}

 </div>;
}
