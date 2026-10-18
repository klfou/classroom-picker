// Presentation-only quality. Time, random selection, geometry and card density
// never depend on this controller. Each theme keeps its own learned level.
const SCALES=Object.freeze([1,.8,.65]);
export function createRenderBudget(){
 let level=0,previous=null,start=null,count=0,elapsed=0,cost=0,slow=0,healthySince=null,lastChange=-Infinity,changes=0;
 function resetSamples(){previous=null;start=null;count=0;elapsed=0;cost=0;slow=0;healthySince=null}
 function observe(now,renderMs){
  if(!Number.isFinite(now)||!Number.isFinite(renderMs))return false;
  const gap=previous===null?0:now-previous;previous=now;
  // A background resume, breakpoint or one-off layout stall is not a GPU signal.
  if(gap<=0||gap>1000){start=null;count=0;elapsed=0;cost=0;slow=0;healthySince=null;return false}
  start??=now;count++;elapsed+=gap;cost+=Math.max(0,renderMs);if(gap>24||renderMs>18)slow++;
  if(now-start<1000||count<24)return false;
  const overloaded=(elapsed/count>24||cost/count>18)&&slow/count>.35,healthy=elapsed/count<19&&cost/count<9;
  start=now;count=0;elapsed=0;cost=0;slow=0;
  if(overloaded){healthySince=null;if(level<SCALES.length-1&&now-lastChange>=3000){level++;lastChange=now;changes++;return true}}
  else if(healthy){healthySince??=now;if(level>0&&now-healthySince>=10000&&now-lastChange>=12000){level--;lastChange=now;changes++;healthySince=null;return true}}
  else healthySince=null;
  return false;
 }
 return {observe,resetSamples,get scale(){return SCALES[level]},debug:()=>({level,scale:SCALES[level],changes})};
}
