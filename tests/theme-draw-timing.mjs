import assert from 'node:assert/strict';
import {register} from 'node:module';
import {CLASSROOM_DRAW_TIMING,SPACE_DRAW_TIMING,PAPER_DRAW_TIMING,drawTimingForTheme} from '../dist/draw-timing.js';
import {drumrollExcerpt} from '../dist/drumroll.js';

register('./helpers/theme-scene-loader.mjs',import.meta.url);
const {setup,dist,$,select}=await import('./helpers/theme-environment.mjs');
const classes={version:3,activeId:'timing',classes:[{id:'timing',name:'时长回归验证',seats:Array.from({length:24},(_,i)=>({name:`学生${i+1}`,row:Math.floor(i/8)+1,col:i%8+1})),used:[],noRepeat:true,sample:false}],deleted:[]};
const env=await setup({storage:{'sunlit-classes-v3':JSON.stringify(classes),'sunlit-theme':process.env.INITIAL_THEME||'classroom','sunlit-draw-seconds':'3'}});
const obsoleteAccess=[],get=localStorage.getItem.bind(localStorage),set=localStorage.setItem.bind(localStorage);
localStorage.getItem=key=>{if(key==='sunlit-draw-seconds'){obsoleteAccess.push(['read',key]);throw Error('Obsolete duration must never be read')}return get(key)};
localStorage.setItem=(key,value)=>{if(key==='sunlit-draw-seconds'){obsoleteAccess.push(['write',key]);throw Error('Obsolete duration must never be written')}return set(key,value)};
if(process.env.COUNTDOWN_FIRST)await import(dist+'/countdown.js');
await import(dist+'/scene.js');
const app=window.classroom;await env.awaitReady(app.ready);env.bindRenderer(app.renderer);
if(!process.env.COUNTDOWN_FIRST)await import(dist+'/countdown.js');
await env.step(1600);await env.flush();

assert.equal(globalThis.__sharedCountdownQA().selectedMinutes,2,'Fresh page defaults to two minutes');
assert.equal(globalThis.__sharedCountdownQA().snapshot.remaining,120000,'Ready state matches selected two minutes');
$('timer-primary').click();assert.equal(globalThis.__sharedCountdownQA().snapshot.duration,120000,'First unmodified start uses two minutes');window.cancelCountdown();

const qa=()=>globalThis.__sharedThemeQA(),timer=()=>globalThis.__sharedCountdownQA(),state=()=>app.getState(),debug=()=>app.spaceCards.debug();
const shared=()=>{const {theme,software,...snapshot}=state();return snapshot};
const events=[];
for(const method of ['start','reveal','cancel']){const original=app.spaceCards[method].bind(app.spaceCards);app.spaceCards[method]=(...args)=>{events.push({kind:method,args,at:env.now});return original(...args)}}
for(const method of ['start','reveal','cancel']){const original=app.paperCards[method].bind(app.paperCards);app.paperCards[method]=(...args)=>{events.push({kind:'paper.'+method,args,at:env.now});return original(...args)}}
for(const method of ['begin','result','stop']){const original=qa().sounds[method];qa().sounds[method]=(...args)=>{events.push({kind:'sounds.'+method,args,at:env.now});return original(...args)}}
let checks=0;
async function test(name,fn){await fn();checks++;console.log('PASS',name)}
const eventsAfter=(kind,offset)=>events.slice(offset).filter(event=>event.kind===kind);
const advanceTo=async at=>{assert.ok(at>=env.now);await env.step(at-env.now);await env.flush()};
const clean=async theme=>{window.cancelCountdown();app.cancelDraw();app.setTheme(theme);await env.step(1250);env.randomQueue=Array(10000).fill(0)};

