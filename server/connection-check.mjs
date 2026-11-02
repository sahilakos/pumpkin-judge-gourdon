import {Room,AudioSource,AudioFrame,LocalAudioTrack,TrackPublishOptions,TrackSource,dispose} from '@livekit/rtc-node';
import {consumeSession} from '@runwayml/avatars/api';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:3000';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const original=await fetch(base+'/api/contest').then(r=>r.json());
if(original.teams.some(t=>t.judged||t.name))throw new Error('Refusing to write test data over a populated contest.');
let room,source;
try{
 const response=await fetch(base+'/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({toolSmokeTest:true})});
 const data=await response.json();if(!response.ok)throw new Error(data.error);
 console.log('Real Runway session and authenticated backend tool handler prepared.');
 const credentials=await consumeSession({sessionId:data.sessionId,sessionKey:data.sessionKey});
 room=new Room();await room.connect(credentials.url,credentials.token,{autoSubscribe:false});
 source=new AudioSource(48000,1);
 const track=LocalAudioTrack.createAudioTrack('connection-test',source);
 const options=new TrackPublishOptions();options.source=TrackSource.SOURCE_MICROPHONE;
 await room.localParticipant.publishTrack(track,options);
 await sleep(5000);
 const buffer=await readFile(new URL('../tests/fixtures/connection-test.pcm',import.meta.url));
 const samples=new Int16Array(14400+buffer.length/2+96000);
 for(let i=0;i<buffer.length/2;i++)samples[14400+i]=buffer.readInt16LE(i*2);
 for(let attempt=0;attempt<3;attempt++){for(let i=0;i<samples.length;i+=480){const frame=new Int16Array(480);frame.set(samples.subarray(i,i+480));await source.captureFrame(new AudioFrame(frame,48000,1,480));}await source.waitForPlayout();const current=await fetch(base+'/api/contest').then(r=>r.json());if(current.teams[0].judged||current.teams[0].name==='TEST — Connection Check')break;await sleep(3000);}
 console.log('Sent synthetic speech requesting the connection test; no microphone or camera captured.');
 const deadline=Date.now()+65000;let saved;
 while(Date.now()<deadline){const c=await fetch(base+'/api/contest').then(r=>r.json());if(c.teams[0].judged&&c.current===1&&c.teams[1].name==='TEST — Next Team'){saved=c.teams[0];break;}await sleep(1000);}
 assert.ok(saved,'The Runway model did not save the test scorecard in time.');
 assert.equal(saved.name,'TEST — Connection Check');assert.equal(saved.scores.creativity,8);assert.equal(saved.scores.craftsmanship,7);assert.equal(saved.scores.character,9);assert.equal(saved.scores.impact,8);
 console.log('PASS: the real Runway model scored all categories, saved 32/40, and registered the next three-member team. The current scorecard and completed-card rail can now be checked in the browser.');
 await room.disconnect();room=null;await source.close();source=null;await fetch(base+'/api/session/end',{method:'POST'});
 console.log('The test scorecard will remain visible for 30 seconds for browser and PNG-export checks.');
 await sleep(30000);
}finally{
 if(room)await room.disconnect();if(source)await source.close();
 await fetch(base+'/api/session/end',{method:'POST'});
 const restored=await fetch(base+'/api/contest',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(original)});
 console.log('Synthetic test data removed; actual nine-person roster restored:',restored.ok);
 dispose();setTimeout(()=>process.exit(process.exitCode??0),300);
}
