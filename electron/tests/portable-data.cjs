'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { preparePortable, completeMigration, MARKER } = require('../portable-data.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sunlit-synthetic-'));
let checks = 0;
const test = (name, fn) => { fn(); console.log('PASS', name); checks++; };
const dir = name => { const p = path.join(root, name); fs.mkdirSync(p, {recursive:true}); return p; };
try {
 const legacy = dir('legacy'); const db = dir('legacy/Local Storage/leveldb');
 const synthetic = Buffer.from('synthetic-leveldb-bytes: 虚构学生甲');
 fs.writeFileSync(path.join(db,'000003.log'), synthetic); fs.writeFileSync(path.join(db,'LOCK'),'');
 let profile;
 test('first run stages exact bytes, preserves old files, excludes LOCK and awaits Chromium validation', () => {
  profile = preparePortable({base:dir('computer-a/app'),legacy});
  assert.equal(profile.marker.status,'pending-validation');
  assert.deepEqual(fs.readFileSync(path.join(profile.data,'Local Storage/leveldb/000003.log')),synthetic);
  assert.deepEqual(fs.readFileSync(path.join(db,'000003.log')),synthetic);
  assert.equal(fs.existsSync(path.join(profile.data,'Local Storage/leveldb/LOCK')),false);
 });
 test('validation status changes only when explicitly completed', () => {
  completeMigration(profile); assert.equal(JSON.parse(fs.readFileSync(path.join(profile.data,MARKER))).status,'validated');
 });
 test('copy to another computer ignores its different local roster', () => {
  const base = dir('computer-b/app'), second = dir('other-user/Local Storage/leveldb');
  fs.writeFileSync(path.join(second,'000003.log'),'OTHER CLASS');
  fs.cpSync(profile.data,path.join(base,'Data'),{recursive:true});
  const p = preparePortable({base,legacy:path.dirname(path.dirname(second))});
  assert.equal(p.migrated,false); assert.deepEqual(fs.readFileSync(path.join(p.data,'Local Storage/leveldb/000003.log')),synthetic);
  assert.equal(fs.readFileSync(path.join(second,'000003.log'),'utf8'),'OTHER CLASS');
 });
 test('fresh Data never reimports a later local legacy roster', () => {
  const base = dir('fresh'), p = preparePortable({base,legacy:path.join(root,'missing')});
  assert.equal(p.marker.status,'fresh'); preparePortable({base,legacy});
  assert.equal(fs.existsSync(path.join(p.data,'Local Storage')),false);
 });
 test('unknown existing Data is preserved and blocks startup', () => {
  const base = dir('unknown');dir('unknown/Data'); fs.writeFileSync(path.join(base,'Data','keep'),'do not touch');
  assert.throws(()=>preparePortable({base,legacy}),/没有初始化标记/);
  assert.equal(fs.readFileSync(path.join(base,'Data','keep'),'utf8'),'do not touch');
 });
 test('failed migration with symlink leaves no partial Data and keeps source', () => {
  const src = dir('bad-legacy/Local Storage'); fs.symlinkSync(path.join(db,'000003.log'),path.join(src,'unsafe'));
  const base = dir('failed');assert.throws(()=>preparePortable({base,legacy:path.dirname(src)}),/链接/);
  assert.equal(fs.existsSync(path.join(base,'Data')),false);assert.deepEqual(fs.readdirSync(base),[]);
  assert.ok(fs.lstatSync(path.join(src,'unsafe')).isSymbolicLink());
 });
 test('stale unrelated migration directory is never reused or deleted', () => {
  const base = dir('residue');dir('residue/.Data-migration-old');fs.writeFileSync(path.join(base,'.Data-migration-old','keep'),'keep');
  preparePortable({base,legacy});assert.equal(fs.readFileSync(path.join(base,'.Data-migration-old','keep'),'utf8'),'keep');
 });
 test('pending validation survives restart and is not re-copied', () => {
  const base=dir('pending');preparePortable({base,legacy});fs.writeFileSync(path.join(db,'000003.log'),'changed later');
  const p=preparePortable({base,legacy});assert.equal(p.marker.status,'pending-validation');
  assert.deepEqual(fs.readFileSync(path.join(p.data,'Local Storage/leveldb/000003.log')),synthetic);
 });
 test('chosen recovery preserves pending Data and creates fresh profile without reimport', () => {
  const base=dir('recover');const p=preparePortable({base,legacy});
  const before=fs.readFileSync(path.join(p.data,'Local Storage/leveldb/000003.log'));
  const fresh=preparePortable({base,legacy,recoverPending:true});assert.equal(fresh.marker.status,'fresh');
  assert.equal(fs.existsSync(path.join(fresh.data,'Local Storage')),false);
  const backup=fs.readdirSync(base).find(n=>n.startsWith('Data-recovery-'));assert.ok(backup);
  assert.deepEqual(fs.readFileSync(path.join(base,backup,'Local Storage/leveldb/000003.log')),before);
 });
 test('write denial stops initialization without fallback', () => {
  const base=dir('read-only'),original=fs.openSync;
  try { fs.openSync=(p,...args)=>{if(String(p).includes('.write-check-'))throw Object.assign(Error('denied'),{code:'EACCES'});return original(p,...args);};assert.throws(()=>preparePortable({base,legacy}),/denied/); }
  finally {fs.openSync=original;}
  assert.equal(fs.existsSync(path.join(base,'Data')),false);
 });
 test('invalid marker and linked Data fail closed', () => {
  const base=dir('invalid');dir('invalid/Data');fs.writeFileSync(path.join(base,'Data',MARKER),'{}');
  assert.throws(()=>preparePortable({base,legacy}),/无效/);
  const linked=dir('linked');fs.symlinkSync(profile.data,path.join(linked,'Data'));assert.throws(()=>preparePortable({base:linked,legacy}),/链接/);
 });
 test('Windows-like flush rejects read-only handles; migration uses one writable handle and closes it', () => {
  const { runInNewContext } = require('node:vm');
  const handles = new Map(), flushed = [], events = [];
  const wrapped = {...fs,
   openSync(file, flags, ...args) { const fd=fs.openSync(file,flags,...args);handles.set(fd,{file:String(file),flags});events.push(['open',fd,flags]);return fd; },
   writeFileSync(file,...args) { if(typeof file==='number')events.push(['write',file]);return fs.writeFileSync(file,...args); },
   fsyncSync(fd) { const h=handles.get(fd);assert.ok(h,'flush uses tracked fd');if(!/[wa+]/.test(h.flags))throw Object.assign(Error('Windows read-only flush denied'),{code:'EPERM'});flushed.push(h);events.push(['flush',fd]);return fs.fsyncSync(fd); },
   closeSync(fd) { events.push(['close',fd]);handles.delete(fd);return fs.closeSync(fd); }
  };
  const module={exports:{}};
  runInNewContext(fs.readFileSync(path.join(__dirname,'../portable-data.cjs'),'utf8'),{module,require:name=>name==='node:fs'?wrapped:require(name)});
  const base=dir('windows-flush'),before=fs.readFileSync(path.join(db,'000003.log'));
  const migrated=module.exports.preparePortable({base,legacy});
  assert.equal(migrated.marker.status,'pending-validation');assert.equal(handles.size,0);
  assert.deepEqual(fs.readFileSync(path.join(migrated.data,'Local Storage/leveldb/000003.log')),before);
  assert.deepEqual(fs.readFileSync(path.join(db,'000003.log')),before);
  const copied=flushed.filter(h=>h.file.includes('Local Storage'));assert.ok(copied.length>0);assert.ok(copied.every(h=>h.flags==='wx'));
  for(let i=0;i<events.length;i++)if(events[i][0]==='write'){const fd=events[i][1];assert.deepEqual(events[i+1],['flush',fd]);assert.deepEqual(events[i+2],['close',fd]);}
 });
 test('copy flush failure closes the writable handle, removes only its stage, and preserves legacy', () => {
  const { runInNewContext }=require('node:vm'),handles=new Map();let failures=0;
  const wrapped={...fs,
   openSync(file,flags,...args){const fd=fs.openSync(file,flags,...args);handles.set(fd,String(file));return fd;},
   fsyncSync(fd){if(handles.get(fd)?.includes('Local Storage')){failures++;throw Object.assign(Error('synthetic flush failure'),{code:'EIO'});}return fs.fsyncSync(fd);},
   closeSync(fd){handles.delete(fd);return fs.closeSync(fd);}
  };
  const module={exports:{}};runInNewContext(fs.readFileSync(path.join(__dirname,'../portable-data.cjs'),'utf8'),{module,require:name=>name==='node:fs'?wrapped:require(name)});
  const base=dir('flush-failure'),before=fs.readFileSync(path.join(db,'000003.log'));
  assert.throws(()=>module.exports.preparePortable({base,legacy}),/synthetic flush failure/);
  assert.equal(failures,1);assert.equal(handles.size,0);assert.deepEqual(fs.readdirSync(base),[]);
  assert.deepEqual(fs.readFileSync(path.join(db,'000003.log')),before);
 });
 console.log(`${checks} portable filesystem checks passed. Synthetic bytes only, not a Chromium/Windows integration test.`);
} finally { fs.rmSync(root,{recursive:true,force:true}); }
