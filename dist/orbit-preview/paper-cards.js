// Paper is a presentation-only adapter. The scene owns the clock, RAF and draw.
// A prepared real winner alone turns; reveal commits it without a second animation.
import {countdownDisplay} from './space-countdown.js';
import {countdownDigitLayout,countdownFinishLayout} from './countdown-digit-layout.js';

import {PAPER_DRAW_TIMING} from './draw-timing.js';
export {PAPER_DRAW_TIMING} from './draw-timing.js';
export const PAPER_PALETTE=Object.freeze({background:'#321824',paper:'#f5f0e8',back:'#6b3049',pattern:'#ab858f',ink:'#392936',muted:'#827779',edge:'#d8ceca'});
const FONT='"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const SERIF='"Noto Serif CJK SC", "Noto Serif SC", "Songti SC", "SimSun", serif';
const SUITS=['♠','♥','♣','♦'],SUIT_BERRY='#883b52';
const NUMBER_FONT='"Noto Sans", "DejaVu Sans", Arial, sans-serif';
const TAU=Math.PI*2,ART_W=480,ART_H=672,TIMER_W=320,TIMER_H=448,RESULT_SETTLE_MS=260;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const finite=(x,f=0)=>Number.isFinite(x)?x:f;
const mix=(a,b,t)=>t<=0?a:t>=1?b:a+(b-a)*t;
const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
const ease=t=>1-(1-clamp(t))**3;
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453123;return x-Math.floor(x)};
function rounded(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.lineTo(x+w-r,y);g.quadraticCurveTo(x+w,y,x+w,y+r);g.lineTo(x+w,y+h-r);g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);g.lineTo(x+r,y+h);g.quadraticCurveTo(x,y+h,x,y+h-r);g.lineTo(x,y+r);g.quadraticCurveTo(x,y,x+r,y);g.closePath()}
function path(g,points){g.beginPath();points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath()}
function surfaceFactory(canvas){const doc=canvas.ownerDocument??(typeof document==='undefined'?null:document);return(w,h)=>{let c;if(doc?.createElement)c=doc.createElement('canvas');else if(typeof OffscreenCanvas!=='undefined')c=new OffscreenCanvas(w,h);else c=new canvas.constructor(w,h);c.width=w;c.height=h;return c}}
function grain(g,w,h,alpha=.035,step=8){g.fillStyle=`rgba(100,87,90,${alpha})`;for(let y=3;y<h;y+=step)for(let x=3;x<w;x+=step){const seed=x*17+y*67;g.fillRect(x+hash(seed)*step*.7,y+hash(seed+1)*step*.7,.55+hash(seed+2)*.5,.55)}}
const AW=420,AH=588;
function ovalLeaf(g,x,y,a,len){g.save();g.translate(x,y);g.rotate(a);g.beginPath();g.moveTo(0,0);g.bezierCurveTo(-len*.45,-len*.5,-len*.42,-len*.83,0,-len);g.bezierCurveTo(len*.42,-len*.83,len*.45,-len*.5,0,0);g.stroke();g.beginPath();g.moveTo(0,0);g.lineTo(0,-len*.84);g.stroke();g.restore()}
function makeBack(surface){
 const c=surface(ART_W,ART_H),g=c.getContext('2d');g.scale(ART_W/AW,ART_H/AH);
 const cream='#eee2cc',soft='#c8aa9b',red='#65293d';
 const f=g.createRadialGradient(AW/2,AH/2,50,AW/2,AH/2,360);f.addColorStop(0,'#78364b');f.addColorStop(1,'#572235');g.fillStyle=f;g.fillRect(0,0,AW,AH);
 // A two-way engraved back: deliberately broad strokes survive a 100 px card.
 g.lineJoin='round';g.lineCap='round';g.strokeStyle=cream;g.lineWidth=5;rounded(g,16,16,AW-32,AH-32,13);g.stroke();
 g.strokeStyle=soft;g.lineWidth=2;rounded(g,27,27,AW-54,AH-54,7);g.stroke();
 g.save();g.translate(AW/2,AH/2);
 function diamond(x,y,w,h,fill=cream){g.beginPath();g.moveTo(x,y-h);g.lineTo(x+w,y);g.lineTo(x,y+h);g.lineTo(x-w,y);g.closePath();g.fillStyle=fill;g.fill()}
 function leaf(x,y,angle,length,width){g.save();g.translate(x,y);g.rotate(angle);g.beginPath();g.moveTo(0,0);g.bezierCurveTo(-width,-length*.38,-width*.72,-length*.79,0,-length);g.bezierCurveTo(width*.72,-length*.79,width,-length*.38,0,0);g.fillStyle=cream;g.fill();g.restore()}
 function suit(type,x,y,size,angle=0){g.save();g.translate(x,y);g.rotate(angle);g.scale(size/40,size/40);g.fillStyle=cream;g.beginPath();
  if(type==='diamond'){g.moveTo(0,-23);g.lineTo(16,0);g.lineTo(0,23);g.lineTo(-16,0);g.closePath()}
  if(type==='heart'){g.moveTo(0,20);g.bezierCurveTo(-7,12,-23,1,-20,-11);g.bezierCurveTo(-17,-24,-4,-23,0,-12);g.bezierCurveTo(4,-23,17,-24,20,-11);g.bezierCurveTo(23,1,7,12,0,20);g.closePath()}
  if(type==='spade'){g.moveTo(0,-23);g.bezierCurveTo(-6,-15,-22,-4,-20,7);g.bezierCurveTo(-18,20,-5,20,0,10);g.bezierCurveTo(5,20,18,20,20,7);g.bezierCurveTo(22,-4,6,-15,0,-23);g.closePath();g.fill();g.beginPath();g.moveTo(-4,6);g.bezierCurveTo(-3,16,-4,20,-10,23);g.lineTo(10,23);g.bezierCurveTo(4,20,3,16,4,6);g.closePath()}
  if(type==='club'){for(const [x,y] of [[0,-12],[-12,3],[12,3]]){g.moveTo(x+11,y);g.arc(x,y,11,0,TAU)}g.fill();g.beginPath();g.moveTo(-4,4);g.bezierCurveTo(-3,16,-4,20,-10,23);g.lineTo(10,23);g.bezierCurveTo(4,20,3,16,4,4);g.closePath()}
  g.fill();g.restore()}
 function crestPath(scale=1){g.save();g.scale(scale,scale);g.beginPath();g.moveTo(0,-149);g.bezierCurveTo(24,-129,63,-126,85,-105);g.bezierCurveTo(104,-87,107,-41,116,0);g.bezierCurveTo(107,41,104,87,85,105);g.bezierCurveTo(63,126,24,129,0,149);g.bezierCurveTo(-24,129,-63,126,-85,105);g.bezierCurveTo(-104,87,-107,41,-116,0);g.bezierCurveTo(-107,-41,-104,-87,-85,-105);g.bezierCurveTo(-63,-126,-24,-129,0,-149);g.closePath();g.restore()}
 // Top and bottom botanical fields and all four corner ornaments are identical
 // under 180-degree rotation. These are full motifs, not a fine repeating mesh.
 for(let end=0;end<2;end++){g.save();g.rotate(end*Math.PI);
  diamond(0,-239,7,12);g.strokeStyle=cream;g.lineWidth=4;g.beginPath();g.moveTo(0,-217);g.lineTo(0,-176);g.stroke();
  leaf(0,-189,0,36,9);leaf(-2,-186,-.72,38,10);leaf(2,-186,.72,38,10);leaf(-4,-175,-1.17,30,9);leaf(4,-175,1.17,30,9);
  for(const side of [-1,1]){g.save();g.scale(side,1);
   g.strokeStyle=cream;g.lineWidth=4;g.beginPath();g.moveTo(19,-166);g.bezierCurveTo(65,-190,83,-216,116,-207);g.bezierCurveTo(148,-198,143,-165,124,-162);g.bezierCurveTo(106,-158,100,-178,113,-184);g.stroke();
   leaf(61,-188,.73,31,9);leaf(88,-207,-.46,25,8);diamond(151,-227,10,16);
   g.strokeStyle=soft;g.lineWidth=3;g.beginPath();g.moveTo(41,-221);g.bezierCurveTo(61,-236,90,-241,118,-233);g.stroke();
   g.strokeStyle=cream;g.lineWidth=4;g.beginPath();g.moveTo(165,-199);g.lineTo(165,-156);g.bezierCurveTo(165,-133,151,-120,133,-113);g.stroke();
   leaf(161,-155,.54,28,9);leaf(155,-133,-.71,28,9);
  g.restore()}
 g.restore()}
 // The side arabesques continue the end fields without crowding the crest.
 for(const side of [-1,1]){g.save();g.scale(side,1);diamond(161,0,13,24);
  for(const end of [-1,1]){g.save();g.scale(1,end);g.strokeStyle=cream;g.lineWidth=4;g.beginPath();g.moveTo(156,-33);g.bezierCurveTo(181,-63,165,-105,143,-96);g.bezierCurveTo(120,-86,137,-63,149,-71);g.stroke();leaf(168,-58,.32,26,8);g.restore()}
  g.restore()}
 // The central double-line cartouche contains all four suits in a mirrored
 // two-ended fan: spade, heart, club and diamond. No font glyph dependency.
 crestPath();g.fillStyle=red;g.fill();g.strokeStyle=cream;g.lineWidth=5;g.stroke();crestPath(.91);g.strokeStyle=soft;g.lineWidth=2.5;g.stroke();
 for(let end=0;end<2;end++){g.save();g.rotate(end*Math.PI);
  diamond(0,-114,5,8);suit('spade',-26,-78,33);suit('heart',26,-78,33);suit('club',-51,-30,33);suit('diamond',51,-30,33);
  g.strokeStyle=cream;g.lineWidth=3;g.beginPath();g.moveTo(-23,-29);g.bezierCurveTo(-9,-36,-7,-49,0,-57);g.bezierCurveTo(7,-49,9,-36,23,-29);g.stroke();
 g.restore()}
 diamond(0,0,11,17);g.strokeStyle=cream;g.lineWidth=3;for(const side of [-1,1]){g.beginPath();g.moveTo(side*23,0);g.lineTo(side*83,0);g.stroke();diamond(side*87,0,4,6)}
 g.restore();return c
}
function makeFront(surface){const c=surface(ART_W,ART_H),g=c.getContext('2d');g.scale(ART_W/AW,ART_H/AH);const f=g.createLinearGradient(0,0,AW,AH);f.addColorStop(0,'#faf7f1');f.addColorStop(.55,'#f4efe7');f.addColorStop(1,'#e8e1da');g.fillStyle=f;g.fillRect(0,0,AW,AH);g.strokeStyle='rgba(142,123,126,.36)';g.lineWidth=1.3;rounded(g,18,18,AW-36,AH-36,13);g.stroke();g.strokeStyle='rgba(166,151,151,.44)';g.lineWidth=.8;
 // Both rounded rules are complete closed paths. Content is inset inside
 // the inner rule; the cached paper is never erased or masked around ink.
 rounded(g,26,26,AW-52,AH-52,9);g.stroke();
 g.strokeStyle='rgba(146,129,132,.30)';for(const [x,y] of [[AW-45,45],[45,AH-45]]){g.beginPath();g.moveTo(x+(x<100?14:-14),y);g.lineTo(x,y);g.lineTo(x,y+(y<100?14:-14));g.stroke()}
 grain(g,AW,AH,.085,5);return c}
