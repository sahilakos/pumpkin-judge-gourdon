import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {resolve} from 'node:path';import {tmpdir} from 'node:os';import {total} from './contest.ts';
test('real score store saves categories progressively, finalizes and advances the three-member team',async()=>{
 const cwd=process.cwd();const dir=await mkdtemp(resolve(tmpdir(),'pumpkin-score-store-'));process.chdir(dir);
 try{
  const store=await import('../server/store.ts');await store.initialize();const id=store.readContest().id;
  await store.registerTeam({team_id:'team_01',team_name:'Test Moon',member_names:['Deviki','David']},id);
  await store.setCategoryScore({team_id:'team_01',category:'creativity',score:8,reason:'Test reason'},id);
  let c=store.readContest();assert.equal(c.current,0);assert.equal(c.teams[0].scores.creativity,8);assert.equal(c.teams[0].judged,false);assert.equal(total(c.teams[0]),null);
  await assert.rejects(()=>store.setCategoryScore({team_id:'team_01',category:'creativity',score:11,reason:'Invalid'},id));
  assert.equal(store.readContest().teams[0].scores.creativity,8);
  const args={team_id:'team_01',team_name:'Test Moon',member_names:['Deviki','David'],pumpkin_name:'Software test',evidence_mode:'description_based',creativity:8,craftsmanship:7,character_theme:9,overall_impact:8,total:32,observations:['Synthetic test.'],creativity_reason:'Test',craftsmanship_reason:'Test',character_theme_reason:'Test',overall_impact_reason:'Test'};
  await store.saveScore(args,id);assert.equal(store.readContest().teams[0].judged,true);
  await store.registerTeam({team_id:'team_02',team_name:'Test Stars',member_names:['Rhea','Sakshi','Deyus']},id);
  c=store.readContest();assert.equal(c.current,1);assert.equal(c.teams[1].members.length,3);assert.equal(total(c.teams[0]),32);assert.equal(c.teams[1].scores.creativity,null);
  await store.initialize();assert.equal(store.readContest().current,1);assert.equal(total(store.readContest().teams[0]),32);
  await assert.rejects(()=>store.reveal(id),/four teams/);
 }finally{process.chdir(cwd);await rm(dir,{recursive:true,force:true});}
});
