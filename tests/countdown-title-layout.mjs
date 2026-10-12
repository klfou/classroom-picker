import assert from 'node:assert/strict';
import {register} from 'node:module';
const sizes=[[1366,518],[1920,806],[1024,468],[768,724],[390,456],[320,212],[320,180],[844,92]];
register('./helpers/theme-scene-loader.mjs',import.meta.url);
const {createBoardCountdown}=await import('../dist/board-countdown.js');
const {createCountdownMeshes,countdownComposition}=await import('../dist/space-countdown.js');
const {countdownLayout}=await import('../dist/space-card-art.js');
// Size changes are checked by countdown-digit-layout; this test protects title removal.
for(const [w,h]of sizes){
 const board=createBoardCountdown(),space=createCountdownMeshes(),p=countdownLayout(w,h),state={state:'running',text:'05:00',hundredths:'00'};
 assert.equal(board.group.getObjectByName('board-countdown-title'),undefined,'Classroom allocates no title group');
 assert.equal(board.fitTitle,undefined,'Removed title has no projection work');
 assert.equal(board.geometryCount(),15,'Classroom caches only twelve numeric/punctuation and three finish geometries');
 const noTitle=()=>{assert.ok(space.group.children.every(m=>m.userData.textRole!=='title'),'Space has no hidden or visible title meshes');assert.ok(countdownComposition(state,p.width,p.height,w,h).entries.every(e=>e.role!=='title'),'Canvas has no heading outlines')};
 space.update(state,p.width,p.height,h*1.26,w,h);noTitle();assert.equal(space.debug().cachedGeometries,15,'Space caches only the numeric and finish alphabet');const allocation=space.debug().cachedGeometries,meshCount=space.debug().meshes;
 for(let hundredths=0;hundredths<100;hundredths++){space.update({...state,hundredths:String(hundredths).padStart(2,'0')},p.width,p.height,h*1.26,w,h);noTitle();assert.equal(space.debug().cachedGeometries,allocation);assert.equal(space.debug().meshes,meshCount)}
 space.update({state:'finished'},p.width,p.height,h*1.26,w,h);assert.equal(space.group.children.filter(m=>m.visible).map(m=>m.userData.char).join(''),'时间到');noTitle();board.update({state:'finished',text:'00:00'});assert.ok(board.slots.every(m=>!m.visible));assert.equal(board.group.children.find(g=>g.type==='Group').children.length,3,'Classroom finish remains three characters');space.dispose();
}
console.log('PASS removed headings: 8 viewport aspects, no title draw entries or meshes, only15 cached glyphs and stable100 ticks');