function makeCard(surface,back=false){return back?makeBack(surface):makeFront(surface)}
function selectedDecoration(index){const suit=SUITS[index%4];return {index,rank:String(2+index%9),suit,color:suit==='♥'||suit==='♦'?SUIT_BERRY:PAPER_PALETTE.ink}}
function paintSelectedCorners(g,index){const {rank,suit,color}=selectedDecoration(index);g.save();g.fillStyle=color;g.textAlign='center';g.textBaseline='middle';for(let i=0;i<2;i++){g.save();if(i){g.translate(ART_W,ART_H);g.rotate(Math.PI)}g.font=`600 64px ${NUMBER_FONT}`;g.fillText(rank,86,82);g.font=`400 60px ${NUMBER_FONT}`;g.fillText(suit,86,148);g.restore()}g.restore()}
function paintSelected(g,front,name,index){g.clearRect(0,0,ART_W,ART_H);g.drawImage(front,0,0);paintSelectedCorners(g,index);g.textAlign='center';g.textBaseline='middle';g.fillStyle=PAPER_PALETTE.muted;g.font=`500 22px ${FONT}`;g.fillText('本 次 点 名',ART_W/2,ART_H*.30);let size=92;g.font=`600 ${size}px ${SERIF}`;while(g.measureText(name).width>ART_W*.79&&size>22){size-=2;g.font=`600 ${size}px ${SERIF}`}g.fillStyle=PAPER_PALETTE.ink;const lines=[];let line='';for(const char of name){if(line&&g.measureText(line+char).width>ART_W*.79){lines.push(line);line=char}else line+=char}if(line)lines.push(line);for(let i=0;i<lines.length;i++)g.fillText(lines[i],ART_W/2,ART_H*.49+(i-(lines.length-1)/2)*size*1.22);g.fillStyle='#b1a3a6';rounded(g,ART_W/2-21,ART_H*.64,42,4,2);g.fill()}
// The paper stock, central glyphs and compact corners are cached separately.
// A whole numeric run needs two small atlases, not forty full-size faces.
const CORE_W=256,CORE_H=320,CORNER_W=72,CORNER_H=108,CORNER_X=14,CORNER_Y=17;
const NUMERIC_INK_H=280,NUMERIC_INK_W=NUMERIC_INK_H*.76,NUMERIC_CORNER_W=128,NUMERIC_CORNER_H=64,NUMERIC_CORNER_SCALE=1/432;
const TIMER_CORNER=Object.freeze({rankSize:64*TIMER_W/ART_W,suitSize:60*TIMER_W/ART_W,x:74*TIMER_W/ART_W,rankY:73*TIMER_H/ART_H,suitY:139*TIMER_H/ART_H,centralSize:TIMER_W*.9});
const NUMERIC_CORNER=Object.freeze({...TIMER_CORNER,flow:'inline',rankX:27,suitX:84,rankY:32,suitY:32,width:NUMERIC_CORNER_W,height:NUMERIC_CORNER_H});
function timerDecoration(char,slot){const suit=SUITS[slot%SUITS.length];return {rank:/^[0-9]$/.test(char)?char:'',suit,color:suit==='♥'||suit==='♦'?SUIT_BERRY:PAPER_PALETTE.ink}}
function rasterInkBounds(g,x,y,w,h,fallback){
 // One readback per cached glyph at startup; unsupported or protected Canvas
 // implementations retain metric bounds without interrupting the countdown.
 if(typeof g.getImageData!=='function')return fallback;
 try{const pixels=g.getImageData(x,y,w,h).data;let minX=w,maxX=-1,minY=h,maxY=-1;for(let py=0;py<h;py++)for(let px=0;px<w;px++)if(pixels[(py*w+px)*4+3]>16){minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py)}return maxX>=minX?{minX,maxX:maxX+1,minY,maxY:maxY+1}:fallback}catch{return fallback}
}
function makeTimerCores(surface,chars,numeric){
 const image=surface(CORE_W*chars.length,CORE_H),g=image.getContext('2d'),cores=new Map();g.clearRect(0,0,image.width,image.height);g.fillStyle=PAPER_PALETTE.ink;g.textAlign='center';g.textBaseline='alphabetic';g.font=`600 ${TIMER_W*(numeric?.9:.76)}px ${numeric?NUMBER_FONT:FONT}`;
 const metrics=[...chars].map(char=>{const m=g.measureText(char);return {char,width:m.width,left:m.actualBoundingBoxLeft??m.width/2,right:m.actualBoundingBoxRight??m.width/2,ascent:m.actualBoundingBoxAscent??TIMER_W*(numeric?.72:.68),descent:m.actualBoundingBoxDescent??TIMER_W*(numeric?.18:0)}}),referenceH=Math.max(...metrics.map(m=>m.ascent+m.descent)),referenceW=Math.max(...metrics.map(m=>m.left+m.right)),scaleY=numeric?NUMERIC_INK_H/referenceH:Math.min((CORE_H-32)/referenceH,(CORE_W-24)/referenceW),scaleX=numeric?Math.min(scaleY,NUMERIC_INK_W/referenceW):scaleY;
 metrics.forEach((m,index)=>{const {char,ascent,descent,left,right}=m,x=index*CORE_W,inkW=(left+right)*scaleX,inkH=(ascent+descent)*scaleY;g.save();g.translate(x+CORE_W/2,CORE_H/2);g.scale(scaleX,scaleY);g.fillText(char,(left-right)/2,(ascent-descent)/2);g.restore();const inkBounds=rasterInkBounds(g,x,0,CORE_W,CORE_H,{minX:(CORE_W-inkW)/2,maxX:(CORE_W+inkW)/2,minY:(CORE_H-inkH)/2,maxY:(CORE_H+inkH)/2});cores.set(char,{image,x,y:0,width:CORE_W,height:CORE_H,inkBounds})});
 // Each alphabet shares one measured scale. Raster bounds include real CJK
 // strokes and numeral overshoots without resizing a card on a timer tick.
 const alphabetHeight=Math.max(...[...cores.values()].map(c=>c.inkBounds.maxY-c.inkBounds.minY)),alphabetWidth=Math.max(...[...cores.values()].map(c=>c.inkBounds.maxX-c.inkBounds.minX));for(const c of cores.values())Object.assign(c,{alphabetHeight,alphabetWidth});
 return {image,cores}
}
function makeTimerCorners(surface,chars){
 const numeric=chars!==' ',cw=numeric?NUMERIC_CORNER_W:CORNER_W,ch=numeric?NUMERIC_CORNER_H:CORNER_H,image=surface(cw*SUITS.length,ch*chars.length),g=image.getContext('2d'),corners=new Map(),inkBounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};g.clearRect(0,0,image.width,image.height);g.textAlign='center';g.textBaseline='middle';
 [...chars].forEach((char,row)=>SUITS.forEach((suit,column)=>{const x=column*cw,y=row*ch,detail=timerDecoration(char,column),metricBounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};g.fillStyle=detail.color;
  function glyph(text,px,py,size,weight){g.font=`${weight} ${size}px ${NUMBER_FONT}`;const m=g.measureText(text);metricBounds.minX=Math.min(metricBounds.minX,px-(m.actualBoundingBoxLeft??m.width/2));metricBounds.maxX=Math.max(metricBounds.maxX,px+(m.actualBoundingBoxRight??m.width/2));metricBounds.minY=Math.min(metricBounds.minY,py-(m.actualBoundingBoxAscent??size/2));metricBounds.maxY=Math.max(metricBounds.maxY,py+(m.actualBoundingBoxDescent??size/2));g.fillText(text,x+px,y+py)}
  if(detail.rank)glyph(detail.rank,numeric?NUMERIC_CORNER.rankX:TIMER_CORNER.x-CORNER_X,numeric?NUMERIC_CORNER.rankY:TIMER_CORNER.rankY-CORNER_Y,TIMER_CORNER.rankSize,600);
  glyph(suit,numeric?NUMERIC_CORNER.suitX:TIMER_CORNER.x-CORNER_X,numeric?NUMERIC_CORNER.suitY:(detail.rank?TIMER_CORNER.suitY:TIMER_CORNER.rankY)-CORNER_Y,TIMER_CORNER.suitSize,400);
  const bounds=rasterInkBounds(g,x,y,cw,ch,metricBounds);for(const key of ['minX','minY'])inkBounds[key]=Math.min(inkBounds[key],bounds[key]);for(const key of ['maxX','maxY'])inkBounds[key]=Math.max(inkBounds[key],bounds[key]);corners.set(`${char}:${suit}`,{image,x,y,width:cw,height:ch})
 }));return {image,corners,inkBounds}
}
function timerComposition(display,width,height,cores){
 if(!display)return null;
 if(!display.finished)return numericTimerComposition(display,width,height,cores);
 const target=countdownFinishLayout(width,height),ink=target.height,reference=cores?.get('时'),alphabetHeight=reference?.alphabetHeight??NUMERIC_INK_H,alphabetWidth=reference?.alphabetWidth??NUMERIC_INK_H,gap=.12,w=Math.min(Math.max(ink*1.15,ink*alphabetWidth/alphabetHeight/.82),width*.94/(3+2*gap)),h=ink*1.36,bodyW=w*(3+2*gap),left=(width-bodyW)/2,cardTop=target.centerY-h/2,cards=[],rect=(x,y,w,h)=>({minX:x,maxX:x+w,minY:y,maxY:y+h});
 for(const [slot,char]of [...'时间到'].entries()){
  const x=left+slot*w*(1+gap),core=cores?.get(char),source=core?.inkBounds??{minX:0,maxX:alphabetWidth,minY:0,maxY:alphabetHeight},glyphScaleY=ink/alphabetHeight,glyphScaleX=Math.min(1,w*.82/(alphabetWidth*glyphScaleY)),glyphWidth=(source.maxX-source.minX)*glyphScaleY*glyphScaleX,glyphHeight=(source.maxY-source.minY)*glyphScaleY,decoration=timerDecoration(char,slot),cornerScale=ink*NUMERIC_CORNER_SCALE,cornerInk=core?.cornerInkBounds??{minX:14,maxX:56,minY:8,maxY:51},innerX=w*26/AW,innerY=h*26/AH,cornerLeft=innerX+w*.025,cornerTop=innerY+ink*.012,cornerWidth=(cornerInk.maxX-cornerInk.minX)*cornerScale,cornerHeight=(cornerInk.maxY-cornerInk.minY)*cornerScale;
  cards.push({char,role:'finish',slot,decoration,faceKey:`${char}:${decoration.suit}`,cornerLayout:TIMER_CORNER,x:x+w/2,y:target.centerY,width:w,height:h,bounds:rect(x,cardTop,w,h),glyphHeight,glyphTargetHeight:ink,glyphScaleY,glyphScaleX,glyphBounds:rect(x+(w-glyphWidth)/2,target.centerY-glyphHeight/2,glyphWidth,glyphHeight),cornerScale,cornerOffsetX:cornerLeft-cornerInk.minX*cornerScale,cornerOffsetY:cornerTop-cornerInk.minY*cornerScale,innerFrameBounds:rect(x+innerX,cardTop+innerY,w-2*innerX,h-2*innerY),cornerEnvelopeBounds:[rect(x+cornerLeft,cardTop+cornerTop,cornerWidth,cornerHeight),rect(x+w-cornerLeft-cornerWidth,cardTop+h-cornerTop-cornerHeight,cornerWidth,cornerHeight)]})
 }
 return {layout:{flow:'finish',colon:null,decimal:null,mainWidth:w,mainHeight:h,minorWidth:0,minorHeight:0,finishTargetHeight:ink,bodyOffsetY:0,bounds:rect(left,cardTop,bodyW,h)},cards}
}
function numericTimerComposition(display,width,height,cores){
 const parts=display.main.split(':'),minutes=(parts[0]||'00').padStart(2,'0'),seconds=(parts[1]||'00').padStart(2,'0'),mainChars=[...minutes+seconds].filter(char=>/^[0-9]$/.test(char)),minorChars=display.minor?[...display.minor.replace(/[^0-9]/g,'').padEnd(2,'0').slice(0,2)]:[],stacked=minorChars.length>0&&width<600&&height>width*.64;
 // The heading is gone, so use the full viewport for the enlarged cards.
 const target=countdownDigitLayout(width,height),ink=target.height,gap=.065,minorScale=.30,colonUnits=.26,minorUnits=minorChars.length*minorScale+Math.max(0,minorChars.length-1)*gap*minorScale,mainUnits=mainChars.length+Math.max(0,mainChars.length-2)*gap+colonUnits,bodyUnits=mainUnits+(!stacked&&minorChars.length?.16+minorUnits:0),w=Math.min(ink*.8,width*.94/bodyUnits),h=ink*1.36,minorW=w*minorScale,minorH=h*minorScale,bodyW=bodyUnits*w,bodyH=h+(stacked?w*.16+minorH:0),left=(width-bodyW)/2,rect=(x,y,w,h)=>({minX:x,maxX:x+w,minY:y,maxY:y+h}),minTop=height*.01,cardTop=Math.max(minTop,Math.min(target.centerY-h/2,height-minTop-bodyH)),cards=[];
 function card(char,role,x,y,cw,ch,scale){const slot=cards.length,decoration=timerDecoration(char,slot),core=cores?.get(char),source=core?.inkBounds,sourceWidth=source?source.maxX-source.minX:NUMERIC_INK_W,sourceHeight=source?source.maxY-source.minY:NUMERIC_INK_H,glyphTargetHeight=ink*scale,glyphScaleY=glyphTargetHeight/(core?.alphabetHeight??NUMERIC_INK_H),glyphHeight=sourceHeight*glyphScaleY,glyphScaleX=Math.min(1,cw*.82/((core?.alphabetWidth??NUMERIC_INK_W)*glyphScaleY)),glyphWidth=sourceWidth*glyphScaleY*glyphScaleX,cornerScale=glyphTargetHeight*NUMERIC_CORNER_SCALE,cornerInk=core?.cornerInkBounds??{minX:5,maxX:110,minY:7,maxY:57},innerX=cw*26/AW,innerY=ch*26/AH,cornerLeft=innerX+cw*.025,cornerTop=innerY+glyphTargetHeight*.012,cornerWidth=(cornerInk.maxX-cornerInk.minX)*cornerScale,cornerHeight=(cornerInk.maxY-cornerInk.minY)*cornerScale;
  // A single measured envelope covers all ten ranks and four suits. Insets
  // and alphabet scaling therefore stay fixed when any displayed digit changes.
  cards.push({char,role,slot,decoration,faceKey:`${char}:${decoration.suit}`,cornerLayout:NUMERIC_CORNER,x:x+cw/2,y:y+ch/2,width:cw,height:ch,bounds:rect(x,y,cw,ch),glyphHeight,glyphTargetHeight,glyphScaleY,glyphScaleX,glyphBounds:rect(x+(cw-glyphWidth)/2,y+(ch-glyphHeight)/2,glyphWidth,glyphHeight),cornerScale,cornerOffsetX:cornerLeft-cornerInk.minX*cornerScale,cornerOffsetY:cornerTop-cornerInk.minY*cornerScale,innerFrameBounds:rect(x+innerX,y+innerY,cw-2*innerX,ch-2*innerY),cornerEnvelopeBounds:[rect(x+cornerLeft,y+cornerTop,cornerWidth,cornerHeight),rect(x+cw-cornerLeft-cornerWidth,y+ch-cornerTop-cornerHeight,cornerWidth,cornerHeight)]})}

 let x=left;for(let i=0;i<mainChars.length;i++){if(i===minutes.length)x+=w*colonUnits;card(mainChars[i],'main',x,cardTop,w,h,1);x+=w;if(i<mainChars.length-1&&i!==minutes.length-1)x+=w*gap}
 const mainRight=left+mainUnits*w,cx=left+(minutes.length+(minutes.length-1)*gap+colonUnits/2)*w,cy=cardTop+h/2,radius=w*.027,colon={x:cx,y:cy,size:w*.22,radius,bounds:rect(cx-radius,cy-w*.11-radius,radius*2,w*.22+radius*2)};let decimal=null;
 if(minorChars.length){const minorLeft=stacked?mainRight-minorUnits*w:mainRight+w*.16,minorTop=stacked?cardTop+h+w*.16:cardTop+h-minorH;minorChars.forEach((char,i)=>card(char,'hundredths',minorLeft+i*minorW*(1+gap),minorTop,minorW,minorH,minorScale));const r=w*.022,dx=minorLeft-w*.073,dy=minorTop+minorH-r;decimal={x:dx,y:dy,radius:r,bounds:rect(dx-r,dy-r,r*2,r*2)}}
 return {layout:{flow:stacked?'stacked':'inline',colon,decimal,mainWidth:w,mainHeight:h,minorWidth:minorW,minorHeight:minorH,digitTargetHeight:ink,bodyOffsetY:0,bounds:{minX:left,maxX:left+bodyW,minY:cardTop,maxY:cardTop+bodyH}},cards}
}
function paintTimerCard(g,c,face,front,shadow){const {minX:x,minY:y}=c.bounds,r=c.width*.035;g.save();g.globalAlpha=.78;g.drawImage(shadow,x-c.width*.15,y-c.height*.06,c.width*1.30,c.height*1.19);g.restore();g.fillStyle='#b8a9ac';rounded(g,x,y+c.width*.010,c.width,c.height,r);g.fill();g.save();rounded(g,x,y,c.width,c.height,r);g.clip();g.translate(x,y);const {core,corner}=face;
 g.drawImage(front,0,0,c.width,c.height);const b=core.inkBounds,scale=c.glyphScaleY,dw=CORE_W*scale*c.glyphScaleX,dh=CORE_H*scale;g.drawImage(core.image,core.x,core.y,core.width,core.height,c.width/2-(b.minX+b.maxX)/2*scale*c.glyphScaleX,c.height/2-(b.minY+b.maxY)/2*scale,dw,dh);for(let i=0;i<2;i++){g.save();if(i){g.translate(c.width,c.height);g.rotate(Math.PI)}g.drawImage(corner.image,corner.x,corner.y,corner.width,corner.height,c.cornerOffsetX,c.cornerOffsetY,corner.width*c.cornerScale,corner.height*c.cornerScale);g.restore()}
 g.restore();g.strokeStyle='rgba(249,242,237,.88)';g.lineWidth=Math.min(1,c.width*.006);rounded(g,x+.4,y+.4,c.width-.8,c.height-.8,r);g.stroke()}
