import {ROSTER_LIMITS, validateRows} from './roster.js';

// Seat positions and raw drafts live here, never in hidden form fields. The one
// editor input is kept alive until load(), so typing and IME composition do not
// recreate it. Nothing in this module writes to persistent storage.
export function createRosterEditor(container, onChange = () => {}) {
 const doc=container.ownerDocument || document;
 let rowCount=8, selectedKey=null, composing=false, compositionKey=null, staleCompositionTail=false;
 const drafts=new Map(), cards=new Map();
 const keyOf=(row,col)=>`${row}:${col}`;
 const coordinate=(row,col)=>`第 ${row} 排 · 第 ${col} 列`;
 const genderText=gender=>gender==='male'?'男':gender==='female'?'女':'';
 const make=(tag,className,text)=>{const node=doc.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
 let bar=doc.querySelector('#seat-editor-bar');
 if(!bar){
  bar=make('div');bar.id='seat-editor-bar';
  // A small fallback for embedded/test hosts. The production host supplies this
  // sibling of .roster-content, keeping it outside the scrolling seat grid.
  const scroller=container.parentElement;
  if(scroller?.after)scroller.after(bar);else (scroller?.parentElement || scroller || container).append(bar);
 }
 const position=make('span','seat-editor-coordinate');position.id='seat-editor-coordinate';
 const nameInput=make('input','seat-name-input');nameInput.id='seat-name';nameInput.type='text';nameInput.placeholder='填写姓名';nameInput.autocomplete='off';nameInput.spellcheck=false;
 const genders=make('div','seat-gender-controls');genders.setAttribute('role','group');genders.setAttribute('aria-label','性别，可留空');
 const male=make('button','seat-gender-toggle','男');male.id='seat-gender-male';male.type='button';male.setAttribute('aria-label','男，再次点击取消设置');
 const female=make('button','seat-gender-toggle','女');female.id='seat-gender-female';female.type='button';female.setAttribute('aria-label','女，再次点击取消设置');
 const clear=make('button','seat-clear','清空座位');clear.id='seat-clear';clear.type='button';
 genders.append(male,female);bar.replaceChildren(position,nameInput,genders,clear);bar.setAttribute('role','group');bar.setAttribute('aria-label','编辑选中座位');
 container.setAttribute('role','group');container.setAttribute('aria-label','座位安排，老师视角，上方为后排，下方为讲台，第 1 排最近，方向键切换座位，回车编辑姓名');

 function paintCard(key) {
  const card=cards.get(key);if(!card)return;
  const draft=drafts.get(key),name=draft?.name || '',occupied=Boolean(name.trim()),gender=occupied?genderText(draft?.gender):'';
  card.label.textContent=occupied?name:'＋';
  card.badge.textContent=gender;card.badge.hidden=!gender;card.badge.className=`seat-gender-badge${gender?' '+draft.gender:''}`;
  card.button.classList.toggle('is-empty',!occupied);
  card.button.classList.toggle('is-selected',key===selectedKey);
  card.button.setAttribute('aria-pressed',String(key===selectedKey));
  card.button.setAttribute('aria-label',`${coordinate(card.row,card.col)}，${occupied?name:'空座'}${gender?'，'+gender:''}`);
 }
 function paintBar({fillName=false}={}) {
  const card=cards.get(selectedKey);if(!card)return;
  const draft=drafts.get(selectedKey),occupied=Boolean(draft?.name?.trim());
  position.textContent=coordinate(card.row,card.col);
  nameInput.setAttribute('aria-label',`${coordinate(card.row,card.col)}姓名`);
  if(fillName)nameInput.value=draft?.name || '';
  for(const [button,gender] of [[male,'male'],[female,'female']]) {
   button.disabled=!occupied;
   button.setAttribute('aria-pressed',String(occupied&&draft.gender===gender));
  }
  clear.disabled=!draft || (draft.name===''&&!draft.gender&&!draft.id);
 }
 function clearError(key) {
  cards.get(key)?.button.classList.remove('is-invalid');
  cards.get(key)?.button.removeAttribute('aria-invalid');
  if(key===selectedKey)nameInput.removeAttribute('aria-invalid');
 }
 function mutateName(value,key=selectedKey) {
  const card=cards.get(key);if(!card)return false;
  const previous=drafts.get(key),next={row:card.row,col:card.col,...previous,name:value};
  if(!value.trim())delete next.gender;
  if(previous?.name===next.name && (previous.gender || '')===(next.gender || ''))return false;
  if(!previous && value==='')return false;
  drafts.set(key,next);clearError(key);paintCard(key);if(key===selectedKey)paintBar();onChange();return true;
 }
 function flush() { if(selectedKey&&(!composing||compositionKey===selectedKey))mutateName(nameInput.value); }
 function select(row,col,{focus=false}={}) {
  const next=keyOf(row,col);if(!cards.has(next))return false;
  if(next!==selectedKey){
   flush();const previous=selectedKey;selectedKey=next;
   if(previous)paintCard(previous);paintCard(next);paintBar({fillName:true});
   nameInput.removeAttribute('aria-invalid');
   if(cards.get(next).button.classList.contains('is-invalid'))nameInput.setAttribute('aria-invalid','true');
  }
  if(focus)cards.get(next).button.focus();
  return true;
 }
 function setGender(gender) {
  flush();const draft=drafts.get(selectedKey);if(!draft?.name.trim())return;
  const next={...draft};if(next.gender===gender)delete next.gender;else next.gender=gender;
  drafts.set(selectedKey,next);clearError(selectedKey);paintCard(selectedKey);paintBar();onChange();
 }
 nameInput.addEventListener('input',event=>{
  // A browser normally ends composition before another card receives focus.
  // Ignore a late composition event after a programmatic seat switch rather
  // than allowing it to overwrite that newly selected seat.
  if(composing&&compositionKey!==selectedKey)return;
  if(staleCompositionTail&&(event.isComposing||/composition/i.test(event.inputType || ''))){paintBar({fillName:true});return;}
  staleCompositionTail=false;mutateName(nameInput.value);
 });
 nameInput.addEventListener('compositionstart',()=>{composing=true;compositionKey=selectedKey;staleCompositionTail=false;});
 nameInput.addEventListener('compositionend',()=>{
  const sameSeat=compositionKey===selectedKey;composing=false;compositionKey=null;staleCompositionTail=!sameSeat;
  if(sameSeat)flush();else paintBar({fillName:true});
 });
 nameInput.addEventListener('blur',flush);
 nameInput.addEventListener('keydown',event=>{
  if(event.key==='Enter'&&!composing&&!event.isComposing&&event.keyCode!==229){event.preventDefault();flush();cards.get(selectedKey)?.button.focus();}
 });
 male.addEventListener('click',()=>setGender('male'));female.addEventListener('click',()=>setGender('female'));
 clear.addEventListener('click',()=>{
  flush();if(!drafts.has(selectedKey))return;
  drafts.delete(selectedKey);clearError(selectedKey);paintCard(selectedKey);paintBar({fillName:true});onChange();nameInput.focus();
 });
 function appendCard(row,col) {
  const key=keyOf(row,col),button=make('button','seat-card');button.type='button';
  button.dataset.row=String(row);button.dataset.col=String(col);
  const label=make('span','seat-card-name'),badge=make('span','seat-gender-badge');badge.setAttribute('aria-hidden','true');
  button.append(label,badge);cards.set(key,{button,label,badge,row,col});paintCard(key);
  button.addEventListener('click',()=>select(row,col));
  button.addEventListener('focus',()=>select(row,col));
  button.addEventListener('keydown',event=>{
   if(event.isComposing||event.keyCode===229)return;
   if(event.key==='Enter'){event.preventDefault();select(row,col);nameInput.focus();return;}
   const move={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[1,0],ArrowDown:[-1,0]}[event.key];
   if(!move||event.altKey||event.ctrlKey||event.metaKey)return;
   event.preventDefault();select(Math.min(rowCount,Math.max(1,row+move[0])),Math.min(ROSTER_LIMITS.columns,Math.max(1,col+move[1])),{focus:true});
  });
  container.append(button);
 }
 function read() {
  flush();
  // Keep nonempty raw whitespace so an invalid draft cannot silently disappear.
  return [...drafts.values()].filter(seat=>seat.name!=='').map(seat=>({...seat})).sort((a,b)=>a.row-b.row||a.col-b.col);
 }
 return {
  load(seats=[]) {
   composing=false;compositionKey=null;staleCompositionTail=false;selectedKey=null;drafts.clear();cards.clear();nameInput.value='';nameInput.removeAttribute('aria-invalid');
   rowCount=Math.min(ROSTER_LIMITS.rows,Math.max(8,...seats.map(seat=>Number(seat.row)||0)));
   for(const seat of seats){const draft={row:seat.row,col:seat.col,name:seat.name || '',...(seat.id?{id:seat.id}:{}),...(seat.gender?{gender:seat.gender}:{})};if(!draft.name.trim())delete draft.gender;drafts.set(keyOf(seat.row,seat.col),draft);}
   container.replaceChildren();
   const corner=make('span','seat-grid-corner');corner.setAttribute('aria-hidden','true');container.append(corner);
   for(let col=1;col<=ROSTER_LIMITS.columns;col++)container.append(make('span','seat-column-heading',`${col}列`));
   // Teacher viewpoint: the rear is above the front row and lectern. Reverse
   // only display order; physical row/column keys and read() stay unchanged.
   for(let row=rowCount;row>=1;row--){
    container.append(make('span','seat-row-label',`${row}排`));
    for(let col=1;col<=ROSTER_LIMITS.columns;col++)appendCard(row,col);
   }
   const occupied=[...drafts.values()].filter(seat=>seat.name.trim()).sort((a,b)=>a.row-b.row||a.col-b.col)[0];
   select(occupied?.row || 1,occupied?.col || 1);
  },
  validate() {
   const rows=read();
   if(!rows.length)return {seats:[],warnings:['这个班级将没有学生，可稍后继续填写。']};
   try{return validateRows(rows);}catch(error){
    const record=error.message.match(/第 (\d+) 条记录/),seat=record?rows[Number(record[1])-1]:null;
    if(seat){
     select(seat.row,seat.col);const card=cards.get(selectedKey);card?.button.classList.add('is-invalid');card?.button.setAttribute('aria-invalid','true');nameInput.setAttribute('aria-invalid','true');
     card?.button.scrollIntoView?.({block:'nearest',inline:'nearest'});nameInput.focus();
     throw new Error(`${coordinate(seat.row,seat.col)}：${error.message}`);
    }
    throw error;
   }
  },
  isComposing:()=>composing,
  read,
  select
 };
}
