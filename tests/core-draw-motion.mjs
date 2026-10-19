import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {register} from 'node:module';

// Run the real scene from both initial OS preferences, including live changes.
// Fixtures execute projection/paint commands, not browser GPU pixels or audio.
if (!process.argv.includes('--child')) {
 for (const preference of ['false', 'true']) {
  const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--child'], {
   env: {...process.env, TEST_REDUCED_MOTION: preference}, stdio: 'inherit'
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `Initial reduced-motion=${preference}`);
 }
} else {
 register('./helpers/theme-scene-loader.mjs', import.meta.url);
 const {setup, dist, $} = await import('./helpers/theme-environment.mjs');
 const {drawTimingForTheme} = await import('../dist/draw-timing.js');
 const fixture = {version:3, activeId:'motion', classes:[{id:'motion', name:'动画测试班', noRepeat:false, sample:false,
  seats:Array.from({length:24}, (_,i)=>({name:`测试同学${i+1}`,row:1+Math.floor(i/8),col:1+i%8}))}], deleted:[]};
 const env = await setup({storage:{'sunlit-classes-v3':JSON.stringify(fixture),'sunlit-theme':'space'}});
 const initial = process.env.TEST_REDUCED_MOTION === 'true';
 let reduced = initial;
 const nativeMatchMedia = globalThis.matchMedia, queries = new Set();
 window.matchMedia = globalThis.matchMedia = query => {
  if (!query.includes('prefers-reduced-motion')) return nativeMatchMedia(query);
  const listeners = new Set();
  const media = {matches:reduced, addEventListener(type,fn){if(type==='change')listeners.add(fn)},
   removeEventListener(type,fn){if(type==='change')listeners.delete(fn)}, listeners};
  queries.add(media); return media;
 };
 const changeMotion = value => {reduced=value;for(const media of queries){media.matches=value;for(const fn of media.listeners)fn({matches:value})}};
 await import(dist+'/scene.js');
 const app=window.classroom; await env.awaitReady(app.ready); env.bindRenderer(app.renderer);
 await import(dist+'/countdown.js'); await env.step(1600); await env.flush();
 const qa=()=>globalThis.__sharedThemeQA(), state=()=>app.getState();
 const clean=async theme=>{window.cancelCountdown();app.cancelDraw();changeMotion(initial);app.setTheme(theme);app.home(true);await env.step(1600);await env.flush();env.randomQueue=Array(1000).fill(0)};
 const at=async time=>{assert.ok(time>=env.now);await env.step(time-env.now);await env.flush()};
 const pose=cards=>cards.map(c=>({id:c.id,x:c.x,y:c.y,z:c.z,width:c.width,height:c.height,facing:c.facing}));
 const visual=theme=>theme==='space'?pose(app.spaceCards.debug().shellCards):theme==='paper'?pose(app.paperCards.debug().cards):app.people().map(p=>({i:p.i,highlight:p.highlight,pose:p.pose}));
 await clean('space');const idle=visual('space');await env.step(160);assert.notDeepEqual(visual('space'),idle,'Idle cards move under either OS preference');
 const results=[];const originalResult=qa().sounds.result;qa().sounds.result=(...args)=>{results.push(args);return originalResult(...args)};

 for(const theme of ['space','paper','classroom']) {
  await clean(theme);
  const start=env.now, duration=drawTimingForTheme(theme).total, used=state().used, before=results.length, randomBefore=env.randomCalls;
  app.pick();await env.flush();const generation=qa().drawGeneration, acceptedRandomCalls=env.randomCalls;
  for(let i=0;i<4;i++){app.pick();env.key('Space')}
  assert.equal(qa().drawGeneration,generation);assert.equal(env.randomCalls,acceptedRandomCalls);
  assert.equal(state().drawDurationMs,duration);assert.equal(state().selected,-1);
  await at(start+(theme==='space'?450:theme==='paper'?150:100));
  const first=visual(theme);
  if(theme==='space'){
   const d=app.spaceCards.debug();assert.equal(d.stage,'rotate');assert.equal(d.shellCards.length,96);
   assert.ok(d.shellCards.every(c=>c.shellMix===1&&c.mesh.length===9));
   assert.ok(d.shellCards.every(c=>Math.abs(Math.hypot(c.x,c.y,c.z-d.sphereCenter.z)-d.sphereRadius)<1e-8));
   assert.ok(d.shellCards.filter(c=>c.facing<-.5).every(c=>c.shade>=.79&&c.shade<=.81));
  } else if(theme==='paper'){
   const d=app.paperCards.debug(), hero=d.cards.find(c=>c.selected);assert.equal(d.stage,'flip');
   assert.equal(hero.phase,.25);assert.ok(hero.rotation.y>Math.PI&&hero.rotation.y<2*Math.PI);
  } else assert.equal(app.people().filter(p=>p.highlight).length,1);
  changeMotion(!initial);assert.deepEqual(visual(theme),first,'OS preference change cannot skip/reset the current draw');
  changeMotion(initial);assert.deepEqual(visual(theme),first);
  await at(start+(theme==='space'?850:theme==='paper'?450:400));
  assert.notDeepEqual(visual(theme),first,`${theme} core effect advances under reduced-motion=${initial}`);
  if(theme==='paper'){
   assert.equal(app.paperCards.debug().cards.find(c=>c.selected).phase,.75);
   const nonselected=app.paperCards.debug().cards.filter(c=>!c.selected).map(c=>c.id);
   assert.deepEqual(visual(theme).filter(c=>nonselected.includes(c.id)),first.filter(c=>nonselected.includes(c.id)));
  }
  for(const other of ['space','paper','classroom',theme])app.setTheme(other);
  assert.equal(qa().drawStart,start);assert.equal(state().drawDurationMs,duration);
  await at(start+duration-1);assert.equal(state().selected,-1);assert.deepEqual(state().used,used);assert.equal(results.length,before);
  await at(start+duration);assert.equal(state().selected,0);assert.equal(results.length,before+1);
  assert.deepEqual(state().used,[...new Set([...used,0])]);
  assert.equal(app.spaceCards.debug().winner,state().names[0]);assert.equal(app.paperCards.debug().winner,state().names[0]);
  if(theme==='paper')assert.equal(app.paperCards.debug().resultSettling,false);
  if(theme==='space'){
   const width=app.spaceCards.debug().selectedCard.width;await env.step(180);
   assert.ok(app.spaceCards.debug().selectedCard.width>width,'Winner presentation keeps its normal 360ms motion');
  }
  if(theme==='classroom'){
   const p=app.people()[0], position=app.camera.position.clone();await env.step(100);
   assert.ok(p.pose>0,'Winner stands up');assert.ok(app.camera.position.distanceTo(position)>0,'Core result camera still moves');
  }
  await env.step(1600);await env.flush();assert.equal(state().busy,false);assert.equal(results.length,before+1);
  assert.ok(env.randomCalls>randomBefore);assert.equal(env.frames.size,1);
  // Cancellation discards the current draw; a later start completes normally.
  app.pick();await env.step(100);app.cancelDraw();const cancelledUsed=state().used, cancelledResults=results.length;
  await env.step(duration+1500);assert.equal(results.length,cancelledResults);assert.deepEqual(state().used,cancelledUsed);
  app.pick();await env.advance(duration,{step:50});assert.equal(results.length,cancelledResults+1);app.cancelDraw();
  // Countdown takeover remains authoritative and cannot produce a late winner.
  app.pick();await env.step(100);const timerResults=results.length;$('timer-primary').click();await env.step(duration+1500);
  assert.equal(results.length,timerResults);assert.equal(qa().drawStart,null);assert.equal(qa().boardMode,true);
  window.cancelCountdown();app.cancelDraw();
 }

 // Characterization, not a scheduler fix: a first RAF after the 1750ms deadline
 // commits before rendering the sphere. Keep that separate from the OS gate.
 await clean('space');
 const frames=[], nativeRender=app.spaceCards.render.bind(app.spaceCards);
 app.spaceCards.render=now=>{const result=nativeRender(now);frames.push(app.spaceCards.debug().stage);return result};
 const before=results.length;app.pick();await env.flush();assert.equal(state().selected,-1);
 await env.step(1800);assert.equal(results.length,before+1);assert.equal(state().selected,0);
 assert.deepEqual(frames,['selected'],'Known delayed-first-RAF limitation is unchanged');
 app.spaceCards.render=nativeRender;app.cancelDraw();
 assert.equal(queries.size,0,'App must never consult or subscribe to OS reduced motion');
 console.log(`PASS core draw motion (initial reduced-motion=${initial}): sphere geometry/rotation, paper flip, classroom highlight/stand/camera, live preference switches, exact deadlines/winner, busy guard, theme switches, cancel/restart and timer takeover. Characterized unchanged >1750ms first-RAF gap.`);
}