function makeShadow(surface){const c=surface(320,432),g=c.getContext('2d');g.save();g.translate(160,216);g.scale(149,199);const fill=g.createRadialGradient(0,0,0,0,0,1);fill.addColorStop(0,'rgba(14,3,10,.57)');fill.addColorStop(.5,'rgba(14,3,10,.36)');fill.addColorStop(.78,'rgba(14,3,10,.12)');fill.addColorStop(1,'rgba(14,3,10,0)');g.fillStyle=fill;g.fillRect(-1,-1,2,2);g.restore();return c}
function makeBackground(surface,w,h,dpr){const c=surface(Math.max(1,Math.round(w*dpr)),Math.max(1,Math.round(h*dpr))),g=c.getContext('2d');g.scale(dpr,dpr);const base=g.createLinearGradient(0,0,w*.3,h);base.addColorStop(0,'#462231');base.addColorStop(.6,'#351923');base.addColorStop(1,'#25131c');g.fillStyle=base;g.fillRect(0,0,w,h);const light=g.createRadialGradient(w*.46,h*.35,0,w*.46,h*.4,Math.max(w,h)*.65);light.addColorStop(0,'rgba(137,85,108,.18)');light.addColorStop(1,'rgba(18,5,13,.45)');g.fillStyle=light;g.fillRect(0,0,w,h);
 // Woven berry paper, drawn once per canvas size rather than on each frame.
 for(let y=1;y<h;y+=4){g.strokeStyle=`rgba(223,204,211,${.006+hash(y)*.01})`;g.lineWidth=.5;g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke()}grain(g,w,h,.065,7);return c}
