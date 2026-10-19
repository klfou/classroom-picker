import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {register} from 'node:module';
import {createHash} from 'node:crypto';
register('./helpers/orbit-scene-loader.mjs',import.meta.url);
const {setup,$,select}=await import('./helpers/orbit-environment.mjs');
const dist=path.resolve(process.env.ORBIT_DIST||fileURLToPath(new URL('../dist',import.meta.url)));
const roster=count=>Array.from({length:count},(_,i)=>({id:`qa-${count}-${i}`,name:i<2?'同名同学':`轨道同学${i+1}`,row:Math.floor(i/8)+1,col:i%8+1,gender:i%2?'male':'female'}));
const classSeed={version:3,activeId:'qa',classes:[{id:'qa',name:'轨道独立验证班',seats:roster(64),sample:false,noRepeat:false,used:[]}],deleted:[]};
const env=await setup({dist,assetRoot:process.env.ORBIT_ASSET_ROOT||dist,baseURL:process.env.ORBIT_BASE_URL||'http://classroom.test/',storage:{'sunlit-classes-v3':JSON.stringify(classSeed),'sunlit-classes-v3-backup':JSON.stringify(classSeed),'sunlit-theme':'paper'}});
await import(pathToFileURL(path.join(dist,'scene.js')).href);
const app=window.classroom;await env.awaitReady(app.ready);env.bindRenderer(app.renderer);
await import(pathToFileURL(path.join(dist,'countdown.js')).href);await env.step(1600);await env.flush();
const state=()=>app.getState(),qa=()=>__orbitHostQA(),timer=()=>__orbitCountdownQA(),view=()=>app.spaceCards.debug(true);
const calls=[];for(const [label,object,methods]of [['space',app.spaceCards,['start','reveal','cancel']],['sounds',qa().sounds,['begin','result','stop']]])for(const method of methods){const original=object[method].bind(object);object[method]=(...args)=>{calls.push({kind:label+'.'+method,args,at:env.now});return original(...args)}}
const since=(kind,offset)=>calls.slice(offset).filter(c=>c.kind===kind);
const at=async time=>{assert.ok(time>=env.now,`${time} >= ${env.now}`);await env.step(time-env.now);await env.flush()};
const clean=async()=>{document.hidden=false;window.cancelCountdown();app.cancelDraw();app.setTheme('space');$('overview').click();await env.step(1600);await env.flush()};
const mode=once=>$(once?'repeat-once':'repeat-allow').click();
const exactWinner=(index)=>{const d=view();assert.equal(d.mode,'selected');assert.equal(d.winner,state().names[index]);assert.equal(d.selectedCard.rosterIndex,index,'Duplicate names preserve original roster index');assert.equal(d.selectedCard.name,state().names[index]);assert.equal(d.shellCards.length,0,'Exactly one card survives result commit');assert.equal(d.visibleCardCount,1,'Settled result has exactly one visible card');return d};
const reports=[];let count=0;
const test=async(name,run)=>{const detail=await run();reports.push({name,...detail});count++;console.log('PASS '+name)};

await test('Fresh preview defaults to orbit, preserves original theme preference, and keeps 1–10 minute selector default 2',()=>{
 assert.equal(state().theme,'space');assert.equal(localStorage.getItem('sunlit-theme'),'paper');assert.equal(timer().selectedMinutes,2);assert.equal($('timer-minutes').value,'2');assert.deepEqual($('timer-minutes').children.map(e=>e.getAttribute('value')),Array.from({length:10},(_,i)=>String(i+1)));assert.equal(env.frames.size,1);assert.equal(view().backend,'canvas');assert.equal(env.assetErrors.length,0);return {backend:'recording Canvas fixture',rafOwners:env.frames.size};
});

