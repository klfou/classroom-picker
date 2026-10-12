import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as XLSX from '../dist/vendor/xlsx-0.20.3.mjs';
import {zipSync,unzipSync,strToU8,strFromU8} from '../dist/vendor/fflate-0.8.3.mjs';
import {writeExcel,readExcel,EXCEL_VERSION} from '../dist/excel-transfer.js';
import {makePackage} from '../dist/class-transfer.js';

// Independent coordinate assertions deliberately do not reuse codec layout
// helpers. Test fixtures contain synthetic student names only.
let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const ok=(value,label)=>{assert.ok(value,label);checks++;};
const addr=(r,c)=>XLSX.utils.encode_cell({r:r-1,c:c-1});
const cell=(ws,ref,value)=>{ws[ref]={t:typeof value==='number'?'n':typeof value==='boolean'?'b':'s',v:value};};
const seat=(id,row,col,name,gender='')=>({id,row,col,name,gender});
const source={version:3,activeId:'eight',deleted:[],classes:[
 {id:'eight',name:'八排/一班',sample:false,noRepeat:false,used:['1:1'],seats:[
  seat('front-left',1,1,'前排左','female'),seat('front-right',1,8,'前排右'),
  seat('middle',4,3,'同名','male'),seat('back-left',8,1,'同名'),seat('back-right',8,8,'后排右','female')]},
 {id:'sixteen',name:'十六排班',sample:true,noRepeat:true,used:['16:8'],seats:[
  seat('six-front-left',1,1,'十六前左','male'),seat('six-front-right',1,8,'十六前右','female'),
  seat('six-middle',9,2,'第九排'),seat('six-back-left',16,1,'十六后左','female'),seat('six-back-right',16,8,'十六后右')]},
 {id:'empty',name:'空班',sample:false,noRepeat:true,used:[],seats:[]}
]};
const bytes=writeExcel(source),book=()=>XLSX.read(bytes,{type:'array',cellStyles:true});
const pack=wb=>XLSX.write(wb,{type:'array',bookType:'xlsx'});
const changed=fn=>{const wb=book();fn(wb.Sheets[wb.SheetNames[0]],wb);return pack(wb);};
const withoutMeta=ws=>{for(const ref of Object.keys(ws)){if(ref.startsWith('!'))continue;const {c}=XLSX.utils.decode_cell(ref);if(c>=25&&c<=32)delete ws[ref];}};
async function reject(data,pattern=/./){await assert.rejects(readExcel(data),pattern);checks++;}
const positions=state=>state.classes.map(c=>c.seats.map(s=>[s.row,s.col,s.name,s.gender??'']));

eq(EXCEL_VERSION,3);
eq(makePackage(await readExcel(bytes)),makePackage(source),'all classes, IDs, flags and sparse coordinates roundtrip');
const wb=book();
for(let index=0;index<source.classes.length;index++){
 const c=source.classes[index],ws=wb.Sheets[wb.SheetNames[index]],rows=index===1?16:8;
 eq(ws.AA2.v,3);eq(ws.AA9.v,rows);
 eq(ws.A4.v,'座位信息 · 老师视角');
 eq(Array.from({length:rows},(_,i)=>ws[`A${i+5}`].v),Array.from({length:rows},(_,i)=>`第${rows-i}排`),'descending back-to-front labels');
 eq(ws[`B${rows+5}`].v,'黑板 / 讲台（第1排最近）','podium immediately below front row');
 eq(ws.B2?.v??'','');
 eq(Array.from({length:8},(_,i)=>ws[addr(3,2*i+2)].v),[1,2,3,4,5,6,7,8],'left/right are not mirrored');
 for(const s of c.seats){
  const physicalRow=rows+5-s.row;
  eq(ws[addr(physicalRow,s.col*2)].v,s.name);
  eq(ws[addr(physicalRow,s.col*2+1)]?.v??'',s.gender==='male'?'男':s.gender==='female'?'女':'');
  eq(ws[addr(s.row+10,s.col+25)].v,s.id,'hidden IDs remain indexed by logical row, not reversed display row');
 }
 eq(ws['!cols'].slice(25,33).map(c=>c.hidden),Array(8).fill(true));
 for(let r=5;r<=rows+5;r++)ok(!ws['!rows']?.[r-1]?.hidden,'all seats and podium remain visible');
 const print=wb.Workbook.Names.find(n=>n.Name==='_xlnm.Print_Area'&&n.Sheet===index);
 ok(print?.Ref.endsWith(`!$A$1:$Q$${rows+5}`),'print area includes the bottom podium');
}
const template=XLSX.read(writeExcel(source,{template:true}),{type:'array'}).Sheets['示例班级'];
eq(template.AA9.v,8);eq(template.A5.v,'第8排');eq(template.A12.v,'第1排');
eq(template.B13.v,'黑板 / 讲台（第1排最近）');
ok(!Object.values(unzipSync(writeExcel(source,{template:true}))).some(p=>strFromU8(p).includes('未设置')));

