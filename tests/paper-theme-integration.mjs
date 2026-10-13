import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {register} from 'node:module';

// This is an independent lifecycle test of the actual production imports. The
// existing loader observes closures; the DOM/clock/audio/Canvas are fixtures.
// These checks do not claim browser CSS screenshots or acoustic validation.
register('./helpers/theme-scene-loader.mjs',import.meta.url);
const {setup,dist,$,select}=await import('./helpers/theme-environment.mjs');
const {CLASS_KEY,BACKUP_KEY}=await import('../dist/classes.js');
const {drawTimingForTheme}=await import('../dist/draw-timing.js');
const themes=['classroom','space','paper'];
const seed={version:3,activeId:'a',classes:['a','b','c'].map((id,i)=>({id,name:`独立测试${i+1}班`,noRepeat:true,sample:false,used:['1:1'],seats:Array.from({length:12},(_,j)=>({id:`${id}-${j}`,name:j<2?'同名同学':`${id}班同学${j+1}`,row:1+Math.floor(j/4),col:1+j%4,gender:j%2?'male':'female'}))})),deleted:[]};
const reopening=process.argv[2]==='--reopen';
const storage=reopening?JSON.parse(Buffer.from(process.argv[3],'base64').toString()):{[CLASS_KEY]:JSON.stringify(seed),[BACKUP_KEY]:JSON.stringify(seed),'sunlit-theme':process.env.INITIAL_THEME||'paper'};
const env=await setup({storage});
// Observe real prefers-reduced-motion listeners without changing the renderer.
const nativeMatchMedia=globalThis.matchMedia,motionQueries=new Set();let prefersReducedMotion=false;
window.matchMedia=globalThis.matchMedia=query=>{
 if(!query.includes('prefers-reduced-motion'))return nativeMatchMedia(query);
 const listeners=new Set(),media={matches:prefersReducedMotion,addEventListener(type,fn){if(type==='change')listeners.add(fn)},removeEventListener(type,fn){if(type==='change')listeners.delete(fn)},listeners};motionQueries.add(media);return media;
};
const setReducedMotion=value=>{prefersReducedMotion=value;for(const media of motionQueries){media.matches=value;for(const fn of media.listeners)fn({matches:value})}};
let earlyTimerDeadline=null;
if(process.env.COUNTDOWN_FIRST){await import(dist+'/countdown.js');if(process.env.EARLY_TIMER){$('timer-primary').click();earlyTimerDeadline=env.now+120000}}
await import(dist+'/scene.js');
const app=window.classroom;await env.awaitReady(app.ready);env.bindRenderer(app.renderer);
if(!process.env.COUNTDOWN_FIRST)await import(dist+'/countdown.js');
await env.step(1600);await env.flush();
const state=()=>app.getState(),qa=()=>__sharedThemeQA(),timer=()=>__sharedCountdownQA();
const adapters=[app.spaceCards,app.paperCards];
const mode=value=>{$(value?'repeat-once':'repeat-allow').click()};
const switchClass=id=>assert.equal(app.classAction(()=>app.classStore.switch(id)),true);
const storageSnapshot=()=>Object.fromEntries([CLASS_KEY,BACKUP_KEY,'sunlit-theme'].map(key=>[key,localStorage.getItem(key)]).filter(([,v])=>v!==null));
const advanceTo=async at=>{assert.ok(at>=env.now);await env.step(at-env.now);await env.flush()};
const clean=async(theme='paper')=>{document.hidden=false;window.cancelCountdown();app.cancelDraw();app.setTheme(theme);await env.step(1600);await env.flush()};
const assertPaperWinner=(d,index,name=state().names[index])=>{
 assert.equal(d.selectedIndex,index,'The renderer retains the actual original roster index');assert.equal(d.selectedSlot,index%d.cardCount,'The winner maps to a visual slot only after real selection');
 const selected=d.cards.filter(c=>c.selected);assert.equal(selected.length,1);const chosen=selected[0];assert.equal(chosen.id,d.selectedSlot);assert.equal(chosen.studentIndex,index);assert.equal(chosen.name,name);
 for(const card of d.cards.filter(c=>!c.selected)){assert.equal(card.name,'');assert.equal(card.studentIndex,null);assert.equal(card.showName,false)}
 return chosen;
};
const completePick=async(theme,random=0)=>{app.setTheme(theme);env.randomQueue=theme==='paper'?[random]:Array(1000).fill(0);app.pick();await env.flush();if(theme!=='paper')env.randomQueue=[random];await env.step(state().drawDurationMs);await env.flush();await env.step(1600);await env.flush();assert.equal(state().busy,false);return state().selected};
let checks=0;
async function test(name,fn){await fn();checks++;console.log('PASS',name)}

assert.ok(app.paperCards,'The production scene exposes the new paper adapter');
assert.equal(state().theme,storage['sunlit-theme']);
assert.equal(timer().selectedMinutes,2,'A fresh document defaults to two minutes');
assert.deepEqual(state().used,[],'Legacy durable used picks are ignored at document startup');
assert.equal(env.frames.size,1,'The production scene owns exactly one RAF');
if(state().theme!=='paper'&&earlyTimerDeadline===null){assert.equal(app.paperCards.debug().frame,0,'An initially inactive paper adapter paints nothing');assert.equal(app.paperCards.debug().resources.surfaces,0,'An initially inactive paper adapter lazily avoids artwork allocation')}
if(earlyTimerDeadline!==null){assert.equal(timer().snapshot.status,'running');assert.equal(timer().snapshot.remaining,earlyTimerDeadline-env.now);assert.equal(qa().boardMode,true);assert.equal(app.paperCards.debug().countdown.state,'running');window.cancelCountdown()}

