import {parsePackage,summarizePackage,MAX_TRANSFER_BYTES} from './class-transfer.js';
import * as THREE from 'three';
import {createSpaceCards} from './space-cards.js';
import {createPaperCards} from './paper-cards.js';
import {createBoardCountdown} from './board-countdown.js';
import {OrbitControls} from '../vendor/OrbitControls.js';
import {SoftwareRenderer} from './software-renderer.js';
import {loadAvatarLibrary, STANDING_LEG_EXTENSION} from './avatars.js';
import {validateRows, studentModelKind} from './roster.js';
import {createRosterEditor} from './roster-editor.js';
import {createClassroomSounds} from './sounds.js';
import {createClassStore} from './classes.js';
import {drawTimingForTheme} from './draw-timing.js';
import {selectionTimeline} from './selection-timing.js';
import {createRenderBudget} from './render-budget.js';
const STUDENT_SCALE=.76,STUDENT_STAND_RISE=STANDING_LEG_EXTENSION*STUDENT_SCALE;
let avatarLibrary;
let motionUntil=0, sceneRevision=0;
const $=s=>document.querySelector(s), viewport=$('#viewport'), scene=new THREE.Scene();scene.background=new THREE.Color('#eceee1');
let renderer;try{const c=document.createElement('canvas'),gl=c.getContext('webgl2',{antialias:true});renderer=gl?new THREE.WebGLRenderer({canvas:c,context:gl,antialias:true}):new SoftwareRenderer()}catch{renderer=new SoftwareRenderer()}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=false;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;viewport.prepend(renderer.domElement);if(renderer.isSoftware)$('.compat').hidden=false;
const spaceCanvas=document.createElement('canvas');spaceCanvas.id='space-canvas';spaceCanvas.setAttribute('aria-hidden','true');viewport.append(spaceCanvas);
const spaceCards=createSpaceCards(spaceCanvas,{renderer,onBackendChange:backend=>{document.body.dataset.spaceBackend=backend}});
const paperCanvas=document.createElement('canvas');paperCanvas.id='paper-canvas';paperCanvas.setAttribute('aria-hidden','true');viewport.append(paperCanvas);
const paperCards=createPaperCards(paperCanvas,{active:false});
let activeTheme='space',lastBoardState=null;
const renderBudgets={classroom:createRenderBudget(),space:createRenderBudget(),paper:createRenderBudget()};let rendererScale=1,rendererRatio=Math.min(devicePixelRatio,1.6),lastDeviceRatio=devicePixelRatio;
function applyRenderQuality(){
 // The paper surface has its own backing store; its quality never resizes the hidden shared GPU.
 const scale=activeTheme==='paper'?rendererScale:renderBudgets[activeTheme].scale,ratio=activeTheme==='paper'?rendererRatio:Math.min(devicePixelRatio,1.6)*scale;
 if(rendererRatio!==ratio){rendererRatio=ratio;renderer.setPixelRatio(ratio);sceneRevision++}
 if(rendererScale!==scale){rendererScale=scale;renderer.setQuality?.(scale);sceneRevision++}
 spaceCards.setQuality(renderBudgets.space.scale);paperCards.setQuality(renderBudgets.paper.scale);
 if(lastDeviceRatio!==devicePixelRatio){lastDeviceRatio=devicePixelRatio;const [w,h]=dimensions();spaceCards.resize(w,h);paperCards.resize(w,h)}
}
try{const savedTheme=localStorage.getItem('sunlit-orbit-preview-theme');if(['space','paper'].includes(savedTheme))activeTheme=savedTheme}catch{}
spaceCards.setActive?.(activeTheme==='space');paperCards.setActive(activeTheme==='paper');
function updateThemeControls(){
 document.body.dataset.theme=activeTheme;
 viewport.setAttribute('aria-label',activeTheme==='paper'?'翻牌点名姓名卡片':activeTheme==='space'?'星空姓名卡片':'可旋转缩放的三维教室');
 $('#overview').textContent=activeTheme!=='classroom'?'全部卡片':'全班视角';$('#overview').setAttribute('aria-label',activeTheme!=='classroom'?'查看全部姓名卡片':'回到全班视角');
 for(const button of document.querySelectorAll('[data-theme-choice]')){const selected=button.dataset.themeChoice===activeTheme;button.setAttribute('aria-checked',String(selected));button.tabIndex=selected?0:-1}
}
updateThemeControls();
const camera=new THREE.PerspectiveCamera(34,1,.1,500),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=1.5;controls.maxDistance=220;controls.maxPolarAngle=Math.PI*.495;controls.minPolarAngle=.025;controls.minAzimuthAngle=-Infinity;controls.maxAzimuthAngle=Infinity;controls.enablePan=true;controls.screenSpacePanning=true;controls.target.set(0,0,0);controls.addEventListener('change',()=>{motionUntil=performance.now()+180;sceneRevision++;});
scene.add(new THREE.HemisphereLight('#fff8e8','#b5beb1',2.2));const sun=new THREE.DirectionalLight('#fff4e5',2);sun.position.set(-12,18,8);scene.add(sun);
const mat=(c)=>new THREE.MeshStandardMaterial({color:c,roughness:.8});const M={floor:mat('#d8c5a5'),edge:mat('#c7b48f'),wall:mat('#eee7d6'),trim:mat('#97a993'),wood:mat('#c59966'),top:mat('#dfb985'),metal:mat('#6d847b'),board:mat('#335b49'),dark:mat('#3e4b40'),paper:mat('#f7f3df'),leaf:mat('#769267'),glass:mat('#d0e8d8')};
const geos=new Map();const sharedSphere=new THREE.SphereGeometry(1,12,8);function box(w,h,d,x,y,z,m,p=scene){let key=[w,h,d].join(),g=geos.get(key);if(!g){g=new THREE.BoxGeometry(w,h,d,w>5?Math.ceil(w):1,1,d>5?Math.ceil(d):1);geos.set(key,g)}const o=new THREE.Mesh(g,m);o.position.set(x,y,z);p.add(o);return o}
function roundedBox(w,h,d,x,y,z,m,p=scene){const key='r'+[w,h,d].join();let geo=geos.get(key);if(!geo){const q=new THREE.Shape(),r=.07,hw=w/2,hd=d/2;q.moveTo(-hw+r,-hd);q.lineTo(hw-r,-hd);q.quadraticCurveTo(hw,-hd,hw,-hd+r);q.lineTo(hw,hd-r);q.quadraticCurveTo(hw,hd,hw-r,hd);q.lineTo(-hw+r,hd);q.quadraticCurveTo(-hw,hd,-hw,hd-r);q.lineTo(-hw,-hd+r);q.quadraticCurveTo(-hw,-hd,-hw+r,-hd);geo=new THREE.ExtrudeGeometry(q,{depth:h-.04,bevelEnabled:true,bevelSize:.025,bevelThickness:.02,bevelSegments:1,curveSegments:2});geo.rotateX(-Math.PI/2);geo.translate(0,-h/2+.02,0);geos.set(key,geo)}const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);p.add(o);return o}
function sphere(rx,ry,rz,x,y,z,m,p=scene){const o=new THREE.Mesh(sharedSphere,m);o.scale.set(rx,ry,rz);o.position.set(x,y,z);p.add(o);return o}
function cyl(rt,rb,h,x,y,z,m,p=scene,n=10){let o=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,n),m);o.position.set(x,y,z);p.add(o);return o}
function segment(a,b,r,m,p){const o=cyl(r,r,1,0,0,0,m,p,8);setSegment(o,a,b);return o}function setSegment(o,a,b){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),d=vb.clone().sub(va);o.position.copy(va.add(vb).multiplyScalar(.5));o.scale.y=d.length();o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize())}
// Eight columns in four paired groups. Foreground wall assemblies are cut away as the camera passes outside them.
const frontWall=new THREE.Group(),leftWall=new THREE.Group();scene.add(frontWall,leftWall);const wallGroups=[frontWall,leftWall];
const floorEdge=box(26,.35,33,0,-.23,1,M.edge),floorSurface=box(25.9,.08,32.9,0,-.015,1,M.floor);
const floorDetails=new THREE.Group();scene.add(floorDetails);
const seam=mat('#c7b89f');for(let x=-11.5;x<=11.5;x+=1)box(.018,.009,32.8,x,.032,1,seam,floorDetails);for(let z=-14;z<17;z+=3)for(let x=-11.5;x<12;x+=2)box(1,.01,.018,x+(Math.round(z)%2)*.5,.036,z,seam,floorDetails);
// Inlaid walking aisles: two uninterrupted routes between desk groups.
for(const x of [-5.5,0,5.5])box(.95,.014,27,x,.045,1,mat('#e1d3b8'),floorDetails);
box(24,5,.22,0,2.5,-15.4,M.wall,frontWall);box(24,1,.26,0,.5,-15.25,M.trim,frontWall);box(24,.12,.32,0,1.04,-15.2,M.paper,frontWall);
box(.22,5,31,-12,2.5,0,M.wall,leftWall);box(.26,1,31,-11.85,.5,0,M.trim,leftWall);box(.32,.12,31,-11.8,1.04,0,M.paper,leftWall);
const originalBoard=new THREE.Group();frontWall.add(originalBoard);
box(10,2.6,.22,0,3.15,-15.18,M.wood,originalBoard);box(9.7,2.32,.08,0,3.15,-15.02,M.board,originalBoard);box(10.2,.12,.38,0,1.78,-14.89,M.wood,originalBoard);
const boardDecor=new THREE.Group();frontWall.add(boardDecor);
for(let i=0;i<4;i++)box(2.4-i*.25,.025,.02,-2.2,3.6-i*.28,-14.96,mat('#a7bfa9'),boardDecor);for(let x=1.2;x<3.1;x+=.4)box(.23,.035,.02,x,3.18+Math.sin(x*6)*.32,-14.96,mat('#e1d6ac'),boardDecor);
box(.45,.1,.16,3.7,1.9,-14.85,M.paper,originalBoard);
const lectern=new THREE.Group();scene.add(lectern);
box(7,.16,2.2,0,.08,-13.65,mat('#c2ae8b'),lectern);box(3.2,.17,1.35,0,1.5,-13.65,M.top,lectern);box(2.65,1.2,1,0,.83,-13.65,M.wood,lectern);box(2.65,.13,1.05,0,.29,-13.65,M.metal,lectern);box(.6,.035,.44,-.75,1.61,-13.65,M.paper,lectern);box(.6,.065,.43,.25,1.64,-13.65,mat('#718d88'),lectern);
for(let z of [-10,-3,4,11]){box(.06,2.6,4.5,-11.82,3.05,z,M.glass,leftWall);for(let zz of [z-2.3,z,z+2.3])box(.18,2.8,.1,-11.69,3.05,zz,M.paper,leftWall);for(let y of [1.66,3.08,4.44])box(.18,.1,4.7,-11.69,y,z,M.paper,leftWall);box(.45,.14,4.9,-11.6,1.6,z,M.wood,leftWall);box(.2,.3,5,-11.77,4.55,z,mat('#c8c8b0'),leftWall);}
// Quiet sunlit window patches remain as light accents; no cast or contact shadows.
for(const z of [-10,-3,4,11]){const patch=new THREE.Shape();patch.moveTo(-11.7,z-1.8);patch.lineTo(-7.1,z-.9);patch.lineTo(-7.1,z+2.3);patch.lineTo(-11.7,z+1.4);const geometry=new THREE.ShapeGeometry(patch);geometry.rotateX(-Math.PI/2);const lightPatch=new THREE.Mesh(geometry,mat('#e2cfaa'));lightPatch.position.y=.047;scene.add(lightPatch);}
// Bookshelves and plants anchor the front corners without intruding into the aisles.
box(3.5,1.2,.95,8.1,.6,-14.7,M.trim,frontWall);for(let x of [6.9,8.1,9.3])box(.065,1.05,.84,x,.6,-14.62,M.wood,frontWall);for(let i=0;i<13;i++)box(.15,.58+Math.sin(i)*.08,.42,6.6+i*.23,.58,-14.5,mat(['#ac795b','#d5be87','#7b9890'][i%3]),frontWall);
const clock=cyl(.43,.43,.08,8.1,3.55,-15.15,M.paper,frontWall);clock.rotation.x=Math.PI/2;box(.025,.24,.035,8.1,3.63,-15.07,M.dark,frontWall);box(.19,.025,.035,8.18,3.55,-15.06,M.dark,frontWall);
for(const [x,z] of [[-10.5,-13.6],[10.5,-13.6]]){cyl(.34,.24,.6,x,.3,z,mat('#ba8766'),frontWall);for(let i=0;i<6;i++){let a=i*2.4;segment([x,.55,z],[x+Math.cos(a)*.32,1.3+i*.12,z+Math.sin(a)*.28],.03,M.leaf,frontWall);let leaf=sphere(.22,.42,.12,x+Math.cos(a)*.32,1.3+i*.12,z+Math.sin(a)*.28,M.leaf,frontWall);leaf.rotation.z=Math.cos(a)*.5}}
for(const group of wallGroups)group.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=1}});
function updateArchitecture(){frontWall.visible=camera.position.z>-13.4;leftWall.visible=camera.position.x>-10.2;}
// Approved toy-style geometry, shared posed meshes; teacher faces the room.
const teacher=new THREE.Group();teacher.position.set(2.65,.12,-13.45);teacher.rotation.y=0;scene.add(teacher);
let teacherAvatar;function animateTeacher(now){if(!renderer.isSoftware)teacher.rotation.y=Math.sin(now*.0006)*.025;}
const COLUMNS=8, MAX_ROWS=16;
const COLUMN_X=[9.4,7.1,3.9,1.6,-1.6,-3.9,-7.1,-9.4];
const sampleNames=Array.from({length:64},(_,i)=>'示例学生'+String(i+1).padStart(2,'0'));
const sequentialSeats=names=>names.map((name,i)=>({name,row:Math.floor(i/COLUMNS)+1,col:i%COLUMNS+1}));
let localStore;try{localStore=localStorage}catch{}
function storageNotice(message){const el=$('#storage-notice');el.textContent=message;el.hidden=!message;}
const classStore=createClassStore({storage:localStore,sampleSeats:sequentialSeats(sampleNames),onWarning:storageNotice});
let seats=classStore.current.seats,isSample=classStore.current.sample;
let names=seats.map(s=>s.name),people=[],stations=[];
const roomPeople=new THREE.Group();scene.add(roomPeople);
const boardTimer=createBoardCountdown();frontWall.add(boardTimer.group);
let boardMode=false,boardReturning=false,boardSaved=null;
const boardFrustum=new THREE.Frustum(),boardProjection=new THREE.Matrix4(),boardBounds=new THREE.Box3();
const fadingMaterials=new Map();let boardFadeView=null,boardFade=1,boardFadeExit=null,fadedTeacherChildren=-1;
function fadeBoardObjects(alpha){
 if(alpha===boardFade&&fadedTeacherChildren===teacher.children.length)return;fadedTeacherChildren=teacher.children.length;
 for(const group of [teacher,lectern])group.traverse(mesh=>{if(!mesh.isMesh)return;let entry=fadingMaterials.get(mesh);if(!entry){const original=mesh.material,fade=original.clone();fade.transparent=true;fade.userData.countdownFade=true;entry={original,fade};fadingMaterials.set(mesh,entry)}entry.fade.opacity=entry.original.opacity*alpha;mesh.material=alpha<1?entry.fade:entry.original});
 if(alpha!==boardFade){boardFade=alpha;sceneRevision++}
}
function updateBoardVisibility(){
 if(boardMode){camera.updateMatrixWorld();boardFrustum.setFromProjectionMatrix(boardProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));const visible=(boardSaved?.peopleVisible??true)&&boardFrustum.intersectsBox(boardBounds);if(roomPeople.visible!==visible){roomPeople.visible=visible;sceneRevision++}}
 if(boardFadeView){const distance=camera.position.distanceTo(boardFadeView),x=THREE.MathUtils.clamp(distance/3,0,1);let alpha=x*x*(3-2*x);if(boardMode&&tween?.boardRefit){alpha=Math.min(tween.startFade,alpha)}else if(boardMode&&tween?.boardFlight){const phase=(performance.now()-tween.time)/tween.duration;alpha=phase<.68?tween.startFade:alpha*tween.startFade}else if(!boardMode&&boardFadeExit){const r=THREE.MathUtils.clamp(camera.position.distanceTo(boardFadeExit.position)/Math.max(.001,boardFadeExit.distance??3),0,1);alpha=THREE.MathUtils.lerp(boardFadeExit.alpha,1,r*r*(3-2*r))}fadeBoardObjects(alpha);if(!boardMode&&alpha===1)boardFadeView=null}
}
// Pick history belongs only to this open document, never to saved class data.
// A class rename or preference change keeps it; a changed roster starts empty.
const sessionProgress=new Map();
function sessionUsedFor(item){
 const roster=JSON.stringify(item.seats);let entry=sessionProgress.get(item.id);
 if(!entry||entry.roster!==roster){entry={roster,used:new Set()};sessionProgress.set(item.id,entry)}
 return entry.used;
}
let chosen=-1,used=sessionUsedFor(classStore.current),busy=false,tween=null;
let drawGeneration=0,revealTimer=null;
let noRepeat=classStore.current.noRepeat;
const repeatModeButtons=[...document.querySelectorAll('[data-no-repeat]')];
function updateRepeatButtons(){for(const button of repeatModeButtons)button.setAttribute('aria-pressed',String((button.dataset.noRepeat==='true')===noRepeat))}
updateRepeatButtons();
let drawStart=null,drawOriginTheme=null,pendingPick=null,drawCandidates=[],flashOrder=[],flashCount=0,candidate=-1;
const drawSeconds=1;let drawDurationMs=1000;
let lastFlashSlot=-1,drawTimeline=[];
const sounds=createClassroomSounds();
function updateSoundButton(){const button=$('#sound-toggle');button.textContent=sounds.enabled?'♪ 音效开':'♪ 静音';button.setAttribute('aria-pressed',String(sounds.enabled));button.setAttribute('aria-label',sounds.enabled?'关闭音效和姓名播报':'开启音效和姓名播报')}
$('#sound-toggle').onclick=()=>{sounds.setEnabled(!sounds.enabled);updateSoundButton()};updateSoundButton();

