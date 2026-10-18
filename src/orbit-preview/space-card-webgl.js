// A dedicated scene on the caller-owned renderer. Never changes renderer state,
// target, pixel ratio, size, clear settings, color space, tone mapping or RAF.
import * as THREE from '../vendor/three.module.js';
import {CARD,RIM} from './space-card-model.js';
import {PALETTE,countdownLayout,paintEmpty} from './space-card-art.js';
import {createCountdownMeshes} from './space-countdown.js';
export function supportsSharedWebGL(renderer){
 if(!renderer||renderer.isSoftware||!renderer.isWebGLRenderer||typeof renderer.render!=='function')return false;
 try{const gl=renderer.getContext?.();return !!gl&&['getParameter','createShader','drawElements','isContextLost'].every(k=>typeof gl[k]==='function')&&!gl.isContextLost()}catch{return false}
}
export function createRoundedCardGeometry(){
 const positions=[],uv=[],indices=[],n=RIM.length,h=CARD.height/CARD.width,d=CARD.thickness/1.8;
 for(const z of [0,-d])for(const p of [{u:.5,v:.5},...RIM]){positions.push(p.u-.5,(.5-p.v)*h,z);uv.push(p.u,1-p.v)}
 for(let i=0;i<n;i++)indices.push(0,1+(i+1)%n,1+i); // positive Z, readable front
 const frontCount=indices.length,b=n+1;
 for(let i=0;i<n;i++)indices.push(b,b+1+i,b+1+(i+1)%n);
 for(let i=0;i<n;i++){const a=1+i,c=1+(i+1)%n;indices.push(a,c,b+c,a,b+c,b+a)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.addGroup(0,frontCount,0);g.addGroup(frontCount,indices.length-frontCount,1);g.computeVertexNormals();g.computeBoundingSphere();return g;
}
export function createWebGLBackend(renderer,art,surface,meteors){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(2*Math.atan(.5/1.26)*180/Math.PI,1,.1,100),base=createRoundedCardGeometry(),body=new THREE.MeshBasicMaterial({color:PALETTE.back,toneMapped:false,depthTest:true,depthWrite:true,transparent:false,side:THREE.FrontSide});
 const countdown=createCountdownMeshes();scene.add(countdown.group);
 const matrix=new THREE.Matrix4(),color=new THREE.Color(),batches=[],textures=new Set(),materials=new Set([body]);let revision=-1,selectedKey='',width=1,height=1,frames=0,overlayKey='',disposed=false;
 const maxAnisotropy=Math.min(4,renderer.capabilities?.getMaxAnisotropy?.()||1);
 function texture(image,mips=true,levels=null){const t=new THREE.CanvasTexture(image);t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.LinearFilter;t.minFilter=mips?THREE.LinearMipmapLinearFilter:THREE.LinearFilter;t.generateMipmaps=mips&&!levels;if(levels)t.mipmaps=levels;t.anisotropy=mips?maxAnisotropy:1;textures.add(t);return t}
 // Keep the shared ice reverse texture un-tinted on GPU, as on Canvas.
 body.map=texture(art.reverse);body.color.set('#ffffff');
 function dropTexture(t){if(t){textures.delete(t);t.dispose()}}
 const bgMaterial=new THREE.ShaderMaterial({uniforms:{map:{value:null}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,1.,1.);}',fragmentShader:'uniform sampler2D map;varying vec2 vUv;void main(){gl_FragColor=texture2D(map,vUv);\n#include <colorspace_fragment>\n}',depthWrite:false,depthTest:false,toneMapped:false});materials.add(bgMaterial);
 const bgGeometry=new THREE.PlaneGeometry(2,2),bgMesh=new THREE.Mesh(bgGeometry,bgMaterial);bgMesh.frustumCulled=false;bgMesh.renderOrder=-1000;scene.add(bgMesh);
 // One fixed quad buffer and one cached sprite. Explicit custom blending keeps
 // this in the opaque render queue, after stars but before opaque plaques and
 // numbers. NormalBlending + transparent:false would disable alpha blending.
 const meteorCount=meteors?.particles.length??0,meteorGeometry=new THREE.BufferGeometry(),meteorPositions=new THREE.Float32BufferAttribute(new Float32Array(meteorCount*12),3),meteorOpacity=new THREE.Float32BufferAttribute(new Float32Array(meteorCount*4),1),meteorUvs=[],meteorIndices=[];
 meteorPositions.setUsage(THREE.DynamicDrawUsage);meteorOpacity.setUsage(THREE.DynamicDrawUsage);
 for(let i=0;i<meteorCount;i++){meteorUvs.push(0,1,1,1,1,0,0,0);const n=i*4;meteorIndices.push(n,n+2,n+1,n,n+3,n+2)}
 meteorGeometry.setAttribute('position',meteorPositions);meteorGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(meteorUvs,2));meteorGeometry.setAttribute('opacity',meteorOpacity);meteorGeometry.setIndex(meteorIndices);
 const meteorMaterial=new THREE.ShaderMaterial({uniforms:{map:{value:meteors?texture(meteors.sprite,false):null}},vertexShader:'attribute float opacity;varying vec2 vUv;varying float vOpacity;void main(){vUv=uv;vOpacity=opacity;gl_Position=vec4(position.xy,.999,1.);}',fragmentShader:'uniform sampler2D map;varying vec2 vUv;varying float vOpacity;void main(){gl_FragColor=texture2D(map,vUv);gl_FragColor.a*=vOpacity;\n#include <colorspace_fragment>\n}',transparent:false,blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneMinusSrcAlphaFactor,blendEquationAlpha:THREE.AddEquation,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneMinusSrcAlphaFactor,depthWrite:false,depthTest:true,toneMapped:false});materials.add(meteorMaterial);
 const meteorMesh=new THREE.Mesh(meteorGeometry,meteorMaterial);meteorMesh.name='space-meteor-shower';meteorMesh.userData.role='background-meteors';meteorMesh.frustumCulled=false;meteorMesh.renderOrder=-900;scene.add(meteorMesh);
 function updateMeteors(){
  if(!meteors)return;
  for(let i=0;i<meteorCount;i++){
   const p=meteors.particles[i],cos=p.cos,sin=p.sin,tailX=p.x-p.length*cos,tailY=p.y-p.length*sin,nx=-sin*p.thickness/2,ny=cos*p.thickness/2,j=i*4;
   meteorPositions.setXYZ(j,(tailX-nx)/width*2-1,1-(tailY-ny)/height*2,0);meteorPositions.setXYZ(j+1,(p.x-nx)/width*2-1,1-(p.y-ny)/height*2,0);meteorPositions.setXYZ(j+2,(p.x+nx)/width*2-1,1-(p.y+ny)/height*2,0);meteorPositions.setXYZ(j+3,(tailX+nx)/width*2-1,1-(tailY+ny)/height*2,0);
   for(let k=0;k<4;k++)meteorOpacity.setX(j+k,p.visible?p.alpha:0);
  }
  meteorPositions.needsUpdate=true;meteorOpacity.needsUpdate=true;
 }
 const overlaySurface=surface(1,1),overlayTexture=texture(overlaySurface,false),overlayGeometry=new THREE.PlaneGeometry(1,1),overlayMaterial=new THREE.MeshBasicMaterial({map:overlayTexture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}),overlayMesh=new THREE.Mesh(overlayGeometry,overlayMaterial);materials.add(overlayMaterial);overlayMesh.frustumCulled=false;overlayMesh.renderOrder=1000;overlayMesh.visible=false;scene.add(overlayMesh);
 function makeBatch(entry,selected=false){
  const map=texture(entry.image,true,entry.mips),material=new THREE.MeshBasicMaterial({map,toneMapped:false,depthWrite:true,depthTest:true,transparent:false,side:THREE.FrontSide});materials.add(material);
  material.onBeforeCompile=shader=>{shader.vertexShader='attribute vec4 atlasRect;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv=vMapUv*atlasRect.zw+atlasRect.xy;\n#endif')};material.customProgramCacheKey=()=> 'space-card-atlas-v1';
  const geometry=base.clone(),rects=new THREE.InstancedBufferAttribute(new Float32Array(129*4),4);rects.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('atlasRect',rects);const mesh=new THREE.InstancedMesh(geometry,[material,body],129);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.count=0;scene.add(mesh);mesh.name='space-card-batch';mesh.userData.role='rounded-card';material.name='space-card-front';body.name='space-card-back-and-sides';const batch={mesh,geometry,material,map,rects,selected,page:entry.index??entry.page,count:0};batches.push(batch);return batch;
 }
 function dropBatch(b){scene.remove(b.mesh);b.mesh.dispose();b.geometry.dispose();materials.delete(b.material);b.material.dispose();dropTexture(b.map)}
 function sync(){
  if(revision!==art.revision){for(const b of batches)dropBatch(b);batches.length=0;for(const page of art.pages)makeBatch(page);revision=art.revision;selectedKey=''}
  const key=art.selected?.name??'';if(key!==selectedKey){const i=batches.findIndex(b=>b.selected);if(i>=0){dropBatch(batches[i]);batches.splice(i,1)}if(art.selected)makeBatch(art.selected,true);selectedKey=key}
 }
 function resize(w,h,bg){width=w;height=h;camera.aspect=w/h;camera.updateProjectionMatrix();camera.projectionMatrix.elements[9]=-.02;camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();dropTexture(bgMaterial.uniforms.map.value);bgMaterial.uniforms.map.value=texture(bg,false);overlayKey=''}
 function updateOverlay(model){
  const p=countdownLayout(width,height);countdown.update(model.countdown,p.width,p.height,model.focal,width,height);
  const empty=!model.names.length&&!model.countdown,key=empty?'empty':'';
  overlayMesh.visible=!!key;if(!key){overlayKey='';return}if(key===overlayKey)return;
  const ratio=Math.min(1.5,1024/width,512/height),w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio));
  if(overlaySurface.width!==w||overlaySurface.height!==h){overlaySurface.width=w;overlaySurface.height=h}const g=overlaySurface.getContext('2d');g.setTransform(ratio,0,0,ratio,0,0);g.clearRect(0,0,width,height);paintEmpty(g,width,height);overlayTexture.needsUpdate=true;overlayMesh.position.set(0,0,-2);overlayMesh.scale.set(width*2/model.focal,height*2/model.focal,1);overlayKey=key;
 }
 function render(model){
  if(disposed)return;sync();for(const b of batches)b.count=0;
  for(const c of model.order){if(!c.inView||c.size<.001)continue;const e=art.entry(c.name,c.selected),batch=c.selected?batches[batches.length-1]:batches[e?.page];if(!batch||!e)continue;const i=batch.count++,s=c.worldW,u=c.uAxis,v=c.vAxis,n=c.normal;
   matrix.set(s*u.x,-s*v.x,s*n.x,c.x,-s*u.y,s*v.y,-s*n.y,-c.y,-s*u.z,s*v.z,-s*n.z,-c.z,0,0,0,1);batch.mesh.setMatrixAt(i,matrix);color.setRGB(c.shade,c.shade,c.shade,THREE.SRGBColorSpace);batch.mesh.setColorAt(i,color);batch.rects.setXYZW(i,e.x/e.image.width,1-(e.y+e.height)/e.image.height,e.width/e.image.width,e.height/e.image.height);
  }
  for(const b of batches){b.mesh.count=b.count;b.mesh.visible=b.count>0;b.mesh.instanceMatrix.needsUpdate=true;if(b.mesh.instanceColor)b.mesh.instanceColor.needsUpdate=true;b.rects.needsUpdate=true}
  updateMeteors();updateOverlay(model);renderer.render(scene,camera);frames++;
 }
 function dispose(){if(disposed)return;disposed=true;countdown.dispose();for(const b of batches)dropBatch(b);batches.length=0;for(const t of [...textures])dropTexture(t);for(const m of materials)m.dispose();materials.clear();base.dispose();bgGeometry.dispose();meteorGeometry.dispose();overlayGeometry.dispose();scene.clear()}
 function debug(){return {kind:'webgl',frames,atlasBatches:batches.filter(b=>!b.selected).length,meshes:batches.length+3+countdown.debug().meshes,materials:materials.size+countdown.debug().materials,textures:textures.size,geometries:batches.length+4+countdown.debug().cachedGeometries,instances:batches.reduce((n,b)=>n+b.count,0),overlayPixels:overlaySurface.width*overlaySurface.height,sharedRenderer:true,countdown:countdown.debug(),meteors:meteors?.debug(),disposed}}
 return {kind:'webgl',render,resize,syncResources:sync,dispose,debug,scene,camera};
}