if(reopening){
 for(const item of app.classStore.state.classes){switchClass(item.id);assert.deepEqual(state().used,[]);assert.deepEqual(state().seats,item.seats);assert.deepEqual(state().names,item.seats.map(s=>s.name));}
 console.log('PASS new process/document: every class starts with empty session picks and unchanged durable seats');
}else{
 const calls=[];
 for(const [label,adapter]of [['space',app.spaceCards],['paper',app.paperCards]])for(const method of ['start','reveal','cancel']){const original=adapter[method].bind(adapter);adapter[method]=(...args)=>{calls.push({kind:`${label}.${method}`,args,at:env.now});return original(...args)}}
 for(const method of ['begin','result','stop']){const original=qa().sounds[method];qa().sounds[method]=(...args)=>{calls.push({kind:`sounds.${method}`,args,at:env.now});return original(...args)}}
 const since=(kind,offset)=>calls.slice(offset).filter(c=>c.kind===kind);

 await test('three real footer radios remain keyboard-accessible and preserve fixed timing profiles',()=>{
  assert.deepEqual(themes.map(t=>drawTimingForTheme(t).total),[1000,1750,600]);
  const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),buttons=document.querySelectorAll('[data-theme-choice]');
  assert.deepEqual(buttons.map(b=>b.dataset.themeChoice),themes);
  assert.doesNotMatch(html.match(/<header>[\s\S]*?<\/header>/)[0],/data-theme-choice/);
  for(const button of buttons)assert.equal(button.closest('footer')?.tagName,'FOOTER');
  for(const [start,key,target]of [['paper','ArrowRight','classroom'],['classroom','ArrowLeft','paper'],['space','Home','classroom'],['classroom','End','paper']]){
   app.setTheme(start);const button=buttons.find(b=>b.dataset.themeChoice===start);let prevented=false;
   button.onkeydown({key,preventDefault(){prevented=true}});assert.ok(prevented);assert.equal(state().theme,target);assert.equal(document.activeElement.dataset.themeChoice,target);
   assert.equal(buttons.filter(b=>b.getAttribute('aria-checked')==='true').length,1);assert.equal(buttons.filter(b=>b.tabIndex===0).length,1);
  }
 });

 mode(false);
 for(const origin of themes)await test(`${origin}: winner RNG follows the originating theme despite repeated view switches`,async()=>{
  await clean(origin);env.randomQueue=origin==='paper'?[11]:Array(1000).fill(0);const before=calls.length,spoken=env.speech.spoken.length,start=env.now,randomBefore=env.randomCalls,used=state().used;
  app.pick();await env.flush();const duration=state().drawDurationMs,generation=qa().drawGeneration,usedIdentity=qa().usedSet,randomAtStart=env.randomCalls;
  if(origin==='paper'){assert.equal(randomAtStart-randomBefore,1,'One real selection is sampled at accepted paper start');assert.equal(app.paperCards.debug().pendingIndex,11)}
  for(const offset of [0,16,100,400,...(duration>800?[800]:[])]){await advanceTo(start+offset);for(const theme of themes){app.setTheme(theme);assert.equal(qa().drawStart,start);assert.equal(state().drawDurationMs,duration);assert.equal(qa().drawGeneration,generation);assert.equal(qa().usedSet,usedIdentity);assert.equal(state().selected,-1);assert.deepEqual(state().used,used);assert.equal(env.frames.size,1)}app.pick();env.key('Space');if(origin==='paper')assert.equal(env.randomCalls,randomAtStart,'Theme switches and busy picks cannot resample the pending winner')}
  await advanceTo(start+duration-1);assert.equal(state().selected,-1);assert.equal(since('sounds.result',before).length,0);assert.deepEqual(state().used,used);const beforeCommitRng=env.randomCalls;app.finishPick();assert.equal(state().selected,-1,'Calling finish early cannot expose or commit a pending winner');assert.deepEqual(state().used,used);assert.equal(env.randomCalls,beforeCommitRng);
  // Paper must ignore a new RNG value at commit. Classroom and space retain
  // their existing selection-at-finish behavior, independent of current view.
  env.randomQueue=[origin==='paper'?3:11];await advanceTo(start+duration);assert.equal(state().selected,11);const winner=state().names[11];
  assert.equal(env.randomCalls-beforeCommitRng,origin==='paper'?0:1);if(origin==='paper'){assert.equal(env.randomCalls-randomBefore,1);assert.equal(state().busy,false,'Paper has no second reveal/busy tail')}
  for(const adapter of adapters){const d=adapter.debug();assert.equal(d.drawing,false);assert.equal(d.winner,winner);assert.equal(d.startedAt,start);assert.equal(d.timing.total,duration)}
  assert.equal(since('sounds.begin',before).length,1);assert.equal(since('sounds.result',before).length,1);
  for(const label of ['space','paper']){assert.equal(since(`${label}.start`,before).length,1);assert.equal(since(`${label}.reveal`,before).length,1)}
  const committedRandom=env.randomCalls;app.finishPick();app.finishPick();assert.equal(env.randomCalls,committedRandom,'A completed finish is idempotent');assert.equal(since('sounds.result',before).length,1);
  for(let i=0;i<9;i++){app.setTheme(themes[i%3]);await env.step(200)}await env.flush();
  assert.equal(env.speech.spoken.length,spoken+1);assert.equal(env.speech.spoken.at(-1).utterance.text,winner);assert.equal(state().busy,false);
  assert.equal(since('sounds.result',before).length,1);assert.equal(state().selected,11);assert.equal(env.frames.size,1);
 });

 await test('all three themes and repeat modes share seat-identity history, isolated per class and cleared by refresh',async()=>{
  await clean();switchClass('b');assert.deepEqual(state().used,[]);mode(false);
  assert.equal(await completePick('paper',0),0);assert.equal(await completePick('classroom',1),1);assert.deepEqual(state().used,[0,1],'Duplicate names are separate seats');
  mode(true);assert.equal(await completePick('space',0),2);assert.deepEqual(state().used,[0,1,2]);
  const usedIdentity=qa().usedSet;for(const theme of themes){app.setTheme(theme);assert.equal(qa().usedSet,usedIdentity);assert.deepEqual(state().used,[0,1,2])}
  switchClass('c');assert.deepEqual(state().used,[]);mode(true);assert.equal(await completePick('paper',0),0);assert.deepEqual(state().used,[0]);
  switchClass('b');assert.deepEqual(state().used,[0,1,2]);mode(false);assert.equal(await completePick('paper',0),0);mode(true);assert.equal(await completePick('classroom',0),3);assert.deepEqual(state().used,[0,1,2,3]);
  const result=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--reopen',Buffer.from(JSON.stringify(storageSnapshot())).toString('base64')],{encoding:'utf8',timeout:60000});
  assert.equal(result.status,0,result.stderr||result.stdout);process.stdout.write(result.stdout);
  switchClass('a');mode(false);
 });

 await test('exhaustion in paper leaves an existing timer and sounds untouched across all themes',async()=>{
  await clean('paper');switchClass('c');mode(true);let round=0;
  while(state().used.length<state().names.length)await completePick(themes[round++%3],0);
  const used=state().used;app.setTheme('paper');$('timer-primary').click();await env.step(100);const deadline=env.now+timer().snapshot.remaining,before=calls.length,generation=qa().drawGeneration,spoken=env.speech.spoken.length;
  for(const theme of themes){app.setTheme(theme);app.pick();assert.equal(state().busy,false);assert.equal(timer().snapshot.status,'running');assert.equal(timer().snapshot.remaining,deadline-env.now);assert.equal(qa().drawGeneration,generation);assert.deepEqual(state().used,used)}
  assert.equal(calls.length,before);assert.equal(env.speech.spoken.length,spoken);window.cancelCountdown();switchClass('a');mode(false);
 });

 for(const theme of themes)await test(`${theme}: 3/5/10 selection changes only the next timer duration and themes preserve its deadline`,async()=>{
  await clean(theme);select('timer-minutes',5);$('timer-primary').click();const start=env.now;assert.equal(timer().snapshot.duration,300000);
  await env.step(1234);select('timer-minutes',10);assert.equal(timer().snapshot.duration,300000);assert.equal(timer().snapshot.remaining,300000-1234);
  for(const destination of themes){app.setTheme(destination);assert.equal(timer().snapshot.remaining,start+300000-env.now);assert.equal(qa().boardMode,true)}
  $('timer-primary').click();assert.equal(timer().snapshot.duration,600000);select('timer-minutes',3);await env.step(4321);assert.equal(timer().snapshot.remaining,600000-4321);
  $('timer-primary').click();assert.equal(timer().snapshot.duration,180000);const end=env.now+180000;await advanceTo(end-1);assert.equal(timer().snapshot.status,'running');assert.equal(timer().snapshot.remaining,1);
  const chimes=env.audio.oscillators.length;await env.step(1);assert.equal(timer().snapshot.status,'finished');assert.equal(timer().snapshot.remaining,0);assert.equal(env.audio.oscillators.length,chimes+1);
  for(const destination of themes)app.setTheme(destination);await env.step(1000);assert.equal(env.audio.oscillators.length,chimes+1,'One completion chime, never one per theme');
  window.cancelCountdown();select('timer-minutes',5);
 });

 for(const theme of themes)for(const offset of (theme==='paper'?[0,16,100,350,599]:[0,16,100,900,1749]))await test(`${theme}: timer takeover at ${offset}ms has no stale reveal, name, winner or completion callback`,async()=>{
  await clean(theme);env.randomQueue=Array(1000).fill(0);app.pick();await env.flush();await env.advance(offset,{step:16});await env.flush();
  const before=calls.length,generation=qa().drawGeneration,spoken=env.speech.spoken.length,used=state().used,selected=state().selected;
  $('timer-primary').click();const deadline=env.now+300000;
  assert.equal(qa().drawGeneration,generation+1);assert.equal(qa().drawStart,null);assert.deepEqual(qa().drawCandidates,[]);assert.equal(state().busy,false);assert.equal(qa().boardMode,true);
  assert.equal(since('sounds.stop',before).length,1);for(const adapter of adapters)assert.equal(adapter.debug().drawing,false);assert.equal(app.paperCards.debug().pendingIndex,-1);assert.equal(app.paperCards.debug().pendingName,'');
  for(const destination of ['paper','classroom','space','paper']){app.setTheme(destination);await env.step(137)}
  await env.step(5000);await env.flush();assert.equal(timer().snapshot.remaining,deadline-env.now);assert.equal(timer().snapshot.status,'running');assert.equal(state().selected,selected);assert.deepEqual(state().used,used);assert.equal(env.speech.spoken.length,spoken);
  for(const kind of ['paper.reveal','space.reveal','sounds.result'])assert.equal(since(kind,before).length,0);
  assert.equal(state().busy,false);assert.equal(env.frames.size,1);
 });

 await test('a cancelled second pick cannot resurrect an earlier winner in any adapter',async()=>{
  await clean('paper');await completePick('paper',8);assert.equal(state().selected,8);
  app.pick();await env.flush();await env.step(599);app.cancelDraw();const generation=qa().drawGeneration,spoken=env.speech.spoken.length;
  for(const theme of ['space','paper','classroom','paper']){app.setTheme(theme);await env.step(1000);assert.equal(state().selected,-1);for(const adapter of adapters)assert.equal(adapter.debug().winner,'')}
  assert.equal(qa().drawGeneration,generation);assert.equal(env.speech.spoken.length,spoken);
  // A new accepted draw immediately after cancellation also invalidates old
  // reveal tails, even when a timer was restarted twice between the draws.
  $('timer-primary').click();$('timer-primary').click();const before=calls.length;env.randomQueue=[7];app.pick();assert.equal(timer().snapshot.status,'ready');assert.equal(qa().boardMode,false);await env.step(600);await env.step(1600);await env.flush();
  assert.equal(state().selected,7);assert.equal(since('sounds.begin',before).length,1);assert.equal(since('sounds.result',before).length,1);
 });

 await test('inactive adapters perform no per-frame painting, and hidden/resume retains one RAF and real deadlines',async()=>{
  for(const active of themes){await clean(active);const frames=adapters.map(a=>a.debug().frame);await env.advance(1000,{step:20});for(let i=0;i<2;i++)if(active!==['space','paper'][i])assert.equal(adapters[i].debug().frame,frames[i],`${active} must not paint hidden ${['space','paper'][i]}`);if(active==='paper')assert.equal(app.paperCards.debug().frame,frames[1],'The settled paper surface skips stable idle/result repainting');assert.equal(env.frames.size,1)}
  await clean('paper');env.randomQueue=[7];const randomBefore=env.randomCalls,usedBefore=state().used;app.pick();await env.flush();await env.step(200);const duration=state().drawDurationMs,start=qa().drawStart,before=calls.length,spoken=env.speech.spoken.length;assert.equal(app.paperCards.debug().pendingIndex,7);assert.equal(env.randomCalls-randomBefore,1);
  document.hidden=true;document.dispatchEvent({type:'visibilitychange'});const frames=adapters.map(a=>a.debug().frame);await env.advance(5000,{step:100});assert.equal(state().selected,-1);assert.equal(qa().drawStart,start);assert.equal(state().drawDurationMs,duration);assert.deepEqual(adapters.map(a=>a.debug().frame),frames);assert.equal(env.frames.size,1);
  document.hidden=false;document.dispatchEvent({type:'visibilitychange'});await env.step(1);assert.equal(state().selected,7);assert.equal(env.randomCalls-randomBefore,1);assert.deepEqual(state().used,[...new Set([...usedBefore,7])]);assert.equal(app.paperCards.debug().resultSettling,false);assert.ok(assertPaperWinner(app.paperCards.debug(),7).facing>.999);assert.equal(since('sounds.result',before).length,1);await env.step(1800);assert.equal(env.speech.spoken.length,spoken,'Hidden interrupted sound is not replayed');
  select('timer-minutes',3);$('timer-primary').click();const deadline=env.now+180000;document.hidden=true;document.dispatchEvent({type:'visibilitychange'});await env.step(67890);assert.equal(timer().snapshot.remaining,deadline-env.now);document.hidden=false;document.dispatchEvent({type:'visibilitychange'});await env.step(1);assert.equal(timer().snapshot.remaining,deadline-env.now);assert.equal(app.paperCards.debug().countdown.text,'01:52');assert.equal(env.frames.size,1);select('timer-minutes',5);
 });

 await test('a late paper frame commits its start-selected person once without beginning a second animation',async()=>{
  await clean('paper');mode(false);env.randomQueue=[5];const randomBefore=env.randomCalls,before=calls.length,spoken=env.speech.spoken.length,used=state().used;app.pick();const start=env.now;
  env.randomQueue=[9];await env.step(1600);assert.equal(state().selected,5);assert.equal(env.randomCalls-randomBefore,1);assert.deepEqual(state().used,[...new Set([...used,5])]);assert.equal(state().busy,false);const d=app.paperCards.debug(),hero=assertPaperWinner(d,5);assert.equal(d.resultSettling,false);assert.ok(Math.abs(hero.x-d.width/2)<.001&&hero.facing>.999);assert.equal(d.startedAt,start);assert.equal(since('sounds.result',before).length,1);
  app.finishPick();await env.step(1800);assert.equal(since('sounds.result',before).length,1);assert.equal(since('paper.reveal',before).length,1);assert.equal(env.speech.spoken.length,spoken+1);assert.equal(env.randomCalls-randomBefore,1);
 });

 await test('narrow sizes, DPR changes and fullscreen refit keep active timer and draw state intact',async()=>{
  await clean('paper');select('timer-minutes',5);$('timer-primary').click();const deadline=env.now+300000;
  for(const [width,height]of [[320,568],[360,640],[375,667],[480,320],[768,1024],[1920,1080],[1366,768]]){
   await env.resize(width,height);const d=app.paperCards.debug();assert.ok(Number.isFinite(d.width)&&d.width>0);assert.ok(Number.isFinite(d.height)&&d.height>0);assert.equal(d.width,env.width);assert.equal(d.height,env.viewport.height);assert.equal(d.countdown.state,'running');assert.equal(timer().snapshot.remaining,deadline-env.now);assert.equal(env.frames.size,1);
   for(const c of d.cards||[])for(const key of ['x','y','width','height'])if(key in c)assert.ok(Number.isFinite(c[key]),`${width}x${height} ${key} finite`);
  }
  for(const ratio of [2,3,1]){globalThis.devicePixelRatio=ratio;window.devicePixelRatio=ratio;await env.step(16);const d=app.paperCards.debug();assert.ok(d.dpr>0&&d.dpr<=1.5);assert.equal(timer().snapshot.remaining,deadline-env.now);assert.equal(env.frames.size,1)}
  const before=state(),selected=state().selected;await $('fullscreen').onclick();await env.resize(1920,1080);app.setTheme('classroom');await env.step(1600);assert.equal(qa().boardMode,true);assert.equal(timer().snapshot.remaining,deadline-env.now);assert.equal(state().selected,selected);assert.deepEqual(state().used,before.used);
  await $('fullscreen').onclick();await env.resize(1366,768);app.setTheme('paper');app.pick();const start=qa().drawStart,duration=state().drawDurationMs;assert.equal(timer().snapshot.status,'ready');await env.resize(360,640);assert.equal(qa().drawStart,start);assert.equal(state().drawDurationMs,duration);await advanceTo(start+duration-1);assert.equal(state().selected,-1);await env.step(1);assert.ok(state().selected>=0);
 });

 await test('paper card projection stays finite and its final card stays inside every narrow viewport',async()=>{
  await clean('paper');
  for(const [width,height]of [[320,568],[360,640],[375,667],[380,700],[381,700],[480,320],[760,540],[1024,768],[1920,1080]]){
   await env.resize(width,height);app.cancelDraw();app.paperCards.reset();app.pick();const start=env.now;
   for(const offset of [0,100,200,300,400,599,600]){await advanceTo(start+offset);const d=app.paperCards.debug();for(const c of d.cards){assert.ok(c.width>0&&c.height>0);for(const points of [c.mesh,c.frontRim,c.backRim])for(const p of points)for(const key of ['x','y','z'])assert.ok(Number.isFinite(p[key]),`${width}x${height}/${offset} finite ${key}`);if(!c.selected)assert.equal(c.showName,false,'No unselected candidate name is printed')}
    if(offset===600){const chosen=d.cards.filter(c=>c.selected);assert.equal(chosen.length,1);assert.equal(chosen[0].name,state().names[state().selected]);const b=chosen[0].bounds;assert.ok(b.minX>=0&&b.maxX<=d.width&&b.minY>=0&&b.maxY<=d.height,`${width}x${height} final card stays in viewport`)}
   }
   await env.step(1400);
  }
 });

 await test('a viewport-sized paper deck stays independent of roster size while every real student remains selectable',async()=>{
  await clean('paper');const originalSeats=state().seats,viewportDecks=new Map(),viewportAnimation=new Map();mode(false);
  try{
   for(const count of [1,2,3,7,15,40,43,64,128]){
    const roster=Array.from({length:count},(_,i)=>({id:`full-roster-${i}`,name:i<2?'同名同学':`全班同学${i+1}`,row:Math.floor(i/8)+1,col:i%8+1}));
    assert.equal(app.applyRoster(roster),true);await env.flush();assert.equal(state().names.length,count);
    for(const [width,height]of [[1366,768],[320,568],[375,667]]){
     app.cancelDraw();app.paperCards.reset();await env.resize(width,height);const initial=app.paperCards.debug(),viewportKey=`${width}x${height}`;
     const geometry=d=>[...d.cards].sort((a,b)=>a.id-b.id).map(c=>({id:c.id,x:c.origin.x,y:c.origin.y,width:c.origin.width,height:c.origin.height}));
     assert.ok(initial.cardCount>2,'Even a one-student class fills the viewport with a visual deck');assert.equal(initial.cardCount,initial.layout.columns*initial.layout.rows);assert.equal(initial.cardCount,initial.layout.count);
     if(viewportDecks.has(viewportKey))assert.deepEqual(geometry(initial),viewportDecks.get(viewportKey),'Roster size cannot change the visual deck count, slot positions or card sizes');else viewportDecks.set(viewportKey,geometry(initial));
     const assertGrid=d=>{
      assert.equal(d.cardCount,initial.cardCount);assert.equal(d.cards.length,initial.cardCount);assert.deepEqual(d.cards.map(c=>c.id).sort((a,b)=>a-b),Array.from({length:initial.cardCount},(_,i)=>i));
      assert.deepEqual(geometry(d),geometry(initial),'The visual slots remain fixed throughout the draw');
      for(const c of d.cards){const b=c.bounds;assert.ok(c.width>0&&c.height>0);assert.ok(b.minX>=0&&b.maxX<=d.width&&b.minY>=0&&b.maxY<=d.height,`${count} students / ${width}px / ${d.stage}: visual card ${c.id} bounds ${JSON.stringify(b)} stay inside ${d.width}x${d.height}`);assert.equal(c.name,'');assert.equal(c.studentIndex,null);assert.equal(c.showName,false)}
      for(let i=0;i<d.cards.length;i++)for(let j=i+1;j<d.cards.length;j++){const a=d.cards[i].bounds,b=d.cards[j].bounds;assert.ok(a.maxX<=b.minX||b.maxX<=a.minX||a.maxY<=b.minY||b.maxY<=a.minY,`${count} students / ${width}px: visual slots ${d.cards[i].id} and ${d.cards[j].id} do not overlap`)}
     };
     assertGrid(initial);env.randomQueue=[0];const randomBefore=env.randomCalls;app.pick();const started=env.now;assert.equal(state().drawDurationMs,600);assert.equal(env.randomCalls-randomBefore,1);assert.deepEqual(qa().drawCandidates,Array.from({length:count},(_,i)=>i),'The production candidate pool includes the full roster, independent of visible slots');
     for(const offset of [0,100,300,599]){await advanceTo(started+offset);const d=app.paperCards.debug();assert.equal(d.cardCount,initial.cardCount);assert.deepEqual(geometry(d),geometry(initial));assert.equal(state().selected,-1);assert.equal(d.pendingIndex,0);
      for(const c of d.cards.filter(c=>c.id!==0))assert.deepEqual(c,initial.cards.find(old=>old.id===c.id),'Every nonselected visual slot is wholly stationary');
      const key=`${viewportKey}/${offset}`,motion=[...d.cards].sort((a,b)=>a.id-b.id).map(c=>({id:c.id,x:c.x,y:c.y,width:c.width,height:c.height,rotation:c.rotation,phase:c.phase,rank:c.rank}));if(viewportAnimation.has(key))assert.deepEqual(motion,viewportAnimation.get(key),'The same visual slot has identical animation for every roster size');else viewportAnimation.set(key,motion)
     }
     env.randomQueue=[count-1];await advanceTo(started+600);assert.equal(state().selected,0,'Commit preserves the start-selected real person');assert.equal(env.randomCalls-randomBefore,1);let d=app.paperCards.debug(),chosen=assertPaperWinner(d,0);
     const selectedSlot=d.selectedSlot,finalPose=chosen;await env.step(260);d=app.paperCards.debug();chosen=assertPaperWinner(d,0);assert.equal(d.selectedSlot,selectedSlot);assert.equal(d.cardCount,initial.cardCount);assert.equal(d.resultSettling,false);assert.deepEqual(chosen,finalPose,'No second animation follows the 600 ms commit');assert.ok(chosen.width>=initial.cards.find(c=>c.id===selectedSlot).width,`${count} students / ${width}px: the selected visual card never shrinks`);const b=chosen.bounds;assert.ok(b.minX>=0&&b.maxX<=d.width&&b.minY>=0&&b.maxY<=d.height);assert.ok(chosen.facing>.999);
    }
   }
   assert.ok(new Set([...viewportDecks.values()].map(cards=>cards.length)).size>1,'The deck adapts to available viewport space');
  }finally{app.cancelDraw();assert.equal(app.applyRoster(originalSeats),true);await env.resize(1366,768);await env.flush()}
 });

 await test('all 128 equally available real RNG outcomes survive fewer visual slots and shared-slot no-repeat history',async()=>{
  await clean('paper');const originalSeats=state().seats;mode(false);
  const roster=Array.from({length:128},(_,i)=>({id:`fair-seat-${i}`,name:i<2?'同名同学':`公平同学${i+1}`,row:Math.floor(i/8)+1,col:i%8+1}));
  try{
   assert.equal(app.applyRoster(roster),true);await env.resize(1366,768);const visualCount=app.paperCards.debug().cardCount,allIndices=Array.from({length:128},(_,i)=>i),seen=new Map(),slots=new Map(),slotMotion=new Map();
   assert.ok(visualCount>2&&visualCount<128,'This scenario must exercise a visual deck smaller than the complete roster');
   for(const index of allIndices){
    app.cancelDraw();app.setTheme('paper');env.randomQueue=[index];const before=calls.length,randomBefore=env.randomCalls;app.pick();await env.flush();const started=env.now;assert.deepEqual(qa().drawCandidates,allIndices);
    assert.equal(env.randomCalls-randomBefore,1);assert.equal(app.paperCards.debug().pendingIndex,index);await advanceTo(started+300);const halfway=app.paperCards.debug(),pose=halfway.cards.map(({id,x,y,z,width,height,rotation,phase,mesh})=>({id,x,y,z,width,height,rotation,phase,mesh})),slot=index%visualCount;if(slotMotion.has(slot))assert.deepEqual(pose,slotMotion.get(slot),'Different real people mapped to the same visual slot have identical motion');else slotMotion.set(slot,pose);await advanceTo(started+599);assert.equal(state().selected,-1);assert.equal(since('sounds.result',before).length,0);env.randomQueue=[(index+1)%128];await advanceTo(started+600);assert.equal(env.randomCalls-randomBefore,1);
    assert.equal(state().selected,index,'Each equally likely production RNG value chooses its own actual student');const d=app.paperCards.debug(),chosen=assertPaperWinner(d,index);assert.equal(d.cardCount,visualCount);assert.equal(since('paper.reveal',before).length,1);assert.equal(since('paper.reveal',before)[0].args[2],index);assert.equal(since('sounds.begin',before).length,1);assert.equal(since('sounds.result',before).length,1);
    seen.set(chosen.studentIndex,(seen.get(chosen.studentIndex)??0)+1);slots.set(chosen.id,[...(slots.get(chosen.id)??[]),index]);
    await advanceTo(started+860);assert.equal(app.paperCards.debug().resultSettling,false);assertPaperWinner(app.paperCards.debug(),index);
   }
   assert.deepEqual([...seen.entries()],allIndices.map(index=>[index,1]),'Every actual student receives one outcome; visual slots do not weight or deduplicate candidates');assert.ok([...slots.values()].some(indices=>indices.length>1),'Different actual students have been selected through the very same visual slot');assert.equal(state().selected,127,'The final production RNG value reaches student 127 beyond the visual deck');
   const resizeCalls=calls.length,generation=qa().drawGeneration,used=state().used;
   for(const [width,height]of [[320,568],[375,667],[1366,768]]){app.setTheme('space');await env.resize(width,height);app.setTheme('paper');await env.step(16);assert.equal(state().selected,127);assertPaperWinner(app.paperCards.debug(),127);assert.deepEqual(state().used,used);assert.equal(qa().drawGeneration,generation);assert.equal(env.frames.size,1)}
   assert.equal(since('paper.reveal',resizeCalls).length,0);assert.equal(since('sounds.result',resizeCalls).length,0,'Remapping a selected visual slot cannot rerun selection or its sound');
   app.cancelDraw();assert.equal(app.applyRoster(roster),true);mode(true);assert.deepEqual(state().used,[]);
   for(const [index,random]of [[0,0],[visualCount,visualCount-1]]){
    app.cancelDraw();env.randomQueue=[random];app.pick();await env.flush();assert.deepEqual(qa().drawCandidates,allIndices.filter(candidate=>!state().used.includes(candidate)));await env.step(600);assert.equal(state().selected,index);const d=app.paperCards.debug();assertPaperWinner(d,index);assert.equal(d.selectedSlot,0,'Aliases are distinct real students even when revealed through slot zero');
   }
   assert.deepEqual(state().used,[0,visualCount],'No-repeat history records actual student identities, never visual slots');app.cancelDraw();env.randomQueue=Array(1000).fill(0);app.pick();assert.equal(qa().drawCandidates.length,126);assert.ok(qa().drawCandidates.includes(1));assert.ok(!qa().drawCandidates.includes(0)&&!qa().drawCandidates.includes(visualCount));
  }finally{app.cancelDraw();mode(false);assert.equal(app.applyRoster(originalSeats),true);await env.resize(1366,768);await env.flush()}
 });

 await test('an empty production roster has no phantom cards, draw, sound or timer cancellation',async()=>{
  await clean('paper');const originalSeats=state().seats;
  try{
   assert.equal(app.applyRoster([]),true);await env.flush();const d=app.paperCards.debug();assert.equal(d.cardCount,0);assert.deepEqual(d.names,[]);assert.equal(d.winner,'');assert.equal($('pick').disabled,false);assert.equal($('pick').querySelector('span').textContent,'添加学生');
   $('timer-primary').click();const deadline=env.now+300000,before=calls.length,spoken=env.speech.spoken.length,generation=qa().drawGeneration;
   for(const theme of ['paper','space','classroom','paper']){app.setTheme(theme);app.pick();await env.step(125);assert.equal(state().busy,false);assert.equal(state().selected,-1);assert.equal(timer().snapshot.status,'running');assert.equal(timer().snapshot.remaining,deadline-env.now);assert.equal(app.paperCards.debug().cardCount,0);assert.equal($('roster-dialog').open,true);assert.equal(document.activeElement,$('seat-name'));$('editor-close').click();assert.equal($('roster-dialog').open,false)}
   assert.deepEqual(calls.slice(before).map(c=>c.kind),Array(4).fill('sounds.stop'),'Empty roster opens the editor without draw or result sounds');assert.equal(env.speech.spoken.length,spoken);assert.equal(qa().drawGeneration,generation);assert.equal(env.frames.size,1);
  }finally{window.cancelCountdown();app.cancelDraw();assert.equal(app.applyRoster(originalSeats),true);await env.flush()}
 });

 await test('a single pending real winner turns back-to-front and grows within 600 ms while every other card is still',async()=>{
  await clean('paper');mode(false);const originalSeats=state().seats;
  try{
   const roster=Array.from({length:43},(_,i)=>({id:`single-seat-${i}`,name:`单牌同学${i+1}`,row:Math.floor(i/8)+1,col:i%8+1}));
   assert.equal(app.applyRoster(roster),true);await env.resize(1366,768);app.paperCards.reset();
   const idle=app.paperCards.debug(),origins=new Map(idle.cards.map(c=>[c.id,c]));
   env.randomQueue=[42];const before=calls.length,randomBefore=env.randomCalls,used=state().used;app.pick();await env.flush();const started=env.now,slot=42%idle.cardCount,origin=origins.get(slot);
   assert.equal(env.randomCalls-randomBefore,1);let lastRotation=origin.rotation.y,lastWidth=origin.width,lastFrame=app.paperCards.debug().frame,sawBack=false,sawFront=false;
   for(let elapsed=0;elapsed<=600;elapsed+=5){
    await advanceTo(started+elapsed);const d=app.paperCards.debug(),chosen=d.cards.find(c=>c.id===slot);assert.equal(d.cards.filter(c=>c.selected).length,1);
    for(const c of d.cards.filter(c=>c.id!==slot))assert.deepEqual(c,origins.get(c.id),'All nonselected cards keep their exact idle pose and hidden name');
    assert.ok(chosen.rotation.y>=lastRotation-.0001,'One orderly back-to-front turn, no reversal');assert.ok(chosen.rotation.y<=origin.rotation.y+Math.PI+.0001,'No extra revolution');assert.ok(chosen.width>=lastWidth-.0001,'Growth happens during the single flip');lastRotation=chosen.rotation.y;lastWidth=chosen.width;
    if(elapsed>0)assert.ok(d.frame>lastFrame,'The active flip must keep painting');lastFrame=d.frame;sawBack||=chosen.facing<-.25;sawFront||=chosen.facing>.25;
    if(elapsed===0){assert.equal(chosen.width,origin.width);assert.equal(chosen.x,origin.x);assert.equal(chosen.y,origin.y)}
    if(elapsed===100)assert.ok(chosen.width>origin.width,'Growth begins before the commit rather than in a second tail');
    if(chosen.facing>.05){const topLeft=chosen.mesh[0],topRight=chosen.mesh[2],bottomLeft=chosen.mesh[6];assert.ok(topRight.x>topLeft.x&&bottomLeft.y>topLeft.y,'The revealed front is upright and never horizontally mirrored')}
    if(elapsed<600){assert.equal(state().selected,-1);assert.deepEqual(state().used,used);assert.equal(d.winner,'');assert.equal(d.selectedIndex,-1);assert.equal(d.pendingIndex,42);assert.equal(since('sounds.result',before).length,0)}
   }
   const d=app.paperCards.debug(),hero=assertPaperWinner(d,42);assert.ok(sawBack&&sawFront);assert.ok(Math.abs(hero.rotation.y-origin.rotation.y-Math.PI)<.0001);assert.ok(hero.width>origin.width);assert.ok(Math.abs(hero.x-d.width/2)<.001);assert.ok(hero.facing>.999);assert.equal(d.resultSettling,false);assert.equal(state().busy,false);assert.equal(state().selected,42);assert.deepEqual(state().used,[...used,42]);assert.equal(env.randomCalls-randomBefore,1);assert.equal(since('paper.reveal',before).length,1);assert.equal(since('sounds.result',before).length,1);
   await env.step(260);assert.deepEqual(assertPaperWinner(app.paperCards.debug(),42),hero,'The winner is already at the final pose at 600 ms');
  }finally{app.cancelDraw();assert.equal(app.applyRoster(originalSeats),true);await env.resize(1366,768);await env.flush()}
 });

 await test('finishPick preserves exact duplicate, blank-slot and no-repeat seat identity',async()=>{
  await clean('paper');mode(false);
  const original=state().names,withBlankSlots=original.map((name,i)=>i===2||i===4?'':name);
  for(const winnerIndex of [1,5,0]){
   app.cancelDraw();app.paperCards.setNames(withBlankSlots);app.paperCards.reset();env.randomQueue=[winnerIndex];const before=calls.length;app.pick();await env.flush();await env.step(600);
   assert.equal(state().selected,winnerIndex);const reveal=since('paper.reveal',before);assert.equal(reveal.length,1);assert.equal(reveal[0].args[2],winnerIndex,'Scene forwards the actual original seat index');
   const d=app.paperCards.debug();assertPaperWinner(d,winnerIndex,original[winnerIndex]);assert.equal(since('sounds.result',before).length,1);
   await env.step(300);assertPaperWinner(app.paperCards.debug(),winnerIndex,original[winnerIndex]);
  }
  app.cancelDraw();app.paperCards.setNames(original);app.paperCards.reset();mode(true);
  env.randomQueue=[0];app.pick();await env.flush();await env.step(600);
  assert.equal(state().selected,2,'The first remaining candidate keeps original seat index 2');assertPaperWinner(app.paperCards.debug(),2);app.cancelDraw();mode(false);
 });

 await test('the 600 ms committed winner is final, cached and cannot reveal or speak twice',async()=>{
  await clean('paper');mode(false);app.paperCards.reset();const before=calls.length,spoken=env.speech.spoken.length;env.randomQueue=[11];app.pick();await env.flush();const started=env.now;await advanceTo(started+599);assert.equal(state().selected,-1);assert.equal(since('sounds.result',before).length,0);
  await advanceTo(started+600);assert.equal(state().selected,11);const settled=app.paperCards.debug(),hero=assertPaperWinner(settled,11);assert.equal(settled.resultSettling,false);assert.ok(Math.abs(hero.x-settled.width/2)<.001);assert.ok(hero.facing>.999);assert.ok(settled.cards.filter(c=>!c.selected).every(c=>c.opacity===1));
  await env.advance(900,{step:16});const cached=app.paperCards.debug();assert.deepEqual(assertPaperWinner(cached,11),hero);assert.equal(cached.frame-settled.frame,cached.resources.backgroundBuilds-settled.resources.backgroundBuilds,'Settled paper results repaint only for a real quality/backing-store change');assert.equal(since('paper.reveal',before).length,1);assert.equal(since('sounds.result',before).length,1);await env.step(500);await env.flush();assert.equal(env.speech.spoken.length,spoken+1);assert.equal(env.frames.size,1);
 });

 for(const interruption of ['cancel','timer','theme','hidden'])await test(`paper committed result survives ${interruption} without stale callbacks or a different selected card`,async()=>{
  await clean('paper');mode(false);app.paperCards.reset();env.randomQueue=[9];const before=calls.length;app.pick();await env.flush();await env.step(600);await env.step(90);assert.equal(state().selected,9);
  const chosenBefore=assertPaperWinner(app.paperCards.debug(),9);let stoppedFrame;
  if(interruption==='cancel'){app.cancelDraw();stoppedFrame=app.paperCards.debug().frame;assert.equal(state().busy,false)}
  if(interruption==='timer'){$('timer-primary').click();assert.equal(timer().snapshot.status,'running');assert.equal(app.paperCards.debug().selectedNameVisible,false)}
  if(interruption==='theme'){app.setTheme('space');stoppedFrame=app.paperCards.debug().frame}
  if(interruption==='hidden'){document.hidden=true;document.dispatchEvent({type:'visibilitychange'});stoppedFrame=app.paperCards.debug().frame}
  await env.advance(500,{step:50});
  if(stoppedFrame!==undefined)assert.equal(app.paperCards.debug().frame,stoppedFrame,`${interruption} cannot keep painting a hidden or canceled transition`);
  if(interruption==='timer'){assert.equal(timer().snapshot.remaining,299500);assert.equal(app.paperCards.debug().selectedNameVisible,false);window.cancelCountdown()}
  if(interruption==='theme')app.setTheme('paper');
  if(interruption==='hidden'){document.hidden=false;document.dispatchEvent({type:'visibilitychange'})}
  await env.step(1);let d=app.paperCards.debug();assert.equal(state().selected,9);const resumed=assertPaperWinner(d,9);assert.equal(resumed.id,chosenBefore.id);assert.ok(resumed.facing>.999);assert.equal(since('paper.reveal',before).length,1);assert.equal(since('sounds.result',before).length,1);
  app.cancelDraw();const oldWinner=state().names[9];app.pick();await env.flush();d=app.paperCards.debug();assert.equal(d.winner,'');assert.equal(d.selectedIndex,-1);assert.equal(d.cards.filter(c=>c.selected).length,1);assert.equal(state().selected,-1);
  await env.step(200);app.cancelDraw();for(const theme of ['space','paper','classroom','paper']){app.setTheme(theme);await env.step(400);d=app.paperCards.debug();assert.equal(d.winner,'');assert.equal(d.cards.filter(c=>c.selected||c.name===oldWinner).length,0)}assert.equal(state().selected,-1);assert.equal(env.frames.size,1);
 });

 for(const offset of [0,100,599,690])await test(`a new paper pick after cancel at ${offset}ms owns the next deadline, result and spoken name`,async()=>{
  await clean('paper');mode(false);app.paperCards.reset();const before=calls.length,spoken=env.speech.spoken.length,initialUsed=state().used,randomBefore=env.randomCalls;
  env.randomQueue=[6];app.pick();await env.flush();const firstStart=env.now;
  if(offset>600){await advanceTo(firstStart+600);assert.equal(state().selected,6);await advanceTo(firstStart+offset);assert.equal(app.paperCards.debug().resultSettling,false)}else await advanceTo(firstStart+offset);
  app.cancelDraw();const cancelledUsed=state().used;if(offset<600)assert.deepEqual(cancelledUsed,initialUsed,'Cancellation discards the pending person without history');assert.equal(app.paperCards.debug().pendingIndex,-1);
  env.randomQueue=[3];app.pick();await env.flush();const nextStart=env.now;assert.equal(env.randomCalls-randomBefore,2,'Exactly one draw per accepted paper start, even for an immediate restart');
  assert.equal(qa().drawStart,nextStart);assert.equal(state().selected,-1);assert.equal(app.paperCards.debug().winner,'');assert.equal(app.paperCards.debug().pendingIndex,3);
  for(const elapsed of [20,130,300,500,599]){await advanceTo(nextStart+elapsed);for(const theme of ['space','paper','classroom','paper'])app.setTheme(theme);assert.equal(qa().drawStart,nextStart);assert.equal(state().selected,-1);assert.deepEqual(state().used,cancelledUsed);assert.equal(env.speech.spoken.length,spoken)}
  env.randomQueue=[10];await advanceTo(nextStart+600);assert.equal(state().selected,3);assert.equal(env.randomCalls-randomBefore,2);assert.equal(app.paperCards.debug().selectedIndex,3);
  const d=app.paperCards.debug(),chosen=assertPaperWinner(d,3);assert.equal(d.resultSettling,false);assert.ok(Math.abs(chosen.x-d.width/2)<.001);assert.ok(chosen.facing>.999);
  await env.step(700);await env.flush();assert.equal(env.speech.spoken.length,spoken+1);assert.equal(env.speech.spoken.at(-1).utterance.text,state().names[3]);
  const expectedResults=offset>600?2:1;assert.equal(since('sounds.begin',before).length,2);assert.equal(since('sounds.result',before).length,expectedResults);assert.equal(since('paper.reveal',before).length,expectedResults);assert.equal(since('space.reveal',before).length,expectedResults);
  await env.step(5000);assert.equal(env.speech.spoken.length,spoken+1);assert.equal(state().selected,3);assert.equal(env.frames.size,1);
 });

 await test('reduced motion keeps the whole grid still and reveals the same real winner without a settling tail',async()=>{
  await clean('paper');mode(false);setReducedMotion(true);app.paperCards.reset();
  try{
   env.randomQueue=[1];const before=calls.length;app.pick();await env.flush();const started=env.now,initial=app.paperCards.debug(),geometry=d=>d.cards.map(c=>({id:c.id,x:c.x,y:c.y,width:c.width,height:c.height,mesh:c.mesh}));
   for(const offset of [100,300,599]){await advanceTo(started+offset);assert.equal(state().selected,-1);assert.deepEqual(geometry(app.paperCards.debug()),geometry(initial))}
   env.randomQueue=[5];await advanceTo(started+600);const d=app.paperCards.debug(),chosen=assertPaperWinner(d,1);assert.equal(state().selected,1);assert.ok(chosen.facing>.999);assert.ok(Math.abs(chosen.x-d.width/2)<.001);assert.equal(since('sounds.result',before).length,1);await env.step(500);assert.equal(app.paperCards.debug().frame,d.frame);assert.equal(env.frames.size,1);
  }finally{setReducedMotion(false);app.cancelDraw()}
 });

 window.cancelCountdown();app.cancelDraw();
 console.log(`PASS ${checks} independent actual-production paper lifecycle groups (${process.env.COUNTDOWN_FIRST?'countdown-first':'scene-first'}, initial ${storage['sunlit-theme']}). Rendering fixtures establish scheduling/state/finite geometry, not browser CSS pixels or real audio.`);
}
