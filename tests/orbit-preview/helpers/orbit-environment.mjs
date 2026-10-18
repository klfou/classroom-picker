import {setup as baseSetup} from './theme-environment.mjs';
import {createCanvasRecorder,clearOutput} from './paper-canvas-recorder.mjs';
// Shared release helpers are copied unchanged except for opt-in nested asset-root support.
export async function setup(options){
 const env=await baseSetup(options),recorder=createCanvasRecorder(),create=document.createElement.bind(document);
 document.createElement=tag=>{
  const element=create(tag);if(tag.toLowerCase()!=='canvas')return element;
  const source=new recorder.Canvas(),context=source.ctx,original=element.getContext('2d');
  context.canvas=element;element.ctx=context;
  // Preserve fixture APIs such as createImageData for the software 3D renderer.
  const combined=new Proxy(context,{get(target,key){if(key in target)return target[key];const value=original[key];return typeof value==='function'?value.bind(original):value}});
  element.getContext=kind=>kind==='2d'?combined:null;
  return element;
 };
 let reduced=!!options.reducedMotion;const queries=new Set(),nativeMatch=globalThis.matchMedia;
 window.matchMedia=globalThis.matchMedia=query=>{
  if(!query.includes('prefers-reduced-motion'))return nativeMatch(query);
  const listeners=new Set(),media={matches:reduced,addEventListener(type,fn){if(type==='change')listeners.add(fn)},removeEventListener(type,fn){if(type==='change')listeners.delete(fn)},listeners};queries.add(media);return media;
 };
 env.setReducedMotion=value=>{reduced=value;for(const media of queries){media.matches=value;for(const fn of media.listeners)fn({matches:value})}};
 const step=env.step;env.step=async ms=>{for(const canvas of env.canvases)if(canvas.parentElement&&canvas.ctx)clearOutput(canvas);await step(ms)};
 env.recorder=recorder;return env;
}
export {$,select} from './theme-environment.mjs';
