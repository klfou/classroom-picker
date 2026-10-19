import assert from 'node:assert/strict';
import {createSpaceCards} from '../dist/space-cards.js';

// Exercise the shipped renderer itself at frame cadence across several complete
// lives. Native Canvas preview/visual QA is separate from this geometry test.
let surfaces=0;
class Context {
 createLinearGradient(){return {addColorStop(){}}}createRadialGradient(){return {addColorStop(){}}}
 beginPath(){}moveTo(){}lineTo(){}quadraticCurveTo(){}closePath(){}fill(){}stroke(){}arc(){}fillRect(){}clearRect(){}scale(){}save(){}restore(){}setTransform(){}transform(){}clip(){}drawImage(){}fillText(){}
 measureText(t){return {width:String(t).length*30}}
}
class Canvas {constructor(width,height){surfaces++;this.width=width;this.height=height;this.style={};this.ctx=new Context()}getContext(){return this.ctx}}
const names=Array.from({length:128},(_,i)=>'学生'+String(i+1).padStart(3,'0'));
const inView=(c,w,h)=>c.screenX+c.width/2>=0&&c.screenX-c.width/2<=w&&c.screenY+c.height/2>=0&&c.screenY-c.height/2<=h;
const visible=(c,w,h)=>inView(c,w,h)&&c.opacity>=.01;
// Count readable and unoccluded name centers, not tiny distant birth marks.
const centralReadable=(cards,w,h)=>cards.filter(c=>c.width*54/384>=11&&c.opacity>=.55&&Math.abs(c.screenX-w*.5)<=w*.15&&Math.abs(c.screenY-h*.49)<=h*.2&&!cards.some(front=>front.id!==c.id&&front.z<c.z&&front.opacity>=.55&&Math.abs(c.screenX-front.screenX)<front.width*.43&&Math.abs(c.screenY-front.screenY)<front.height*.40)).length;
const reports=[];
for(const [width,height] of [[1366,518],[1920,810],[900,700],[390,492]]){
 const view=createSpaceCards(new Canvas(width,height));view.setNames(names);view.render(0);
 const frames=Math.round(view.debug().idlePeriod/1000*60*4),allocated=surfaces;let before=view.debug(),wraps=0,changes=0,maxMotion=0,maxAlphaStep=0,minVisible=Infinity,maxVisible=0,seen=new Set(),minWidth=Infinity,maxWidth=0,centerFrames=0,minCenter=Infinity,maxCenter=0,centerGap=0,maxCenterGap=0,crossings=0;
 for(let f=1;f<=frames;f++){
  view.render(f*1000/60);const after=view.debug();minVisible=Math.min(minVisible,after.visibleCardCount);maxVisible=Math.max(maxVisible,after.visibleCardCount);const central=centralReadable(after.cards,width,height);if(central){centerFrames++;centerGap=0}else {centerGap++;maxCenterGap=Math.max(maxCenterGap,centerGap)}minCenter=Math.min(minCenter,central);maxCenter=Math.max(maxCenter,central);
  // All live cards maintain far-to-near occlusion order with stable tie breaks.
  assert.ok(after.shellCards.every((c,i,a)=>!i||a[i-1].z>c.z||a[i-1].z===c.z&&a[i-1].id<c.id));
  // Shared camera speed must preserve opaque occlusion order between hidden
  // resets; a presentation size limit must never create a depth-order pop.
  const resetIds=new Set(after.cards.filter(c=>c.idleCycle!==before.cards[c.id].idleCycle).map(c=>c.id));
  assert.deepEqual(after.shellCards.filter(c=>!resetIds.has(c.id)).map(c=>c.id),before.shellCards.filter(c=>!resetIds.has(c.id)).map(c=>c.id),'Only a fully hidden recycle can change inter-card depth order');
  for(let i=0;i<after.cards.length;i++){
   const a=before.cards[i],b=after.cards[i],reset=b.idleCycle!==a.idleCycle;
   if(reset){wraps++;assert.ok(!inView(a,width,height),'Old plaque must completely exit before recycle');assert.ok(!inView(b,width,height),'New plaque must still be fully outside the opposite edge');}
   else {
    assert.ok(b.z<a.z,'Every world-space path moves toward the camera');
    if(Math.sign(a.x)!==Math.sign(b.x)||Math.sign(a.y)!==Math.sign(b.y))crossings++;
    assert.equal(b.opacity,1,'Opaque moving fronts never expose rear names through the face');
    assert.ok(b.width>=a.width&&b.height>=a.height,'Plaques only grow during a life');assert.ok(b.opacity>=a.opacity-1e-12,'Approaching plaques never fade or flash');
    if(visible(a,width,height)&&visible(b,width,height)){maxMotion=Math.max(maxMotion,Math.hypot(b.screenX-a.screenX,b.screenY-a.screenY));maxAlphaStep=Math.max(maxAlphaStep,Math.abs(b.opacity-a.opacity));}
   }
   if(a.name!==b.name){changes++;assert.ok(!visible(a,width,height)&&!visible(b,width,height),'Name swap must be hidden on both adjacent frames');}
   if(visible(b,width,height)){seen.add(b.name);minWidth=Math.min(minWidth,b.width);maxWidth=Math.max(maxWidth,b.width);}
  }
  before=after;
 }
 assert.ok(wraps>=140&&changes>=140);assert.ok(crossings>=140,'Paths must cross the center rather than repel to the edges');assert.equal(seen.size,128,'Every roster member eventually has a visible card');assert.equal(surfaces,allocated,'Animation must reuse cached textures');
 assert.ok(minVisible>=25&&maxVisible<=44);assert.ok(maxMotion<4,'No visible teleport at 60fps');assert.ok(maxAlphaStep<.01,'No frame-to-frame alpha spike');assert.ok(maxWidth/minWidth>2.5,'Clear near/far size difference');assert.ok(centerFrames/frames>=.95,'Readable central occupancy must be sustained throughout the cycle');assert.ok(maxCenterGap*1000/60<1100,'No persistent central hole');
 const unchanged=view.debug();view.resize(width,height);assert.equal(view.debug().frame,unchanged.frame,'Same-size resize must not clear or repaint the bitmap');
 const edges=view.debug(true);assert.equal(edges.plaqueScale,.82,'The sphere keeps its existing plaque scale');assert.equal(edges.idleScale,1.13,'Idle-only readability enlargement stays explicit');
 for(const c of edges.cards){
  assert.equal(c.frontRim.length,20);assert.equal(c.backRim.length,20);
  assert.ok(c.backRim.every((p,i)=>p.z>c.frontRim[i].z),'The back is physically behind the front');
  assert.ok(Math.abs(c.frontRim[0].y-c.frontRim[19].y)<1e-9,'Idle face top stays level');
  assert.ok(Math.abs(c.frontRim[4].x-c.frontRim[5].x)<1e-9,'Idle face side stays vertical');
  assert.ok(c.backRim.some((p,i)=>Math.hypot(p.x-c.frontRim[i].x,p.y-c.frontRim[i].y)>.01),'Separately projected depth produces visible parallax');
 }
 view.resize(height,width);const resized=view.debug();assert.deepEqual(resized.cards.map(c=>[c.name,c.idleCycle,c.idleDepth]),unchanged.cards.map(c=>[c.name,c.idleCycle,c.idleDepth]),'Layout change preserves names and cycle age');
 reports.push({width,height,wraps,hiddenNameChanges:changes,visibleRange:[minVisible,maxVisible],visibleRosterNames:seen.size,maxMotionPxPerFrame:maxMotion,maxAlphaStep,sizeRatio:maxWidth/minWidth,readableCenterOccupancy:centerFrames/frames,centerCountRange:[minCenter,maxCenter],longestCenterGapMs:maxCenterGap*1000/60,worldCenterCrossings:crossings});view.dispose();
}
// OS preferences are never consulted, so idle flow always advances.
for(const preference of [false,true]){
 globalThis.matchMedia=()=>{throw Error('Animation must not consult OS motion preference')};
 const view=createSpaceCards(new Canvas(1366,518));view.setNames(names);view.render(12345);const position=()=>view.debug().cards.map(c=>[c.x,c.y,c.z,c.name]);const first=position();
 view.render(12361);assert.notDeepEqual(position(),first);view.dispose();delete globalThis.matchMedia;
}
// Retina keeps CSS-space geometry and uses a bounded moving-scene raster.
globalThis.devicePixelRatio=2;const retina=createSpaceCards(new Canvas(1920,810));assert.ok(retina.debug().dpr<=1.5);assert.ok(1920*810*retina.debug().dpr**2<=2400000.01);retina.dispose();delete globalThis.devicePixelRatio;
console.log('PASS production idle-flow continuity: '+JSON.stringify(reports));