const RIM=[];for(const [cx,cy,start] of [[.035,.025,Math.PI],[.965,.025,Math.PI*1.5],[.965,.975,0],[.035,.975,Math.PI*.5]])for(let j=0;j<=4;j++){const a=start+j/4*Math.PI*.5;RIM.push({u:cx+Math.cos(a)*.035,v:cy+Math.sin(a)*.025})}
function project(c,u,v,depth=0,out={}){const x=(u-.5)*c.w,y=(v-.5)*c.h,cy=Math.cos(c.ry),sy=Math.sin(c.ry),cx=Math.cos(c.rx),sx=Math.sin(c.rx),cz=Math.cos(c.rz),sz=Math.sin(c.rz),xx=x*cy+depth*sy,zz=-x*sy+depth*cy,yy=y*cx-zz*sx,z=y*sx+zz*cx,k=c.focal/(c.focal+z);out.x=c.x+(xx*cz-yy*sz)*k;out.y=c.y+(xx*sz+yy*cz)*k;out.z=c.z+z;return out}
function sampleCard(c,focal){c.focal=focal;c.facing=Math.cos(c.ry)*Math.cos(c.rx);c.front??=[];c.back??=[];c.grid??=[];
 for(let i=0;i<RIM.length;i++){const p=RIM[i];c.front[i]=project(c,p.u,p.v,-c.thickness/2,c.front[i]);c.back[i]=project(c,p.u,p.v,c.thickness/2,c.back[i])}
 c.face=c.facing>=0?c.front:c.back;const side=c.facing>=0?-c.thickness/2:c.thickness/2;for(let y=0;y<=2;y++)for(let x=0;x<=2;x++){const i=y*3+x;c.grid[i]=project(c,x/2,y/2,side,c.grid[i])}
 c.minX=Infinity;c.maxX=-Infinity;c.minY=Infinity;c.maxY=-Infinity;for(const p of c.face){c.minX=Math.min(c.minX,p.x);c.maxX=Math.max(c.maxX,p.x);c.minY=Math.min(c.minY,p.y);c.maxY=Math.max(c.maxY,p.y)}return c}