const selectionPointer=new THREE.Mesh(new THREE.ConeGeometry(.15,.32,4),mat('#d89c36'));
selectionPointer.rotation.z=Math.PI;selectionPointer.visible=false;scene.add(selectionPointer);
const detailMaterials={spine:mat('#d4c9ab'),pencil:mat('#b77e56'),books:['#829b91','#b69073','#a9a275'].map(mat)};

function makeStudent(i,seat,x,z){
 const g=new THREE.Group();g.position.set(x,0,z+.43);roomPeople.add(g);
 const kind=studentModelKind(seat,i),avatar=avatarLibrary.create(kind);
 avatar.group.scale.setScalar(STUDENT_SCALE);g.add(avatar.group);
 const materials=avatar.group.children.map(mesh=>{mesh.material=mesh.material.clone();return mesh.material});
 const label=document.createElement('div');label.className='seat-label';label.textContent=seat.name;
 $('#labels').append(label);
 const p={g,avatar,kind,label,materials,shirt:materials[0],x,z:z+.43,i,row:seat.row,col:seat.col,pose:0,target:0,highlight:false};
 pose(p,0);return p;
}
function pose(p,value,now=performance.now()){
 p.poseTime=now;p.pose=value;p.avatar.setPose(value);p.g.position.z=p.z-value*.15;p.g.rotation.y=Math.PI;
 if(p.chair)p.chair.position.z=value*.5;
 sceneRevision++;
}
function setPoseTarget(p,target,now=performance.now()){
 if(p.target===target)return;
 if(p.pose!==p.target)pose(p,THREE.MathUtils.damp(p.pose,p.target,6.5,Math.max(0,now-p.poseTime)/1000),now);
 p.target=target;p.poseTime=now;
}
function extendRoom(rows){
 const extra=Math.max(0,rows-8)*3.05,scale=(33+extra)/33;
 floorEdge.scale.z=scale;floorEdge.position.z=1+extra/2;
 floorSurface.scale.z=scale;floorSurface.position.z=1+extra/2;
 floorDetails.scale.z=scale;floorDetails.position.z=extra/2-(scale-1);
 leftWall.scale.z=(31+extra)/31;leftWall.position.z=extra/2;
}
function makeDesks(){
 for(const p of people)p.materials.forEach(m=>m.dispose());
 for(const s of stations)s.top.material.dispose();
 roomPeople.clear();$('#labels').replaceChildren();people=[];stations=[];lastDetail=-1;lastLabel=-1;lastLabelRevision=-1;
 const rows=Math.max(8,...seats.map(s=>s.row)),bySeat=new Map(seats.map((s,i)=>[`${s.row}:${s.col}`,i]));
 extendRoom(rows);
 for(let row=1;row<=rows;row++)for(let col=1;col<=COLUMNS;col++){
  const x=COLUMN_X[col-1],z=-10.3+(row-1)*3.05,index=(row-1)*COLUMNS+col-1;
  const top=roundedBox(1.72,.13,1.08,x,.85,z-.48,M.top.clone(),roomPeople);
  box(1.43,.15,.7,x,.66,z-.48,M.wood,roomPeople);
  for(const xx of [-.66,.66])for(const zz of [-.8,-.16])box(.065,.71,.065,x+xx,.375,z+zz,M.metal,roomPeople);
  const chair=new THREE.Group();chair.scale.y=.56;roomPeople.add(chair);
  roundedBox(.8,.1,.76,x,.76,z+.56,M.wood,chair);box(.8,.48,.1,x,1.1,z+.94,M.wood,chair);
  for(const xx of [-.32,.32])for(const zz of [.3,.88])box(.055,.76,.055,x+xx,.38,z+zz,M.metal,chair);
  const station={row,col,x,z,top,chair};stations.push(station);
  const i=bySeat.get(`${row}:${col}`);if(i===undefined)continue;
  const paper=box(.55,.02,.39,x-.24,.93,z-.43,M.paper,roomPeople);paper.rotation.y=(index%3-1)*.12;
  box(.013,.026,.35,x-.24,.947,z-.43,detailMaterials.spine,roomPeople);
  box(.36,.055,.31,x+.42,.945,z-.66,detailMaterials.books[index%3],roomPeople);
  box(.32,.023,.27,x+.42,.986,z-.66,M.paper,roomPeople);
  box(.035,.025,.37,x+.3,.95,z-.44,detailMaterials.pencil,roomPeople);
  const p=makeStudent(i,seats[i],x,z);p.chair=chair;p.desk=top;people.push(p);
 }
 // Sorted seat data ensures stable index-based random sampling, even with holes.
 people.sort((a,b)=>a.i-b.i);
 boardBounds.makeEmpty();for(const station of stations){boardBounds.expandByPoint(new THREE.Vector3(station.x-1.2,0,station.z-1.6));boardBounds.expandByPoint(new THREE.Vector3(station.x+1.2,5,station.z+1.6))}
 $('#scene-note').textContent=`${names.length} 位同学 · 8 列 / ${rows} 排 · ${classStore.current.name}`;
 updatePickedLabels();spaceCards.setNames(names);spaceCards.reset();spaceCards.setCountdown(boardMode?lastBoardState:null);paperCards.setNames(names);paperCards.reset();paperCards.setCountdown(boardMode?lastBoardState:null);sceneRevision++;
}
function dimensions(){return [viewport.clientWidth,viewport.clientHeight]}
function classTarget(){const zs=stations.map(p=>p.z);return new THREE.Vector3(0,-.6,(Math.min(...zs)+Math.max(...zs))/2)}
function fittedPosition(direction=new THREE.Vector3(1.5,1.15,-.75)){
 const target=classTarget(),dir=direction.clone().normalize(),probe=camera.clone();probe.aspect=camera.aspect;probe.updateProjectionMatrix();
 const samples=[new THREE.Vector3(2.65,3.3,-13.45)];
 for(const p of stations){for(const x of [-.9,.9])for(const z of [-1.1,.9])samples.push(new THREE.Vector3(p.x+x,.1,p.z+z));samples.push(new THREE.Vector3(p.x,3.1,p.z+.43))}
 let low=6,high=210;
 for(let i=0;i<18;i++){
  const distance=(low+high)/2;probe.position.copy(target).addScaledVector(dir,distance);probe.lookAt(target);probe.updateMatrixWorld();
  const fits=samples.every(point=>{const q=point.clone().project(probe);return q.z>0&&Math.abs(q.x)<.955&&Math.abs(q.y)<.935});
  if(fits)high=distance;else low=distance;
 }
 return target.clone().addScaledVector(dir,high);
}
function home(immediate=false){
 if(boardMode||!stations.length)return;if(boardReturning)finishBoardReturn();const pos=fittedPosition(),target=classTarget();
 if(immediate){camera.position.copy(pos);controls.target.copy(target);tween=null;sceneRevision++}else go(pos,target);
}
function moveCamera(pos,target,onDone){if(!boardMode&&boardFadeExit){boardFadeExit={position:camera.position.clone(),alpha:boardFade,distance:Math.min(3,camera.position.distanceTo(pos))};if(boardFadeExit.distance<.001){fadeBoardObjects(1);boardFadeView=null}}tween={time:performance.now(),a:camera.position.clone(),b:pos.clone(),c:controls.target.clone(),d:target.clone(),onDone}}
// Couple the camera to a moving point of interest. A positive orbit radius keeps
// the turn clear of target crossings, including a student's nearly 180-degree view.
function boardFocusPath(){
 tween.qa=camera.quaternion.clone();tween.near=camera.position.distanceTo(controls.target);tween.far=tween.b.distanceTo(tween.d);
 tween.c.set(0,0,-1).applyQuaternion(camera.quaternion).multiplyScalar(tween.near).add(camera.position);
 const offset=camera.position.clone().sub(tween.c),spherical=new THREE.Spherical().setFromVector3(offset);
 tween.polar=spherical.phi;tween.azimuth=spherical.theta;
}
function moveToBoard(pos,target){
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 if(reduced){camera.position.copy(pos);controls.target.copy(target);camera.lookAt(target);tween=null;sceneRevision++;return}
 moveCamera(pos,target);tween.boardFlight=true;tween.startFade=boardFade;tween.duration=1500;boardFocusPath();
 tween.approachRadius=Math.max(tween.far,Math.min(tween.near,tween.far+3.5));
}
function finishBoardReturn(){boardReturning=false;controls.enabled=true;if(boardSaved){controls.maxPolarAngle=boardSaved.maxPolar;controls.enableDamping=boardSaved.damping}boardSaved=null}
function go(pos,target){if(boardMode)return;if(boardReturning)finishBoardReturn();moveCamera(pos,target)}
function boardCamera(){const target=new THREE.Vector3(0,3.15,-14.98),halfFov=Math.tan(camera.fov*Math.PI/360);const size=boardTimer.fit(camera.aspect),fittedDistance=(size.height/2+.06)/halfFov,distance=Math.min(3,fittedDistance);boardTimer.group.scale.setScalar((distance-.24)/(fittedDistance-.24));return {target,pos:target.clone().add(new THREE.Vector3(0,0,distance))}}
function setBoardMode(active){
 if(active===boardMode)return;
 spaceCards.setCountdown(active?lastBoardState:null);paperCards.setCountdown(active?lastBoardState:null);
 if(active){
  if(!boardReturning){
   const damping=controls.enableDamping,orientation=camera.quaternion.clone();
   boardSaved={position:camera.position.clone(),target:controls.target.clone(),maxPolar:controls.maxPolarAngle,damping,peopleVisible:roomPeople.visible,teacherVisible:teacher.visible,lecternVisible:lectern.visible};
   // Drain pending orbit/pan motion without letting its undamped update or polar
   // clamp move the visible starting pose when the timer takes over a draw.
   controls.enableDamping=false;controls.update();camera.position.copy(boardSaved.position);controls.target.copy(boardSaved.target);camera.quaternion.copy(orientation);camera.updateMatrixWorld();
  }
  boardMode=true;boardReturning=false;controls.enabled=false;controls.enableDamping=false;controls.maxPolarAngle=Math.PI;boardTimer.group.visible=true;boardDecor.visible=false;originalBoard.visible=false;roomPeople.visible=boardSaved?.peopleVisible??true;teacher.visible=boardSaved?.teacherVisible??true;lectern.visible=boardSaved?.lecternVisible??true;
  const view=boardCamera();boardFadeView=view.pos.clone();moveToBoard(view.pos,view.target);updateBoardVisibility();
 }else{
  boardFadeExit={position:camera.position.clone(),alpha:boardFade};
  boardMode=false;boardReturning=true;boardTimer.group.visible=false;boardDecor.visible=true;originalBoard.visible=true;roomPeople.visible=boardSaved?.peopleVisible??true;teacher.visible=boardSaved?.teacherVisible??true;lectern.visible=boardSaved?.lecternVisible??true;
  if(boardSaved?.initial&&stations.length){const [w,h]=dimensions();camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();boardSaved.position.copy(fittedPosition());boardSaved.target.copy(classTarget())}
  if(boardSaved)moveCamera(boardSaved.position,boardSaved.target,finishBoardReturn);else finishBoardReturn();
 }
 sceneRevision++;
}
function updateBoardCountdown(state){lastBoardState=state;spaceCards.setCountdown(boardMode?state:null);paperCards.setCountdown(boardMode?state:null);if(boardMode&&activeTheme==='classroom'&&boardTimer.update(state))sceneRevision++}

