import assert from 'node:assert/strict';
const events={},nodes=new Map(),raf=new Map();let now=0,seq=0;
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}})}, {get:(o,k)=>o[k]??(()=>{})});
const node=id=>{if(!nodes.has(id))nodes.set(id,{id,style:{},value:'',checked:false,textContent:'',innerHTML:'',disabled:false,clientWidth:600,width:0,height:0,children:[],append(o){this.children.push(o)},replaceChildren(...o){this.children=o},setAttribute(k,v){this[k]=v},getContext:()=>context});return nodes.get(id)};
globalThis.document={hidden:false,body:{classList:{add(){},remove(){}}},getElementById:node,createElement:()=>node('option'+seq++),addEventListener:(n,f)=>events[n]=f,querySelectorAll:()=>[],querySelector:()=>({getBoundingClientRect:()=>({height:170})}),documentElement:{style:{setProperty(){}}}};
globalThis.window={addEventListener:(n,f)=>events[n]=f};globalThis.devicePixelRatio=1;globalThis.performance={now:()=>now};globalThis.requestAnimationFrame=f=>{const id=++seq;raf.set(id,f);return id};globalThis.cancelAnimationFrame=id=>raf.delete(id);globalThis.setInterval=()=>0;
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
globalThis.ResizeObserver=class{observe(){}};let audio;globalThis.Audio=class{constructor(){audio=this;this.duration=6.687;this.currentTime=0;this.ended=false;this.playCount=0;this.pauseCount=0}play(){this.ended=false;this.playCount++;return Promise.resolve()}pause(){this.pauseCount++}};
await import('../src/wheel-toy-preview/app.js');const app=window.toyWheel;
async function step(ms){now+=ms;const jobs=[...raf.values()];raf.clear();for(const f of jobs)f(now);await Promise.resolve()}
assert.equal(node('timer-minutes').value,'2');await app.pick();assert(app.getState().busy);assert.equal(audio.playCount,1);await step(3000);assert.equal(app.getState().used.length,0);await step(3687);assert(app.getState().busy,'must wait for actual audio end');assert.equal(app.getState().used.length,0);audio.ended=true;audio.onended();await step(1);assert.equal(app.getState().used.length,1);await step(520);assert(!app.getState().busy);assert.equal(node('winner').textContent,app.getState().wheel.name);assert.equal(app.getState().wheel.flip,1);
await app.pick();await step(2000);app.cancel();const saved=app.getState().used.length;await step(9000);assert.equal(app.getState().used.length,saved);assert(!app.getState().busy);assert(audio.pauseCount>=3);
await app.pick();node('sound-toggle').onclick();await step(6687);await step(520);assert(!app.getState().busy);assert.equal(app.getState().used.length,2);assert.equal(audio.currentTime,0);
await app.pick();document.hidden=true;events.visibilitychange();await step(8000);assert(!app.getState().busy);assert.equal(app.getState().used.length,2);document.hidden=false;
assert.equal(storage.size,0,'draw history never persisted');node('repeat-allow').onclick();assert([...storage.keys()].every(k=>k.startsWith('toy-wheel-preview:')));
node('timer-primary').onclick();assert.equal(node('timer-action-label').textContent,'重新计时');assert.equal(node('winner').textContent,'02:00');node('timer-minutes').value='10';assert.equal(node('winner').textContent,'02:00');node('timer-primary').onclick();assert.equal(node('winner').textContent,'10:00');
console.log('PASS full media end gate, same sector/result name, completion-only count, cancellation/mute/pagehide, isolated storage, timer2/default10 choices and restart with next duration.');
for(const label of ['示例','示例甲','示例同学','示例同学甲','示例同学甲乙','示例同学39']){
 storage.clear();nodes.clear();raf.clear();
 storage.set('sunlit-classes-v3',JSON.stringify({version:3,activeId:'qa',classes:[{id:'qa',name:'合成测试班',seats:[{name:label,row:1,col:1}],sample:true,noRepeat:true,used:[]}],deleted:[]}));
 context.measureText=text=>({width:[...text].length*66});node('winner').clientWidth=240;
 await import(`../src/wheel-toy-preview/app.js?fit=${encodeURIComponent(label)}`);
 await window.toyWheel.pick();audio.ended=true;audio.onended();await step(6687);await step(520);
 const font=parseFloat(node('winner').style.fontSize);assert(font>0&&font<=66);assert(([...label].length*66+66*.03*([...label].length-1))*font/66<=230.001);assert.equal(node('winner').textContent,label);assert.equal(node('footer-result').textContent,label);
}
console.log('PASS complete-name fit: 2,3,4,5,6 Chinese glyphs and 示例同学39, measured text plus letter spacing scales inside 240px without truncation.');
