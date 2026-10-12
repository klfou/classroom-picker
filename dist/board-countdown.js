import * as THREE from 'three';
import {glyphs,units} from './board-glyphs.js';
// All digits are cached, genuinely extruded meshes. Updates only select geometry.
export function createBoardCountdown(){
 const group=new THREE.Group();group.position.set(0,3.15,-14.74);group.visible=false;
 const cream=new THREE.MeshStandardMaterial({color:'#fff8df',roughness:.48,metalness:0}),gold=new THREE.MeshStandardMaterial({color:'#f8c14d',roughness:.4,metalness:.03});
 const green=new THREE.MeshStandardMaterial({color:'#214c39',roughness:1}),wood=new THREE.MeshStandardMaterial({color:'#bb8752',roughness:.8});
 const cache=new Map();
 function shapes(char){const path=new THREE.ShapePath();for(const [op,points] of glyphs[char].outline){const p=points.flat().map(n=>n/units);if(op==='moveTo')path.moveTo(...p);else if(op==='lineTo')path.lineTo(...p);else if(op==='curveTo')path.bezierCurveTo(...p);else if(op==='qCurveTo')path.quadraticCurveTo(...p);else if(op==='closePath')path.currentPath.closePath()}return path.toShapes(true)}
 function glyph(char,relief=false){const key=char+relief;if(cache.has(key))return cache.get(key);const geo=relief?new THREE.ExtrudeGeometry(shapes(char),{depth:relief==='finish'?.04:.075,bevelEnabled:true,bevelSize:relief==='finish'?.012:.04,bevelThickness:relief==='finish'?.02:.045,bevelSegments:relief==='finish'?3:4,curveSegments:9,steps:1}):new THREE.ShapeGeometry(shapes(char),5);if(relief){const pos=geo.attributes.position,norm=geo.attributes.normal,sums=new Map();for(let i=0;i<pos.count;i++){const key=[pos.getX(i),pos.getY(i),pos.getZ(i)].map(v=>Math.round(v*1e5)).join(','),sum=sums.get(key)||new THREE.Vector3();sum.x+=norm.getX(i);sum.y+=norm.getY(i);sum.z+=norm.getZ(i);sums.set(key,sum)}for(const sum of sums.values())sum.normalize();const capCount=geo.groups.find(g=>g.materialIndex===0)?.count||0;for(let i=capCount;i<pos.count;i++){const key=[pos.getX(i),pos.getY(i),pos.getZ(i)].map(v=>Math.round(v*1e5)).join(','),n=sums.get(key);norm.setXYZ(i,n.x,n.y,n.z)}}geo.computeBoundingBox();if(relief){const b=geo.boundingBox;geo.translate(-(b.min.x+b.max.x)/2,0,0)}cache.set(key,geo);return geo}
 for(const c of '0123456789:.')glyph(c,true);
 const plate=new THREE.Mesh(new THREE.BoxGeometry(1,1,.07),green);plate.position.z=-.16;group.add(plate);
 const frame=new THREE.Mesh(new THREE.BoxGeometry(1,1,.12),wood);frame.position.z=-.22;group.add(frame);
 function fit(aspect){const height=Math.max(3.8,10/Math.max(.2,aspect)),width=Math.max(10,3.8*aspect);plate.scale.set(width,height,1);frame.scale.set(width+.18,height+.18,1);return {width:width+.18,height:height+.18}}
 fit(2.6);
 function line(text,size,y){const row=new THREE.Group(),spacing=.05,width=[...text].reduce((sum,c)=>sum+glyphs[c].advance/units*size,0)+(text.length-1)*spacing;let x=-width/2;for(const c of text){const mesh=new THREE.Mesh(glyph(c,'finish'),cream);mesh.scale.set(size,size,size*.65);mesh.position.set(x+glyphs[c].advance/units*size/2,y,.025);mesh.userData.countdownRelief=true;row.add(mesh);x+=glyphs[c].advance/units*size+spacing}return row}
 const finished=line('时间到',1.18,-.43);finished.visible=false;group.add(finished);
 const slots=[];function slot(x,y,size,material,char){const mesh=new THREE.Mesh(glyph(char,true),material);mesh.scale.setScalar(size);mesh.position.set(x,y,.035);mesh.userData.countdownRelief=true;mesh.userData.char=char;group.add(mesh);slots.push(mesh)}
 // Fixed centers, independent of the width of any glyph, keep every column steady.
 [-3.32,-1.64,-.44,.76,2.44].forEach((x,i)=>slot(x,-.95,i===2?2.42:2.50,cream,'03:00'[i]));
 [3.41,3.79,4.27].forEach((x,i)=>slot(x,-.95,.7,gold,'.00'[i]));
 let lastState='ready';
 function update({text,state,hundredths='00'}){let changed=false;const chars=text+'.'+hundredths;slots.forEach((mesh,i)=>{const c=chars[i];if(c&&c!==mesh.userData.char){mesh.geometry=glyph(c,true);mesh.userData.char=c;changed=true}});if(state!==lastState){finished.visible=state==='finished';for(const mesh of slots)mesh.visible=state!=='finished';lastState=state;changed=true}return changed}
 update({text:'03:00',state:'ready'});return {group,update,fit,slots,geometryCount:()=>cache.size};
}
