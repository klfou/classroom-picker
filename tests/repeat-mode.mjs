import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {register} from 'node:module';
import {drawTimingForTheme} from '../dist/draw-timing.js';
register('./helpers/theme-scene-loader.mjs',import.meta.url);
const {setup,dist,$}=await import('./helpers/theme-environment.mjs');
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),source=readFileSync(new URL('../dist/scene.js',import.meta.url),'utf8');
assert.doesNotMatch(html,/本轮|开始新一轮|round-info|id="(?:count|total|progress)"/);
assert.doesNotMatch(source,/开始新一轮|\$\('#(?:count|total|progress)'\)/);
assert.match(html,/id="repeat-allow" data-no-repeat="false" aria-pressed="false">允许重复<\/button>/);assert.match(html,/id="repeat-once" data-no-repeat="true" aria-pressed="true">不重复点名<\/button>/);
assert.doesNotMatch(html,/id="no-repeat"|type="checkbox"|class="switch"/);assert.doesNotMatch(source,/\$\('#[^']*no-repeat'\)/);
const env=await setup();await import(dist+'/scene.js');const app=window.classroom;await env.awaitReady(app.ready);env.bindRenderer(app.renderer);await import(dist+'/countdown.js');
for(const theme of ['classroom','space','paper'])for(const count of [1,2]){
 app.cancelDraw();window.cancelCountdown();app.setTheme(theme);assert.equal(app.applyRoster(Array.from({length:count},(_,i)=>({name:`测试${i+1}`,row:1,col:i+1}))),true);
 $('#repeat-once').click();env.randomQueue=Array(1000).fill(0);
 const pick=async()=>{app.pick();await env.step(drawTimingForTheme(theme).total);await env.flush();await env.step(1600);await env.flush();assert.equal($('#pick span').textContent,'开始点名');return app.getState().selected};
 const chosen=[];for(let i=0;i<count;i++)chosen.push(await pick());assert.equal(new Set(chosen).size,count);assert.equal(app.getState().used.length,count);
 const exhausted=app.getState(),generation=__sharedThemeQA().drawGeneration,audioStarts=env.audio.events.length;
 app.pick();assert.equal(app.getState().busy,false);assert.equal(app.getState().selected,exhausted.selected);assert.deepEqual(app.getState().used,exhausted.used,'Exhaustion keeps the full picked set');assert.equal($('#result strong').textContent,'所有学生都已点过');assert.equal(__sharedThemeQA().drawGeneration,generation);assert.equal(env.audio.events.length,audioStarts);
 await env.step(3000);assert.deepEqual(app.getState().used,exhausted.used,'No deferred automatic new cycle');
 const used=app.getState().used.slice();$('#repeat-allow').click();assert.deepEqual(app.getState().used,used,'Changing repeat mode never clears saved eligibility');
 assert.equal(await pick(),0);assert.equal(await pick(),0,'Repeat mode can immediately select the same real student');
 $('#repeat-once').click();const saved=app.getState().used.slice();app.restoreClass();assert.deepEqual(app.getState().used,saved);assert.equal($('#pick span').textContent,'开始点名');app.pick();assert.equal(app.getState().busy,false);assert.equal($('#result strong').textContent,'所有学生都已点过');
}
console.log('PASS all three themes: 1/2 students, exhausted pool stays stopped without new-round UI, repeated picks, mode switch retains session history, class restore, default pick label');