function focus(p,immediate=false){
 if(boardMode||boardReturning)return;
 const pos=new THREE.Vector3(p.x+(viewport.clientWidth<760?.45:1.1),4.3,p.z-5.6),target=new THREE.Vector3(p.x,1.72,p.z-.15);
 if(immediate){camera.position.copy(pos);controls.target.copy(target);tween=null;sceneRevision++}else go(pos,target);
}
function randomIndex(n){if(!Number.isInteger(n)||n<1)throw Error('没有可选学生');const a=new Uint32Array(1),limit=Math.floor(4294967296/n)*n;do{crypto.getRandomValues(a)}while(a[0]>=limit);return a[0]%n}
function shuffle(items){const copy=[...items];for(let i=copy.length-1;i>0;i--){const j=randomIndex(i+1);[copy[i],copy[j]]=[copy[j],copy[i]]}return copy}
function suspenseOrder(candidates){
 const rows=new Map();for(const p of candidates){if(!rows.has(p.row))rows.set(p.row,[]);rows.get(p.row).push(p)}
 const groups=shuffle([...rows.values()].map(shuffle)),order=[];
 while(groups.some(g=>g.length))for(const group of groups)if(group.length)order.push(group.pop());
 return order;
}
function updatePickedLabels(){
 for(const p of people)p.label.classList.toggle('picked',used.has(p.i)&&chosen!==p.i);
}
function setResult(tag,text){$('#result').classList.toggle('has-name',tag.includes('请起立'));$('#result .result-tag').textContent=tag;$('#result strong').textContent=text}
function setBusy(value){busy=value;for(const id of ['pick','edit','repeat-allow','repeat-once']){const button=$('#'+id);button.disabled=value;button.setAttribute('aria-busy',String(value))}}
function setHighlight(index,selected=false){
 candidate=index;
 for(const p of people){
  const active=p.i===index;p.highlight=active;p.label.classList.toggle('active',active);p.label.classList.toggle('picked',used.has(p.i)&&!active);
  // Selection never changes avatar colors, emissive values, or scene lighting.
  p.desk.material.color.copy(active?new THREE.Color('#ffd16b'):M.top.color);
 }
 const p=people[index];selectionPointer.visible=!!p&&!selected;
 if(p){selectionPointer.position.set(p.x,2.95+p.pose*.25,p.g.position.z);selectionPointer.material.color.set(selected?'#416e42':'#d89c36')}
 viewport.classList.toggle('drawing',index>=0&&!selected);viewport.classList.toggle('has-selection',selected);
 sceneRevision++;
}
function pick(){
 if(busy)return;
 if(!people.length){openEditor({addStudent:true});return;}
 drawCandidates=people.filter(p=>!noRepeat||!used.has(p.i));
 if(!drawCandidates.length){setResult('点名提示','所有学生都已点过');return}
 window.cancelCountdown?.();if(boardMode)setBoardMode(false);
 drawGeneration++;clearTimeout(revealTimer);revealTimer=null;drawOriginTheme=activeTheme;pendingPick=drawOriginTheme==='paper'?drawCandidates[randomIndex(drawCandidates.length)]:null;flashOrder=drawOriginTheme==='paper'?[]:suspenseOrder(drawCandidates);setBusy(true);chosen=-1;setHighlight(-1);
 for(const p of people){setPoseTarget(p,0);p.avatar.setDetailed(false)}
 const drawTiming=drawTimingForTheme(activeTheme);drawDurationMs=drawTiming.total;drawStart=performance.now();spaceCards.start(drawStart,drawTiming);paperCards.start(drawStart,drawTiming);if(pendingPick)paperCards.prepare(names[pendingPick.i],drawStart,pendingPick.i,drawTiming);home();drawTimeline=selectionTimeline(drawDurationMs);sounds.begin(drawDurationMs,drawStart);flashCount=0;lastFlashSlot=-1;
 setResult(activeTheme==='paper'?'翻牌点名':activeTheme==='space'?'星际轨道 · 旋转 1 秒':`全班跳选 · ${drawSeconds} 秒`,'正在随机点名');$('#pick span').textContent='正在抽选';
}
function finishPick(){
 if(!drawCandidates.length||drawStart!==null&&performance.now()<drawStart+drawDurationMs)return;
 const token=drawGeneration,origin=drawOriginTheme;
 const p=pendingPick??drawCandidates[randomIndex(drawCandidates.length)];pendingPick=null;drawOriginTheme=null;chosen=p.i;used.add(p.i);drawStart=null;for(const q of people)if(q!==p)setPoseTarget(q,0);
 const revealedAt=performance.now();spaceCards.reveal(names[p.i],revealedAt,p.i);paperCards.reveal(names[p.i],revealedAt,p.i);sounds.result(names[p.i]);setHighlight(chosen,true);if(activeTheme==='classroom')p.avatar.setDetailed(true).then(()=>{if(token===drawGeneration)sceneRevision++});setPoseTarget(p,1);focus(p);
 setResult(`第 ${p.row} 排 · 第 ${p.col} 列 · 请起立`,names[p.i]);updatePickedLabels();
 saveProgress();drawCandidates=[];
 if(origin==='paper'){setBusy(false);updatePickLabel()}else revealTimer=setTimeout(()=>{if(token!==drawGeneration)return;setBusy(false);updatePickLabel()},1200);
}
function cancelDraw(){const interrupted=drawStart!==null;spaceCards.cancel();paperCards.cancel();drawGeneration++;clearTimeout(revealTimer);revealTimer=null;sounds.stop();drawStart=null;drawOriginTheme=null;pendingPick=null;drawCandidates=[];flashOrder=[];if(!boardMode)tween=null;if(boardReturning)finishBoardReturn();setBusy(false);updatePickLabel();if(interrupted){setHighlight(-1);setResult('点名已取消','点击开始点名')}}
function cancelTween(){if(boardMode)return;tween=null;if(boardReturning)finishBoardReturn()}
$('#pick').onclick=pick;$('#overview').onclick=()=>{window.leaveCountdownView?.();if(drawStart===null){if(activeTheme==='space')spaceCards.reset();else if(activeTheme==='paper')paperCards.reset()}home()};
controls.addEventListener('start',cancelTween);
function updatePickLabel(){$('#pick span').textContent=!names.length?'添加学生':'开始点名'}
function saveProgress(){
 if(classStore.current.noRepeat===noRepeat)return true;
 try{classStore.save({noRepeat});return true}catch(error){storageNotice(error.message);return false}
}
for(const button of repeatModeButtons){
 button.onclick=()=>{if(busy||button.disabled)return;noRepeat=button.dataset.noRepeat==='true';updateRepeatButtons();updatePickLabel();saveProgress()};
 button.onkeydown=event=>{
  if(busy||button.disabled||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
  event.preventDefault();const index=event.key==='Home'?0:event.key==='End'?repeatModeButtons.length-1:1-repeatModeButtons.indexOf(button);repeatModeButtons[index].click();repeatModeButtons[index].focus();
 };
}

let editorDirty=false,nameMode=null,nameValidationAttempted=false,pendingPanelAction=null,nameComposing=false;
const rosterEditor=createRosterEditor($('#roster'),()=>{
 hideConfirmation();editorDirty=true;$('#save').disabled=false;$('#roster-error').textContent='有未保存的座位修改';
});
function applyRoster(next,sample=false){
 const checked=next.length?validateRows(next).seats:[];
 try{classStore.save({seats:checked,sample,used:[],noRepeat})}catch(error){storageNotice(error.message);$('#roster-error').textContent=error.message;return false}
 cancelDraw();seats=checked;names=checked.map(s=>s.name);isSample=sample;sessionProgress.delete(classStore.current.id);used=sessionUsedFor(classStore.current);chosen=-1;setHighlight(-1);
 makeDesks();home();setBusy(false);updatePickLabel();setResult(`${classStore.current.name} · 已保存 ${names.length} 人`,names.length?'准备开始点名':'点击添加学生填写座位');editorDirty=false;return true;
}
function confirmationLock(locked){for(const selector of ['.roster-content','#seat-editor-bar','.class-controls','.transfer-controls','#class-name-form','.dialog-actions'])$(selector).inert=locked}
function hideConfirmation(){pendingPanelAction=null;$('#panel-confirm').hidden=true;confirmationLock(false)}
function closeEditorMenus(){for(const id of ['class-more','backup-menu'])$('#'+id).open=false}
function askInPanel(message,label,action){
 closeEditorMenus();
 confirmationLock(true);pendingPanelAction=action;$('#panel-confirm-text').textContent=message;$('#panel-confirm-ok').textContent=label;$('#panel-confirm').hidden=false;$('#panel-confirm-ok').focus();
}
function nameDirty(){return nameMode&&$('#class-name').value!==(nameMode==='rename'?classStore.current.name:'')}
function guardChanges(action){
 if(editorDirty||nameDirty()){askInPanel('还有未保存的修改。要放弃修改并继续吗？','放弃修改并继续',action);return false}
 action();return true;
}
$('#panel-confirm-cancel').onclick=hideConfirmation;
$('#panel-confirm-ok').onclick=()=>{const action=pendingPanelAction;hideConfirmation();action?.()};
function nameError(message=''){
 $('#class-name-error').textContent=message;$('#class-name-error').hidden=!message;$('#class-name').setAttribute('aria-invalid',String(Boolean(message)));
}
function validateNameDraft(){
 try{const name=classStore.validateName($('#class-name').value,nameMode==='rename'?classStore.current.id:undefined);nameError();return name}catch(error){nameError(error.message);return null}
}
function closeNameForm(){hideConfirmation();nameComposing=false;nameMode=null;nameValidationAttempted=false;nameError();$('#class-name-form').hidden=true;}

function loadEditor(){
 closeEditorMenus();
 editorDirty=false;rosterEditor.load(seats);$('#save').disabled=true;$('#roster-error').textContent='';closeNameForm();hideConfirmation();renderClasses();
}
function openEditor({addStudent=false}={}){if(!avatarLibrary)return;sounds.stop();loadEditor();$('#roster-dialog').showModal();if(addStudent){rosterEditor.select(1,1);$('#roster').querySelector('.seat-card.is-selected')?.scrollIntoView?.({block:'nearest',inline:'nearest'});$('#seat-name').focus()}else $('#class-select').focus()}
$('#edit').onclick=openEditor;
$('#save').onclick=()=>{
 try{const parsed=rosterEditor.validate();const unchanged=JSON.stringify(parsed.seats)===JSON.stringify(seats);
 if(unchanged){editorDirty=false;$('#save').disabled=true;$('#roster-error').textContent='座位没有变化';return}
 if(applyRoster(parsed.seats,false)){rosterEditor.load(seats);$('#save').disabled=true;hideConfirmation();renderClasses();$('#roster-error').textContent=`${classStore.current.name} · 已保存 ${names.length} 人${nameDirty()?'；班级名称尚未保存':''}`;}
 }catch(error){$('#roster-error').textContent=error.message}
};
function closeEditor(){guardChanges(()=>{editorDirty=false;closeNameForm();hideConfirmation();$('#roster-dialog').close()})}
$('#editor-close').onclick=closeEditor;
$('#editor-x').onclick=closeEditor;
$('#roster-dialog').addEventListener('cancel',event=>{event.preventDefault();if(pendingPanelAction)hideConfirmation();else if(['class-more','backup-menu'].some(id=>$('#'+id).open))closeEditorMenus();else closeEditor()});
$('#roster-dialog').addEventListener('click',event=>{if(!event.target.closest?.('details'))closeEditorMenus()});
$('#roster-dialog form').addEventListener('submit',event=>{event.preventDefault()});
addEventListener('beforeunload',event=>{if(editorDirty||nameDirty()){event.preventDefault();event.returnValue=''}});
function renderClasses(){
 const state=classStore.state,item=classStore.current,select=$('#class-select');select.replaceChildren();
 for(const c of state.classes){const option=document.createElement('option');option.value=c.id;option.textContent=c.name;select.append(option)}select.value=item.id;select.title=item.name;
 $('#editor-class-name').textContent=item.name;$('#edit').title='当前班级：'+item.name;
 $('#class-delete').disabled=state.classes.length===1;$('#class-delete').title=state.classes.length===1?'至少保留一个班级':'';
 try{const available=!!classStore.getTransferBackup();$('#class-backup-download').hidden=!available;$('#class-backup-restore').hidden=!available;$('#backup-menu').hidden=!available}catch{$('#class-backup-download').hidden=true;$('#class-backup-restore').hidden=true;$('#backup-menu').hidden=true}
 $('#class-undo').hidden=!state.deleted.length;$('#class-undo').title=state.deleted.length?'恢复 '+state.deleted.at(-1).name:'';
}
function restoreClass(){
 cancelDraw();const item=classStore.current;seats=item.seats;names=seats.map(s=>s.name);isSample=item.sample;used=sessionUsedFor(item);chosen=-1;candidate=-1;noRepeat=item.noRepeat;updateRepeatButtons();selectionPointer.visible=false;viewport.classList.remove('drawing','has-selection');
 if(avatarLibrary){makeDesks();home(true)}setBusy(false);updatePickLabel();setResult(item.name,names.length?'准备开始点名':'请先填写名单');renderClasses();
}
function classAction(action){
 // Do not clear editor drafts until the complete storage action succeeds.
 try{action();$('#class-more').open=false;restoreClass();loadEditor();return true}catch(error){$('#roster-error').textContent=error.message;storageNotice(error.message);renderClasses();return false}
}
function replaceClasses(next){
 classStore.replaceAll(next);
 // Also invalidate matching IDs/rosters, but only after a successful replacement.
 sessionProgress.clear();
}
$('#class-select').onchange=event=>{const id=event.target.value;renderClasses();if(id!==classStore.current.id)guardChanges(()=>classAction(()=>classStore.switch(id)))};
function editClassName(mode){
 $('#class-more').open=false;
 const open=()=>{nameValidationAttempted=false;nameError();nameMode=mode;$('#class-name-form').hidden=false;$('#class-name-label').textContent=mode==='create'?'新班级':'班级名称';$('#class-name').value=mode==='rename'?classStore.current.name:'';$('#class-name-save').textContent=mode==='create'?'创建班级':'保存名称';$('#class-name').focus()};
 if(nameDirty())askInPanel('班级名称尚未保存，要放弃并继续吗？','放弃名称并继续',open);else open();
}
$('#class-create').onclick=()=>editClassName('create');
$('#class-rename').onclick=()=>editClassName('rename');
$('#class-name-cancel').onclick=closeNameForm;
$('#class-name').addEventListener('input',()=>{hideConfirmation();if(nameValidationAttempted)validateNameDraft()});
$('#class-name').addEventListener('compositionstart',()=>{nameComposing=true});
$('#class-name').addEventListener('compositionend',()=>{nameComposing=false});
$('#class-name').addEventListener('keydown',event=>{if(event.key==='Enter'&&!nameComposing&&!event.isComposing&&event.keyCode!==229){event.preventDefault();$('#class-name-save').click()}});
$('#class-name-save').onclick=()=>{
 if(!nameMode)return;
 nameValidationAttempted=true;const name=validateNameDraft();if(name===null)return;
 if(nameMode==='create'){
  const create=()=>classAction(()=>classStore.create(name));
  if(editorDirty)askInPanel('新建班级前，要放弃当前班级未保存的座位修改吗？','放弃座位修改并新建',create);else create();
 }else if(nameMode==='rename'){
  try{classStore.rename(name);closeNameForm();renderClasses();$('#scene-note').textContent=`${names.length} 位同学 · 8 列 / ${Math.max(8,...seats.map(s=>s.row))} 排 · ${classStore.current.name}`;$('#roster-error').textContent=editorDirty?'名称已保存；座位修改尚未保存':'名称已保存'}catch(error){$('#roster-error').textContent=error.message}
 }
};
$('#class-delete').onclick=()=>askInPanel(`删除“${classStore.current.name}”？${editorDirty||nameDirty()?'未保存的修改会放弃。':''}名单和座位可用“撤销删除”恢复。`,'确认删除',()=>classAction(()=>classStore.delete()));
$('#class-undo').onclick=()=>guardChanges(()=>classAction(()=>classStore.undo()));
const MAX_EXCEL_BYTES=5*1024*1024;
const excelCodec=()=>import('./excel-transfer.js');
let transferReading=false;
function transferReady(){
 if(busy||window.isCountdownRunning?.()){$('#roster-error').textContent='请先结束点名或倒计时，再转移班级资料。';return false}
 if(editorDirty||nameDirty()){$('#roster-error').textContent='请先保存或取消未保存的座位、班级名称修改，再转移资料。';return false}
 if(transferReading){$('#roster-error').textContent='正在处理文件，请稍候。';return false}
 return true;
}
function transferError(error){$('#roster-error').textContent=error.message;renderClasses()}
function downloadExcel(bytes,kind){
 const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`sunlit-${kind}-${new Date().toISOString().replace(/[:.]/g,'-')}.xlsx`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function exportSnapshot(){
 if(rosterEditor.isComposing()||nameComposing)throw Error('请先确认输入法中的文字，再点击导出班级。');
 const state=structuredClone(classStore.state),current=state.classes.find(c=>c.id===state.activeId);
 current.seats=rosterEditor.validate().seats;
 if(editorDirty)current.sample=false;
 if(nameDirty()){
  const name=classStore.validateName($('#class-name').value,nameMode==='rename'?current.id:undefined);
  if(nameMode==='rename')current.name=name;
  else{
   if(state.classes.length>=200)throw Error('最多可导出 200 个班级。');
   let id='export-draft-class';while(state.classes.some(c=>c.id===id))id+='-new';
   state.classes.push({id,name,seats:[],used:[],noRepeat:true,sample:false});
  }
 }
 return state;
}
async function exportData(backup=false){
 $('#backup-menu').open=false;
 if(transferReading){$('#roster-error').textContent='正在处理文件，请稍候。';return}
 if(pendingPanelAction)return;
 transferReading=true;
 try{
  // Capture once before loading the codec: later edits remain independent drafts.
  const state=backup?classStore.getTransferBackup():exportSnapshot(),hasDraft=editorDirty||nameDirty();
  if(!state)throw Error('没有导入前备份。');
  const bytes=await (await excelCodec()).writeExcel(state);downloadExcel(bytes,backup?'backup':'classes');
  $('#roster-error').textContent=backup?'已请求下载备份 Excel，请确认保存。':hasDraft?'已请求导出班级；当前编辑仍未保存到本机。':'已请求导出班级，请确认文件已保存。';
 }catch(error){transferError(error)}finally{transferReading=false}
}
$('#class-export').onclick=()=>exportData();
$('#class-backup-download').onclick=()=>exportData(true);
$('#class-import').onclick=()=>{if(transferReady()){$('#class-transfer-file').value='';$('#class-transfer-file').click()}};
$('#class-transfer-file').onchange=async event=>{
 const file=event.target.files?.[0];event.target.value='';if(!file||!transferReady())return;
 const legacy=/\.json$/i.test(file.name),excel=/\.xlsx$/i.test(file.name);
 if(!legacy&&!excel){transferError(Error('请选择 .xlsx 文件；旧版 JSON 资料包也可导入。旧 .xls 请先用 Excel 另存为 .xlsx。'));return}
 if(file.size>(legacy?MAX_TRANSFER_BYTES:MAX_EXCEL_BYTES)){transferError(Error(legacy?'JSON 资料包不能超过 2 MB。':'Excel 文件不能超过 5 MB。'));return}
 transferReading=true;let incoming;
 try{incoming=legacy?parsePackage(await file.text()):await (await excelCodec()).readExcel(await file.arrayBuffer())}catch(error){transferError(error);return}finally{transferReading=false}
 // Reading a file is asynchronous: drafts or activity may have changed meanwhile.
 if(!$('#roster-dialog').open||!transferReady())return;
 askInPanel(`文件包含 ${summarizePackage(incoming)}。将替换本机现有的 ${summarizePackage(classStore.state)}（包括可撤销删除的班级），不是合并。所有班级点名进度将清零；音效等本机设置不变。确认后先自动保存一份本地备份，再导入。`, '备份并替换全部班级',()=>{
  if(!transferReady())return;
  if(classAction(()=>replaceClasses(incoming)))$('#roster-error').textContent='导入完成。已保留导入前本地备份，可下载或恢复；请勿清除本机数据。';
 });
};
$('#class-backup-restore').onclick=()=>{
 $('#backup-menu').open=false;
 if(!transferReady())return;
 try{const backup=classStore.getTransferBackup();if(!backup)throw Error('没有导入前备份。');askInPanel(`将用导入前备份（${summarizePackage(backup)}）替换本机全部班级。所有班级点名进度将清零，当前资料会成为新的备份。`, '确认恢复全部班级',()=>{if(transferReady()&&classAction(()=>replaceClasses(backup)))$('#roster-error').textContent='已恢复备份；恢复前资料已保留为新的本地备份。'})}catch(error){transferError(error)}
};

renderClasses();
addEventListener('keydown',event=>{if(event.code==='Space'&&document.body.dataset.view!=='board'&&!$('#roster-dialog').open&&event.target===document.body){event.preventDefault();pick()}});
const labelRay=new THREE.Raycaster(),point=new THREE.Vector3(),direction=new THREE.Vector3();
function studentVisible(p){
 point.set(p.x,1.82+p.pose*(.56+STUDENT_STAND_RISE),p.g.position.z);direction.copy(point).sub(camera.position);labelRay.set(camera.position,direction.normalize());labelRay.far=camera.position.distanceTo(point)+.3;
 const hit=labelRay.intersectObjects(roomPeople.children,true).find(h=>{let o=h.object;while(o){if(!o.visible)return false;o=o.parent}return true});
 if(!hit)return false;for(let o=hit.object;o;o=o.parent)if(o===p.g)return true;return false;
}
function showFullscreenHelp(){const el=$('#screen-help');el.hidden=false;el.textContent='无法自动全屏？请按 F11，或使用浏览器菜单中的“全屏”';setTimeout(()=>el.hidden=true,6500)}
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement?.requestFullscreen)await document.documentElement.requestFullscreen();else showFullscreenHelp()}catch{showFullscreenHelp()}};
document.addEventListener?.('fullscreenchange',()=>{$('#fullscreen').textContent=document.fullscreenElement?'⛶ 退出全屏':'⛶ 全屏';scheduleResize()});
let viewInitialized=false;
let viewportWidth=0,viewportHeight=0,resizePending=false;
function resize(){
 if(document.hidden){resizePending=true;return}
 const [w,h]=dimensions();if(w<1||h<1)return;
 const changed=w!==viewportWidth||h!==viewportHeight;
 if(!changed&&viewInitialized)return;
 viewportWidth=w;viewportHeight=h;applyRenderQuality();camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);spaceCards.resize(w,h);paperCards.resize(w,h);sceneRevision++;
 if(!viewInitialized&&stations.length){if(boardMode&&boardSaved){boardSaved.position.copy(fittedPosition());boardSaved.target.copy(classTarget());boardSaved.initial=true}else home(true);viewInitialized=true}
 if(boardMode){
  const view=boardCamera();boardFadeView=view.pos.clone();
  // Fullscreen/layout changes refit the existing view, never replay the entry tour.
  if(tween&&(tween.boardFlight||tween.boardRefit)&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
   const remaining=Math.max(120,Math.min(350,(tween.duration||1500)-(performance.now()-tween.time)));
   const end=camera.clone();end.position.copy(view.pos);end.lookAt(view.target);moveCamera(view.pos,view.target);tween.duration=Math.max(remaining,camera.quaternion.angleTo(end.quaternion)>Math.PI/2?700:250);tween.boardRefit=true;tween.startFade=boardFade;boardFocusPath();
  }else{camera.position.copy(view.pos);controls.target.copy(view.target);camera.lookAt(view.target);tween=null}
  updateBoardVisibility();
 }
 // Changing canvas dimensions clears its buffer. Refit and repaint in this same
 // task, before the browser can composite a cleared frame between RAF callbacks.
 controls.update();updateBoardVisibility();updateArchitecture();
 if(activeTheme==='space')spaceCards.render(performance.now());else if(activeTheme==='paper')paperCards.render(performance.now());else{renderer.render(scene,camera);updateLabel()}lastRenderKey='';
}
function scheduleResize(){resizePending=true}
addEventListener('resize',scheduleResize);
window.visualViewport?.addEventListener('resize',scheduleResize);
if(typeof ResizeObserver!=='undefined')new ResizeObserver(scheduleResize).observe(viewport);

