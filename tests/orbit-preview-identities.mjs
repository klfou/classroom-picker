import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCardModel} from '../dist/orbit-preview/space-card-model.js';

// Identity is the host's roster/seat index, including duplicated names. Every
// selectable seat must retain a physical source throughout offscreen recycling.
const reports=[];
for(const n of [1,2,3,5,7,17,23,29,35,36,37,63,64,127,128]){
 const model=createCardModel();model.resize(1366,518);
 model.setNames(Array.from({length:n},(_,i)=>i<2?'同名同学':`学生${i}`));model.sample(0);
 let samples=0;
 for(let time=0;time<230000;time+=1000){
  model.sample(time);
  assert.equal(new Set(model.cards.map(card=>card.rosterIndex)).size,n,`${n} seats at ${time}ms: every seat has a real card`);
  for(const card of model.cards)assert.equal(card.name,model.names[card.rosterIndex]);
  samples++;
 }
 for(let index=0;index<n;index++){
  model.start(240000);model.sample(241750);
  assert.equal(model.reveal(model.names[index],241750,index),true,`${n} seats: reveal index ${index}`);
  assert.equal(model.selected.rosterIndex,index);
  const source=model.cards.find(card=>card.id===model.selected.sourceCardId);
  assert.equal(source.rosterIndex,index,'The animation source is the exact selected seat');
  for(const key of ['x','y','z','width','height'])assert.ok(Math.abs(model.selected[key]-source[key])<1e-8,`${key} is continuous at reveal`);
 }
 reports.push({roster:n,identitySamples:samples,everySeatRevealPassed:true});
}
if(process.env.ORBIT_IDENTITY_REPORT)fs.writeFileSync(process.env.ORBIT_IDENTITY_REPORT,JSON.stringify(reports,null,2)+'\n');
console.log('PASS 15 roster sizes from1 through128: 230 time samples over three full idle cycles, every seat revealed, duplicated names resolved by index, and exact source geometry continuity.');
