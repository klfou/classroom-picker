import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {register} from 'node:module';
import {createCanvasRecorder,flattenedText,clearOutput,cacheSignature} from './helpers/paper-canvas-recorder.mjs';
register('./helpers/theme-scene-loader.mjs',import.meta.url);
const THREE=await import('../dist/vendor/three.module.js');
const {createBoardCountdown}=await import('../dist/board-countdown.js');
const {createCountdownMeshes}=await import('../dist/space-countdown.js');
const {countdownLayout}=await import('../dist/space-card-art.js');
const {countdownDigitLayout}=await import('../dist/countdown-digit-layout.js');
const {countdownTitleLayout}=await import('../dist/countdown-title-layout.js');
const {createPaperCards}=await import('../dist/paper-cards.js');

// Source locks protect the v91 classroom, its physical camera approach, clock,
// v90 title contract, and the exact approved playing-card back from this change.
const hashes={
 'board-countdown.js':'ae752cf44d636740998e0affd475acf1cbb17c61a1de01a25ce25389f1b6d870',
 'countdown-title-layout.js':'9ea1e2ee6b30d0ae4385291fc8fac65d1296b23995f31d8a7fbf136507c656ca',
 'draw-timing.js':'75586162856fddbac09ca5196d0add9f894454d676bf79ad28dc779776fb4c4f',
 'countdown-state.js':'76183d4f371473cfe1e861ea13c433d99551ec2b9629e26ad2ef51caf18f8b4e',
 'countdown.js':'8b6ea93a3067f972c8cf3f42d20b3e5f17faac5209d93afbbe22c446f4541126',
};
const hash=s=>createHash('sha256').update(s).digest('hex');
for(const [file,expected]of Object.entries(hashes))assert.equal(hash(fs.readFileSync(new URL('../dist/'+file,import.meta.url))),expected,file+' is byte-identical to approved v91');
// v93 changes only repeat controls in scene; retain the physical camera block.
const sceneSource=fs.readFileSync(new URL('../dist/scene.js',import.meta.url),'utf8');
assert.equal(hash(sceneSource.slice(sceneSource.indexOf('function dimensions()'),sceneSource.indexOf('function randomIndex(')).trim()),'769ec141f2ff9241a61267a3de00c3e02e99ef0e487a4907f06ad5d1ced8368b','Classroom camera and board approach remain unchanged');
const paperSource=fs.readFileSync(new URL('../dist/paper-cards.js',import.meta.url),'utf8'),part=(a,b)=>paperSource.slice(paperSource.indexOf(a),paperSource.indexOf(b)).trim();
assert.equal(hash(part('function makeBack(','function makeFront(')),'f4899b19243991c0060f608117ea192921f27631e879dfd89ecb243b6616344e','Approved v91 back is unchanged');
assert.equal(hash(part('function selectedDecoration(','function paintSelectedCorners(')),'735edd9cee6a133563600c2e4f718122db483e343c3c7261a4118a168fae4623','Stable rank/suit identity mapping is unchanged; v93 corner clearance is tested separately');
const sizes=[[1366,518],[1920,806],[1024,468],[768,724],[390,456],[320,212],[320,180],[844,92]];
const states=['10:00','09:59',...'0123456789'].map(text=>({state:'running',text:text.length===1?`${text}${text}:${text}${text}`:text,hundredths:'99'}));
const empty=()=>({minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity});
const union=list=>list.reduce((a,b)=>({minX:Math.min(a.minX,b.minX),maxX:Math.max(a.maxX,b.maxX),minY:Math.min(a.minY,b.minY),maxY:Math.max(a.maxY,b.maxY)}),empty());
const height=b=>b.maxY-b.minY;
const near=(actual,expected,tolerance,label)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${label}: ${actual} versus ${expected} (±${tolerance})`);
const inside=(a,b,label)=>assert.ok(a.minX>=b.minX-1e-7&&a.maxX<=b.maxX+1e-7&&a.minY>=b.minY-1e-7&&a.maxY<=b.maxY+1e-7,`${label}: ${JSON.stringify(a)} inside ${JSON.stringify(b)}`);
const disjoint=(a,b,label)=>assert.ok(a.maxX<=b.minX||b.maxX<=a.minX||a.maxY<=b.minY||b.maxY<=a.minY,label);
function projected(meshes,camera,w,h){
 camera.updateMatrixWorld(true);const b=empty(),p=new THREE.Vector3();for(const m of meshes){m.updateWorldMatrix(true,false);const vertices=m.geometry.attributes.position;for(let i=0;i<vertices.count;i++){p.fromBufferAttribute(vertices,i).applyMatrix4(m.matrixWorld).project(camera);const x=(1+p.x)*w/2,y=(1-p.y)*h/2;b.minX=Math.min(b.minX,x);b.maxX=Math.max(b.maxX,x);b.minY=Math.min(b.minY,y);b.maxY=Math.max(b.maxY,y)}}return b;
}
function boardAt(w,h){
 const board=createBoardCountdown(),camera=new THREE.PerspectiveCamera(34,w/h,.1,500),size=board.fit(w/h),fitted=(size.height/2+.06)/Math.tan(camera.fov*Math.PI/360),distance=Math.min(3,fitted),target=new THREE.Vector3(0,3.15,-14.98);board.group.scale.setScalar((distance-.24)/(fitted-.24));camera.position.copy(target).add(new THREE.Vector3(0,0,distance));camera.lookAt(target);return {board,camera};
}
const {Canvas,surfaces}=createCanvasRecorder(),output=new Canvas(),paper=createPaperCards(output,{active:false});paper.setCountdown(states[0]);paper.setActive(true);
const initialAtlases=surfaces.filter(c=>c.ctx.prints.some(p=>/^[0-9]$/.test(p.text))),atlasPaints=cacheSignature(initialAtlases),firstCache=paper.debug().timerCache;
let checks=0;
const savedDpr=globalThis.devicePixelRatio;
try{
 for(const [w,h]of sizes){
  const target=countdownDigitLayout(w,h),heading=countdownTitleLayout(w,h),viewport={minX:0,maxX:w,minY:0,maxY:h},{board,camera}=boardAt(w,h),boardDigitBounds=[];
  const pose=JSON.stringify([camera.position.toArray(),camera.quaternion.toArray(),camera.projectionMatrix.toArray()]);
  for(const state of states){board.update(state);boardDigitBounds.push(projected(board.slots.filter(m=>/^[0-9]$/.test(m.userData.char)&&m.scale.x>1),camera,w,h))}
  const reference=union(boardDigitBounds);near(target.height,height(reference),.0001,`${w}x${h}: helper matches actual classroom extrusion envelope`);near(target.top,reference.minY,.0001,`${w}x${h}: helper matches actual classroom top`);near(target.bottom,reference.maxY,.0001,`${w}x${h}: helper matches actual classroom bottom`);
  assert.equal(JSON.stringify([camera.position.toArray(),camera.quaternion.toArray(),camera.projectionMatrix.toArray()]),pose,'Reading target cannot change camera or board');
  const p=countdownLayout(w,h),space=createCountdownMeshes(),starCamera=new THREE.PerspectiveCamera(2*Math.atan(.5/1.26)*180/Math.PI,w/h,.1,100);starCamera.projectionMatrix.elements[9]=-.02;
  const main=()=>space.group.children.filter(m=>m.visible&&m.userData.textRole==='main'&&/^[0-9]$/.test(m.userData.char)),title=()=>space.group.children.filter(m=>m.visible&&m.userData.textRole==='title');let allocated=null,scales=null;const meshEnvelope=[];
  for(const state of states){
   space.update(state,p.width,p.height,h*1.26,w,h);const digits=main(),b=projected(digits,starCamera,w,h),t=projected(title(),starCamera,w,h);meshEnvelope.push(b);inside(b,viewport,'Actual projected space digits are unclipped');disjoint(b,t,'Actual space title does not overlap any main digit');near(t.minY,heading.top,.05,'v90 title top preserved');near(height(t),heading.height,.05,'v90 title visible height preserved');
   assert.ok(height(b)>=target.height*.95&&height(b)<=target.height+.05,'Every digit retains the shared visible scale without overshooting the envelope');
   for(let i=0;i<digits.length;i++){assert.equal(digits[i].geometry.type,'ExtrudeGeometry');for(const other of digits.slice(i+1))disjoint(projected([digits[i]],starCamera,w,h),projected([other],starCamera,w,h),`${w}x${h} ${state.text}: main ${digits[i].userData.char} ${JSON.stringify(projected([digits[i]],starCamera,w,h))} vs ${other.userData.char} ${JSON.stringify(projected([other],starCamera,w,h))}`)}
   for(const m of space.group.children.filter(m=>m.visible&&m.userData.textRole==='minor')){const minor=projected([m],starCamera,w,h);inside(minor,viewport,'Space hundredths fit viewport');disjoint(b,minor,'Space fraction does not overlap main glyphs')}
   const debug=space.debug();if(allocated===null){allocated=debug.cachedGeometries;scales=digits.map(m=>m.scale.toArray())}else{assert.equal(debug.cachedGeometries,allocated,'Digits never allocate new geometry');assert.deepEqual(digits.map(m=>m.scale.toArray()),scales,'All digits reuse fixed stable scales')}
  }
  near(height(union(meshEnvelope)),target.height,.06,`${w}x${h}: genuine space extrusion visible envelope equals classroom`);
  const stableCache=space.debug().cachedGeometries;for(let i=0;i<100;i++)space.update({...states[0],hundredths:String(i).padStart(2,'0')},p.width,p.height,h*1.26,w,h);assert.equal(space.debug().cachedGeometries,stableCache,'One hundred ticks reuse the same mesh alphabet');space.dispose();
  for(const dpr of [1,1.5,2]){
   globalThis.devicePixelRatio=dpr;paper.resize(w,h);let geometry=null,paperEnvelope=0;
   for(const state of states){
    clearOutput(output);paper.setCountdown(state);paper.render(++checks);const debug=paper.debug(),cards=debug.timerCards,mainCards=cards.filter(c=>c.role==='main');near(debug.timerLayout.digitTargetHeight,target.height,1e-7,'Paper shares classroom ink target');
    for(const c of cards){inside(c.bounds,viewport,'Paper card stays on screen');inside(c.glyphBounds,c.bounds,'Actual paper core ink stays inside its card');disjoint(c.glyphBounds,debug.timerLayout.title.bounds,'Paper title does not overlap core');const inkTarget=target.height*(c.role==='main'?1:.30);near(c.glyphTargetHeight,inkTarget,.001,'Paper uniform alphabet scale matches main/fraction target');assert.ok(height(c.glyphBounds)>=inkTarget*.95&&height(c.glyphBounds)<=inkTarget+.001,'Natural glyph overshoot stays within a fixed readable scale');if(c.role==='main')paperEnvelope=Math.max(paperEnvelope,height(c.glyphBounds));for(const other of cards.filter(other=>other!==c))disjoint(c.bounds,other.bounds,'Paper digit cards do not overlap')}
    const text=flattenedText(output,1/debug.dpr);for(const c of mainCards){const candidates=text.filter(t=>t.text===c.char&&t.bounds.minX>=c.bounds.minX-1e-6&&t.bounds.maxX<=c.bounds.maxX+1e-6&&t.bounds.minY>=c.bounds.minY-1e-6&&t.bounds.maxY<=c.bounds.maxY+1e-6).sort((a,b)=>height(b.bounds)-height(a.bounds));if(candidates.length){near(height(candidates[0].bounds),height(c.glyphBounds),.001,'Recorded real atlas transform matches actual ink, not card/font size');assert.equal(candidates[0].clipped,false,'Main atlas crop is complete')}}
    const now=cards.map(({char,decoration,faceKey,glyphBounds,glyphHeight,...c})=>c);if(geometry)assert.deepEqual(now,geometry,'Numerical changes cannot shift card positions');else geometry=now;assert.deepEqual(debug.timerCache,firstCache,'Resize/DPR/digits reuse bounded atlases');
   }
   near(paperEnvelope,target.height,.001,'All0–9 paper ink envelope equals classroom, with one stable font scale');
  }
 }
 assert.deepEqual(cacheSignature(initialAtlases),atlasPaints,'All0–9 and DPR changes never repaint cached numeric glyph/corner atlases');
}finally{paper.dispose();if(savedDpr===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=savedDpr}
console.log(`PASS shared main digit scale: unchanged v91 classroom/camera/clock and approved back, actual all0–9 classroom vs GPU extrusion bounds, v90 heading placement, exact paper core-ink transforms, 8 viewport aspects × 3 DPRs, widest10:00, no title/core/fraction overlap or crop, stable100 ticks and fixed caches (${checks} paper layouts)`);
