import assert from 'node:assert/strict';
import {register} from 'node:module';
import {CLASS_KEY} from '../dist/classes.js';
register('./helpers/theme-scene-loader.mjs',import.meta.url);
const {setup,dist,$}=await import('./helpers/theme-environment.mjs');
// Real production handlers, Three meshes/material disposal and SoftwareRenderer CPU
// projection/raster pipeline with a recorded Canvas context. This does not substitute for browser modal/GPU verification.
const seats=Array.from({length:63},(_,i)=>({row:Math.floor(i/8)+1,col:i%8+1,name:`示例学生${i+1}`}));
const seed={version:3,activeId:'test-class',classes:[{id:'test-class',name:'测试班',seats,sample:false,noRepeat:true,used:[]},{id:'empty-class',name:'空测试班',seats:[],sample:false,noRepeat:true,used:[]},{id:'full-class',name:'满员测试班',seats:Array.from({length:128},(_,i)=>({row:Math.floor(i/8)+1,col:i%8+1,name:`满员示例${i+1}`})),sample:false,noRepeat:true,used:[]}],deleted:[]};
const env=await setup({storage:{[CLASS_KEY]:JSON.stringify(seed)}});
await import(dist+'/scene.js');const app=window.classroom;
await env.awaitReady(app.ready);env.bindRenderer(app.renderer);
// Hold the real hero-resource response while a roster replacement removes the
// requesting avatar. Resolve that original promise only after the new scene exists.
const assetFetch=globalThis.fetch;let releaseHero,heroRequested=false;
const heroGate=new Promise(resolve=>{releaseHero=resolve});
globalThis.fetch=async(...args)=>{if(String(args[0]).includes('-hero.scene.json')){heroRequested=true;await heroGate}return assetFetch(...args)};
const staleAvatar=app.people()[0].avatar;
const pendingHero=staleAvatar.setDetailed(true);assert.equal(heroRequested,true);
let disposedMaterials=0,disposedGeometry=0;
const oldPeople=app.people(),oldStations=app.stations(),sharedGeometry=new Set();
for(const p of oldPeople){for(const m of p.materials)m.addEventListener('dispose',()=>disposedMaterials++);p.avatar.group.traverse(o=>{if(o.isMesh)sharedGeometry.add(o.geometry)})}
for(const s of oldStations){s.top.material.addEventListener('dispose',()=>disposedMaterials++);sharedGeometry.add(s.top.geometry)}
for(const g of sharedGeometry)g.addEventListener('dispose',()=>disposedGeometry++);
$('edit').click();
const card=$('roster').querySelectorAll('.seat-card').find(c=>c.dataset.row==='8'&&c.dataset.col==='8');
card.click();$('seat-name').value='新同学示例';$('seat-name').dispatchEvent({type:'input'});
assert.equal($('save').disabled,false);$('save').click();
assert.match($('roster-error').textContent,/已保存 \d+ 人/);
assert.equal(app.people().length,64);assert.equal(app.getState().seats.at(-1).name,'新同学示例');
assert.equal(disposedMaterials,63*2+64,'Only per-person and per-table material instances are disposed');
assert.equal(disposedGeometry,0,'Shared baked avatars and desk geometry must survive rebuild');
assert.ok(oldPeople.every(p=>p.g.parent===null));
assert.ok(app.people().every(p=>p.g.parent!==null));
assert.ok(app.people().slice(0,63).every((p,i)=>p.avatar.group.children[0].geometry===oldPeople[i].avatar.group.children[0].geometry));
assert.equal(document.querySelectorAll('.seat-label').length,64);
const replacementPeople=app.people(),replacementFirst=replacementPeople[0];
const replacementGeometry=replacementFirst.avatar.group.children[0].geometry;
const replacementState=app.getState();
releaseHero();await env.awaitReady(pendingHero);globalThis.fetch=assetFetch;
assert.equal(staleAvatar.group.parent.parent,null,'Late detail remains on detached old avatar');
assert.equal(app.people(),replacementPeople);
assert.equal(replacementFirst.avatar.group.children[0].geometry,replacementGeometry);
assert.deepEqual(app.getState(),replacementState,'Late old detail cannot alter current roster, selection, history or busy state');
$('editor-close').click();assert.equal($('roster-dialog').open,false);
// Render the updated scene, including the returning overview camera animation.
env.skipRaster=false;
const render=app.renderer.render;
app.renderer.render=()=>{throw Error('Injected raster failure')};
await assert.rejects(env.step(16),/Injected raster failure/);
assert.equal(env.frames.size,1,'RAF is scheduled before rendering, so one thrown frame does not stop it');
app.renderer.render=render;
for(let i=0;i<4;i++){await env.step(350);assert.equal(env.frames.size,1,'Roster save must not fork or stop the RAF loop')}
assert.ok(app.renderer.stats.triangles>0);
assert.equal($('pick').disabled,false);$('pick').click();
assert.equal(app.getState().busy,true);assert.equal($('pick').getAttribute('aria-busy'),'true');
await env.step(1100);
await env.step(1300);
assert.equal(app.getState().busy,false);assert.ok(app.getState().selected>=0);
assert.equal(env.frames.size,1);
assert.deepEqual(env.assetErrors,[]);
// Boundary saves are made through the same buttons, including an already
// selected standing avatar, countdown view, an empty class, and all 128 seats.
const selectSeat=(row,col)=>$('roster').querySelectorAll('.seat-card').find(c=>Number(c.dataset.row)===row&&Number(c.dataset.col)===col).click();
const typeName=name=>{$('seat-name').value=name;$('seat-name').dispatchEvent({type:'input'})};
const save=()=>{$('save').click();assert.match($('roster-error').textContent,/已保存 \d+ 人/);assert.equal($('save').disabled,true)};
const close=()=>{$('editor-close').click();assert.equal($('roster-dialog').open,false)};
const renderKeyFrame=async()=>{await env.step(1500);assert.equal(env.frames.size,1);assert.ok(app.renderer.stats.triangles>0)};
const switchClass=id=>{$('class-select').value=id;$('class-select').dispatchEvent({type:'change'});assert.equal(app.getState().classId,id)};
assert.ok(app.people()[app.getState().selected].pose>0,'Selected avatar has begun standing');
$('edit').click();selectSeat(1,1);typeName('站立后修改示例');save();close();
assert.equal(app.getState().selected,-1);await renderKeyFrame();
await import(dist+'/countdown.js');$('timer-primary').click();
assert.equal(window.isCountdownRunning(),true);await env.step(300);
$('edit').click();selectSeat(1,1);typeName('倒计时中修改示例');save();close();await renderKeyFrame();
assert.equal(window.isCountdownRunning(),true,'Opening editor leaves the existing countdown deadline intact');
window.cancelCountdown();
$('edit').click();switchClass('empty-class');assert.equal(app.people().length,0);
selectSeat(1,1);typeName('空班新增示例');save();
assert.equal(app.people().length,1);assert.equal(app.getState().seats[0].gender,undefined);
for(const [button,gender,kind] of [['seat-gender-male','male','boy'],['seat-gender-female','female','girl']]){
 selectSeat(1,1);$(button).click();save();assert.equal(app.getState().seats[0].gender,gender);assert.equal(app.people()[0].kind,kind);
}
$('class-rename').click();$('class-name').value='已改名测试班';$('class-name').dispatchEvent({type:'input'});$('class-name-save').click();
assert.equal(app.classStore.current.name,'已改名测试班');close();await renderKeyFrame();
$('edit').click();switchClass('full-class');assert.equal(app.people().length,128);
selectSeat(16,8);typeName('最后一席示例');save();assert.equal(app.people().length,128);close();await renderKeyFrame();
$('edit').click();switchClass('empty-class');assert.equal(app.getState().names[0],'空班新增示例');
assert.equal(app.getState().seats[0].gender,'female');assert.equal(app.classStore.current.name,'已改名测试班');close();await renderKeyFrame();
assert.deepEqual(env.assetErrors,[]);
// Creating a class creates an intentionally empty roster; its name field is
// independent of seat-name input. Adding one occupied seat enables picking.
$('edit').click();$('class-create').click();$('class-name').value='5班';$('class-name').dispatchEvent({type:'input'});$('class-name-save').click();
assert.equal(app.classStore.current.name,'5班');assert.equal(app.people().length,0);assert.equal(app.stations().length,64);
assert.match($('scene-note').textContent,/0 位同学.*5班/);assert.equal($('pick').disabled,false);assert.equal($('pick').querySelector('span').textContent,'添加学生');assert.equal($('pick').getAttribute('aria-busy'),'false');
close();await renderKeyFrame();
assert.equal(app.teacher.visible,true);assert.equal($('roster-dialog').open,false);
$('timer-primary').click();assert.equal(window.isCountdownRunning(),true);await renderKeyFrame();window.cancelCountdown();
$('edit').click();selectSeat(1,1);typeName('五班示例同学');save();close();await renderKeyFrame();
assert.equal(app.people().length,1);assert.equal(app.getState().seats[0].name,'五班示例同学');
assert.match($('scene-note').textContent,/1 位同学.*5班/);assert.equal($('pick').disabled,false);assert.equal($('pick').querySelector('span').textContent,'开始点名');
assert.equal(app.classStore.current.seats.length,1);assert.equal($('pick').getAttribute('aria-busy'),'false');
// All themes route an empty class directly to the current class/first empty
// seat, without starting a draw or clearing/cross-writing another class.
for(const theme of ['classroom','space','paper']){
 app.setTheme(theme);app.applyRoster([]);const currentId=app.classStore.current.id;
 assert.equal($('pick').disabled,false);assert.equal($('pick').querySelector('span').textContent,'添加学生');
 $('pick').click();assert.equal($('roster-dialog').open,true);assert.equal(document.activeElement,$('seat-name'));
 assert.equal(app.classStore.current.id,currentId);assert.equal(app.getState().busy,false);
 typeName('新增演示同学');$('editor-close').click();assert.equal($('roster-dialog').open,true);assert.equal($('panel-confirm').hidden,false);
 $('panel-confirm-cancel').click();assert.equal($('roster-dialog').open,true);save();
 assert.equal($('roster-error').textContent,`${app.classStore.current.name} · 已保存 1 人`);
 assert.equal(app.classStore.current.id,currentId);close();
 assert.equal(app.getState().names[0],'新增演示同学');assert.equal($('pick').querySelector('span').textContent,'开始点名');
 $('pick').click();assert.equal(app.getState().busy,true);assert.equal($('pick').getAttribute('aria-busy'),'true');app.cancelDraw();
 assert.equal(app.getState().busy,false);assert.equal($('pick').getAttribute('aria-busy'),'false');
}
const {readFileSync}=await import('node:fs');const css=readFileSync(new URL('../dist/style.css',import.meta.url),'utf8');
assert.match(css,/button:disabled\{[^}]*cursor:not-allowed/);assert.match(css,/button:disabled\[aria-busy="true"\]\{cursor:default\}/);
assert.doesNotMatch(css,/button:disabled\{[^}]*cursor:wait/);
console.log('PASS roster scene lifecycle: real add/save/close/rename/switch handlers, empty/64/128 seats, unknown/male/female avatar changes, standing/countdown edits, exact material disposal/shared geometry, CPU renderer key frames, one RAF, late hero resolution isolation, recovery after one render exception. Browser/GPU not covered.');
