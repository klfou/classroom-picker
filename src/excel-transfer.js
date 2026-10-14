// Offline XLSX grid codec. Vendored libraries never request network resources.
import * as XLSX from './vendor/xlsx-0.20.3.mjs';
import {Inflate, zipSync, unzipSync} from './vendor/fflate-0.8.3.mjs';
import {makePackage, parsePackage, TRANSFER_APP, TRANSFER_VERSION} from './class-transfer.js';
import {className} from './classes.js';

export const MAX_EXCEL_BYTES = 5 * 1024 * 1024;
export const MAX_EXCEL_UNCOMPRESSED_BYTES = 20 * 1024 * 1024;
// v3 reverses only worksheet display rows; logical row 1 stays nearest the podium.
// A distinct marker/version makes older readers reject rather than flip seats.
export const EXCEL_FORMAT = 'sunlit-classroom-grid', EXCEL_VERSION = 3;
const MAX_ENTRIES = 512, MAX_CELLS = 180000;
const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', {fatal:true});
const fail = message => { throw new Error(message); };
const blank = value => value == null || (typeof value === 'string' && !value.trim());
const address = (row, col) => XLSX.utils.encode_cell({r:row-1,c:col-1});
const context = (sheet, cell, message) => fail(`工作表“${sheet}”的 ${cell}：${message}`);
const textCell = value => ({t:'s',v:String(value),z:'@'});
const crcTable = Uint32Array.from({length:256},(_,n) => {for(let k=0;k<8;k++) n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function decodeXmlEntities(xml) {return xml.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi,(entity,key)=>{if(key[0]!=='#')return ({amp:'&',quot:'\"',apos:"'",lt:'<',gt:'>'})[key]??entity;const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));if(!Number.isInteger(n)||n<0||n>0x10ffff)fail('Excel XML 字符引用无效。');return String.fromCodePoint(n);});}
function crc32(bytes) {let crc=0xffffffff;for(const b of bytes) crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function bytesOf(value) {
  if(value instanceof ArrayBuffer) return new Uint8Array(value);
  if(ArrayBuffer.isView(value)) return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
  fail('请选择 .xlsx 格式的 Excel 文件。');
}

// Parse ZIP ourselves before SheetJS sees it. Sizes are checked both against the
// directory AND actual streamed output. 1 KiB compressed chunks bound each
// Inflate allocation; output is copied into a pre-sized, <=20 MiB total budget.
// Repacking checked entries removes any central/local-header parser ambiguity.
function checkedArchive(input) {
  const bytes=bytesOf(input);
  if(bytes.length>MAX_EXCEL_BYTES) fail('Excel 文件不能超过 5 MB。');
  if(bytes.length<22 || new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(0,true)!==0x04034b50) fail('无法读取文件，请选择未加密的 .xlsx 文件（不支持 .xls）。');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const u16=p=>view.getUint16(p,true), u32=p=>view.getUint32(p,true);
  let end=-1;
  for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--) if(u32(p)===0x06054b50 && p+22+u16(p+20)===bytes.length){end=p;break;}
  if(end<0) fail('Excel 压缩结构损坏。');
  const count=u16(end+10), central=u32(end+16), centralSize=u32(end+12);
  if(u16(end+4)||u16(end+6)||u16(end+8)!==count||count===65535||central===0xffffffff||centralSize===0xffffffff) fail('不支持分卷或 ZIP64 Excel 文件。');
  if(!count||count>MAX_ENTRIES) fail(`Excel 内部文件不能超过 ${MAX_ENTRIES} 项。`);
  if(central+centralSize!==end || central>end) fail('Excel 压缩目录损坏。');
  const entries=[],names=new Set();let p=central,totalDeclared=0;
  function checkExtra(start,length) {const stop=start+length;for(let q=start;q<stop;){if(q+4>stop) fail('Excel 附加信息损坏。');const kind=u16(q),n=u16(q+2);if(kind===1||kind===0x9901) fail('不支持 ZIP64 或加密 Excel 文件。');q+=4+n;if(q>stop) fail('Excel 附加信息损坏。');}}
  for(let index=0;index<count;index++) {
    if(p+46>end||u32(p)!==0x02014b50) fail('Excel 压缩目录损坏。');
    const flags=u16(p+8),method=u16(p+10),crc=u32(p+16),compressed=u32(p+20),size=u32(p+24),nl=u16(p+28),el=u16(p+30),cl=u16(p+32),offset=u32(p+42);
    if(p+46+nl+el+cl>end||u16(p+34)) fail('Excel 压缩目录损坏。');
    if(flags&0x2041) fail('不支持加密 Excel 文件，请先在 Excel 中取消密码。');
    if(![0,8].includes(method)) fail('Excel 使用了不支持的压缩格式。');
    if(compressed===0xffffffff||size===0xffffffff||offset===0xffffffff) fail('不支持 ZIP64 Excel 文件。');
    let name;try{name=decoder.decode(bytes.subarray(p+46,p+46+nl));}catch{fail('Excel 内部文件名称无效。');}
    if(!name||/[^\x20-\x7e]|\\|(^|\/)\.\.?(\/|$)|^\//u.test(name)||names.has(name.toLowerCase())) fail('Excel 内部文件名称重复或无效。');
    names.add(name.toLowerCase());checkExtra(p+46+nl,el);
    totalDeclared+=size;if(totalDeclared>MAX_EXCEL_UNCOMPRESSED_BYTES) fail('Excel 解压后的内容不能超过 20 MB。');
    if(offset+30>central||u32(offset)!==0x04034b50) fail('Excel 文件头损坏。');
    const localFlags=u16(offset+6),localMethod=u16(offset+8),localNl=u16(offset+26),localEl=u16(offset+28),start=offset+30+localNl+localEl;
    if(start+compressed>central||localFlags!==flags||localMethod!==method) fail('Excel 压缩信息不一致。');
    if(localNl!==nl||bytes.subarray(offset+30,offset+30+localNl).some((b,i)=>b!==bytes[p+46+i])) fail('Excel 内部文件名称不一致。');
    checkExtra(offset+30+localNl,localEl);
    if(!(flags&8) && (u32(offset+14)!==crc||u32(offset+18)!==compressed||u32(offset+22)!==size)) fail('Excel 压缩大小或校验信息不一致。');
    if(method===0&&compressed!==size) fail('Excel 压缩大小不一致。');
    entries.push({name,method,crc,compressed,size,offset,start});p+=46+nl+el+cl;
  }
  if(p!==end) fail('Excel 压缩目录损坏。');
  const ordered=[...entries].sort((a,b)=>a.offset-b.offset);
  for(let i=1;i<ordered.length;i++) if(ordered[i].offset<ordered[i-1].start+ordered[i-1].compressed) fail('Excel 内部文件重叠。');
  const parts=Object.create(null);let actualTotal=0,cellCount=0;
  for(const entry of entries) {
    if(/(?:^|\/)(?:vbaproject|vbadata|macrosheets|dialogsheets|externallinks|embeddings|activex)(?:[./]|$)/i.test(entry.name)||/\.bin$/i.test(entry.name)) fail('不支持包含宏、嵌入对象或外部链接的 Excel 文件。');
    const output=new Uint8Array(entry.size);let actual=0;
    const accept=chunk=>{actual+=chunk.length;actualTotal+=chunk.length;if(actual>entry.size||actualTotal>MAX_EXCEL_UNCOMPRESSED_BYTES) fail('Excel 实际解压大小超限或与文件声明不符。');output.set(chunk,actual-chunk.length);};
    try {
      if(entry.method===0) accept(bytes.subarray(entry.start,entry.start+entry.compressed));
      else {const stream=new Inflate(accept);for(let i=0;i<entry.compressed;i+=1024) stream.push(bytes.subarray(entry.start+i,entry.start+Math.min(i+1024,entry.compressed)),i+1024>=entry.compressed);if(!entry.compressed) stream.push(new Uint8Array(),true);}
    } catch(error) {if(/Excel/.test(error.message)) throw error;fail('Excel 压缩数据损坏，无法安全读取。');}
    if(actual!==entry.size||crc32(output)!==entry.crc) fail('Excel 解压大小或内容校验失败。');
    let markupStart=output[0]===0xef&&output[1]===0xbb&&output[2]===0xbf?3:0;
    while([9,10,13,32].includes(output[markupStart])) markupStart++;
    const utf16Bom=(output[0]===0xff&&output[1]===0xfe)||(output[0]===0xfe&&output[1]===0xff);
    if(utf16Bom) fail('Excel 内部XML必须使用UTF-8，请在Excel中另存为.xlsx。');
    if(/\.(?:xml|rels)$/i.test(entry.name)||output[markupStart]===60) {
      if(output.includes(0)) fail('Excel 内部XML必须使用UTF-8，请在Excel中另存为.xlsx。');
      let xml;try{xml=decoder.decode(output);}catch{fail('Excel XML 内容编码无效。');}
      if(/<!DOCTYPE|<!ENTITY/i.test(xml)) fail('不支持带外部实体的 Excel 文件。');
      const securityXml=(entry.name==='[Content_Types].xml'||/\.rels$/i.test(entry.name))?decodeXmlEntities(xml):'';
      // SheetJS's harmless, unused default .bin MIME is permitted. Never drop
      // other defaults: a macro can use an arbitrary ZIP path and extension.
      const contentTypes=entry.name==='[Content_Types].xml'&&!entries.some(e=>/\.bin$/i.test(e.name))?securityXml.replace(/<(?:[^\s<>/]+:)?Default\b(?=[^>]*\bExtension\s*=\s*["']bin["'])[^>]*\/>/gi,''):securityXml;
      if((entry.name==='[Content_Types].xml'&&/macroEnabled|vbaProject|ms-excel\.sheet\.binary/i.test(contentTypes))||(/\.rels$/i.test(entry.name)&&(/vbaProject|vbaData|macroSheet|dialogSheet|oleObject|activeX|externalLink/i.test(securityXml)||/TargetMode\s*=\s*["']\s*External/i.test(securityXml)||/<(?:[^\s<>/]+:)?Relationship\b[^>]*\bTarget\s*=\s*["']\s*(?:[a-z][a-z0-9+.-]*:|\/\/|\\)/i.test(securityXml)))) fail('不支持包含宏或外部链接的 Excel 文件。');
      // Only count actual cells; enormous dimension/format-only ranges never
      // cause a grid allocation or a sheet_to_json range traversal.
      { // Scan every XML part: worksheet paths can be reassigned in OOXML relationships.
        cellCount+=(xml.match(/<(?:[^\s<>/]+:)?c\b/g)||[]).length;
        if(cellCount>MAX_CELLS) fail('Excel 单元格过多，请只保留班级座位表。');
        // Scan tags, not just SheetJS's parsed f property: unsupported legal
        // namespace prefixes must never hide a cached formula result.
        const formula=/<(?:[^\s<>/]+:)?f(?:\s|\/|>)/.exec(xml);
        if(formula) {
          const preceding=xml.slice(0,formula.index).match(/<(?:[^\s<>/]+:)?c\b[^>]*>/g),last=preceding?.[preceding.length-1];
          const ref=last&&/\br\s*=\s*["']([^"']+)["']/.exec(last)?.[1];
          fail(`Excel 含有公式（${entry.name}${ref?`，${ref}`:''}）。请把公式粘贴为文本或数值后再导入。`);
        }
      }
    }
    parts[entry.name]=output;
  }
  if(!parts['[Content_Types].xml']||!parts['xl/workbook.xml']||!parts['xl/_rels/workbook.xml.rels']) fail('这不是标准的 .xlsx 工作簿。');
  // Standard Excel/WPS use XML targets for all workbook relationships. Reject
  // alternate worksheet encodings/extensions instead of asking SheetJS to
  // interpret an unscanned .data or binary part as a worksheet.
  const relationships=decoder.decode(parts['xl/_rels/workbook.xml.rels']);
  for(const tag of relationships.match(/<(?:[^\s<>/]+:)?Relationship\b[^>]*>/g)??[]) {
    const target=/\bTarget\s*=\s*(["'])([\s\S]*?)\1/.exec(tag);
    if(!target||!/^.*\.xml$/i.test(decodeXmlEntities(target[2]))) fail('不支持非常规工作表路径，请在Excel中另存为.xlsx后重试。');
  }
  return parts;
}

function validId(value,sheet,cell) {
  if(typeof value!=='string'||!value||value.length>160||/[\u0000-\u001f\u007f]/u.test(value)||['__proto__','prototype','constructor'].includes(value)) context(sheet,cell,'内部标识无效；可清除隐藏资料后重新导入。');
  return value;
}
function stableId(prefix,value) {let h=0xcbf29ce484222325n;for(const b of encoder.encode(value)){h^=BigInt(b);h=BigInt.asUintN(64,h*0x100000001b3n);}return `${prefix}-${h.toString(16).padStart(16,'0')}`;}
function cellValue(ws,ref){const cell=ws[ref];return cell&&cell.t!=='z'?cell.v:undefined;}
function requireText(ws,ref,sheet,label,max) {
  const cell=ws[ref],value=cellValue(ws,ref);
  if(!cell||!['s','str','inlineStr'].includes(cell.t)||typeof value!=='string') context(sheet,ref,`${label}必须是文本，数字姓名请先把单元格设为文本。`);
  const cleaned=value.trim().replace(/\s+/gu,' ').normalize('NFC');
  if(!cleaned||cleaned.length>max||/[\u0000-\u001f\u007f]/u.test(cleaned)) context(sheet,ref,`${label}请填写 1–${max} 个有效字符。`);
  return cleaned;
}
function metadata(ws,sheet) {
  const locations=[{version:1,start:18},{version:2,start:26}],hint=['座位信息','座位信息 · 老师视角'].includes(cellValue(ws,'A4'))?2:cellValue(ws,'A4')==='第1排 · 姓名'?1:null;
  const present=locations.filter(({version,start})=>{
    const marker=!blank(cellValue(ws,address(1,start)))||!blank(cellValue(ws,address(1,start+1)))||cellValue(ws,address(2,start))==='Excel格式版本'||typeof cellValue(ws,address(2,start+1))==='number';
    // A partially erased metadata block is corrupt, not metadata-free. The
    // layout hint keeps v2's S-column instructions out of the legacy R:Y block.
    return marker||(hint===version&&Object.entries(ws).some(([ref,cell])=>{if(ref.startsWith('!')||blank(cell?.v))return false;const {c}=XLSX.utils.decode_cell(ref);return c>=start-1&&c<start+7;}));
  });
  if(!present.length) return null;
  if(present.length!==1) context(sheet,'隐藏资料','发现两份冲突的格式资料，请使用完整的单一版本模板。');
  const {version:locationVersion,start}=present[0],ref=row=>address(row,start+1),label=address(1,start);
  if(cellValue(ws,label)!=='晴窗教室隐藏资料'||cellValue(ws,ref(1))!==EXCEL_FORMAT) context(sheet,label,'隐藏资料格式不支持；请使用原始模板。');
  const version=cellValue(ws,ref(2));
  if((locationVersion===1?version!==1:![2,3].includes(version))||cellValue(ws,ref(3))!==TRANSFER_VERSION) context(sheet,ref(2),'Excel 资料版本不支持或位置不一致，请使用同版本或更新版晴窗教室重新导出。');
  const id=validId(cellValue(ws,ref(4)),sheet,ref(4));
  const originalName=requireText(ws,ref(5),sheet,'原始班级名称',30),exportedName=requireText(ws,ref(6),sheet,'导出工作表名称',31);
  const noRepeat=cellValue(ws,ref(7)),sample=cellValue(ws,ref(8)),rows=version===1?16:cellValue(ws,ref(9));
  if(typeof noRepeat!=='boolean'||typeof sample!=='boolean') context(sheet,ref(7),'隐藏的班级设置必须是布尔值。');
  if(!Number.isInteger(rows)||rows<8||rows>16) context(sheet,ref(9),'网格排数必须是8–16的整数，请使用原始模板。');
  return {version,rows,id,name:sheet===exportedName?originalName:sheet,noRepeat,sample,originalSheet:sheet===exportedName};
}
function gridLayout(ws,sheet,meta) {
  let version=meta?.version,rows=meta?.rows;
  if(!version) {
    if(cellValue(ws,'A4')==='座位信息 · 老师视角') {version=3;rows=Number(/^第(\d+)排$/.exec(cellValue(ws,'A5'))?.[1]);if(!Number.isInteger(rows)||rows<8||rows>16)context(sheet,'A5','老师视角网格应由最后一排至第1排，最多16排。');}
    else if(cellValue(ws,'A4')==='座位信息') {version=2;rows=0;while(rows<16&&cellValue(ws,address(rows+5,1))===`第${rows+1}排`)rows++;if(rows<8) context(sheet,address(rows+5,1),`缺少或改变了第${rows+1}排标签，请保留连续的第1–8排；最多支持16排。`);}
    else if(cellValue(ws,'A4')==='第1排 · 姓名') {version=1;rows=16;}
    else context(sheet,'A4','无法识别座位网格版本，请使用原始Excel模板，不要移动表头。');
  }
  const v2=version>=2,teacher=version===3,boardRow=teacher?rows+5:2,maxCol=v2?16:8,lastRow=v2?rows+3:34,metaCol=v2?25:17,noteCol=v2?18:10;
  for(const merge of ws['!merges']??[]) {
    const boardMerge=teacher&&merge.s.r===boardRow-1&&merge.e.r===boardRow-1&&merge.s.c===1&&merge.e.c===16;
    const seatHeader=v2&&merge.s.r===2&&merge.e.r===2&&merge.s.c>=1&&merge.s.c<=15&&merge.s.c%2===1&&merge.e.c===merge.s.c+1;
    if(!boardMerge&&!seatHeader&&merge.s.r<=lastRow&&merge.e.r>=2&&merge.s.c<=maxCol&&merge.e.c>=1) context(sheet,XLSX.utils.encode_range(merge),'座位网格内不能合并单元格，请取消合并并按每格填写姓名或性别。');
  }
  for(const [ref,cell] of Object.entries(ws)) {
    if(ref.startsWith('!'))continue;
    if(cell?.f)context(sheet,ref,'不支持公式，请粘贴为文本或数值。');
    if(blank(cell?.v))continue;
    const {r,c}=XLSX.utils.decode_cell(ref);
    const inGrid=(r===0&&c===0)||(r===boardRow-1&&c===1)||(r>=2&&r<=lastRow&&c<=maxCol);
    const inNotes=c===noteCol&&r>=1&&r<=(v2?15:14),inMeta=(c>=metaCol&&c<=metaCol+1&&r<(v2?9:8))||(c===metaCol&&r===9)||(c>=metaCol&&c<=metaCol+7&&r>=10&&r<26);
    if(!inGrid&&!inNotes&&!inMeta)context(sheet,ref,`此单元格超出模板范围。本页为${rows}排、每排8个座位，请勿增加或移动网格行列。`);
  }
  for(const [ref,expected] of [['A3','排 / 列'],[address(boardRow,2),'黑板 / 讲台（第1排最近）']])if(cellValue(ws,ref)!==expected)context(sheet,ref,'座位网格方向或表头已改变，请保留模板中的黑板位置和排列表头。');
  if(v2) {
    if(cellValue(ws,'A4')!==(teacher?'座位信息 · 老师视角':'座位信息'))context(sheet,'A4','姓名与性别的表头已改变，请使用原始模板。');
    for(let row=1;row<=rows;row++)if(cellValue(ws,address(row+4,1))!==`第${teacher?rows+1-row:row}排`)context(sheet,address(row+4,1),`第${teacher?rows+1-row:row}排标签已改变，请勿插入、删除或移动网格行列。`);
    for(let col=1;col<=8;col++) {
      const nr=address(3,col*2),gr=address(3,col*2+1),value=cellValue(ws,nr);
      if((value!==col&&value!==String(col))||!blank(cellValue(ws,gr)))context(sheet,nr,'列号应按1–8排列，每个座位占姓名和性别两格，请勿移动表头。');
      for(const [ref,expected]of [[address(4,col*2),'姓名'],[address(4,col*2+1),'性别']])if(cellValue(ws,ref)!==expected)context(sheet,ref,'每个座位应为左侧姓名、右侧性别，请勿移动表头。');
    }
  } else {
    for(let row=1;row<=16;row++)for(const [ref,expected]of [[address(row*2+2,1),`第${row}排 · 姓名`],[address(row*2+3,1),'性别']])if(cellValue(ws,ref)!==expected)context(sheet,ref,`第${row}排标签已改变，请勿插入、删除或移动网格行列。`);
    for(let col=1;col<=8;col++){const ref=address(3,col+1),value=cellValue(ws,ref);if(value!==col&&value!==String(col))context(sheet,ref,'旧版模板的B3:I3应依次为1–8，第1排姓名在第4行、性别在第5行。');}
  }
  return {version,rows,metaCol:metaCol+1};
}
function canonical(classes) {
  if(!classes.length||classes.length>200) fail('Excel 应包含 1–200 个班级工作表。');
  const ids=new Set(),names=new Set(),checked=[];
  // The JSON file limit belongs to JSON transport. Validate every class through
  // the canonical parser without imposing that 2 MiB limit on a 200-sheet XLSX.
  for(const c of classes) {
    const item=parsePackage(JSON.stringify({app:TRANSFER_APP,version:TRANSFER_VERSION,classes:[c]})).classes[0];
    if(ids.has(item.id)) fail('多个工作表使用了相同班级标识。请使用完整模板或重新导出后再导入。');
    if(names.has(item.name)) fail(`Excel 有重复的班级名称：“${item.name}”。请重命名工作表。`);
    ids.add(item.id);names.add(item.name);checked.push(item);
  }
  return {version:3,classes:checked,activeId:checked[0].id,deleted:[]};
}

export async function readExcel(arrayBuffer) {
  const parts=checkedArchive(arrayBuffer);let workbook;
  try {workbook=XLSX.read(zipSync(parts,{level:0}),{type:'array',dense:false,cellFormula:true,cellHTML:false,cellText:false,cellDates:false,bookVBA:false,bookDeps:false,cellStyles:false});}
  catch {fail('无法读取 Excel 工作簿，请在 Excel 中另存为 .xlsx 后重试。');}
  if(!workbook.SheetNames.length||workbook.SheetNames.length>200) fail('Excel 应包含 1–200 个班级工作表。');
  const classes=[],originalSheets=[];
  for(const sheet of workbook.SheetNames) {
    const ws=workbook.Sheets[sheet];
    if(!ws) fail(`无法读取工作表“${sheet}”。`);
    const meta=metadata(ws,sheet),layout=gridLayout(ws,sheet,meta);
    let name;try{name=className(meta?.name??sheet);}catch(error){context(sheet,'工作表名称',error.message);}
    const id=meta?.id??stableId('class',name),seats=[],studentIds=new Set();
    for(let row=1;row<=layout.rows;row++) for(let col=1;col<=8;col++) {
      const v2=layout.version>=2,gridRow=layout.version===3?layout.rows+5-row:row+4,nr=v2?address(gridRow,col*2):address(2*row+2,col+1),gr=v2?address(gridRow,col*2+1):address(2*row+3,col+1),ir=address(row+10,layout.metaCol+col-1),rawName=cellValue(ws,nr),rawGender=cellValue(ws,gr);
      if(blank(rawName)) {if(!blank(rawGender)) context(sheet,gr,`第${row}排第${col}列没有姓名，请同时清空性别或补全姓名。`);continue;}
      const studentName=requireText(ws,nr,sheet,'姓名',80);
      const key=blank(rawGender)?'':typeof rawGender==='string'?rawGender.trim().toLowerCase():null;
      const genders={'':'','未设置':'','男':'male','女':'female',male:'male',female:'female'};
      if(key===null||!Object.hasOwn(genders,key)) context(sheet,gr,`第${row}排第${col}列的性别请填写“男”或“女”，也可留空。`);
      const existing=meta?cellValue(ws,ir):null;
      const studentId=blank(existing)?stableId('student',`${id}\0${row}\0${col}\0${studentName}`):validId(existing,sheet,ir);
      if(studentIds.has(studentId)) context(sheet,nr,'学生标识重复，请清除相应隐藏学生标识后重试。');
      studentIds.add(studentId);seats.push({id:studentId,row,col,name:studentName,gender:genders[key]});
    }
    classes.push({id,name,noRepeat:meta?.noRepeat??true,sample:meta?.sample??false,seats});originalSheets.push(meta?.originalSheet??false);
  }
  // Excel copies hidden cells along with the grid. Keep the original sheet's ID
  // and assign deterministic new class IDs to renamed copies, never drop them.
  const groups=new Map(),occupied=new Set(classes.map(c=>c.id));
  classes.forEach((c,index)=>{if(!groups.has(c.id))groups.set(c.id,[]);groups.get(c.id).push(index);});
  for(const indexes of groups.values()) if(indexes.length>1) {
    const keep=indexes.find(index=>originalSheets[index])??indexes[0];
    for(const index of indexes) if(index!==keep) {const base=stableId('class',classes[index].name);let id=base,n=2;while(occupied.has(id))id=`${base}-${n++}`;classes[index].id=id;occupied.add(id);}
  }
  return canonical(classes);
}

function sheetName(name,used) {
  let base=name.replace(/[\\/?*\[\]:\u0000-\u001f]/gu,'_').replace(/^'+|'+$/gu,'').slice(0,30)||'班级';
  if(base.toLowerCase()==='history') base='History_';
  let result=base,suffix=2;
  while(used.has(result.toLowerCase())){const tail=` (${suffix++})`;result=base.slice(0,31-tail.length)+tail;}
  used.add(result.toLowerCase());return result;
}
function gridSheet(c,sheet) {
  const rows=Math.max(8,...c.seats.map(s=>s.row)),ws={},set=(ref,value)=>{ws[ref]=typeof value==='string'?textCell(value):{t:typeof value==='boolean'?'b':'n',v:value};};
  set('A1',c.name);set(address(rows+5,2),'黑板 / 讲台（第1排最近）');set('A3','排 / 列');set('A4','座位信息 · 老师视角');
  for(let col=1;col<=8;col++){set(address(3,col*2),col);set(address(3,col*2+1),'');set(address(4,col*2),'姓名');set(address(4,col*2+1),'性别');}
  for(let row=1;row<=rows;row++){set(address(row+4,1),`第${rows+1-row}排`);for(let col=1;col<=8;col++){set(address(row+4,col*2),'');set(address(row+4,col*2+1),'');}}
  for(const s of c.seats){set(address(rows+5-s.row,s.col*2),s.name);set(address(rows+5-s.row,s.col*2+1),s.gender==='male'?'男':s.gender==='female'?'女':'');set(address(s.row+10,s.col+25),s.id);}
  set('S3','填写说明');
  ['姓名在左，性别在右。','性别选男或女，也可留空。','空座两格都留空。','老师视角：上方后排，下方第1排。','请勿移动或增删座位行列。'].forEach((text,i)=>set(address(i+5,19),text));
  const meta=[['晴窗教室隐藏资料',EXCEL_FORMAT],['Excel格式版本',EXCEL_VERSION],['资料包版本',TRANSFER_VERSION],['班级标识',c.id],['原始班级名称',c.name],['导出工作表名称',sheet],['不重复抽选',c.noRepeat],['示例班级',c.sample],['网格排数',rows]];
  meta.forEach((row,i)=>row.forEach((v,j)=>set(address(i+1,j+26),v)));set('Z10','学生标识：与16排×8列座位对应');
  ws['!ref']='A1:AG26';
  // Teacher view: back rows above front rows; columns and hidden student IDs retain logical coordinates.
  for(let row=1;row<=rows+5;row++)for(let col=1;col<=17;col++)if(!ws[address(row,col)])set(address(row,col),'');
  ws['!cols']=[{wch:8},...Array.from({length:8},()=>[{wch:14},{wch:3.5}]).flat(),{wch:4},{wch:38},...Array.from({length:6},()=>({hidden:true,wch:3})),...Array.from({length:8},()=>({hidden:true,wch:14}))];
  ws['!rows']=Array.from({length:rows+5},(_,i)=>(i===1||i===3)?{hidden:true,hpt:2}:{hpt:i===0?34:i===1?26:i===2?27:32});
  ws['!merges']=[XLSX.utils.decode_range('A1:Q1'),XLSX.utils.decode_range(`B${rows+5}:Q${rows+5}`),...Array.from({length:8},(_,i)=>({s:{r:2,c:1+i*2},e:{r:2,c:2+i*2}}))];
  ws['!margins']={left:0.25,right:0.25,top:0.3,bottom:0.3,header:0.1,footer:0.1};
  return ws;
}

// CE deliberately does not author rich cell styles. Apply a small, fixed OOXML
// style table to our OWN generated workbook, never to untrusted input XML.
// Palette follows the warm paper / forest-green seat-card editor. Styles are
// generated only for our own export, with eight merged logical seat headings.
const STYLE_PAPER='FFFAF8F2',STYLE_LINE='FFE0E4D9';
const styleFont=(size,color,bold=false)=>`<font>${bold?'<b/>':''}<sz val="${size}"/><name val="Microsoft YaHei"/><color rgb="${color}"/></font>`;
const styleFill=color=>`<fill><patternFill patternType="solid"><fgColor rgb="${color}"/><bgColor indexed="64"/></patternFill></fill>`;
function styleBorder(left,right,gap=false){const edge=(name,kind)=>kind?`<${name} style="${kind}"><color rgb="${kind==='medium'?(gap?'FF829A85':'FFA6B3A0'):STYLE_LINE}"/></${name}>`:`<${name}/>`;return `<border>${edge('left',left)}${edge('right',right)}${edge('top','thin')}${edge('bottom','thin')}<diagonal/></border>`;}
function styleXF(font,fill,border,{number=49,align='center',shrink=false,wrap=false}={}){return `<xf numFmtId="${number}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="${align}" vertical="center"${shrink?' shrinkToFit="1"':''}${wrap?' wrapText="1"':''}/></xf>`;}
const STYLES=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;第&quot;0&quot;列&quot;"/></numFmts><fonts count="8">${[
  styleFont(11,'FF153F33'),styleFont(18,'FF153F33',true),styleFont(11,'FFFFFFFF',true),styleFont(9,'FF6C766A'),styleFont(11,'FF234C3E',true),styleFont(9,'FF39574B'),styleFont(9,'FF6C5149'),styleFont(10,'FF6C7666')
].join('')}</fonts><fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${['FF627D6E',STYLE_PAPER,'FFFFFDF8','FFEBF0E7','FFF8EDE7'].map(styleFill).join('')}</fills><borders count="6"><border><left/><right/><top/><bottom/><diagonal/></border>${[styleBorder('thin','thin'),styleBorder('thin',null),styleBorder(null,'thin'),styleBorder('thin',null),styleBorder(null,'thin')].join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="17">${[
  styleXF(3,0,0,{number:0}),styleXF(1,3,0,{align:'left'}),styleXF(2,2,0),styleXF(4,3,0,{number:164}),styleXF(0,4,2,{shrink:true}),styleXF(5,4,3),styleXF(3,3,0,{align:'left',wrap:true}),styleXF(4,3,2),styleXF(4,3,3),styleXF(7,3,0),styleXF(5,5,3),styleXF(6,6,3),styleXF(0,4,4,{shrink:true}),styleXF(5,4,5),styleXF(5,5,5),styleXF(6,6,5),styleXF(3,3,0)
].join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
function styleWorkbook(bytes) {
  const parts=unzipSync(bytesOf(bytes));parts['xl/styles.xml']=encoder.encode(STYLES);
  parts['[Content_Types].xml']=encoder.encode(decoder.decode(parts['[Content_Types].xml']).replace(/<Default Extension="bin"[^>]*\/>/g,''));
  for(const path of Object.keys(parts)) if(/^xl\/worksheets\/sheet\d+\.xml$/.test(path)) {
    let xml=decoder.decode(parts[path]);
    const gridRows=Number(/<c\b[^>]*r="AA9"[^>]*><v>(\d+)<\/v><\/c>/.exec(xml)?.[1]);
    if(!Number.isInteger(gridRows)||gridRows<8||gridRows>16) fail('导出的网格排数无效。');
    const cellValues=new Map([...xml.matchAll(/<c\b[^>]*\br="([A-Z]+\d+)"[^>]*>([\s\S]*?)<\/c>/g)].map(match=>[match[1],/<v>([\s\S]*?)<\/v>/.exec(match[2])?.[1]??'']));
    xml=xml.replace(/<c\b([^>]*\br="([A-Z]+)(\d+)"[^>]*)>/g,(_,attributes,col,number)=>{
      const row=Number(number),column=XLSX.utils.decode_col(col);let s=0;
      if(column<=16&&row<=gridRows+5)s=16;
      if(col==='A'&&row===1)s=1;
      else if(row===gridRows+5&&column>=1&&column<=16)s=2;
      else if(row===3&&column<=16)s=3;
      else if(row===4&&column<=16)s=column===0?9:column%2===1?7:8;
      else if(row>=5&&row<=gridRows+4&&column<=16) {
        if(column===0)s=9;
        else if(column%2===1)s=[5,9,13].includes(column)?12:4;
        else {const value=cellValues.get(`${col}${row}`),gap=[4,8,12].includes(column);s=value==='男'?(gap?14:10):value==='女'?(gap?15:11):(gap?13:5);}
      }
      else if(col==='S')s=row===3?7:6;
      return `<c${attributes.replace(/\s+s="\d+"/g,'')} s="${s}">`;
    });
    xml=xml.replace(/<worksheet\b([^>]*)>/,'<worksheet$1><sheetPr><pageSetUpPr fitToPage="1" autoPageBreaks="0"/></sheetPr>');
    xml=xml.replace(/<sheetView\b([^>]*)\/>/,'<sheetView$1 showGridLines="0" showRowColHeaders="0"><pane xSplit="1" ySplit="4" topLeftCell="B5" activePane="bottomRight" state="frozen"/></sheetView>');
    const validations=Array.from({length:8},(_,i)=>`${address(5,i*2+3)}:${address(gridRows+4,i*2+3)}`).join(' ');
    const validation=`<dataValidations count="1"><dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="请填写性别" error="请选择男或女，也可留空。" sqref="${validations}"><formula1>"男,女"</formula1></dataValidation></dataValidations>`;
    const before=/<(?:hyperlinks|printOptions|pageMargins|pageSetup|headerFooter|rowBreaks|colBreaks|customProperties|cellWatches|ignoredErrors|drawing|legacyDrawing|extLst)\b|<\/worksheet>/.exec(xml);
    xml=xml.slice(0,before.index)+validation+xml.slice(before.index);
    // OOXML order: validations, printOptions, margins, pageSetup, ignoredErrors.
    xml=xml.replace(/(<pageMargins\b[^>]*\/>)/,'<printOptions horizontalCentered="1" headings="0" gridLines="0"/>$1<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="1" usePrinterDefaults="0"/>');
    parts[path]=encoder.encode(xml);
  }
  if(Object.values(parts).reduce((n,part)=>n+part.length,0)>MAX_EXCEL_UNCOMPRESSED_BYTES) fail('导出的 Excel 解压内容超过 20 MB，请减少班级数量后再试。');
  return zipSync(parts,{level:6});
}
export function writeExcel(state,{template=false}={}) {
  const templateClasses=[{id:'example-class',name:'示例班级',noRepeat:true,sample:false,seats:[{id:'example-1',row:1,col:1,name:'示例学生甲',gender:'female'},{id:'example-2',row:1,col:3,name:'示例学生乙',gender:'male'},{id:'example-3',row:2,col:2,name:'示例学生丙',gender:''}]}];
  const classes=template?templateClasses:makePackage(state).classes;
  const checked=canonical(classes),workbook=XLSX.utils.book_new(),used=new Set();
  workbook.Workbook={Names:[]};
  for(const c of makePackage(checked).classes){const name=sheetName(c.name,used),index=workbook.SheetNames.length,rows=Math.max(8,...c.seats.map(s=>s.row));XLSX.utils.book_append_sheet(workbook,gridSheet(c,name),name);workbook.Workbook.Names.push({Name:'_xlnm.Print_Area',Sheet:index,Ref:`'${name.replace(/'/g,"''")}'!$A$1:$Q$${rows+5}`});}
  workbook.Props={Title:template?'晴窗教室 · Excel座位模板':'晴窗教室 · 班级座位资料',Author:'晴窗教室',Subject:'每个工作表一个班级，姓名与性别按座位网格排列'};
  const output=styleWorkbook(XLSX.write(workbook,{type:'array',bookType:'xlsx',compression:false,bookSST:false}));
  if(output.byteLength>MAX_EXCEL_BYTES) fail('导出的 Excel 超过 5 MB，请减少班级数量或姓名长度后再试。');
  return output;
}
