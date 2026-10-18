// One artwork language for every pose and backend. Card names are immutable
// atlas entries; high-resolution selection uses the very same paint function.
import {hash} from './space-card-model.js';
import {paintSpaceCountdown} from './space-countdown.js';
export const FONT='"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
// Cool porcelain and brushed silver against an indigo orbital field.
export const PALETTE=Object.freeze({top:'#f2f3fa',middle:'#e5e8f0',bottom:'#c8cfde',inlay:'#827aac',selectedInlay:'#827aac',ink:'#26304c',selectedInk:'#26304c',backTop:'#abb4cd',back:'#858fae',backBottom:'#626f93',side:[118,128,154],facet:'rgba(255,255,255,.60)',facetBottom:'rgba(105,116,146,.10)'});
export function roundRect(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.lineTo(x+w-r,y);g.quadraticCurveTo(x+w,y,x+w,y+r);g.lineTo(x+w,y+h-r);g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);g.lineTo(x+r,y+h);g.quadraticCurveTo(x,y+h,x,y+h-r);g.lineTo(x,y+r);g.quadraticCurveTo(x,y,x+r,y);g.closePath()}
export function createSurfaceFactory(canvas){const doc=canvas.ownerDocument||(typeof document==='undefined'?null:document);return(w,h)=>{let c;if(doc?.createElement)c=doc.createElement('canvas');else if(typeof OffscreenCanvas!=='undefined')c=new OffscreenCanvas(w,h);else c=new canvas.constructor(w,h);c.width=w;c.height=h;return c}}
export function paintCard(g,name,x,y,w,h,selected=false){
 const sx=w/384,sy=h/168;g.save();g.setTransform(sx,0,0,sy,x,y);
 const fill=g.createLinearGradient(40,8,324,176);fill.addColorStop(0,PALETTE.top);fill.addColorStop(.48,PALETTE.middle);fill.addColorStop(1,PALETTE.bottom);g.fillStyle=fill;g.fillRect(0,0,384,168);
 // Two inset bevels are cached in the artwork, not drawn once per live card.
 g.lineWidth=2;g.strokeStyle='rgba(255,255,255,.87)';roundRect(g,17,17,350,134,17);g.stroke();
 g.lineWidth=1;g.strokeStyle='rgba(77,88,122,.14)';roundRect(g,20,20,344,128,14);g.stroke();
 const sheen=g.createLinearGradient(28,20,28,76);sheen.addColorStop(0,'rgba(255,255,255,.52)');sheen.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=sheen;roundRect(g,21,21,342,58,13);g.fill();
 g.fillStyle=PALETTE.inlay;roundRect(g,32,39,4,89,2);g.fill();
 g.fillStyle='rgba(94,96,147,.27)';roundRect(g,321,119,23,3,1.5);g.fill();g.beginPath();g.arc(351,120.5,1.5,0,Math.PI*2);g.fill();
 g.textAlign='center';g.textBaseline='middle';let size=54;g.font=`600 ${size}px ${FONT}`;while(g.measureText(name).width>278&&size>17){size-=2;g.font=`600 ${size}px ${FONT}`}g.fillStyle=PALETTE.ink;g.fillText(name,384*.52,168*.51);g.restore();
}
export function createArtCache(surface){
 let pages=[],entries=new Map(),selected=null,revision=0,filtered=new Map();
 const base=surface(384,168);paintCard(base.getContext('2d'),'',0,0,384,168);
 const reverse=surface(384,168),rg=reverse.getContext('2d'),reverseFill=rg.createLinearGradient(0,0,384,168);reverseFill.addColorStop(0,PALETTE.backTop);reverseFill.addColorStop(.5,PALETTE.back);reverseFill.addColorStop(1,PALETTE.backBottom);rg.fillStyle=reverseFill;rg.fillRect(0,0,384,168);rg.fillStyle='rgba(226,226,255,.18)';roundRect(rg,39,28,306,7,3.5);rg.fill();
 // 256x128 tiles, with 8+ pixel gutters. Text is another 29+ pixels inset.
 // At 128 names atlas + fallback samples remain below 67 MiB.
 // GPU filtering uses four isolated mip levels. Canvas blends only the interior name
 // region; its physical edge and inlay use one invariant shared face.
 const TILE_W=256,TILE_H=128,COLS=4,ROWS=8,PER_PAGE=32;
 function setNames(names){
  const unique=[...new Set(names)];pages=[];entries=new Map();filtered=new Map();selected=null;revision++;
  for(let pageIndex=0;pageIndex<Math.ceil(unique.length/PER_PAGE);pageIndex++){
   const count=Math.min(PER_PAGE,unique.length-pageIndex*PER_PAGE),rows=2**Math.ceil(Math.log2(Math.ceil(count/COLS))),image=surface(1024,Math.max(128,rows*128)),g=image.getContext('2d');g.fillStyle=PALETTE.bottom;g.fillRect(0,0,image.width,image.height);const page={image,mips:[image],index:pageIndex};pages.push(page);
   for(let i=0;i<count;i++){const name=unique[pageIndex*PER_PAGE+i],x=i%COLS*TILE_W+8,y=Math.floor(i/COLS)*TILE_H+11,w=240,h=105;paintCard(g,name,x,y,w,h);entries.set(name,{name,page:pageIndex,x,y,width:w,height:h,image,artwork:'orbital-silver-v1'});const face=surface(384,168),fg=face.getContext('2d');paintCard(fg,name,0,0,384,168);const levels=[face];let prev=face;while(prev.width>24){const mip=surface(Math.max(15,Math.round(prev.width/2)),Math.max(7,Math.round(prev.height/2))),mg=mip.getContext('2d');mg.imageSmoothingEnabled=true;mg.imageSmoothingQuality='high';mg.drawImage(prev,0,0,mip.width,mip.height);levels.push(mip);prev=mip}filtered.set(name,levels)}
   // Four explicit, tile-isolated GPU levels. The chain stops before an
   // entire atlas can collapse into mixed names at a grazing viewing angle.
   for(let level=1;level<=3;level++){
    const previous=page.mips[level-1],mip=surface(previous.width/2,previous.height/2),mg=mip.getContext('2d'),tw=TILE_W/2**(level-1),th=TILE_H/2**(level-1);mg.imageSmoothingEnabled=true;mg.imageSmoothingQuality='high';mg.fillStyle=PALETTE.bottom;mg.fillRect(0,0,mip.width,mip.height);
    for(let i=0;i<count;i++){const tx=i%COLS*tw,ty=Math.floor(i/COLS)*th;mg.drawImage(previous,tx,ty,tw,th,tx/2,ty/2,tw/2,th/2)}page.mips.push(mip);
   }
  }
 }
 function select(name){if(!name){selected=null;return}if(selected?.name===name)return;const image=surface(1024,512),g=image.getContext('2d');g.fillStyle=PALETTE.bottom;g.fillRect(0,0,1024,512);paintCard(g,name,128,88,768,336,true);selected={name,page:pages.length,x:128,y:88,width:768,height:336,image,artwork:'orbital-silver-v1'}}
 function entry(name,hero=false){return hero&&selected?.name===name?selected:entries.get(name)}
 function source(c,dpr=1){
  const e=entry(c.name,c.selected);if(!e)return null;if(c.selected)return {image:e.image,sx:e.x,sy:e.y,sw:e.width,sh:e.height};
  const levels=filtered.get(c.name),lod=Math.max(0,Math.min(levels.length-1,Math.log2(384/Math.max(1,c.width*dpr)))),index=Math.floor(lod),fine=levels[index],coarse=levels[Math.min(index+1,levels.length-1)];return {image:fine,sx:0,sy:0,sw:fine.width,sh:fine.height,base,coarse,blend:lod-index};
 }
 function stats(){const pixels=base.width*base.height+reverse.width*reverse.height+pages.reduce((sum,p)=>sum+p.mips.reduce((n,c)=>n+c.width*c.height,0),0)+[...filtered.values()].reduce((sum,levels)=>sum+levels.reduce((n,c)=>n+c.width*c.height,0),0)+(selected?selected.image.width*selected.image.height:0);return {names:entries.size,pages:pages.length,selected:!!selected,cpuBytes:pixels*4,revision}}
 return {setNames,select,entry,source,stats,reverse,get pages(){return pages},get selected(){return selected},get revision(){return revision},dispose(){pages=[];entries.clear();filtered.clear();selected=null}};
}
export function background(surface,width,height,dpr=1){
 const c=surface(Math.max(1,Math.round(width*dpr)),Math.max(1,Math.round(height*dpr))),g=c.getContext('2d');g.scale(dpr,dpr);const base=g.createLinearGradient(0,0,width,height);base.addColorStop(0,'#070b1c');base.addColorStop(.48,'#10172f');base.addColorStop(1,'#070c1e');g.fillStyle=base;g.fillRect(0,0,width,height);
 for(const [x,y,r,color] of [[.45,.46,.51,'rgba(100,76,158,.19)'],[.80,.16,.38,'rgba(65,94,150,.12)'],[.13,.91,.42,'rgba(86,70,135,.10)']]){const glow=g.createRadialGradient(width*x,height*y,0,width*x,height*y,Math.max(width,height)*r);glow.addColorStop(0,color);glow.addColorStop(1,'rgba(9,13,32,0)');g.fillStyle=glow;g.fillRect(0,0,width,height)}
 for(let i=0;i<68;i++){const x=hash(i+31)*width,y=hash(i+771)*height,bright=hash(i+414),r=.32+hash(i+963)*.95;g.fillStyle=`rgba(204,208,246,${.10+bright*.24})`;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();if(bright>.999){g.strokeStyle='rgba(204,208,246,.24)';g.lineWidth=.5;g.beginPath();g.moveTo(x-4,y);g.lineTo(x+4,y);g.moveTo(x,y-4);g.lineTo(x,y+4);g.stroke()}}
 const vignette=g.createRadialGradient(width/2,height/2,height*.15,width/2,height/2,Math.max(width,height)*.67);vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,2,14,.42)');g.fillStyle=vignette;g.fillRect(0,0,width,height);
 return c;
}
export function countdownLayout(width,height){return {width:Math.min(1100,width*.91),height:Math.min(390,height*.75),x:width/2,y:height*.49}}
export const paintCountdown=paintSpaceCountdown;
export function paintEmpty(g,width,height){g.textAlign='center';g.textBaseline='middle';g.fillStyle='#d1e1f4';g.font=`500 ${Math.max(16,Math.min(26,width*.055))}px ${FONT}`;g.fillText('添加学生，点亮这片星空',width/2,height*.47);g.fillStyle='#8a9eb9';g.font=`400 ${Math.max(12,Math.min(15,width*.037))}px ${FONT}`;g.fillText('在「班级与座位」中添加或导入名单',width/2,height*.47+38)}