for(const reduced of [false,true])for(const size of [1,2,64,128])await test(`${size} students / ${reduced?'reduced':'normal'} motion: real button → sole RAF → one original-index winner`,async()=>{
 await clean();env.setReducedMotion(reduced);assert.equal(app.applyRoster(roster(size)),true);mode(false);await env.step(16);await env.flush();
 const initial=view();assert.equal(initial.cardCount,size,'Ordered preview keeps one physical card per real roster identity');assert.ok(initial.shellCardCount>=Math.max(initial.cardCount,size)&&initial.shellCardCount<=128);assert.equal('reducedMotion' in initial,false);
 const before=calls.length,spoken=env.speech.spoken.length,used=state().used,start=env.now;env.randomQueue=Array(1000).fill(0);$('pick').click();await env.flush();
 assert.equal(state().busy,true);assert.equal(qa().drawStart,start);assert.equal(state().drawDurationMs,1750);assert.deepEqual(view().timing,{gather:400,rotate:1000,scatter:350,total:1750,turn:Math.PI*1.55});assert.deepEqual(qa().drawCandidates,Array.from({length:size},(_,i)=>i));
 const generation=qa().drawGeneration;
 for(const [offset,stage]of [[0,'gather'],[200,'gather'],[400,'rotate'],[900,'rotate'],[1399,'rotate'],[1400,'disperse'],[1749,'disperse']]){
  await at(start+offset);const d=view();assert.equal(d.stage,stage);assert.equal(d.selectedCard,null);assert.equal(d.winner,'');assert.equal(state().selected,-1);assert.deepEqual(state().used,used);assert.equal(since('sounds.result',before).length,0);assert.equal(env.speech.spoken.length,spoken);assert.equal(env.frames.size,1);assert.ok(d.shellCards.every((c,i,a)=>!i||a[i-1].z>=c.z));assert.ok(d.shellCards.every(c=>['x','y','z','width','height','facing'].every(key=>Number.isFinite(c[key]))),'Projected card geometry remains finite');
  if(offset>=400&&offset<=1399)assert.ok(d.cards.every(c=>c.shellMix===1),'Sphere gathers under either OS preference');
  $('pick').click();env.key('Space');assert.equal(qa().drawGeneration,generation,'Busy requests cannot create another draw');
 }
 app.finishPick();assert.equal(state().selected,-1,'An early finish cannot commit');assert.equal(since('space.reveal',before).length,0);
 const winner=size===1?0:1;env.randomQueue=[winner];await at(start+1750);
 assert.equal(state().selected,winner);assert.deepEqual(state().used,[winner]);assert.equal(since('sounds.begin',before).length,1);assert.equal(since('sounds.result',before).length,1);assert.equal(since('space.reveal',before).length,1);assert.deepEqual(since('space.reveal',before)[0].args,[state().names[winner],start+1750,winner]);assert.equal(env.speech.spoken.length,spoken,'No voice before its postcommit delay');
 const selected=view().selectedCard,source=view().cards.find(c=>c.id===selected.sourceCardId);assert.equal(source.rosterIndex,winner);
 for(const key of ['x','y','z','width','height','screenX','screenY'])assert.ok(Math.abs(selected[key]-source[key])<1e-8,`${key}: reveal begins at matching current card pose`);
 app.finishPick();app.finishPick();assert.equal(since('sounds.result',before).length,1);
 await at(start+2110);const settled=exactWinner(winner);assert.ok(settled.selectedCard.frontRim.every(p=>p.x>=0&&p.x<=settled.width&&p.y>=0&&p.y<=settled.height));
 await at(start+2420);assert.equal(env.speech.spoken.length,spoken+1);assert.equal(env.speech.spoken.at(-1).utterance.text,state().names[winner]);assert.equal(env.speech.spoken.at(-1).utterance.voice.localService,true);
 await at(start+4000);assert.equal(state().busy,false);assert.equal(env.speech.spoken.length,spoken+1);assert.equal(since('sounds.result',before).length,1);assert.equal(env.frames.size,1);
 return {rosterCount:size,motion:reduced?'reduced':'normal',commitMs:1750,resultSettleMs:360,selectedIndex:winner,spokenNames:1,artBytes:settled.resources.art.cpuBytes};
});

