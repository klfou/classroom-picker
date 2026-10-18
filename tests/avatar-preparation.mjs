// Exercise the real full-detail (WebGL-path) model parser and pose baking on CPU.
import assert from 'node:assert/strict';
import {performance as cpuClock} from 'node:perf_hooks';
import {register} from 'node:module';
register('./helpers/theme-scene-loader.mjs',import.meta.url);
const {setup}=await import('./helpers/theme-environment.mjs');const env=await setup();
const {loadAvatarLibrary}=await import('../dist/avatars.js');
const library=await loadAvatarLibrary({software:false}),boy=library.create('boy'),girl=library.create('girl'),teacher=library.create('teacher');
const seated=[boy,girl].map(a=>a.group.children.map(m=>m.geometry));const teacherSize=teacher.def.cache.size;
const cacheBytes=definitions=>{const buffers=new Set();for(const d of definitions)for(const geometries of d.cache.values())for(const g of geometries){for(const a of Object.values(g.attributes))buffers.add(a.array.buffer);if(g.index)buffers.add(g.index.array.buffer)}return [...buffers].reduce((n,b)=>n+b.byteLength,0)};
const initialBytes=cacheBytes([boy.def,girl.def]);
const jobs=library.preparationSteps(Array(128).fill('boy').concat('girl','teacher'));
assert.equal(jobs.length,64,'Jobs scale with two model kinds, never student count');
const random=env.randomCalls,jobMs=[];for(const job of jobs){const start=cpuClock.now();await job();jobMs.push(cpuClock.now()-start)}console.log(JSON.stringify({baseJobMaxMs:Math.max(...jobMs.slice(0,24),...jobMs.slice(32,56)),heroPreparationSlicesMs:[...jobMs.slice(25,32),...jobMs.slice(57,64)],baseCacheBytes:cacheBytes([boy.def,girl.def])}));assert.equal(env.randomCalls,random);assert.equal(teacher.def.cache.size,teacherSize);
for(const [i,a]of [boy,girl].entries()){assert.equal(a.def.cache.size,25);assert.deepEqual(a.group.children.map(m=>m.geometry),seated[i]);await a.setDetailed(true)}
assert.equal(env.assetReads.filter(e=>e.url.includes('-hero.scene.json')).length,2);
const allGeometries=new Set();for(const a of [boy,girl]){for(const geometry of [...a.def.cache.values()].flat())allGeometries.add(geometry);for(const step of [0,24]){a.setPose(step/24);for(const mesh of a.group.children)allGeometries.add(mesh.geometry)}}
const buffers=new Set();for(const g of allGeometries){for(const attr of Object.values(g.attributes))buffers.add(attr.array.buffer);if(g.index)buffers.add(g.index.array.buffer)}
const bytes=[...buffers].reduce((n,b)=>n+b.byteLength,0);assert.ok(bytes<20*1024*1024,'Shared base poses plus hero endpoints stay within 20 MiB');
for(const job of library.preparationSteps(['boy','girl']))await job();assert.equal(env.assetReads.filter(e=>e.url.includes('-hero.scene.json')).length,2,'Repeat preparation reuses the two shared definitions');
const soft=await loadAvatarLibrary({software:true}),softBoy=soft.create('boy'),softGirl=soft.create('girl'),softInitial=cacheBytes([softBoy.def,softGirl.def]);const softJobs=soft.preparationSteps(['boy','girl']);assert.equal(softJobs.length,48);for(const job of softJobs)await job();const softBytes=cacheBytes([softBoy.def,softGirl.def]);assert.ok(softBytes<16*1024*1024);
console.log(JSON.stringify({full:{initialBytes,preparedBytes:bytes,addedBytes:bytes-initialBytes},software:{initialBytes:softInitial,preparedBytes:softBytes,addedBytes:softBytes-softInitial}}));
console.log(`PASS full-model shared base/hero preparation, 64 independent jobs, teacher untouched, original seated geometry retained, no RNG, exactly two hero reads and ${bytes} unique geometry bytes (<20 MiB).`);
