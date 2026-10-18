import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {register} from 'node:module';
register('./helpers/orbit-scene-loader.mjs',import.meta.url);
const dist=path.resolve(process.env.ORBIT_DIST||fileURLToPath(new URL('../dist',import.meta.url)));
const {CARD,createCardModel}=await import(pathToFileURL(path.join(dist,'space-card-model.js')).href);
const sha=()=>fs.readFile(path.join(dist,'space-card-model.js')).then(bytes=>createHash('sha256').update(bytes).digest('hex'));
const modelSHA=await sha(),counts=[1,2,3,5,7,11,16,23,29,35,36,37,64,96,128],reports=[];
const elapsedSpan=Math.max(230000,Math.ceil(CARD.idlePeriod*3.2/1000)*1000);
for(const reducedMotion of [false,true])for(const count of counts){
 const names=Array.from({length:count},(_,i)=>i<2?'同名同学':`身份验证${i+1}`),model=createCardModel();
 model.resize(1366,518);model.setNames(names);model.motion(reducedMotion);
 const allIndices=Array.from({length:count},(_,i)=>i),initial=model.cards.map(c=>[c.id,c.rosterIndex,c.name]);
 let samples=0;
 for(let elapsed=0;elapsed<=elapsedSpan;elapsed+=1000){
  model.sample(elapsed);assert.deepEqual([...new Set(model.cards.map(c=>c.rosterIndex))].sort((a,b)=>a-b),allIndices,`${count} seats: no identity disappears at ${elapsed} ms`);
  assert.deepEqual(model.cards.map(c=>[c.id,c.rosterIndex,c.name]),initial,'Presentation motion cannot recycle or rename an actual roster identity');
  assert.ok(model.cards.every(c=>['x','y','z','width','height'].every(key=>Number.isFinite(c[key]))));samples++;
 }
 let now=elapsedSpan+1000;
 for(const index of allIndices){
  assert.equal(model.start(now),true);assert.equal(model.selected,null);assert.equal(model.winner,'');
  for(const phase of [0,399,400,1399,1400,1749,1750]){model.sample(now+phase);assert.equal(model.selected,null);assert.equal(model.winner,'');assert.deepEqual([...new Set(model.cards.map(c=>c.rosterIndex))].sort((a,b)=>a-b),allIndices)}
  assert.equal(model.reveal(names[index],now+1750,index),true,`${count} seats: every original index can be revealed, including index ${index}`);
  assert.equal(model.selected.rosterIndex,index);assert.equal(model.selected.name,names[index]);const source=model.cards.find(c=>c.id===model.selected.sourceCardId);assert.equal(source.rosterIndex,index);
  if(!reducedMotion)for(const key of ['x','y','z','width','height','screenX','screenY'])assert.ok(Math.abs(model.selected[key]-source[key])<1e-8,`${key}: reveal starts at actual source pose`);
  model.sample(now+2110);assert.equal(model.order.length,1);assert.equal(model.order[0],model.selected);assert.equal(model.selected.rosterIndex,index);assert.ok(model.selected.inView);
  now+=4000;
 }
 reports.push({roster:count,reducedMotion,identitySamples:samples,elapsedSpanMs:elapsedSpan,everyIndexRevealPassed:true,settledResults:count});
}
assert.equal(await sha(),modelSHA,'Model source remained frozen throughout test');
const report={result:'PASS',dist,modelSHA,checkedAtUTC:new Date().toISOString(),rosterCounts:counts,normalAndReduced:true,reports,limitations:['Direct production spatial-model lifecycle checks, with every original index revealed.','This is identity/continuity verification, not a randomness-distribution test or browser visual/GPU verification.']};
if(process.env.ORBIT_IDENTITY_LIFECYCLE_REPORT)await fs.writeFile(process.env.ORBIT_IDENTITY_LIFECYCLE_REPORT,JSON.stringify(report,null,2)+'\n');
console.log(`PASS identity lifecycles: ${counts.length} roster sizes × normal/reduced motion; ${reports.reduce((sum,r)=>sum+r.identitySamples,0)} identity samples; ${reports.reduce((sum,r)=>sum+r.settledResults,0)} distinct-index result checks`);
