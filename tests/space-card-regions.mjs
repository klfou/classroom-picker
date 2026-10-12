import assert from 'node:assert/strict';
import {createSpaceCards} from '../dist/space-cards.js';

// Readable occupancy over three complete lives. Small distant marks, clipped
// names, and names hidden behind opaque plaques cannot satisfy a region.
class Context {
 createLinearGradient(){return {addColorStop(){}}}createRadialGradient(){return {addColorStop(){}}}
 beginPath(){}moveTo(){}lineTo(){}quadraticCurveTo(){}closePath(){}fill(){}stroke(){}arc(){}fillRect(){}scale(){}save(){}restore(){}setTransform(){}transform(){}clip(){}drawImage(){}fillText(){}
 measureText(t){return {width:String(t).length*54}}
}
class Canvas {constructor(width,height){this.width=width;this.height=height;this.style={};this.ctx=new Context()}getContext(){return this.ctx}}
const names=Array.from({length:40},(_,i)=>'学生'+String.fromCharCode(0x4e00+i));
const covers=(c,x,y)=>{
 const dx=Math.abs((x-c.screenX)/c.width),dy=Math.abs((y-c.screenY)/c.height),hw=.5-13/384,hh=.5-13/168,rx=20/384,ry=20/168;
 if(dx>hw||dy>hh)return false;
 return dx<hw-rx||dy<hh-ry||((dx-(hw-rx))/rx)**2+((dy-(hh-ry))/ry)**2<=1;
};
const reports=[];
for(const [width,height] of [[1366,518],[1920,810],[900,700],[390,492]]){
 const view=createSpaceCards(new Canvas(width,height));view.setNames(names);view.render(0);
 const dt=100,frames=view.debug().idlePeriod*3/dt,cells=Array.from({length:9},()=>({occupied:0,gap:0,maxGap:0}));
 let central=0,previous=null,maxAcceleration=0,maxGrowth=0;const velocities=new Map(),speeds=[];
 for(let f=0;f<=frames;f++){
  view.render(f*dt);const state=view.debug(),visible=state.cards.filter(c=>c.idleInView),hits=Array(9).fill(0);let centerHit=false;
  for(const c of visible){
   if(c.width*54/384<11||c.opacity<.55)continue;
   const nearer=visible.filter(n=>n.id!==c.id&&(n.z<c.z||n.z===c.z&&n.id>c.id)&&n.opacity>.7);
   const points=Array(9).fill(0);let open=0;
   for(let yi=0;yi<5;yi++)for(let xi=0;xi<9;xi++){
    const x=c.screenX+c.width*(.01+(xi/8-.5)*162/384),y=c.screenY+c.height*(.01+(yi/4-.5)*54/168);
    if(x<0||y<0||x>=width||y>=height||nearer.some(n=>covers(n,x,y)))continue;
    open++;points[Math.floor(y/height*3)*3+Math.floor(x/width*3)]++;
   }
   if(open<36)continue;
   for(let i=0;i<9;i++)if(points[i]>=23)hits[i]++;
   if(Math.abs(c.screenX-width*.5)<=width*.15&&Math.abs(c.screenY-height*.49)<=height*.20)centerHit=true;
  }
  if(centerHit)central++;
  for(let i=0;i<9;i++){const cell=cells[i];if(hits[i]){cell.occupied++;cell.gap=0}else {cell.gap+=dt;cell.maxGap=Math.max(cell.maxGap,cell.gap)}}
  if(previous)for(const c of state.cards){
   const p=previous.cards[c.id];
   if(c.idleCycle!==p.idleCycle||!c.idleInView||!p.idleInView){velocities.delete(c.id);continue}
   const v={x:(c.screenX-p.screenX)*1000/dt,y:(c.screenY-p.screenY)*1000/dt},old=velocities.get(c.id);
   speeds.push(Math.hypot(v.x,v.y));if(old)maxAcceleration=Math.max(maxAcceleration,Math.hypot(v.x-old.x,v.y-old.y)*1000/dt);
   maxGrowth=Math.max(maxGrowth,Math.log(c.width/p.width)*1000/dt);velocities.set(c.id,v);
  }
  previous=state;
 }
 const coverage=cells.map(c=>c.occupied/(frames+1)),longestGap=Math.max(...cells.map(c=>c.maxGap));speeds.sort((a,b)=>a-b);
 assert.ok(Math.min(...coverage)>=(width<600?.97:.99),'All screen regions sustain genuinely readable names');
 assert.ok(longestGap<1500,'No region has a persistent empty interval');
 assert.ok(central/(frames+1)>.99,'Improved corners do not sacrifice the central reading field');
 assert.ok(speeds[Math.floor(speeds.length*.5)]<Math.max(width,height)*.022,'Typical sideways motion remains calm');
 assert.ok(maxAcceleration<height*.009,'Visible entrances and departures have no acceleration burst');
 assert.ok(maxGrowth<.021,'Approach remains continuous at a restrained two percent per second');
 reports.push({width,height,seconds:frames*dt/1000,coveragePct:coverage.map(v=>+(v*100).toFixed(2)),longestGapMs:longestGap,centralCoveragePct:+(central/(frames+1)*100).toFixed(2),medianSpeed:speeds[Math.floor(speeds.length*.5)],maxAcceleration,maxGrowth});view.dispose();
}
console.log('PASS balanced readable regions and calm continuous motion: '+JSON.stringify(reports));
