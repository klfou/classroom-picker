// Canvas-call recorder for production paper-art QA. It follows drawImage source
// crops (including atlases) and transforms; it is not a browser pixel renderer.
export const identity=[1,0,0,1,0,0];
export const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const rect=(x,y,w,h)=>({minX:Math.min(x,x+w),maxX:Math.max(x,x+w),minY:Math.min(y,y+h),maxY:Math.max(y,y+h)});
const transformBounds=(b,m)=>{const points=[[b.minX,b.minY],[b.maxX,b.minY],[b.maxX,b.maxY],[b.minX,b.maxY]].map(([x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]]);return {minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minY:Math.min(...points.map(p=>p[1])),maxY:Math.max(...points.map(p=>p[1]))}};
const intersection=(a,b)=>{const r={minX:Math.max(a.minX,b.minX),maxX:Math.min(a.maxX,b.maxX),minY:Math.max(a.minY,b.minY),maxY:Math.min(a.maxY,b.maxY)};return r.maxX>r.minX&&r.maxY>r.minY?r:null};
export function createCanvasRecorder(){
 const surfaces=[];
 class Context {
  constructor(canvas){this.canvas=canvas;this.font='20px sans-serif';this.fillStyle='#000';this.textAlign='left';this.textBaseline='alphabetic';this.matrix=[...identity];this.stack=[];this.prints=[];this.images=[];this.rotations=[];this.transforms=[];this.clears=0;this.draws=0;this.paints=0;this.path=[];this.strokes=[]}
  createLinearGradient(){return {addColorStop(){}}}createRadialGradient(){return {addColorStop(){}}}
  beginPath(){this.path=[]}moveTo(...args){this.path.push(['moveTo',...args])}lineTo(...args){this.path.push(['lineTo',...args])}quadraticCurveTo(...args){this.path.push(['quadraticCurveTo',...args])}bezierCurveTo(...args){this.path.push(['bezierCurveTo',...args])}closePath(){this.path.push(['closePath'])}fill(){this.paints++}stroke(){this.paints++;this.strokes.push({path:this.path.map(p=>[...p]),matrix:[...this.matrix],lineWidth:this.lineWidth,color:this.strokeStyle})}arc(...args){this.path.push(['arc',...args])}ellipse(...args){this.path.push(['ellipse',...args])}fillRect(){this.paints++}clip(){}
  clearRect(x,y,w,h){this.clears++;this.paints++;const b=transformBounds(rect(x,y,w,h),this.matrix);this.prints=this.prints.filter(p=>!intersection(p.bounds,b));this.images=this.images.filter(i=>!intersection(i.bounds,b))}
  save(){this.stack.push({matrix:[...this.matrix],font:this.font,fillStyle:this.fillStyle,textAlign:this.textAlign,textBaseline:this.textBaseline,lineWidth:this.lineWidth,strokeStyle:this.strokeStyle})}
  restore(){Object.assign(this,this.stack.pop()??{})}
  transform(...matrix){this.transforms.push(matrix);this.matrix=multiply(this.matrix,matrix)}setTransform(...matrix){this.matrix=matrix}
  scale(x,y){this.matrix=multiply(this.matrix,[x,0,0,y,0,0])}translate(x,y){this.matrix=multiply(this.matrix,[1,0,0,1,x,y])}rotate(angle){this.rotations.push(angle);const c=Math.cos(angle),s=Math.sin(angle);this.matrix=multiply(this.matrix,[c,s,-s,c,0,0])}
  drawImage(image,...args){this.draws++;let sx=0,sy=0,sw=image.width,sh=image.height,dx,dy,dw=sw,dh=sh;if(args.length===2)[dx,dy]=args;else if(args.length===4)[dx,dy,dw,dh]=args;else if(args.length===8)[sx,sy,sw,sh,dx,dy,dw,dh]=args;else throw Error('Unexpected drawImage signature');const mapping=multiply(this.matrix,[dw/sw,0,0,dh/sh,dx-sx*dw/sw,dy-sy*dh/sh]);this.images.push({image,args,matrix:[...this.matrix],mapping,source:rect(sx,sy,sw,sh),bounds:transformBounds(rect(dx,dy,dw,dh),this.matrix)})}
  measureText(text){const size=parseFloat(this.font.match(/[\d.]+px/)?.[0])||20,width=[...String(text)].length*size*.65,ascent=this.textBaseline==='middle'?size*.5:this.textBaseline==='top'?0:size*.8,left=this.textAlign==='center'?width/2:this.textAlign==='right'?width:0;return {width,actualBoundingBoxLeft:left,actualBoundingBoxRight:width-left,actualBoundingBoxAscent:ascent,actualBoundingBoxDescent:size-ascent}}
  fillText(text,x,y){this.paints++;text=String(text);const width=this.measureText(text).width,height=parseFloat(this.font.match(/[\d.]+px/)?.[0])||20,left=x-(this.textAlign==='center'?width/2:this.textAlign==='right'?width:0),top=y-(this.textBaseline==='middle'?height/2:this.textBaseline==='top'?0:height*.8);this.prints.push({text,x,y,font:this.font,fontSize:height,color:this.fillStyle,matrix:[...this.matrix],bounds:transformBounds(rect(left,top,width,height),this.matrix)})}
 }
 class Canvas{constructor(width=1366,height=518){this.width=width;this.height=height;this.style={};this.ctx=new Context(this);surfaces.push(this)}getContext(){return this.ctx}}
 return {Canvas,surfaces};
}
export function flattenedText(canvas,scale=1,seen=new Set()){
 if(!canvas?.ctx||seen.has(canvas))return [];const next=new Set(seen);next.add(canvas);const prints=canvas.ctx.prints.map(p=>({...p,sourceCanvas:canvas,clipped:false}));
 for(const image of canvas.ctx.images)for(const print of flattenedText(image.image,1,next)){
  const visible=intersection(print.bounds,image.source);if(!visible)continue;const clipped=print.clipped||Object.keys(visible).some(k=>Math.abs(visible[k]-print.bounds[k])>1e-8);prints.push({...print,matrix:multiply(image.mapping,print.matrix),bounds:transformBounds(visible,image.mapping),clipped});
 }
 if(scale===1)return prints;const m=[scale,0,0,scale,0,0];return prints.map(p=>({...p,matrix:multiply(m,p.matrix),bounds:transformBounds(p.bounds,m)}));
}
export const clearOutput=canvas=>{canvas.ctx.images=[];canvas.ctx.prints=[];canvas.ctx.rotations=[];canvas.ctx.transforms=[]};
export const cacheSignature=surfaces=>surfaces.map(c=>({canvas:c,width:c.width,height:c.height,paints:c.ctx.paints,draws:c.ctx.draws,clears:c.ctx.clears,prints:JSON.stringify(c.ctx.prints)}));