let lastRenderKey='',lastDetail=-1,lastLabel=-1,lastLabelRevision=-1,lastDetailRevision=-1;
document.addEventListener?.('visibilitychange',()=>{renderBudgets.classroom.resetSamples();renderBudgets.space.resetSamples();renderBudgets.paper.resetSamples();if(!document.hidden){resizePending=true;lastRenderKey='';sceneRevision++}});
const labelPoint=new THREE.Vector3(),cameraSpace=new THREE.Vector3();
function updateDetail(){
 if(lastDetailRevision===sceneRevision)return;lastDetailRevision=sceneRevision;
 // Only the chosen student, or the single nearest inspected student, needs hero geometry.
 let detailed=chosen;
 if(detailed<0&&!busy){let best=25;for(const p of people){const d=(camera.position.x-p.x)**2+(camera.position.y-1.5)**2+(camera.position.z-p.z)**2;if(d<best){best=d;detailed=p.i}}}
 if(lastDetail===detailed)return;
 if(people[lastDetail])people[lastDetail].avatar.setDetailed(false);
 lastDetail=detailed;if(people[detailed])people[detailed].avatar.setDetailed(true).then(()=>sceneRevision++);
 sceneRevision++;
}
function updateLabel(){
 if(lastLabelRevision===sceneRevision)return;lastLabelRevision=sceneRevision;
 const i=chosen>=0?chosen:candidate;
 if(lastLabel!==i){if(people[lastLabel])people[lastLabel].label.style.display='none';lastLabel=i}
 const p=people[i];if(!p)return;
 const [w,h]=dimensions();labelPoint.set(p.x,2.48+p.pose*(.3+STUDENT_STAND_RISE),p.g.position.z);cameraSpace.copy(labelPoint).applyMatrix4(camera.matrixWorldInverse);labelPoint.project(camera);
 const fontPx=THREE.MathUtils.clamp(h*.25/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.max(-cameraSpace.z,.1)),4,32);
 Object.assign(p.label.style,{fontSize:fontPx+'px',left:(labelPoint.x*.5+.5)*w+'px',top:(-labelPoint.y*.5+.5)*h+'px',display:fontPx>=5&&labelPoint.z<1&&labelPoint.z>-1&&Math.abs(labelPoint.x)<.96&&Math.abs(labelPoint.y)<.94&&studentVisible(p)?'block':'none'});
}
function updateTween(now){
 if(!tween)return;
 const t=Math.min(1,(now-tween.time)/(tween.duration||1050)),e=t*t*(3-2*t);
 if(tween.boardFlight||tween.boardRefit){
  let focus=e,radius=THREE.MathUtils.lerp(tween.near,tween.far,e);
  if(tween.boardFlight){
   // First approach with the classroom/board in view, then enlarge straight ahead.
   // Only radius keeps moving at the join; its shared tangent prevents a pause.
   const cut=.68,u=t<cut?t/cut:(t-cut)/(1-cut),u2=u*u,u3=u2*u;
   const a=t<cut?tween.near:tween.approachRadius,b=t<cut?tween.approachRadius:tween.far;
   const tangent=(tween.far-tween.approachRadius)*1.5,m0=t<cut?0:tangent*(1-cut),m1=t<cut?tangent*cut:0;
   radius=a*(2*u3-3*u2+1)+m0*(u3-2*u2+u)+b*(-2*u3+3*u2)+m1*(u3-u2);
   const r=Math.min(1,t/cut);focus=r*r*r*(r*(r*6-15)+10);
  }
  controls.target.lerpVectors(tween.c,tween.d,focus);
  camera.position.setFromSphericalCoords(radius,THREE.MathUtils.lerp(tween.polar,Math.PI/2,focus),tween.azimuth*(1-focus)).add(controls.target);
  camera.lookAt(controls.target);
 }else{camera.position.lerpVectors(tween.a,tween.b,e);controls.target.lerpVectors(tween.c,tween.d,e)}
 sceneRevision++;if(t===1){camera.position.copy(tween.b);controls.target.copy(tween.d);const done=tween.onDone;tween=null;done?.()}
}
function syncClassroomMotion(now){
 let poseMoving=false;
 for(const p of people){if(Math.abs(p.pose-p.target)>.001){pose(p,THREE.MathUtils.damp(p.pose,p.target,6.5,Math.max(0,now-p.poseTime)/1000),now);poseMoving=true}else if(p.pose!==p.target)pose(p,p.target,now)}
 updateTween(now);controls.update();return poseMoving;
}
function animate(now){
 requestAnimationFrame(animate);if(document.hidden)return;const renderStarted=performance.now();if(resizePending){resizePending=false;resize()}applyRenderQuality();
 if(activeTheme!=='classroom'&&tween&&now>=tween.time+(tween.duration||1050))updateTween(now);
 if(boardMode)window.updatePreciseCountdown?.(now);
 if(drawStart!==null&&now>=drawStart){
  const elapsed=now-drawStart;
  if(elapsed>=drawDurationMs)finishPick();
  else if(drawOriginTheme!=='paper'){
   let slot=0;while(slot+1<drawTimeline.length&&drawTimeline[slot+1]<=elapsed)slot++;
   if(slot!==lastFlashSlot){const p=flashOrder[slot%flashOrder.length];setHighlight(p.i);setResult(`随机跳选 · 第 ${p.row} 排 第 ${p.col} 列`,names[p.i]);flashCount++;lastFlashSlot=slot;}
  }
 }
 if(activeTheme==='space'){spaceCards.render(now);renderBudgets.space.observe(now,performance.now()-renderStarted);return}
 if(activeTheme==='paper'){paperCards.render(now);renderBudgets.paper.observe(now,performance.now()-renderStarted);return}
 const poseMoving=syncClassroomMotion(now);updateBoardVisibility();updateDetail();updateArchitecture();animateTeacher(now);
 if(selectionPointer.visible&&people[candidate]){selectionPointer.position.y=2.95+people[candidate].pose*.25;selectionPointer.position.z=people[candidate].g.position.z;}
 renderer.motion=now<motionUntil||!!tween||poseMoving;
 const renderKey=sceneRevision+':'+renderer.motion+':'+(renderer.isSoftware?'':Math.floor(now/180));
 if(!renderer.isSoftware||renderKey!==lastRenderKey){renderer.render(scene,camera);lastRenderKey=renderKey;updateLabel();renderBudgets.classroom.observe(now,performance.now()-renderStarted)}else renderBudgets.classroom.resetSamples();
}

