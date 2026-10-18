// Renderer-independent spatial model. Coordinates are x-right, y-down, z-away.
// This model never selects a student, reads a clock, or schedules a frame.
import {SPACE_DRAW_TIMING} from './draw-timing.js';
export const CARD = Object.freeze({width:384,height:168,scale:.82,thickness:.05,idleScale:1.13,idlePeriod:72000,shellCount:64});
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
const createShell=count=>Array.from({length:count},(_,i)=>{const y=2*(i+.5)/count-1,r=Math.sqrt(1-y*y),lon=i*Math.PI*(3-Math.sqrt(5)),s=Math.sin(lon),c=Math.cos(lon);return {x:r*s,y,z:-r*c,ux:c,uy:0,uz:s,vx:-y*s,vy:r,vz:y*c}});
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
  const count=names.length?Math.min(128,names.length):0,baseCount=count,shellCount=Math.max(64,count),shell=createShell(shellCount),occupied=new Set();
  for(let i=0;i<count;i++){
   // Stratified paths cross the whole screen, including the central reading lanes.
   const seed=i<baseCount?i:IDLE_INTERLEAVE[i-baseCount],region=seed%9,slot=Math.floor(seed/9),members=Math.floor((baseCount+8-region)/9),col=region%3,row=Math.floor(region/3),angle=(region===4?1.13:Math.atan2(row-1,col-1))+(hash(seed+311)-.5)*.70,mobile=(region===4?1.13:Math.atan2(row-1,col-1))+(hash(region+311)-.5)*.38,index=Math.floor(i*shellCount/count);
   const c=card(i,names[i%names.length]);Object.assign(c,{rosterIndex:i%names.length,regionX:col-1,regionY:row-1,anchorX:(col-1)*.64+(hash(seed+181)-.5)*.42,anchorY:(row-1)*.64+(hash(seed+619)-.5)*.34,u:Math.cos(angle),v:Math.sin(angle),mobileU:Math.cos(mobile),mobileV:Math.sin(mobile),phase:fract((slot+.23+(i>=baseCount?.42:0))/members+region*.137),nearZ:6+hash(seed+287)*1.1,shell:shell[index]});model.cards.push(c);occupied.add(index);
  }
  if(count)for(let i=0;i<shellCount;i++)if(!occupied.has(i)){const source=model.cards[Math.floor(i*count/shellCount)],id=count+model.extras.length,c=card(id,names[(id+(count>=names.length?Math.ceil(names.length*.37):0))%names.length]);Object.assign(c,{extra:true,source,rosterIndex:(id+(count>=names.length?Math.ceil(names.length*.37):0))%names.length,shell:shell[i]});model.extras.push(c)}
  model.allCards=model.cards.concat(model.extras);
 }
 function idle(c,now){
  const {width,height,focal,aspect}=model,count=model.cards.length;
  // Three gently curved, staggered depth bands replace the all-roster grid.
  // A representative spread of at most 30 cards rests here; every seat keeps
  // its physical card and joins the spherical draw with the original identity.
  const limit=Math.min(count,aspect<1?18:30),slot=Math.floor(c.id*limit/count),shown=Math.ceil(slot*count/limit)===c.id;
  const columns=aspect<1?3:Math.min(5,Math.max(1,Math.ceil(Math.sqrt(limit*aspect/2.6)))),rows=Math.max(1,Math.ceil(limit/columns)),basePerRow=Math.floor(limit/rows),extraRows=limit%rows;
  let row=0,offset=slot;while(offset>=basePerRow+(row<extraRows?1:0)){offset-=basePerRow+(row<extraRows?1:0);row++}
  const members=basePerRow+(row<extraRows?1:0),layer=Math.min(2,Math.floor(row*3/rows)),depth=17-layer*3.1;
  const padX=Math.max(26,Math.min(130,width*.09)),padY=Math.max(24,Math.min(58,height*.09));
  const pitchX=(width-2*padX)/Math.max(columns+.2,2.8),pitchY=(height-2*padY)/Math.max(rows,3.8);
  const cardWidth=Math.min(pitchX*.76,pitchY*1.75,190)*(1+(layer-1)*.055),normalized=(offset-(members-1)/2)/Math.max(1,members/2);
  const stagger=(row%2?.22:-.22)*pitchX;
  const x=(offset-(members-1)/2)*pitchX*(.94+layer*.025)+stagger;
  const rowY=(row-(rows-1)/2)*pitchY,arc=(normalized*normalized-.35)*pitchY*.36;
  const y=rowY+arc;
  const elapsed=model.reducedMotion?model.frozenElapsed:Math.max(0,now-(model.epoch??now)),breath=Math.sin(elapsed/18000+layer*.7)*.10;
  c.x=(shown?x:(c.id%2?1:-1)*(width*.58+cardWidth))*depth/focal;c.y=y*depth/focal;c.z=depth-breath;c.size=cardWidth*depth/(focal*1.8);
  c.idleCycle=0;c.idleDepth=layer/2;c.idleLayer=layer;c.idleOpacity=1;c.idleInView=shown;c.distanceShade=(2-layer)*.08;
  // Stable identities include offscreen reserve cards, so duplicate names and
  // arbitrary small classes always have an exact source for result projection.
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
  const elapsed=Math.max(0,model.now-model.startedAt),t=model.timing,gather=smooth(elapsed/t.gather),disperse=smooth((elapsed-t.gather-t.rotate)/t.scatter),shellMix=model.drawing&&!model.reducedMotion&&elapsed<t.total?gather*(1-disperse):0;
  model.stage=model.drawing?(elapsed<t.gather?'gather':elapsed<t.gather+t.rotate?'rotate':elapsed<t.total?'disperse':'awaiting-reveal'):(model.winner?'selected':'idle');
  const angle=-.35+clamp((elapsed-t.gather)/t.rotate)*t.turn,cs=Math.cos(angle),sn=Math.sin(angle),ct=Math.cos(-.18),st=Math.sin(-.18),sphereScale=Math.min(1,model.aspect/1.18),radius=3.05*sphereScale;
  // Keep absolute-time idle lives/names current behind result/timer views.
  // Their hidden meshes need no perspective projection, orientation or sorting.
  const revealAge=model.reducedMotion?1:clamp((model.now-model.revealedAt)/360),revealProgress=1-Math.pow(1-revealAge,3);
  const hideBackground=!!model.countdown||!!model.winner&&!model.drawing&&revealAge>=1;
  model.order.length=0;model.visibleCardCount=0;
  for(const c of model.cards){idle(c,model.now);c.idleX=c.x;c.idleY=c.y;c.idleZ=c.z;c.idleSize=c.size}
  if(!hideBackground)for(let cardIndex=0;cardIndex<model.allCards.length;cardIndex++){
   const c=model.allCards[cardIndex];
   if(model.winner&&!model.drawing&&c.id===model.selected?.sourceCardId)continue;
   if(c.extra&&shellMix<=0){c.opacity=0;continue}
   const source=c.extra?c.source:c;if(c.extra){c.x=source.idleX;c.y=source.idleY;c.z=source.idleZ;c.size=source.idleSize;c.distanceShade=source.distanceShade}
   c.shellMix=shellMix;c.opacity=1;c.uAxis.x=1;c.uAxis.y=0;c.uAxis.z=0;c.vAxis.x=0;c.vAxis.y=1;c.vAxis.z=0;c.normal.x=0;c.normal.y=0;c.normal.z=-1;
   if(shellMix>0){
    const p=c.shell,n=c.targetNormal,u=c.targetU,v=c.targetV,size=.79*CARD.scale*sphereScale;rotate(p.x,p.y,p.z,n,cs,sn,ct,st);rotate(p.ux,p.uy,p.uz,u,cs,sn,ct,st);rotate(p.vx,p.vy,p.vz,v,cs,sn,ct,st);
    if(elapsed<t.gather+t.rotate){c.x=mix(source.startX,n.x*radius,gather);c.y=mix(source.startY,n.y*radius,gather);c.z=mix(source.startZ,10.2+n.z*radius,gather);c.size=mix(source.startSize,size,gather)}
    else{c.x=mix(n.x*radius,c.x,disperse);c.y=mix(n.y*radius,c.y,disperse);c.z=mix(10.2+n.z*radius,c.z,disperse);c.size=mix(size,c.size,disperse)}
    // Supplementary shell cards grow from their source, never cross-fade names.
    if(c.extra)c.size*=Math.max(.00001,shellMix);// During the orbit, physical plaques lie tangent to the spherical shell.
    // Side-on silhouettes and darker backs reveal its depth; idle faces stay upright.
    orient(c,u,v,n,shellMix);
   }
   if(model.winner&&!model.drawing){
    // Release the rest physically through the edges while the selected card
    // enters. This avoids an empty flash when its real source was off-screen.
    const exit=revealProgress*1.22;c.x+=(c.x>=0?1:-1)*model.aspect*c.z/1.26*exit;c.y+=(c.y>=0?1:-1)*c.z/1.26*exit*.24;
   }
   project(c);c.shade=mix(1-c.distanceShade,.52+.48*clamp((13.25-c.z)/6.1),shellMix);if(model.drawing&&model.reducedMotion)c.shade*=.6;if(!hideBackground){model.order.push(c);if(c.inView&&c.size>.001)model.visibleCardCount++;}
  }
  if(model.order.length>1)model.order.sort((a,b)=>b.z-a.z||a.id-b.id);
  if(model.winner&&!model.drawing&&!model.countdown){
   const c=model.selected,p=revealProgress,w=Math.min(590,model.height*.92,model.width*.80),endSize=w*3/(model.focal*1.8);
   // Preserve the exact roster identity and its projected pose. The same card
   // travels toward the camera; no large replacement card appears at reveal.
   c.x=mix(c.revealX,0,p);c.y=mix(c.revealY,0,p);c.z=mix(c.revealZ,3,p);c.size=mix(c.revealSize,endSize,p);c.shade=mix(c.revealShade,1,p);c.opacity=1;project(c);model.order.push(c);if(c.inView&&c.size>.001)model.visibleCardCount++;if(model.order.length>1)model.order.sort((a,b)=>b.z-a.z||a.id-b.id);
  }
  return model;
 }
 function start(now,profile=SPACE_DRAW_TIMING){if(!model.names.length)return false;model.drawing=false;model.winner='';model.selected=null;sample(now);for(const c of model.cards){c.startX=c.x;c.startY=c.y;c.startZ=c.z;c.startSize=c.size}model.timing=profile;model.startedAt=now;model.drawing=true;sample(now);return true}
 function reveal(name,now,rosterIndex){
  if(!model.names.includes(name))return false;
  const index=Number.isInteger(rosterIndex)&&model.names[rosterIndex]===name?rosterIndex:model.names.indexOf(name);
  sample(now);
  // The host passes its selected seat index, so duplicate names remain distinct.
  let source=null;for(const c of model.cards)if(c.rosterIndex===index&&(!source||c.inView&&!source.inView||c.inView===source.inView&&c.z<source.z))source=c;
  if(!source)return false;
  const c=card(128,name);c.rosterIndex=index;c.sourceCardId=source.id;c.selected=true;c.revealX=source.x;c.revealY=source.y;c.revealZ=source.z;c.revealSize=source.size;c.revealShade=source.shade;
  model.drawing=false;model.winner=name;model.revealedAt=now;model.selected=c;sample(now);return true;
 }
 function resize(w,h){model.width=w;model.height=h;model.aspect=w/h;model.focal=h*1.26}
 function motion(next){if(next===model.reducedMotion)return;if(next)model.frozenElapsed=Math.max(0,model.now-(model.epoch??model.now));else model.epoch=model.now-model.frozenElapsed;model.reducedMotion=next}
 return Object.assign(model,{setNames,sample,start,reveal,resize,motion});
}
