import assert from 'node:assert/strict';
import {register} from 'node:module';
import {CLASS_KEY,BACKUP_KEY} from '../dist/classes.js';
import {makePackage} from '../dist/class-transfer.js';
import {readExcel} from '../dist/excel-transfer.js';

// Exercise the production scene, editor handlers, and XLSX transfer together.
// This uses deterministic DOM state and real Three projection, not browser/CSS
// screenshots or a replacement rendering of the application.
register('./helpers/theme-scene-loader.mjs',import.meta.url);
const {setup,dist,$}=await import('./helpers/theme-environment.mjs');
const THREE=await import('../dist/vendor/three.module.js');
const seat=(id,row,col,name,gender)=>({id,row,col,name,...(gender?{gender}:{})});
const seed={version:3,activeId:'one',classes:[
 {id:'one',name:'单排班',sample:false,noRepeat:true,used:[],seats:[seat('one-left',1,1,'第一排左','female'),seat('one-right',1,8,'第一排右','male')]},
 {id:'eight',name:'八排稀疏班',sample:false,noRepeat:false,used:[],seats:[seat('eight-front',1,3,'前排'),seat('eight-middle',4,6,'中排','female'),seat('eight-back',8,8,'后排','male')]},
 {id:'sixteen',name:'十六排班',sample:false,noRepeat:true,used:[],seats:[seat('sixteen-front-left',1,1,'前左','female'),seat('sixteen-front-right',1,8,'前右'),seat('sixteen-middle',9,3,'中间','male'),seat('sixteen-back-left',16,1,'后左'),seat('sixteen-back-right',16,8,'后右','female')]},
 {id:'empty',name:'空班',sample:false,noRepeat:false,used:[],seats:[]}
],deleted:[]};
const env=await setup({storage:{[CLASS_KEY]:JSON.stringify(seed),[BACKUP_KEY]:JSON.stringify(seed)}});
// XLSX ZIP timestamps require a modern date rather than the fixture's 1970 tick.
env.now=Date.UTC(2026,9,12);
await import(dist+'/scene.js');
const app=window.classroom;
await env.awaitReady(app.ready);env.bindRenderer(app.renderer);
const state=()=>app.getState(),cards=()=>$('roster').querySelectorAll('.seat-card');
const card=(row,col)=>cards().find(n=>Number(n.dataset.row)===row&&Number(n.dataset.col)===col);
const key=(row,col,value)=>{const node=card(row,col);node.click();node.focus();const event={type:'keydown',key:value};node.dispatchEvent(event);assert.equal(event.defaultPrevented,true);return document.activeElement};
const type=value=>{$('seat-name').value=value;$('seat-name').dispatchEvent({type:'input'})};
const switchClass=id=>{$('class-select').value=id;$('class-select').dispatchEvent({type:'change'});assert.equal(state().classId,id)};
const durable=()=>JSON.parse(localStorage.getItem(CLASS_KEY));
const classesSnapshot=()=>makePackage(app.classStore.state);

function assertTeacherGrid(expectedSeats){
 const rows=Math.max(8,...expectedSeats.map(s=>s.row));
 const coordinates=cards().map(n=>[Number(n.dataset.row),Number(n.dataset.col)]);
 assert.deepEqual(coordinates,Array.from({length:rows},(_,r)=>Array.from({length:8},(_,c)=>[rows-r,c+1])).flat(),
  'Reading/tab order is back to front, with teacher-left columns kept left to right');
 assert.deepEqual($('roster').querySelectorAll('.seat-row-label').map(n=>n.textContent),Array.from({length:rows},(_,r)=>`${rows-r}排`));
 assert.deepEqual($('roster').querySelectorAll('.seat-column-heading').map(n=>n.textContent),Array.from({length:8},(_,c)=>`${c+1}列`));
 const roster=$('roster'),board=document.querySelector('.preview-board'),scroller=roster.parentElement;
 assert.equal(board.parentElement,scroller);
 assert.ok(scroller.children.indexOf(board)>scroller.children.indexOf(roster),'Podium is after the front row in the scrollable DOM');
 assert.match(board.textContent,/讲台.*老师视角.*第\s*1\s*排最近/);
 for(const s of expectedSeats){
  assert.equal(card(s.row,s.col).querySelector('.seat-card-name').textContent,s.name);
  assert.match(card(s.row,s.col).getAttribute('aria-label'),new RegExp(`第 ${s.row} 排 · 第 ${s.col} 列`));
 }
 const occupied=new Set(expectedSeats.map(s=>`${s.row}:${s.col}`));
 for(const node of cards())assert.equal(node.classList.contains('is-empty'),!occupied.has(`${node.dataset.row}:${node.dataset.col}`));
 assert.equal(key(1,1,'ArrowUp'),card(2,1));
 assert.equal(key(2,1,'ArrowDown'),card(1,1));
 assert.equal(key(1,1,'ArrowDown'),card(1,1));
 assert.equal(key(rows,8,'ArrowUp'),card(rows,8));
 assert.equal(key(rows,8,'ArrowLeft'),card(rows,7));
 assert.equal(key(rows,7,'ArrowRight'),card(rows,8));
 assert.equal(key(rows,8,'ArrowRight'),card(rows,8));
 assert.equal(key(rows,1,'ArrowLeft'),card(rows,1));
 assert.deepEqual(state().seats,expectedSeats,'Grid display/navigation cannot rewrite stored coordinates');
}