await test('immutable profiles keep classroom 1000ms and space 1750ms, with paper one 600ms flip',()=>{
 for(const timing of [CLASSROOM_DRAW_TIMING,SPACE_DRAW_TIMING,PAPER_DRAW_TIMING]){assert.equal(Object.isFrozen(timing),true);assert.equal(timing.gather+timing.rotate+timing.scatter,timing.total)}
 assert.deepEqual([CLASSROOM_DRAW_TIMING.gather,CLASSROOM_DRAW_TIMING.rotate,CLASSROOM_DRAW_TIMING.scatter,CLASSROOM_DRAW_TIMING.total],[180,600,220,1000]);
 assert.deepEqual([SPACE_DRAW_TIMING.gather,SPACE_DRAW_TIMING.rotate,SPACE_DRAW_TIMING.scatter,SPACE_DRAW_TIMING.total],[400,1000,350,1750]);
 assert.equal(drawTimingForTheme('classroom'),CLASSROOM_DRAW_TIMING);assert.equal(drawTimingForTheme('space'),SPACE_DRAW_TIMING);assert.equal(drawTimingForTheme('paper'),PAPER_DRAW_TIMING);assert.deepEqual(PAPER_DRAW_TIMING,{gather:0,rotate:600,scatter:0,total:600,turn:Math.PI});assert.notEqual(PAPER_DRAW_TIMING,SPACE_DRAW_TIMING);
});

await test('extended suspense never reads the cymbal; classroom PCM remains byte-identical',()=>{
 const rate=10000,data=Float32Array.from({length:rate*4},(_,i)=>i>=rate*3?999:Math.sin(i*.021)*.12);
 const sample={sampleRate:rate,numberOfChannels:1,getChannelData:()=>data};
 const context={createBuffer(channels,length,sampleRate){const channelData=Array.from({length:channels},()=>new Float32Array(length));return {length,sampleRate,duration:length/sampleRate,getChannelData:c=>channelData[c]}}};
 const long=drumrollExcerpt(sample,1750,context);assert.equal(long.duration,1.75);assert.ok(long.getChannelData(0).every(value=>Number.isFinite(value)&&Math.abs(value)<1));
 const short=drumrollExcerpt(sample,1000,context),reference=new Float32Array(rate);
 for(let i=0;i<rate;i++){const attack=Math.min(1,i/(.012*rate)),release=Math.min(1,(rate-1-i)/(.025*rate)),build=.72+.28*i/(rate-1);reference[i]=data[rate*2+i]*attack*release*build*2}
 assert.deepEqual(short.getChannelData(0),reference);
});

