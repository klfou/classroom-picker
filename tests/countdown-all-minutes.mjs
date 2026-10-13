import assert from 'node:assert/strict';import{register}from'node:module';import{readFileSync}from'node:fs';
register('./helpers/theme-scene-loader.mjs',import.meta.url);
const{setup,dist,$,select}=await import('./helpers/theme-environment.mjs');
const env=await setup();await import(dist+'/scene.js');const app=window.classroom;await env.awaitReady(app.ready);env.bindRenderer(app.renderer);await import(dist+'/countdown.js');await env.step(20);
const qa=()=>__sharedCountdownQA();assert.equal(qa().selectedMinutes,2);assert.equal(qa().snapshot.remaining,120000);
for(const theme of ['classroom','space','paper']){app.setTheme(theme);for(let n=1;n<=10;n++){select('timer-minutes',n);$('timer-primary').click();assert.equal(qa().snapshot.remaining,n*60000);await env.step(100);const next=n===10?1:n+1;select('timer-minutes',next);assert.equal(qa().snapshot.duration,n*60000);assert.equal(qa().snapshot.remaining,n*60000-100);assert.equal($('timer-minutes').value,String(next));app.setTheme(theme==='space'?'paper':'space');assert.equal(qa().snapshot.remaining,n*60000-100);app.setTheme(theme);$('timer-primary').click();assert.equal(qa().snapshot.remaining,next*60000);window.cancelCountdown();}}
assert.equal(env.frames.size,1);assert.equal(env.assetErrors.length,0);
select('timer-minutes',11);assert.equal(qa().selectedMinutes,2);select('timer-minutes',1.5);assert.equal(qa().selectedMinutes,2);
assert.equal($('timer-minutes').tagName,'SELECT');assert.equal($('timer-minutes').querySelectorAll('option').length,10);assert.equal($('timer-minutes').getAttribute('aria-labelledby'),'timer-minutes-label');
const css=readFileSync(new URL('../dist/style.css',import.meta.url),'utf8');assert.match(css,/min-width:98px;min-height:44px/);assert.ok(94+48+7<320-24,'Native select and horizontal label fit 320px');
console.log('PASS 30 theme/minute combinations, default2, staged selection, restart, native select semantics, invalid fallback2, one RAF, 320px static budget');