// Actual world positions establish the orientation independently of editor text.
const teacherCamera=new THREE.PerspectiveCamera(60,16/9,.1,1000);
teacherCamera.position.set(0,2,-15);teacherCamera.lookAt(0,2,0);teacherCamera.updateMatrixWorld();
assert.equal(app.teacher.position.z,-13.45);
const original=localStorage.getItem(CLASS_KEY);
$('edit').click();
assertTeacherGrid(app.classStore.current.seats);
assert.equal(localStorage.getItem(CLASS_KEY),original,'Opening and navigating is read-only');
for(const item of seed.classes){
 switchClass(item.id);const expected=app.classStore.current.seats;assertTeacherGrid(expected);
 const stations=app.stations(),station=(r,c)=>stations.find(s=>s.row===r&&s.col===c),rows=Math.max(8,...expected.map(s=>s.row));
 for(let col=1;col<8;col++){
  const a=station(1,col),b=station(1,col+1);
  assert.ok(a.x>b.x,'Scene column 1 lies on positive world x');
  assert.ok(new THREE.Vector3(a.x,0,a.z).project(teacherCamera).x<new THREE.Vector3(b.x,0,b.z).project(teacherCamera).x,
   'Positive world x is screen-left when looking from the teacher toward +z');
 }
 for(let row=1;row<rows;row++)assert.ok(station(row,1).z<station(row+1,1).z,'Larger row numbers are farther behind the front row');
 assert.ok(station(1,1).z>app.teacher.position.z,'The first row is in front of the teacher');
 for(const p of app.people()){
  const s=expected[p.i],physical=station(s.row,s.col);
  assert.deepEqual([p.row,p.col,p.x,p.z],[s.row,s.col,physical.x,physical.z+.43]);
  assert.equal(p.label.textContent,s.name);
 }
 assert.deepEqual(app.classStore.current.seats,expected);
 assert.equal(state().noRepeat,item.noRepeat);
}

// Save and reload an actual back-left card; its ID and coordinate must survive.
switchClass('sixteen');
const beforeEdit=classesSnapshot();
card(16,1).click();type('后左已编辑');$('save').click();
assert.equal($('save').disabled,true);assert.match($('roster-error').textContent,/座位已保存/);
const saved=app.classStore.current.seats;
assert.deepEqual(saved.find(s=>s.id==='sixteen-back-left'),{row:16,col:1,name:'后左已编辑',id:'sixteen-back-left'});
assert.deepEqual(saved.map(s=>[s.id,s.row,s.col,s.gender||'']),beforeEdit.classes.find(c=>c.id==='sixteen').seats.map(s=>[s.id,s.row,s.col,s.gender||'']));
assert.equal(durable().classes.find(c=>c.id==='sixteen').noRepeat,true);
switchClass('one');switchClass('sixteen');assertTeacherGrid(saved);
assert.deepEqual(state().seats,saved);

// Cancel a dirty switch once, then discard: old drafts never leak into the next
// class and no coordinate is translated on either code path.
card(16,8).click();type('不要保存');$('class-select').value='eight';$('class-select').dispatchEvent({type:'change'});
assert.equal($('panel-confirm').hidden,false);assert.equal(state().classId,'sixteen');
$('panel-confirm-cancel').click();assert.equal($('seat-name').value,'不要保存');
$('class-select').value='eight';$('class-select').dispatchEvent({type:'change'});$('panel-confirm-ok').click();
assert.equal(state().classId,'eight');assertTeacherGrid(app.classStore.current.seats);
switchClass('sixteen');assertTeacherGrid(saved);

// Capture the real export download Blob, parse it, and feed those exact bytes
// through the production import/confirmation handlers. No external upload.
const beforeTransfer=classesSnapshot(),blobs=[];
const nativeCreate=URL.createObjectURL,nativeRevoke=URL.revokeObjectURL;
URL.createObjectURL=blob=>{blobs.push(blob);return `blob:teacher-view-qa-${blobs.length}`};
URL.revokeObjectURL=()=>{};
try{await $('class-export').onclick()}finally{URL.createObjectURL=nativeCreate;URL.revokeObjectURL=nativeRevoke}
assert.equal(blobs.length,1,$('roster-error').textContent);assert.match($('roster-error').textContent,/已请求导出班级/);
const bytes=await blobs[0].arrayBuffer();
assert.deepEqual(makePackage(await readExcel(bytes)),beforeTransfer,'Export leaves all IDs and coordinates in the existing XLSX schema');
await $('class-transfer-file').onchange({target:{files:[{name:'teacher-seat-roundtrip.xlsx',size:bytes.byteLength,arrayBuffer:async()=>bytes}],value:'teacher-seat-roundtrip.xlsx'}});
assert.equal($('panel-confirm').hidden,false);$('panel-confirm-ok').click();
assert.match($('roster-error').textContent,/导入完成/);assert.deepEqual(classesSnapshot(),beforeTransfer);
for(const item of beforeTransfer.classes){switchClass(item.id);assertTeacherGrid(app.classStore.current.seats);assert.equal(state().noRepeat,item.noRepeat)}
console.log('PASS teacher seat view: real Three left/right and row depth; production DOM back-to-front, podium-bottom, keyboard boundaries; one/eight/sixteen/sparse/empty rosters; unchanged IDs/coordinates through edit/save, guarded switching, and actual XLSX export/import.');
