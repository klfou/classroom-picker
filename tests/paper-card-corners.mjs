import assert from 'node:assert/strict';
import {createPaperCards,PAPER_PALETTE,PAPER_DRAW_TIMING} from '../dist/paper-cards.js';

import {createCanvasRecorder,identity,flattenedText,clearOutput} from './helpers/paper-canvas-recorder.mjs';
// Follow actual selected-face text and its Canvas transforms without claiming
// browser CSS or font-pixel validation.
const {Canvas,surfaces}=createCanvasRecorder();
const expected=index=>({index,rank:String(2+index%9),suit:['♠','♥','♣','♦'][index%4],color:index%2?'#883b52':PAPER_PALETTE.ink});
const near=(actual,target,label)=>assert.ok(Math.abs(actual-target)<1e-8,`${label}: ${actual} ≈ ${target}`);
const disjoint=(a,b)=>a.maxX<=b.minX||b.maxX<=a.minX||a.maxY<=b.minY||b.maxY<=a.minY;
function verifyArtwork(face,index,name){
 const e=expected(index),prints=face.ctx.prints,rank=prints.filter(p=>p.text===e.rank),suit=prints.filter(p=>p.text===e.suit),corners=[...rank,...suit];assert.equal(rank.length,2,`${index}: rank printed at two corners`);assert.equal(suit.length,2,`${index}: suit printed at two corners`);
 for(const [kind,list]of [['rank',rank],['suit',suit]]){
  const [upper,lower]=list;const oldSize=kind==='rank'?38:35;assert.ok(upper.fontSize/oldSize>=1.6&&upper.fontSize/oldSize<=1.8,`${index}: ${kind} is 1.6–1.8× the previous size`);assert.equal(lower.fontSize,upper.fontSize);assert.equal(upper.color,e.color);assert.equal(lower.color,e.color);assert.deepEqual(upper.matrix,identity,`${index}: upper-left ${kind} stays upright`);
  for(const [i,value]of [-1,0,0,-1,480,672].entries())near(lower.matrix[i],value,`${index}: lower-right ${kind} uses standard 180-degree rotation`);
  assert.ok(upper.bounds.minX>=0&&upper.bounds.minY>=0&&upper.bounds.maxX<480*.28&&upper.bounds.maxY<672*.3,`${index}: ${kind} sits safely in upper-left`);
  assert.ok(lower.bounds.maxX<=480&&lower.bounds.maxY<=672&&lower.bounds.minX>480*.72&&lower.bounds.minY>672*.7,`${index}: ${kind} sits safely in lower-right`);
  // Both rules are complete. Even the recorder's conservative full-em ink
  // boxes clear the inner rule, including the widest two-digit rank,10.
  const innerInset=26*480/420,ruleHalf=.8*480/420/2;
  for(const corner of [upper,lower]){
   const gap=Math.min(corner.bounds.minX-innerInset-ruleHalf,480-innerInset-ruleHalf-corner.bounds.maxX,corner.bounds.minY-innerInset-ruleHalf,672-innerInset-ruleHalf-corner.bounds.maxY);
   assert.ok(gap>=12,`${index}: ${kind} clears the complete inner rule by at least12 artwork pixels (${gap})`);
  }

 }
 const center=prints.filter(p=>!corners.includes(p)&&p.text!=='本 次 点 名');assert.equal(center.map(p=>p.text).join(''),name,`${index}: complete center name remains present`);
 for(const text of prints.filter(p=>!corners.includes(p))){assert.deepEqual(text.matrix,identity,`${index}: name/header is never upside-down`);for(const corner of corners)assert.ok(disjoint(text.bounds,corner.bounds),`${index}: corners cannot overlap center name or header`)}
 assert.equal(face.ctx.stack.length,0,'Selected artwork restores all Canvas state');assert.deepEqual(face.ctx.matrix,identity);assert.equal(prints.some(p=>/[JQKA]/.test(p.text)),false,'Ranks use only the requested 2–10 digits');
}
const saved={random:Math.random,raf:globalThis.requestAnimationFrame};Math.random=()=>{throw Error('Student decoration must not use the selection RNG')};globalThis.requestAnimationFrame=()=>{throw Error('Student decoration must not own animation scheduling')};
try{
 const output=new Canvas(),view=createPaperCards(output,{active:false}),name='同名同学',roster=Array(72).fill(name);view.setNames(roster);view.prepare(name,1000,0);assert.equal(view.debug().resources.surfaces,0);assert.deepEqual(view.debug().selectedDecoration,expected(0));view.setActive(true);
 const face=surfaces.find(canvas=>canvas.ctx.prints.some(p=>p.text==='本 次 点 名'));assert.ok(face);const front=face.ctx.images[0].image,back=surfaces[1];assert.equal(front.ctx.prints.length,0,'Shared blank paper stays undecorated');assert.equal(back.ctx.prints.length,0,'Card back gains no rank or suit');
 const rules=front.ctx.strokes.filter(stroke=>stroke.path.at(-1)?.[0]==='closePath');assert.equal(rules.length,2,'Shared front has exactly two complete closed rules');
 for(const [i,inset]of [18,26].entries()){
  const path=rules[i].path,radius=i?9:13;
  assert.deepEqual(path,[['moveTo',inset+radius,inset],['lineTo',420-inset-radius,inset],['quadraticCurveTo',420-inset,inset,420-inset,inset+radius],['lineTo',420-inset,588-inset-radius],['quadraticCurveTo',420-inset,588-inset,420-inset-radius,588-inset],['lineTo',inset+radius,588-inset],['quadraticCurveTo',inset,588-inset,inset,588-inset-radius],['lineTo',inset,inset+radius],['quadraticCurveTo',inset,inset,inset+radius,inset],['closePath']],`Rule${i+1} traverses all four edges and rounded corners without gaps`);
 }
 assert.equal(front.ctx.clears,0,'The stock is never erased around content');const created=surfaces.length;
 let priorPaints=view.debug().resources.selectedPaints;
 for(let index=0;index<roster.length;index++){
  const time=2000+index*700;view.prepare(name,time,index);let d=view.debug();assert.deepEqual(d.selectedDecoration,expected(index));assert.equal(d.pendingIndex,index);assert.equal(d.selectedIndex,-1);assert.equal(d.winner,'');verifyArtwork(face,index,name);
  if(index>0)assert.equal(d.resources.selectedPaints,priorPaints+1,'Changing original index repaints same-name artwork with the new corners');priorPaints=d.resources.selectedPaints;
  const prints=JSON.stringify(face.ctx.prints);view.render(time+599);assert.equal(view.debug().pendingIndex,index);assert.equal(view.debug().selectedIndex,-1);view.render(time+600);assert.equal(view.debug().stage,'awaiting-reveal');view.reveal(name,time+600,index);d=view.debug();assert.deepEqual(d.selectedDecoration,expected(index));assert.equal(d.selectedIndex,index);assert.equal(d.pendingIndex,-1);assert.equal(d.resultSettling,false);assert.equal(d.resultDuration,600);assert.equal(d.resources.selectedPaints,priorPaints,'Prepared commit reuses exact corner/name art');assert.equal(JSON.stringify(face.ctx.prints),prints);assert.equal(surfaces.length,created,'Every identity reuses a single bounded selected surface');
  const selected=d.cards.filter(c=>c.selected);assert.equal(selected.length,1);assert.equal(selected[0].studentIndex,index);assert.equal(selected[0].name,name);assert.ok(selected[0].facing>.999);assert.ok(d.cards.filter(c=>!c.selected).every(c=>c.name===''&&c.studentIndex===null&&!c.showName));
  view.cancel();assert.deepEqual(view.debug().selectedDecoration,expected(index),'Cancelling a committed result retains its identity');
 }
 assert.deepEqual(PAPER_DRAW_TIMING,{gather:0,rotate:600,scatter:0,total:600,turn:Math.PI});
 const beforeRepeat=view.debug().resources.selectedPaints;view.prepare(name,60000,71);assert.equal(view.debug().resources.selectedPaints,beforeRepeat,'Same name and same original index reuse artwork');view.cancel();assert.equal(view.debug().selectedDecoration,null);assert.equal(view.debug().pendingIndex,-1);assert.equal(view.debug().winner,'');
 view.prepare(name,61000,12);verifyArtwork(face,12,name);view.reset();assert.equal(view.debug().selectedDecoration,null);view.prepare(name,62000,13);view.start(62100);assert.equal(view.debug().selectedDecoration,null);assert.equal(view.debug().pendingIndex,-1);view.cancel();
 const sparse=['',name,'',name,{name:'末位同学'},''];view.setNames(sparse);view.prepare(name,63000,3);assert.deepEqual(view.debug().selectedDecoration,expected(3));verifyArtwork(face,3,name);view.reveal(name,63600,3);assert.deepEqual(view.debug().selectedDecoration,expected(3));
 view.setNames(['',name,'',name,'末位同学']);assert.deepEqual(view.debug().selectedDecoration,expected(3),'Equivalent sparse roster preserves source identity');view.setNames(['',name,'','更名同学']);assert.equal(view.debug().selectedDecoration,null,'A changed selected source cannot retain stale decoration');
 const long='测'.repeat(80);view.setNames([long]);view.prepare(long,64000,0);verifyArtwork(face,0,long);assert.ok(face.ctx.prints.filter(p=>p.text.includes('测')).length>1,'Long name still wraps without corner collisions');
 const selectedPrints=JSON.stringify(face.ctx.prints),selectedPaints=view.debug().resources.selectedPaints;
 for(const countdown of [{state:'running',text:'05:00',hundredths:'00'},{state:'running',text:'09:59',hundredths:'99'},{state:'finished',text:'00:00',hundredths:'00'}]){
  clearOutput(output);view.setCountdown(countdown);view.render(65000);const d=view.debug();assert.equal(d.selectedNameVisible,false);assert.ok(d.timerCards.every(c=>/^[0-9时间到]$/.test(c.char)));assert.equal(output.ctx.images.some(({image})=>image===face),false,'Timer never paints decorated student surface');
  const visible=flattenedText(output,1/d.dpr);for(const [slot,card]of d.timerCards.entries()){
   const inCard=visible.filter(p=>{const x=(p.bounds.minX+p.bounds.maxX)/2,y=(p.bounds.minY+p.bounds.maxY)/2;return x>card.bounds.minX&&x<card.bounds.maxX&&y>card.bounds.minY&&y<card.bounds.maxY});
   const suit=['♠','♥','♣','♦'][slot%4];assert.equal(inCard.filter(p=>p.text===suit).length,2,'Every timer or finish card has two stable slot-suit corners');
   assert.equal(inCard.filter(p=>p.text===card.char).length,countdown.state==='finished'?1:3,'Numeric center matches both rank corners; finish character appears only once');
   assert.equal(inCard.filter(p=>/[♥♦♠♣]/.test(p.text)&&p.text!==suit).length,0,'A slot never draws another suit');
   if(countdown.state==='finished')assert.equal(inCard.some(p=>/^[0-9]$/.test(p.text)),false,'Finished cards have suit-only corners');
  }
  assert.equal(output.ctx.prints.some(p=>/[♥♦♠♣]/.test(p.text)),false,'Timer decorations come from cached art, not per-tick text');assert.equal(d.resources.selectedPaints,selectedPaints);assert.equal(JSON.stringify(face.ctx.prints),selectedPrints);
 }
 assert.equal(front.ctx.prints.length,0);assert.equal(back.ctx.prints.length,0);view.dispose();assert.equal(view.debug().selectedDecoration,null);assert.equal(view.debug().resources.surfaces,0);assert.equal(view.debug().resources.cpuBytes,0);
 console.log('PASS paper student corners: all 72 source identities, 2–10 ranks and four suits, stable duplicate-name/source-index cache, burgundy/ink colors, enlarged safe upright/inverted corners, centered long names, 600 ms prepare/commit/cancel/reset, blank backs, matching timer rank and suit corners including hundredths, suit-only finish corners, zero RNG/RAF and bounded resources');
}finally{Math.random=saved.random;if(saved.raf===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=saved.raf}
