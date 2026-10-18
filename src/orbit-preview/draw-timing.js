// A draw snapshots its originating theme: switching views cannot move its deadline.
export const CLASSROOM_DRAW_TIMING=Object.freeze({gather:180,rotate:600,scatter:220,total:1000,turn:3.35});
export const SPACE_DRAW_TIMING=Object.freeze({gather:400,rotate:1000,scatter:350,total:1750,turn:Math.PI*1.55});
export const PAPER_DRAW_TIMING=Object.freeze({gather:0,rotate:600,scatter:0,total:600,turn:Math.PI});
export const drawTimingForTheme=theme=>theme==='paper'?PAPER_DRAW_TIMING:theme==='space'?SPACE_DRAW_TIMING:CLASSROOM_DRAW_TIMING;
