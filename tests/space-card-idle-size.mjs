import assert from 'node:assert/strict';
import {createSpaceCards} from '../dist/space-cards.js';

class Context {
 createLinearGradient(){return {addColorStop(){}}}createRadialGradient(){return {addColorStop(){}}}
 beginPath(){}moveTo(){}lineTo(){}quadraticCurveTo(){}closePath(){}fill(){}stroke(){}arc(){}fillRect(){}scale(){}save(){}restore(){}setTransform(){}transform(){}clip(){}drawImage(){}fillText(){}
 measureText(t){return {width:String(t).length*54}}
}
class Canvas {constructor(width,height){this.width=width;this.height=height;this.style={};this.ctx=new Context()}getContext(){return this.ctx}}
const close=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-9,`${label}: ${a} vs ${b}`);
const names=Array.from({length:128},(_,i)=>'学生'+i),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const physicallyVisible=(c,w,h)=>{const rim=[...c.frontRim,...c.backRim];return Math.max(...rim.map(p=>p.x))>=0&&Math.min(...rim.map(p=>p.x))<=w&&Math.max(...rim.map(p=>p.y))>=0&&Math.min(...rim.map(p=>p.y))<=h};
let endpoints=0,sharedDepthChecks=0,sizeChecks=0;
for(const [width,height] of [[1366,518],[1920,810],[900,700],[390,492],[320,720],[2560,1080]]){
 const view=createSpaceCards(new Canvas(width,height));view.setNames(names);view.render(0);
 const initial=view.debug(),period=initial.idlePeriod,aspect=width/height,normalSize=aspect>1.78?Math.min(1.35,aspect/1.78):clamp(aspect/.95,.72,1),baseSize=normalSize*.82;
 assert.equal(initial.idleScale,1.13);assert.equal(period,112000);
 for(const seed of initial.cards){
  let previousWidth=0;
  for(const depth of [.001,.25,.5,.6,.75,.9,.999]){
   const t=(1+depth-seed.idleDepth)*period;view.render(t);const c=view.debug(true).cards[seed.id],oldWidth=1.8*baseSize*height*1.26/c.z;
   close(c.idleDepth,depth,'Stable cycle depth');assert.ok(c.width>previousWidth,'Projected size never shrinks despite the near-footprint limit');previousWidth=c.width;
   if(depth<=.5)close(c.width/oldWidth,1.13,'Readable far/mid dimensions enlarge exactly 13%');
   if(depth>=.9)assert.ok(c.width/oldWidth<.86,'Near-edge giant plaques are smaller than the former maximum');
   if(depth===.001||depth===.999){assert.equal(c.idleInView,false);assert.equal(physicallyVisible(c,width,height),false,'Both physical rims are outside before reset');endpoints++}
   sizeChecks++;
  }
 }
 // A presentation size knee must never introduce different camera approach
 // rates: otherwise opaque plaques can swap depth order in the reading field.
 for(const t of [0,12000,55000,100000,200000]){
  view.render(t);const a=view.debug();view.render(t+37);const b=view.debug(),expected=Math.pow(3.6,-37/period);
  for(const c of b.cards){const old=a.cards[c.id];if(old.idleCycle!==c.idleCycle)continue;close(c.z/old.z,expected,'Common depth rate preserves pairwise occlusion order');sharedDepthChecks++}
 }
 view.start(400000);
 for(const offset of [400,700,1000,1399]){
  view.render(400000+offset);const state=view.debug(),sphereScale=Math.min(1,aspect/.95);
  assert.equal(state.shellCardCount,96);assert.equal(state.shellCards.length,96);
  for(const c of state.shellCards){close(c.width,1.8*.825*.82*sphereScale*.94*height*1.26/c.z,'Sphere dimensions do not inherit the idle enlargement or cap');close(Math.hypot(c.x,c.y,c.z-9.5),3.06*sphereScale,'Sphere radius is unchanged')}
 }
 // Both ends of the existing gather/scatter interpolation stay continuous.
 view.render(401750);const dispersed=view.debug();view.cancel();const idle=view.debug();
 for(const c of idle.cards){const a=dispersed.cards[c.id];for(const key of ['x','y','z','width','height'])close(c[key],a[key],'Disperse ends at the live idle footprint')}
 view.dispose();
}
console.log(`PASS idle-only scale and perimeter guard: ${sizeChecks} near/mid/far samples, ${endpoints} fully hidden physical endpoints, ${sharedDepthChecks} shared-Z checks, unchanged 96-card sphere, continuous disperse.`);
