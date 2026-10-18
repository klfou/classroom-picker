import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./helpers/theme-scene-loader.mjs',import.meta.url);
const {setup,dist}=await import('./helpers/theme-environment.mjs');const env=await setup({storage:{'sunlit-theme':'space'}});
let fonts=0;document.fonts={load:async()=>{fonts++}};
await import(dist+'/scene.js');const app=window.classroom;await env.awaitReady(app.ready);env.bindRenderer(app.renderer);const random=env.randomCalls;
assert.equal(app.preparation().pending,false);for(let i=0;i<360;i++){await env.step(1000/60);await env.flush()}
assert.equal(fonts,0);assert.equal(app.paperCards.debug().resources.surfaces,0);assert.equal(app.preparation().completed,0);assert.equal(env.randomCalls,random);assert.ok(app.people().every(p=>p.avatar.def.cache.size===1));
app.pick();await env.step(400);assert.equal(app.spaceCards.debug().stage,'rotate');assert.equal(app.paperCards.debug().resources.surfaces,0);await env.step(1350);assert.ok(app.getState().selected>=0);assert.equal(app.preparation().pending,false);assert.equal(fonts,0);
console.log('PASS fresh space startup and first draw add no font task, hidden paper resources, model poses or preparation timer; original sphere and 1750ms winner remain.');
