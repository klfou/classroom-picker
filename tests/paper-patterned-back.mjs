import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createPaperCards,PAPER_DRAW_TIMING} from '../dist/paper-cards.js';
import {createCanvasRecorder,cacheSignature,clearOutput} from './helpers/paper-canvas-recorder.mjs';

// This source/art-cache contract runs without native Canvas dependencies.
// Native pixel comparisons against the approved preview are a separate QA check.
const source=readFileSync(new URL('../dist/paper-cards.js',import.meta.url),'utf8');
const backSource=source.slice(source.indexOf('function makeBack('),source.indexOf('function makeFront(')).trim();
assert.equal(createHash('sha256').update(backSource).digest('hex'),'f4899b19243991c0060f608117ea192921f27631e879dfd89ecb243b6616344e','Back exactly retains the approved red four-suit vector artwork');
assert.equal(/Math\.random|\bDate\b|performance|requestAnimationFrame|setInterval|fillText|strokeText|grain\(/.test(backSource),false,'Back art has no random, clock, animation, font-glyph or fine grain dependency');
for(const suit of ['spade','heart','club','diamond'])assert.ok(backSource.includes(`suit('${suit}'`));
const lineWidths=[...backSource.matchAll(/g\.lineWidth=([\d.]+)/g)].map(m=>Number(m[1]));
assert.ok(lineWidths.length>0&&Math.min(...lineWidths)>=2,'Approved broad ornament strokes replace the former .78 px fine mesh');
assert.deepEqual(PAPER_DRAW_TIMING,{gather:0,rotate:600,scatter:0,total:600,turn:Math.PI});
const saved={random:Math.random,raf:globalThis.requestAnimationFrame};
Math.random=()=>{throw Error('Back presentation cannot consume selection randomness')};
globalThis.requestAnimationFrame=()=>{throw Error('Back presentation cannot schedule its own frame')};
try{
 const {Canvas,surfaces}=createCanvasRecorder(),output=new Canvas(),view=createPaperCards(output,{active:false});
 const names=Array.from({length:72},(_,i)=>`同学${i+1}`);view.setNames(names);
 assert.equal(surfaces.length,1,'Inactive theme remains lazy');view.setActive(true);
 const back=surfaces[1],front=surfaces[2],backSignature=cacheSignature([back]),frontSignature=cacheSignature([front]);
 assert.deepEqual([back.width,back.height],[480,672]);assert.equal(back.ctx.prints.length,0,'Four back suits are paths, never font glyphs');assert.equal(back.ctx.stack.length,0);
 const stableBack=label=>assert.deepEqual(cacheSignature([back]),backSignature,`${label}: back source and paint count stay unchanged`);
 const stableFront=label=>assert.deepEqual(cacheSignature([front]),frontSignature,`${label}: blank front source and paint count stay unchanged`);
 const initialFrames=view.debug().frame,initialCount=surfaces.length;
 for(let t=0;t<=60000;t+=1000)view.render(t);
 assert.equal(view.debug().frame,initialFrames,'Idle time never animates the pattern');assert.equal(surfaces.length,initialCount);
 for(const [w,h]of [[1366,518],[390,456],[320,246],[320,180]]){
  view.resize(w,h);view.reset();const created=surfaces.length,layout=view.debug().layout,idle=view.debug().cards;
  for(const index of [0,35,71]){
   view.prepare(names[index],100000,index);
   for(const elapsed of [0,75,150,299,300,301,450,599,600]){
    clearOutput(output);view.render(100000+elapsed);
    const state=view.debug();assert.equal(state.resultDuration,600);assert.deepEqual(state.layout,layout);
    for(const card of state.cards.filter(c=>!c.selected))assert.deepEqual(card,idle.find(c=>c.id===card.id),'Unselected cards and their pattern geometry stay fixed');
    stableBack('flip frame');stableFront('flip frame');
   }
   view.reveal(names[index],100600,index);assert.equal(view.debug().resultSettling,false);view.reset();
  }
  assert.equal(surfaces.length,created,'Flip, commit and reset never allocate art');
  stableBack('resize and repeated selection');
 }
 for(const state of ['running','paused','finished']){
  view.setCountdown({state,text:'02:41',hundredths:'37'});view.render(200000);
  stableBack(`countdown ${state}`);stableFront(`countdown ${state}`);
 }
 const warmCount=surfaces.length;
 for(let i=0;i<40;i++){
  view.setCountdown({state:'running',text:`02:${String(i%60).padStart(2,'0')}`,hundredths:String(i%100).padStart(2,'0')});view.render(200001+i);
  view.setActive(false);view.render(200002+i);view.setActive(true);stableBack('countdown/theme activation');
 }
 assert.equal(surfaces.length,warmCount,'Warm countdown and theme toggles never allocate art');
 view.setCountdown(null);view.reset();
 for(let i=0;i<20;i++){view.setActive(false);view.setActive(true);stableBack('idle theme activation')}
 assert.equal(surfaces.length,warmCount);view.dispose();assert.equal(view.debug().resources.surfaces,0);
 console.log('PASS approved patterned back: exact artwork fingerprint, four vector suits, broad linework, zero RNG/RAF/font dependency, 600 ms unchanged, static idle/nonselected geometry, one cached back across flips/countdown/activation/resizing and disposal. Native pixel matching is checked separately; this does not certify browser or hardware flicker.');
}finally{Math.random=saved.random;if(saved.raf===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=saved.raf}
