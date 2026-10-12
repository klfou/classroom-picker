import assert from 'node:assert/strict';
import {register} from 'node:module';
import {createPaperCards,PAPER_DRAW_TIMING,PAPER_PALETTE} from '../dist/paper-cards.js';
import {createCountdown,splitPreciseTime} from '../dist/countdown-state.js';
import {countdownDigitLayout} from '../dist/countdown-digit-layout.js';

import {createCanvasRecorder,flattenedText,clearOutput,cacheSignature} from './helpers/paper-canvas-recorder.mjs';
// Portable Canvas-call and geometry QA. Source crops and transforms inspect
// the real adapter's cached atlases, without claiming browser CSS validation.
const {Canvas,surfaces}=createCanvasRecorder();
const sizes=[[1920,810],[1366,518],[1024,518],[768,680],[390,456],[320,246],[320,180],[844,132],[390,132]];
const chars=debug=>debug.timerCards.map(card=>card.char).join('');
const geometry=debug=>debug.timerCards.map(({char,decoration,faceKey,glyphHeight,glyphBounds,...card})=>card);
const finiteBounds=(b,label)=>{for(const key of ['minX','maxX','minY','maxY'])assert.ok(Number.isFinite(b[key]),`${label}: ${key} is finite`);assert.ok(b.maxX>b.minX&&b.maxY>b.minY,`${label}: nonempty bounds`)};
const bounded=(b,w,h,label)=>{finiteBounds(b,label);assert.ok(b.minX>=-1e-8&&b.maxX<=w+1e-8&&b.minY>=-1e-8&&b.maxY<=h+1e-8,`${label}: ${JSON.stringify(b)} fits ${w}x${h}`)};
const disjoint=(a,b,label)=>assert.ok(a.maxX<=b.minX||b.maxX<=a.minX||a.maxY<=b.minY||b.maxY<=a.minY,label);
function checkLayout(d,label){
 const {timerLayout:l,timerCards:cards,width:w,height:h}=d;assert.ok(l,`${label}: timer layout exists`);bounded(l.bounds,w,h,`${label}: complete layout`);
 for(const [i,c]of cards.entries()){
  for(const key of ['x','y','width','height'])assert.ok(Number.isFinite(c[key]),`${label}: card ${i} finite ${key}`);
  assert.ok(c.height>c.width&&c.width>0,`${label}: card ${i} is upright portrait paper`);bounded(c.bounds,w,h,`${label}: card ${i}`);
  for(const other of cards.slice(i+1))disjoint(c.bounds,other.bounds,`${label}: cards do not overlap`);
 }
 assert.equal(d.selectedNameVisible,false,`${label}: timer covers roster names`);
 assert.equal(l.title.text,'背书倒计时');bounded(l.title.bounds,w,h,`${label}: title`);assert.ok(Math.abs(l.title.top-h*.09)<1e-8,`${label}: title is anchored at9% of visible height`);assert.ok(Math.abs(l.title.height-Math.min(64,w*.07,h*.13))<1e-8,`${label}: title uses the shared screen-space visual height`);assert.ok(l.title.bounds.maxY<Math.min(...cards.map(c=>c.bounds.minY)),`${label}: title leaves positive breathing room above all running and finish cards`);
 const finished=cards.some(c=>c.role==='finish');
 if(finished){assert.equal(cards.length,3);assert.equal(chars(d),'时间到');assert.equal(l.colon,null);assert.equal(l.decimal,null);assert.ok(cards.every(c=>c.role==='finish'))}
 else{
  const main=cards.filter(c=>c.role==='main'),minor=cards.filter(c=>c.role==='hundredths');assert.equal(main.length,4);assert.equal(minor.length,2);assert.equal(cards.length,6);
  assert.ok(main.every(c=>c.width===main[0].width&&c.height===main[0].height&&c.y===main[0].y),`${label}: four equally sized aligned main cards`);
  assert.ok(minor.every(c=>c.width===minor[0].width&&c.height===minor[0].height&&c.y===minor[0].y),`${label}: two equally sized aligned hundredths cards`);
  assert.ok(minor[0].width<main[0].width&&minor[0].height<main[0].height,`${label}: hundredths are smaller`);
  const digitTarget=countdownDigitLayout(w,h);assert.ok(Math.abs(l.digitTargetHeight-digitTarget.height)<1e-8,`${label}: main ink shares unchanged classroom height`);for(const c of cards){assert.ok(c.glyphBounds,`${label}: actual cached core bounds are exposed`);assert.ok(Math.abs(c.glyphTargetHeight-digitTarget.height*(c.role==='main'?1:.30))<1e-8,`${label}: uniform alphabet scale retains main/fraction hierarchy`);assert.ok(c.glyphHeight<=c.glyphTargetHeight+1e-8&&c.glyphHeight>=c.glyphTargetHeight*.95,`${label}: natural glyph-height differences stay within the alphabet envelope`);bounded(c.glyphBounds,w,h,`${label}: actual central ink`);disjoint(c.glyphBounds,l.title.bounds,`${label}: title cannot overlap central ink`);
   const inner=c.innerFrameBounds,halfX=.4*c.width/420,halfY=.4*c.height/588,horizontalGap=Math.min(c.glyphBounds.minX-inner.minX,inner.maxX-c.glyphBounds.maxX)-halfX;
   assert.ok(horizontalGap>=c.width*.024,`${label}: widest alphabet ink clears both complete inner side rules (${horizontalGap})`);
   for(const corner of c.cornerEnvelopeBounds){
    assert.ok(corner.minX-inner.minX-halfX>=c.width*.023&&inner.maxX-corner.maxX-halfX>=c.width*.023,`${label}: all-rank/all-suit envelope sits horizontally inside the complete inner frame`);
    assert.ok(corner.minY-inner.minY-halfY>=c.glyphTargetHeight*.010&&inner.maxY-corner.maxY-halfY>=c.glyphTargetHeight*.010,`${label}: corner envelope clears complete inner top/bottom rules`);
    const gap=Math.max(c.glyphBounds.minY-corner.maxY,corner.minY-c.glyphBounds.maxY);assert.ok(gap>=c.glyphTargetHeight*.008,`${label}: corners have a positive vertical ink gap to central numeral (${gap})`);
   }
  }
  assert.ok(l.colon&&l.decimal,`${label}: separators remain separate from cards`);
  for(const [kind,item]of [['colon',l.colon],['decimal',l.decimal]]){
   bounded(item.bounds,w,h,`${label}: ${kind}`);for(const c of cards)disjoint(item.bounds,c.bounds,`${label}: ${kind} does not overlap a card`);disjoint(item.bounds,l.title.bounds,`${label}: ${kind} does not overlap title`);
  }
  assert.ok(main[1].bounds.maxX<=l.colon.bounds.minX&&l.colon.bounds.maxX<=main[2].bounds.minX,`${label}: colon separates MM and SS`);
  assert.ok(l.decimal.bounds.maxX<=minor[0].bounds.minX,`${label}: decimal precedes hundredths`);
  if(l.flow==='inline')assert.ok(main[3].bounds.maxX<=l.decimal.bounds.minX,`${label}: inline decimal follows seconds`);else assert.ok(minor.every(c=>c.bounds.minY>main[0].bounds.maxY),`${label}: stacked hundredths have positive breathing room below seconds`);
 }
}
const assertCache=(actual,expected)=>{for(const [key,value]of Object.entries(expected))assert.equal(actual[key],value,`Timer cache ${key}`)};
const sourceArtwork=()=>surfaces.filter(canvas=>canvas.ctx.prints.some(p=>/^[0-9时间到♥♦♠♣]$/.test(p.text))&&!canvas.ctx.prints.some(p=>p.text==='本 次 点 名'));
const inCard=(print,card)=>{const x=(print.bounds.minX+print.bounds.maxX)/2,y=(print.bounds.minY+print.bounds.maxY)/2;return x>card.bounds.minX&&x<card.bounds.maxX&&y>card.bounds.minY&&y<card.bounds.maxY};
function actualFaces(canvas,debug){const visible=flattenedText(canvas,1/debug.dpr).filter(p=>/^[0-9时间到♥♦♠♣]$/.test(p.text));return debug.timerCards.map(card=>({card,prints:visible.filter(p=>inCard(p,card))}))}
const outputChars=(canvas,debug)=>actualFaces(canvas,debug).map(({prints})=>prints.filter(p=>/^[0-9时间到]$/.test(p.text)).sort((a,b)=>(b.bounds.maxY-b.bounds.minY)-(a.bounds.maxY-a.bounds.minY))[0]?.text||'').join('');
function checkArtwork(canvas,d,label){
 const faces=actualFaces(canvas,d);assert.equal(outputChars(canvas,d),chars(d),`${label}: actual core crops show exact timer characters`);
 for(const [slot,{card,prints}]of faces.entries()){
  const finished=card.role==='finish',suit=['♠','♥','♣','♦'][slot%4],color=slot%2?'#883b52':PAPER_PALETTE.ink;
  assert.deepEqual(card.decoration,{rank:finished?'':card.char,suit,color},`${label}: stable slot decoration including hundredths`);assert.equal(card.faceKey,`${card.char}:${suit}`);
  const numbers=prints.filter(p=>/^[0-9时间到]$/.test(p.text)),suits=prints.filter(p=>/[♥♦♠♣]/.test(p.text));assert.equal(numbers.length,finished?1:3,`${label}: exact center and rank count`);assert.equal(suits.length,2,`${label}: two suit corners`);assert.ok(numbers.every(p=>p.text===card.char),`${label}: both ranks equal the central digit`);assert.ok(suits.every(p=>p.text===suit&&p.color===color),`${label}: both suits match the stable slot`);
  const center=[...numbers].sort((a,b)=>(b.bounds.maxY-b.bounds.minY)-(a.bounds.maxY-a.bounds.minY))[0],corners=[...numbers.filter(p=>p!==center),...suits];assert.ok(center.matrix[0]>0&&center.matrix[3]>0,`${label}: central characters stay upright`);assert.ok(Math.abs(center.matrix[1])<1e-8&&Math.abs(center.matrix[2])<1e-8,`${label}: central characters never skew`);
  for(const print of [center,...corners]){
   const frame={minX:card.bounds.minX+card.width*26.4/420,maxX:card.bounds.maxX-card.width*26.4/420,minY:card.bounds.minY+card.height*26.4/588,maxY:card.bounds.maxY-card.height*26.4/588};
   const gap=Math.min(print.bounds.minX-frame.minX,frame.maxX-print.bounds.maxX,print.bounds.minY-frame.minY,frame.maxY-print.bounds.maxY);
   assert.ok(gap>=card.width*.004,`${label}: every numeric/finish core and suit clears the complete inner frame, including hundredths (${gap})`);
  }
  for(const corner of corners){const upper=(corner.bounds.minX+corner.bounds.maxX)/2<card.x;assert.ok(!corner.clipped,`${label}: corner glyph is not clipped by its atlas crop`);assert.equal(corner.color,color);assert.ok(upper?corner.matrix[0]>0&&corner.matrix[3]>0:corner.matrix[0]<0&&corner.matrix[3]<0,`${label}: upper corners upright and lower corners inverted`);assert.ok(Math.abs(corner.matrix[1])<1e-8&&Math.abs(corner.matrix[2])<1e-8);disjoint(corner.bounds,center.bounds,`${label}: corner cannot overlap central character`);assert.ok(corner.bounds.minX>=card.bounds.minX&&corner.bounds.maxX<=card.bounds.maxX&&corner.bounds.minY>=card.bounds.minY&&corner.bounds.maxY<=card.bounds.maxY,`${label}: complete corner inside paper`)}
 }
 assert.equal(canvas.ctx.prints.some(p=>/^[0-9时间到♥♦♠♣]$/.test(p.text)),false,`${label}: tick uses cached art rather than live glyph painting`);
}
const restore={random:Math.random,raf:globalThis.requestAnimationFrame,dpr:globalThis.devicePixelRatio};
Math.random=()=>{throw Error('Timer presentation must not consume the selection RNG')};
globalThis.requestAnimationFrame=()=>{throw Error('Timer presentation must not own an animation loop')};
try{
 assert.deepEqual(PAPER_DRAW_TIMING,{gather:0,rotate:600,scatter:0,total:600,turn:Math.PI});
 const output=new Canvas(),view=createPaperCards(output,{active:false}),names=['同学甲','同学乙'];view.setNames(names);
 const initialSurfaces=surfaces.length;
 for(const countdown of [{status:'running',remaining:600000},{state:'running',text:'09:59',hundredths:'99'},{status:'finished',remaining:0},{state:'running',text:'05:00',hundredths:'00'}]){view.setCountdown(countdown);view.resize(390,456);view.render(1000)}
 assert.equal(surfaces.length,initialSurfaces,'Initially hidden timer builds no artwork, background or glyph faces');
 assertCache(view.debug().timerCache,{digits:0,finish:0,total:0});assert.equal(view.debug().resources.surfaces,0);assert.equal(view.debug().frame,0);
 view.setActive(true);let d=view.debug();checkLayout(d,'initial visible timer');assert.equal(chars(d),'050000');assertCache(d.timerCache,{digits:10,finish:0,total:10});assert.ok(d.resources.surfaces<=10,'Ten digits and forty corner combinations share bounded atlases');
 const digits=sourceArtwork();assert.ok(digits.length<=3,'Timer core and corner atlases use at most three surfaces');assert.deepEqual([...new Set(digits.flatMap(face=>face.ctx.prints.filter(p=>/^[0-9]$/.test(p.text)).map(p=>p.text)))].sort(),[...'0123456789']);
 checkArtwork(output,d,'initial visible timer');
 const allocated=surfaces.length,digitPrints=cacheSignature(digits),stableGeometry=geometry(d),stableLayout=d.timerLayout;
 const atlasBytes=digits.reduce((sum,c)=>sum+c.width*c.height*4,0);assertCache(d.timerCache,{faces:40,atlases:digits.length,bytes:atlasBytes});assert.ok(atlasBytes<10*320*448*4,'Shared timer atlases consume less memory than ten old complete digit faces');
 for(let hundredths=0;hundredths<100;hundredths++){
  const value=String(hundredths).padStart(2,'0');clearOutput(output);view.setCountdown({state:'running',text:'09:59',hundredths:value});view.render(2000+hundredths*10);d=view.debug();
  assert.equal(chars(d),'0959'+value);checkArtwork(output,d,`Hundredths ${value}`);assert.deepEqual(geometry(d),stableGeometry,'Changing digits cannot move, resize or flip any card');assert.deepEqual(d.timerLayout,stableLayout);assert.equal(surfaces.length,allocated);assert.ok(output.ctx.images.filter(({image})=>sourceArtwork().includes(image)).every(({image})=>digits.includes(image)),'Every tick reuses exact prewarmed atlas identities');
 }
 assert.deepEqual(cacheSignature(digits),digitPrints,'No cached glyph/corner atlas is repainted or cleared during hundredths updates');
 // Every digit is exercised in every fixed suit slot, including repeated digits
 // and both smaller hundredths cards. No new face or corner may be generated.
 for(const char of '0123456789'){
  clearOutput(output);view.setCountdown({state:'running',text:`${char}${char}:${char}${char}`,hundredths:char+char});view.render(3000+Number(char));checkArtwork(output,view.debug(),`All slots show ${char}`);assert.equal(surfaces.length,allocated);assert.deepEqual(cacheSignature(digits),digitPrints);
 }
 const unchangedFrame=view.debug().frame;for(let time=3100;time<4000;time+=10)view.render(time);assert.equal(view.debug().frame,unchangedFrame,'Unchanged timer state does not repaint');
 console.log('PASS paper timer: lazy hidden allocation, bounded immutable core/corner atlases, exact matching ranks and four stable suits on six upright cards, all 100 hundredths, every digit in every slot, nonoverlapping corners, fixed geometry and stable-frame CPU gating');

 let now=0,finishes=0;const timer=createCountdown({now:()=>now,onFinish:()=>finishes++});timer.restart(10);
 for(const [elapsed,expected]of [[0,'100000'],[1,'100000'],[9,'100000'],[10,'095999'],[11,'095999'],[999,'095901'],[1000,'095900'],[599989,'000002'],[599990,'000001'],[599991,'000001'],[599999,'000001'],[600000,'时间到'],[600001,'时间到']]){
  now=elapsed;clearOutput(output);const state=timer.tick();view.setCountdown({...splitPreciseTime(state.remaining),state:state.status});view.render(5000+elapsed);d=view.debug();assert.equal(chars(d),expected,`Exact ${elapsed} ms boundary`);checkLayout(d,`Exact ${elapsed} ms boundary`);
  if(output.ctx.images.length)checkArtwork(output,d,`Actual face images at ${elapsed} ms boundary`);
  if(state.status==='finished'){assert.equal(d.timerCards.length,3);assert.ok(d.timerCards.every(c=>c.role==='finish'&&!/[0-9]/.test(c.char)));assert.equal(output.ctx.prints.some(p=>/00:00|^0$/.test(p.text)),false,'Completion cannot draw a zero timer')}
 }
 assert.equal(finishes,1);assertCache(d.timerCache,{digits:10,finish:3,total:13});assert.ok(d.resources.surfaces<=12,'Finish art adds only bounded core/corner atlases');const afterFinish=surfaces.length;
 const allFaces=sourceArtwork(),finishFaces=allFaces.filter(face=>face.ctx.prints.some(p=>/^[时间到]$/.test(p.text)));assert.deepEqual([...new Set(finishFaces.flatMap(face=>face.ctx.prints.filter(p=>/^[时间到]$/.test(p.text)).map(p=>p.text)))].sort(),[...'时间到'].sort());
 assertCache(d.timerCache,{faces:43,atlases:allFaces.length,bytes:allFaces.reduce((sum,c)=>sum+c.width*c.height*4,0)});const allPrints=cacheSignature(allFaces);
 for(const minutes of [3,5,10]){clearOutput(output);view.setCountdown({state:'running',...splitPreciseTime(timer.restart(minutes).remaining)});view.render(700000+minutes);assert.equal(chars(view.debug()),String(minutes).padStart(2,'0')+'0000');checkArtwork(output,view.debug(),`${minutes} minute restart`);assertCache(view.debug().timerCache,{digits:10,finish:3,total:13});assert.equal(surfaces.length,afterFinish)}
 assert.deepEqual(cacheSignature(allFaces),allPrints,'Restarting after completion reuses both atlas sets');
 console.log('PASS paper timer: exact 10:00 → 09:59.99 and last hundredth → 时间到 boundaries, three finish-only faces, one finish callback, 3/5/10 restart cache reuse');

 for(const [w,h]of sizes){
  let runningGeometry=null,finishedGeometry=null;
  for(const ratio of [1,1.5,2]){
   globalThis.devicePixelRatio=ratio;view.resize(w,h);
   for(const value of [{state:'running',text:'10:00',hundredths:'00'},{state:'running',text:'09:59',hundredths:'99'},{state:'finished',text:'00:00',hundredths:'00'}]){
    clearOutput(output);view.setCountdown(value);view.render(800000+ratio);d=view.debug();checkLayout(d,`${w}x${h} at DPR ${ratio} ${value.state}`);if(output.ctx.images.length)checkArtwork(output,d,`${w}x${h} DPR ${ratio} ${value.state}`);assertCache(d.timerCache,{digits:10,finish:3,total:13});
    if(value.state==='running'){if(runningGeometry)assert.deepEqual(geometry(d),runningGeometry);else runningGeometry=geometry(d)}else if(finishedGeometry)assert.deepEqual(geometry(d),finishedGeometry);else finishedGeometry=geometry(d);
    assert.equal(output.width,Math.round(w*d.dpr));assert.equal(output.height,Math.round(h*d.dpr));
   }
  }
 }
 assert.deepEqual(cacheSignature(allFaces),allPrints,'Resize and DPR never recreate or repaint timer textures');
 view.setCountdown(null);view.render(900000);assert.equal(view.debug().timerLayout,null);assert.deepEqual(view.debug().timerCards,[]);
 // Winner state may remain in the model, but no name, draw movement or extra
 // pending presentation is visible while the timer owns the paper canvas.
 view.prepare(names[1],910000,1);view.render(910300);assert.equal(view.debug().pendingIndex,1);view.cancel();view.setCountdown({status:'running',remaining:300000});view.render(910301);assert.equal(view.debug().pendingIndex,-1);assert.equal(view.debug().winner,'');assert.equal(view.debug().selectedNameVisible,false);
 const hiddenFrame=view.debug().frame;view.setActive(false);for(let t=0;t<10;t++){view.setCountdown({status:'running',remaining:300000-t*10});view.render(920000+t*10)}assert.equal(view.debug().frame,hiddenFrame);view.setActive(true);assert.equal(chars(view.debug()),'045991');
 const retainedSurfaces=[...surfaces.slice(1,5),surfaces.at(-1),...allFaces];view.dispose();assertCache(view.debug().timerCache,{digits:0,finish:0,total:0});assert.deepEqual(view.debug().timerCards,[]);assert.equal(view.debug().timerLayout,null);assert.equal(view.debug().textureCount,0);assert.equal(view.debug().resources.surfaces,0);assert.equal(view.debug().resources.cpuBytes,0);assert.ok(retainedSurfaces.every(face=>face.width===1&&face.height===1),'All retained artwork, background and timer surfaces release their backing stores');
 const disposedAllocated=surfaces.length;view.setCountdown({status:'running',remaining:300000});view.setActive(true);view.resize(1920,810);view.render(999999);assert.equal(surfaces.length,disposedAllocated,'Disposed adapter cannot recreate timer faces');view.dispose();
 const finishedOutput=new Canvas(320,180),finishedFirst=createPaperCards(finishedOutput,{active:false});finishedFirst.setCountdown({status:'finished',remaining:0});finishedFirst.render(1);assertCache(finishedFirst.debug().timerCache,{digits:0,finish:0,total:0});assert.equal(finishedFirst.debug().frame,0);finishedFirst.setActive(true);assertCache(finishedFirst.debug().timerCache,{digits:0,finish:3,total:3},'First activation after expiry builds only the three finish faces');assert.ok(finishedFirst.debug().resources.surfaces<=9);checkArtwork(finishedOutput,finishedFirst.debug(),'Finished-first actual artwork');checkLayout(finishedFirst.debug(),'first active frame is already finished');finishedFirst.dispose();assert.equal(finishedFirst.debug().resources.surfaces,0);
 console.log('PASS paper timer: nine desktop/mobile/short aspect ratios × three DPRs, shared9% title anchor/visual size, title/colon/decimal/card spacing, no clipping or overlap, hidden CPU gating, finish-first allocation and complete disposal');
}finally{
 Math.random=restore.random;if(restore.raf===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=restore.raf;if(restore.dpr===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=restore.dpr;
}

// Run real scene/countdown modules with the existing deterministic scheduler.
register('./helpers/theme-scene-loader.mjs',import.meta.url);
const {setup,dist,$,select}=await import('./helpers/theme-environment.mjs');
const env=await setup({storage:{'sunlit-theme':'classroom'}});await import(dist+'/scene.js');const app=window.classroom;await env.awaitReady(app.ready);env.bindRenderer(app.renderer);await import(dist+'/countdown.js');
const shared=()=>__sharedThemeQA(),sharedTimer=()=>__sharedCountdownQA(),paper=()=>app.paperCards.debug();
assert.equal(sharedTimer().selectedMinutes,5);assertCache(paper().timerCache,{digits:0,finish:0,total:0});assert.equal(paper().resources.surfaces,0);
$('timer-primary').click();await env.step(100);assert.equal(sharedTimer().snapshot.duration,300000);assert.equal(sharedTimer().snapshot.remaining,299900);assert.equal(paper().countdown.state,'running');assertCache(paper().timerCache,{digits:0,finish:0,total:0});assert.equal(paper().resources.surfaces,0,'A shared timer in classroom cannot allocate hidden paper textures');
app.setTheme('space');await env.step(100);assertCache(paper().timerCache,{digits:0,finish:0,total:0});app.setTheme('paper');assert.equal(chars(paper()),'045980');checkLayout(paper(),'production first paper activation');assertCache(paper().timerCache,{digits:10,finish:0,total:10});
const roster=Array.from({length:8},(_,i)=>({id:`timer-qa-${i}`,name:`计时测试${i+1}`,row:1+Math.floor(i/4),col:1+i%4}));app.applyRoster(roster);$('repeat-allow').click();
const clean=async()=>{window.cancelCountdown();app.cancelDraw();app.setTheme('paper');await env.step(1600);await env.flush()};
for(const offset of [0,16,100,300,599]){
 await clean();env.randomQueue=[3];app.pick();await env.flush();await env.step(offset);const generation=shared().drawGeneration,used=app.getState().used,spoken=env.speech.spoken.length;
 assert.equal(paper().pendingIndex,3);$('timer-primary').click();await env.step(0);assert.equal(shared().drawGeneration,generation+1);assert.equal(shared().drawStart,null);assert.equal(app.getState().busy,false);assert.equal(paper().pendingIndex,-1);assert.equal(paper().pendingName,'');assert.equal(paper().winner,'');assert.equal(chars(paper()),'050000');assert.equal(paper().selectedNameVisible,false);
 await env.step(2000);await env.flush();assert.equal(app.getState().selected,-1);assert.deepEqual(app.getState().used,used);assert.equal(env.speech.spoken.length,spoken,'Interrupted paper draw cannot announce a stale result');assert.equal(paper().drawing,false);assert.equal(env.frames.size,1);
}
console.log('PASS paper timer integration: hidden classroom/space lifecycle and atomic draw takeover at 0/16/100/300/599 ms, no stale result, name, used seat or duplicate RAF');

await clean();select('timer-minutes',10);$('timer-primary').click();await env.step(0);const initialDeadline=env.now+600000;assert.equal(chars(paper()),'100000');await env.step(50);assert.equal(chars(paper()),'095995');const flight=shared().tween;
select('timer-minutes',3);assert.equal(sharedTimer().snapshot.duration,600000);assert.equal(sharedTimer().snapshot.remaining,initialDeadline-env.now,'Changing selection only changes the next run');
$('timer-primary').click();await env.step(0);assert.equal(sharedTimer().snapshot.duration,180000);assert.equal(sharedTimer().snapshot.remaining,180000);assert.equal(shared().tween,flight,'Restart cannot restart or replace the board camera flight');assert.equal(chars(paper()),'030000');
select('timer-minutes',5);$('timer-primary').click();await env.step(0);let deadline=env.now+300000;assert.equal(chars(paper()),'050000');
const selection=app.getState().selected,used=app.getState().used;
for(const theme of ['classroom','space','paper']){app.setTheme(theme);await env.step(100);assert.equal(sharedTimer().snapshot.remaining,deadline-env.now);assert.equal(sharedTimer().snapshot.status,'running');assert.equal(shared().boardMode,true);assert.equal(app.getState().selected,selection);assert.deepEqual(app.getState().used,used);assert.equal(env.frames.size,1)}
for(const [w,h]of [[1920,1080],[1366,768],[1024,768],[768,1024],[390,844],[320,600],[320,568],[844,352]]){await env.resize(w,h);checkLayout(paper(),`production viewport ${w}x${h}`);assert.equal(paper().width,env.width);assert.equal(paper().height,env.viewport.height);assert.equal(sharedTimer().snapshot.remaining,deadline-env.now);assert.equal(sharedTimer().snapshot.status,'running')}
for(const fullscreen of [true,false]){await $('fullscreen').onclick();await env.resize(fullscreen?1920:1366,fullscreen?1080:768);checkLayout(paper(),`production fullscreen ${fullscreen}`);assert.equal(sharedTimer().snapshot.remaining,deadline-env.now);assert.equal(shared().boardMode,true);assert.equal(env.frames.size,1)}
// Hide at the last second, then resume after expiry. The deadline and finish
// signal remain shared, and hidden paper faces stay untouched until shown.
await env.step(deadline-env.now-1000);assert.equal(sharedTimer().snapshot.remaining,1000);document.hidden=true;document.dispatchEvent({type:'visibilitychange'});const hiddenFrame=paper().frame,chimes=env.audio.oscillators.length;await env.step(1001);assert.equal(sharedTimer().snapshot.status,'finished');assert.equal(paper().frame,hiddenFrame);assert.equal(env.audio.oscillators.length,chimes+1);document.hidden=false;document.dispatchEvent({type:'visibilitychange'});await env.step(1);assert.equal(chars(paper()),'时间到');checkLayout(paper(),'production expired timer');assert.equal(paper().timerCards.length,3);assertCache(paper().timerCache,{digits:10,finish:3,total:13});
for(const theme of ['classroom','space','paper']){app.setTheme(theme);await env.step(100);assert.equal(sharedTimer().snapshot.status,'finished')}assert.equal(chars(paper()),'时间到');assert.equal(env.audio.oscillators.length,chimes+1,'Theme switches cannot duplicate the completion sound');
$('timer-primary').click();await env.step(0);assert.equal(chars(paper()),'050000');assert.equal(sharedTimer().snapshot.status,'running');env.randomQueue=[6];app.pick();assert.equal(sharedTimer().snapshot.status,'ready');assert.equal(shared().boardMode,false);assert.equal(paper().countdown,null);assert.equal(paper().timerLayout,null);assert.deepEqual(paper().timerCards,[]);assert.equal(app.getState().drawDurationMs,600);await env.step(599);assert.equal(app.getState().selected,-1);await env.step(1);assert.equal(app.getState().selected,6);assert.equal(app.getState().busy,false);assert.equal(paper().resultSettling,false);assert.equal(env.frames.size,1);
console.log('PASS paper timer integration: default 5 and 3/5/10 choices, restart preserves flight, theme/deadline identity, eight responsive viewports, fullscreen in/out, hidden expiry once, finish-only presentation and timer→600 ms pick');