for(const theme of ['space','classroom','paper']){
 const timing=drawTimingForTheme(theme),other=theme==='space'?'classroom':'space';
 await clean(theme);const start=env.now,before=events.length,audioBefore=env.audio.voices.length,speechBefore=env.speech.spoken.length,usedBefore=[...state().used];
 app.pick();await env.flush();const generation=qa().drawGeneration,usedIdentity=qa().usedSet;
 await test(`${theme}: accepted start snapshots exact renderer, suspense and winner deadline`,()=>{
  assert.equal(qa().drawStart,start);assert.equal(state().drawDurationMs,timing.total);assert.equal(state().selected,-1);assert.equal(state().busy,true);
  assert.deepEqual(eventsAfter('sounds.begin',before).map(e=>e.args),[[timing.total,start]]);
  assert.equal(eventsAfter('start',before).length,1);assert.equal(eventsAfter('start',before)[0].args[1],timing);assert.deepEqual(eventsAfter('paper.start',before).map(e=>e.args),eventsAfter('start',before).map(e=>e.args));
  assert.deepEqual(debug().timing,timing);assert.equal(debug().startedAt,start);assert.equal(env.audio.voices.length,audioBefore+1);assert.equal(env.audio.voices.at(-1).buffer.duration,timing.total/1000);
  assert.equal(qa().drawTimeline.length,Math.round(timing.total/1000*18));assert.ok(qa().drawTimeline.every(t=>t>=0&&t<timing.total));
 });
 if(theme!=='paper'){await advanceTo(start+timing.gather-1);app.setTheme('space');assert.equal(debug().stage,'gather');await advanceTo(start+timing.gather);assert.equal(debug().stage,'rotate')}else{app.setTheme('space');assert.equal(debug().stage,'rotate')}
 const snapshot=shared();app.setTheme(other);
 await test(`${theme}: repeated switches preserve snapshot, busy guard and original audio`,()=>{
  for(let i=0;i<12;i++){app.setTheme(['classroom','space','paper'][i%3]);app.pick();env.key('Space')}
  assert.deepEqual(shared(),snapshot);assert.equal(qa().drawGeneration,generation);assert.equal(qa().drawStart,start);assert.equal(qa().usedSet,usedIdentity);
  assert.deepEqual(debug().timing,timing);assert.equal(eventsAfter('start',before).length,1);assert.equal(eventsAfter('sounds.begin',before).length,1);assert.equal(env.audio.voices.length,audioBefore+1);
 });
 if(theme==='space'){
  await advanceTo(start+1000);app.setTheme('space');
  await test('space: former 1000ms deadline cannot reveal or speak',()=>{assert.equal(state().selected,-1);assert.deepEqual(state().used,usedBefore);assert.equal(debug().stage,'rotate');assert.equal(eventsAfter('reveal',before).length,0);assert.equal(env.speech.spoken.length,speechBefore)});
 }
 if(theme!=='paper'){await advanceTo(start+timing.gather+timing.rotate-1);app.setTheme('space');assert.equal(debug().stage,'rotate');await advanceTo(start+timing.gather+timing.rotate);assert.equal(debug().stage,'disperse')}
 app.setTheme(other);await advanceTo(start+timing.total-1);app.setTheme('space');
 await test(`${theme}: no winner one millisecond before the original deadline`,()=>{assert.equal(state().selected,-1);assert.deepEqual(state().used,usedBefore);assert.equal(qa().drawStart,start);assert.equal(debug().stage,theme==='paper'?'rotate':'disperse');assert.equal(debug().winner,'');assert.equal(env.speech.spoken.length,speechBefore);assert.equal(eventsAfter('sounds.result',before).length,0)});
 app.setTheme(other);await advanceTo(start+timing.total);const winner=state().selected;
 await test(`${theme}: exactly one authoritative winner at ${timing.total}ms`,()=>{
  assert.ok(winner>=0);assert.equal(usedBefore.includes(winner),false);assert.deepEqual(state().used,[...usedBefore,winner]);assert.equal(qa().drawStart,null);
  assert.deepEqual(eventsAfter('reveal',before).map(e=>[e.args[0],e.at]),[[state().names[winner],start+timing.total]]);
  assert.deepEqual(eventsAfter('sounds.result',before).map(e=>e.args),[[state().names[winner]]]);assert.equal(debug().winner,state().names[winner]);assert.equal(app.paperCards.debug().winner,state().names[winner]);assert.deepEqual(eventsAfter('paper.reveal',before).map(e=>e.args),eventsAfter('reveal',before).map(e=>[...e.args,winner]));
  assert.equal(env.audio.voices[audioBefore].stopped,start+timing.total);assert.equal(env.audio.voices.at(-1).buffer.duration,.65);assert.equal(env.audio.voices.at(-1).started,start+timing.total);
 });
 await advanceTo(start+timing.total+669);app.setTheme(theme);assert.equal(env.speech.spoken.length,speechBefore);
 await advanceTo(start+timing.total+670);
 await test(`${theme}: one local name readout only after the reveal sound`,()=>{assert.equal(env.speech.spoken.length,speechBefore+1);assert.equal(env.speech.spoken.at(-1).at,start+timing.total+670);assert.equal(env.speech.spoken.at(-1).utterance.text,state().names[winner]);assert.equal(env.speech.spoken.at(-1).utterance.voice,env.speech.localVoice);assert.equal(env.speech.spoken.at(-1).utterance.volume,1);assert.equal(env.speech.spoken.at(-1).utterance.rate,.88)});
 app.setTheme(other);await advanceTo(start+timing.total+1200);app.setTheme(theme);await env.step(2500);
 await test(`${theme}: result switches cannot repeat sound/speech or restart the completed draw`,()=>{assert.equal(state().busy,false);assert.equal(state().selected,winner);assert.equal(qa().drawGeneration,generation);assert.equal(eventsAfter('start',before).length,1);assert.equal(eventsAfter('reveal',before).length,1);assert.equal(env.speech.spoken.length,speechBefore+1)});
}

await test('cancelled long draw cannot reveal or speak after its original deadline',async()=>{
 await clean('space');const start=env.now,before=events.length,used=[...state().used],spoken=env.speech.spoken.length;app.pick();await env.flush();await env.step(1400);app.setTheme('classroom');app.cancelDraw();
 assert.equal(qa().drawStart,null);assert.equal(state().busy,false);assert.equal(debug().drawing,false);
 await advanceTo(start+SPACE_DRAW_TIMING.total+2000);assert.equal(state().selected,-1);assert.deepEqual(state().used,used);assert.equal(eventsAfter('reveal',before).length,0);assert.equal(env.speech.spoken.length,spoken);
});

