// Best-effort preparation only. This queue never owns animation time or RNG.
// One indivisible resource per idle slice; no RAF or work while drawing/hidden.
export function createDrawPreparation({canRun=()=>true,onError=()=>{},requestIdle=globalThis.requestIdleCallback,cancelIdle=globalThis.cancelIdleCallback,schedule=setTimeout,cancel=clearTimeout}={}){
 let generation=0,jobs=[],handle=null,pending=false,completed=0,errors=0;
 const idle=typeof requestIdle==='function';
 function arm(pause=false){if(handle!==null||pending||!jobs.length)return;const useIdle=idle&&!pause,token=generation,callback=deadline=>{if(token===generation)run(deadline)};handle={idle:useIdle,id:useIdle?requestIdle(callback,{timeout:1000}):schedule(()=>callback(null),80)}}
 function run(deadline){handle=null;if(!canRun()||deadline&&!deadline.didTimeout&&deadline.timeRemaining()<4){arm(true);return}
  const token=generation,job=jobs.shift();if(!job)return;pending=true;
  Promise.resolve().then(()=>{if(token===generation&&canRun())return job();if(token===generation)jobs.unshift(job)}).catch(error=>{if(token===generation){errors++;onError(error)}}).finally(()=>{pending=false;if(token===generation)completed++;arm()});
 }
 function replace(next=[]){generation++;if(handle!==null){(handle.idle?cancelIdle:cancel)?.(handle.id);handle=null}jobs=[...next];completed=0;errors=0;arm()}
 return {replace,debug:()=>({pending:pending||jobs.length>0,remaining:jobs.length,completed,errors,generation}),dispose(){replace([])}};
}

// Fonts are local/system faces in this application, with no new network source.
export async function prepareDrawFonts(document,names=[]){
 if(!document?.fonts?.load)return;
 const sample=[...new Set(names.join('')+'点名♠♥♣♦0123456789')].join('');
 const fonts=['600 54px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif','600 64px "Noto Sans", "DejaVu Sans", Arial, sans-serif','600 72px "Noto Serif CJK SC", "Noto Serif SC", "Songti SC", "SimSun", serif'];
 await Promise.allSettled(fonts.map(font=>document.fonts.load(font,sample)));
}
