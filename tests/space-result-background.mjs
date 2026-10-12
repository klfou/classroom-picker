// Focused result/timer presentation checks. Uses real production state and Three
// geometry with a recording renderer; native Canvas pixels are release QA.
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {createSpaceCards} from '../dist/space-cards.js';
import {createCardModel} from '../dist/space-card-model.js';
import {countdownComposition} from '../dist/space-countdown.js';
class Context {
 constructor(){this.images=[];this.fills=[]}
 createLinearGradient(){return {addColorStop(){}}}createRadialGradient(){return {addColorStop(){}}}
 beginPath(){}moveTo(){}lineTo(){}quadraticCurveTo(){}bezierCurveTo(){}closePath(){}fill(){}stroke(){}arc(){}clearRect(){}scale(){}save(){}restore(){}setTransform(){}transform(){}clip(){}fillText(){}
 fillRect(){this.fills.push(this.fillStyle)}drawImage(image){this.images.push(image)}measureText(t){return {width:String(t).length*30}}
}
class Canvas {
 constructor(width=1366,height=518){this.width=width;this.height=height;this.style={};this.ctx=new Context();this.listeners=new Map()}
 getContext(){return this.ctx}addEventListener(type,fn){this.listeners.set(type,fn)}removeEventListener(type){this.listeners.delete(type)}emit(type){this.listeners.get(type)?.({preventDefault(){}})}
}
const names=Array.from({length:64},(_,i)=>`学生${i+1}`),running={state:'running',text:'01:23',hundredths:'45'},finished={state:'finished'};
const model=createCardModel(),control=createCardModel();for(const m of [model,control]){m.resize(1366,518);m.setNames(names);m.sample(0)}
const pose=m=>m.cards.map(c=>[c.name,c.idleCycle,c.idleDepth,c.x,c.y,c.z,c.size]);
model.reveal(names[3],1000);
for(const now of [1000,1800,112000,350000]){model.sample(now);control.sample(now);assert.deepEqual(pose(model),pose(control),'Hidden idle sampling must continue normally');assert.equal(model.order.length,1);assert.equal(model.order[0].selected,true);assert.equal(model.visibleCardCount,1)}
model.countdown=running;model.sample(350100);control.sample(350100);assert.deepEqual(pose(model),pose(control));assert.equal(model.order.length,0);assert.equal(model.visibleCardCount,0);
model.countdown=null;model.start(350100);assert.deepEqual(pose(model),pose(control),'A new draw must start at the current hidden idle poses');model.sample(350500);assert.equal(model.order.length,96);assert.equal(model.visibleCardCount,96);
const reports=[];
for(const kind of ['canvas','webgl']){
 const canvas=new Canvas(),rendererCanvas=new Canvas(),calls=[],gl={lost:false,getParameter(){},createShader(){},drawElements(){},isContextLost(){return this.lost}},renderer={isWebGLRenderer:true,domElement:rendererCanvas,capabilities:{getMaxAnisotropy:()=>1},getContext:()=>gl,render(scene,camera){scene.updateMatrixWorld();camera.updateMatrixWorld();calls.push({scene,camera})}};
 const view=createSpaceCards(canvas,kind==='webgl'?{renderer}:{});view.setNames(names);view.setActive(true);view.render(0);assert.ok(view.debug().visibleCardCount>20);
 function checkCount(expected){const s=view.debug();assert.equal(s.visibleCardCount,expected);assert.equal(s.shellCards.length,0);if(s.backend==='webgl')assert.equal(s.resources.render.instances,expected);return s}
 view.reveal(names[3],1000);view.render(1360);checkCount(1);
 if(kind==='canvas'){canvas.ctx.images.length=0;view.render(1400);assert.equal(canvas.ctx.images.filter(image=>image.width!==256||image.height!==32).length,2,'Result paints cached stars and one selected plaque plus background meteor sprites');assert.equal(canvas.ctx.images.filter(image=>image.width===256&&image.height===32).length,view.debug().resources.render.meteors.visible)}
 const hiddenAt=view.debug().cards[4].z;
 view.setCountdown(running);canvas.ctx.images.length=0;canvas.ctx.fills.length=0;view.render(1500);checkCount(0);assert.equal(view.debug().winner,names[3]);assert.notEqual(view.debug().cards[4].z,hiddenAt);
 if(kind==='canvas'){assert.equal(canvas.ctx.images.filter(image=>image.width!==256||image.height!==32).length,1,'Timer paints the star background without any plaques');assert.equal(canvas.ctx.images.filter(image=>image.width===256&&image.height===32).length,view.debug().resources.render.meteors.visible);assert.equal(canvas.ctx.fills.length,0,'No timer veil or bounded aura alters the cached star background')}
 if(kind==='webgl'){
  const {scene}=calls.at(-1),timer=scene.getObjectByName('space-dimensional-countdown');assert.equal(scene.getObjectByName('space-countdown-veil'),undefined);
  assert.ok(timer.children.filter(m=>m.visible).every(m=>m.rotation.x===0&&m.rotation.y===0&&m.rotation.z===0));
  const textures=new Map();scene.traverse(m=>{for(const material of Array.isArray(m.material)?m.material:m.material?[m.material]:[])for(const t of [material.map,material.uniforms?.map?.value])if(t)textures.set(t,t.version)});
  const before=view.debug().resources.render;for(let i=0;i<150;i++){view.setCountdown({...running,hundredths:String(i%100).padStart(2,'0')});view.render(1510+i*10);checkCount(0)}
  const after=view.debug().resources.render;assert.equal(after.geometries,before.geometries);assert.equal(after.textures,before.textures);assert.equal(after.materials,before.materials);for(const [texture,version]of textures)assert.equal(texture.version,version,'Timer ticks must not upload new textures');
  for(const state of [running,finished])for(const [w,h]of [[1366,518],[1920,810],[900,700],[390,492],[320,240]]){
   view.resize(w,h);view.setCountdown(state);view.render(3200);checkCount(0);const frame=calls.at(-1);let maxNdc=0;
   frame.scene.traverseVisible(mesh=>{if(mesh.userData.role!=='countdown-glyph')return;assert.equal(mesh.rotation.x,0);assert.equal(mesh.rotation.y,0);assert.equal(mesh.rotation.z,0);assert.equal(mesh.geometry.type,'ExtrudeGeometry');const b=mesh.geometry.boundingBox;assert.ok(b.max.z-b.min.z>.16,'Genuine beveled depth remains');for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const p=new THREE.Vector3(x,y,z).applyMatrix4(mesh.matrixWorld).project(frame.camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1,'Upright glyphs must fit the camera');maxNdc=Math.max(maxNdc,Math.abs(p.x),Math.abs(p.y))}});reports.push({state:state.state,w,h,maxNdc});
  }
  // The same model visibility must survive both fallback directions.
  gl.lost=true;rendererCanvas.emit('webglcontextlost');view.render(3300);assert.equal(view.debug().backend,'canvas');checkCount(0);gl.lost=false;rendererCanvas.emit('webglcontextrestored');view.render(3310);assert.equal(view.debug().backend,'webgl');checkCount(0);
 }
 view.setCountdown(finished);view.render(3400);checkCount(0);view.setActive(false);view.setActive(true);checkCount(0);
 view.setCountdown(null);view.render(3500);checkCount(1);assert.equal(view.debug().selectedName,names[3]);
 view.setCountdown(running);view.reset();view.render(3600);checkCount(0);assert.equal(view.debug().winner,'');
 view.setCountdown(null);view.render(3700);assert.ok(view.debug().visibleCardCount>20);view.start(4000);view.render(4400);assert.equal(view.debug().visibleCardCount,96);
 view.reveal(names[4],6550);view.render(6910);checkCount(1);view.setNames(['新学生']);assert.equal(view.debug().winner,'');assert.ok(view.debug().visibleCardCount>0);view.dispose();view.dispose();
}
for(const [w,h,viewportWidth,viewportHeight]of [[1100,388.5,1366,518],[354.9,369,390,492]]){
 const composition=countdownComposition(running,w,h,viewportWidth,viewportHeight);
 assert.ok(composition.entries.every(e=>e.role!=='title'),'No heading is allocated for either rendering backend');
 assert.deepEqual(composition.entries.filter(e=>e.role!=='title'),countdownComposition({...running,hundredths:'01'},w,h,viewportWidth,viewportHeight).entries.filter(e=>e.role!=='title').map((e,i)=>({...e,char:composition.entries.filter(e=>e.role!=='title')[i].char})),'Viewport-calibrated main and fractional positions stay stable across ticks');
}
console.log('PASS result/timer stars-only presentation: hidden idle continuity, one selected plaque, zero timer plaques, Canvas/WebGL parity, reset/new draw/theme/context restoration, upright extruded bounds, zero heading entries and texture/cache stability. '+JSON.stringify(reports));
