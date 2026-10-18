import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const dist=new URL('../../dist/',import.meta.url);
export async function resolve(specifier,context,next){
 if(specifier==='three')return {url:new URL('vendor/three.module.js',dist).href,shortCircuit:true};
 return next(specifier,context);
}
export async function load(url,context,next){
 if(url.startsWith(dist.href)&&url.endsWith('.js')){
  let source=await fs.readFile(fileURLToPath(url),'utf8');
  // Observe the actual production closures without changing their behavior.
  if(url===new URL('scene.js',dist).href)source+='\n;globalThis.__sharedThemeQA=()=>({drawStart,drawDurationMs,drawSeconds,drawTimeline,boardMode,tween,sceneRevision,drawGeneration,usedSet:used,drawCandidates:drawCandidates.map(p=>p.i),sounds});';
  if(url===new URL('countdown.js',dist).href)source+='\n;globalThis.__sharedCountdownQA=()=>({snapshot:timer.tick(),selectedMinutes,boardVisible});';
  return {format:'module',source,shortCircuit:true};
 }
 return next(url,context);
}
