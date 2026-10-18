import {validateRows} from './roster.js';
export const CLASS_KEY='sunlit-classes-v3', BACKUP_KEY=CLASS_KEY+'-backup', TRANSFER_BACKUP_KEY=CLASS_KEY+'-import-backup';
const clone=value=>JSON.parse(JSON.stringify(value));
const seatKey=seat=>`${seat.row}:${seat.col}`;
export function className(value){const name=String(value??'').trim().replace(/\s+/gu,' ').normalize('NFC');if(!name||name.length>30||/[\u0000-\u001f\u007f]/u.test(name))throw Error('班级名称请填写 1–30 个字。');return name;}
function readClass(item){
 if(!item||typeof item.id!=='string'||!item.id||!Array.isArray(item.seats))throw Error('班级记录不完整');
 const seats=item.seats.length?validateRows(item.seats).seats:[],keys=new Set(seats.map(seatKey));
 return {id:item.id,name:className(item.name),seats,sample:item.sample===true,noRepeat:item.noRepeat!==false,used:[...new Set((Array.isArray(item.used)?item.used:[]).filter(key=>typeof key==='string'&&keys.has(key)))]};
}
function parse(raw){
 const value=JSON.parse(raw);if(value?.version!==3||!Array.isArray(value.classes)||!value.classes.length)throw Error('班级资料格式不正确');
 const classes=value.classes.map(readClass);if(new Set(classes.map(c=>c.id)).size!==classes.length||new Set(classes.map(c=>c.name)).size!==classes.length)throw Error('班级标识或名称重复');
 const deleted=(value.deleted||[]).map(readClass);if(new Set([...classes,...deleted].map(c=>c.id)).size!==classes.length+deleted.length)throw Error('班级标识重复');
 return {version:3,classes,activeId:classes.some(c=>c.id===value.activeId)?value.activeId:classes[0].id,deleted,...([TRANSFER_BACKUP_KEY,TRANSFER_BACKUP_KEY+'-next'].includes(value.transferBackupSlot)?{transferBackupSlot:value.transferBackupSlot}:{})};
}
export function createClassStore({storage,sampleSeats,id=()=>globalThis.crypto.randomUUID(),onWarning=()=>{}}){
 let state,blocked=false,warning='',primary=null;
 const publicState=()=>{const copy=clone(state);delete copy.transferBackupSlot;return copy};
 const warn=message=>{warning=message;onWarning(message)};
 try{
  primary=storage?.getItem(CLASS_KEY)??null;
  const backup=storage?.getItem(BACKUP_KEY)??null;
  if(primary){try{state=parse(primary)}catch{if(backup){state=parse(backup);blocked=true;warn('班级资料损坏，已读取上次备份。为保护原资料，暂时不能保存；请勿清除浏览器数据。')}else throw Error('损坏')}}
  else if(backup){state=parse(backup);warn('已从本机备份恢复班级。')}
  if(!state){
   const legacyRaw=storage?.getItem('sunlit-roster');let seats=sampleSeats,sample=true;
   if(legacyRaw){const old=JSON.parse(legacyRaw);if(old&&!old.sample){const rows=old.version===2?old.seats:(old.names||[]).map((name,i)=>({name,row:Math.floor(i/8)+1,col:i%8+1}));seats=validateRows(rows).seats;sample=false}}
   state={version:3,activeId:'legacy-class',classes:[{id:'legacy-class',name:'我的班级',seats:clone(seats),sample,used:[],noRepeat:true}],deleted:[]};
  }
 }catch{blocked=true;warn('无法读取原有班级资料，原资料未改动。请勿清除浏览器数据；当前显示临时示例。')}
 if(!storage)warn('浏览器无法使用本地存储，当前名单仅临时显示，修改无法保存。');
 if(!state)state={version:3,activeId:'temporary',classes:[{id:'temporary',name:'临时示例',seats:clone(sampleSeats),sample:true,used:[],noRepeat:true}],deleted:[]};
 function commit(next){
  if(blocked)throw Error(warning);
  if(!storage)throw Error('浏览器无法保存班级，请允许本站使用本地存储后再试。');
  // Stage the complete next state, then preserve a known-good previous snapshot.
  // If either write fails, the current state and primary copy remain unchanged.
  const text=JSON.stringify(parse(JSON.stringify(next)));
  try{if((storage.getItem(CLASS_KEY)??null)!==primary)throw Error('changed');storage.setItem(BACKUP_KEY,JSON.stringify(state));storage.setItem(CLASS_KEY,text);primary=text}catch(error){if(error.message==='changed')throw Error('另一个页面已修改班级。请刷新页面读取最新资料，避免覆盖。');throw Error('保存失败，原班级未改动。可能是浏览器存储已满或被禁用，请释放空间后重试。')}
  state=JSON.parse(text);warning='';onWarning('');return clone(state);
 }
 function change(fn){const next=clone(state);fn(next);return commit(next)}
 function unique(next,name,except){name=className(name);if([...next.classes,...next.deleted].some(c=>c.name===name&&c.id!==except))throw Error('已有同名班级（含可恢复班级），请换一个名称。');return name}
 return {
  get state(){return publicState()},get current(){return clone(state.classes.find(c=>c.id===state.activeId))},get warning(){return warning},
  getTransferBackup(){const raw=state.transferBackupSlot?storage?.getItem(state.transferBackupSlot):null;return raw?parse(raw):null},
  replaceAll(next){
   // Two bounded snapshot slots, selected by the atomic primary write. Failed
   // imports may leave an unused staging copy but never replace the live backup.
   if(blocked)throw Error(warning);
   if(!storage)throw Error('无法建立本地备份，未导入。');
   const checked=parse(JSON.stringify(next)),backup=JSON.stringify(publicState());
   const slot=state.transferBackupSlot===TRANSFER_BACKUP_KEY?TRANSFER_BACKUP_KEY+'-next':TRANSFER_BACKUP_KEY;
   try{if((storage.getItem(CLASS_KEY)??null)!==primary)throw Error('changed');storage.setItem(slot,backup);if(storage.getItem(slot)!==backup)throw Error('backup')}catch(error){throw Error(error.message==='changed'?'另一个页面已修改班级，请刷新后重试。':'无法建立导入前备份，原班级未改动。请释放存储空间后重试。')}
   checked.transferBackupSlot=slot;
   return commit(checked);
  },
  validateName(name,except){return unique(state,name,except)},
  save(patch){return change(next=>{Object.assign(next.classes.find(c=>c.id===next.activeId),patch)})},
  switch(id){return change(next=>{if(!next.classes.some(c=>c.id===id))throw Error('找不到这个班级');next.activeId=id})},
  create(name){return change(next=>{const item={id:id(),name:unique(next,name),seats:[],sample:false,used:[],noRepeat:true};next.classes.push(item);next.activeId=item.id})},
  rename(name){return change(next=>{next.classes.find(c=>c.id===next.activeId).name=unique(next,name,next.activeId)})},
  delete(){return change(next=>{if(next.classes.length===1)throw Error('请至少保留一个班级。');const index=next.classes.findIndex(c=>c.id===next.activeId);next.deleted.push(next.classes[index]);next.classes.splice(index,1);next.activeId=next.classes[Math.min(index,next.classes.length-1)].id})},
  undo(){return change(next=>{if(!next.deleted.length)throw Error('没有可恢复的班级。');const item=next.deleted.pop();next.classes.push(item);next.activeId=item.id})}
 };
}
