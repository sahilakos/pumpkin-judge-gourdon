import {useEffect,useRef,useState} from 'react';
import {AvatarCall,AvatarVideo,ControlBar,UserVideo,useAvatarSession,useAvatarStatus,useTranscript} from '@runwayml/avatars-react';
import {useAudioPlayback,useRoomContext} from '@livekit/components-react';
import {RemoteAudioTrack,RoomEvent} from 'livekit-client';
import {Mic,MicOff,Video,VideoOff,MonitorUp,PhoneOff,Volume2,VolumeX} from 'lucide-react';
import {API_BASE,connectJudge} from './runway';

type Props={preview?:boolean;maxDuration:number;onEnd:()=>void;onError:(message:string)=>void;onState:(state:string)=>void;onTranscript:(text:string[])=>void};
function CallBody({maxDuration,onState,onTranscript,preview}:Pick<Props,'maxDuration'|'onState'|'onTranscript'|'preview'>){
 const session=useAvatarSession();
 const avatar=useAvatarStatus();
 const room=useRoomContext();
 const {canPlayAudio,startAudio}=useAudioPlayback();
 const [speakerMuted,setSpeakerMuted]=useState(false);
 const [volume,setVolume]=useState(100);
 const [audioError,setAudioError]=useState(false);
 const transcript=useTranscript({interim:true,bufferSize:600});
 const [elapsed,setElapsed]=useState(0);
 const started=useRef<number|null>(null);
 // AvatarCall already renders the remote audio. Control that stream rather than
 // mounting a second renderer, which would play the judge twice.
 useEffect(()=>{
  const level=speakerMuted?0:volume/100;
  const apply=(track:unknown)=>{if(track instanceof RemoteAudioTrack)track.setVolume(level);};
  for(const participant of room.remoteParticipants.values()){
   for(const publication of participant.audioTrackPublications.values())apply(publication.track);
  }
  room.on(RoomEvent.TrackSubscribed,apply);
  return ()=>{room.off(RoomEvent.TrackSubscribed,apply);};
 },[room,speakerMuted,volume]);
 useEffect(()=>{
  if(session.state==='active')void startAudio().catch(()=>setAudioError(true));
 },[session.state,startAudio]);
 async function enableSound(){
  setSpeakerMuted(false);
  if(volume===0)setVolume(100);
  try{await startAudio();setAudioError(false);}catch{setAudioError(true);}
 }
 useEffect(()=>{onState(session.state);},[session.state,onState]);
 useEffect(()=>{onTranscript(transcript.map(e=>e.text));},[transcript,onTranscript]);
 useEffect(()=>{
  if(session.state!=='active')return;
  started.current=Date.now();
  const timer=setInterval(()=>{
   const seconds=Math.floor((Date.now()-started.current!)/1000);
   setElapsed(seconds);
   if(seconds>=maxDuration)void session.end();
  },1000);
  return ()=>clearInterval(timer);
 },[session.state,session.end,maxDuration]);
 const remaining=Math.max(0,maxDuration-elapsed);
 return <>
  <AvatarVideo className="judge-video"/>
  <div className="live-indicator"><span/> {avatar.status==='ready'?'LIVE':'PREPARING GOURDON'} <span className="timer">{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</span></div>
  {preview?<div className="judge-test-label">30-SECOND SOUND CHECK · CAMERA OPTIONAL</div>:null}
  <UserVideo className="user-video" mirror={false}/>
  {session.state==='active'&&(!canPlayAudio||audioError)?<div className="judge-audio-unlock" role="status"><button onClick={()=>void enableSound()}><Volume2 size={20}/> Enable judge sound</button><span>Your browser needs a click to play Gourdon’s voice.</span></div>:null}
  {transcript.length>0?<div className="live-caption" aria-live="off">{transcript.at(-1)?.text}</div>:null}
  <ControlBar>{s=><div className="call-toolbar">
   <button onClick={()=>{if(speakerMuted||!canPlayAudio||audioError||volume===0)void enableSound();else setSpeakerMuted(true);}} disabled={!s.isActive} aria-label={speakerMuted||volume===0?'Unmute judge sound':'Mute judge sound'} aria-pressed={speakerMuted||volume===0} title="Judge speaker · separate from your microphone">{speakerMuted||volume===0?<VolumeX size={19}/>:<Volume2 size={19}/>}</button>
   <label className="judge-volume"><span>Judge volume</span><input aria-label="Judge volume" type="range" min="0" max="100" value={speakerMuted?0:volume} disabled={!s.isActive} onChange={e=>{setVolume(Number(e.target.value));setSpeakerMuted(false);void startAudio().then(()=>setAudioError(false)).catch(()=>setAudioError(true));}}/></label>
   <button onClick={s.toggleMic} disabled={!s.isActive} aria-label={s.isMicEnabled?'Mute microphone':'Unmute microphone'} title={s.isMicEnabled?'Mute microphone':'Unmute microphone'}>{s.isMicEnabled?<Mic size={19}/>:<MicOff size={19}/>}</button>
   <button onClick={s.toggleCamera} disabled={!s.isActive} aria-label={s.isCameraEnabled?'Turn off camera':'Show your pumpkin on camera'} title="Show your pumpkin">{s.isCameraEnabled?<Video size={19}/>:<VideoOff size={19}/>}</button>
   <button onClick={s.toggleScreenShare} disabled={!s.isActive} aria-label={s.isScreenShareEnabled?'Stop sharing screen':'Share screen'} title="Share screen"><MonitorUp size={19}/></button>
   <span className="toolbar-copy">{s.isCameraEnabled?'Your camera is on':'Turn on your camera to show your pumpkin'}</span>
   <button onClick={()=>void s.endCall()} className="end-call" aria-label="End judge call"><PhoneOff size={19}/><span>End call</span></button>
   {s.micError||s.cameraError?<div className="media-error" role="alert">{s.micError?'Microphone access is blocked. ':'Camera access is blocked. '}Check your browser permissions, then try again.</div>:null}
  </div>}</ControlBar>
 </>;
}
export default function LiveJudge(props:Props){
 const [keys,setKeys]=useState<Awaited<ReturnType<typeof connectJudge>>|null>(null);
 const {preview,onError}=props;
 useEffect(()=>{
  const abort=new AbortController();
  void connectJudge(abort.signal,preview).then(value=>{if(!abort.signal.aborted)setKeys(value);}).catch(e=>{if(!abort.signal.aborted)onError(e instanceof Error?e.message:'The judge could not connect.');});
  return ()=>abort.abort();
 },[preview,onError]);
 // The SDK caches connect() results by avatar ID. Pass a fresh session ID to
 // distinguish every call, including a full call after a short preview.
 if(!keys)return <div className="loading-stage"><span>Opening a fresh connection to Gourdon…</span></div>;
 return <AvatarCall key={keys.sessionId} avatarId={keys.avatarId} sessionId={keys.sessionId} sessionKey={keys.sessionKey} baseUrl={API_BASE} audio={true} video={false} className="live-call" onEnd={props.onEnd} onError={e=>props.onError(e.message)}>
  <CallBody {...props}/>
 </AvatarCall>;
}