function setTheme(theme){
 if(!['classroom','space','paper'].includes(theme)||theme===activeTheme)return;
 activeTheme=theme;spaceCards.setActive?.(theme==='space');paperCards.setActive(theme==='paper');try{localStorage.setItem('sunlit-orbit-preview-theme',theme)}catch{}
 // Paint the destination before revealing it; changing a theme never changes a draw or timer.
 renderBudgets.classroom.resetSamples();renderBudgets.space.resetSamples();renderBudgets.paper.resetSamples();applyRenderQuality();
 const [w,h]=dimensions();spaceCards.resize(w,h);paperCards.resize(w,h);
 if(theme==='space'){spaceCards.setCountdown(boardMode?lastBoardState:null);spaceCards.render(performance.now())}
 else if(theme==='paper'){paperCards.setCountdown(boardMode?lastBoardState:null);paperCards.render(performance.now())}
 else{syncClassroomMotion(performance.now());if(boardMode&&lastBoardState)boardTimer.update(lastBoardState);viewportWidth=0;resize();updateBoardVisibility();updateArchitecture();renderer.render(scene,camera);lastRenderKey=''}
 updateThemeControls();
}
const themeChoices=[...document.querySelectorAll('[data-theme-choice]')];
for(const button of themeChoices){button.onclick=()=>setTheme(button.dataset.themeChoice);button.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;event.preventDefault();let i=themeChoices.indexOf(button);i=event.key==='Home'?0:event.key==='End'?themeChoices.length-1:(i+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1)+themeChoices.length)%themeChoices.length;themeChoices[i].click();themeChoices[i].focus()}}
window.classroom={setTheme,spaceCards,paperCards,renderBudget:()=>({classroom:renderBudgets.classroom.debug(),space:renderBudgets.space.debug(),paper:renderBudgets.paper.debug(),pixelRatio:rendererRatio}),cancelDraw,getSoundVolume:()=>sounds.volume,lectern,setBoardMode,updateBoardCountdown,boardTimer,boardCamera,scene,camera,controls,people:()=>people,stations:()=>stations,pick,classStore,restoreClass,classAction,getState:()=>({theme:activeTheme,classId:classStore.current.id,noRepeat,names:[...names],seats:seats.map(s=>({...s})),selected:chosen,used:[...used],busy,drawSeconds,drawDurationMs,software:!!renderer.isSoftware}),focus,pose,updateArchitecture,studentVisible,home,resize,fittedPosition,classTarget,randomIndex,suspenseOrder,teacher,renderer,finishPick,applyRoster,forceSelect(i){const p=people[i];if(!p)return;cancelDraw();drawOriginTheme=activeTheme;drawCandidates=[p];pendingPick=p;finishPick()}};
window.classroom.ready=(async()=>{
 try{avatarLibrary=await loadAvatarLibrary({software:!!renderer.isSoftware});teacherAvatar=avatarLibrary.create('teacher');teacherAvatar.group.scale.setScalar(.83);teacherAvatar.setPose(1);teacher.add(teacherAvatar.group);makeDesks();resize();setBusy(false);updatePickLabel();if(!names.length)setResult(classStore.current.name,'请先填写名单');requestAnimationFrame(animate);$('#loading').remove();return true}
 catch(error){$('#loading').textContent='角色加载失败，请刷新页面重试';console.error(error);throw error}
})();
