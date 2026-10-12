import assert from 'node:assert/strict';
import {createRosterEditor} from '../dist/roster-editor.js';

// Minimal DOM deliberately omits browser-only convenience methods, matching the
// app's existing deterministic integration harness. No runtime dependencies.
class Element {
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.parentElement=null;this.attributes={};this.dataset={};this.className='';this.textContent='';this.value='';this.listeners=new Map();this.hidden=false;this.disabled=false;this.classList={contains:n=>this.className.split(' ').includes(n),add:n=>{if(!this.classList.contains(n))this.className+=' '+n;},remove:n=>{this.className=this.className.split(' ').filter(x=>x!==n).join(' ');},toggle:(n,yes)=>yes?this.classList.add(n):this.classList.remove(n)};}
 append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 setAttribute(k,v){this.attributes[k]=String(v);}
 getAttribute(k){return this.attributes[k]??null;}
 removeAttribute(k){delete this.attributes[k];}
 addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn);}
 dispatchEvent(event){event.target??=this;event.preventDefault??=()=>{event.defaultPrevented=true;};for(const fn of this.listeners.get(event.type)||[])fn(event);return event;}
 click(){if(!this.disabled)this.dispatchEvent({type:'click'});}
 focus(){const previous=this.ownerDocument.activeElement;if(previous===this)return;previous?.dispatchEvent({type:'blur'});this.ownerDocument.activeElement=this;this.dispatchEvent({type:'focus'});}
 querySelectorAll(selector){const result=[];const matches=node=>selector.startsWith('#')?node.id===selector.slice(1):selector.startsWith('.')?node.classList.contains(selector.slice(1)):node.tagName===selector;for(const child of this.children){if(matches(child))result.push(child);result.push(...child.querySelectorAll(selector));}return result;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
const doc={createElement:tag=>new Element(tag,doc),activeElement:null};
doc.root=doc.createElement('div');doc.querySelector=s=>doc.root.querySelector(s);
const scroller=doc.createElement('div'),container=doc.createElement('div'),bar=doc.createElement('div');bar.id='seat-editor-bar';scroller.append(container);doc.root.append(scroller,bar);
let changes=0;const editor=createRosterEditor(container,()=>changes++);
const name=doc.querySelector('#seat-name'),male=doc.querySelector('#seat-gender-male'),female=doc.querySelector('#seat-gender-female'),clear=doc.querySelector('#seat-clear');
const cards=()=>container.querySelectorAll('.seat-card'),card=(r,c)=>cards().find(n=>Number(n.dataset.row)===r&&Number(n.dataset.col)===c);
const type=(value,extra={})=>{name.value=value;name.dispatchEvent({type:'input',...extra});};
const assertTeacherOrder=rowCount=>{
 const columns=Array.from({length:8},(_,i)=>i+1),rows=Array.from({length:rowCount},(_,i)=>rowCount-i);
 assert.deepEqual(container.querySelectorAll('.seat-column-heading').map(n=>n.textContent),columns.map(c=>`${c}列`));
 assert.deepEqual(container.querySelectorAll('.seat-row-label').map(n=>n.textContent),rows.map(r=>`${r}排`));
 assert.deepEqual(cards().map(n=>[Number(n.dataset.row),Number(n.dataset.col)]),rows.flatMap(r=>columns.map(c=>[r,c])),'DOM/tab order is rear to front, with unchanged left-to-right columns');
 for(const [i,row] of rows.entries()){
  const start=9+i*9;
  assert.equal(container.children[start].textContent,`${row}排`);
  assert.equal(container.children[start+1],card(row,1));
  assert.equal(container.children[start+8],card(row,8));
 }
 assert.match(container.getAttribute('aria-label'),/老师视角，上方为后排，下方为讲台，第 1 排最近/);
};
const loaded=[{row:1,col:2,name:'甲',gender:'male',id:'id-a'},{row:3,col:4,name:'乙',gender:'female',id:'id-b'},{row:8,col:8,name:'未知'}];
editor.load(loaded);
assert.equal(cards().length,64);assert.equal(container.querySelectorAll('input').length,0);assert.equal(doc.root.querySelectorAll('input').length,1);assert.equal(bar.parentElement,doc.root);assert.equal(changes,0);assert.equal(name.value,'甲');assert.equal(card(1,2).type,'button');assert.equal(card(1,2).getAttribute('aria-pressed'),'true');assert.match(card(1,2).getAttribute('aria-label'),/第 1 排 · 第 2 列，甲，男/);assert.equal(card(8,8).getAttribute('aria-label'),'第 8 排 · 第 8 列，未知');assert.equal(container.querySelectorAll('.seat-column-heading').length,8);assert.equal(container.querySelectorAll('.seat-row-label').length,8);
assertTeacherOrder(8);assert.deepEqual(editor.read(),loaded,'Reading follows actual coordinates, never the reversed display order');
// Selection alone and duplicate input events never dirty the draft.
card(3,4).click();card(1,2).click();type('甲');assert.equal(changes,0);
type('甲改');const liveInput=name;card(3,4).click();type('乙改');female.click();card(8,8).click();male.click();
assert.equal(doc.querySelector('#seat-name'),liveInput);assert.equal(changes,4);
assert.deepEqual(editor.validate().seats,[{row:1,col:2,name:'甲改',gender:'male',id:'id-a'},{row:3,col:4,name:'乙改',id:'id-b'},{row:8,col:8,name:'未知',gender:'male'}]);assert.deepEqual(loaded[0],{row:1,col:2,name:'甲',gender:'male',id:'id-a'});
// Reload is Cancel: every draft, clear, gender and identity returns to baseline.
editor.load(loaded);assert.deepEqual(editor.validate().seats,loaded);assert.equal(changes,4);
card(3,4).click();clear.click();assert.equal(name.value,'');assert.equal(male.disabled,true);assert.equal(female.getAttribute('aria-pressed'),'false');assert.equal(card(3,4).classList.contains('is-empty'),true);assert.equal(editor.validate().seats.length,2);type('新同学');assert.equal(editor.validate().seats.find(s=>s.row===3).id,undefined);
editor.load(loaded);assert.equal(editor.validate().seats.find(s=>s.row===3).id,'id-b');assert.equal(editor.validate().seats.find(s=>s.row===3).gender,'female');
// Erasing the name clears gender. Raw whitespace is a dirty invalid draft.
card(1,2).click();type('');assert.equal(male.getAttribute('aria-pressed'),'false');assert.equal(card(1,2).querySelector('.seat-gender-badge').hidden,true);assert.equal(editor.validate().seats.length,2);type('甲恢复');assert.equal(editor.validate().seats[0].id,'id-a');assert.equal(editor.validate().seats[0].gender,undefined);
card(2,1).click();const beforeWhitespace=changes;type('  ');assert.equal(changes,beforeWhitespace+1);assert.throws(()=>editor.validate(),/第 2 排 · 第 1 列.*缺少姓名/);assert.equal(doc.activeElement,name);assert.equal(name.getAttribute('aria-invalid'),'true');assert.equal(card(2,1).getAttribute('aria-invalid'),'true');type('丙');assert.equal(name.getAttribute('aria-invalid'),null);assert.equal(card(2,1).classList.contains('is-invalid'),false);
type('X'.repeat(81));assert.throws(()=>editor.validate(),/第 2 排 · 第 1 列.*80/);type('含\u0001字符');assert.throws(()=>editor.validate(),/第 2 排 · 第 1 列.*控制字符/);
// Hostile text stays text, without introducing any markup or extra inputs.
type('<img src=x onerror=alert(1)>');assert.equal(card(2,1).querySelector('.seat-card-name').textContent,'<img src=x onerror=alert(1)>');assert.equal(container.querySelectorAll('img').length,0);
// Native Tab traversal remains enabled; card focus selects, arrows navigate,
// Enter enters the one editor, while composition Enter never moves focus.
editor.load(loaded);card(1,2).focus();let event=card(1,2).dispatchEvent({type:'keydown',key:'ArrowUp'});assert.equal(event.defaultPrevented,true);assert.equal(doc.activeElement,card(2,2));assert.equal(name.value,'');
card(2,2).dispatchEvent({type:'keydown',key:'ArrowDown'});assert.equal(doc.activeElement,card(1,2));assert.equal(name.value,'甲');
card(1,2).dispatchEvent({type:'keydown',key:'ArrowDown'});assert.equal(doc.activeElement,card(1,2),'Down at the front row stays at row 1');
card(1,2).dispatchEvent({type:'keydown',key:'ArrowUp'});card(2,2).dispatchEvent({type:'keydown',key:'ArrowLeft'});assert.equal(doc.activeElement,card(2,1));card(2,1).dispatchEvent({type:'keydown',key:'ArrowLeft'});assert.equal(doc.activeElement,card(2,1));card(2,1).dispatchEvent({type:'keydown',key:'Enter'});assert.equal(doc.activeElement,name);
name.dispatchEvent({type:'compositionstart'});type('中',{isComposing:true});type('中文',{isComposing:true});event=name.dispatchEvent({type:'keydown',key:'Enter',isComposing:true});assert.equal(event.defaultPrevented,undefined);assert.equal(doc.activeElement,name);name.dispatchEvent({type:'compositionend'});assert.equal(editor.read().find(s=>s.row===2&&s.col===1).name,'中文');assert.equal(doc.querySelector('#seat-name'),liveInput);name.dispatchEvent({type:'keydown',key:'Enter'});assert.equal(doc.activeElement,card(2,1));event=card(2,1).dispatchEvent({type:'keydown',key:'Tab'});assert.equal(event.defaultPrevented,undefined);card(2,2).focus();assert.equal(card(2,2).getAttribute('aria-pressed'),'true');
// Switching flushes text even if an input event has not yet arrived.
name.value='未派发输入';card(4,4).click();assert.equal(editor.read().find(s=>s.row===2&&s.col===2).name,'未派发输入');
// Late composition-end after a programmatic switch cannot rename another seat.
name.dispatchEvent({type:'compositionstart'});type('拼音草稿',{isComposing:true});card(3,4).click();type('延迟结束文本',{isComposing:false});name.dispatchEvent({type:'compositionend'});assert.equal(name.value,'乙');assert.equal(editor.read().find(s=>s.row===4&&s.col===4).name,'拼音草稿');type('延迟最终提交',{isComposing:false,inputType:'insertFromComposition'});assert.equal(name.value,'乙');assert.equal(editor.validate().seats.find(s=>s.row===3&&s.col===4).name,'乙');type('乙正常输入',{inputType:'insertText'});assert.equal(editor.read().find(s=>s.row===3&&s.col===4).name,'乙正常输入');name.dispatchEvent({type:'compositionstart'});type('正常拼音',{isComposing:true});name.dispatchEvent({type:'compositionend'});type('正常拼音完成',{inputType:'insertFromComposition'});assert.equal(editor.read().find(s=>s.row===3&&s.col===4).name,'正常拼音完成');
// All sixteen imported rows survive, including the final physical coordinate.
editor.load([{row:16,col:8,name:'最后',gender:'female',id:'last'}]);assert.equal(cards().length,128);assertTeacherOrder(16);assert.equal(name.value,'最后');type('最后修改');assert.deepEqual(editor.validate().seats,[{row:16,col:8,name:'最后修改',gender:'female',id:'last'}]);card(16,8).focus();card(16,8).dispatchEvent({type:'keydown',key:'ArrowUp'});assert.equal(doc.activeElement,card(16,8),'Up at the rear row stays at row 16');
card(16,8).dispatchEvent({type:'keydown',key:'ArrowRight'});assert.equal(doc.activeElement,card(16,8));
card(16,8).dispatchEvent({type:'keydown',key:'ArrowDown'});assert.equal(doc.activeElement,card(15,8));
for(const extra of [{altKey:true},{ctrlKey:true},{metaKey:true},{isComposing:true},{keyCode:229}]){
 event=card(15,8).dispatchEvent({type:'keydown',key:'ArrowDown',...extra});assert.equal(event.defaultPrevented,undefined);assert.equal(doc.activeElement,card(15,8));
}
// Sparse imports keep physical coordinates and IDs; empty holes do not collapse.
const sparse=[{row:16,col:8,name:'后右',id:'rear'},{row:1,col:1,name:'前左',id:'front'},{row:9,col:3,name:'中间',gender:'male',id:'middle'}];
editor.load(sparse);assertTeacherOrder(16);assert.equal(name.value,'前左');assert.equal(card(8,4).classList.contains('is-empty'),true);
assert.deepEqual(editor.read(),[sparse[1],sparse[2],sparse[0]]);assert.deepEqual(sparse.map(s=>s.id),['rear','front','middle']);
const readCopy=editor.read();readCopy[0].row=12;readCopy[0].name='外部更改';assert.equal(editor.read()[0].name,'前左');assert.equal(editor.read()[0].row,1);
// A one-row class and an empty class retain the same eight-row editing canvas.
editor.load([{row:1,col:1,name:'唯一',gender:'female',id:'only'}]);assertTeacherOrder(8);assert.equal(cards().length,64);assert.equal(name.value,'唯一');assert.equal(card(1,1).getAttribute('aria-pressed'),'true');
editor.load([]);assertTeacherOrder(8);assert.equal(cards().length,64);assert.equal(card(1,1).getAttribute('aria-pressed'),'true');assert.equal(clear.disabled,true);assert.deepEqual(editor.validate(),{seats:[],warnings:['这个班级将没有学生，可稍后继续填写。']});
console.log('PASS seat-card editor: teacher-view DOM order, unchanged coordinates/IDs/read sorting, multi-seat draft, Cancel/reload, clear/restore, blank gender, contextual validation, XSS-safe text, visual keyboard directions/boundaries/modifiers, IME, and 8/16/sparse/one-row/empty coverage.');