await test('Cancellation during each phase and postcommit voice delay leaves no late winner or duplicate speech',async()=>{
 env.setReducedMotion(false);const entries=[];
 for(const offset of [0,200,400,900,1400,1749]){
  await clean();assert.equal(app.applyRoster(roster(64)),true);mode(false);const before=calls.length,spoken=env.speech.spoken.length,start=env.now;env.randomQueue=Array(1000).fill(0);$('pick').click();await env.flush();await at(start+offset);app.cancelDraw();const generation=qa().drawGeneration;await env.step(5000);await env.flush();assert.equal(state().busy,false);assert.equal(state().selected,-1);assert.deepEqual(state().used,[]);assert.equal(view().winner,'');assert.equal(since('space.reveal',before).length,0);assert.equal(since('sounds.result',before).length,0);assert.equal(env.speech.spoken.length,spoken);assert.equal(qa().drawGeneration,generation);assert.equal(env.frames.size,1);entries.push(offset);
 }
 await clean();const spoken=env.speech.spoken.length;env.randomQueue=Array(1000).fill(0);$('pick').click();await env.flush();await env.step(1750);app.cancelDraw();await env.step(2000);await env.flush();assert.equal(env.speech.spoken.length,spoken,'Cancel suppresses a queued, not-yet-spoken result');
 return {cancelOffsetsMs:entries,postcommitQueuedVoiceCancelled:true};
});

await test('All countdown choices 1–10 work through real control, default2 is independent, invalid inputs reset2',async()=>{
 await clean();assert.equal(app.applyRoster(roster(2)),true);env.setReducedMotion(false);
 for(let minutes=1;minutes<=10;minutes++){
  select('timer-minutes',minutes);const before=calls.length,spoken=env.speech.spoken.length,start=env.now;$('timer-primary').click();await env.flush();assert.equal(timer().selectedMinutes,minutes);assert.equal(timer().snapshot.remaining,minutes*60000);assert.equal(timer().snapshot.status,'running');assert.equal(qa().boardMode,true);assert.equal(view().countdown.state,'running');await env.step(1234);assert.equal(timer().snapshot.remaining,minutes*60000-1234);assert.equal(env.speech.spoken.length,spoken);assert.equal(since('sounds.result',before).length,0);
  for(const theme of ['paper','classroom','space']){app.setTheme(theme);assert.equal(timer().snapshot.remaining,minutes*60000-(env.now-start));assert.equal(timer().snapshot.status,'running');assert.equal(env.frames.size,1)}window.cancelCountdown();assert.equal(timer().snapshot.status,'ready');assert.equal(view().countdown,null);
 }
 for(const invalid of ['0','11','NaN','2.5']){select('timer-minutes',invalid);assert.equal(timer().selectedMinutes,2);assert.equal($('timer-minutes').value,'2')}
 select('timer-minutes',1);$('timer-primary').click();const voices=env.audio.oscillators.length;await env.step(60000);await env.flush();assert.equal(timer().snapshot.status,'finished');assert.equal($('timer-announcement').textContent,'背书时间到');assert.equal(env.audio.oscillators.length,voices+1);await env.step(1000);assert.equal(env.audio.oscillators.length,voices+1,'Finish chime happens only once');window.cancelCountdown();
 return {minuteChoices:10,invalidFallback:2,finishChimes:1};
});

await test('Draw ↔ countdown interruption prevents stale selection and stale timer chime',async()=>{
 await clean();assert.equal(app.applyRoster(roster(2)),true);mode(false);const before=calls.length,spoken=env.speech.spoken.length;env.randomQueue=Array(1000).fill(0);$('pick').click();await env.flush();await env.step(900);select('timer-minutes',2);$('timer-primary').click();await env.step(4000);assert.equal(state().selected,-1);assert.deepEqual(state().used,[]);assert.equal(since('sounds.result',before).length,0);assert.equal(env.speech.spoken.length,spoken);assert.equal(timer().snapshot.status,'running');
 const oscillators=env.audio.oscillators.length;env.randomQueue=Array(1000).fill(0);$('pick').click();await env.flush();assert.equal(timer().snapshot.status,'ready');assert.equal(qa().boardMode,false);await env.step(1750);await env.step(2000);assert.equal(since('sounds.result',before).length,1);assert.equal(env.speech.spoken.length,spoken+1);await env.step(120000);assert.equal(env.audio.oscillators.length,oscillators,'Cancelled countdown never emits a stale deadline chime');
});

