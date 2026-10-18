import assert from 'node:assert/strict';
import {CLASSROOM_DRAW_TIMING,SPACE_DRAW_TIMING} from '../dist/draw-timing.js';
import {createSpaceCards} from '../dist/space-cards.js';
import {countdownComposition,countdownDisplay} from '../dist/space-countdown.js';

// No canvas package or browser needed. State/perspective tests use a recording
// 2D surface; the separate release QA renders the real code with native Canvas.
let surfaces=0,randomCalls=0;const originalRandom=Math.random;
Math.random=()=>{randomCalls++;throw new Error('The view must never consume selection RNG')};
class Context {
 constructor(){this.draws=0;this.text=[]}
 createLinearGradient(){return {addColorStop(){}}}createRadialGradient(){return {addColorStop(){}}}
 beginPath(){}moveTo(){}lineTo(){}quadraticCurveTo(){}bezierCurveTo(){}closePath(){}fill(){}stroke(){}arc(){}fillRect(){}clearRect(){}scale(){}save(){}restore(){}setTransform(){}transform(){}clip(){}
 drawImage(){this.draws++}fillText(t){this.text.push(String(t))}measureText(t){return {width:String(t).length*(parseFloat(this.font?.match(/[\d.]+px/)?.[0])||20)*.57}}
}
class Canvas {constructor(width=1366,height=518){surfaces++;this.width=width;this.height=height;this.style={};this.ctx=new Context()}getContext(){return this.ctx}}
const names=Array.from({length:64},(_,i)=>'学生'+String(i+1).padStart(2,'0'));
let assertions=0;function check(fn){fn();assertions++}
try {
 const canvas=new Canvas(),view=createSpaceCards(canvas);view.setNames(names);view.render(0);let state=view.debug();
 check(()=>assert.equal(state.cardCount,53));check(()=>assert.equal(state.textureCount,64));check(()=>assert.equal(state.resources.art.pages,2,'Names share bounded cached atlas pages'));check(()=>assert.ok(state.resources.art.cpuBytes<=72*1024*1024));check(()=>assert.deepEqual(state.names,names));
 check(()=>assert.equal(state.winner,''));check(()=>assert.equal(state.stage,'idle'));check(()=>assert.ok(state.visibleCardCount>=30&&state.visibleCardCount<=53));
 const first=state.cards[4],surfacesBefore=surfaces;view.render(1000);state=view.debug();
 check(()=>assert.notEqual(state.cards[4].x,first.x));check(()=>assert.notEqual(state.cards[4].y,first.y));check(()=>assert.notEqual(state.cards[4].z,first.z));
 check(()=>assert.notEqual(state.cards[4].screenY,first.screenY));
 check(()=>assert.notEqual(state.cards[4].screenX,first.screenX));check(()=>assert.ok(state.cards[4].width>first.width));
 const seen=new Set();let minOpacity=1;
 for(let t=1250;t<view.debug().idlePeriod*2;t+=250){view.render(t);for(const c of view.debug().cards){if(c.opacity>=.01&&c.screenX+c.width/2>=0&&c.screenX-c.width/2<=state.width&&c.screenY+c.height/2>=0&&c.screenY-c.height/2<=state.height)seen.add(c.name);minOpacity=Math.min(minOpacity,c.opacity)}}
 check(()=>assert.equal(seen.size,64));check(()=>assert.ok([...seen].every(n=>names.includes(n))));check(()=>assert.equal(minOpacity,1,'Visible idle plaques remain opaque at every depth'));
 check(()=>assert.equal(surfaces,surfacesBefore));check(()=>assert.equal(view.debug().textureCount,64));check(()=>assert.equal(view.debug().winner,''));
 check(()=>assert.equal(view.start(200000),true));check(()=>assert.deepEqual(view.debug().timing,SPACE_DRAW_TIMING));const sphereNames=view.debug().cards.map(c=>c.name);
 for(const [offset,stage]of[[0,'gather'],[399,'gather'],[400,'rotate']]){view.render(200000+offset);check(()=>assert.equal(view.debug().stage,stage));check(()=>assert.equal(view.debug().winner,''))}
 check(()=>assert.deepEqual(view.debug().cards.map(c=>c.name),sphereNames));
 view.render(200400);const shell=view.debug();
 check(()=>assert.equal(shell.shellCardCount,96));check(()=>assert.equal(shell.visibleCardCount,96));
 check(()=>assert.ok(shell.shellCards.every(c=>Math.abs(Math.hypot(c.x,c.y,c.z-shell.sphereCenter.z)-shell.sphereRadius)<1e-8)));
 check(()=>assert.ok(shell.shellCards.every(c=>c.mesh.length===9&&c.mesh.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.z>0))));
 check(()=>assert.ok(shell.shellCards.some(c=>c.facing>.8)&&shell.shellCards.some(c=>c.facing<-.8)));
 check(()=>assert.ok(shell.shellCards.every(c=>c.opacity===1),'Sphere cards are opaque physical surfaces'));check(()=>assert.ok(shell.shellCards.filter(c=>c.facing<-.5).every(c=>c.shade>=.79&&c.shade<=.81),'Unprinted reverse faces stay luminous and opaque'));
 check(()=>assert.ok(shell.shellCards.some(c=>Math.abs(c.mesh[0].y-c.mesh[2].y)>4)));
 check(()=>assert.ok(shell.shellCards.some(c=>Math.abs(c.mesh[0].x-c.mesh[2].x)<c.width*.2)||shell.shellCards.some(c=>Math.abs(c.mesh[0].x-c.mesh[2].x)<10)));
 const positions=new Map(shell.shellCards.map(c=>[c.id,c.z]));view.render(200700);
 check(()=>assert.ok(view.debug().shellCards.some(c=>(c.z-9.5)*(positions.get(c.id)-9.5)<0)));
 for(const [offset,stage]of[[1399,'rotate'],[1400,'disperse'],[1749,'disperse'],[1750,'awaiting-reveal']]){view.render(200000+offset);check(()=>assert.equal(view.debug().stage,stage));check(()=>assert.equal(view.debug().winner,''))}
 check(()=>assert.deepEqual(view.debug().cards.map(c=>c.name),sphereNames));
 check(()=>assert.equal(view.debug().shellCards.length,53));check(()=>assert.ok(view.debug().cards.every(c=>c.shellMix===0&&c.mesh===null)));

 check(()=>assert.equal(view.reveal('伪造姓名',201750),false));check(()=>assert.equal(view.reveal(names[63],201750),true));
 check(()=>assert.equal(view.debug().winner,names[63]));view.cancel();check(()=>assert.equal(view.debug().winner,names[63]));
 view.render(601000);check(()=>assert.equal(view.debug().winner,names[63]));
 view.setCountdown({state:'running',text:'02:41',hundredths:'37'});canvas.ctx.text=[];view.render(601010);
 check(()=>assert.equal(countdownDisplay(view.debug().countdown).main,'02:41'));check(()=>assert.equal(countdownDisplay(view.debug().countdown).minor,'.37'));
 check(()=>assert.equal(view.debug().winner,names[63]));
 view.setCountdown({status:'running',remaining:59990});canvas.ctx.text=[];view.render(601020);
 check(()=>assert.equal(countdownDisplay(view.debug().countdown).main,'00:59'));check(()=>assert.equal(countdownDisplay(view.debug().countdown).minor,'.99'));
 view.setCountdown({state:'finished',text:'00:00',hundredths:'00'});canvas.ctx.text=[];view.render(601030);
 check(()=>assert.equal(countdownComposition(view.debug().countdown,900,350).entries.map(e=>e.char).join(''),'时间到'));view.reset();check(()=>assert.equal(view.debug().winner,''));check(()=>assert.equal(view.debug().countdown.state,'finished'));
 view.setCountdown(null);view.render(602000);const drawn=canvas.ctx.draws;view.resize(390,492);
 check(()=>assert.ok(canvas.ctx.draws>drawn));check(()=>assert.equal(view.debug().width,390));check(()=>assert.equal(view.debug().height,492));
 view.start(603000);view.render(603450);check(()=>assert.equal(view.debug().stage,'rotate'));view.cancel();check(()=>assert.equal(view.debug().drawing,false));
 view.setNames([]);check(()=>assert.equal(view.start(604000),false));check(()=>assert.equal(view.reveal(names[0],604000),false));check(()=>assert.equal(view.debug().cardCount,0));check(()=>assert.equal(view.debug().textureCount,0));
 globalThis.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
 const reduced=createSpaceCards(new Canvas());reduced.setNames(names);reduced.render(0);const initial=reduced.debug().cards.map(c=>[c.x,c.y,c.z]);reduced.render(900000);
 check(()=>assert.deepEqual(reduced.debug().cards.map(c=>[c.x,c.y,c.z]),initial));reduced.start(901000);reduced.render(901450);
 check(()=>assert.notDeepEqual(reduced.debug().cards.map(c=>[c.x,c.y,c.z]),initial));check(()=>assert.equal(reduced.debug().stage,'rotate'));
 const reducedSphere=reduced.debug();check(()=>assert.equal(reducedSphere.shellCards.length,96));check(()=>assert.ok(reducedSphere.shellCards.every(c=>c.shellMix===1&&c.mesh.length===9)));
 check(()=>assert.ok(reducedSphere.shellCards.every(c=>Math.abs(Math.hypot(c.x,c.y,c.z-reducedSphere.sphereCenter.z)-reducedSphere.sphereRadius)<1e-8)));
 reduced.render(901850);check(()=>assert.notDeepEqual(reduced.debug().shellCards,reducedSphere.shellCards));
 reduced.render(902500);check(()=>assert.equal(reduced.debug().stage,'disperse'));check(()=>assert.ok(reduced.debug().shellCards.every(c=>c.shellMix>0&&c.shellMix<1)));
 reduced.reveal(names[2],902750);check(()=>assert.equal(reduced.debug().winner,names[2]));const resultWidth=reduced.debug().selectedCard.width;reduced.render(902930);check(()=>assert.ok(reduced.debug().selectedCard.width>resultWidth));
 const large=Array.from({length:128},(_,i)=>'大班'+i);view.setNames(large);const largeSeen=new Set(),cached=surfaces;for(let t=605000;t<605000+view.debug().idlePeriod*4;t+=500){view.render(t);const s=view.debug();for(const c of s.cards)if(c.opacity>=.01&&c.screenX+c.width/2>=0&&c.screenX-c.width/2<=s.width&&c.screenY+c.height/2>=0&&c.screenY-c.height/2<=s.height)largeSeen.add(c.name)}check(()=>assert.equal(largeSeen.size,128));check(()=>assert.equal(surfaces,cached));
 view.setNames(names);view.start(1000000,CLASSROOM_DRAW_TIMING);view.render(1000780);check(()=>assert.equal(view.debug().stage,'disperse'));view.render(1001000);check(()=>assert.equal(view.debug().stage,'awaiting-reveal'));check(()=>assert.equal(randomCalls,0));reduced.dispose();view.dispose();
 console.log(`PASS ${assertions} space-card renderer assertions: 64/128-name visible coverage, center-crossing xyz perspective, 96 equal-area tangent plaques, shared artwork atlases, 400/1000/350ms phases, roster-only reveal, winner persistence, precise timer, time-up-only message, cache stability, synchronous resize, reduced motion, empty roster, zero selection RNG.`);
} finally {Math.random=originalRandom;delete globalThis.matchMedia}
