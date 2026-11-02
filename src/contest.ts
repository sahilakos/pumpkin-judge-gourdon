export const categories = [
  { key: 'creativity', label: 'Creativity', hint: 'Original ideas & imaginative choices' },
  { key: 'craftsmanship', label: 'Craftsmanship', hint: 'Care, control & execution' },
  { key: 'character', label: 'Character & theme', hint: 'Personality, expression & concept' },
  { key: 'impact', label: 'Overall impact', hint: 'The finished pumpkin as a whole' },
] as const;
export type Category = typeof categories[number]['key'];
export type Scores = Record<Category, number | null>;
export type Team = {id:string; name:string; members:string[]; size:1|2|3; pumpkin:string; scores:Scores; note:string; judged:boolean};
export type Contest = {version:1; id:string; teams:Team[]; current:number; revealed:boolean; updatedAt:string};
export const STORAGE_KEY = 'pumpkin-court:v1';
export function emptyScores():Scores { return {creativity:null,craftsmanship:null,character:null,impact:null}; }
export function newContest():Contest {
  return {version:1,id:crypto.randomUUID(),teams:[['Deviki','David'],['Rhea','Sakshi','Deyus'],['Yash','Sahil'],['Neena','Aian']].map((members,i)=>({id:'team_0'+(i+1),name:'',members,size:members.length as 2|3,pumpkin:'',scores:emptyScores(),note:'',judged:false})),current:0,revealed:false,updatedAt:new Date().toISOString()};
}
export function validScore(value:unknown):value is number {return typeof value==='number'&&Number.isInteger(value)&&value>=1&&value<=10;}
export function total(team:Team):number|null {const n=categories.map(c=>team.scores[c.key]);return n.every(validScore)?n.reduce((a,b)=>a+b,0):null;}
export function displayName(team:Team,index:number) {return team.name.trim()||'Team '+String(index+1).padStart(2,'0');}
export function rankTeams(teams:Team[]):Team[] {return teams.filter(t=>t.judged&&total(t)!==null).sort((a,b)=>(total(b)!-total(a)!)||(b.scores.creativity!-a.scores.creativity!)||(b.scores.craftsmanship!-a.scores.craftsmanship!));}
export function winners(teams:Team[]):Team[] {const ranked=rankTeams(teams);if(ranked.length!==4)return [];const first=ranked[0];return ranked.filter(t=>total(t)===total(first)&&t.scores.creativity===first.scores.creativity&&t.scores.craftsmanship===first.scores.craftsmanship);}
export function parseContest(raw:string):Contest {
 const value:unknown=JSON.parse(raw);
 if(!value||typeof value!=='object')throw new Error('Not a contest file.');
 const c=value as Contest;
 if(c.version!==1||typeof c.id!=='string'||!Array.isArray(c.teams)||c.teams.length!==4||!Number.isInteger(c.current)||c.current<0||c.current>3||typeof c.revealed!=='boolean')throw new Error('This file is not a supported four-team contest.');
 const ids=new Set<string>();
 for(const t of c.teams){
  if(!t||typeof t.id!=='string'||ids.has(t.id)||typeof t.name!=='string'||!Array.isArray(t.members)||t.members.length<1||t.members.length>3||t.members.length!==t.size||!t.members.every(n=>typeof n==='string')||(t.size!==1&&t.size!==2&&t.size!==3)||typeof t.pumpkin!=='string'||typeof t.note!=='string'||typeof t.judged!=='boolean'||!t.scores||typeof t.scores!=='object')throw new Error('The team information is incomplete.');
  ids.add(t.id);
  for(const k of categories)if(t.scores[k.key]!==null&&!validScore(t.scores[k.key]))throw new Error('Scores must be whole numbers from 1 to 10.');
  if(t.judged&&total(t)===null)throw new Error('A judged team must have all four scores.');
 }
 if(c.revealed&&!c.teams.every(t=>t.judged&&total(t)!==null))throw new Error('Results need four complete scorecards.');
 return c;
}
export function csv(contest:Contest):string {
 const cell=(s:unknown)=>'"'+String(s??'').replaceAll('"','""').replace(/^[\s]*[=+@-]/,"'$&")+'"';
 const rows=[['Team','Members','Pumpkin',...categories.map(c=>c.label),'Total / 40','Status','Notes'],...contest.teams.map((t,i)=>[displayName(t,i),t.members.slice(0,t.size).filter(Boolean).join(' & '),t.pumpkin,...categories.map(c=>t.scores[c.key]),total(t),t.judged?'Judged':'Pending',t.note])];
 return rows.map(r=>r.map(cell).join(',')).join('\r\n');
}
