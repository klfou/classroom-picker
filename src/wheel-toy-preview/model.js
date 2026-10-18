export const PHRASES=Object.freeze(['就是你啦','幸运同学','请你登场','闪亮时刻','轮到你啦','准备好了','勇敢开口','精彩回答','期待你的','今日之星','惊喜揭晓','信心满满','请来分享','好好发挥','大胆表达','你的舞台','展现风采','幸运降临','一起思考','谁来回答']);
export const TAU=Math.PI*2,SECTORS=20,DURATION=6687;
export function randomIndex(length,crypto=globalThis.crypto){if(!Number.isInteger(length)||length<1)throw Error('没有可选学生');const max=Math.floor(0x100000000/length)*length;let value;const bytes=new Uint32Array(1);do{crypto.getRandomValues(bytes);value=bytes[0]}while(value>=max);return value%length;}
export function candidates(seats,used,noRepeat){return seats.map((seat,index)=>({seat,index})).filter(x=>!noRepeat||!used.has(x.index));}
export function landingAngle(current,sector){const target= -Math.PI/2-(sector+.5)*TAU/SECTORS;return current+TAU*6+((target-current)%TAU+TAU)%TAU;}
export function sectorAtPointer(angle){return Math.floor((((-Math.PI/2-angle)%TAU)+TAU)%TAU/(TAU/SECTORS));}
export function ease(t){return 1-Math.pow(1-Math.min(1,Math.max(0,t)),4);}
export function createSession(){const sessions=new Map();return item=>{const roster=JSON.stringify(item.seats);let entry=sessions.get(item.id);if(!entry||entry.roster!==roster){entry={roster,used:new Set()};sessions.set(item.id,entry)}return entry.used;};}
