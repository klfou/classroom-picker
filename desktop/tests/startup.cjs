'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {EventEmitter}=require('node:events');
const source=fs.readFileSync(path.join(__dirname,'../main.cjs'),'utf8');
async function run({locked=true,valid=true,recover=false,status='pending-validation'}={}) {
 const events=[],app=new EventEmitter(),windows=[];
 Object.assign(app,{isPackaged:true,setName(){},getPath:k=>k==='appData'?'/old':'/old/SunlitClassroom',setPath:(k,p)=>events.push(['path',k,p]),requestSingleInstanceLock:()=>{events.push(['lock']);return locked;},quit:()=>events.push(['quit']),exit:()=>{throw Error('unexpected exit');},whenReady:()=>{events.push(['ready']);return Promise.resolve();},isReady:()=>true,relaunch:args=>events.push(['relaunch',args])});
 const sess=new EventEmitter();Object.assign(sess,{webRequest:{onBeforeRequest(){}},setPermissionRequestHandler(){},setPermissionCheckHandler(){},flushStorageData(){}});
 class Window { constructor(options){this.options=options;this.webContents=new EventEmitter();Object.assign(this.webContents,{executeJavaScript:async()=>({ok:valid,reason:'synthetic failure'}),setWindowOpenHandler(){},getURL:()=>this.url});windows.push(this);events.push(['window',options.show]);} async loadURL(url){this.url=url;} destroy(){events.push(['destroy']);if(windows.filter(w=>!w.dead).length===1){this.dead=true;app.emit('window-all-closed');}else this.dead=true;}setMenu(){} }
 const electron={app,BrowserWindow:Window,protocol:{registerSchemesAsPrivileged(){},handle(){}},net:{},session:{defaultSession:sess},dialog:{showErrorBox:()=>events.push(['error']),showMessageBoxSync:opts=>{events.push(['dialog',opts.title]);return recover?1:0;}}};
 vm.runInNewContext(source,{require:name=>name==='electron'?electron:name==='./portable-data.cjs'?{preparePortable:()=>{events.push(['prepare']);return {data:'/portable/Data',marker:{status}};},completeMigration:()=>events.push(['validated'])}:require(name),__dirname:path.join(__dirname,'..'),process:{execPath:'/portable/App.exe',argv:['App.exe']},URL,Response});
 await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));
 return {events,windows,app};
}
(async()=>{
 let r=await run();assert.equal(r.events.filter(e=>e[0]==='quit').length,0,'destroying checker must not quit');assert.equal(r.windows.length,2);assert.ok(r.events.find(e=>e[0]==='validated'));
 for(const key of ['userData','sessionData'])assert.ok(r.events.findIndex(e=>e[0]==='path'&&e[1]===key&&e[2]==='/portable/Data')<r.events.findIndex(e=>e[0]==='ready'));
 r.app.emit('window-all-closed');assert.ok(r.events.find(e=>e[0]==='quit'));
 r=await run({locked:false});assert.equal(r.windows.length,0);assert.equal(r.events.some(e=>e[0]==='prepare'),false);
 r=await run({valid:false});assert.equal(r.windows.length,1);assert.equal(r.events.some(e=>e[0]==='validated'),false);assert.ok(r.events.find(e=>e[0]==='quit'));assert.equal(r.events.some(e=>e[0]==='relaunch'),false);
 r=await run({valid:false,recover:true});assert.ok(r.events.find(e=>e[0]==='relaunch')[1].args.includes('--sunlit-recover-migration'));
 r=await run({status:'validated'});assert.equal(r.windows.length,1);assert.equal(r.events.some(e=>e[0]==='validated'),false);
 console.log('PASS startup control flow: lock denial, pre-ready paths, hidden-window lifetime, validation, failure/recovery, existing Data. Electron mocked; no Windows claims.');
})().catch(e=>{console.error(e);process.exitCode=1;});