await test('Real theme buttons preserve origin deadline, winner identity and shared no-repeat history',async()=>{
 for(const [origin,duration]of [['space',1750],['classroom',1000],['paper',600]]){
  await clean();assert.equal(app.applyRoster(roster(64)),true);mode(true);document.querySelector(`[data-theme-choice="${origin}"]`).click();const start=env.now,before=calls.length,spoken=env.speech.spoken.length;env.randomQueue=origin==='paper'?[1]:Array(1000).fill(0);$('pick').click();await env.flush();const generation=qa().drawGeneration;
  for(const offset of [0,100,duration-1]){await at(start+offset);for(const theme of ['paper','classroom','space']){document.querySelector(`[data-theme-choice="${theme}"]`).click();assert.equal(qa().drawStart,start);assert.equal(state().drawDurationMs,duration);assert.equal(qa().drawGeneration,generation);assert.equal(state().selected,-1);assert.deepEqual(state().used,[]);assert.equal(env.frames.size,1)}}
  env.randomQueue=[1];await at(start+duration);await env.step(2000);await env.flush();assert.equal(state().selected,1);exactWinner(1);assert.deepEqual(state().used,[1]);assert.equal(since('sounds.result',before).length,1);assert.equal(env.speech.spoken.length,spoken+1);
  for(const theme of ['paper','classroom','space']){app.setTheme(theme);assert.deepEqual(state().used,[1]);assert.equal(state().selected,1)}assert.equal(localStorage.getItem('sunlit-theme'),'paper');
 }
 // Identically named seat zero remains eligible after identically named seat one.
 await clean();app.setTheme('space');const prior=state().used;assert.deepEqual(prior,[1]);env.randomQueue=Array(1000).fill(0);$('pick').click();assert.ok(qa().drawCandidates.includes(0));assert.ok(!qa().drawCandidates.includes(1));await env.step(1750);await env.step(2000);await env.flush();assert.equal(state().selected,0);exactWinner(0);assert.deepEqual(state().used,[1,0]);
 return {originProfilesMs:[1750,1000,600],duplicateNameSeatsRemainDistinct:true};
});

await test('Resize/fullscreen fixtures keep one RAF, active draw deadline, timer state and visible selected card',async()=>{
 await clean();assert.equal(app.applyRoster(roster(128)),true);mode(false);env.randomQueue=Array(1000).fill(0);const start=env.now,before=calls.length;$('pick').click();await env.flush();await env.step(200);const generation=qa().drawGeneration;$('fullscreen').click();await env.flush();assert.equal(document.fullscreenElement,document.documentElement);await env.resize(1920,1080);assert.equal(qa().drawGeneration,generation);assert.equal(qa().drawStart,start);assert.equal(state().drawDurationMs,1750);assert.equal(env.frames.size,1);env.randomQueue=[127];await at(start+1750);await env.step(1600);await env.flush();assert.equal(state().selected,127);exactWinner(127);
 const sizes=[[1920,1080],[1366,768],[900,600],[390,844],[320,568]];
 for(const [width,height]of sizes){await env.resize(width,height);await env.step(16);const d=exactWinner(127);assert.equal(d.width,env.viewport.width);assert.equal(d.height,env.viewport.height);if(width<=760&&height>540){assert.equal(env.viewport.bottom,354);assert.equal(env.viewport.top,40,'Current pointer:fine CSS viewport top')}assert.ok(d.selectedCard.frontRim.every(p=>p.x>=0&&p.x<=d.width&&p.y>=0&&p.y<=d.height));assert.equal(qa().drawGeneration,generation);assert.equal(env.frames.size,1)}
 assert.equal(since('sounds.result',before).length,1);$('fullscreen').click();await env.flush();assert.equal(document.fullscreenElement,null);
 select('timer-minutes',2);$('timer-primary').click();const deadline=env.now+120000;$('fullscreen').click();await env.flush();await env.resize(1920,1080);assert.equal(timer().snapshot.remaining,deadline-env.now);assert.equal(view().countdown.state,'running');$('fullscreen').click();await env.flush();window.cancelCountdown();await env.resize(1366,768);
 return {viewportFixtures:sizes,mobileFixture:{pointer:'fine',top:40,bottom:354},fullscreen:'deterministic Fullscreen API fixture; no real browser display'};
});

