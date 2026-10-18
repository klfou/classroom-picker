import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./helpers/theme-scene-loader.mjs',import.meta.url);
const {setup,dist}=await import('./helpers/theme-environment.mjs');
const env=await setup({storage:{'sunlit-theme':'classroom'}});
let id=0;const idle=new Map();globalThis.requestIdleCallback=fn=>{idle.set(++id,fn);return id};globalThis.cancelIdleCallback=id=>idle.delete(id);
const fonts=[];document.fonts={load:async(font,text)=>{fonts.push({font,text})}};
await import(dist+'/scene.js');const app=window.classroom;await env.awaitReady(app.ready);env.bindRenderer(app.renderer);await import(dist+'/countdown.js');
// A click before any idle callback remains immediate and follows normal timing.
app.setTheme('paper');const earlyJobs=app.preparation().remaining;app.pick();assert.equal(app.getState().busy,true);await env.step(300);assert.equal(app.paperCards.debug().stage,'flip');assert.equal(app.getState().selected,-1);assert.equal(app.preparation().remaining,earlyJobs);app.cancelDraw();assert.deepEqual(app.getState().used,[]);app.setTheme('classroom');
const initialGeneration=app.preparation().generation;app.setTheme('space');assert.equal(app.preparation().pending,false,'Space retains its existing resource path with no new warmup queue');app.setTheme('paper');assert.ok(app.preparation().generation>initialGeneration);assert.ok(app.preparation().remaining<10,'Card themes replace the queued model jobs');app.setTheme('classroom');
const before=app.getState(),random=env.randomCalls,frame=app.paperCards.debug().frame;
const tick=async()=>{const next=idle.entries().next().value;if(next){idle.delete(next[0]);next[1]({didTimeout:false,timeRemaining:()=>10})}await env.flush()};
for(let i=0;i<150&&app.preparation().pending;i++){await tick();if(app.preparation().pending&&!idle.size)await env.waitReal(1)}
assert.equal(app.preparation().pending,false);assert.equal(app.preparation().errors,0);assert.equal(fonts.length,3);
assert.deepEqual(app.getState(),before);assert.equal(env.randomCalls,random);assert.equal(env.frames.size,1);assert.equal(app.paperCards.debug().frame,frame,'Preparation never paints a hidden/shared output or replays an animation');
const definitions=[...new Set(app.people().map(p=>p.avatar.def))];assert.equal(definitions.length,2);assert.ok(definitions.every(d=>d.cache.size===25));
app.setTheme('paper');const readyFrame=app.paperCards.debug().frame;app.pick();assert.equal(app.paperCards.debug().frame,readyFrame+1,'The real flip starts with exactly one paint, rather than start plus prepare');
const draw=app.getState(),calls=env.randomCalls;for(let i=0;i<3;i++)app.pick();assert.equal(env.randomCalls,calls);await env.step(599);assert.equal(app.getState().selected,-1);await env.step(1);assert.ok(app.getState().selected>=0);assert.equal(draw.drawDurationMs,600);assert.ok(definitions.every(d=>d.cache.size===25));
app.cancelDraw();const generation=app.preparation().generation;app.applyRoster([{name:'新同学',row:1,col:1}],false);assert.ok(app.preparation().generation>generation);assert.deepEqual(app.getState().names,['新同学']);
document.hidden=true;const left=app.preparation().remaining;await tick();assert.equal(app.preparation().remaining,left);document.hidden=false;await env.step(80);await env.flush();
app.pick();await tick();assert.ok(app.preparation().remaining<=left,'A queued warmup cannot compete with a draw');app.cancelDraw();
for(let i=0;i<100&&app.preparation().pending;i++){await env.step(80);await tick()}assert.equal(app.preparation().pending,false);assert.deepEqual(app.getState().names,['新同学']);assert.equal(app.getState().selected,-1);assert.equal(app.paperCards.debug().pendingName,'');
delete globalThis.requestIdleCallback;delete globalThis.cancelIdleCallback;
console.log('PASS production resource preparation without winner/RNG/session/time changes, bounded shared pose caches, single-paint paper pick, exact 600ms result, repeated clicks, hidden/busy pause and roster invalidation.');
