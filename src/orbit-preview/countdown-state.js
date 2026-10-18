// Deadline-based countdown. Rendering cadence never changes the elapsed time.
export function createCountdown({now=()=>Date.now(),onFinish=()=>{}}={}) {
 let duration=120000,remaining=duration,deadline=0,status='ready';
 const snapshot=()=>({duration,remaining,status});
 function tick(){if(status==='running'){remaining=Math.max(0,deadline-now());if(remaining===0){status='finished';onFinish()}}return snapshot()}
 return {
  tick,
  restart(minutes){if(!Number.isInteger(minutes)||minutes<1||minutes>10)return snapshot();duration=minutes*60000;remaining=duration;deadline=now()+duration;status='running';return snapshot()},
  cancel(){remaining=duration;deadline=0;status='ready';return snapshot()}
 };
}
export function formatTime(ms){const seconds=Math.ceil(ms/1000);return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`}
// Round upward to the next hundredth so zero is shown only at the deadline.
export function splitPreciseTime(ms){const ticks=Math.max(0,Math.ceil(ms/10)),seconds=Math.floor(ticks/100);return {text:`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`,hundredths:String(ticks%100).padStart(2,'0')}}
