// Real Three buffers/materials plus recording Canvas. Pixel and timing checks
// use the separate native release harness; these are not browser GPU claims.
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {createSpaceCards} from '../dist/space-cards.js';
import {createMeteorField} from '../dist/space-meteors.js';
let surfaces=0;
class Context {
 constructor(){this.images=[]}
 createLinearGradient(){return {addColorStop(){}}}createRadialGradient(){return {addColorStop(){}}}
 beginPath(){}moveTo(){}lineTo(){}quadraticCurveTo(){}bezierCurveTo(){}closePath(){}fill(){}stroke(){}arc(){}fillRect(){}clearRect(){}scale(){}save(){}restore(){}setTransform(){}transform(){}clip(){}fillText(){}
 drawImage(image){this.images.push(image)}measureText(t){return {width:String(t).length*30}}
}
class Canvas {
 constructor(width=1366,height=518){surfaces++;this.width=width;this.height=height;this.style={};this.ctx=new Context();this.events=new Map()}
 getContext(kind){return kind==='2d'?this.ctx:null}addEventListener(type,fn){this.events.set(type,fn)}removeEventListener(type){this.events.delete(type)}emit(type){this.events.get(type)?.({preventDefault(){}})}
}
const names=Array.from({length:64},(_,i)=>`学生${i+1}`),running={state:'running',text:'01:23',hundredths:'45'};
const field=createMeteorField((w,h)=>new Canvas(w,h)),sample={width:1366,height:518,now:0,epoch:0,frozenElapsed:0,reducedMotion:false};
const particles=field.particles,sprite=field.sprite,initialSurfaces=surfaces;
assert.equal(field.debug().waveInterval,3650/1.3,'Launch frequency is exactly 30% above v74');
assert.equal(field.debug().period,2*3650/1.3,'Two fixed banks alternate at the new launch cadence');
assert.ok(field.debug().period>90+95+4*155+2600,'A bank cannot recycle before its latest flight has faded');
let maxStep=0,maxAlphaStep=0,minVisible=10,maxVisible=0,maxBrightnessDelta=0,previous=null,previousBrightness=0,activeFrames=0;const waveSizes=new Set(),speeds=new Set();
for(let f=0;f<=3600;f++){
 sample.now=f*1000/60;field.sample(sample);const s=field.debug();if(s.visible)activeFrames++;for(const p of s.particles){waveSizes.add(p.waveSize);speeds.add(Math.round(p.speed))}minVisible=Math.min(minVisible,s.visible);maxVisible=Math.max(maxVisible,s.visible);
 const brightness=s.particles.reduce((sum,p)=>sum+p.alpha,0);if(previous)maxBrightnessDelta=Math.max(maxBrightnessDelta,Math.abs(brightness-previousBrightness));previousBrightness=brightness;
 assert.equal(field.particles,particles);assert.equal(field.sprite,sprite);assert.equal(surfaces,initialSurfaces);assert.equal(s.count,10);
 for(const p of s.particles){assert.ok(p.alpha>=0&&p.alpha<=.81);assert.ok(p.length>=110&&p.length<=275);assert.ok(p.thickness>=11&&p.thickness<=19);assert.ok(p.lifetime>=1400&&p.lifetime<=2600);assert.ok(p.speed>=280&&p.speed<=560);if(previous){const old=previous[p.id];maxAlphaStep=Math.max(maxAlphaStep,Math.abs(old.alpha-p.alpha));if(p.cycle===old.cycle)maxStep=Math.max(maxStep,Math.hypot(p.x-old.x,p.y-old.y));else assert.ok(old.alpha<.00001&&p.alpha<.00001,'A recycled trajectory must be invisible')}}
 previous=s.particles;
}
assert.equal(minVisible,0,'Clusters need genuinely quiet gaps');assert.equal(maxVisible,5);assert.ok(activeFrames>1700&&activeFrames<3000,`Intermittent flights: ${activeFrames}/3601 active frames`);assert.ok([...waveSizes].every(n=>n>=2&&n<=5)&&waveSizes.size>=3,'Cluster sizes vary within 2–5 meteors');assert.ok(speeds.size>50,'Depth gives visibly varied speeds');assert.ok(maxStep>8&&maxStep<9.34,'Fast recognizable travel, bounded below 560px/s');assert.ok(maxAlphaStep<.16,'A head eases into existence without an instant pop');assert.ok(maxBrightnessDelta<.3,'Staggered births avoid a synchronized pulse');
sample.now=1000;field.sample(sample);const cycleStart=field.debug().particles;sample.now=8300;field.sample(sample);assert.notDeepEqual(field.debug().particles,cycleStart,'Each wave has a new deterministic arrangement');
sample.now=928473.25;field.sample(sample);const direct=field.debug();sample.now=1;field.sample(sample);sample.now=928473.25;field.sample(sample);assert.deepEqual(field.debug(),direct,'Sampling must catch up directly after a hidden tab without accumulating frame deltas');

