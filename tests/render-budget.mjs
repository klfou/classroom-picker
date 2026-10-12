import assert from 'node:assert/strict';
import {createRenderBudget} from '../dist/render-budget.js';
const run=(budget,start,frames,gap,cost=2)=>{let now=start;const changes=[];for(let i=0;i<frames;i++){now+=gap;if(budget.observe(now,cost))changes.push({now,...budget.debug()})}return {now,changes}};
let budget=createRenderBudget(),t=run(budget,0,2400,1000/60);assert.equal(budget.scale,1);assert.equal(t.changes.length,0,'Smooth devices keep original full quality');
budget.observe(t.now+800,3);t=run(budget,t.now+800,240,1000/60);assert.equal(budget.scale,1,'An isolated stall does not reduce quality');
budget=createRenderBudget();t=run(budget,0,240,1000/30,20);assert.equal(budget.scale,.65);assert.equal(t.changes.length,2);assert.ok(t.changes[1].now-t.changes[0].now>=3000,'Downgrades obey cooldown');assert.ok(t.changes.every(c=>[1,.8,.65].includes(c.scale)));
const before=budget.debug();budget.resetSamples();assert.deepEqual(budget.debug(),before,'Visibility/theme sample reset keeps learned quality');
t=run(budget,t.now+60000,600,1000/60);assert.equal(budget.scale,.65,'Recovery needs a sustained healthy window');t=run(budget,t.now,1200,1000/60);assert.equal(budget.scale,1);assert.equal(t.changes.length,2);assert.ok(t.changes[1].now-t.changes[0].now>=12000,'Restoration is slower than degradation');
for(const gap of [125,200,500,1000]){budget=createRenderBudget();t=run(budget,0,100,gap,80);assert.equal(budget.scale,.65,`Sustained ${gap}ms low-end cadence must downgrade`)}
budget=createRenderBudget();t=run(budget,0,400,1000/60,24);assert.equal(budget.scale,.65,'CPU overload is detected even with a recording cadence');
const other=createRenderBudget();assert.equal(other.scale,1,'Themes retain independent quality');
budget=createRenderBudget();for(let i=0;i<20;i++)budget.observe(i*10000,2);assert.equal(budget.scale,1,'Long background-like gaps cannot train quality');
console.log('PASS adaptive quality bounds, high-end preservation, isolated stalls, sustained 30fps/1–8fps and CPU overload, cooldown, slow recovery, visibility/theme retention and independent themes.');
