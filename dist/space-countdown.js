// SPACE typography shares only the licensed outlines with the classroom timer.
// WebGL uses cached, genuinely extruded glyphs; Canvas paints the same outlines
// with an explicit continuous thickness layer. Neither path owns timer state.
import * as THREE from './vendor/three.module.js';
import {glyphs,units} from './board-glyphs.js';
import {countdownDigitLayout} from './countdown-digit-layout.js';
const metrics=new Map();
function metric(char){
 if(metrics.has(char))return metrics.get(char);const data=glyphs[char];if(!data)return null;
 const points=data.outline.flatMap(([,p])=>p),xs=points.map(p=>p[0]/units),ys=points.map(p=>p[1]/units),m={advance:data.advance/units,minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};metrics.set(char,m);return m;
}
// Fixed spacing accommodates the widest digit (4) and its projected sidewalls.
const mainGap=.085,minorGap=.065;
const numeralMetrics=[...'0123456789'].map(metric),numeralMinY=Math.min(...numeralMetrics.map(m=>m.minY)),numeralMaxY=Math.max(...numeralMetrics.map(m=>m.maxY)),numeralSpan=numeralMaxY-numeralMinY;
function paintedNumeralSize(height){
 // Full Canvas silhouette: front outline, solid sidewall and upper bevel
 // stroke. Its minimum pixel widths matter on narrow/small viewports.
 let size=height/(numeralSpan+.052+.002);
 if(size*.004<.45){size=(height-.225)/(numeralSpan+.052);if(size*.052<1.4)size=(height-.225-1.4)/numeralSpan}
 return Math.max(.001,size);
}
export function countdownDisplay(countdown){
 if(!countdown)return null;const finished=(countdown.state??countdown.status)==='finished';if(finished)return {finished:true,main:'时间到',minor:''};let main=countdown.main??countdown.text,minor=countdown.minor??countdown.hundredths;
 if(main==null&&Number.isFinite(countdown.remaining)){const ticks=Math.max(0,Math.ceil(countdown.remaining/10)),seconds=Math.floor(ticks/100);main=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;minor=String(ticks%100).padStart(2,'0')}
 if(main==null)return null;return {finished:false,main:String(main),minor:minor==null?'':'.'+String(minor).replace(/^\./,'')};
}
export function countdownComposition(countdown,width,height,viewportWidth=width,viewportHeight=height){
 const display=countdownDisplay(countdown);if(!display)return null;const entries=[];
 function row(text,size,centerY,role,gap=.055){const widths=[...text].map(c=>(metric(c)?.advance??.59)*size),total=widths.reduce((a,b)=>a+b,0)+Math.max(0,widths.length-1)*gap*size;let x=(width-total)/2;[...text].forEach((char,i)=>{const m=metric(char);if(m)entries.push({char,role,size,x:x+widths[i]/2,y:centerY+(m.minY+m.maxY)*size/2});x+=widths[i]+gap*size});return total}
 if(display.finished){row(display.main,Math.min(width*.238,height*.51),height*.49,'finish',.105);return {display,entries}}
 const target=countdownDigitLayout(viewportWidth,viewportHeight),size=paintedNumeralSize(target.height),mainUnits=[...display.main].reduce((s,c)=>s+(metric(c)?.advance??.59)+mainGap,0)-mainGap,minorUnits=[...display.minor].reduce((s,c)=>s+(metric(c)?.advance??.59)+minorGap,0)-minorGap,small=size*.29,mainWidth=mainUnits*size,minorWidth=Math.max(0,minorUnits)*small,gap=display.minor?size*.09:0,left=(width-mainWidth-minorWidth-gap)/2,baseline=target.top-(viewportHeight*.49-height/2)+numeralMaxY*size+Math.max(.225,size*.002);
 let x=left;for(const char of display.main){const m=metric(char);if(m){entries.push({char,role:'main',size,x:x+m.advance*size/2,y:baseline});x+=(m.advance+mainGap)*size}}
 x=left+mainWidth+gap;for(const char of display.minor){const m=metric(char);if(m){entries.push({char,role:'minor',size:small,x:x+m.advance*small/2,y:baseline});x+=(m.advance+minorGap)*small}}
 return {display,entries};
}
function trace(g,char,x,y,size){
 const m=metric(char),cx=(m.minX+m.maxX)/2;g.beginPath();for(const [op,points] of glyphs[char].outline){const p=points.flatMap(([a,b])=>[x+(a/units-cx)*size,y-b/units*size]);if(op==='moveTo')g.moveTo(...p);else if(op==='lineTo')g.lineTo(...p);else if(op==='curveTo')g.bezierCurveTo(...p);else if(op==='qCurveTo')g.quadraticCurveTo(...p);else if(op==='closePath')g.closePath()}
}
export function paintSpaceCountdown(g,countdown,w,h,viewportWidth=w,viewportHeight=h){
 const composition=countdownComposition(countdown,w,h,viewportWidth,viewportHeight);if(!composition)return false;
 for(const e of composition.entries){
  const depth=Math.max(1.4,e.size*.052),steps=Math.max(4,Math.ceil(depth)),minor=e.role==='minor',m=metric(e.char);
  // Opaque stacked outlines form visible sidewalls, not a blurred text shadow.
  const side=g.createLinearGradient(e.x,e.y-e.size,e.x+depth*.62,e.y+depth);side.addColorStop(0,minor?'#496f9f':'#657cad');side.addColorStop(.5,minor?'#345078':'#435985');side.addColorStop(1,minor?'#203454':'#293858');g.fillStyle=side;
  for(let i=steps;i>0;i--){const t=i/steps;trace(g,e.char,e.x+depth*.58*t,e.y+depth*t,e.size);g.fill()}
  trace(g,e.char,e.x,e.y,e.size);const face=g.createLinearGradient(0,e.y-m.maxY*e.size,0,e.y-m.minY*e.size);face.addColorStop(0,minor?'#eef6ff':'#ffffff');face.addColorStop(.30,minor?'#c5dfff':'#eef3ff');face.addColorStop(.65,minor?'#8bb8ee':'#b6c8ec');face.addColorStop(1,minor?'#a4c8f3':'#d8e5ff');g.fillStyle=face;g.fill();
  // A subpixel bevel catches the light without a flashing outline at small sizes.
  g.strokeStyle=minor?'rgba(210,231,255,.55)':'rgba(244,250,255,.68)';g.lineWidth=Math.max(.45,e.size*.004);g.stroke();
 }
 return true;
}
function shapes(char){const path=new THREE.ShapePath();for(const [op,points] of glyphs[char].outline){const p=points.flat().map(n=>n/units);if(op==='moveTo')path.moveTo(...p);else if(op==='lineTo')path.lineTo(...p);else if(op==='curveTo')path.bezierCurveTo(...p);else if(op==='qCurveTo')path.quadraticCurveTo(...p);else if(op==='closePath')path.currentPath.closePath()}return path.toShapes(true)}
function material(top,bottom,side=false){return new THREE.ShaderMaterial({uniforms:{top:{value:new THREE.Color(top)},bottom:{value:new THREE.Color(bottom)},isSide:{value:side?1:0}},vertexShader:'varying vec3 vNormal;varying vec3 vView;varying float vHeight;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-mv.xyz);vHeight=position.y;gl_Position=projectionMatrix*mv;}',fragmentShader:'uniform vec3 top;uniform vec3 bottom;uniform float isSide;varying vec3 vNormal;varying vec3 vView;varying float vHeight;void main(){vec3 n=normalize(vNormal),l=normalize(vec3(-.45,.8,1.1));float h=clamp((vHeight+.08)/.92,0.,1.);vec3 c=mix(bottom,top,smoothstep(0.,1.,h));float diffuse=.68+.32*max(dot(n,l),0.);float spec=pow(max(dot(reflect(-l,n),normalize(vView)),0.),28.);gl_FragColor=vec4(c*diffuse+vec3(spec*.2)*(1.-isSide*.65),1.);\n#include <colorspace_fragment>\n}',depthTest:true,depthWrite:true,transparent:false,toneMapped:false})}
export function createCountdownMeshes(){
 const group=new THREE.Group();group.name='space-dimensional-countdown';group.visible=false;group.userData.role='space-countdown';const cache=new Map(),meshes=[],front=material('#ffffff','#a2b8e5'),side=material('#8dabe0','#34466f',true),minorFront=material('#eaf4ff','#78a8e0'),minorSide=material('#a3c5ef','#344f78',true),materials=[front,side,minorFront,minorSide];let lastKey='',updates=0,disposed=false,digitFitKey='',digitFit=null,digitEnvelope=null;
 function geometry(char){if(cache.has(char))return cache.get(char);const g=new THREE.ExtrudeGeometry(shapes(char),{depth:.16,bevelEnabled:true,bevelSize:.012,bevelThickness:.014,bevelSegments:2,curveSegments:7,steps:1});g.computeBoundingBox();const b=g.boundingBox;g.translate(-(b.min.x+b.max.x)/2,0,-.16);g.computeBoundingBox();cache.set(char,g);return g}
 function fitDigits(focal,viewportWidth,viewportHeight,sourceSize){
  // Read the already-cached geometry once, retaining only its bevel/face
  // layers. Changing digits subsequently selects geometry, never measures it.
  if(!digitEnvelope){const layers=new Map();for(const char of '0123456789'){const p=geometry(char).attributes.position;for(let i=0;i<p.count;i++){const z=p.getZ(i),y=p.getY(i),layer=layers.get(z)||{z,minY:Infinity,maxY:-Infinity};layer.minY=Math.min(layer.minY,y);layer.maxY=Math.max(layer.maxY,y);layers.set(z,layer)}}digitEnvelope=[...layers.values()]}
  const key=[focal,viewportWidth,viewportHeight].join();
  if(key!==digitFitKey){
   const target=countdownDigitLayout(viewportWidth,viewportHeight),top=viewportHeight*.49-target.top,bottom=viewportHeight*.49-target.bottom;
   // With the existing camera and group transform, a vertex projects as
   // screenY=.49*height-(baseline+size*y)/(1-size*z/focal). Solve its fixed
   // alphabet envelope directly; depth and bevels are part of the result.
   const upper=Math.max(...digitEnvelope.map(p=>p.maxY+top*p.z/focal)),lower=Math.min(...digitEnvelope.map(p=>p.minY+bottom*p.z/focal)),size=target.height/(upper-lower);
   digitFit={size,baseline:top-size*upper};digitFitKey=key;
  }
  const ratio=digitFit.size/sourceSize;
  for(const mesh of meshes){if(!mesh.visible||(mesh.userData.textRole!=='main'&&mesh.userData.textRole!=='minor'))continue;mesh.scale.multiplyScalar(ratio);mesh.position.x*=ratio;mesh.position.y=digitFit.baseline}
 }
 function update(countdown,width,height,focal,viewportWidth=width,viewportHeight=height){
  const composition=countdownComposition(countdown,width,height,viewportWidth,viewportHeight);group.visible=!!composition;if(!composition){lastKey='';return false}const key=JSON.stringify([composition.display,width,height,focal,viewportWidth,viewportHeight]);if(key===lastKey)return false;
  // Precache the entire bounded alphabet on first use. Hundredths never build
  // geometry, allocate a texture, or upload a new Canvas image during playback.
  if(!cache.size)for(const char of new Set('0123456789:.时间到'))geometry(char);
  const scale=2/focal;group.position.set(0,0,-2);group.scale.setScalar(scale);composition.entries.forEach((e,i)=>{let mesh=meshes[i];if(!mesh){mesh=new THREE.Mesh();mesh.name='space-countdown-glyph';mesh.userData.role='countdown-glyph';group.add(mesh);meshes.push(mesh)}mesh.visible=true;mesh.geometry=geometry(e.char);mesh.material=e.role==='minor'?[minorFront,minorSide]:[front,side];mesh.position.set(e.x-width/2,height/2-e.y,0);mesh.scale.setScalar(e.size);mesh.rotation.set(0,0,0);mesh.userData.char=e.char;mesh.userData.textRole=e.role});for(let i=composition.entries.length;i<meshes.length;i++)meshes[i].visible=false;if(!composition.display.finished)fitDigits(focal,viewportWidth,viewportHeight,composition.entries.find(e=>e.role==='main').size);lastKey=key;updates++;return true;
 }
 function dispose(){if(disposed)return;disposed=true;for(const g of cache.values())g.dispose();cache.clear();for(const m of materials)m.dispose();group.clear();meshes.length=0}
 return {group,update,dispose,debug:()=>({visible:group.visible,glyphs:meshes.filter(m=>m.visible&&group.visible).length,meshes:meshes.length,cachedGeometries:cache.size,materials:disposed?0:materials.length,updates,disposed})};
}
