import {useEffect,useRef,useState} from 'react';
import {Bell,ChevronRight,Clock3,Pause,Play,RotateCcw,Volume2,VolumeX,X} from 'lucide-react';
import {announcementText,CLOCK_KEY,displayTime,dueAnnouncement,freshClock,HOUR,INTERVAL,interludes,pauseClock,restoreClock,startClock,timeLeft,type Clock} from './clock';
export default function CarvingClock({onReadyForJudge}:{onReadyForJudge:()=>void}){
 const [clock,setClock]=useState<Clock>(()=>{try{const raw=localStorage.getItem(CLOCK_KEY);if(raw)return restoreClock(raw);}catch{}return freshClock();});
 const [now,setNow]=useState(Date.now());
 const [announcement,setAnnouncement]=useState<number|null>(null);
 const [reset,setReset]=useState(false);
 const [audioAvailable]=useState(()=>typeof window!=='undefined'&&typeof Audio!=='undefined');
 const player=useRef<HTMLAudioElement|null>(null);
 const playAttempt=useRef(0);
 const [soundBlocked,setSoundBlocked]=useState(false);
 const spoken=useRef(0);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),500);return()=>clearInterval(timer);},[]);
 useEffect(()=>{try{localStorage.setItem(CLOCK_KEY,JSON.stringify(clock));}catch{}},[clock]);
 function stopSound(){
  playAttempt.current++;
  if(player.current){player.current.pause();player.current.currentTime=0;}
  if('speechSynthesis'in window)speechSynthesis.cancel();
 }
 function say(text:string,clip?:number|'start'){
  if(!clock.audio||!audioAvailable)return;
  stopSound();
  const attempt=playAttempt.current;
  const fallback=()=>{
   if(attempt!==playAttempt.current||!('speechSynthesis'in window))return;
   const voice=new SpeechSynthesisUtterance(text);voice.rate=.97;voice.pitch=.85;voice.volume=1;
   const local=speechSynthesis.getVoices().find(v=>v.localService&&/^en[-_]/i.test(v.lang));if(local)voice.voice=local;
   speechSynthesis.speak(voice);
  };
  if(clip===undefined){fallback();return;}
  const audio=player.current??(player.current=new Audio());
  audio.src='/herald/'+(clip==='start'?'start':String(clip).padStart(2,'0'))+'.mp3';
  audio.volume=1;
  void audio.play().then(()=>{if(attempt===playAttempt.current)setSoundBlocked(false);}).catch(error=>{
   if(attempt!==playAttempt.current)return;
   if(error instanceof DOMException&&error.name==='NotAllowedError'){setSoundBlocked(true);return;}
   fallback();
  });
 }
 useEffect(()=>{
  const index=dueAnnouncement(clock,now);
  if(!index||spoken.current===index)return;
  spoken.current=index;setAnnouncement(index);
  setClock(c=>({...c,lastAnnouncement:index,history:[...c.history,{index,text:announcementText(index,timeLeft(clock,now)),time:now}],...(index===12?{status:'finished' as const,remaining:0,deadline:null}:{})}));
  say(announcementText(index,timeLeft(clock,now)),index);
 },[now,clock]);
 useEffect(()=>{if(!announcement)return;const timer=setTimeout(()=>setAnnouncement(null),18000);return()=>clearTimeout(timer);},[announcement]);
 useEffect(()=>()=>{stopSound();},[]);
 useEffect(()=>{if(!clock.audio)stopSound();},[clock.audio]);
 const remaining=timeLeft(clock,now);
 const elapsed=HOUR-remaining;
 const next=clock.status==='finished'?0:INTERVAL-(elapsed%INTERVAL);
 const started=clock.status!=='ready';
 return <section className={'carving-clock phase-'+clock.status} aria-label="One-hour pumpkin carving competition">
  <div className="timer-atmosphere" aria-hidden="true">{[1,2,3].map(n=><svg key={n} className={'timer-bat timer-bat-'+n} viewBox="0 0 80 40"><path d="M40 15 35 8 33 16C23 7 10 7 2 3c4 10 5 16 4 25 8-5 15-4 19 3 5-5 10-1 15 6 5-7 10-11 15-6 4-7 11-8 19-3-1-9 0-15 4-25-8 4-21 4-31 13l-2-8z"/></svg>)}</div>
  <div className="moon-decoration" aria-hidden="true"/>
  <div className="clock-heading"><span className="eyebrow"><span className="pulse-dot"/>{clock.status==='ready'?'THE PUMPKIN PATCH AWAITS':clock.status==='finished'?'THE CARVING HOUR IS COMPLETE':clock.status==='paused'?'THE PATCH IS TAKING A BREATHER':'THE CARVING HOUR'}</span><button className="sound-toggle" onClick={()=>setClock(c=>({...c,audio:!c.audio}))} aria-label={clock.audio?'Mute Halloween announcements':'Enable Halloween announcements'} title={clock.audio?'Announcements sound on':'Announcements sound off'}>{clock.audio?<Volume2 size={17}/>:<VolumeX size={17}/>}<span>{clock.audio?'Sound on':'Sound off'}</span></button></div>
  <div className="clock-core"><p className="clock-overline">{clock.status==='ready'?'ONE HOUR TO CREATE YOUR MASTERPIECE':clock.status==='finished'?'LET THE PUMPKINS HAVE THEIR MOMENT':'TIME LEFT TO CARVE'}</p><div className="clock-display" role="timer" aria-label={displayTime(remaining)+' remaining'}>{displayTime(remaining)}</div><p className="clock-subtitle">{clock.status==='ready'?'A little imagination. A little suspense. A surprise every five minutes.':clock.status==='finished'?'Tools down safely. Your masterpieces are ready for their verdict.':clock.status==='paused'?'The clock and the surprises are paused. Your pumpkin can catch its breath.':'Keep carving. The haunted herald will return with another little surprise.'}</p>
   <div className="clock-buttons">{clock.status==='ready'?<button className="button primary competition-start" onClick={()=>{setClock(c=>startClock(c));say('The pumpkin carving competition begins now! You have one hour. A Halloween surprise will arrive every five minutes. Happy carving!','start');}}><Play size={18} fill="currentColor"/>Start Competition</button>:clock.status==='finished'?<button className="button primary competition-start" onClick={onReadyForJudge}>Ready for judging <ChevronRight size={18}/></button>:<button className="button outline" onClick={()=>{if(clock.status==='running'){setClock(c=>pauseClock(c));stopSound();}else setClock(c=>startClock(c));}}>{clock.status==='running'?<Pause size={16}/>:<Play size={16}/>} {clock.status==='running'?'Pause competition':'Resume competition'}</button>}
   {started?<button className="icon-button clock-reset" title="Reset the carving timer" aria-label="Reset carving timer" onClick={()=>setReset(true)}><RotateCcw size={17}/></button>:null}</div>
  </div>
  <div className="clock-progress"><span style={{width:elapsed/HOUR*100+'%'}}/></div>
  <div className="clock-foot"><div><Bell size={17}/><span>{clock.status==='ready'?'FIRST SURPRISE IN':clock.status==='finished'?'ALL 12 SURPRISES COMPLETE':'NEXT HALLOWEEN SURPRISE'}</span><strong>{clock.status==='finished'?'✓':displayTime(next).slice(2)}</strong></div><div><Clock3 size={16}/><span>{clock.lastAnnouncement} / 12 interludes</span></div><p>Facts, tiny spooky stories & a time check. A separate host—Gourdon joins for judging.</p></div>
  {announcement?<div className="announcement-overlay" role="status"><span className="announcement-kicker"><Bell size={15}/> THE HAUNTED HERALD <small>INTERLUDE {announcement} / 12</small></span><button className="icon-button announcement-close" aria-label="Close Halloween announcement" onClick={()=>{setAnnouncement(null);stopSound();}}><X size={19}/></button><p className="eyebrow">{interludes[announcement-1].kind}</p><h3>{interludes[announcement-1].title}</h3><p>{interludes[announcement-1].text}</p><span className="announcement-time">{interludes[announcement-1].minutes>0?interludes[announcement-1].minutes+' minutes left to carve':'The carving hour is complete'}</span><div className="interlude-progress"/></div>:null}
  {reset?<div className="clock-reset-confirm"><p>Reset the timer and all scheduled interludes? Team names and scores will stay saved.</p><button className="button outline" onClick={()=>setReset(false)}>Keep carving</button><button className="button primary" onClick={()=>{setClock(freshClock());spoken.current=0;setAnnouncement(null);setReset(false);stopSound();}}>Reset timer</button></div>:null}
  {clock.history.length>0?<details className="interlude-history"><summary><Bell size={14}/> Missed a surprise? <span>{clock.history.length} messages</span></summary>{clock.history.slice().reverse().map(h=><div key={h.index}><strong>{String(h.index*5).padStart(2,'0')} MIN · {interludes[h.index-1].title}</strong><p>{h.text}</p><button className="text-button" onClick={()=>{setAnnouncement(h.index);say(h.text,h.index);}}><Volume2 size={13}/> Replay</button></div>)}</details>:null}
  {soundBlocked&&clock.audio?<button className="button outline" onClick={()=>say(announcementText(clock.lastAnnouncement||1),clock.lastAnnouncement||1)}><Volume2 size={15}/> Enable announcement sound</button>:null}
  {!audioAvailable?<p className="audio-unavailable">Audio isn’t available in this browser. Announcements will appear on screen.</p>:null}
 </section>;
}

