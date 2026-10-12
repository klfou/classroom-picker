// One artwork language for every pose and backend. Card names are immutable
// atlas entries; high-resolution selection uses the very same paint function.
import {hash} from './space-card-model.js';
import {paintSpaceCountdown} from './space-countdown.js';
export const FONT='"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
// Dark technical enamel with ice-blue lettering and broad cool-blue facets.
export const PALETTE=Object.freeze({"top": "#2a3e59", "middle": "#172a40", "bottom": "#0f1d31", "inlay": "#72b7ff", "selectedInlay": "#98cbff", "ink": "#c6def4", "selectedInk": "#d4e7f8", "backTop": "#1b2d44", "back": "#122138", "backBottom": "#0d1a2b", "side": [49, 68, 94], "facet": "rgba(123,180,240,.13)", "facetBottom": "rgba(65,120,196,.13)"});
export function roundRect(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.lineTo(x+w-r,y);g.quadraticCurveTo(x+w,y,x+w,y+r);g.lineTo(x+w,y+h-r);g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);g.lineTo(x+r,y+h);g.quadraticCurveTo(x,y+h,x,y+h-r);g.lineTo(x,y+r);g.quadraticCurveTo(x,y,x+r,y);g.closePath()}
export function createSurfaceFactory(canvas){const doc=canvas.ownerDocument||(typeof document==='undefined'?null:document);return(w,h)=>{let c;if(doc?.createElement)c=doc.createElement('canvas');else if(typeof OffscreenCanvas!=='undefined')c=new OffscreenCanvas(w,h);else c=new canvas.constructor(w,h);c.width=w;c.height=h;return c}}
export function paintCard(g,name,x,y,w,h,selected=false){
 const sx=w/384,sy=h/168;g.save();g.setTransform(sx,0,0,sy,x,y);
 const fill=g.createLinearGradient(13,13,371,155);fill.addColorStop(0,PALETTE.top);fill.addColorStop(.55,PALETTE.middle);fill.addColorStop(1,PALETTE.bottom);g.fillStyle=fill;g.fillRect(0,0,384,168);
 // Broad, quiet interior facets. Outer silhouette and opacity are unchanged.
 g.fillStyle=PALETTE.facet;g.beginPath();g.moveTo(0,0);g.lineTo(384,0);g.lineTo(335,28);g.lineTo(57,28);g.lineTo(18,64);g.lineTo(0,64);g.closePath();g.fill();
 g.fillStyle=PALETTE.facetBottom;g.beginPath();g.moveTo(0,141);g.lineTo(305,141);g.lineTo(343,109);g.lineTo(384,109);g.lineTo(384,168);g.lineTo(0,168);g.closePath();g.fill();
 g.fillStyle=selected?PALETTE.selectedInlay:PALETTE.inlay;g.beginPath();g.moveTo(21,59);g.lineTo(34,49);g.lineTo(34,102);g.lineTo(21,113);g.closePath();g.fill();
 g.globalAlpha=.48;g.beginPath();g.moveTo(341,121);g.lineTo(367,99);g.lineTo(367,120);g.lineTo(341,142);g.closePath();g.fill();g.globalAlpha=1;
 g.textAlign='center';g.textBaseline='middle';let size=54;g.font=`600 ${size}px ${FONT}`;while(g.measureText(name).width>285&&size>17){size-=2;g.font=`600 ${size}px ${FONT}`}g.fillStyle=selected?PALETTE.selectedInk:PALETTE.ink;g.fillText(name,384*.51,168*.51);g.restore();
}
export function createArtCache(surface){
 let pages=[],entries=new Map(),selected=null,revision=0,filtered=new Map();
 const base=surface(384,168);paintCard(base.getContext('2d'),'',0,0,384,168);
 const reverse=surface(384,168),rg=reverse.getContext('2d'),reverseFill=rg.createLinearGradient(0,0,384,168);reverseFill.addColorStop(0,PALETTE.backTop);reverseFill.addColorStop(.5,PALETTE.back);reverseFill.addColorStop(1,PALETTE.backBottom);rg.fillStyle=reverseFill;rg.fillRect(0,0,384,168);rg.fillStyle='rgba(115,169,231,.08)';roundRect(rg,39,28,306,7,3.5);rg.fill();
 // 256x128 tiles, with 8+ pixel gutters. Text is another 29+ pixels inset.
 // At 128 names atlas + fallback samples remain below 67 MiB.
 // GPU filtering uses four isolated mip levels. Canvas blends only the interior name
 // region; its physical edge and inlay use one invariant shared face.
 const TILE_W=256,TILE_H=128,COLS=4,ROWS=8,PER_PAGE=32;
 function setNames(names){
  const unique=[...new Set(names)];pages=[];entries=new Map();filtered=new Map();selected=null;revision++;
  for(let pageIndex=0;pageIndex<Math.ceil(unique.length/PER_PAGE);pageIndex++){
   const count=Math.min(PER_PAGE,unique.length-pageIndex*PER_PAGE),rows=2**Math.ceil(Math.log2(Math.ceil(count/COLS))),image=surface(1024,Math.max(128,rows*128)),g=image.getContext('2d');g.fillStyle=PALETTE.bottom;g.fillRect(0,0,image.width,image.height);const page={image,mips:[image],index:pageIndex};pages.push(page);
   for(let i=0;i<count;i++){const name=unique[pageIndex*PER_PAGE+i],x=i%COLS*TILE_W+8,y=Math.floor(i/COLS)*TILE_H+11,w=240,h=105;paintCard(g,name,x,y,w,h);entries.set(name,{name,page:pageIndex,x,y,width:w,height:h,image,artwork:'obsidian-blue-v5'});const face=surface(384,168),fg=face.getContext('2d');paintCard(fg,name,0,0,384,168);const levels=[face];let prev=face;while(prev.width>24){const mip=surface(Math.max(15,Math.round(prev.width/2)),Math.max(7,Math.round(prev.height/2))),mg=mip.getContext('2d');mg.imageSmoothingEnabled=true;mg.imageSmoothingQuality='high';mg.drawImage(prev,0,0,mip.width,mip.height);levels.push(mip);prev=mip}filtered.set(name,levels)}
   // Four explicit, tile-isolated GPU levels. The chain stops before an
   // entire atlas can collapse into mixed names at a grazing viewing angle.
   for(let level=1;level<=3;level++){
    const previous=page.mips[level-1],mip=surface(previous.width/2,previous.height/2),mg=mip.getContext('2d'),tw=TILE_W/2**(level-1),th=TILE_H/2**(level-1);mg.imageSmoothingEnabled=true;mg.imageSmoothingQuality='high';mg.fillStyle=PALETTE.bottom;mg.fillRect(0,0,mip.width,mip.height);
    for(let i=0;i<count;i++){const tx=i%COLS*tw,ty=Math.floor(i/COLS)*th;mg.drawImage(previous,tx,ty,tw,th,tx/2,ty/2,tw/2,th/2)}page.mips.push(mip);
   }
  }
 }
 function select(name){if(!name){selected=null;return}if(selected?.name===name)return;const image=surface(1024,512),g=image.getContext('2d');g.fillStyle=PALETTE.bottom;g.fillRect(0,0,1024,512);paintCard(g,name,128,88,768,336,true);selected={name,page:pages.length,x:128,y:88,width:768,height:336,image,artwork:'obsidian-blue-v5'}}
 function entry(name,hero=false){return hero&&selected?.name===name?selected:entries.get(name)}
 function source(c,dpr=1){
  const e=entry(c.name,c.selected);if(!e)return null;if(c.selected)return {image:e.image,sx:e.x,sy:e.y,sw:e.width,sh:e.height};
  const levels=filtered.get(c.name),lod=Math.max(0,Math.min(levels.length-1,Math.log2(384/Math.max(1,c.width*dpr)))),index=Math.floor(lod),fine=levels[index],coarse=levels[Math.min(index+1,levels.length-1)];return {image:fine,sx:0,sy:0,sw:fine.width,sh:fine.height,base,coarse,blend:lod-index};
 }
 function stats(){const pixels=base.width*base.height+reverse.width*reverse.height+pages.reduce((sum,p)=>sum+p.mips.reduce((n,c)=>n+c.width*c.height,0),0)+[...filtered.values()].reduce((sum,levels)=>sum+levels.reduce((n,c)=>n+c.width*c.height,0),0)+(selected?selected.image.width*selected.image.height:0);return {names:entries.size,pages:pages.length,selected:!!selected,cpuBytes:pixels*4,revision}}
 return {setNames,select,entry,source,stats,reverse,get pages(){return pages},get selected(){return selected},get revision(){return revision},dispose(){pages=[];entries.clear();filtered.clear();selected=null}};
}
export function background(surface,width,height,dpr=1){
 const c=surface(Math.max(1,Math.round(width*dpr)),Math.max(1,Math.round(height*dpr))),g=c.getContext('2d');g.scale(dpr,dpr);const base=g.createLinearGradient(0,0,width,height);base.addColorStop(0,'#040914');base.addColorStop(.48,'#071120');base.addColorStop(1,'#030711');g.fillStyle=base;g.fillRect(0,0,width,height);
 for(const [x,y,r,color] of [[.69,.31,.62,'rgba(36,77,145,.12)'],[.23,.88,.52,'rgba(22,45,99,.12)']]){const glow=g.createRadialGradient(width*x,height*y,0,width*x,height*y,Math.max(width,height)*r);glow.addColorStop(0,color);glow.addColorStop(1,'rgba(4,12,29,0)');g.fillStyle=glow;g.fillRect(0,0,width,height)}
 for(let i=0;i<180;i++){g.fillStyle=`rgba(147,179,225,${.15+hash(i+414)*.46})`;g.beginPath();g.arc(hash(i+31)*width,hash(i+771)*height,.35+hash(i+963)*1.1,0,Math.PI*2);g.fill()}
 return c;
}
export function countdownLayout(width,height){return {width:Math.min(1100,width*.91),height:Math.min(390,height*.75),x:width/2,y:height*.49}}
export const paintCountdown=paintSpaceCountdown;
export function paintEmpty(g,width,height){g.textAlign='center';g.textBaseline='middle';g.fillStyle='#d1e1f4';g.font=`500 ${Math.max(16,Math.min(26,width*.055))}px ${FONT}`;g.fillText('添加学生，点亮这片星空',width/2,height*.47);g.fillStyle='#8a9eb9';g.font=`400 ${Math.max(12,Math.min(15,width*.037))}px ${FONT}`;g.fillText('在「班级与座位」中添加或导入名单',width/2,height*.47+38)}