await test('cancel/restart selects the new theme profile and never revives the superseded draw',async()=>{
 await clean('space');const oldStart=env.now,before=events.length,spoken=env.speech.spoken.length;app.pick();await env.flush();await env.step(500);app.cancelDraw();app.setTheme('classroom');const nextStart=env.now;app.pick();await env.flush();
 assert.deepEqual(eventsAfter('sounds.begin',before).map(e=>e.args),[[1750,oldStart],[1000,nextStart]]);
 await advanceTo(nextStart+999);assert.equal(state().selected,-1);await advanceTo(nextStart+1000);const winner=state().selected;assert.ok(winner>=0);
 await advanceTo(nextStart+1670);assert.equal(env.speech.spoken.length,spoken+1);await advanceTo(oldStart+1750+2000);
 assert.equal(state().selected,winner);assert.equal(eventsAfter('reveal',before).length,1);assert.equal(env.speech.spoken.length,spoken+1);assert.equal(state().busy,false);
});

for(const theme of ['space','classroom','paper']){
 await test(`${theme}: ten minute choice stages the next restart without changing the active deadline`,async()=>{
  await clean(theme);select('timer-minutes',3);$('timer-primary').click();assert.equal(timer().snapshot.duration,180000);
  await env.step(1000);select('timer-minutes',10);assert.equal(timer().snapshot.duration,180000);assert.equal(timer().snapshot.remaining,179000);
  $('timer-primary').click();assert.equal(timer().snapshot.duration,600000);assert.equal(timer().snapshot.remaining,600000);
  assert.equal($('timer-mini').textContent,'10:00');await env.step(1000);assert.equal($('timer-mini').textContent,'09:59');
  app.setTheme(theme==='space'?'classroom':'space');assert.equal(timer().snapshot.remaining,599000);window.cancelCountdown();
 });
 await test(`${theme}: timer supersedes active draw without late winner or speech`,async()=>{
  await clean(theme);const before=events.length,spoken=env.speech.spoken.length,used=[...state().used];app.pick();await env.flush();await env.step(350);select('timer-minutes',10);$('timer-primary').click();const deadline=env.now+600000;
  assert.equal(qa().drawStart,null);assert.equal(state().busy,false);assert.equal(timer().snapshot.status,'running');app.setTheme(theme==='space'?'classroom':'space');await env.step(5000);
  assert.equal(eventsAfter('reveal',before).length,0);assert.equal(env.speech.spoken.length,spoken);assert.deepEqual(state().used,used);assert.equal(timer().snapshot.remaining,deadline-env.now);window.cancelCountdown();
 });
 await test(`${theme}: timer during reveal tail cancels pending name readout`,async()=>{
  await clean(theme);const spoken=env.speech.spoken.length;app.pick();await env.flush();await env.step(drawTimingForTheme(theme).total);const winner=state().selected;assert.ok(winner>=0);await env.step(200);$('timer-primary').click();await env.step(1500);
  assert.equal(env.speech.spoken.length,spoken);assert.equal(state().selected,winner);assert.equal(qa().drawStart,null);assert.equal(timer().snapshot.status,'running');window.cancelCountdown();
 });
 await test(`${theme}: accepted pick at timer deadline cancels stale chime`,async()=>{
  await clean(theme);select('timer-minutes',10);$('timer-primary').click();const chimes=env.audio.oscillators.length;env.now+=600000;const start=env.now;app.pick();await env.flush();
  assert.equal(env.audio.oscillators.length,chimes);assert.equal(timer().snapshot.status,'ready');assert.equal(qa().boardMode,false);assert.equal(state().drawDurationMs,drawTimingForTheme(theme).total);
  await advanceTo(start+drawTimingForTheme(theme).total-1);assert.equal(state().selected,-1);await env.step(1);assert.ok(state().selected>=0);assert.equal(env.audio.oscillators.length,chimes);app.cancelDraw();
 });
}

await test('obsolete user-selected duration is never read or written',()=>assert.deepEqual(obsoleteAccess,[]));
window.cancelCountdown();app.cancelDraw();
console.log(`PASS ${checks} actual production scene timing checks (${process.env.COUNTDOWN_FIRST?'countdown-first':'scene-first'}; initial ${process.env.INITIAL_THEME||'classroom'}). Production renderer logic runs on a recording Canvas surface; DOM, clock, AudioContext and speech use deterministic fixtures.`);