function triangle(g,image,a,b,c,sa,sb,sc){const det=(sb.x-sa.x)*(sc.y-sa.y)-(sb.y-sa.y)*(sc.x-sa.x);if(Math.abs(det)<.001)return;const xx=((b.x-a.x)*(sc.y-sa.y)-(c.x-a.x)*(sb.y-sa.y))/det,xy=((b.y-a.y)*(sc.y-sa.y)-(c.y-a.y)*(sb.y-sa.y))/det,yx=((c.x-a.x)*(sb.x-sa.x)-(b.x-a.x)*(sc.x-sa.x))/det,yy=((c.y-a.y)*(sb.x-sa.x)-(b.y-a.y)*(sc.x-sa.x))/det;
 const mx=(a.x+b.x+c.x)/3,my=(a.y+b.y+c.y)/3;g.save();g.beginPath();for(const [i,p] of [a,b,c].entries()){const d=Math.hypot(p.x-mx,p.y-my)||1,x=p.x+(p.x-mx)/d*1.25,y=p.y+(p.y-my)/d*1.25;i?g.lineTo(x,y):g.moveTo(x,y)}g.closePath();g.clip();g.transform(xx,xy,yx,yy,a.x-xx*sa.x-yx*sa.y,a.y-xy*sa.x-yy*sa.y);g.drawImage(image,0,0);g.restore()}
