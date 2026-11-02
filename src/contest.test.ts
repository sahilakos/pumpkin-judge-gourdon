import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newContest,total,rankTeams,winners,parseContest,csv,validScore} from './contest.ts';
test('incomplete scorecards cannot have a total or win',()=>{
 const c=newContest();assert.equal(total(c.teams[0]),null);assert.deepEqual(winners(c.teams),[]);
 c.teams[0].scores={creativity:10,craftsmanship:10,character:10,impact:null};
 assert.equal(total(c.teams[0]),null);assert.equal(rankTeams(c.teams).length,0);
});
test('ranking uses total, then creativity, then craftsmanship, without mutating the lineup',()=>{
 const c=newContest();
 const scores=[
 {creativity:8,craftsmanship:8,character:8,impact:8},
 {creativity:9,craftsmanship:7,character:8,impact:8},
 {creativity:9,craftsmanship:8,character:7,impact:8},
 {creativity:7,craftsmanship:7,character:7,impact:7}];
 c.teams.forEach((t,i)=>{t.judged=true;t.scores=scores[i];});
 assert.deepEqual(rankTeams(c.teams).map(t=>t.id),['team_03','team_02','team_01','team_04']);
 assert.deepEqual(winners(c.teams).map(t=>t.id),['team_03']);
 assert.equal(c.teams[0].id,'team_01');
});
test('a tied total, creativity and craftsmanship produces joint winners',()=>{
 const c=newContest();c.teams.forEach(t=>{t.judged=true;t.scores={creativity:8,craftsmanship:8,character:8,impact:8};});
 assert.equal(winners(c.teams).length,4);
 c.teams[3].judged=false;assert.equal(winners(c.teams).length,0);
});
test('backup restores real roster and scores and rejects invalid, duplicate or premature results',()=>{
 const c=newContest();c.teams[0].name='Moon Carvers';c.teams[0].members=['A','B'];c.teams[0].scores={creativity:8,craftsmanship:7,character:9,impact:8};c.teams[0].judged=true;
 assert.deepEqual(parseContest(JSON.stringify(c)),c);
 c.teams[0].scores.creativity=11;assert.throws(()=>parseContest(JSON.stringify(c)),/whole numbers/);
 c.teams[0].scores.creativity=8;c.teams[1].id=c.teams[0].id;assert.throws(()=>parseContest(JSON.stringify(c)),/incomplete/);
 const next=newContest();next.revealed=true;assert.throws(()=>parseContest(JSON.stringify(next)),/four complete/);
 assert.throws(()=>parseContest('not json'));
});
test('exports preserve commas, quotes and line breaks; spreadsheet formulas are inert',()=>{
 const c=newContest();c.teams[0].name='=1+1';c.teams[0].note='A "smile", and\na star';
 const exported=csv(c);assert.ok(exported.includes('"\'=1+1"'));assert.ok(exported.includes('"A ""smile"", and\na star"'));
 assert.ok(exported.includes('Total / 40'));
});
test('scores cannot be decimals, strings, zero or out of range',()=>{
 for(const n of [0,11,1.5,'8',null,NaN,Infinity])assert.equal(validScore(n),false);
 assert.equal(validScore(1),true);assert.equal(validScore(10),true);
});

