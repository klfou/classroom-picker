// Public presentation facade. The scene owns the sole RAF and every timestamp.
import {SPACE_DRAW_TIMING} from './draw-timing.js';
import {CARD,createCardModel} from './space-card-model.js';
import {createSurfaceFactory,createArtCache,background} from './space-card-art.js';
import {createCanvasBackend} from './space-card-canvas.js';
import {supportsSharedWebGL,createWebGLBackend} from './space-card-webgl.js';
import {createMeteorField} from './space-meteors.js';
export function createSpaceCards(canvas,options={}){
 const model=createCardModel(),surface=createSurfaceFactory(canvas),art=createArtCache(surface),meteors=createMeteorField(surface),fallback=createCanvasBackend(canvas,art,meteors),renderer=options.renderer,media=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
 let active=!renderer,disposed=false,gpu=null,backend='canvas',dpr=1,bg=null,frame=0,paintedBackend='',lastError='',quality=1,pendingSample=false;
 model.reducedMotion=!!media?.matches;
 const finite=(v,f=0)=>Number.isFinite(v)?v:f;
 function notify(){if(paintedBackend===backend)return;paintedBackend=backend;options.onBackendChange?.(backend)}
 function buildGPU(){if(!supportsSharedWebGL(renderer))return;gpu?.dispose();gpu=null;try{gpu=(options.createWebGLBackend??createWebGLBackend)(renderer,art,surface,meteors);if(bg)gpu.resize(model.width,model.height,bg);backend='webgl';lastError=''}catch(error){gpu?.dispose();gpu=null;backend='canvas';lastError=String(error?.message??error)}}
 function render(now=model.now){
  if(disposed)return;model.now=finite(now,model.now);if(model.epoch==null)model.epoch=model.now;pendingSample=true;if(!active)return;
  samplePending();frame++;
  try{if(gpu)gpu.render(model);else fallback.render(model)}catch(error){if(!gpu)throw error;lastError=String(error?.message??error);gpu.dispose();gpu=null;backend='canvas';fallback.render(model)}notify();
 }
 function samplePending(){if(!pendingSample)return;model.sample(model.now);meteors.sample(model);pendingSample=false}
 function resize(w,h){
  if(disposed)return;const width=Math.max(1,Math.round(finite(w,1))),height=Math.max(1,Math.round(finite(h,1))),ratio=Math.max(1,Math.min(1.5,Math.sqrt(2400000/(width*height)),finite(typeof devicePixelRatio==='undefined'?1:devicePixelRatio,1)))*quality;
  if(bg&&width===model.width&&height===model.height&&ratio===dpr)return;
  const nextBackground=background(surface,width,height,ratio);model.resize(width,height);dpr=ratio;bg=nextBackground;fallback.resize(width,height,dpr,bg);gpu?.resize(width,height,bg);render(model.now);
 }
 function setQuality(value){const next=Math.max(.65,Math.min(1,finite(value,1)));if(next===quality||disposed)return;quality=next;resize(model.width,model.height)}
 function setNames(names){
  if(disposed)return;const next=Array.isArray(names)?names.map(n=>typeof n==='string'?n:typeof n?.name==='string'?n.name:'').map(n=>n.trim()).filter(Boolean):[];
  if(next.length===model.names.length&&next.every((n,i)=>n===model.names[i]))return;
  model.setNames(next);art.setNames(next);if(model.winner)art.select(model.winner);gpu?.syncResources?.();render(model.now);
 }
 function start(now=model.now,profile=SPACE_DRAW_TIMING){if(disposed)return false;const ok=model.start(finite(now,model.now),profile);if(ok){art.select(null);render(model.now)}return ok}
 function reveal(name,now=model.now){if(disposed||typeof name!=='string')return false;const ok=model.reveal(name,finite(now,model.now));if(ok){art.select(name);render(model.now)}return ok}
 function cancel(){if(disposed)return;model.drawing=false;render(model.now)}
 function reset(){if(disposed)return;model.drawing=false;model.winner='';model.selected=null;art.select(null);gpu?.syncResources?.();render(model.now)}
 function setCountdown(state){if(!disposed)model.countdown=state==null?null:{...state}}
 function setActive(value){if(disposed)return;const next=!!value;if(next===active)return;active=next;if(active)render(model.now)}
 const onMotion=e=>{model.motion(!!e.matches);render(model.now)};
 const onLost=e=>{e.preventDefault?.();if(disposed)return;gpu?.dispose();gpu=null;backend='canvas';if(active)render(model.now);else notify()};
 const onRestored=()=>{if(disposed)return;buildGPU();if(active)render(model.now);else notify()};
 media?.addEventListener?.('change',onMotion);renderer?.domElement?.addEventListener?.('webglcontextlost',onLost);renderer?.domElement?.addEventListener?.('webglcontextrestored',onRestored);
 function snapshot(c,edges){return {id:c.id,idleCycle:c.idleCycle,idleDepth:c.idleDepth,idleInView:c.idleInView,idleOpacity:c.idleOpacity,distanceShade:c.distanceShade,name:c.name,x:c.x,y:c.y,z:c.z,screenX:c.screenX,screenY:c.screenY,width:c.width,height:c.height,opacity:c.opacity,shade:c.shade,shellMix:c.shellMix,facing:c.facing,normal:{...c.normal},uAxis:{...c.uAxis},vAxis:{...c.vAxis},mesh:c.shellMix>.001?c.mesh.map(p=>({...p})):null,frontRim:edges?c.frontRim.map(p=>({...p})):null,backRim:edges?c.backRim.map(p=>({...p})):null}}
 function debug(includeEdges=false){samplePending();return {plaqueScale:CARD.scale,idleScale:CARD.idleScale,idlePeriod:CARD.idlePeriod,mode:model.drawing?'drawing':model.winner?'selected':'idle',stage:model.stage,drawing:model.drawing,timing:{...model.timing},startedAt:model.startedAt,winner:model.winner,selectedName:model.winner,names:[...model.names],countdown:model.countdown?{...model.countdown}:null,reducedMotion:model.reducedMotion,width:model.width,height:model.height,dpr,quality,frame,textureCount:art.stats().names,cardCount:model.cards.length,visibleCardCount:model.visibleCardCount,cards:model.cards.map(c=>snapshot(c,includeEdges)),shellCardCount:model.cards.length+model.extras.length,sphereCenter:{x:0,y:0,z:9.5},sphereRadius:3.06*Math.min(1,model.aspect/.95),shellCards:model.order.filter(c=>!c.selected).map(c=>snapshot(c,includeEdges)),selectedCard:model.selected?snapshot(model.selected,includeEdges):null,backend,active,lastError,resources:{art:art.stats(),render:(gpu??fallback).debug()}}}
 buildGPU();resize(canvas.clientWidth||canvas.width||800,canvas.clientHeight||canvas.height||600);if(!active)notify();
 return {setNames,start,reveal,cancel,setCountdown,resize,render,reset,setActive,setQuality,debug,dispose(){if(disposed)return;disposed=true;media?.removeEventListener?.('change',onMotion);renderer?.domElement?.removeEventListener?.('webglcontextlost',onLost);renderer?.domElement?.removeEventListener?.('webglcontextrestored',onRestored);gpu?.dispose();gpu=null;fallback.dispose();art.dispose();meteors.dispose();bg=null;model.cards=[];model.extras=[];model.allCards=[];model.order=[];model.selected=null;model.names=[];model.winner='';model.countdown=null}};
}
