import assert from 'node:assert/strict';
import {selectLocalChineseVoice,createNameReadout} from '../dist/name-readout.js';
import {readFileSync} from 'node:fs';
const cn={lang:'zh-CN',localService:true},tw={lang:'zh-TW',localService:true},hk={lang:'zh-HK',localService:true},remote={lang:'zh-CN',localService:false};
assert.equal(selectLocalChineseVoice([remote,{lang:'en-US',localService:true}]),null);
assert.equal(selectLocalChineseVoice([{lang:'zh-CN'}]),null);
assert.equal(selectLocalChineseVoice([hk,tw,cn]),cn);
assert.equal(selectLocalChineseVoice([hk,tw]),tw);
assert.equal(selectLocalChineseVoice([hk]),hk);
function fixture(initial=[cn]){
 let time=0,id=0,voices=initial,cancels=0,before=0;const timers=new Map(),spoken=[],status=[],listeners={},docListeners={},hostListeners={};
 const synth={getVoices:()=>voices,cancel(){cancels++},resume(){},speak(u){spoken.push(u)},addEventListener(e,f){listeners[e]=f}};
 const doc={hidden:false,addEventListener(e,f){docListeners[e]=f}};
 const host={speechSynthesis:synth,SpeechSynthesisUtterance:class{constructor(text){this.text=text}},addEventListener(e,f){hostListeners[e]=f}};
 const api=createNameReadout({host,document:doc,onStatus:s=>status.push(s),beforeSpeak:()=>before++,now:()=>time,setTimer:(fn,ms)=>{timers.set(++id,{fn,at:time+ms});return id},clearTimer:id=>timers.delete(id)});
 function tick(ms){const end=time+ms;while(true){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;time=next[1].at;timers.delete(next[0]);next[1].fn()}time=end}
 return {api,synth,host,doc,spoken,status,tick,voices(v){voices=v;listeners.voiceschanged?.()},hide(){doc.hidden=true;docListeners.visibilitychange()},pagehide(){hostListeners.pagehide()},get before(){return before},get cancels(){return cancels}};
}
let f=fixture();f.api.speak('测试甲');f.tick(669);assert.equal(f.spoken.length,0);f.tick(1);assert.equal(f.spoken.length,1);assert.equal(f.spoken[0].text,'测试甲');assert.equal(f.spoken[0].voice,cn);assert.equal(f.before,1);f.voices([cn]);f.tick(100);assert.equal(f.spoken.length,1);f.spoken[0].onend();f.tick(10000);assert.equal(f.status.at(-1),'');
f=fixture([]);f.api.speak('测试乙');f.tick(700);f.voices([remote,tw]);assert.equal(f.spoken.length,1);assert.equal(f.spoken[0].voice,tw);
f=fixture([remote]);f.api.speak('测试丙');f.tick(1600);assert.equal(f.spoken.length,0);assert.equal(f.status.at(-1),'本机暂无中文播报');f.voices([cn]);assert.equal(f.spoken.length,0);assert.equal(f.status.at(-1),'');
f=fixture();f.api.speak('旧测试');f.tick(300);f.api.speak('新测试');f.tick(670);assert.deepEqual(f.spoken.map(u=>u.text),['新测试']);
for(const action of ['cancel','hide','pagehide']){f=fixture();f.api.speak('取消测试');if(action==='cancel')f.api.cancel();else f[action]();f.tick(3000);assert.equal(f.spoken.length,0)}
f=fixture();f.api.speak('播报中取消');f.tick(670);const old=f.spoken[0];f.api.cancel();old.onerror();assert.equal(f.status.at(-1),'');
f=fixture();f.doc.hidden=true;f.api.speak('隐藏测试');f.tick(5000);f.doc.hidden=false;f.voices([cn]);assert.equal(f.spoken.length,0);
f=fixture();f.api.speak('音量零',{volume:0});f.tick(2000);assert.equal(f.spoken.length,0);
f=fixture();f.synth.speak=()=>{throw Error('unavailable')};assert.doesNotThrow(()=>{f.api.speak('失败测试');f.tick(670)});assert.equal(f.status.at(-1),'本机中文播报暂不可用');
f=fixture();f.api.speak('故障测试');f.tick(670);f.spoken[0].onerror();assert.equal(f.status.at(-1),'本机中文播报暂不可用');
f=fixture();f.api.speak('超时测试');f.tick(9000);assert.equal(f.status.at(-1),'本机中文播报暂不可用');
const scene=readFileSync(new URL('../dist/scene.js',import.meta.url),'utf8'),sounds=readFileSync(new URL('../dist/sounds.js',import.meta.url),'utf8'),countdown=readFileSync(new URL('../dist/countdown.js',import.meta.url),'utf8');
assert.equal(scene.match(/sounds\.result\(names\[p.i\]\)/g)?.length,1);
assert.match(sounds,/function stop\(\)\{readout.cancel\(\)/);
assert.match(scene,/function cancelDraw\(\).*sounds.stop\(\)/);
assert.match(countdown,/timer-primary'\).onclick=\(\)=>\{window.classroom\?\.cancelDraw\(\)/);
console.log('Local name readout: voice privacy, reveal-only integration, async loading, deadlines, cancellation, hidden state, mute, errors and watchdog passed.');
