import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./helpers/theme-scene-loader.mjs',import.meta.url);
const THREE=await import('../dist/vendor/three.module.js');
const {createBoardCountdown}=await import('../dist/board-countdown.js');
const {createCountdownMeshes,countdownComposition}=await import('../dist/space-countdown.js');
const {countdownLayout}=await import('../dist/space-card-art.js');
const {countdownTitleLayout}=await import('../dist/countdown-title-layout.js');
const {countdownDigitLayout}=await import('../dist/countdown-digit-layout.js');
const sizes=[[1366,518],[1920,806],[1024,468],[768,724],[390,456],[320,212],[320,180],[844,92]];
function projected(meshes,camera,w,h){
 camera.updateMatrixWorld(true);const bounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};
 for(const mesh of meshes){mesh.updateWorldMatrix(true,false);const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).project(camera),x=(1+v.x)*w/2,y=(1-v.y)*h/2;bounds.minX=Math.min(bounds.minX,x);bounds.maxX=Math.max(bounds.maxX,x);bounds.minY=Math.min(bounds.minY,y);bounds.maxY=Math.max(bounds.maxY,y)}}return bounds;
}
function headingBounds(b,target,label){assert.ok(Math.abs(b.minY-target.top)<.05,label+' exact screen top');assert.ok(Math.abs(b.maxY-b.minY-target.height)<.05,label+' exact visible screen height');assert.ok(Math.abs((b.minX+b.maxX)/2-target.x)<.05,label+' centered actual silhouette')}
for(const [w,h]of sizes){
 const board=createBoardCountdown(),camera=new THREE.PerspectiveCamera(34,w/h,.1,500),size=board.fit(w/h),fitted=(size.height/2+.06)/Math.tan(camera.fov*Math.PI/360),distance=Math.min(3,fitted),target=new THREE.Vector3(0,3.15,-14.98);
 board.group.scale.setScalar((distance-.24)/(fitted-.24));camera.position.copy(target).add(new THREE.Vector3(0,0,distance));camera.lookAt(target);
 const initial=projected(board.slots,camera,w,h),transforms=board.slots.map(m=>[m.position.toArray(),m.scale.toArray(),m.geometry.uuid]),pose=[camera.position.toArray(),camera.quaternion.toArray(),camera.projectionMatrix.toArray()],expected=countdownTitleLayout(w,h);
 board.fitTitle(camera.fov,distance,w,h);
 assert.deepEqual(projected(board.slots,camera,w,h),initial,'Main classroom digits stay pixel-identical');assert.deepEqual(board.slots.map(m=>[m.position.toArray(),m.scale.toArray(),m.geometry.uuid]),transforms);assert.deepEqual([camera.position.toArray(),camera.quaternion.toArray(),camera.projectionMatrix.toArray()],pose,'Title fit cannot change the camera');
 const title=board.group.getObjectByName('board-countdown-title'),bounds=projected(title.children,camera,w,h),plate=projected([board.group.children[0]],camera,w,h);headingBounds(bounds,expected,`classroom ${w}×${h}`);assert.ok(bounds.maxY<initial.minY,`Classroom title keeps a positive gap above every main digit at ${w}×${h}`);
 assert.ok(bounds.minX>plate.minX&&bounds.maxX<plate.maxX&&bounds.minY>plate.minY&&bounds.maxY<plate.maxY,'Physical title stays inside the blackboard');assert.ok(title.children.every(m=>m.geometry.type==='ExtrudeGeometry'));
 const p=countdownLayout(w,h),space=createCountdownMeshes(),starCamera=new THREE.PerspectiveCamera(2*Math.atan(.5/1.26)*180/Math.PI,w/h,.1,100),state={state:'running',text:'05:00',hundredths:'00'};starCamera.projectionMatrix.elements[9]=-.02;
 space.update(state,p.width,p.height,h*1.26,w,h);const digits=()=>space.group.children.filter(m=>m.visible&&m.userData.textRole!=='title'),before=projected(digits(),starCamera,w,h),mainComposition=countdownComposition(state,p.width,p.height,w,h).entries.filter(e=>e.role!=='title'),digitTarget=countdownDigitLayout(w,h);
 const main=projected(digits().filter(m=>m.userData.textRole==='main'&&/^[0-9]$/.test(m.userData.char)),starCamera,w,h);assert.ok(Math.abs((main.maxY-main.minY)-digitTarget.height)<.06,'Main space visible extrusion uses unchanged classroom scale');space.update(state,p.width,p.height,h*1.26,w,h);assert.deepEqual(projected(digits(),starCamera,w,h),before,'Stable viewport leaves space digits pixel-identical');assert.deepEqual(countdownComposition(state,p.width,p.height,w,h).entries.filter(e=>e.role!=='title'),mainComposition);
 const heading=()=>space.group.children.filter(m=>m.visible&&m.userData.textRole==='title'),starBounds=projected(heading(),starCamera,w,h);headingBounds(starBounds,expected,`space ${w}×${h}`);assert.ok(starBounds.maxY<before.minY,`Space title keeps a positive gap above every main digit at ${w}×${h}`);assert.ok(heading().every(m=>m.geometry.type==='ExtrudeGeometry'));
 const allocation=space.debug().cachedGeometries;for(let hundredths=0;hundredths<100;hundredths++){space.update({...state,hundredths:String(hundredths).padStart(2,'0')},p.width,p.height,h*1.26,w,h);assert.deepEqual(projected(heading(),starCamera,w,h),starBounds,'Hundredths reuse stable title transforms');assert.equal(space.debug().cachedGeometries,allocation)}
 space.update({state:'finished'},p.width,p.height,h*1.26,w,h);assert.equal(heading().length,0,'Space completion gains no new heading');board.update({state:'finished',text:'00:00'});assert.equal(title.visible,true,'Classroom completion keeps its existing heading');space.dispose();
}
console.log('PASS shared title: eight desktop/mobile/short viewports, exact projected height/top/center, true extruded meshes, physical board containment, unchanged classroom digits/camera and stable shared-scale space digits, bounded caches, stable100 hundredths and unchanged completion title visibility');
