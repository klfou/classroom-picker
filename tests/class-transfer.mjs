import assert from 'node:assert/strict';
import {makePackage,parsePackage,MAX_TRANSFER_BYTES} from '../dist/class-transfer.js';
import {createClassStore,CLASS_KEY,BACKUP_KEY,TRANSFER_BACKUP_KEY} from '../dist/classes.js';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++},reject=(fn)=>{assert.throws(fn);checks++};
const data={app:'sunlit-classroom',version:1,classes:[{id:'a',name:'虚构一班',noRepeat:true,sample:false,seats:[{id:'s1',row:1,col:1,name:'学生甲',gender:'female'},{id:'s2',row:16,col:8,name:'学生甲',gender:'male'}]},{id:'b',name:'空班',noRepeat:false,sample:false,seats:[]}]};
const parsed=parsePackage(JSON.stringify(data));eq(makePackage(parsed),data);eq(parsed.classes[0].used,[]);
for(const change of [v=>v.app='other',v=>v.version=2,v=>v.version='1',v=>v.classes=[],v=>v.classes.push(structuredClone(v.classes[0])),v=>v.classes[1].name='虚构一班',v=>v.classes[0].seats[1].id='s1',v=>{v.classes[0].seats[1].row=1;v.classes[0].seats[1].col=1},v=>v.classes[0].seats[0].row=17,v=>v.classes[0].seats[0].gender='x',v=>v.classes[0].seats[0].name='',v=>v.classes[0].seats[0].name=5,v=>v.classes[0].noRepeat='yes',v=>v.classes[0].seats[0].row='1',v=>v.classes[0].seats[0].extra=3,v=>v.classes[0].id='__proto__']){const x=structuredClone(data);change(x);reject(()=>parsePackage(JSON.stringify(x)))}
reject(()=>parsePackage('{'));reject(()=>parsePackage(' '.repeat(MAX_TRANSFER_BYTES+1)));reject(()=>parsePackage(JSON.stringify(data).replace('"version":1','"__proto__":{},"version":1')));
const mem=new Map(),storage={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,v)};
let store=createClassStore({storage,sampleSeats:[{row:1,col:1,name:'旧资料'}]});const original=store.state;
store.replaceAll(parsed);eq(makePackage(store.state),data);eq(store.getTransferBackup(),original);eq(store.state.deleted,[]);
store.save({used:['1:1']});eq(store.getTransferBackup(),original);eq(store.current.used,['1:1']);store=createClassStore({storage,sampleSeats:[]});eq(makePackage(store.state),data);eq(store.getTransferBackup(),original);
const beforeRestore=store.state;store.replaceAll(store.getTransferBackup());eq(store.state,original);eq(store.getTransferBackup(),beforeRestore);
for(const failKey of [TRANSFER_BACKUP_KEY,BACKUP_KEY,CLASS_KEY]){const before=store.state,raw=storage.getItem(CLASS_KEY),set=storage.setItem;storage.setItem=(k,v)=>{if(k===failKey)throw Error('quota');set(k,v)};reject(()=>store.replaceAll(parsed));eq(store.state,before);eq(storage.getItem(CLASS_KEY),raw);storage.setItem=set}
const raw=storage.getItem(CLASS_KEY);storage.setItem(CLASS_KEY,raw+' ');reject(()=>store.replaceAll(parsed));eq(storage.getItem(CLASS_KEY),raw+' ');storage.setItem(CLASS_KEY,raw);
const empty=createClassStore({storage:{getItem:()=>null,setItem:()=>{throw Error('private')}},sampleSeats:[]});reject(()=>empty.replaceAll(parsed));eq(empty.current.seats,[]);
const html=structuredClone(data);html.classes[0].seats[0].name='<img src=x onerror=alert(1)>';eq(parsePackage(JSON.stringify(html)).classes[0].seats[0].name,html.classes[0].seats[0].name);
console.log(`PASS ${checks} store/format assertions`);
// Restore failure must preserve the sole original snapshot, even after staging.
const map2=new Map(),storage2={getItem:k=>map2.get(k)??null,setItem:(k,v)=>map2.set(k,v)};const s2=createClassStore({storage:storage2,sampleSeats:[{row:1,col:1,name:'A'}]});const a=s2.state;s2.replaceAll(parsed);const b=s2.state;const set2=storage2.setItem;storage2.setItem=(k,v)=>{if(k===CLASS_KEY)throw Error('quota');set2(k,v)};reject(()=>s2.replaceAll(s2.getTransferBackup()));eq(s2.state,b);eq(s2.getTransferBackup(),a);const fresh=createClassStore({storage:storage2,sampleSeats:[]});eq(fresh.getTransferBackup(),a);
const colliding=structuredClone(parsed);colliding.classes[0].seats=[{id:'seat-1-2',row:1,col:1,name:'已有'},{row:1,col:2,name:'新增'}];const collisionPackage=makePackage(colliding);eq(collisionPackage.classes[0].seats[1].id,'seat-1-2-1');eq(makePackage(parsePackage(JSON.stringify(collisionPackage))),collisionPackage);
console.log(`PASS ${checks} total, including failed restore and ID allocation`);
