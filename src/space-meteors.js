// Short, staggered meteor flights shared by both presentation backends. The
// caller owns time: no clock, RAF, random selection or frame-time surfaces here.
// Increase launch cadence only; flight speed, envelope and shape stay unchanged.
const COUNT=10,WAVE=3650/1.3,PERIOD=WAVE*2;
const fract=n=>n-Math.floor(n),hash=n=>fract(Math.sin(n*127.1+311.7)*43758.5453123);
const clamp=n=>Math.max(0,Math.min(1,n)),smooth=n=>{n=clamp(n);return n*n*n*(n*(n*6-15)+10)};
export function createMeteorField(surface){
 const sprite=surface(256,32),g=sprite.getContext('2d');
 // A genuinely tapered tail, not a constant-width stroke. Each nested veil
 // narrows to nothing at the rear; the compact head stays soft and ice-blue.
 for(const [width,alpha]of [[15,.026],[9,.065],[4.2,.18],[1.35,.69]]){
  const tail=g.createLinearGradient(4,16,246,16);tail.addColorStop(0,'rgba(139,186,225,0)');tail.addColorStop(.22,`rgba(139,186,225,${alpha*.025})`);tail.addColorStop(.62,`rgba(158,204,240,${alpha*.32})`);tail.addColorStop(.94,`rgba(183,219,247,${alpha})`);tail.addColorStop(1,`rgba(183,219,247,${alpha*.5})`);g.fillStyle=tail;g.beginPath();g.moveTo(4,16);g.quadraticCurveTo(181,16-width*.11,244,16-width/2);g.quadraticCurveTo(248,16,244,16+width/2);g.quadraticCurveTo(181,16+width*.11,4,16);g.closePath();g.fill();
 }
 const head=g.createRadialGradient(244,16,0,244,16,10);head.addColorStop(0,'rgba(195,226,250,.91)');head.addColorStop(.17,'rgba(188,222,248,.81)');head.addColorStop(.38,'rgba(159,206,243,.33)');head.addColorStop(1,'rgba(133,186,229,0)');g.fillStyle=head;g.beginPath();g.arc(244,16,10,0,Math.PI*2);g.fill();
 const particles=Array.from({length:COUNT},(_,id)=>({id,slot:id%5,group:Math.floor(id/5),cycle:NaN,wave:0,waveSize:0,delay:0,lifetime:0,depth:0,speed:0,anchorX:0,anchorY:0,cos:1,sin:0,strength:0,x:0,y:0,length:0,thickness:0,alpha:0,progress:0,visible:false}));
 let elapsed=0,width=1,height=1,visible=0,disposed=false;
 function sample(model){
  if(disposed)return;width=model.width;height=model.height;elapsed=Math.max(0,model.now-(model.epoch??model.now));visible=0;
  const scale=Math.max(.5,Math.min(1.4,Math.min(width,height)/518));
  for(const p of particles){
   const cycle=Math.floor((elapsed-p.group*WAVE)/PERIOD);
   if(cycle!==p.cycle){
    p.cycle=cycle;p.wave=cycle*2+p.group;const seed=p.wave*37+p.slot*11;
    p.waveSize=2+Math.floor(hash(p.wave*13+407)*4);p.depth=hash(seed+631);p.delay=90+hash(p.wave+317)*95+p.slot*(90+hash(seed+557)*65);p.lifetime=1400+hash(seed+113)*1200;p.speed=280+p.depth*280;p.strength=.58+p.depth*.23;
    p.anchorX=(p.slot+.48+(hash(seed+127)-.5)*.32)/p.waveSize;p.anchorY=.12+hash(seed+983)*.58;const angle=.52+hash(seed+971)*.19;p.cos=Math.cos(angle);p.sin=Math.sin(angle);
   }
   const age=elapsed-p.wave*WAVE-p.delay,t=clamp(age/p.lifetime),travel=p.speed*scale*p.lifetime/1000;p.progress=t;p.x=p.anchorX*width+(t-.43)*travel*p.cos;p.y=p.anchorY*height+(t-.43)*travel*p.sin;p.length=(110+p.depth*165)*scale;p.thickness=(11+p.depth*8)*scale;
   // The leading fade takes 170–310ms and the tail dissipates over the last
   // 38% of the flight. Empty time between clusters prevents a bright band.
   p.alpha=p.slot<p.waveSize&&age>0&&age<p.lifetime?p.strength*smooth(t/.12)*(1-smooth((t-.62)/.38)):0;
   p.visible=p.alpha>.001&&p.x>=0&&p.x-p.length*p.cos<=width&&p.y+p.thickness>=0&&p.y-p.length*p.sin-p.thickness<=height;if(p.visible)visible++;
  }
 }
 function paint(ctx){if(disposed)return;for(const p of particles){if(!p.visible)continue;ctx.save();ctx.globalAlpha=p.alpha;ctx.transform(p.cos,p.sin,-p.sin,p.cos,p.x,p.y);ctx.drawImage(sprite,-p.length,-p.thickness/2,p.length,p.thickness);ctx.restore()}}
 function debug(){return {count:COUNT,period:PERIOD,waveInterval:WAVE,elapsed,visible,spritePixels:sprite.width*sprite.height,disposed,particles:particles.map(p=>({id:p.id,x:p.x,y:p.y,length:p.length,thickness:p.thickness,alpha:p.alpha,progress:p.progress,cycle:p.cycle,wave:p.wave,waveSize:p.waveSize,lifetime:p.lifetime,speed:p.speed,depth:p.depth,cos:p.cos,sin:p.sin,visible:p.visible}))}}
 return {sprite,particles,sample,paint,debug,get width(){return width},get height(){return height},dispose(){disposed=true}};
}