function paintCard(g,c,image,shadow){if(c.alpha<.005)return;g.save();g.globalAlpha=c.alpha;const shadowW=c.w*(.27+Math.abs(Math.cos(c.ry))*.73)*1.32,shadowH=c.h*1.25;g.save();g.translate(c.x+3+c.lift*.045,c.y+7+c.lift*.21);g.rotate(c.rz);g.globalAlpha=c.alpha*(c.selected?.78:.72)*(.45+.55*Math.abs(c.facing));g.drawImage(shadow,-shadowW/2,-shadowH/2,shadowW,shadowH);g.restore();
 for(let i=0;i<c.front.length;i++){const j=(i+1)%c.front.length;g.fillStyle=i<10?'#b7a8ab':'#eee6df';path(g,[c.front[i],c.front[j],c.back[j],c.back[i]]);g.fill()}
 g.save();path(g,c.face);g.clip();
 // Small display cards need only one projected quad; large cards keep four
 // to remove the visible diagonal crease. Both use the same cached artwork.
 if(c.w<85){const a=c.grid[0],b=c.grid[2],d=c.grid[6],e=c.grid[8];triangle(g,image,a,b,e,{x:0,y:0},{x:ART_W,y:0},{x:ART_W,y:ART_H});triangle(g,image,a,e,d,{x:0,y:0},{x:ART_W,y:ART_H},{x:0,y:ART_H})}
 else for(let y=0;y<2;y++)for(let x=0;x<2;x++){const i=y*3+x,a=c.grid[i],b=c.grid[i+1],d=c.grid[i+3],e=c.grid[i+4],s={x:x*ART_W/2,y:y*ART_H/2},t={x:(x+1)*ART_W/2,y:y*ART_H/2},u={x:x*ART_W/2,y:(y+1)*ART_H/2},v={x:(x+1)*ART_W/2,y:(y+1)*ART_H/2};triangle(g,image,a,b,e,s,t,v);triangle(g,image,a,e,d,s,v,u)}
 const shade=(1-Math.abs(c.facing))*.20;if(shade>.002){g.fillStyle=`rgba(65,39,50,${shade})`;path(g,c.face);g.fill()}if(c.mute){g.fillStyle=`rgba(29,10,21,${c.mute})`;path(g,c.face);g.fill()}g.restore();g.strokeStyle=c.facing<0?'rgba(233,213,221,.64)':'rgba(230,217,217,.82)';g.lineWidth=Math.max(.6,c.w*.0025);path(g,c.face);g.stroke();g.restore()}
function timingProfile(profile){if(!profile||!Number.isFinite(profile.total)||profile.total<=0)return PAPER_DRAW_TIMING;const total=profile.total,gather=clamp(finite(profile.gather,total*.18),0,total),scatter=clamp(finite(profile.scatter,total*.2),0,total-gather);return Object.freeze({gather,rotate:total-gather-scatter,scatter,total,turn:finite(profile.turn,TAU*2)})}

