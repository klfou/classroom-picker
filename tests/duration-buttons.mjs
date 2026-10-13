import assert from 'node:assert/strict';
import {createDurationButtons} from '../dist/duration-buttons.js';

// Native Enter/Space clicks are supplied by the browser. This minimal DOM tests
// the helper's handlers and verifies that those native key defaults stay free.
let assertions=0;
const equal=(actual,expected)=>{assert.deepEqual(actual,expected);assertions++};
function fixture(values=[1,2,3],initial=2){
 const document={activeElement:null},changes=[];
 const buttons=values.map(value=>({
  dataset:{value:String(value)},attributes:{},listeners:new Map(),disabled:false,
  setAttribute(name,value){this.attributes[name]=String(value)},
  getAttribute(name){return this.attributes[name]??null},
  addEventListener(type,fn){this.listeners.set(type,fn)},
  dispatch(type,extra={}){const event={type,target:this,preventDefault(){this.defaultPrevented=true},...extra};this.listeners.get(type)?.(event);return event},
  click(){if(!this.disabled)this.dispatch('click')},
  focus(){document.activeElement=this}
 }));
 const group={attributes:{},querySelectorAll(selector){equal(selector,'button[data-value]');return buttons},setAttribute(name,value){this.attributes[name]=String(value)}};
 const api=createDurationButtons(group,initial,value=>changes.push(value));
 const button=value=>buttons.find(b=>Number(b.dataset.value)===value);
 const selected=()=>Number(buttons.find(b=>b.getAttribute('aria-checked')==='true').dataset.value);
 function check(value,disabled=false){
  equal(selected(),value);
  equal(buttons.map(b=>b.getAttribute('aria-checked')),values.map(v=>String(v===value)));
  equal(buttons.map(b=>b.tabIndex),values.map(v=>v===value?0:-1));
  equal(buttons.map(b=>b.disabled),values.map(()=>disabled));
 }
 return{document,changes,buttons,group,api,button,selected,check};
}

const draw=fixture();draw.check(2);equal(draw.changes,[]);
draw.button(1).click();draw.check(1);equal(draw.changes,[1]);
draw.button(3).click();draw.check(3);equal(draw.changes,[1,3]);
const fallback=fixture([3,5,10],99);fallback.check(3);equal(fallback.changes,[]);

for(const values of[[1,2,3],[3,5,10]]){
 const first=values[0],middle=values[1],last=values[2];
 for(const[key,start,end]of[
  ['ArrowRight',first,middle],['ArrowRight',last,first],
  ['ArrowDown',middle,last],['ArrowDown',last,first],
  ['ArrowLeft',middle,first],['ArrowLeft',first,last],
  ['ArrowUp',last,middle],['ArrowUp',first,last],
  ['Home',last,first],['End',first,last]
 ]){
  const f=fixture(values,start),event=f.button(start).dispatch('keydown',{key});
  f.check(end);equal(event.defaultPrevented,true);equal(f.document.activeElement,f.button(end));equal(f.changes,[end]);
 }
 const f=fixture(values,middle);
 for(const key of['Tab','Enter',' ','Escape','a']){
  const event=f.button(last).dispatch('keydown',{key});
  equal(event.defaultPrevented,undefined);f.check(middle);equal(f.changes,[]);
 }
 // Model the native click following each unprevented activation key.
 for(const key of['Enter',' ']){
  const event=f.button(last).dispatch('keydown',{key});
  if(!event.defaultPrevented)f.button(last).click();
  f.check(last);
 }
 equal(f.changes,[last,last]);

 const locked=fixture(values,middle);locked.api.setDisabled(true);
 locked.check(middle,true);equal(locked.group.attributes['aria-disabled'],'true');
 locked.button(first).click();locked.button(first).dispatch('click');
 locked.button(middle).dispatch('keydown',{key:'Home'});
 locked.button(middle).dispatch('keydown',{key:'End'});
 locked.check(middle,true);equal(locked.changes,[]);equal(locked.document.activeElement,null);
 locked.api.setDisabled(false);locked.check(middle);equal(locked.group.attributes['aria-disabled'],'false');
 locked.button(last).click();locked.check(last);equal(locked.changes,[last]);
}

const rapid=fixture([3,5,10],3);
for(let i=0;i<90;i++)rapid.button([3,5,10][i%3]).click();
rapid.check(10);equal(rapid.changes.length,90);
console.log(`PASS ${assertions} duration-button assertions: initial/fallback selection, sparse presets, roving focus, wrap arrows, Home/End, native activation defaults, disabled rejection, reenable, and rapid changes.`);

const allMinutes=Array.from({length:10},(_,i)=>i+1),expanded=fixture(allMinutes,2);expanded.check(2);
for(const value of allMinutes){expanded.button(value).click();expanded.check(value)}
for(const [start,key,expected] of [[10,'ArrowRight',1],[1,'ArrowLeft',10],[7,'Home',1],[3,'End',10],[1,'ArrowDown',2],[10,'ArrowUp',9]]){
 const f=fixture(allMinutes,start),event=f.button(start).dispatch('keydown',{key});f.check(expected);equal(event.defaultPrevented,true);equal(f.document.activeElement,f.button(expected));
}
console.log('PASS all ten minute buttons, default2, single tab stop, full-range arrow wrapping and Home/End');
