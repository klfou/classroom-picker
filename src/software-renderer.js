import * as THREE from 'three';
function matrixMatches(a,b){for(let i=0;i<16;i++)if(a[i]!==b[i])return false;return true}
const FADE_PATTERN=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];

// Depth-buffered CPU fallback. The geometry, lighting and raster resolution match
// the existing asset path; reusable vertex buffers avoid allocation during motion.
export class SoftwareRenderer {
 constructor(){
  this.domElement=document.createElement('canvas');
  this.ctx=this.domElement.getContext('2d');
  this.shadowMap={};this.isSoftware=true;this.worldCache=new WeakMap();this.stats={};
  this.vp=new THREE.Matrix4();this.frustum=new THREE.Frustum();
  this.light=new THREE.Vector3(-.45,.85,.35).normalize();
  this.normalMatrix=new THREE.Matrix3();this.vertex=new THREE.Vector3();
  this.normal=new THREE.Vector3();this.color=new THREE.Color();
 }
 setPixelRatio(){}
 setQuality(scale){this.quality=Math.max(.65,Math.min(1,Number(scale)||1))}
 setSize(w,h,updateStyle=true){if(this.w!==w||this.h!==h){this.w=w;this.h=h;this.domElement.width=w;this.domElement.height=h}if(updateStyle){this.domElement.style.width=w+'px';this.domElement.style.height=h+'px'}}
 render(scene,camera){
  const started=performance.now();scene.updateMatrixWorld();camera.updateMatrixWorld();
  const vp=this.vp.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  const frustum=this.frustum.setFromProjectionMatrix(vp),light=this.light;
  const scale=Math.min(1,(this.motion?720:1280)/this.w)*(this.quality??1),W=Math.round(this.w*scale),H=Math.round(this.h*scale);
  if(!this.buffer||this.bw!==W||this.bh!==H){
   this.buffer=this.ctx.createImageData(W,H);this.depth=new Float32Array(W*H);
   this.off=document.createElement('canvas');this.off.width=W;this.off.height=H;
   this.offctx=this.off.getContext('2d');this.bw=W;this.bh=H;
   this.background=new Uint8ClampedArray(W*H*4);
   for(let i=0;i<this.background.length;i+=4){this.background[i]=236;this.background[i+1]=238;this.background[i+2]=225;this.background[i+3]=255;}
  }
  const pixels=this.buffer.data,depth=this.depth;depth.fill(Infinity);pixels.set(this.background);
  let meshCount=0,triangleCount=0;
  const raster=(points,ai,bi,ci,double,alpha=1)=>{
   const ax=points[ai],ay=points[ai+1],bx=points[bi],by=points[bi+1],cx=points[ci],cy=points[ci+1];
   const den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
   if(Math.abs(den)<.015||(!double&&den>=0))return;
   const x0=Math.max(0,Math.floor(Math.min(ax,bx,cx))),x1=Math.min(W-1,Math.ceil(Math.max(ax,bx,cx)));
   const y0=Math.max(0,Math.floor(Math.min(ay,by,cy))),y1=Math.min(H-1,Math.ceil(Math.max(ay,by,cy)));
   if(x0>x1||y0>y1)return;triangleCount++;
   const az=points[ai+2],bz=points[bi+2],cz=points[ci+2];
   const ar=points[ai+3],ag=points[ai+4],ab=points[ai+5];
   const br=points[bi+3],bg=points[bi+4],bb=points[bi+5];
   const cr=points[ci+3],cg=points[ci+4],cb=points[ci+5];
   // Edge planes advance by addition across a scanline; topology, coverage,
   // depth and shading stay the same, without two divisions per pixel.
   const ux=(by-cy)/den,vx=(cy-ay)/den;
   for(let y=y0;y<=y1;y++){
    let u=((by-cy)*(x0+.5-cx)+(cx-bx)*(y+.5-cy))/den;
    let v=((cy-ay)*(x0+.5-cx)+(ax-cx)*(y+.5-cy))/den;
    for(let x=x0;x<=x1;x++,u+=ux,v+=vx){
    const w=1-u-v;
    if(u<0||v<0||w<0)continue;
    if(alpha<1&&(FADE_PATTERN[(y%4)*4+x%4]+.5)/16>alpha)continue;
    const z=u*az+v*bz+w*cz,i=y*W+x;
    if(z>=depth[i])continue;depth[i]=z;
    pixels[i*4]=u*ar+v*br+w*cr;pixels[i*4+1]=u*ag+v*bg+w*cg;pixels[i*4+2]=u*ab+v*bb+w*cb;
   }
   }
  };
  // Only the uncommon near/far crossings need temporary polygons. The common
  // fully visible case goes straight from typed projection buffers to the raster.
  const clip=(poly,far)=>{
   const out=[];
   for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],da=far?a[3]-a[2]:a[2]+a[3],db=far?b[3]-b[2]:b[2]+b[3];
    if(da>=0)out.push(a);
    if((da>=0)!==(db>=0)){const t=da/(da-db);out.push(a.map((n,j)=>n+(b[j]-n)*t));}
   }
   return out;
  };
  const m=vp.elements;
  scene.traverseVisible(o=>{
   if(!o.isMesh||!frustum.intersectsObject(o))return;
   const material=Array.isArray(o.material)?o.material[0]:o.material;
   if(material.opacity<(material.userData.countdownFade ? .0001 : .15))return;meshCount++;
   const matrix=o.matrixWorld.elements,colorKey=material.color.getHex(),emissiveKey=material.emissive?.getHex()||0;
   let data=this.worldCache.get(o);
   if(!data||data.geo!==o.geometry||data.colorKey!==colorKey||data.emissiveKey!==emissiveKey||!matrixMatches(matrix,data.matrix)){
    const g=o.geometry,p=g.attributes.position,n=g.attributes.normal,color=g.attributes.color;
    const normalMatrix=this.normalMatrix.getNormalMatrix(o.matrixWorld),v=this.vertex,nn=this.normal,rgb=this.color;
    if(!data||data.count!==p.count)data={world:new Float32Array(p.count*6),points:new Float64Array(p.count*6),clip:new Float64Array(p.count*4),codes:new Uint8Array(p.count)};
    const world=data.world,emissive=material.emissive,intensity=material.emissiveIntensity??1;
    const er=emissive?emissive.r*intensity:0,eg=emissive?emissive.g*intensity:0,eb=emissive?emissive.b*intensity:0;
    for(let i=0;i<p.count;i++){
     v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);nn.fromBufferAttribute(n,i).applyNormalMatrix(normalMatrix);
     const shade=o.userData.countdownRelief ? .42+.58*Math.max(0,nn.dot(this.reliefLight??=new THREE.Vector3(-.45,.7,1.15).normalize())):.86+.14*Math.max(0,nn.dot(light));rgb.copy(material.color);
     if(material.vertexColors&&color){rgb.r*=color.getX(i);rgb.g*=color.getY(i);rgb.b*=color.getZ(i);}
     rgb.r+=er;rgb.g+=eg;rgb.b+=eb;rgb.convertLinearToSRGB();
     const k=i*6;world[k]=v.x;world[k+1]=v.y;world[k+2]=v.z;
     world[k+3]=rgb.r*255*shade;world[k+4]=rgb.g*255*shade*(o.userData.countdownRelief ? .93+.07*shade:1);world[k+5]=rgb.b*255*shade*(o.userData.countdownRelief ? .78+.22*shade:1);
    }
    data.geo=g;data.matrix??=new Float64Array(16);data.matrix.set(matrix);data.colorKey=colorKey;data.emissiveKey=emissiveKey;data.count=p.count;data.index=g.index?.array;this.worldCache.set(o,data);
   }
   const world=data.world,points=data.points,clips=data.clip,codes=data.codes;
   for(let i=0;i<data.count;i++){
    const k=i*6,q=i*4,x=world[k],y=world[k+1],z=world[k+2];
    const px=m[0]*x+m[4]*y+m[8]*z+m[12],py=m[1]*x+m[5]*y+m[9]*z+m[13];
    const pz=m[2]*x+m[6]*y+m[10]*z+m[14],pw=m[3]*x+m[7]*y+m[11]*z+m[15];
    clips[q]=px;clips[q+1]=py;clips[q+2]=pz;clips[q+3]=pw;
    points[k]=(px/pw*.5+.5)*W;points[k+1]=(-py/pw*.5+.5)*H;points[k+2]=pz/pw;
    points[k+3]=world[k+3];points[k+4]=world[k+4];points[k+5]=world[k+5];
    codes[i]=(pz+pw<0?1:0)|(pw-pz<0?2:0);
   }
   const idx=data.index,double=material.side===THREE.DoubleSide;
   for(let i=0;i<(idx?idx.length:data.count);i+=3){
    const ai=idx?idx[i]:i,bi=idx?idx[i+1]:i+1,ci=idx?idx[i+2]:i+2;
    if(codes[ai]&codes[bi]&codes[ci])continue;
    if(codes[ai]|codes[bi]|codes[ci]){
     let poly=[ai,bi,ci].map(id=>{const k=id*6,q=id*4;return [clips[q],clips[q+1],clips[q+2],clips[q+3],world[k+3],world[k+4],world[k+5]]});
     poly=clip(clip(poly,false),true);
     const projected=[];
     for(const p of poly)projected.push((p[0]/p[3]*.5+.5)*W,(-p[1]/p[3]*.5+.5)*H,p[2]/p[3],p[4],p[5],p[6]);
     for(let j=1;j<poly.length-1;j++)raster(projected,0,j*6,(j+1)*6,double,material.userData.countdownFade?material.opacity:1);
    }else raster(points,ai*6,bi*6,ci*6,double,material.userData.countdownFade?material.opacity:1);
   }
  });
  this.offctx.putImageData(this.buffer,0,0);this.ctx.imageSmoothingEnabled=true;
  this.ctx.drawImage(this.off,0,0,this.w,this.h);
  this.stats={ms:performance.now()-started,meshes:meshCount,triangles:triangleCount,width:W,height:H};
 }
}
