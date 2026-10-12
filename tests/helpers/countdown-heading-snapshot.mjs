import {createHash} from 'node:crypto';
import {register} from 'node:module';
import {createCanvasRecorder} from './paper-canvas-recorder.mjs';
register('./theme-scene-loader.mjs',import.meta.url);
const THREE=await import('../../dist/vendor/three.module.js');
const {createBoardCountdown}=await import('../../dist/board-countdown.js');
const {createCountdownMeshes,countdownComposition}=await import('../../dist/space-countdown.js');
const {countdownLayout}=await import('../../dist/space-card-art.js');
const {createPaperCards}=await import('../../dist/paper-cards.js');
export const sizes=[[1366,518],[1920,806],[1024,468],[768,724],[390,456],[320,212],[320,180],[844,92]];
const states=['10:00','09:59',...'0123456789'].map(text=>({state:'running',text:text.length===1?`${text}${text}:${text}${text}`:text,hundredths:'99'})).concat({state:'finished',text:'00:00',hundredths:'00'});
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function projected(mesh,camera,w,h){mesh.updateWorldMatrix(true,false);const p=mesh.geometry.attributes.position,b={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).project(camera),x=(1+v.x)*w/2,y=(1-v.y)*h/2;b.minX=Math.min(b.minX,x);b.maxX=Math.max(b.maxX,x);b.minY=Math.min(b.minY,y);b.maxY=Math.max(b.maxY,y)}return b}
const pose=mesh=>({char:mesh.userData.char,role:mesh.userData.textRole,position:mesh.position.toArray(),scale:mesh.scale.toArray(),rotation:mesh.rotation.toArray()});
export function capture(){
 const result={},savedDpr=globalThis.devicePixelRatio,{Canvas}=createCanvasRecorder(),paper=createPaperCards(new Canvas(),{active:false});paper.setActive(true);
 try{for(const [w,h]of sizes){
  const board=createBoardCountdown(),camera=new THREE.PerspectiveCamera(34,w/h,.1,500),size=board.fit(w/h),fitted=(size.height/2+.06)/Math.tan(camera.fov*Math.PI/360),distance=Math.min(3,fitted),target=new THREE.Vector3(0,3.15,-14.98);board.group.scale.setScalar((distance-.24)/(fitted-.24));camera.position.copy(target).add(new THREE.Vector3(0,0,distance));camera.lookAt(target);camera.updateMatrixWorld();
  const p=countdownLayout(w,h),space=createCountdownMeshes(),starCamera=new THREE.PerspectiveCamera(2*Math.atan(.5/1.26)*180/Math.PI,w/h,.1,100);starCamera.projectionMatrix.elements[9]=-.02;starCamera.updateMatrixWorld();const data={board:[],space:[],paper:[]};
  for(const state of states){
   board.update(state);const boardMeshes=state.state==='finished'?board.group.children.find(g=>g.type==='Group'&&g.visible&&g.children.length===3).children:board.slots;data.board.push(boardMeshes.map(mesh=>({...pose(mesh),bounds:projected(mesh,camera,w,h)})));
   space.update(state,p.width,p.height,h*1.26,w,h);data.space.push({composition:countdownComposition(state,p.width,p.height,w,h).entries.filter(e=>e.role!=='title'),meshes:space.group.children.filter(m=>m.visible&&m.userData.textRole!=='title').map(mesh=>({...pose(mesh),bounds:projected(mesh,starCamera,w,h)}))});
   for(const dpr of [1,1.5,2]){globalThis.devicePixelRatio=dpr;paper.resize(w,h);paper.setCountdown(state);paper.render(1);const debug=paper.debug(),{title,bounds,...layout}=debug.timerLayout;data.paper.push({dpr:debug.dpr,cards:debug.timerCards,layout})}
  }
  result[`${w}x${h}`]=Object.fromEntries(Object.entries(data).map(([key,value])=>[key,hash(value)]));space.dispose();
 }}finally{paper.dispose();if(savedDpr===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=savedDpr}
 return result;
}
