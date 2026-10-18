// CPU workload with deterministic DOM/Canvas/clock doubles, never browser FPS.
import {register} from 'node:module';
import {pathToFileURL} from 'node:url';
import {performance as clock} from 'node:perf_hooks';
const root=process.argv[2],theme=process.argv[3]||'classroom',split=process.argv.includes('--split');
if(!root)throw Error('Usage: node tests/helpers/profile-first-draw.mjs ABSOLUTE_BUILT_REPO [classroom|space|paper] [--split]');
register(pathToFileURL(root+'/tests/helpers/theme-scene-loader.mjs'));
const {setup,dist}=await import(pathToFileURL(root+'/tests/helpers/theme-environment.mjs'));
const names=Array.from({length:64},(_,i)=>'测试同学'+(i+1));
const env=await setup({storage:{'sunlit-theme':theme,'sunlit-classes-v3':JSON.stringify({version:3,activeId:'test',classes:[{id:'test',name:'测试班',noRepeat:true,sample:false,seats:names.map((name,i)=>({name,row:1+Math.floor(i/8),col:1+i%8}))}],deleted:[]})}});
const startup=clock.now();await import(dist+'/scene.js');const app=window.classroom;await env.awaitReady(app.ready);env.bindRenderer(app.renderer);await import(dist+'/countdown.js');
const readyMs=clock.now()-startup;await env.step(1600);await env.flush();
// Exactly the same six-second idle dwell on each revision, including its RAFs.
for(let i=0;i<360;i++){await env.step(1000/60);await env.flush()}
if(app.preparation?.().pending)throw Error('Preparation exceeded the declared idle interval');
async function one(){
 const assetBefore=env.assetReads.length,canvases=env.canvases.length;
 const poses=()=>[...new Set(app.people().map(p=>p.avatar.def))].map(d=>({name:d.name,poses:d.cache.size}));
 const before=poses(),parts={},restore=[];
 if(split)for(const [label,owner,key]of [['spaceStart',app.spaceCards,'start'],['paperStart',app.paperCards,'start']]){
  const original=owner[key];restore.push(()=>{owner[key]=original});
  owner[key]=(...args)=>{const start=clock.now();try{return original(...args)}finally{parts[label]=(parts[label]||0)+clock.now()-start}};
 }
 const start=clock.now(),cpuStart=process.cpuUsage();let pickMs,pickCpuMs;
 try{app.pick();pickMs=clock.now()-start;const cpu=process.cpuUsage(cpuStart);pickCpuMs=(cpu.user+cpu.system)/1000}finally{for(const fn of restore)fn()}
 const frames=[];for(let i=0;i<64;i++){const start=clock.now();await env.step(50);await env.flush();frames.push(clock.now()-start)}
 return {pickMs,pickCpuMs,...(split?{parts}:{}),maxFrameMs:Math.max(...frames),p95FrameMs:[...frames].sort((a,b)=>a-b)[Math.floor(frames.length*.95)],canvasAllocations:env.canvases.length-canvases,posesBefore:before,posesAfter:poses(),assetReads:env.assetReads.slice(assetBefore).map(x=>x.url.split('/dist/').at(-1)),paper:app.paperCards.debug().resources};
}
const cold=await one();app.cancelDraw();app.home(true);await env.step(1600);await env.flush();const warm=await one();
console.log(JSON.stringify({theme,readyMs,cold,warm}));
