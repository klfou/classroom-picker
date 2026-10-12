// Production scene lifecycle on deterministic DOM/Canvas; no browser FPS claim.
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./helpers/theme-scene-loader.mjs',import.meta.url);
const {setup,dist,$,select}=await import('./helpers/theme-environment.mjs');
const env=await setup();await import(dist+'/scene.js');const app=window.classroom;await env.awaitReady(app.ready);env.bindRenderer(app.renderer);await import(dist+'/countdown.js');await env.step(1800);
let controls=0,poses=0,paints=0;const operations=[];
const update=app.controls.update.bind(app.controls);app.controls.update=()=>{controls++;return update()};
for(const p of app.people()){const original=p.avatar.setPose;p.avatar.setPose=v=>{poses++;return original(v)}}
const render=app.renderer.render.bind(app.renderer);app.renderer.render=(...args)=>{paints++;operations.push({type:'classroom-paint',now:env.now});return render(...args)};
const starRender=app.spaceCards.render;app.spaceCards.render=(...args)=>{paints++;operations.push({type:'space-paint',now:env.now});return starRender(...args)};
const ratio=app.renderer.setPixelRatio.bind(app.renderer);app.renderer.setPixelRatio=v=>{operations.push({type:'ratio',value:v,now:env.now});return ratio(v)};
app.setTheme('space');await env.step(20);controls=poses=0;
for(let i=0;i<180;i++)await env.step(1000/60);
assert.equal(controls,0,'Star frames never update hidden classroom orbit controls');assert.equal(poses,0);assert.equal(app.renderBudget().space.scale,1);
app.pick();await env.flush();poses=0;const started=env.now;await env.step(1749);assert.equal(app.getState().selected,-1);await env.step(1);const chosen=app.getState().selected;assert.ok(chosen>=0);assert.equal(app.getState().drawDurationMs,1750);assert.equal(poses,0,'Standing interpolation is deferred while hidden');
await env.step(1500);const names=app.spaceCards.debug().names,used=app.getState().used,speech=env.speech.spoken.length,camera=app.camera.position.clone(),target=app.controls.target.clone();
operations.length=0;for(let i=0;i<170;i++)await env.step(1000/30);await env.step(1000/30);
assert.equal(app.renderBudget().space.scale,.65);assert.equal(app.renderBudget().classroom.scale,1);assert.equal(app.spaceCards.debug().quality,.65);assert.deepEqual(app.spaceCards.debug().names,names);assert.deepEqual(app.getState().used,used);assert.equal(app.getState().selected,chosen);assert.equal(env.speech.spoken.length,speech);assert.deepEqual(app.camera.position,camera);assert.deepEqual(app.controls.target,target);
for(const [i,event] of operations.entries())if(event.type==='ratio'){assert.ok(operations.slice(i+1).some(e=>e.type==='space-paint'&&e.now===event.now),'Backing ratio changes are repainted synchronously');}
assert.equal(env.frames.size,1,'Quality keeps one RAF');
app.setTheme('classroom');assert.ok(app.people()[chosen].pose>.99,'Returning classroom catches up the standing pose from elapsed time');assert.equal(app.renderBudget().space.scale,.65);assert.equal(app.renderBudget().classroom.scale,1);
app.setTheme('space');assert.equal(app.spaceCards.debug().quality,.65,'Switching themes keeps learned scale');
await env.step(20);const frame=app.spaceCards.debug().frame;window.dispatchEvent({type:'resize'});window.dispatchEvent({type:'resize'});assert.equal(env.frames.size,1,'Resize events do not create a second RAF');await env.step(20);assert.equal(app.spaceCards.debug().frame,frame+1,'Same-size resize does not perform an extra paint');
app.cancelDraw();app.pick();await env.step(350);document.hidden=true;document.dispatchEvent({type:'visibilitychange'});const before={poses,controls,paints,frames:app.spaceCards.debug().frame,used:app.getState().used,speech:env.speech.spoken.length};
for(let i=0;i<5;i++)await env.step(1000);assert.equal(poses,before.poses);assert.equal(controls,before.controls);assert.equal(paints,before.paints);assert.equal(app.spaceCards.debug().frame,before.frames);assert.deepEqual(app.getState().used,before.used);assert.equal(env.frames.size,1);
document.hidden=false;document.dispatchEvent({type:'visibilitychange'});await env.step(1);assert.equal(app.getState().used.length,before.used.length+1,'Resume catches an expired draw up once');const resumed=app.getState().selected;await env.step(3000);assert.equal(app.getState().selected,resumed);assert.equal(env.speech.spoken.length,before.speech,'Returning never replays hidden draw audio/speech');
// Paper owns only its canvas and budget; all hidden classroom and star work stays idle.
window.cancelCountdown();app.cancelDraw();app.setTheme('paper');await env.step(20);await env.step(1800);controls=poses=0;
const hiddenStarFrame=app.spaceCards.debug().frame,sharedRatio=app.renderBudget().pixelRatio,starScale=app.renderBudget().space.scale;
operations.length=0;for(let i=0;i<180;i++)await env.step(1000/60);
assert.equal(controls,0,'Paper frames never update hidden classroom orbit controls');assert.equal(poses,0);assert.equal(app.spaceCards.debug().frame,hiddenStarFrame,'Paper frames never repaint the inactive star adapter');assert.equal(app.renderBudget().paper.scale,1);
app.pick();await env.flush();poses=0;await env.step(599);assert.equal(app.getState().selected,-1);await env.step(1);const paperWinner=app.getState().selected;assert.ok(paperWinner>=0);assert.equal(poses,0);await env.step(1500);
for(let i=0;i<171;i++)await env.step(1000/30);
assert.equal(app.renderBudget().paper.scale,.65);assert.equal(app.paperCards.debug().quality,.65);assert.equal(app.renderBudget().space.scale,starScale);assert.equal(app.renderBudget().classroom.scale,1);assert.equal(app.renderBudget().pixelRatio,sharedRatio);assert.equal(operations.some(e=>e.type==='ratio'),false,'Paper quality never resizes the hidden shared renderer');assert.equal(env.frames.size,1);
app.setTheme('classroom');assert.ok(app.people()[paperWinner].pose>.99);const paperFrame=app.paperCards.debug().frame;await env.step(50);assert.equal(app.paperCards.debug().frame,paperFrame,'Classroom frames never repaint inactive paper');app.setTheme('paper');assert.equal(app.paperCards.debug().quality,.65);
select('timer-minutes',3);$('timer-primary').click();await env.step(500);document.hidden=true;document.dispatchEvent({type:'visibilitychange'});const chimes=env.audio.oscillators.length;await env.step(179600);assert.equal(globalThis.__sharedCountdownQA().snapshot.status,'finished');document.hidden=false;document.dispatchEvent({type:'visibilitychange'});await env.step(20);await env.step(500);assert.equal(env.audio.oscillators.length,chimes+1,'Elapsed timer finishes exactly once across visibility');window.cancelCountdown();
for(const [width,height,bottom] of [[1100,500,220],[1101,500,220],[1150,500,220],[1250,500,220],[1251,500,180],[1100,768,260],[1101,768,220],[1150,768,220],[1250,768,220],[1251,768,210]]){
 await env.resize(width,height);assert.equal(env.viewport.bottom,bottom,'Toolbar reserved height '+width+'×'+height);assert.equal(app.paperCards.debug().width,width);assert.equal(app.paperCards.debug().height,height-40-bottom);assert.equal(env.frames.size,1);
}
console.log('PASS production paper/space inactive classroom work, isolated paper canvas/budget, exact space 1750ms/paper 600ms draw, independent retained render scale, same-task quality repaint without camera refit, one RAF/coalesced resize, standing catch-up, hidden zero render work, expired draw completion once without audio replay, and timer deadline/chime once.');
