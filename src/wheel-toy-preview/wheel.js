import {PHRASES,TAU,SECTORS} from './model.js';
export function createWheel(canvas){
 const c=canvas.getContext('2d');let state={angle:0,winner:-1,name:'',flip:0};
 function paint(){
  const size=Math.max(400,Math.round(canvas.clientWidth*Math.min(devicePixelRatio||1,2)));if(canvas.width!==size)canvas.width=canvas.height=size;
  const r=size/2;c.clearRect(0,0,size,size);c.save();c.translate(r,r);c.rotate(state.angle);
  const palette=[['#fff7e5','#f3ddbc'],['#ffb7a0','#f58e77'],['#c5e6f8','#94c5e7']];
  for(let i=0;i<SECTORS;i++){
   const a=i*TAU/SECTORS,b=(i+1)*TAU/SECTORS,mid=(a+b)/2,selected=i===state.winner;
   c.beginPath();c.moveTo(0,0);c.arc(0,0,r-1,a,b);c.closePath();
   const g=c.createRadialGradient(0,0,r*.12,0,0,r);g.addColorStop(0,selected?'#fff6d0':palette[i%3][0]);g.addColorStop(1,selected?'#ffe6a3':palette[i%3][1]);c.fillStyle=g;c.fill();c.strokeStyle='#fff7e9';c.lineWidth=Math.max(1,size/450);c.stroke();
   if(selected){c.strokeStyle='#fff8bf';c.lineWidth=size*.006;c.stroke()}
   c.save();c.rotate(mid);c.translate(r*(selected?.56:.64),0);
   // Each four-character phrase shares one radius, font and radial baseline.
   // Keep baseline upright on the left half instead of reversing individual glyphs.
   const screenAngle=((state.angle+mid)%TAU+TAU)%TAU;
   if(screenAngle>Math.PI/2&&screenAngle<Math.PI*1.5)c.rotate(Math.PI);
   if(selected)c.scale(Math.max(.04,Math.abs(Math.cos(state.flip*Math.PI))),1);
   const label=selected&&state.flip>.5?state.name:PHRASES[i];
   c.fillStyle='#16486e';c.font=`800 ${size*.037}px "Microsoft YaHei","Noto Sans CJK SC",sans-serif`;c.textAlign='center';c.textBaseline='middle';
   c.shadowColor='#fff8';c.shadowBlur=0;c.shadowOffsetY=1;c.fillText(label,0,0,size*(selected?.31:.30));c.restore();
  }
  c.restore();
  const shade=c.createRadialGradient(r*.6,r*.3,r*.15,r,r,r*1.1);shade.addColorStop(0,'#ffffff24');shade.addColorStop(.7,'#ffffff00');shade.addColorStop(1,'#9b654a22');c.fillStyle=shade;c.beginPath();c.arc(r,r,r,0,TAU);c.fill();
 }
 return {draw(patch={}){Object.assign(state,patch);paint()},get state(){return {...state}}};
}
