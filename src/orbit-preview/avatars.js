import * as THREE from 'three';

export const STANDING_LEG_EXTENSION=.55;

// Definitions share immutable colors/topology and cache each of the 25 poses.
// Skin-normal matrices are evaluated once per unique bone/weight combination.
export async function loadAvatarLibrary({software=false}={}){
 const handMorphs=fetch('../models/relaxed-hand-morphs.json?v=31').then(r=>{if(!r.ok)throw Error('手部动作资源加载失败');return r.json()});
 const compiledSkins=new WeakMap(),compiledSources=new WeakMap();
 function compile(root,morphs=null){
  const batches=[{count:0,indexCount:0,maxIndex:-1,parts:[]},{count:0,indexCount:0,maxIndex:-1,parts:[]}],meshes=[],skeletons=new Map();
  root.traverse(mesh=>{
   if(!mesh.isMesh||/backpack/i.test(mesh.name))return;
   let geometry=mesh.geometry;
   const morph=morphs?.[mesh.name];
   if(morph){
    geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute((morph.sourcePositions||morph.positions),3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute((morph.sourceNormals||morph.normals),3));
    geometry.setAttribute('standingPosition',new THREE.Float32BufferAttribute(morph.positions,3));
    geometry.setAttribute('standingNormal',new THREE.Float32BufferAttribute(morph.normals,3));
    geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(morph.skinIndex,4));
    geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(morph.skinWeight,4));
    geometry.setIndex(morph.indices);
   }
   const source=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
   const batchIndex=/eye|highlight|pupil/i.test(source.name)?1:0,batch=batches[batchIndex];
   const p=geometry.attributes.position;
   const offset=batch.count;batch.count+=p.count;
   // Only the arms change topology between poses. Cache each other mesh's
   // immutable inputs once, then assemble the exact per-pose batch offsets.
   let compiled=!morph&&compiledSources.get(mesh);
   if(!compiled){
    const color=geometry.attributes.color,base=source.userData.gltfBaseColorFactor||[source.color.r,source.color.g,source.color.b];
    const colors=new Float32Array(p.count*3),index=geometry.index,indices=new Uint32Array(index?index.count:p.count);let maxIndex=-1;
    for(let i=0;i<p.count;i++){
     colors[i*3]=base[0]*(color&&source.vertexColors?color.getX(i):1);
     colors[i*3+1]=base[1]*(color&&source.vertexColors?color.getY(i):1);
     colors[i*3+2]=base[2]*(color&&source.vertexColors?color.getZ(i):1);
    }
    for(let i=0;i<indices.length;i++){const value=index?index.getX(i):i;indices[i]=value;maxIndex=Math.max(maxIndex,value);}
    compiled={colors,indices,maxIndex};if(!morph)compiledSources.set(mesh,compiled);
   }
   batch.parts.push({offset,compiled});batch.indexCount+=compiled.indices.length;
   if(compiled.indices.length)batch.maxIndex=Math.max(batch.maxIndex,offset+compiled.maxIndex);
   const sharedSkin=!morph&&compiledSkins.get(mesh),skinGroups=sharedSkin?.skinGroups||[],groupIds=sharedSkin?.groupIds||new Uint32Array(p.count);
   if(mesh.isSkinnedMesh&&!sharedSkin){
    const si=geometry.attributes.skinIndex,sw=geometry.attributes.skinWeight,groups=new Map();
    for(let i=0;i<p.count;i++){
     const bones=[],weights=[];
     for(let j=0;j<4;j++){const weight=sw.getComponent(i,j);if(weight){bones.push(si.getComponent(i,j));weights.push(weight);}}
     const key=bones.join(',')+':'+weights.join(',');let id=groups.get(key);
     if(id===undefined){id=skinGroups.length;groups.set(key,id);skinGroups.push({bones,weights,matrix:new THREE.Matrix4()});}
     groupIds[i]=id;
    }
   }
   if(!morph&&!sharedSkin)compiledSkins.set(mesh,{skinGroups,groupIds});
   if(mesh.isSkinnedMesh&&!skeletons.has(mesh.skeleton))skeletons.set(mesh.skeleton,mesh.skeleton.bones.map(()=>new THREE.Matrix4()));
   meshes.push({mesh,geometry,morph,batchIndex,offset,skinGroups,groupIds,boneTransforms:skeletons.get(mesh.skeleton)});
  });
  for(const batch of batches){
   const colors=new Float32Array(batch.count*3),IndexArray=batch.maxIndex>=65535?Uint32Array:Uint16Array,indices=new IndexArray(batch.indexCount);let cursor=0;
   for(const {offset,compiled} of batch.parts){
    colors.set(compiled.colors,offset*3);
    for(let i=0;i<compiled.indices.length;i++)indices[cursor++]=offset+compiled.indices[i];
   }
   batch.color=new THREE.Float32BufferAttribute(colors,3);
   // Match BufferGeometry.setIndex's primitive-restart-aware 16/32-bit choice.
   batch.index=new (batch.maxIndex>=65535?THREE.Uint32BufferAttribute:THREE.Uint16BufferAttribute)(indices,1);
   delete batch.parts;delete batch.indexCount;delete batch.maxIndex;
  }
  return {batches,meshes,skeletons};
 }
 async function loadDefinition(name,filename=name){
  const response=await fetch(`../models/${filename}.scene.json?v=natural-skin-32`);
  if(!response.ok)throw Error(`角色资源加载失败 (${name})`);
  const root=new THREE.ObjectLoader().parse(await response.json()),mixer=new THREE.AnimationMixer(root);
  const clip=root.animations.find(c=>c.name==='SitStand')||root.animations[0];if(!clip)throw Error('角色动作缺失');
  const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  const morphData=await handMorphs,endpoints=morphData.endpoints,morphKey=typeof endpoints[filename]==='string'?endpoints[filename]:filename;
  const seated=compile(root),standing=name==='teacher'?seated:compile(root,endpoints[morphKey]);
  return {name,root,mixer,clip,action,cache:new Map(),...seated,standing,endpoints:endpoints[morphKey],poseMeshes:morphData.poses[filename.includes('hero')?'hero':filename.includes('software')?'software':'far']};
 }
 const definitions=await Promise.all(['boy','girl','teacher'].map(name=>loadDefinition(name,software&&name!=='teacher'?name+'-software':name)));
 const heroPromises=new Map();
 const materials=[new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.86}),new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.32})];
 function intermediateArms(endpoints,lower){
  const output={};
  for(const [name,end] of Object.entries(endpoints)){
   const sign=name.endsWith('R')?1:-1,upper=end.upperVertexCount;
   const positions=end.positions.slice(0,upper*3),normals=end.normals.slice(0,upper*3),skinIndex=end.skinIndex.slice(0,upper*4),skinWeight=end.skinWeight.slice(0,upper*4),indices=end.indices.slice(0,end.upperIndexCount);
   const bone=end.skinIndex[end.handOffset*4],top=[];
   function push(p,n){const i=positions.length/3;positions.push(...p);normals.push(...n);skinIndex.push(bone,0,0,0);skinWeight.push(1,0,0,0);return i;}
   for(const i of end.boundary)top.push(push(end.positions.slice(i*3,i*3+3),end.normals.slice(i*3,i*3+3)));
   const offset=positions.length/3;
   for(let i=0;i<lower.positions.length;i+=3)push([sign*lower.positions[i],lower.positions[i+1],lower.positions[i+2]],[sign*lower.normals[i],lower.normals[i+1],lower.normals[i+2]]);
   for(let i=0;i<lower.indices.length;i+=3){const a=lower.indices[i]+offset,b=lower.indices[i+1]+offset,c=lower.indices[i+2]+offset;indices.push(...(sign>0?[a,b,c]:[a,c,b]));}
   const bottom=lower.boundary.map(i=>i+offset);
   function sorted(ring){const cx=ring.reduce((s,i)=>s+positions[i*3],0)/ring.length,cz=ring.reduce((s,i)=>s+positions[i*3+2],0)/ring.length;return ring.map(i=>({i,a:(Math.atan2(positions[i*3+2]-cz,positions[i*3]-cx)+Math.PI*2)%(Math.PI*2)})).sort((a,b)=>a.a-b.a);}
   const a=sorted(top),b=sorted(bottom);let i=0,j=0;
   while(i<a.length||j<b.length){const ai=a[i%a.length].i,bj=b[j%b.length].i,na=i<a.length?a[(i+1)%a.length].a+(i+1>=a.length?Math.PI*2:0):Infinity,nb=j<b.length?b[(j+1)%b.length].a+(j+1>=b.length?Math.PI*2:0):Infinity;
    if(na<nb){indices.push(ai,a[(i+1)%a.length].i,bj);i++;}else{indices.push(ai,b[(j+1)%b.length].i,bj);j++;}
   }
   output[name]={positions,normals,skinIndex,skinWeight,indices,upperVertexCount:upper,handOffset:offset,boundary:top};
  }
  return output;
 }

 function bake(def,t){
  const step=Math.round(THREE.MathUtils.clamp(t,0,1)*24);
  if(def.cache.has(step))return def.cache.get(step);
  def.action.reset().play();def.action.paused=false;def.action.enabled=true;
  def.mixer.setTime(step/24*def.clip.duration);def.root.updateMatrixWorld(true);
  def.root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update()});
  // Intermediate compile buffers are temporary; only the final baked pose is cached.
  const layout=step===0||def.name==='teacher'?def:step===24?def.standing:compile(def.root,intermediateArms(def.endpoints,def.poseMeshes[step]));
  const batches=layout.batches.map(b=>({p:new Float64Array(b.count*3),n:new Float32Array(b.count*3)}));
  const v=new THREE.Vector3(),n=new THREE.Vector3(),normal=new THREE.Matrix3(),boneMatrix=new THREE.Matrix4(),bound=new THREE.Vector3(),weighted=new THREE.Vector3();
  for(const [skeleton,transforms] of layout.skeletons)for(let i=0;i<transforms.length;i++)transforms[i].multiplyMatrices(skeleton.bones[i].matrixWorld,skeleton.boneInverses[i]);
  let floor=Infinity;
  const stand=step/24, armBlend=stand*stand*(3-2*stand);
  const armAxis=new THREE.Vector3(),armOrigin=new THREE.Vector3(),armRadial=new THREE.Vector3(),armCross=new THREE.Vector3(),armShift=new THREE.Vector3();
  const armRotation=new THREE.Matrix3(),armJacobian=new THREE.Matrix3(),armNormal=new THREE.Matrix3(),armQ=new THREE.Quaternion(),armM=new THREE.Matrix4();
  for(const entry of layout.meshes){
   const {mesh,geometry,morph,offset,skinGroups,groupIds,boneTransforms}=entry,b=batches[entry.batchIndex];
   const p=geometry.attributes.position,ns=geometry.attributes.normal;
   const target=geometry.attributes.standingPosition,targetNormal=geometry.attributes.standingNormal;
   const armSide=/^Continuous_arm_and_hand_([LR])$/.exec(mesh.name)?.[1];
   const correctArm=armSide&&armBlend>0&&def.name!=='teacher';
   if(correctArm){
    const bone=mesh.skeleton.bones.find(b=>b.name==='Forearm'+armSide);
    armOrigin.setFromMatrixPosition(bone.matrixWorld);
    armAxis.set(0,1,0).transformDirection(bone.matrixWorld);
    armShift.set(armSide==='R'?-.28:.28,0,0).multiplyScalar(armBlend);
   }
   normal.getNormalMatrix(mesh.matrixWorld);
   for(const group of skinGroups){
    const matrix=group.matrix;matrix.elements.fill(0);
    for(let j=0;j<group.bones.length;j++){
     boneMatrix.fromArray(mesh.skeleton.boneMatrices,group.bones[j]*16);
     const weight=group.weights[j];for(let k=0;k<16;k++)matrix.elements[k]+=boneMatrix.elements[k]*weight;
    }
    matrix.premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix);
   }
   for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i);n.fromBufferAttribute(ns,i);
    if(target){
     v.lerp(bound.fromBufferAttribute(target,i),armBlend);
     n.lerp(weighted.fromBufferAttribute(targetNormal,i),armBlend).normalize();
    }
    if(mesh.isSkinnedMesh){
     const group=skinGroups[groupIds[i]];bound.copy(v).applyMatrix4(mesh.bindMatrix);v.set(0,0,0);
     for(let j=0;j<group.bones.length;j++)v.addScaledVector(weighted.copy(bound).applyMatrix4(boneTransforms[group.bones[j]]),group.weights[j]);
     v.applyMatrix4(mesh.bindMatrixInverse);n.transformDirection(group.matrix);
    }
    v.applyMatrix4(mesh.matrixWorld);n.applyNormalMatrix(normal);
    // Relax the lower arm and turn the approved hand toward the
    // thigh, fading to exactly zero at the elbow and in the seated pose.
    // Shoulders, sleeves and rig are unchanged; seated geometry uses its original batch.
    if(correctArm){
     armRadial.copy(v).sub(armOrigin);
     const d=armRadial.dot(armAxis);
     if(d>0){
     const u=THREE.MathUtils.clamp(d/.28,0,1);
     const w=u*u*(3-2*u),dw=u>0&&u<1?6*u*(1-u)/.28:0;
     const sh=d<=0?0:d<.04?d*d/.08:d-.02,ds=d<=0?0:d<.04?d/.04:1;
     const angle=(armSide==='R'?1:-1)*Math.PI*.42*armBlend;
     armRadial.addScaledVector(armAxis,-d);
     armQ.setFromAxisAngle(armAxis,angle*w);
     armRadial.applyQuaternion(armQ);
     v.copy(armOrigin).addScaledVector(armAxis,d).add(armRadial).addScaledVector(armShift,sh);
     armRotation.setFromMatrix4(armM.makeRotationFromQuaternion(armQ));
     armCross.crossVectors(armAxis,armRadial).multiplyScalar(angle*dw).addScaledVector(armShift,ds);
     armJacobian.copy(armRotation);
     const je=armJacobian.elements,a=armAxis,c=armCross;
     je[0]+=c.x*a.x;je[1]+=c.y*a.x;je[2]+=c.z*a.x;
     je[3]+=c.x*a.y;je[4]+=c.y*a.y;je[5]+=c.z*a.y;
     je[6]+=c.x*a.z;je[7]+=c.y*a.z;je[8]+=c.z*a.z;
     armNormal.copy(armJacobian).invert().transpose();n.applyNormalMatrix(armNormal);
     }
    }
    const k=(offset+i)*3;b.p[k]=v.x;b.p[k+1]=v.y;b.p[k+2]=v.z;
    b.n[k]=n.x;b.n[k+1]=n.y;b.n[k+2]=n.z;floor=Math.min(floor,v.y);
   }
  }
  const geometries=batches.map((b,i)=>{
   // Keep shoes planted and the approved head/torso proportions unchanged.
   // The toy rig has very short legs, so its raw sit/stand clip barely rises.
   // Extend only the lower body as it straightens, with zero-slope joins at
   // the shoe and hip boundaries; apply the same correction to every LOD.
   const rise=def.name==='teacher'?0:STANDING_LEG_EXTENSION*step/24;
   for(let k=1;k<b.p.length;k+=3){
    const y=b.p[k]-floor,u=THREE.MathUtils.clamp((y-.2)/.83,0,1);
    b.p[k]=y+rise*u*u*(3-2*u);
    if(rise&&u>0&&u<1){
     const derivative=1+rise*6*u*(1-u)/.83;
     n.set(b.n[k-1],b.n[k]/derivative,b.n[k+1]).normalize();
     b.n[k-1]=n.x;b.n[k]=n.y;b.n[k+1]=n.z;
    }
   }
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));
   g.setAttribute('normal',new THREE.BufferAttribute(b.n,3));g.setAttribute('color',layout.batches[i].color);
   g.setIndex(layout.batches[i].index);g.computeBoundingSphere();return g;
  });
  def.cache.set(step,geometries);return geometries;
 }
 return {materials,definitions,bake,create(name){
  let def=definitions.find(d=>d.name===name),currentPose=0,geometryStep=0,geometryDef=def;
  const baseDef=def,group=new THREE.Group(),geometries=bake(def,0);group.position.y=.04;
  for(let j=0;j<2;j++){const mesh=new THREE.Mesh(geometries[j],materials[j]);group.add(mesh);}
  group.userData.avatar=name;
  const avatar={group,def,
   setPose(t){
    currentPose=t;const step=Math.round(THREE.MathUtils.clamp(t,0,1)*24);
    if(geometryDef===def&&geometryStep===step)return;
    const gs=bake(def,t);for(let i=0;i<group.children.length;i++)group.children[i].geometry=gs[i];
    geometryDef=def;geometryStep=step;
   },
   async detail(on){
    if(!on){def=baseDef;avatar.setPose(currentPose);return;}
    if(name==='teacher')return;
    if(!heroPromises.has(name))heroPromises.set(name,loadDefinition(name+'-hero'));
    try{const hero=await heroPromises.get(name);if(group.userData.wantHero){def=hero;avatar.setPose(currentPose);}}
    catch(error){console.warn('近景模型暂不可用',error);}
   },
   setDetailed(on){group.userData.wantHero=on;return avatar.detail(on);}
  };
  return avatar;
 }};
}
