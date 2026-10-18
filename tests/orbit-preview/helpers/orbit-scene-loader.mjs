import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const dist=pathToFileURL(path.resolve(process.env.ORBIT_DIST||fileURLToPath(new URL('../../dist/',import.meta.url)))+'/');
const assetRoot=pathToFileURL(path.resolve(process.env.ORBIT_ASSET_ROOT||fileURLToPath(dist))+'/');
const html=await fs.readFile(new URL('index.html',dist),'utf8');
const importMap=JSON.parse(html.match(/<script\s+type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/)?.[1]??'{"imports":{}}');
export async function resolve(specifier,context,next){
 if(specifier==='three')return {url:new URL(importMap.imports.three,dist).href,shortCircuit:true};
 return next(specifier,context);
}
export async function load(url,context,next){
 if(url.startsWith(assetRoot.href)&&url.endsWith('.js')){
  let source=await fs.readFile(fileURLToPath(url),'utf8');
  // Read-only closure probes: production control flow and rendering stay intact.
  if(url===new URL('scene.js',dist).href)source+='\n;globalThis.__orbitHostQA=()=>({drawStart,drawDurationMs,drawTimeline,drawOriginTheme,pendingIndex:pendingPick?.i??null,boardMode,tween,sceneRevision,drawGeneration,usedSet:used,drawCandidates:drawCandidates.map(p=>p.i),sounds});';
  if(url===new URL('countdown.js',dist).href)source+='\n;globalThis.__orbitCountdownQA=()=>({snapshot:timer.tick(),selectedMinutes,boardVisible});';
  return {format:'module',source,shortCircuit:true};
 }
 return next(url,context);
}