// With genuinely absent metadata, both 8-row and 16-row orientation must be
// recovered from the teacher-view header, descending labels and bottom podium.
const noMeta=book();noMeta.SheetNames.forEach(n=>withoutMeta(noMeta.Sheets[n]));
eq(positions(await readExcel(pack(noMeta))),positions(await readExcel(bytes)));
eq(positions(await readExcel(writeExcel(await readExcel(pack(noMeta))))),positions(await readExcel(bytes)));

// Real released v2 bytes, generated before migration, retain their front-to-back
// orientation when read and become teacher-view v3 only when re-exported.
const v2Bytes=new Uint8Array(await fs.readFile(new URL('./fixtures/excel-v2-forward.xlsx',import.meta.url)));
const v2=await readExcel(v2Bytes),v2wb=XLSX.read(v2Bytes,{type:'array'}),v2ws=v2wb.Sheets[v2wb.SheetNames[0]];
eq(v2ws.AA2.v,2);eq(v2ws.A5.v,'第1排');eq(v2ws.A20.v,'第16排');
eq(v2.classes[0].seats.map(s=>[s.id,s.row,s.col,s.gender??'']),[['front',1,1,'female'],['back',16,8,'']]);
eq(makePackage(await readExcel(writeExcel(v2))),makePackage(v2));
withoutMeta(v2ws);eq(positions(await readExcel(pack(v2wb))),positions(v2));

// Reuse the immutable released v1 bytes already retained by the main suite,
// without importing or executing that suite and its migration-specific tests.
const legacyTest=await fs.readFile(new URL('./excel-transfer.mjs',import.meta.url),'utf8');
const legacyLiteral=/const LEGACY_V1_TEMPLATE\s*=\s*Uint8Array\.from\(Buffer\.from\('([^']+)',\s*'base64'\)\)/.exec(legacyTest);
assert.ok(legacyLiteral,'released v1 fixture remains available');
const v1Bytes=Uint8Array.from(Buffer.from(legacyLiteral[1],'base64'));
const v1=await readExcel(v1Bytes),v1wb=XLSX.read(v1Bytes,{type:'array'});
eq(v1wb.Sheets[v1wb.SheetNames[0]].S2.v,1);
eq(makePackage(await readExcel(writeExcel(v1))),makePackage(v1));
eq(v1.classes[0].seats.map(s=>[s.row,s.col,s.gender??'']),[[1,1,'female'],[1,3,'male'],[2,2,'']]);

