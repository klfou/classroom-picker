import assert from 'node:assert/strict';
import {createPaperCards,PAPER_DRAW_TIMING,PAPER_PALETTE} from '../dist/paper-cards.js';
import {PAPER_DRAW_TIMING as SHARED_PAPER_TIMING,CLASSROOM_DRAW_TIMING} from '../dist/draw-timing.js';
import {countdownDigitLayout} from '../dist/countdown-digit-layout.js';
let surfaces=0,assertions=0;const printed=[],contexts=[];
class Context {
 constructor(){this.draws=0;this.font='20px sans-serif';contexts.push(this)}
 createLinearGradient(){return{addColorStop(){}}}createRadialGradient(){return{addColorStop(){}}}
 beginPath(){}moveTo(){}lineTo(){}quadraticCurveTo(){}bezierCurveTo(){}closePath(){}fill(){}stroke(){}arc(){}ellipse(){}fillRect(){}clearRect(){}scale(){}save(){}restore(){}setTransform(){}transform(){}translate(){}rotate(){}clip(){}
 drawImage(){this.draws++}fillText(text){printed.push({text:String(text),font:this.font,width:this.measureText(text).width})}measureText(text){return{width:[...String(text)].length*(parseFloat(this.font.match(/[\d.]+px/)?.[0])||20)*.65}}
}
class Canvas {constructor(width=1366,height=518){surfaces++;this.width=width;this.height=height;this.style={};this.ctx=new Context()}getContext(){return this.ctx}}
const names=['样例甲','样例乙','样例丙','样例丁','样例戊','样例己','样例庚','样例辛'];
const check=fn=>{fn();assertions++},originalRandom=Math.random,originalRaf=globalThis.requestAnimationFrame,originalDpr=globalThis.devicePixelRatio;
Math.random=()=>{throw Error('Presentation cannot use selection RNG')};globalThis.requestAnimationFrame=()=>{throw Error('Presentation cannot own an animation loop')};
try{
 check(()=>assert.equal(PAPER_DRAW_TIMING,SHARED_PAPER_TIMING));
 check(()=>assert.deepEqual(PAPER_DRAW_TIMING,{gather:0,rotate:600,scatter:0,total:600,turn:Math.PI}));
 check(()=>assert.equal(PAPER_PALETTE.background,'#321824'));
 const canvas=new Canvas(),view=createPaperCards(canvas,{active:false});let state=view.debug();
 check(()=>assert.equal(state.resources.surfaces,0));check(()=>assert.equal(state.frame,0));
 view.setNames(names);view.start(1000);view.prepare(names[2],1000,2);view.render(1250);state=view.debug();
 check(()=>assert.equal(state.stage,'flip'));check(()=>assert.equal(state.winner,''));check(()=>assert.equal(state.selectedIndex,-1));check(()=>assert.equal(state.pendingIndex,2));check(()=>assert.equal(state.resources.surfaces,0));check(()=>assert.equal(state.frame,0));
 view.setActive(true);state=view.debug();
 check(()=>assert.equal(state.cardCount,state.layout.columns*state.layout.rows));check(()=>assert.equal(state.cardCount,state.layout.count));check(()=>assert.deepEqual(state.names,names));check(()=>assert.equal(state.textureCount,3));check(()=>assert.equal(state.resources.surfaces,5));check(()=>assert.equal(state.cards.filter(c=>c.selected).length,1));check(()=>assert.equal(printed.filter(p=>names.includes(p.text)).length,1));
 view.render(1600);const ready=view.debug(),readyCards=ready.cards;
 check(()=>assert.equal(ready.stage,'awaiting-reveal'));check(()=>assert.equal(ready.winner,''));check(()=>assert.equal(ready.resultDuration,600));
 check(()=>assert.equal(view.reveal('未入名单',1600),false));check(()=>assert.equal(view.reveal(names[2],1600,2),true));state=view.debug();
 check(()=>assert.equal(state.winner,names[2]));check(()=>assert.equal(state.selectedIndex,2));check(()=>assert.equal(state.pendingIndex,-1));check(()=>assert.equal(state.pendingName,''));check(()=>assert.equal(state.transitionAt,1000));check(()=>assert.equal(state.resultSettling,false));check(()=>assert.deepEqual(state.cards,readyCards));
 const finalFrame=state.frame,created=surfaces;for(let t=1601;t<12000;t+=16)view.render(t);
 check(()=>assert.equal(view.debug().frame,finalFrame));check(()=>assert.equal(surfaces,created));view.cancel();check(()=>assert.equal(view.debug().winner,names[2]));
 // Draws started elsewhere keep the paper deck still and use a brief result
 // presentation only after the scene supplies a committed winner.
 view.setActive(false);const hiddenFrame=view.debug().frame;view.start(20000,CLASSROOM_DRAW_TIMING);const staticDeck=view.debug().cards;
 for(let t=20000;t<=21000;t+=25){view.render(t);check(()=>assert.deepEqual(view.debug().cards,staticDeck))}
 view.reveal(names[4],21000,4);check(()=>assert.equal(view.debug().frame,hiddenFrame));check(()=>assert.equal(view.debug().resultDuration,260));view.setActive(true);view.render(21260);check(()=>assert.equal(view.debug().resultSettling,false));
 // Decorative card ranks are a stable function of the original seat, never
 // selection RNG. Same-name seats must refresh the selected-face artwork.
 const decorated=createPaperCards(new Canvas());decorated.setNames(Array.from({length:36},()=> '同名同学'));
 for(let index=0;index<36;index++){const before=decorated.debug().resources.selectedPaints;decorated.prepare('同名同学',21500,index);const detail=decorated.debug().selectedDecoration;check(()=>assert.equal(detail.index,index));check(()=>assert.equal(detail.rank,String(2+index%9)));check(()=>assert.equal(detail.suit,['♠','♥','♣','♦'][index%4]));check(()=>assert.equal(detail.color,index%2?'#883b52':PAPER_PALETTE.ink));check(()=>assert.equal(decorated.debug().resources.selectedPaints,before+1));decorated.reveal('同名同学',22100,index);check(()=>assert.equal(decorated.debug().resources.selectedPaints,before+1));check(()=>assert.deepEqual(decorated.debug().selectedDecoration,detail))}
 decorated.reset();check(()=>assert.equal(decorated.debug().selectedDecoration,null));decorated.dispose();
 printed.length=0;view.setCountdown({state:'running',text:'02:41',hundredths:'37'});view.render(22000);check(()=>assert.ok(!printed.some(p=>p.text==='背书倒计时')));check(()=>assert.deepEqual(view.debug().timerCards.map(c=>c.char),[...'024137']));check(()=>assert.equal(view.debug().timerCache.digits,10));check(()=>assert.ok(!printed.some(p=>names.includes(p.text))));check(()=>assert.equal(view.debug().selectedNameVisible,false));
 printed.length=0;view.setCountdown({status:'running',remaining:59990});view.render(22010);check(()=>assert.deepEqual(view.debug().timerCards.map(c=>c.char),[...'005999']));check(()=>assert.ok(!printed.some(p=>/^[0-9]$/.test(p.text)),'Cached timer digits are never repainted'));
 printed.length=0;view.setCountdown({state:'finished',text:'00:00',hundredths:'00'});view.render(22020);check(()=>assert.deepEqual(view.debug().timerCards.map(c=>c.char),[...'时间到']));check(()=>assert.deepEqual(printed.map(p=>p.text),['时','间','到','♠','♥','♣','♦']));check(()=>assert.equal(view.debug().timerCache.total,13));view.reset();check(()=>assert.equal(view.debug().countdown.state,'finished'));check(()=>assert.equal(view.debug().winner,''));view.setCountdown(null);
 // Canvas implementations with unavailable/protected readback must keep the
 // same bounded atlas and safe metric fallback, never fail or retry per tick.
 let readbacks=0;Context.prototype.getImageData=()=>{readbacks++;throw Error('Synthetic protected Canvas')};
 const fallback=createPaperCards(new Canvas());fallback.setCountdown({state:'running',text:'10:00',hundredths:'00'});fallback.render(1);const fallbackSurfaces=surfaces;check(()=>assert.equal(readbacks,50));
 for(const [w,h]of [[1366,518],[1920,810],[390,456],[320,180],[844,92]]){
  fallback.resize(w,h);let geometry=null;
  for(const digit of '0123456789'){
   fallback.setCountdown({state:'running',text:`${digit}${digit}:${digit}${digit}`,hundredths:digit+digit});fallback.render(2+Number(digit));const d=fallback.debug(),target=countdownDigitLayout(w,h).height;
   check(()=>assert.equal(d.timerLayout.digitTargetHeight,target));
   check(()=>assert.ok(d.timerCards.every(c=>c.cornerLayout.flow==='inline'&&c.glyphTargetHeight===target*(c.role==='main'?1:.30))));
   const current=d.timerCards.map(c=>({bounds:c.bounds,width:c.width,height:c.height,glyphScaleY:c.glyphScaleY,glyphScaleX:c.glyphScaleX,cornerScale:c.cornerScale}));if(geometry)check(()=>assert.deepEqual(current,geometry,'Digits share one alphabet scale and fixed card geometry'));else geometry=current;
  }
 }
 check(()=>assert.equal(readbacks,50,'Protected readback is attempted only while building ten cached digits and forty cached corner slots, never on a tick'));check(()=>assert.equal(fallback.debug().timerCache.digits,10));check(()=>assert.equal(fallback.debug().timerCache.atlases,2));check(()=>assert.equal(surfaces,fallbackSurfaces+4,'Only each actual viewport resize replaces the background surface'));fallback.dispose();delete Context.prototype.getImageData;
 const bounded=(cards,w,h,label)=>assert.ok(cards.every(c=>c.bounds.minX>=0&&c.bounds.maxX<=w&&c.bounds.minY>=0&&c.bounds.maxY<=h),label);
 const anchored=(state,w,h,label)=>{const l=state.layout;assert.equal(l.left,w*.045,`${label}: margin`);assert.equal(state.cardCount,l.columns*l.rows,`${label}: complete rows`);assert.ok((l.w+(l.columns-1)*l.stepX)/w>=.80,`${label}: width fills viewport`);assert.ok((l.h+(l.rows-1)*l.stepY)/h>=(l.rows===1?.69:.80),`${label}: height fills safe area`);for(const c of state.cards){if(!c.selected)assert.equal(c.x,c.origin.x);assert.ok(Math.abs(c.origin.x-c.origin.width/2-c.column*l.stepX-w*.045)<1e-8);assert.ok(Math.abs(c.origin.y-(h/2+(c.row-(l.rows-1)/2)*l.stepY))<1e-8)}for(const c of state.cards.filter(c=>c.column===0&&!c.selected))assert.ok(Math.abs(c.bounds.minX-w*.045)<1)};
 const separated=(cards,label)=>{for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++){const a=cards[i].bounds,b=cards[j].bounds;assert.ok(a.maxX<=b.minX||b.maxX<=a.minX||a.maxY<=b.minY||b.maxY<=a.minY,label)}};
 const sizes=[[1366,518],[1920,810],[390,456],[320,246],[320,180],[844,132]],viewportGrids=new Map();
 for(const count of [1,2,15,40,43,64,128])for(const [w,h] of sizes){
  const roster=Array.from({length:count},(_,i)=>`全班同学${i+1}`);view.setNames(roster);view.reset();view.resize(w,h);state=view.debug();
  check(()=>assert.deepEqual(state.names,roster));check(()=>assert.ok(state.cards.every(c=>c.studentIndex===null)));check(()=>bounded(state.cards,w,h,'idle bounds'));check(()=>separated(state.cards,'idle overlap'));check(()=>anchored(state,w,h,'idle anchor'));
  const viewportKey=w+'x'+h,shape={layout:state.layout,cards:state.cards};if(viewportGrids.has(viewportKey))check(()=>assert.deepEqual(shape,viewportGrids.get(viewportKey),'roster cannot resize deck'));else viewportGrids.set(viewportKey,shape);
  const idle=new Map(state.cards.map(c=>[c.id,c])),beforeSurfaces=surfaces,beforeBackground=state.resources.backgroundBuilds,pick=count-1;
  view.start(40000);check(()=>assert.equal(view.prepare(roster[pick],40000,pick),true));let lastDistance=Infinity,lastWidth=0,lastAngle=Math.PI;
  for(const offset of [0,1,75,150,250,299,300,301,450,599,600]){
   view.render(40000+offset);state=view.debug();const hero=state.cards.find(c=>c.selected),distance=Math.hypot(hero.x-w/2,hero.y-h*.49);
   check(()=>bounded(state.cards,w,h,`${w}x${h}/${offset}: bounds`));check(()=>anchored(state,w,h,'draw anchor'));check(()=>assert.equal(state.selectedIndex,-1));check(()=>assert.equal(state.winner,''));check(()=>assert.equal(state.pendingIndex,pick));check(()=>assert.equal(state.selectedSlot,pick%state.cardCount));check(()=>assert.equal(hero.studentIndex,pick));check(()=>assert.equal(hero.name,roster[pick]));check(()=>assert.equal(state.cards.filter(c=>c.selected||c.showName||c.studentIndex!==null).length,1));
   check(()=>assert.ok(distance<=lastDistance+1e-8));check(()=>assert.ok(hero.width>=lastWidth));check(()=>assert.ok(hero.rotation.y>=lastAngle&&hero.rotation.y<=Math.PI*2));check(()=>assert.equal(hero.rotation.z,0));check(()=>assert.equal(hero.lift,0));
   for(const c of state.cards.filter(c=>!c.selected))check(()=>assert.deepEqual(c,idle.get(c.id),'nonselected card is completely stationary'));
   lastDistance=distance;lastWidth=hero.width;lastAngle=hero.rotation.y;
  }
  const beforeCommit=state.cards;view.reveal(roster[pick],40600,pick);state=view.debug();
  check(()=>assert.deepEqual(state.cards,beforeCommit,'commit cannot restart animation'));check(()=>assert.equal(state.resultSettling,false));check(()=>assert.equal(state.pendingIndex,-1));
  const hero=state.cards.find(c=>c.selected);check(()=>assert.equal(hero.width,Math.min(w*.64,h*.55,360)));check(()=>assert.equal(hero.x,w/2));check(()=>assert.equal(hero.y,h*.49));check(()=>assert.ok(hero.facing>.999));check(()=>assert.equal(surfaces,beforeSurfaces));check(()=>assert.equal(state.resources.backgroundBuilds,beforeBackground));
  const frame=state.frame;for(let t=40601;t<=42000;t+=20)view.render(t);check(()=>assert.equal(view.debug().frame,frame));
 }
 // Dense samples at every possible visual origin cover edge/perspective
 // bounds throughout the single turn, including very short phone surfaces.
 const completeRoster=Array.from({length:128},(_,i)=>i===0||i===64?'重复同学':`全范围${i}`);view.setNames(completeRoster);view.reset();
 for(const [w,h] of sizes){view.resize(w,h);const count=view.debug().cardCount;for(let pick=0;pick<count;pick++){view.prepare(completeRoster[pick],48000,pick);for(let elapsed=0;elapsed<=600;elapsed+=10){view.render(48000+elapsed);check(()=>bounded(view.debug().cards,w,h,`${w}x${h}/${pick}/${elapsed}: dense turn bounds`))}}}
 for(const [w,h] of [[1366,518],[390,456]]){
  view.resize(w,h);view.reset();const resources=view.debug().resources,created=surfaces;check(()=>assert.ok(view.debug().cardCount<completeRoster.length));
  for(let pick=0;pick<completeRoster.length;pick++){
   const time=50000+pick*700;view.prepare(completeRoster[pick],time,pick);state=view.debug();check(()=>assert.equal(state.pendingIndex,pick));check(()=>assert.equal(state.selectedSlot,pick%state.cardCount));view.render(time+600);view.reveal(completeRoster[pick],time+600,pick);state=view.debug();
   check(()=>assert.equal(state.selectedIndex,pick));check(()=>assert.equal(state.cards.find(c=>c.selected).name,completeRoster[pick]));check(()=>assert.equal(state.cards.find(c=>c.selected).x,w/2));check(()=>assert.deepEqual(state.names,completeRoster));check(()=>assert.equal(state.resources.backgroundBuilds,resources.backgroundBuilds));check(()=>assert.equal(surfaces,created));
  }
 }
 // Resize and backing pixel ratio do not change normalized geometry or the
 // source student identity, even when the destination visual slot changes.
 for(const count of [1,2,40,43,64,128])for(const [w,h] of sizes){
  const roster=Array.from({length:count},(_,i)=>`缩放${i}`);view.setNames(roster);let idleGeometry=null,flipGeometry=null;
  for(const pixelRatio of [1,1.5,2]){
   globalThis.devicePixelRatio=pixelRatio;view.reset();view.resize(w,h);state=view.debug();check(()=>anchored(state,w,h,'DPR idle'));check(()=>assert.equal(canvas.width,Math.round(w*state.dpr)));check(()=>assert.equal(canvas.height,Math.round(h*state.dpr)));
   if(idleGeometry)check(()=>assert.deepEqual(state.cards,idleGeometry));else idleGeometry=state.cards;
   view.prepare(roster[count-1],45000,count-1);view.render(45300);state=view.debug();check(()=>bounded(state.cards,w,h,'DPR turn'));if(flipGeometry)check(()=>assert.deepEqual(state.cards,flipGeometry));else flipGeometry=state.cards;
   const [rw,rh]=w>=900?[390,456]:[1366,518];view.resize(rw,rh);state=view.debug();check(()=>bounded(state.cards,rw,rh,'resized turn'));check(()=>anchored(state,rw,rh,'resized turn'));check(()=>assert.equal(state.pendingIndex,count-1));const hero=state.cards.find(c=>c.selected);check(()=>assert.ok(Math.abs(hero.x-(hero.origin.x+(rw/2-hero.origin.x)*.875))<1e-8));view.reveal(roster[count-1],45600,count-1);check(()=>assert.equal(view.debug().cards.find(c=>c.selected).x,rw/2));
  }
 }
 if(originalDpr===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=originalDpr;
 // Sparse and duplicate names preserve source indices. Cancel, new roster,
 // reset and restart erase all pending identity and put the card back.
 const sparse=['','同名','','同名',{name:'末位'},'  '];view.setNames(sparse);view.reset();check(()=>assert.deepEqual(view.debug().names,['同名','同名','末位']));check(()=>assert.equal(view.prepare('同名',60000,2),false));check(()=>assert.equal(view.prepare('同名',60000,4),false));check(()=>assert.equal(view.prepare('同名',60000,3),true));check(()=>assert.equal(view.debug().pendingIndex,3));view.render(60400);check(()=>assert.equal(view.debug().selectedNameVisible,true));
 const noPending=()=>{const s=view.debug();assert.equal(s.pendingName,'');assert.equal(s.pendingIndex,-1);assert.equal(s.winner,'');assert.equal(s.selectedIndex,-1);assert.ok(s.cards.every(c=>c.facing<-.99&&c.lift===0&&!c.selected&&c.name===''&&c.studentIndex===null));assert.equal(s.selectedNameVisible,false)};
 view.cancel();check(noPending);view.prepare('同名',61000,3);view.reset();check(noPending);view.prepare('同名',62000,3);view.start(62200);check(noPending);view.prepare('同名',63000,3);view.setNames(sparse);check(noPending);view.prepare('同名',64000,3);view.setNames(['同名']);check(noPending);
 view.reveal('同名',65000,0);view.render(65100);view.cancel();check(()=>assert.equal(view.debug().winner,'同名'));check(()=>assert.equal(view.debug().resultSettling,false));view.prepare('同名',66000,0);view.reveal('同名',66600,0);check(()=>assert.equal(view.debug().selectedIndex,0));
 view.setNames(['','同名','','同名','末位']);view.reveal('同名',67000,3);view.setNames(['','同名','','不同名','末位']);check(()=>assert.equal(view.debug().selectedIndex,-1));view.reveal('同名',67100);check(()=>assert.equal(view.debug().selectedIndex,1));view.setNames(['','同名','','再次更名','末位']);check(()=>assert.equal(view.debug().selectedIndex,1));
 const long='测'.repeat(80);view.setNames([long]);printed.length=0;view.prepare(long,68000,0);const lines=printed.filter(p=>p.text.includes('测'));check(()=>assert.ok(lines.length>1));check(()=>assert.equal(lines.map(p=>p.text).join(''),long));check(()=>assert.ok(lines.every(p=>p.width<=480*.79)));
 view.setNames([]);check(()=>assert.equal(view.start(69000),false));check(()=>assert.equal(view.prepare(names[0],69000,0),false));check(()=>assert.equal(view.reveal(names[0],69000),false));check(()=>assert.equal(view.debug().cardCount,0));check(noPending);
 // The selected card follows the same 600ms path under either OS preference.
 globalThis.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});const normal=createPaperCards(new Canvas());normal.setNames(names);normal.prepare(names[1],70000,1);
 globalThis.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});const reduced=createPaperCards(new Canvas());reduced.setNames(names);reduced.prepare(names[1],70000,1);const reducedInitial=reduced.debug();
 for(const offset of [0,150,300,450,599,600]){normal.render(70000+offset);reduced.render(70000+offset);check(()=>assert.deepEqual(reduced.debug().cards,normal.debug().cards))}
 check(()=>assert.notDeepEqual(reduced.debug().cards,reducedInitial.cards));check(()=>assert.ok(reduced.debug().frame>reducedInitial.frame));check(()=>assert.equal(reduced.debug().selectedNameVisible,true));reduced.reveal(names[1],70600,1);check(()=>assert.ok(reduced.debug().cards.find(c=>c.selected).facing>.999));check(()=>assert.equal(reduced.debug().resultSettling,false));
 normal.reset();reduced.reset();normal.reveal(names[2],71000,2);reduced.reveal(names[2],71000,2);
 for(const offset of [0,65,130,259,260]){normal.render(71000+offset);reduced.render(71000+offset);check(()=>assert.deepEqual(reduced.debug().cards,normal.debug().cards))}
 let motionChange=null;globalThis.matchMedia=()=>({matches:false,addEventListener(type,fn){motionChange=fn},removeEventListener(){}});const live=createPaperCards(new Canvas());live.setNames(names);live.prepare(names[1],80000,1);live.render(80200);const liveState=live.debug();check(()=>assert.equal(motionChange,null,'No OS motion subscription'));motionChange?.({matches:true});check(()=>assert.deepEqual(live.debug().cards,liveState.cards));live.render(80400);const later=live.debug().cards;check(()=>assert.notDeepEqual(later,liveState.cards));motionChange?.({matches:false});check(()=>assert.deepEqual(live.debug().cards,later));live.reveal(names[1],80600,1);check(()=>assert.equal(live.debug().selectedNameVisible,true));check(()=>assert.equal(live.debug().cards.find(c=>c.selected).x,683));
 normal.dispose();
 live.dispose();reduced.dispose();view.dispose();check(()=>assert.equal(view.debug().resources.surfaces,0));check(()=>assert.equal(view.debug().resources.cpuBytes,0));
 console.log(`PASS ${assertions} paper-card assertions: one simultaneous 600ms turn and growth, zero movement of all other cards, continuous commit with no second animation, full-viewport burgundy paper, every roster identity and duplicate slot, all visual origins bounded, DPR and resize invariance, pending cancellation/reset/roster cleanup, 260ms foreign-origin reveal, lazy bounded caches, idle/hidden CPU gating, six atlas-cached upright countdown cards with digit/suit corners and three suits-only finish cards, source-index rank/suit corner identity, long names, reduced motion, zero adapter RNG/RAF.`);
}finally{if(originalDpr===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=originalDpr;Math.random=originalRandom;globalThis.requestAnimationFrame=originalRaf;delete globalThis.matchMedia}
