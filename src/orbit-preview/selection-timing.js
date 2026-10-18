// Visual hopping only. Audio has no dependency on candidate count or timing.
export function selectionTimeline(durationMs){
 const count=Math.round(durationMs/1000*18);
 return Array.from({length:count},(_,i)=>{const u=i/count;return durationMs*(.55*u+.45*u**2.4)});
}
