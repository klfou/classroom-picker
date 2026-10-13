import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./helpers/theme-scene-loader.mjs',import.meta.url);
const {setup,dist,$}=await import('./helpers/theme-environment.mjs');
const THREE=await import('../dist/vendor/three.module.js');
const env=await setup();await import(dist+'/scene.js');
const app=window.classroom;await env.awaitReady(app.ready);env.bindRenderer(app.renderer);await import(dist+'/countdown.js');
const qa=()=>__sharedThemeQA(),countdown=()=>__sharedCountdownQA();
const pose=()=>({position:app.camera.position.clone(),target:app.controls.target.clone(),orientation:app.camera.quaternion.clone(),zoom:app.camera.zoom});
const close=(a,b,label)=>assert.ok(a.distanceTo(b)<1e-9,label+': '+a.distanceTo(b));
const unchanged=(before,label)=>{close(app.camera.position,before.position,label+' position');close(app.controls.target,before.target,label+' target');assert.ok(app.camera.quaternion.angleTo(before.orientation)<1e-7,label+' orientation');assert.equal(app.camera.zoom,before.zoom,label+' zoom')};
const landmarks=[new THREE.Vector3(0,3.15,-14.98),new THREE.Vector3(-4,1.5,-5),new THREE.Vector3(4,0,5)];
const pixels=()=>{app.camera.updateMatrixWorld();return landmarks.map(point=>{const q=point.clone().project(app.camera);return [q.x*env.width/2,q.y*env.viewport.height/2]})};
let samples=0,cases=0,stopCalls=0;const sounds=qa().sounds,stop=sounds.stop;sounds.stop=(...args)=>{stopCalls++;return stop(...args)};
const roster=Array.from({length:8},(_,i)=>({name:'测试'+(i+1),row:1+Math.floor(i/4),col:1+i%4}));app.applyRoster(roster);$('#repeat-allow').click();
async function clean(theme){app.cancelDraw();window.cancelCountdown();app.setTheme('classroom');app.home(true);await env.step(1600);app.setTheme(theme)}
async function startingView(kind){
 if(kind==='focus'){app.focus(app.people()[0],true);app.controls.update()}
 if(kind==='board'){$('timer-primary').click();await env.step(1600)}
 if(kind==='orbit'||kind==='pan'){
  env.pointer('pointerdown',650,200,kind==='pan'?{button:2}:{});env.pointer('pointermove',810,360,kind==='pan'?{button:2}:{});env.pointer('pointerup',810,360,kind==='pan'?{button:2}:{});
  await env.step(16);
 }
}
const classroomVolume=new THREE.Box3(new THREE.Vector3(-13,-1,-15.5),new THREE.Vector3(13,6,19));
function assertSubjectFraming(label,elapsed){
 app.camera.updateMatrixWorld();
 const forward=app.camera.getWorldDirection(new THREE.Vector3()),ray=new THREE.Ray(app.camera.position,forward);
 assert.ok(ray.intersectsBox(classroomVolume),label+' camera keeps looking into the classroom at '+elapsed);
 const focus=app.controls.target.clone().project(app.camera);
 assert.ok(Math.abs(focus.x)<1e-8&&Math.abs(focus.y)<1e-8&&focus.z>-1&&focus.z<1,label+' finite focus stays centered');
 if(elapsed>=1020){const board=app.boardCamera().target.clone().project(app.camera);assert.ok(Math.abs(board.x)<1e-8&&Math.abs(board.y)<1e-8,label+' centered board during enlargement')}
}
for(const theme of ['classroom','space','paper'])for(const kind of ['overview','focus','board','orbit','pan','queued-dolly'])for(const offset of (theme==='paper'?[0,16,50,100,250,599]:[0,16,50,100,250,900])){
 await clean(theme);await startingView(kind);app.pick();await env.flush();if(offset)await env.advance(offset,{step:16});
 if(kind==='queued-dolly'){app.controls._scale=1.15;app.controls._panOffset.set(.5,1,-.2);app.controls._sphericalDelta.theta=.04;app.controls._sphericalDelta.phi=-.03;}
 const label=theme+'/'+kind+'/'+offset,before=pose(),beforePixels=pixels(),oldTween=qa().tween,generation=qa().drawGeneration,stops=stopCalls,cancelled=env.speech.cancelled.length,spoken=env.speech.spoken.length,used=app.getState().used;
 assert.equal($('#timer-primary').disabled,false);$('#timer-primary').click();unchanged(before,label+' immediate');assert.deepEqual(pixels(),beforePixels,label+' exact projected pixels');
 assert.equal(qa().drawGeneration,generation+1);assert.equal(stopCalls,stops+1);assert.equal(env.speech.cancelled.length,cancelled+1);assert.equal(env.speech.active,null);assert.equal(qa().drawStart,null);assert.deepEqual(qa().drawCandidates,[]);assert.equal(app.getState().busy,false);assert.equal(app.spaceCards.debug().drawing,false);assert.equal(app.paperCards.debug().drawing,false);
 assert.equal(countdown().snapshot.duration,120000);assert.equal(countdown().snapshot.status,'running');assert.equal(qa().boardMode,true);assert.equal(app.controls.enabled,false);assert.equal(app.controls.enableDamping,false);
 assert.equal(app.controls._sphericalDelta.theta,0);assert.equal(app.controls._sphericalDelta.phi,0);close(app.controls._panOffset,new THREE.Vector3(),label+' cleared pan');assert.equal(app.controls._scale,1);assert.equal(app.controls._performCursorZoom,false);
 const flight=qa().tween;assert.notEqual(flight,oldTween);assert.equal(flight.boardFlight,true);assert.equal(flight.duration,1500);close(flight.a,before.position,label+' flight origin');assert.ok(flight.qa.angleTo(before.orientation)<1e-7);
 // Assert visible subject framing rather than reproducing the implementation curve.
 // In the star theme its hidden classroom camera stays still until completion.
 let elapsed=0;while(elapsed<1500){const step=Math.min(16,1500-elapsed);elapsed+=step;await env.step(step);if(theme==='classroom'||elapsed===1500)assertSubjectFraming(label,elapsed);else unchanged(before,label+' hidden frame '+elapsed);samples++;assert.equal(qa().drawStart,null);assert.equal(app.getState().selected,-1)}
 close(app.camera.position,app.boardCamera().pos,label+' endpoint');assert.equal(qa().tween,null);await env.step(2500);await env.flush();assert.equal(env.speech.spoken.length,spoken);assert.deepEqual(app.getState().used,used);assert.equal(app.getState().selected,-1);cases++;
}
for(const theme of ['classroom','space','paper']){
 await clean(theme);app.pick();await env.step(16);$('#timer-primary').click();await env.step(100);const flight=qa().tween,before=pose();$('#timer-primary').click();unchanged(before,theme+' restart');assert.equal(qa().tween,flight,'Restart keeps the same camera trip');assert.equal(countdown().snapshot.remaining,120000);
 await env.step(200);const beforeSwitch=app.getState(),remaining=countdown().snapshot.remaining;app.setTheme(theme==='classroom'?'space':'classroom');assert.equal(countdown().snapshot.remaining,remaining);assert.equal(app.getState().selected,beforeSwitch.selected);assert.deepEqual(app.getState().used,beforeSwitch.used);
 await $('#fullscreen').onclick();await env.resize(1920,1080);assert.equal(qa().boardMode,true);assert.equal(countdown().snapshot.status,'running');await env.step(1000);app.setTheme('classroom');await env.step(500);close(app.camera.position,app.boardCamera().pos,theme+' fullscreen endpoint');
 app.pick();assert.equal(countdown().snapshot.status,'ready');assert.equal(qa().boardMode,false);assert.equal(app.getState().busy,true);await env.step(app.getState().drawDurationMs);assert.ok(app.getState().selected>=0);await env.step(1600);assert.equal(app.getState().busy,false);
 $('#timer-primary').click();await env.step(1600);await $('#fullscreen').onclick();await env.resize(1366,768);await env.step(800);close(app.camera.position,app.boardCamera().pos,theme+' fullscreen exit');
}
// A pending result name and the prior completion callback are also cancelled.
for(const theme of ['classroom','space','paper']){
 await clean(theme);app.pick();await env.flush();await env.step(app.getState().drawDurationMs);const spoken=env.speech.spoken.length,selected=app.getState().selected;assert.ok(selected>=0);$('#timer-primary').click();await env.step(10000);assert.equal(env.speech.spoken.length,spoken);assert.equal(app.getState().busy,false);assert.equal(countdown().snapshot.status,'running');
}
// A user already zoomed closer than the board endpoint must not hit the
// controls' minimum-distance clamp or reverse through the point of interest.
await clean('classroom');app.focus(app.people()[0],true);app.controls.update();
app.camera.position.sub(app.controls.target).normalize().multiplyScalar(app.controls.minDistance).add(app.controls.target);app.controls.update();
app.pick();$('#timer-primary').click();let priorRadius=app.camera.position.distanceTo(app.controls.target);
for(let elapsed=15;elapsed<=1500;elapsed+=15){await env.step(15);const radius=app.camera.position.distanceTo(app.controls.target);assert.ok(radius>=priorRadius-1e-9,'close view moves smoothly outward');assert.ok(radius>=app.controls.minDistance-1e-9,'no minimum-radius clamp');assertSubjectFraming('close view',elapsed);priorRadius=radius}
close(app.camera.position,app.boardCamera().pos,'close view endpoint');
// Reduced motion retains the existing direct-to-board behavior.
await clean('classroom');const media=window.matchMedia;window.matchMedia=query=>query.includes('prefers-reduced-motion')?{matches:true}:media(query);app.pick();$('#timer-primary').click();assert.equal(qa().tween,null);close(app.camera.position,app.boardCamera().pos,'reduced motion board');assert.equal(countdown().snapshot.duration,120000);window.matchMedia=media;
console.log(`PASS ${cases} timer takeovers and ${samples} framed camera samples: all three themes; 0/16/50/100/250 and last precommit boundary; overview/focus/board/orbit/pan/dolly; exact pose/projection continuity; one cancellation; no stale result/audio/name; restart; timer→pick; fullscreen/theme; reduced motion; default two minutes`);
