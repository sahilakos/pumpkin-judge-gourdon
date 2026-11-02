import {mkdir,readFile,writeFile,rename,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {newContest,parseContest,total,validScore,winners,displayName,type Contest,type Team} from '../src/contest.ts';
const DATA=join(process.cwd(),'data');
const FILE=join(DATA,'contest.json');
let current:Contest;
let tail:Promise<unknown>=Promise.resolve();
const listeners=new Set<(c:Contest)=>void>();
export async function initialize(){
 await mkdir(DATA,{recursive:true,mode:0o700});
 try{current=parseContest(await readFile(FILE,'utf8'));}
 catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw new Error('The existing contest file could not be read. Keep a copy and restore a valid backup before starting.');current=newContest();await write(current);}
}
async function write(c:Contest){const temporary=FILE+'.tmp';await writeFile(temporary,JSON.stringify(c,null,2)+'\n',{mode:0o600});await rename(temporary,FILE);}
export function readContest(){return structuredClone(current);}
export function subscribe(fn:(c:Contest)=>void){listeners.add(fn);return()=>listeners.delete(fn);}
export function mutate(update:(c:Contest)=>Contest|Promise<Contest>):Promise<Contest>{
 const job=tail.then(async()=>{const next=parseContest(JSON.stringify(await update(readContest())));next.updatedAt=new Date().toISOString();await write(next);current=next;for(const fn of listeners)fn(readContest());return readContest();});
 tail=job.catch(()=>{});return job;
}
function text(value:unknown,name:string,max=200){if(typeof value!=='string'||value.length>max)throw new Error(name+' must be text, up to '+max+' characters.');return value.trim();}
function locate(c:Contest,id:unknown,contestId:string){if(c.id!==contestId)throw new Error('The host has started a different contest. Stop this call and begin a new one.');const i=c.teams.findIndex(t=>t.id===id);if(i<0)throw new Error('Use an existing team_id: team_01, team_02, team_03 or team_04.');return i;}
function roster(args:Record<string,unknown>){const name=text(args.team_name,'team_name',80);if(!name)throw new Error('Ask for the team name first.');if(!Array.isArray(args.member_names)||args.member_names.length<1||args.member_names.length>3)throw new Error('Supply one, two or three confirmed member names.');const names=args.member_names.map(n=>text(n,'member name',60));if(names.some(n=>!n))throw new Error('Ask every member their name first.');return {name,names};}
export async function registerTeam(args:Record<string,unknown>,contestId:string){
 const r=roster(args);
 const c=await mutate(c=>{const i=locate(c,args.team_id,contestId);if(c.teams.some((t,j)=>j!==i&&t.name.trim().toLowerCase()===r.name.toLowerCase()))throw new Error('That team is already registered. Use its existing team_id.');c.teams[i]={...c.teams[i],name:r.name,members:r.names,size:r.names.length as 1|2|3};c.current=i;return c;});
 return {saved:true,team_id:args.team_id,team:c.teams.find(t=>t.id===args.team_id)};
}
export async function saveScore(args:Record<string,unknown>,contestId:string){
 const r=roster(args);const scores={creativity:args.creativity,craftsmanship:args.craftsmanship,character:args.character_theme,impact:args.overall_impact};
 if(!Object.values(scores).every(validScore))throw new Error('Each category must be a whole number from 1 to 10. Do not save incomplete assessments.');
 const sum=Object.values(scores).reduce<number>((a,b)=>a+Number(b),0);
 if(args.total!==sum)throw new Error('The four scores add up to '+sum+'. Correct the total and call again.');
 if(!['visual','description_based'].includes(String(args.evidence_mode)))throw new Error('Supply evidence_mode visual or description_based.');
 const reasons=['creativity_reason','craftsmanship_reason','character_theme_reason','overall_impact_reason'].map(k=>text(args[k],k,600));
 const observations=Array.isArray(args.observations)?args.observations.map(n=>text(n,'observation',600)):[];
 if(observations.length<1||observations.length>5)throw new Error('Provide one to five specific observations.');
 const c=await mutate(c=>{const i=locate(c,args.team_id,contestId);const t:Team={...c.teams[i],name:r.name,members:r.names,size:r.names.length as 1|2|3,pumpkin:typeof args.pumpkin_name==='string'?text(args.pumpkin_name,'pumpkin_name',100):'',scores:scores as Team['scores'],judged:true,note:['Evidence: '+args.evidence_mode,...observations,...reasons].join('\n')};c.teams[i]=t;return c;});
 const saved=c.teams.find(t=>t.id===args.team_id)!;
 return {saved:true,team_id:saved.id,team_name:saved.name,scores:saved.scores,total:total(saved),judged_teams:c.teams.filter(t=>t.judged).length,maximum:40};
}
export async function setCategoryScore(args:Record<string,unknown>,contestId:string){
 const map={creativity:'creativity',craftsmanship:'craftsmanship',character_theme:'character',overall_impact:'impact'} as const;
 const category=String(args.category) as keyof typeof map;
 if(!(category in map)||!validScore(args.score))throw new Error('Supply a valid category and a whole-number score from 1 to 10.');
 const reason=text(args.reason,'reason',600);
 const c=await mutate(c=>{const i=locate(c,args.team_id,contestId);const team=c.teams[i];if(team.judged)throw new Error('This scorecard is already complete. Use save_pumpkin_score for an explicit correction.');team.scores[map[category]]=args.score as number;const prefix=category+': ';team.note=team.note.split('\n').filter(line=>!line.startsWith(prefix)).concat(prefix+reason).filter(Boolean).join('\n');c.current=i;return c;});
 const team=c.teams.find(t=>t.id===args.team_id)!;
 return {saved:true,team_id:team.id,team_name:team.name,category,score:args.score,running_total:Object.values(team.scores).reduce<number>((n,s)=>n+(s??0),0),complete:false};
}
export async function reveal(contestId:string){
 const c=await mutate(c=>{if(c.id!==contestId)throw new Error('This session belongs to an earlier contest.');if(!c.teams.every(t=>t.judged&&total(t)!==null))throw new Error('All four teams need complete scorecards before the reveal.');c.revealed=true;return c;});
 return {revealed:true,winners:winners(c.teams).map(t=>displayName(t,c.teams.findIndex(x=>x.id===t.id))),teams:c.teams.map((t,i)=>({name:displayName(t,i),scores:t.scores,total:total(t)}))};
}