export function createPaperCards(canvas,options={}){
 const g=canvas.getContext('2d',{alpha:false});if(!g)throw Error('翻牌点名需要 Canvas 2D 支持');const surface=surfaceFactory(canvas),media=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
 let back=null,front=null,selected=null,shadow=null,printedName='',printedIndex=-1,backgroundKey='',paintKey='',layoutKey='',layoutCache=null;const cardPool=new Map(),timerDigits=new Map(),timerFinish=new Map(),timerFaces=new Map(),timerAtlases=[];
 function ensureArt(){if(!back){back=makeCard(surface,true);front=makeCard(surface);selected=surface(ART_W,ART_H);shadow=makeShadow(surface)}const displayName=winner||pendingName,displayIndex=winner?selectedIndex:pendingIndex;if(displayName&&(printedName!==displayName||printedIndex!==displayIndex)){paintSelected(selected.getContext('2d'),front,displayName,displayIndex);printedName=displayName;printedIndex=displayIndex;selectedPaints++}}
 let names=[],entries=[],winner='',selectedIndex=-1,pendingName='',pendingIndex=-1,selectedSlot=-1,revealedAt=-Infinity,transitionAt=-Infinity,transitionDuration=RESULT_SETTLE_MS,drawing=false,startedAt=0,now=0,stage='idle',timing=PAPER_DRAW_TIMING,countdown=null,active=options.active!==false,disposed=false,reducedMotion=!!media?.matches,width=1,height=1,dpr=1,quality=1,background=null,cards=[],frames=0,selectedPaints=0,backgroundBuilds=0;
 function layout(){
  const key=width+':'+height;if(key===layoutKey)return layoutCache;
  // The table is a viewport-sized presentation, independent of the candidate
  // pool. Pick a complete rectangle with large cards and balanced cell gaps.
  const ratio=ART_H/ART_W,areaW=width*.91,areaH=height*.91,heroW=Math.min(width*.64,height*.55,360),preferredColumns=width<600?5:clamp(Math.round(width/125),7,12),maxCount=width<600?30:60;
  let best=null;
  for(let columns=2;columns<=16;columns++)for(let rows=1;rows<=12;rows++){
   const count=columns*rows;if(count>maxCount)continue;
   const rowUnits=rows*ratio+(rows-1)*.20,w=Math.min(areaW/(columns+(columns-1)*.16),areaH/rowUnits,height/(rowUnits+.32*ratio),heroW*.9),h=w*ratio,tableH=Math.min(areaH,height-h*.32),gapX=(areaW-columns*w)/(columns-1),gapY=rows>1?(tableH-rows*h)/(rows-1):0;
   // Preserve the established safe-area geometry in short windows and
   // keep a single-row back smaller than the result card.
   const verticalGap=rows>1?gapY/w-.20:Math.max(0,Math.min(areaH,heroW*.9*ratio)-h)/w,score=(gapX/w-.16)**2+verticalGap**2+.022*(columns-preferredColumns)**2;
   if(!best||score<best.score)best={count,rows,columns,w,h,stepX:w+gapX,stepY:h+gapY,score};
  }
  layoutKey=key;return layoutCache={...best,left:width*.045,heroW};
 }
 function transitionPhase(){return winner||pendingName?(reducedMotion?(winner?1:0):clamp((now-transitionAt)/transitionDuration)):0}
 function sample(){
  const l=layout(),elapsed=Math.max(0,now-startedAt),displayName=winner||pendingName,displayIndex=winner?selectedIndex:pendingIndex,resultPhase=transitionPhase(),result=ease(resultPhase);
  stage=drawing?(elapsed>=timing.total?'awaiting-reveal':pendingName?'flip':'waiting'):(winner?(resultPhase<1?'result-settle':'selected'):'idle');cards=[];selectedSlot=displayName&&entries.length?displayIndex%l.count:-1;if(!entries.length)return;
  for(let i=0;i<l.count;i++){
   const row=Math.floor(i/l.columns),column=i%l.columns,rowCount=l.columns,rank=row*l.columns+(row%2?rowCount-1-column:column),baseX=l.left+l.w/2+column*l.stepX,baseY=height*.5+(row-(l.rows-1)/2)*l.stepY,baseYRot=Math.PI,baseXRot=-.055;
   let x=baseX,y=baseY,w=l.w,h=l.h,ry=baseYRot,rx=baseXRot,rz=0,lift=0,phase=0;
   const isSelected=i===selectedSlot&&!!displayName;
   // One card turns and grows in the same continuous transition. Every other
   // card retains its exact idle geometry and shadow, with no wave or lift.
   if(isSelected){phase=resultPhase;x=mix(baseX,width/2,result);y=mix(baseY,height*.49,result);w=mix(w,l.heroW,result);h=w*ART_H/ART_W;ry=baseYRot+Math.PI*smooth(resultPhase);rx=mix(baseXRot,0,result)}
   const c=Object.assign(cardPool.get(i)??{},{id:i,studentIndex:isSelected?displayIndex:null,x,y,z:isSelected?-20:row,w,h,rx,ry,rz,alpha:1,mute:0,lift,phase,row,column,rank,baseX,baseY,thickness:Math.max(1.15,w*.0135),name:isSelected?displayName:'',selected:isSelected,showName:isSelected,focal:Math.max(width,height)*1.9});cardPool.set(i,c);sampleCard(c,c.focal);cards.push(c);
  }
  cards.sort((a,b)=>Number(a.selected)-Number(b.selected)||a.id-b.id)
 }
 function ensureTimerArt(finished){const cache=finished?timerFinish:timerDigits;if(cache.size)return;const chars=finished?'时间到':'0123456789',coreAtlas=makeTimerCores(surface,chars,!finished),cornerAtlas=makeTimerCorners(surface,finished?' ':chars);timerAtlases.push(coreAtlas.image,cornerAtlas.image);for(const [char,core] of coreAtlas.cores){core.cornerInkBounds=cornerAtlas.inkBounds;cache.set(char,core);const suits=finished?[SUITS[[...chars].indexOf(char)]]:SUITS;for(const suit of suits)timerFaces.set(`${char}:${suit}`,{core,corner:cornerAtlas.corners.get(`${finished?' ':char}:${suit}`)})}}
 function paintCountdown(display){ensureTimerArt(display.finished);const {layout:l,cards:timerCards}=timerComposition(display,width,height,display.finished?timerFinish:timerDigits);
  for(const c of timerCards)paintTimerCard(g,c,timerFaces.get(c.faceKey),front,shadow);
  // Punctuation belongs to the berry table. Every changing character belongs
  // to one upright card; hundredths never animate or allocate artwork.
  g.fillStyle='#ded3d5';if(l.colon){const {x,y,radius}=l.colon;for(const offset of [-.11,.11]){g.beginPath();g.arc(x,y+l.mainWidth*offset,radius,0,TAU);g.fill()}}if(l.decimal){g.beginPath();g.arc(l.decimal.x,l.decimal.y,l.decimal.radius,0,TAU);g.fill()}
 }
 function render(time=now){if(disposed)return;now=finite(time,now);if(!active)return;const display=countdownDisplay(countdown),keyState=[width,height,dpr,entries.length,winner,selectedIndex,pendingName,pendingIndex,display?.main??'',display?.minor??'',display?.finished??false,!display&&(winner||pendingName)&&!reducedMotion?(transitionPhase()<1?now:'result-done'):'static'].join('|');if(keyState===paintKey)return;if(!display)sample();if(names.length||display)ensureArt();const key=width+':'+height+':'+dpr;if(!background||backgroundKey!==key){background=makeBackground(surface,width,height,dpr);backgroundKey=key;backgroundBuilds++}g.setTransform(dpr,0,0,dpr,0,0);g.globalAlpha=1;g.imageSmoothingEnabled=true;g.imageSmoothingQuality='medium';g.drawImage(background,0,0,width,height);
  if(display){// The shared timer fully takes over: no names or moving cards behind it.
   paintCountdown(display);
  }else{for(const c of cards){if(c.selected){g.fillStyle=`rgba(29,10,21,${.63*smooth(transitionPhase())})`;g.fillRect(0,0,width,height)}paintCard(g,c,c.facing<0?back:c.showName?selected:front,shadow)}if(!names.length){g.fillStyle='#e7dcdf';g.textAlign='center';g.textBaseline='middle';g.font=`500 ${Math.max(17,Math.min(24,width*.054))}px ${FONT}`;g.fillText('添加学生，翻开新的期待',width/2,height*.46);g.fillStyle='#baa6ae';g.font=`400 ${Math.max(12,Math.min(15,width*.035))}px ${FONT}`;g.fillText('在「班级与座位」中添加或导入名单',width/2,height*.46+34)}}paintKey=keyState;frames++
 }
 function resize(w,h){if(disposed)return;const nextW=Math.max(1,Math.round(finite(w,1))),nextH=Math.max(1,Math.round(finite(h,1))),ratio=Math.max(1,Math.min(1.5,Math.sqrt(2400000/(nextW*nextH)),finite(typeof devicePixelRatio==='undefined'?1:devicePixelRatio,1)))*quality;if(background&&nextW===width&&nextH===height&&ratio===dpr)return;width=nextW;height=nextH;dpr=ratio;paintKey='';canvas.width=Math.max(1,Math.round(width*dpr));canvas.height=Math.max(1,Math.round(height*dpr));if(canvas.style){canvas.style.width=width+'px';canvas.style.height=height+'px'}render(now)}
 function clearPending(){pendingName='';pendingIndex=-1}
 function setNames(values){if(disposed)return;const next=Array.isArray(values)?values.map((v,id)=>({id,name:(typeof v==='string'?v:typeof v?.name==='string'?v.name:'').trim()})).filter(v=>v.name):[],unchanged=next.length===entries.length&&next.every((v,i)=>v.id===entries[i].id&&v.name===entries[i].name);if(unchanged&&!pendingName)return;entries=next;names=entries.map(v=>v.name);drawing=false;clearPending();if(!entries.some(v=>v.id===selectedIndex&&v.name===winner)){winner='';selectedIndex=-1;transitionAt=-Infinity}paintKey='';render(now)}
 function start(time=now,profile=PAPER_DRAW_TIMING){if(disposed||!names.length)return false;now=finite(time,now);startedAt=now;timing=timingProfile(profile);drawing=true;winner='';selectedIndex=-1;clearPending();revealedAt=transitionAt=-Infinity;paintKey='';render(now);return true}
 function prepare(name,time=now,index,profile=PAPER_DRAW_TIMING){if(disposed||typeof name!=='string')return false;const entry=index===undefined?entries.find(v=>v.name===name):entries.find(v=>v.id===index&&v.name===name);if(!entry)return false;now=finite(time,now);startedAt=transitionAt=now;timing=timingProfile(profile);transitionDuration=timing.total;drawing=true;winner='';selectedIndex=-1;revealedAt=-Infinity;pendingName=name;pendingIndex=entry.id;paintKey='';render(now);return true}
 function reveal(name,time=now,index){if(disposed||typeof name!=='string')return false;const entry=index===undefined?entries.find(v=>v.name===name):entries.find(v=>v.id===index&&v.name===name);if(!entry)return false;now=finite(time,now);const prepared=pendingIndex===entry.id&&pendingName===name;if(!prepared){transitionAt=now;transitionDuration=RESULT_SETTLE_MS}winner=name;selectedIndex=entry.id;clearPending();revealedAt=now;drawing=false;render(now);return true}
 function cancel(){if(disposed)return;drawing=false;clearPending();if(winner)transitionAt=now-transitionDuration;else transitionAt=-Infinity;paintKey='';render(now)}
 function reset(){if(disposed)return;drawing=false;winner='';selectedIndex=-1;clearPending();revealedAt=transitionAt=-Infinity;paintKey='';render(now)}
 function setCountdown(value){if(!disposed)countdown=value==null?null:{...value}}
 function setActive(value){if(disposed)return;const next=!!value;if(next===active)return;active=next;if(active)render(now)}
 function setQuality(value){if(disposed)return;const next=clamp(finite(value,1),.65,1);if(next===quality)return;quality=next;resize(width,height)}
 const onMotion=e=>{reducedMotion=!!e.matches;paintKey='';render(now)};media?.addEventListener?.('change',onMotion);
 function debug(){sample();const display=countdownDisplay(countdown),timer=timerComposition(display,width,height,display?.finished?timerFinish:timerDigits),timerCount=timerDigits.size+timerFinish.size,timerBytes=timerAtlases.reduce((sum,image)=>sum+image.width*image.height*4,0);return {selectedDecoration:winner||pendingName?selectedDecoration(winner?selectedIndex:pendingIndex):null,timerLayout:timer?.layout??null,timerCards:timer?.cards??[],timerCache:{digits:timerDigits.size,finish:timerFinish.size,total:timerCount,faces:timerFaces.size,atlases:timerAtlases.length,bytes:timerBytes},mode:drawing?'drawing':winner?'selected':'idle',stage,drawing,startedAt,timing:{...timing},winner,selectedName:winner,selectedIndex,pendingName,pendingIndex,selectedSlot,resultSettling:!!winner&&transitionPhase()<1,names:[...names],countdown:countdown?{...countdown}:null,width,height,dpr,quality,active,reducedMotion,frame:frames,backend:'canvas',cardCount:cards.length,visibleCardCount:cards.length,textureCount:back&&!disposed?3+timerAtlases.length:0,selectedNameVisible:!countdown&&cards.some(c=>c.selected&&c.facing>.001),resultDuration:transitionDuration,transitionAt,layout:{...layout()},cards:cards.map(c=>({id:c.id,studentIndex:c.studentIndex,name:c.name,selected:c.selected,showName:c.showName,x:c.x,y:c.y,z:c.z,width:c.w,height:c.h,opacity:c.alpha,mute:c.mute,facing:c.facing,phase:c.phase,row:c.row,column:c.column,rank:c.rank,lift:c.lift,thickness:c.thickness,origin:{x:c.baseX,y:c.baseY,width:layout().w,height:layout().h},rotation:{x:c.rx,y:c.ry,z:c.rz},mesh:c.grid.map(p=>({...p})),frontRim:c.front.map(p=>({...p})),backRim:c.back.map(p=>({...p})),bounds:{minX:c.minX,maxX:c.maxX,minY:c.minY,maxY:c.maxY}})),resources:{surfaces:disposed?0:(back?4:0)+(background?1:0)+timerAtlases.length,backgroundBuilds,selectedPaints,cpuBytes:disposed?0:((back?ART_W*ART_H*3+320*432:0)+(background?background.width*background.height:0))*4+timerBytes}}}
 resize(canvas.clientWidth||canvas.width||800,canvas.clientHeight||canvas.height||600);
 return {setNames,start,prepare,reveal,cancel,reset,setCountdown,resize,render,setActive,setQuality,debug,dispose(){if(disposed)return;disposed=true;media?.removeEventListener?.('change',onMotion);for(const image of [back,front,selected,shadow,background,...timerAtlases])if(image){image.width=1;image.height=1}back=front=selected=shadow=background=null;printedName=backgroundKey=paintKey='';printedIndex=-1;cards=[];cardPool.clear();timerDigits.clear();timerFinish.clear();timerFaces.clear();timerAtlases.length=0;layoutCache=null;layoutKey='';names=[];entries=[];winner='';selectedIndex=-1;clearPending();countdown=null}};
}
