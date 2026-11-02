import {CheckCircle2,Clock3,ChevronRight,ImageDown,Pencil,Users} from 'lucide-react';
import {categories,total,type Team} from './contest';
export default function TeamScoreCard({team,index,onEdit,onDownload,active=false}:{team:Team;index:number;onEdit:()=>void;onDownload:()=>void;active?:boolean}){
 const scored=categories.filter(c=>team.scores[c.key]!==null).length;
 const running=categories.reduce((sum,c)=>sum+(team.scores[c.key]??0),0);
 return <article className={'team-scorecard '+(team.judged?'is-judged ':'')+(active?'active-scorecard':'')} aria-label={'Team '+(index+1)+' scorecard'}>
  <header className="scorecard-header"><span className="team-tag">TEAM {String(index+1).padStart(2,'0')}</span><span className={'card-state '+(team.judged?'complete':'')}>{team.judged?<><CheckCircle2 size={12}/> Judged</>:<><Clock3 size={12}/>{scored>0?'Scoring · '+scored+'/4':'At the bench'}</>}</span></header>
  <div className="scorecard-identity"><div className="scorecard-team"><h3>{team.name||'Name your team'}</h3><p className="team-members"><Users size={14}/>{team.members.slice(0,team.size).join(' · ')}</p>{team.pumpkin?<p className="pumpkin-title">“{team.pumpkin}”</p>:null}</div><figure className="scorecard-judge"><img src="/judge-gourdon.png" alt="Judge Gourdon"/><figcaption>Judge Gourdon</figcaption></figure></div>
  <div className="metric-cards">{categories.map((category,i)=><div className={'metric-card '+(team.scores[category.key]!==null?'has-score':'')} key={category.key}><span className="metric-label"><span>0{i+1}</span>{category.label}</span><strong key={team.scores[category.key]??'empty'} className={team.scores[category.key]!==null?'score-arrival':''}>{team.scores[category.key]??'—'}<small>/10</small></strong></div>)}</div>
  <div className="team-total"><div><span>{scored===4?'TOTAL SCORE':'RUNNING TOTAL'}</span><small>{team.judged?'Verdict saved by Gourdon':scored>0?'Categories appear as Gourdon scores.':'Waiting for Gourdon’s first score.'}</small></div><strong>{total(team)??(scored>0?running:'—')}<small>/40</small></strong></div>
  {team.note?<details className="judge-notes"><summary>Gourdon’s observations <ChevronRight size={13}/></summary><p>{team.note}</p></details>:null}
  <footer className="scorecard-footer"><button className="text-button" onClick={onEdit}><Pencil size={13}/> {team.judged?'Review':'Host entry'}</button><button className="text-button" onClick={onDownload}><ImageDown size={14}/> Save image</button></footer>
  {!active?<div className="export-brand">THE MIDNIGHT PUMPKIN COURT <span>✦</span> HALLOWEEN EDITION</div>:null}
 </article>;
}