await test('128-student adapter allocation is bounded across frames, repeated draws and countdown updates',async()=>{
 await clean();assert.equal(app.applyRoster(roster(128)),true);mode(false);await env.step(16);const setupSurfaces=env.canvases.length;let maxArt=0;
 for(let i=0;i<180;i++)await env.step(1000/60);assert.equal(env.canvases.length,setupSurfaces,'Idle frames allocate no new canvas surfaces');
 const rounds=[];
 for(let round=0;round<4;round++){
  const initial=env.canvases.length;env.randomQueue=Array(1000).fill(0);$('pick').click();await env.flush();const start=env.now;
  for(let i=0;i<105;i++)await env.step(1000/60);if(env.now<start+1750)await at(start+1750);await env.flush();assert.equal(env.canvases.length,initial+1,'Only the selected high-res face is allocated for each reveal');await env.step(1600);await env.flush();const d=exactWinner(state().selected);maxArt=Math.max(maxArt,d.resources.art.cpuBytes);assert.ok(d.resources.art.pages<=4);assert.ok(d.resources.art.cpuBytes<75*1024*1024,'Live atlas/mips/selection stay within fixed budget');rounds.push({canvasAllocations:env.canvases.length-initial,liveArtBytes:d.resources.art.cpuBytes});$('overview').click();
 }
 const beforeTimer=env.canvases.length,qualityBefore=app.renderBudget().space.changes;select('timer-minutes',2);$('timer-primary').click();for(let i=0;i<240;i++)await env.step(1000/30);await env.step(1000/60);const timerSurfaces=env.canvases.length-beforeTimer,qualityChanges=app.renderBudget().space.changes-qualityBefore;assert.equal(timerSurfaces,qualityChanges,'At 30 fps only adaptive-quality changes rebuild a background surface');assert.ok(timerSurfaces<=2,'Adaptive quality has only two bounded degradation levels');const steadySurfaces=env.canvases.length;for(let i=0;i<120;i++)await env.step(1000/60);assert.equal(env.canvases.length,steadySurfaces,'Steady countdown frames allocate no new surfaces');window.cancelCountdown();assert.equal(env.frames.size,1);
 return {idleFrames:180,drawRounds:rounds,countdownQualityBackgroundSurfaces:timerSurfaces,countdownQualityChanges:qualityChanges,countdownFrames:361,maxLiveArtBytes:maxArt,claimedScope:'canvas surface allocations and reported live artwork bytes; not GPU/heap profiling'};
});

await import('./verify-root-baseline.mjs');
const sourceHashes={};for(const entry of await fs.readdir(dist,{recursive:true,withFileTypes:true})){if(entry.isFile()){const file=path.relative(dist,path.join(entry.parentPath,entry.name));sourceHashes[file]=createHash('sha256').update(await fs.readFile(path.join(dist,file))).digest('hex')}}
// Audio decoding is stubbed above; verify the actual production audio URL resolves to nonempty deployed bytes.
const soundsSource=await fs.readFile(path.join(dist,'sounds.js'),'utf8'),audioRelative=soundsSource.match(/new URL\('([^']+)'/)?.[1];assert.ok(audioRelative);const deployedAudio=path.resolve(dist,audioRelative);assert.ok((await fs.stat(deployedAudio)).size>0);
assert.equal(env.assetErrors.length,0);
const report={result:'PASS',checks:count,dist,checkedAtUTC:new Date().toISOString(),sourceHashes,assetReadCount:env.assetReads.length,assetPaths:[...new Set(env.assetReads.map(a=>a.path))],deployedAudio,reports,limitations:['Runs real production scene/control/RAF/model/Canvas call paths in deterministic DOM, audio and Fullscreen API fixtures.','Does not prove browser CSS/pixel appearance, GPU/WebGL performance, acoustic playback, real OS fullscreen, or all old application regressions.','Only the focused independent preview suite ran; old incompatible theme suite intentionally did not run.']};
if(process.env.ORBIT_REPORT)await fs.writeFile(process.env.ORBIT_REPORT,JSON.stringify(report,null,2)+'\n');console.log('PASS focused orbit host QA: '+count+' checks');
