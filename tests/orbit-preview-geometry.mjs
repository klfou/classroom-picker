import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCardModel} from '../dist/orbit-preview/space-card-model.js';
const names=Array.from({length:64},(_,i)=>i<2?'同名同学':`学生${i+1}`),reports=[];
for(const [w,h]of [[1366,518],[1920,806],[900,700],[390,492]]){
 const m=createCardModel();m.resize(w,h);m.setNames(names);m.sample(0);m.start(10000);
 const phases=[];
 for(const t of [0,399,400,1399,1400,1749,1750]){m.sample(10000+t);phases.push([t,m.stage]);for(const c of m.order)assert.ok(c.mesh.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.z>0))}
 m.sample(10800);let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const c of m.order){minX=Math.min(minX,c.minX);maxX=Math.max(maxX,c.maxX);minY=Math.min(minY,c.minY);maxY=Math.max(maxY,c.maxY);assert.ok(Math.abs(Math.hypot(c.x,c.y,c.z-10.2)-3.05*Math.min(1,w/h/1.18))<1e-8)}assert.ok(minX>=0&&maxX<=w&&minY>=0&&maxY<=h,'Full sphere fits viewport');
 const near=m.order.filter(c=>c.facing>.6).length,edge=m.order.filter(c=>Math.abs(c.facing)<.15).length,back=m.order.filter(c=>c.facing<-.6).length;assert.ok(near&&edge&&back);
 m.sample(11750);const source=m.cards.find(c=>c.rosterIndex===1);const before={x:source.x,y:source.y,z:source.z,width:source.width,height:source.height};assert.equal(m.reveal(names[1],11750,1),true);assert.equal(m.selected.rosterIndex,1);assert.equal(m.selected.sourceCardId,source.id);for(const k of Object.keys(before))assert.ok(Math.abs(m.selected[k]-before[k])<1e-8,`${k} has no reveal jump`);
 let lastZ=m.selected.z,maxMotion=0;for(let t=0;t<=360;t+=10){const oldX=m.selected.screenX,oldY=m.selected.screenY;m.sample(11750+t);assert.ok(m.selected.z<=lastZ);lastZ=m.selected.z;maxMotion=Math.max(maxMotion,Math.hypot(m.selected.screenX-oldX,m.selected.screenY-oldY));assert.ok(m.order.every(c=>c.mesh.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))))}assert.equal(m.order.length,1);assert.equal(m.selected.screenX,w*.5);assert.equal(m.selected.screenY,h*.49);
 reports.push({w,h,phases,sphereBounds:{minX,maxX,minY,maxY},near,edge,back,sourceIndex:1,sourceCardId:source.id,revealStart:before,revealNoJump:true,settledOnlySelected:true,maxMotionPer10ms:maxMotion});
}
if(process.env.ORBIT_GEOMETRY_REPORT)fs.writeFileSync(process.env.ORBIT_GEOMETRY_REPORT,JSON.stringify(reports,null,2));console.log('PASS sphere bounds and real sphere coordinates at four sizes; tangible front/edge/back poses; exact duplicated-name index, identical source pose at reveal, monotonic z flight and clean360ms result.');