let motionListener;
globalThis.matchMedia=()=>({matches:false,addEventListener(type,fn){motionListener=fn},removeEventListener(){}});
for(const kind of ['canvas','webgl']){
 const canvas=new Canvas(),rendererCanvas=new Canvas(),calls=[],gl={lost:false,getParameter(){},createShader(){},drawElements(){},isContextLost(){return this.lost}},renderer={isWebGLRenderer:true,domElement:rendererCanvas,capabilities:{getMaxAnisotropy:()=>1},getContext:()=>gl,render(scene,camera){scene.updateMatrixWorld();camera.updateMatrixWorld();calls.push({scene,camera})}};
 const view=createSpaceCards(canvas,kind==='webgl'?{renderer}:{});view.setNames(names);view.setActive(true);view.render(11000);
 const meteorState=()=>view.debug().resources.render.meteors,pose=()=>meteorState().particles;
 const idle=pose();view.start(11000);assert.deepEqual(pose(),idle,'Draw start does not restart the shower');view.reveal(names[3],11000);assert.deepEqual(pose(),idle,'Winner does not restart it');view.setCountdown(running);view.render(11000);assert.deepEqual(pose(),idle,'Timer uses the identical background');view.setCountdown({state:'finished'});view.render(11000);assert.deepEqual(pose(),idle,'Time-up uses the identical background');
 const elapsed=meteorState().elapsed;view.resize(390,492);assert.equal(meteorState().elapsed,elapsed);view.resize(1366,518);assert.deepEqual(pose(),idle,'Resize must reproject, never reseed or reset');
 motionListener({matches:true});const frozen=pose();view.render(300000);assert.deepEqual(pose(),frozen,'Reduced motion is a static field');motionListener({matches:false});assert.deepEqual(pose(),frozen,'Motion resume begins at the frozen pose');view.render(300016);assert.ok(meteorState().elapsed>elapsed,'The clock resumes even during a quiet gap');view.render(300500);assert.notDeepEqual(pose(),frozen);
 view.setActive(false);const painted=calls.length;view.render(600000);const inactive=pose();assert.equal(calls.length,painted,'Inactive star view never paints');view.setActive(true);assert.deepEqual(pose(),inactive,'Theme return shows the current shared timeline');
 if(kind==='canvas'){
  view.setCountdown(null);view.reveal(names[3],610000);for(let time=610360;time<620000;time+=100){canvas.ctx.images.length=0;view.render(time);if(meteorState().visible)break}const images=canvas.ctx.images,meteor=images.find(image=>image.width===256&&image.height===32);assert.ok(meteor);assert.ok(images.indexOf(meteor)>0);assert.ok(images.lastIndexOf(meteor)<images.length-1,'Every meteor must be painted before the selected face');assert.equal(images.filter(image=>image!==meteor).length,2,'Only the cached stars and selected plaque remain');
 }else{
  const {scene,camera}=calls.at(-1),mesh=scene.getObjectByName('space-meteor-shower'),material=mesh.material,geometry=mesh.geometry,position=geometry.getAttribute('position'),opacity=geometry.getAttribute('opacity'),uv=geometry.getAttribute('uv'),texture=material.uniforms.map.value;
  assert.ok(mesh.isMesh&&mesh.userData.role==='background-meteors');assert.equal(position.count,40);assert.equal(geometry.index.count,60);assert.equal(opacity.count,40);assert.equal(uv.count,40);assert.equal(material.transparent,false);assert.equal(material.blending,THREE.CustomBlending);assert.equal(material.blendSrc,THREE.SrcAlphaFactor);assert.equal(material.blendDst,THREE.OneMinusSrcAlphaFactor);assert.equal(material.depthTest,true);assert.equal(material.depthWrite,false);assert.equal(material.toneMapped,false);assert.equal(texture.colorSpace,THREE.SRGBColorSpace);assert.equal(texture.minFilter,THREE.LinearFilter);assert.equal(texture.image.width*texture.image.height,8192);
  const background=scene.children.find(child=>child!==mesh&&child.renderOrder===-1000);assert.ok(background&&background.renderOrder<mesh.renderOrder);assert.ok(scene.children.filter(child=>child.userData.role==='rounded-card').every(child=>mesh.renderOrder<child.renderOrder),'Meteors are composited before opaque cards');assert.match(material.vertexShader,/\.999,1\./,'Fixed far-depth must stay behind cards/numbers');assert.ok(new THREE.Vector3(0,0,-30).project(camera).z<.999);
  for(let i=0;i<geometry.index.count;i+=3){const a=geometry.index.getX(i),b=geometry.index.getX(i+1),c=geometry.index.getX(i+2),cross=(position.getX(b)-position.getX(a))*(position.getY(c)-position.getY(a))-(position.getY(b)-position.getY(a))*(position.getX(c)-position.getX(a));assert.ok(cross>0,'Actual NDC meteor triangles are nondegenerate and CCW for FrontSide')}
  for(let i=0;i<10;i++){const p=meteorState().particles[i],j=i*4;assert.ok(Math.abs(opacity.getX(j)-(p.visible?p.alpha:0))<1e-6);const headX=(position.getX(j+1)+position.getX(j+2))*.25+.5,headY=.5-(position.getY(j+1)+position.getY(j+2))*.25;assert.ok(Math.abs(headX-p.x/1366)<1e-7);assert.ok(Math.abs(headY-p.y/518)<1e-7);const tailX=(position.getX(j)+position.getX(j+3))*.25+.5,tailY=.5-(position.getY(j)+position.getY(j+3))*.25;assert.ok(Math.abs(tailX-(p.x-p.length*p.cos)/1366)<1e-7,'GPU tail uses this meteor’s heading');assert.ok(Math.abs(tailY-(p.y-p.length*p.sin)/518)<1e-7)}
  const before=view.debug().resources.render,version=texture.version,surfaceCount=surfaces;let disposedGeometry=0,disposedMaterial=0,disposedTexture=0;geometry.addEventListener('dispose',()=>disposedGeometry++);material.addEventListener('dispose',()=>disposedMaterial++);texture.addEventListener('dispose',()=>disposedTexture++);
  for(let i=0;i<1800;i++)view.render(600000+i*1000/60);
  const after=view.debug().resources.render;for(const key of ['textures','geometries','materials','meshes'])assert.equal(after[key],before[key]);assert.equal(mesh.geometry,geometry);assert.equal(geometry.getAttribute('position'),position);assert.equal(geometry.getAttribute('opacity'),opacity);assert.equal(material.uniforms.map.value,texture);assert.equal(texture.version,version,'Meteor frames never reupload the sprite');assert.equal(surfaces,surfaceCount,'Meteor frames create no new Canvas');
  const beforeLoss=pose();gl.lost=true;rendererCanvas.emit('webglcontextlost');assert.equal(view.debug().backend,'canvas');assert.deepEqual(pose(),beforeLoss,'Context loss retains the exact meteor state');assert.equal(disposedGeometry,1);assert.equal(disposedMaterial,1);assert.equal(disposedTexture,1);gl.lost=false;rendererCanvas.emit('webglcontextrestored');assert.equal(view.debug().backend,'webgl');assert.deepEqual(pose(),beforeLoss,'Context restoration uses the same sprite/model');assert.equal(disposedGeometry,1);assert.equal(disposedTexture,1);
 }
 view.dispose();view.dispose();assert.equal(rendererCanvas.events.size,0);
}
delete globalThis.matchMedia;field.dispose();field.dispose();
console.log('PASS meteor lifecycle, 30% higher launch cadence, staggered waves with 2–5 flights, 1.4–2.6s lifetimes, quiet gaps and bounded brightness/speed, static reduced-motion, context/theme/resize continuity, Canvas foreground order, GPU actual CCW winding and background blending/depth, shared state/texture parity, 1800-frame fixed buffers/resources and single disposal. '+JSON.stringify({minVisible,maxVisible,activeFrames,maxStep,maxAlphaStep,maxBrightnessDelta}));
