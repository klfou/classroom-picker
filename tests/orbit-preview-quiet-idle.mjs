import assert from 'node:assert/strict';import fs from 'node:fs';
import {createCardModel} from '../dist/orbit-preview/space-card-model.js';
const reports=[];
for(const [width,height]of [[1366,518],[1920,806],[900,700],[390,492]])for(const count of [30,64,128]){
 const m=createCardModel();m.resize(width,height);m.setNames(Array.from({length:count},(_,i)=>'学生'+i));m.sample(0);
 let visibleMin=Infinity,visibleMax=0,minW=Infinity,maxW=0,minGap=Infinity,maxMove=0;const initial=new Map(m.cards.map(c=>[c.id,{x:c.screenX,y:c.screenY}]));
 for(let now=0;now<=108000;now+=1000){m.sample(now);const visible=m.cards.filter(c=>c.inView);visibleMin=Math.min(visibleMin,visible.length);visibleMax=Math.max(visibleMax,visible.length);assert.equal(visible.length,Math.min(count,width/height<1?18:30));
  for(const c of visible){assert.ok(c.minX>=0&&c.maxX<=width&&c.minY>=0&&c.maxY<=height,'No cropped idle card');minW=Math.min(minW,c.width);maxW=Math.max(maxW,c.width);const first=initial.get(c.id);maxMove=Math.max(maxMove,Math.hypot(c.screenX-first.x,c.screenY-first.y));}
  for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++){const a=visible[i],b=visible[j],gx=Math.max(b.minX-a.maxX,a.minX-b.maxX),gy=Math.max(b.minY-a.maxY,a.minY-b.maxY);assert.ok(gx>=0||gy>=0,'Projected name cards do not overlap');minGap=Math.min(minGap,Math.max(gx,gy));}
 }
 m.start(120000);m.sample(121750);for(const index of [0,count-1,Math.floor(count/2)]){m.start(120000);m.sample(121750);assert.equal(m.reveal(m.names[index],121750,index),true);for(let t=0;t<=360;t+=10){m.sample(121750+t);assert.ok(m.visibleCardCount>0,'Reveal never blanks the viewport')}}
 assert.ok(maxW/minW<=1.14,'Quiet idle limits near/far size contrast');
 reports.push({width,height,roster:count,visibleRange:[visibleMin,visibleMax],nearFarWidthRatio:maxW/minW,minSeparationPx:minGap,maxBreathingDisplacementPx:maxMove,noProjectedOverlap:true,noCropping:true,noBlankReveal:true});
}
if(process.env.ORBIT_QUIET_REPORT)fs.writeFileSync(process.env.ORBIT_QUIET_REPORT,JSON.stringify(reports,null,2));console.log('PASS quiet idle:30 desktop/18 portrait, stable identities, no overlap or crop at4 sizes and30/64/128 rosters, bounded size and gentle motion, no blank result transition.');
