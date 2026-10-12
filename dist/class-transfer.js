import {validateRows} from './roster.js';
import {className} from './classes.js';
export const TRANSFER_APP='sunlit-classroom',TRANSFER_VERSION=1,MAX_TRANSFER_BYTES=2*1024*1024;
const fail=message=>{throw Error(message)};
const object=(value,keys)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))fail('资料包含不支持的字段或格式。')};
const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[\u0000-\u001f\u007f]/u.test(value);
export function makePackage(state){return {app:TRANSFER_APP,version:TRANSFER_VERSION,classes:state.classes.map(c=>{
 const ids=new Set(c.seats.filter(s=>s.id).map(s=>s.id));
 return {id:c.id,name:c.name,noRepeat:c.noRepeat,sample:c.sample,seats:c.seats.map(s=>{let id=s.id;if(!id){const base=`seat-${s.row}-${s.col}`;id=base;let suffix=1;while(ids.has(id))id=`${base}-${suffix++}`;ids.add(id)}return {id,row:s.row,col:s.col,name:s.name,gender:s.gender||''}})};
})}}

export function parsePackage(raw){
 if(typeof raw!=='string'||new TextEncoder().encode(raw).length>MAX_TRANSFER_BYTES)fail('资料包不能超过 2 MB。');
 let value;try{value=JSON.parse(raw)}catch{fail('无法读取资料包，请选择本程序导出的 JSON 文件。')}
 object(value,['app','version','classes']);if(value.app!==TRANSFER_APP)fail('这不是晴窗教室的班级资料包。');if(value.version!==TRANSFER_VERSION)fail('资料包版本不支持，请使用同版本或更新版晴窗教室重新导出。');
 if(!Array.isArray(value.classes)||!value.classes.length||value.classes.length>200)fail('资料包应包含 1–200 个班级。');
 const ids=new Set(),names=new Set();
 const classes=value.classes.map(c=>{
  object(c,['id','name','noRepeat','sample','seats']);if(!text(c.id,160)||['__proto__','prototype','constructor'].includes(c.id))fail('班级标识无效。');
  if(typeof c.name!=='string')fail('班级名称无效。');const name=className(c.name);
  if(ids.has(c.id)||names.has(name))fail('资料包有重复的班级标识或名称。');ids.add(c.id);names.add(name);
  if(typeof c.noRepeat!=='boolean'||typeof c.sample!=='boolean'||!Array.isArray(c.seats)||c.seats.length>128)fail('班级设置或座位数量无效。');
  const students=new Set();
  for(const s of c.seats){object(s,['id','row','col','name','gender']);if(!text(s.id,160)||['__proto__','prototype','constructor'].includes(s.id)||students.has(s.id))fail('学生标识无效或重复。');students.add(s.id);if(!Number.isInteger(s.row)||!Number.isInteger(s.col)||typeof s.name!=='string'||!s.name.trim()||!['','male','female'].includes(s.gender))fail('学生姓名、性别或座位格式无效。')}
  return {id:c.id,name,noRepeat:c.noRepeat,sample:c.sample,seats:c.seats.length?validateRows(c.seats).seats:[],used:[]};
 });
 return {version:3,classes,activeId:classes[0].id,deleted:[]};
}
export function summarizePackage(state){return `${state.classes.length} 个班级、${state.classes.reduce((n,c)=>n+c.seats.length,0)} 位学生`}
export function downloadPackage(data,backup=false){const blob=new Blob([JSON.stringify(data)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`sunlit-${backup?'backup':'classes'}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
