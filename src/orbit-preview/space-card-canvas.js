// Portable fallback: exactly the same model, face assets, rims and depth order.
import {RIM,UV} from './space-card-model.js';
import {PALETTE,roundRect,countdownLayout,paintCountdown,paintEmpty} from './space-card-art.js';
const triangles=[[0,2,8],[0,8,6]], [sideR,sideG,sideB]=PALETTE.side;
function path(g,points){g.beginPath();points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath()}
export function createCanvasBackend(canvas,art,meteors){
 const g=canvas.getContext('2d',{alpha:false});if(!g)throw Error('星空名牌需要 Canvas 2D 支持');let width=1,height=1,dpr=1,bg=null,frames=0,disposed=false;
 function resize(w,h,ratio,background){width=w;height=h;dpr=ratio;bg=background;canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);if(canvas.style){canvas.style.width=w+'px';canvas.style.height=h+'px'}}
 function sides(c){
  g.fillStyle=`rgb(${Math.round(sideR*c.shade)},${Math.round(sideG*c.shade)},${Math.round(sideB*c.shade)})`;
  for(let i=0;i<RIM.length;i++){const j=(i+1)%RIM.length,a=c.frontRim[i],b=c.frontRim[j],d=c.backRim[j],e=c.backRim[i];const area=Math.abs(a.x*b.y-b.x*a.y+b.x*d.y-d.x*b.y+d.x*e.y-e.x*d.y+e.x*a.y-a.x*e.y)*.5;if(area<.06)continue;g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.lineTo(d.x,d.y);g.lineTo(e.x,e.y);g.closePath();g.fill()}
 }
 function blit(c,tex){
  const mesh=c.mesh;
  if(c.shellMix<.00001){g.drawImage(tex.image,tex.sx,tex.sy,tex.sw,tex.sh,c.screenX-c.width/2,c.screenY-c.height/2,c.width,c.height);return}
  for(const ids of triangles){
   const [ia,ib,ic]=ids,a=mesh[ia],b=mesh[ib],d=mesh[ic],su=UV[ia].u*tex.sw,sv=UV[ia].v*tex.sh,bu=(UV[ib].u-UV[ia].u)*tex.sw,bv=(UV[ib].v-UV[ia].v)*tex.sh,du=(UV[ic].u-UV[ia].u)*tex.sw,dv=(UV[ic].v-UV[ia].v)*tex.sh,det=bu*dv-bv*du;
   const xx=((b.x-a.x)*dv-(d.x-a.x)*bv)/det,xy=((b.y-a.y)*dv-(d.y-a.y)*bv)/det,yx=((d.x-a.x)*bu-(b.x-a.x)*du)/det,yy=((d.y-a.y)*bu-(b.y-a.y)*du)/det,cx=(a.x+b.x+d.x)/3,cy=(a.y+b.y+d.y)/3;
   // Inflate by a true 0.75px across the shared diagonal; the outer face clip keeps the silhouette unchanged.
   const edgeX=mesh[8].x-mesh[0].x,edgeY=mesh[8].y-mesh[0].y,edgeLength=Math.hypot(edgeX,edgeY)||1,overlap=.75/Math.max(.01,Math.abs(edgeX*(cy-mesh[0].y)-edgeY*(cx-mesh[0].x))/edgeLength);
   g.save();g.beginPath();ids.forEach((id,i)=>{const p=mesh[id],x=p.x+(p.x-cx)*overlap,y=p.y+(p.y-cy)*overlap;i?g.lineTo(x,y):g.moveTo(x,y)});g.closePath();g.clip();g.transform(xx,xy,yx,yy,a.x-xx*su-yx*sv,a.y-xy*su-yy*sv);g.drawImage(tex.image,tex.sx,tex.sy,tex.sw,tex.sh,0,0,tex.sw,tex.sh);g.restore();
  }
 }
 function interior(c){
  g.beginPath();for(const [i,[u,v]] of [[.13,.26],[.93,.26],[.93,.81],[.13,.81]].entries()){
   let x,y;if(c.shellMix<.00001){x=c.screenX+(u-.5)*c.width;y=c.screenY+(v-.5)*c.height}else{const dx=(u-.5)*c.worldW,dy=(v-.5)*c.worldH,z=c.z+c.uAxis.z*dx+c.vAxis.z*dy;x=width*.5+(c.x+c.uAxis.x*dx+c.vAxis.x*dy)*height*1.26/z;y=height*.49+(c.y+c.uAxis.y*dx+c.vAxis.y*dy)*height*1.26/z}i?g.lineTo(x,y):g.moveTo(x,y)
  }g.closePath();g.clip();
 }
 function face(c){
  const points=c.facing<=0?c.backRim:c.frontRim;g.save();path(g,points);g.clip();
  if(c.facing<=0){
   // An unprinted reverse needs one smooth material fill, not two additional
   // perspective texture clips per plaque. The projected gradient follows its pose.
   const a=c.backMesh[0],b=c.backMesh[8],fill=g.createLinearGradient(a.x,a.y,b.x,b.y);fill.addColorStop(0,PALETTE.backTop);fill.addColorStop(.5,PALETTE.back);fill.addColorStop(1,PALETTE.backBottom);g.fillStyle=fill;g.fillRect(c.minX,c.minY,c.maxX-c.minX,c.maxY-c.minY);
  }
  else{
   const tex=art.source(c,dpr);if(!tex){g.restore();return}
   if(tex.base){
    // Stable material/silhouette once; opaque fine + translucent coarse yields
    // an exact continuous interior interpolation, without double-covered edges.
    blit(c,{image:tex.base,sx:0,sy:0,sw:tex.base.width,sh:tex.base.height});g.save();interior(c);blit(c,tex);if(tex.blend>.00001){g.globalAlpha=tex.blend;blit(c,{image:tex.coarse,sx:0,sy:0,sw:tex.coarse.width,sh:tex.coarse.height});g.globalAlpha=1}g.restore();
   }else blit(c,tex);
  }
  if(c.shade<.999){g.globalAlpha=1-c.shade;g.fillStyle='#000';path(g,points);g.fill();g.globalAlpha=1}g.restore();
 }

 function render(model){if(disposed)return;g.setTransform(dpr,0,0,dpr,0,0);g.globalAlpha=1;g.imageSmoothingEnabled=true;g.imageSmoothingQuality='low';if(bg)g.drawImage(bg,0,0,width,height);meteors?.paint(g);for(const c of model.order){if(!c.inView||c.size<.001)continue;sides(c);face(c)}
  if(!model.names.length&&!model.countdown)paintEmpty(g,width,height);
  if(model.countdown){const p=countdownLayout(width,height);g.save();g.setTransform(dpr,0,0,dpr,(p.x-p.width/2)*dpr,(p.y-p.height/2)*dpr);paintCountdown(g,model.countdown,p.width,p.height,width,height);g.restore()}
  frames++;
 }
 return {kind:'canvas',resize,render,debug:()=>({kind:'canvas',frames,meteors:meteors?.debug()}),dispose(){disposed=true;bg=null}};
}