// Partial changes of labels/version must reject, rather than silently assigning
// a front-row student to the back. A fully changed sheet is an intentional edit.
for(const [ref,value,pattern] of [
 ['AA2',2,/表头|范围|黑板|A4/],['AA2',1,/版本/],['AA2',4,/版本/],['AA2','3',/版本/],
 ['A4','座位信息',/A4/],['A5','第1排',/A5/],['A12','第8排',/A12/],
 ['B3',8,/B3/],['P3',1,/P3/],['C4','姓名',/C4/],['AA9',16,/范围|标签|表头|合并/],
 ['R5','第九列学生',/R5.*范围/],['B14','多余排学生',/B14.*范围/],
 ['B13','讲台误填学生',/B13/],['B12',123,/B12.*文本/],['B12','长'.repeat(81),/B12.*80/],
 ['C12','不详',/C12.*性别/],['AA4','__proto__',/标识/]
])await reject(changed(ws=>cell(ws,ref,value)),pattern);
await reject(changed(ws=>{delete ws.B12;}),/C12.*没有姓名/);
await reject(changed(ws=>{cell(ws,'AG18','front-left');}),/学生标识重复/);
await reject(changed(ws=>{cell(ws,'B2',ws.B13.v);delete ws.B13;}),/B2.*范围|B13/);
await reject(changed(ws=>{for(let i=0;i<8;i++)cell(ws,`A${i+5}`,`第${i+1}排`);}),/A5/);
await reject(changed(ws=>{
 const original=structuredClone(ws);for(let r=5;r<=12;r++)for(let c=1;c<=17;c++){
  const ref=addr(r,c),other=original[addr(17-r,c)];if(other)ws[ref]=other;else delete ws[ref];
 }
}),/A5/);
await reject(changed(ws=>{withoutMeta(ws);cell(ws,'A5','第17排');}),/A5/);
await reject(changed(ws=>{withoutMeta(ws);cell(ws,'A4','座位信息');}),/标签|A5/);
await reject(changed(ws=>{delete ws.Z1;delete ws.AA1;cell(ws,'AA2',999);}),/资料格式/);
await reject(changed(ws=>{cell(ws,'R1','晴窗教室隐藏资料');cell(ws,'S1','sunlit-classroom-grid');}),/冲突/);
await reject(changed((ws,b)=>cell(b.Sheets[b.SheetNames[1]],'AA9',8)),/范围|标签/);
await reject(changed(ws=>ws['!merges'].push(XLSX.utils.decode_range('B12:C12'))),/合并/);

// Data remains text, while executable formulas and malicious package metadata
// remain rejected after the coordinate migration.
const literal=structuredClone(source);literal.classes[0].seats[0].name='=SUM(1,2)';literal.classes[0].seats[1].name='<img src=x onerror=alert(1)>';
eq(makePackage(await readExcel(writeExcel(literal))),makePackage(literal));
await reject(changed(ws=>{ws.B12={t:'s',v:'缓存姓名',f:'"缓存姓名"'};}),/公式/);
const parts=unzipSync(bytes);
const external={...parts,'xl/worksheets/_rels/sheet1.xml.rels':strToU8('<Relationships><Relationship Id="r1" Target="h&#116;tps://example.com" TargetMode="Exter&#110;al"/></Relationships>')};
await reject(zipSync(external),/外部链接/);
await reject(zipSync({...parts,'../evil.xml':strToU8('<x/>')}),/名称|无效/);
await reject(zipSync({...parts,'xl/vbaProject.bin':new Uint8Array([1,2,3])}),/宏/);
const namespaced={...parts};namespaced['xl/worksheets/sheet1.xml']=strToU8(strFromU8(parts['xl/worksheets/sheet1.xml']).replace('<worksheet ','<worksheet xmlns:evil-prefix="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ').replace('<v>前排左</v>','<evil-prefix:f>"前排左"</evil-prefix:f><v>前排左</v>'));
await reject(zipSync(namespaced),/公式/);
const illegal=structuredClone(source);illegal.classes[0].seats[0].row=17;assert.throws(()=>writeExcel(illegal),/1–16/);checks++;

// A copied sheet before its original retains orientation and gets a fresh class
// identity; copying must not steal the original ID or reverse its students.
const copied=book(),first=copied.SheetNames[0];copied.Sheets['复制班']=structuredClone(copied.Sheets[first]);copied.SheetNames.unshift('复制班');
const copyState=await readExcel(pack(copied));
eq(copyState.classes.find(c=>c.name==='八排/一班').id,'eight');
ok(copyState.classes[0].id!=='eight');eq(copyState.classes[0].seats,copyState.classes[1].seats);
console.log(`PASS ${checks} independent teacher-view Excel assertions: v3 geometry/IDs, 8/16 sparse rows, unchanged left/right, blank genders, multi-class/copies, released v1/v2 migration, metadata-free recognition, partial-reversal/version rejection and malicious-input checks. No Excel GUI/pixel claims.`);
