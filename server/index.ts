import express from 'express';
import Runway from '@runwayml/sdk';
import {createRpcHandler,type RpcHandler} from '@runwayml/avatars-node-rpc';
import {createServer as createViteServer} from 'vite';
import {setTimeout as sleep} from 'node:timers/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import {initialize,readContest,mutate,subscribe,registerTeam,saveScore,setCategoryScore,reveal} from './store.ts';
import {judgeTools,sessionPersonality} from './tools.ts';
import {TOOL_TEST_PERSONALITY} from './test-profile.ts';
import {parseContest,displayName,total} from '../src/contest.ts';
import {requiredEnv} from './config.ts';
const AVATAR_ID=requiredEnv('RUNWAY_AVATAR_ID');
const MAX_DURATION=1200;
const PORT=3000;
const apiKey=requiredEnv('RUNWAYML_API_SECRET');
const runway=new Runway({apiKey,timeout:60000,maxRetries:1});
await initialize();
const app=express();
app.disable('x-powered-by');
app.use('/api',(req,res,next)=>{
 const host=req.headers.host;
 const origin=req.headers.origin;
 if(!['localhost:3000','127.0.0.1:3000'].includes(host??'')||(origin&&!['http://localhost:3000','http://127.0.0.1:3000'].includes(origin))||req.headers['sec-fetch-site']==='cross-site'){res.status(403).json({error:'This app only accepts requests from its local browser.'});return;}
 res.setHeader('Cache-Control','no-store');next();
});
app.use('/api',express.json({limit:'256kb'}));
let active:{id:string;handler:RpcHandler;timer:ReturnType<typeof setTimeout>}|null=null;
let creating=false;
const sseClients=new Set<express.Response>();
const notify=(event:string,data:unknown)=>{for(const res of sseClients)res.write('event: '+event+'\ndata: '+JSON.stringify(data)+'\n\n');};
subscribe(c=>notify('contest',c));
app.get('/api/contest',(_req,res)=>res.json(readContest()));
app.put('/api/contest',async(req,res)=>{
 try{
  const submitted=parseContest(JSON.stringify(req.body));
  const c=await mutate(c=>{
   if(req.headers['if-match']&&req.headers['if-match']!==c.updatedAt)throw new Error('CONFLICT');
   if(active&&submitted.id!==c.id)throw new Error('End the judge call before starting or restoring another contest.');
   return submitted;
  });res.json(c);
 }catch(e){if(e instanceof Error&&e.message==='CONFLICT'){res.status(409).json({error:'The judge updated the scorecards. Try your change again.',contest:readContest()});return;}res.status(400).json({error:e instanceof Error?e.message:'Invalid contest.'});}
});
app.get('/api/events',(req,res)=>{
 res.setHeader('Content-Type','text/event-stream');res.setHeader('Connection','keep-alive');res.flushHeaders();sseClients.add(res);
 res.write('event: contest\ndata: '+JSON.stringify(readContest())+'\n\n');
 const heartbeat=setInterval(()=>res.write(': heartbeat\n\n'),15000);
 req.on('close',()=>{clearInterval(heartbeat);sseClients.delete(res);});
});
app.get('/api/config',async(_req,res)=>{
 try{
  const avatar=await runway.avatars.retrieve(AVATAR_ID);
  res.json({valid:avatar.status==='READY',maxDuration:MAX_DURATION,avatarImageUrl:'/judge-gourdon.png',mode:'server',characterName:avatar.name,characterUrl:process.env.RUNWAY_CHARACTER_URL||'https://dev.runway.com/',scoreSaving:'local_file',activeSession:!!active});
 }catch(e){res.status(502).json({error:e instanceof Error?e.message:'The Runway account could not be verified.'});}
});
async function endActive(){
 const previous=active;active=null;
 if(previous){clearTimeout(previous.timer);await Promise.allSettled([previous.handler.close(),runway.realtimeSessions.delete(previous.id)]);}
}
app.post('/api/session/end',async(_req,res)=>{await endActive();res.json({ended:true});});
app.post('/api/session',async(req,res)=>{
 if(creating||active){res.status(409).json({error:'A judge call is already open. End it before starting another.'});return;}
 creating=true;let createdId:string|undefined;
 try{
  const avatar=await runway.avatars.retrieve(AVATAR_ID);
  const c=readContest();
  const snapshot={contest_id:c.id,current_team_id:c.teams[c.current].id,revealed:c.revealed,teams:c.teams.map((t,i)=>({team_id:t.id,team_name:displayName(t,i),member_names:t.members.slice(0,t.size).filter(Boolean),expected_members:t.size,judged:t.judged,scores:t.judged?t.scores:null,total:total(t)}))};
  const toolTest=req.body?.toolSmokeTest===true;
  const personality=toolTest?TOOL_TEST_PERSONALITY:sessionPersonality(avatar.personality,snapshot);
  // An explicit smoke-test flag permits a short setup check without a 20-minute call.
  const smokeTest=req.body?.smokeTest===true;
  const maxDuration=toolTest?90:smokeTest?30:MAX_DURATION;
  const startScript=toolTest?'This is a software connection check. Please say run the connection test.':smokeTest?'Sound check! I am Judge Gourdon, your pumpkin judge. If you can hear my booming pumpkin voice, the court is ready. This is only a sound and video test. Your scores will stay unchanged.':c.teams.some(t=>t.judged)?'Welcome back to the pumpkin court! Let me check our saved scorecards so we can pick up where we left off.':avatar.startScript??'Welcome, pumpkin artists! I am Judge Gourdon. First team, bring your pumpkin forward and tell me your team name!';
  const created=await runway.realtimeSessions.create({model:'gwm1_avatars',avatar:{type:'custom',avatarId:AVATAR_ID},maxDuration,personality,tools:judgeTools,startScript});
  createdId=created.id;
  const deadline=Date.now()+90000;
  let ready:Awaited<ReturnType<typeof runway.realtimeSessions.retrieve>>|undefined;
  while(Date.now()<deadline){
   const s=await runway.realtimeSessions.retrieve(created.id);
   if(s.status==='READY'){ready=s;break;}
   if(['FAILED','CANCELLED','COMPLETED'].includes(s.status))throw new Error('Runway could not prepare the judge call ('+s.status+').');
   await sleep(1000);
  }
  if(!ready||!('sessionKey'in ready)||typeof ready.sessionKey!=='string')throw new Error('Gourdon’s connection timed out. Please try again.');
  const safe=(tool:string,action:(args:Record<string,unknown>)=>Promise<Record<string,unknown>>)=>
   async(args:Record<string,unknown>)=>{const id=crypto.randomUUID();notify('tool',{id,tool,phase:'started',message:'Gourdon is casting this spell…',at:new Date().toISOString()});try{const result=await action(args);notify('tool',{id,tool,phase:result.saved===false?'error':'success',message:typeof result.team_name==='string'?result.team_name+(tool==='set_category_score'?' · '+result.category+' '+result.score+'/10':' · scorecard saved'):tool==='register_team'?'Team name and members registered':tool==='reveal_results'?'The final verdict is revealed':'Saved contest state retrieved',at:new Date().toISOString()});return result;}catch(e){const error=e instanceof Error?e.message:'The scorecard could not be saved.';notify('tool',{id,tool,phase:'error',message:error,at:new Date().toISOString()});return {saved:false,error};}};
  const handler=await createRpcHandler({apiKey,sessionId:created.id,tools:{
   get_contest_state:safe('get_contest_state',async()=>({contest:readContest(),saved_on:'the host’s local computer'})),
   register_team:safe('register_team',async args=>{const result=await registerTeam(args,c.id);notify('notice',{message:'Team introductions saved.'});return result;}),
   set_category_score:safe('set_category_score',async args=>setCategoryScore(args,c.id)),
   save_pumpkin_score:safe('save_pumpkin_score',async args=>{const result=await saveScore(args,c.id);notify('notice',{message:result.team_name+'’s scorecard saved by Gourdon.'});return result;}),
   reveal_results:safe('reveal_results',async()=>reveal(c.id))
  },onDisconnected:()=>{if(active?.id===created.id){clearTimeout(active.timer);active=null;}},onError:()=>notify('notice',{message:'The judge’s score connection needs attention. You can still record scores at the host desk.'})});
  const timer=setTimeout(()=>void endActive(),(maxDuration+90)*1000);
  active={id:created.id,handler,timer};
  res.json({sessionId:created.id,sessionKey:ready.sessionKey,avatarId:AVATAR_ID,maxDuration});
 }catch(e){
  if(createdId)await runway.realtimeSessions.delete(createdId).catch(()=>{});
  const message=e instanceof Error?e.message:'Could not start the judge.';
  res.status(502).json({error:message});
 }finally{creating=false;}
});
app.use('/api',(_req,res)=>res.status(404).json({error:'Unknown app endpoint.'}));
if(process.argv.includes('--production')){
 app.use(express.static(resolve('dist')));
 app.get('/{*path}',(_req,res)=>res.sendFile(resolve('dist/index.html')));
}else{
 const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'});
 app.use(vite.middlewares);
}
app.use((error:Error,_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.status(500).json({error:error.message||'The app could not finish that request.'}));
const server=createServer(app);
server.listen(PORT,'127.0.0.1',()=>console.log('Pumpkin Court is ready at http://127.0.0.1:'+PORT+' — local server, real score saving.'));
async function shutdown(){for(const res of sseClients)res.end();await endActive();server.close();process.exit(0);}
process.on('SIGINT',()=>void shutdown());process.on('SIGTERM',()=>void shutdown());
