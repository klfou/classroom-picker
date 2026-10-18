// Renderer-independent spatial model. Coordinates are x-right, y-down, z-away.
// This model never selects a student, reads a clock, or schedules a frame.
import {SPACE_DRAW_TIMING} from './draw-timing.js';
export const CARD = Object.freeze({width:384,height:168,scale:.82,thickness:.05,idleScale:1.13,idlePeriod:112000,shellCount:96});
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const smooth=v=>{v=clamp(v);return v*v*(3-2*v)};
export const mix=(a,b,t)=>a+(b-a)*t;
const fract=v=>v-Math.floor(v);
// Spare the narrow middle-side reading lanes when interleaving new idle lives.
const IDLE_INTERLEAVE=[0,10,20,31,6,16,26,13,22];
export const hash=n=>fract(Math.sin(n*127.1+311.7)*43758.5453123);
export const RIM=[];
for(const [x,y,angle] of [[351,33,-Math.PI/2],[351,135,0],[33,135,Math.PI/2],[33,33,Math.PI]])for(let i=0;i<=4;i++){const a=angle+i*Math.PI/8;RIM.push({u:(x+20*Math.cos(a))/384,v:(y+20*Math.sin(a))/168})}
export const UV=Array.from({length:9},(_,i)=>({u:i%3/2,v:Math.floor(i/3)/2}));
const newPoints=points=>points.map(()=>({x:0,y:0,z:0}));
const shell=Array.from({length:96},(_,i)=>{const y=1-2*(i+.5)/96,r=Math.sqrt(1-y*y),lon=i*Math.PI*(3-Math.sqrt(5)),s=Math.sin(lon),c=Math.cos(lon);return {x:r*s,y,z:-r*c,ux:c,uy:0,uz:s,vx:-y*s,vy:r,vz:y*c}});
function quaternion(u,v,n,out){
 const m00=u.x,m01=v.x,m02=-n.x,m10=u.y,m11=v.y,m12=-n.y,m20=u.z,m21=v.z,m22=-n.z,t=m00+m11+m22;let x,y,z,w,s;
 if(t>0){s=Math.sqrt(t+1)*2;w=.25*s;x=(m21-m12)/s;y=(m02-m20)/s;z=(m10-m01)/s}
 else if(m00>m11&&m00>m22){s=Math.sqrt(1+m00-m11-m22)*2;w=(m21-m12)/s;x=.25*s;y=(m01+m10)/s;z=(m02+m20)/s}
 else if(m11>m22){s=Math.sqrt(1+m11-m00-m22)*2;w=(m02-m20)/s;x=(m01+m10)/s;y=.25*s;z=(m12+m21)/s}
 else{s=Math.sqrt(1+m22-m00-m11)*2;w=(m10-m01)/s;x=(m02+m20)/s;y=(m12+m21)/s;z=.25*s}
 out.x=x;out.y=y;out.z=z;out.w=w;return out;
}
function orient(c,u,v,n,t){
 const q=quaternion(u,v,n,c.targetQuaternion);if(q.w<0){q.x=-q.x;q.y=-q.y;q.z=-q.z;q.w=-q.w}
 const angle=Math.acos(clamp(q.w,-1,1)),s=Math.sin(angle),a=s>.00001?Math.sin(t*angle)/s:t,b=s>.00001?Math.sin((1-t)*angle)/s:1-t;
 let x=q.x*a,y=q.y*a,z=q.z*a,w=q.w*a+b;const length=Math.hypot(x,y,z,w)||1;x/=length;y/=length;z/=length;w/=length;
 const uo=c.uAxis,vo=c.vAxis,no=c.normal;uo.x=1-2*(y*y+z*z);uo.y=2*(x*y+z*w);uo.z=2*(x*z-y*w);vo.x=2*(x*y-z*w);vo.y=1-2*(x*x+z*z);vo.z=2*(y*z+x*w);no.x=-2*(x*z+y*w);no.y=-2*(y*z-x*w);no.z=-(1-2*(x*x+y*y));
}
function card(id,name){return {id,name,x:0,y:0,z:1,size:1,width:0,height:0,opacity:1,shellMix:0,shade:1,uAxis:{x:1,y:0,z:0},vAxis:{x:0,y:1,z:0},normal:{x:0,y:0,z:-1},targetNormal:{x:0,y:0,z:0},targetU:{x:0,y:0,z:0},targetV:{x:0,y:0,z:0},targetQuaternion:{x:0,y:0,z:0,w:1},mesh:newPoints(UV),backMesh:newPoints(UV),frontRim:newPoints(RIM),backRim:newPoints(RIM)}}
export function createCardModel(){
 const model={width:1,height:1,aspect:1,focal:1.26,names:[],cards:[],extras:[],allCards:[],order:[],winner:'',selected:null,countdown:null,now:0,epoch:null,frozenElapsed:0,reducedMotion:false,drawing:false,startedAt:0,revealedAt:0,timing:SPACE_DRAW_TIMING,stage:'idle',visibleCardCount:0};
 function setNames(names){
  model.names=names;model.cards=[];model.extras=[];model.order=[];model.drawing=false;
  if(!names.includes(model.winner)){model.winner='';model.selected=null}
  const baseCount=names.length?Math.min(44,Math.max(names.length,36)):0,count=Math.round(baseCount*1.2),occupied=new Set();
  for(let i=0;i<count;i++){
   // Keep every original idle path and phase; interleave 20% extra lives.
   const seed=i<baseCount?i:IDLE_INTERLEAVE[i-baseCount],region=seed%9,slot=Math.floor(seed/9),members=Math.floor((baseCount+8-region)/9),col=region%3,row=Math.floor(region/3),angle=(region===4?1.13:Math.atan2(row-1,col-1))+(hash(seed+311)-.5)*.70,mobile=(region===4?1.13:Math.atan2(row-1,col-1))+(hash(region+311)-.5)*.38,index=Math.floor(i*96/count);
   const c=card(i,names[i%names.length]);Object.assign(c,{regionX:col-1,regionY:row-1,anchorX:(col-1)*.64+(hash(seed+181)-.5)*.42,anchorY:(row-1)*.64+(hash(seed+619)-.5)*.34,u:Math.cos(angle),v:Math.sin(angle),mobileU:Math.cos(mobile),mobileV:Math.sin(mobile),phase:fract((slot+.23+(i>=baseCount?.42:0))/members+region*.137),nearZ:6+hash(seed+287)*1.1,shell:shell[index]});model.cards.push(c);occupied.add(index);
  }
  if(count)for(let i=0;i<96;i++)if(!occupied.has(i)){const source=model.cards[Math.floor(i*count/96)],id=count+model.extras.length,c=card(id,names[(id+(count>=names.length?Math.ceil(names.length*.37):0))%names.length]);Object.assign(c,{extra:true,source,shell:shell[i]});model.extras.push(c)}
  model.allCards=model.cards.concat(model.extras);
 }
 function idle(c,now){
  const {aspect,width,height,focal}=model,elapsed=model.reducedMotion?model.frozenElapsed:Math.max(0,now-(model.epoch??now)),cycle=c.phase+elapsed/CARD.idlePeriod,depth=fract(cycle);
  const normalSize=aspect>1.78?Math.min(1.35,aspect/1.78):clamp(aspect/.95,.72,1),base=normalSize*CARD.scale;
  c.size=base*CARD.idleScale*Math.pow(3.6,-.24*smooth((depth-.5)/.5));
  const pathHalfW=.9*base,pathHalfH=pathHalfW*168/384,halfW=.9*c.size,halfH=halfW*168/384,near=c.nearZ*(aspect<.95?.68:1);
  c.z=near*Math.pow(3.6,1-depth);c.idleCycle=Math.floor(cycle);c.idleDepth=depth;
  const s=2*depth-1,travel=s-.78*Math.sin(Math.PI*s)/Math.PI,spread=smooth((aspect-.8)/.6),ax=mix(c.regionX*.55+(c.anchorX-c.regionX*.64)*.43,c.anchorX,spread),ay=mix(c.regionY*.64+(c.anchorY-c.regionY*.64)*.43,c.anchorY,spread),u=mix(c.mobileU,c.u,spread),v=mix(c.mobileV,c.v,spread);
  const reach=Math.min((1+Math.abs(ax)+2*pathHalfW*1.26/(near*aspect)+.10)/Math.max(.0001,Math.abs(u)),(1.02+Math.abs(ay)+2*pathHalfH*1.26/near+.10)/Math.max(.0001,Math.abs(v)))*1.05;
  c.x=(ax+u*reach*travel)*aspect*c.z/2.52;c.y=(ay+v*reach*travel)*c.z/2.52;c.idleOpacity=1;c.distanceShade=.30*(1-smooth(depth));
  const scale=focal/c.z,x=width*.5+c.x*scale,y=height*.49+c.y*scale,back=focal/(c.z+CARD.thickness*c.size),bx=width*.5+c.x*back,by=height*.49+c.y*back,bw=halfW*(1-26/384)*back,bh=halfH*(1-26/168)*back;
  c.idleInView=Math.max(x+halfW*scale,bx+bw)>=0&&Math.min(x-halfW*scale,bx-bw)<=width&&Math.max(y+halfH*scale,by+bh)>=0&&Math.min(y-halfH*scale,by-bh)<=height;
  // Catch up a skipped/background-tab cycle only while its physical card is hidden.
  if(!model.drawing&&!c.idleInView)c.name=model.names[((c.id+c.idleCycle*model.cards.length)%model.names.length+model.names.length)%model.names.length];
 }
 function projectPoint(c,uv,out,back){
  const dx=(uv.u-.5)*c.worldW,dy=(uv.v-.5)*c.worldH,t=back?CARD.thickness*c.size:0,u=c.uAxis,v=c.vAxis,n=c.normal,z=c.z+u.z*dx+v.z*dy-n.z*t;
  out.x=model.width*.5+(c.x+u.x*dx+v.x*dy-n.x*t)*model.focal/z;out.y=model.height*.49+(c.y+u.y*dx+v.y*dy-n.y*t)*model.focal/z;out.z=z;
 }
 function project(c){
  const {width,height,focal}=model,worldW=1.8*c.size,worldH=worldW*168/384,scale=focal/c.z;c.worldW=worldW;c.worldH=worldH;c.screenX=width*.5+c.x*scale;c.screenY=height*.49+c.y*scale;c.width=worldW*scale;c.height=worldH*scale;
  c.minX=Infinity;c.maxX=-Infinity;c.minY=Infinity;c.maxY=-Infinity;
  for(let i=0;i<UV.length;i++){projectPoint(c,UV[i],c.mesh[i],false);projectPoint(c,UV[i],c.backMesh[i],true)}
  for(let i=0;i<RIM.length;i++){
   const f=c.frontRim[i],b=c.backRim[i];projectPoint(c,RIM[i],f,false);projectPoint(c,RIM[i],b,true);c.minX=Math.min(c.minX,f.x,b.x);c.maxX=Math.max(c.maxX,f.x,b.x);c.minY=Math.min(c.minY,f.y,b.y);c.maxY=Math.max(c.maxY,f.y,b.y);
  }
  const n=c.normal;c.facing=-(n.x*c.x+n.y*c.y+n.z*c.z)/Math.hypot(c.x,c.y,c.z);c.inView=c.maxX>=0&&c.maxY>=0&&c.minX<=width&&c.minY<=height;
 }
 function rotate(x,y,z,out,cs,sn,ct,st){const rx=x*cs-z*sn,rz=x*sn+z*cs;out.x=rx;out.y=y*ct-rz*st;out.z=y*st+rz*ct}

 function sample(now=model.now){
  model.now=Number.isFinite(now)?now:model.now;if(model.epoch==null)model.epoch=model.now;
  // The requested draw is essential feedback; reduced motion only pauses ambience.
  const elapsed=Math.max(0,model.now-model.startedAt),t=model.timing,gather=smooth(elapsed/t.gather),disperse=smooth((elapsed-t.gather-t.rotate)/t.scatter),shellMix=model.drawing&&elapsed<t.total?gather*(1-disperse):0;
  model.stage=model.drawing?(elapsed<t.gather?'gather':elapsed<t.gather+t.rotate?'rotate':elapsed<t.total?'disperse':'awaiting-reveal'):(model.winner?'selected':'idle');
  const angle=.22+elapsed/t.total*t.turn,cs=Math.cos(angle),sn=Math.sin(angle),ct=Math.cos(-.18),st=Math.sin(-.18),sphereScale=Math.min(1,model.aspect/.95),radius=3.06*sphereScale;
  // Keep absolute-time idle lives/names current behind result/timer views.
  // Their hidden meshes need no perspective projection, orientation or sorting.
  const hideBackground=!!model.countdown||!!model.winner&&!model.drawing;
  model.order.length=0;model.visibleCardCount=0;
  for(const c of model.cards){idle(c,model.now);c.idleX=c.x;c.idleY=c.y;c.idleZ=c.z;c.idleSize=c.size}
  if(!hideBackground)for(let cardIndex=0;cardIndex<model.allCards.length;cardIndex++){
   const c=model.allCards[cardIndex];
   if(c.extra&&shellMix<=0){c.opacity=0;continue}
   const source=c.extra?c.source:c;if(c.extra){c.x=source.idleX;c.y=source.idleY;c.z=source.idleZ;c.size=source.idleSize;c.distanceShade=source.distanceShade}
   c.shellMix=shellMix;c.opacity=1;c.uAxis.x=1;c.uAxis.y=0;c.uAxis.z=0;c.vAxis.x=0;c.vAxis.y=1;c.vAxis.z=0;c.normal.x=0;c.normal.y=0;c.normal.z=-1;
   if(shellMix>0){
    const p=c.shell,n=c.targetNormal,u=c.targetU,v=c.targetV,size=.825*CARD.scale*sphereScale*.94;rotate(p.x,p.y,p.z,n,cs,sn,ct,st);rotate(p.ux,p.uy,p.uz,u,cs,sn,ct,st);rotate(p.vx,p.vy,p.vz,v,cs,sn,ct,st);
    if(elapsed<t.gather+t.rotate){c.x=mix(source.startX,n.x*radius,gather);c.y=mix(source.startY,n.y*radius,gather);c.z=mix(source.startZ,9.5+n.z*radius,gather);c.size=mix(source.startSize,size,gather)}
    else{c.x=mix(n.x*radius,c.x,disperse);c.y=mix(n.y*radius,c.y,disperse);c.z=mix(9.5+n.z*radius,c.z,disperse);c.size=mix(size,c.size,disperse)}
    // Supplementary shell cards grow from their source, never cross-fade names.
    if(c.extra)c.size*=Math.max(.00001,shellMix);orient(c,u,v,n,shellMix);
   }
   project(c);c.shade=mix(1-c.distanceShade,.80+.20*Math.pow(clamp(c.facing),.45),shellMix);if(!hideBackground){model.order.push(c);if(c.inView&&c.size>.001)model.visibleCardCount++;}
  }
  if(model.order.length>1)model.order.sort((a,b)=>b.z-a.z||a.id-b.id);
  if(model.winner&&!model.drawing&&!model.countdown){
   const c=model.selected,p=smooth((model.now-model.revealedAt)/360),w=Math.min(560,model.height*.85,model.width*.76)*(.94+.06*p);c.x=0;c.y=0;c.z=3;c.size=w*c.z/(model.focal*1.8);c.shade=1;c.opacity=1;project(c);model.order.push(c);if(c.inView&&c.size>.001)model.visibleCardCount++;
  }
  return model;
 }
 function start(now,profile=SPACE_DRAW_TIMING){if(!model.names.length)return false;model.drawing=false;model.winner='';model.selected=null;sample(now);for(const c of model.cards){c.startX=c.x;c.startY=c.y;c.startZ=c.z;c.startSize=c.size}model.timing=profile;model.startedAt=now;model.drawing=true;sample(now);return true}
 function reveal(name,now){if(!model.names.includes(name))return false;model.drawing=false;model.winner=name;model.revealedAt=now;model.selected=card(96,name);model.selected.selected=true;sample(now);return true}
 function resize(w,h){model.width=w;model.height=h;model.aspect=w/h;model.focal=h*1.26}
 function motion(next){if(next===model.reducedMotion)return;if(next)model.frozenElapsed=Math.max(0,model.now-(model.epoch??model.now));else model.epoch=model.now-model.frozenElapsed;model.reducedMotion=next}
 return Object.assign(model,{setNames,sample,start,reveal,resize,motion});
}
