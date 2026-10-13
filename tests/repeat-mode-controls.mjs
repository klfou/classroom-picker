import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {register} from 'node:module';
import {CLASS_KEY} from '../dist/classes.js';
import {drawTimingForTheme} from '../dist/draw-timing.js';

// Real scene handlers run with deterministic DOM/clock fixtures. CSS contracts
// and conservative text-width arithmetic are not browser layout or pixel QA.
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../dist/style.css',import.meta.url),'utf8');
const source=readFileSync(new URL('../dist/scene.js',import.meta.url),'utf8');
assert.doesNotMatch(html,/type="checkbox"|id="no-repeat"|class="settings"|class="switch"/);
assert.doesNotMatch(css,/\.settings\b|\.switch\b/);
assert.doesNotMatch(source,/\$\('#no-repeat'\)|\.checked/);
const buttonTags=[...html.matchAll(/<button\b([^>]*data-no-repeat[^>]*)>([^<]*)<\/button>/g)];
assert.deepEqual(buttonTags.map(m=>m[2]),['允许重复','不重复点名']);
for(const [,attrs]of buttonTags){assert.match(attrs,/type="button"/);assert.doesNotMatch(attrs,/role=|tabindex="-1"/)}
assert.match(html,/<div class="repeat-mode" role="group" aria-label="点名重复模式">/);

const rules=[];
function parseRules(text,media=[]){
 let pos=0;
 while(pos<text.length){
  const open=text.indexOf('{',pos);if(open<0)break;
  const selector=text.slice(pos,open).trim();let end=open+1,depth=1;
  for(;end<text.length&&depth;end++){if(text[end]==='{')depth++;else if(text[end]==='}')depth--}
  const body=text.slice(open+1,end-1);
  if(selector.startsWith('@media'))parseRules(body,[...media,selector]);
  else rules.push({selector,media,style:Object.fromEntries(body.split(';').filter(Boolean).map(d=>{const colon=d.indexOf(':');return[d.slice(0,colon).trim(),d.slice(colon+1).trim()]}))});
  pos=end;
 }
}
parseRules(css.replace(/\/\*[\s\S]*?\*\//g,''));
const active=(query,width,height)=>!query.includes('prefers-reduced-motion')&&!query.includes('pointer:coarse')&&[...query.matchAll(/(min|max)-(width|height):([\d.]+)px/g)].every(([,limit,axis,value])=>limit==='min'?(axis==='width'?width:height)>=+value:(axis==='width'?width:height)<=+value);
const style=(selector,width=1366,height=768)=>Object.assign({},...rules.filter(r=>r.selector.split(',').map(s=>s.trim()).includes(selector)&&r.media.every(q=>active(q,width,height))).map(r=>r.style));
const rgb=h=>h.slice(1).match(/../g).map(s=>parseInt(s,16)/255);
const luminance=hex=>rgb(hex).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
const root='.repeat-mode button';let paintChecks=0;
for(const theme of ['classroom','space','paper']){
 const themed=selector=>theme==='classroom'?{}:style(`body[data-theme=${theme}] ${selector}`);
 const base={...style(root),...themed(root)};
 for(const suffix of ['',':hover:not(:disabled)','[aria-pressed=true]','[aria-pressed=true]:hover:not(:disabled)',':disabled','[aria-pressed=true]:disabled']){
  const paint={...base,...style(root+suffix),...themed(root+suffix)};
  assert.ok(contrast(paint.color,paint.background)>=4.5,`${theme} ${suffix}: readable label`);
  assert.doesNotMatch(paint.background,/gradient/);assert.equal(paint['box-shadow'],undefined,'Repeat controls stay flat');paintChecks++;
 }
 const selected={...base,...style(root+'[aria-pressed=true]'),...themed(root+'[aria-pressed=true]')};
 assert.ok(contrast(selected.background,base.background)>=3,`${theme}: selected fill visibly differs`);
 const focus={...style(root+':focus-visible'),...themed(root+':focus-visible')};
 const footer=theme==='classroom'?'#fffef5':theme==='space'?'#0a1423':'#2d1621';
 assert.match(focus.outline,/^3px solid /);assert.ok(contrast(focus['outline-color']||focus.outline.split(' ').at(-1),footer)>=3,`${theme}: visible keyboard focus`);
 assert.equal(style(root+':disabled').opacity,'1','Disabled labels do not lose contrast through opacity');
}
assert.equal(style(root)['min-height'],'44px');assert.equal(style(root)['touch-action'],'manipulation');
for(const width of [320,360,375,390,430,540,760]){
 const buttons=style(root,width),container={...style('.repeat-mode',width),...style('.bottom-toolbar .repeat-mode',width)};
 assert.equal(buttons['min-height'],'44px');assert.equal(buttons.flex,'1 1 auto','Each full label receives its intrinsic width');
 assert.equal(container['grid-column'],'span 2');assert.equal(container['justify-self'],'stretch');
 const footerWidth=width-24,cellWidth=(footerWidth-18)/4,available=cellWidth*2+6;
 const required=9*parseFloat(buttons['font-size'])+4*5+4+parseFloat(container.gap);
 assert.ok(required<=available,`${width}px: both full CJK labels and button padding fit the two-column budget`);
 assert.equal(style('footer',width).height,'354px');assert.equal(style('#viewport',width).bottom,'354px');
 assert.equal(style('footer',width,480)['overflow-y'],'auto','Short phones keep all footer rows reachable');
}

register('./helpers/theme-scene-loader.mjs',import.meta.url);
const {setup,dist,$}=await import('./helpers/theme-environment.mjs');
const seed={version:3,activeId:'a',classes:['a','b'].map((id,i)=>({id,name:`按钮测试${i+1}班`,noRepeat:!!i,sample:false,used:['1:1'],seats:[{id:`${id}-one`,name:'同名学生',row:1,col:1},{id:`${id}-two`,name:'同名学生',row:1,col:2}]})),deleted:[]};
const reopen=process.argv[2]==='--reopen';
const storage=reopen?JSON.parse(Buffer.from(process.argv[3],'base64').toString()):{[CLASS_KEY]:JSON.stringify(seed)};
const env=await setup({storage});await import(dist+'/scene.js');const app=window.classroom;await env.awaitReady(app.ready);env.bindRenderer(app.renderer);
const buttons=[$('repeat-allow'),$('repeat-once')],state=()=>app.getState();
function selected(noRepeat){assert.equal(state().noRepeat,noRepeat);assert.deepEqual(buttons.map(b=>b.getAttribute('aria-pressed')),[String(!noRepeat),String(noRepeat)])}
const switchClass=id=>assert.equal(app.classAction(()=>app.classStore.switch(id)),true);
selected(false);assert.deepEqual(state().used,[]);
switchClass('b');selected(true);assert.deepEqual(state().used,[]);switchClass('a');selected(false);
if(reopen){console.log('PASS repeat controls reopened: both persisted class preferences restore, session histories clear');process.exit(0)}
const rawWrite=localStorage.setItem,writes=[];localStorage.setItem=(...args)=>{writes.push(args[0]);rawWrite(...args)};
for(const theme of ['classroom','space','paper']){
 app.setTheme(theme);selected(false);const rng=env.randomCalls;writes.length=0;
 for(let i=0;i<3;i++)buttons[0].click();selected(false);assert.equal(writes.length,0,'Clicking selected mode does not rewrite storage');
 buttons[1].click();selected(true);assert.equal(app.classStore.current.noRepeat,true);buttons[0].click();selected(false);
 assert.equal(env.randomCalls,rng,'Mode clicks do not consume winner RNG');
 for(const [index,key,wanted]of [[0,'ArrowRight',true],[1,'ArrowLeft',false],[0,'End',true],[1,'Home',false],[0,'ArrowUp',true],[1,'ArrowDown',false]]){
  const event={type:'keydown',key};buttons[index].dispatchEvent(event);assert.equal(event.defaultPrevented,true);selected(wanted);assert.equal(document.activeElement,buttons[wanted?1:0]);
 }
 for(const key of ['Tab','Enter',' ']){const event={type:'keydown',key};buttons[0].dispatchEvent(event);assert.equal(event.defaultPrevented,undefined,'Native button Tab/Enter/Space behavior is not intercepted')}
 const generation=__sharedThemeQA().drawGeneration;env.key('Space',buttons[0]);assert.equal(__sharedThemeQA().drawGeneration,generation,'A focused mode button cannot activate the body Space draw shortcut');
 for(const noRepeat of [false,true]){
  buttons[noRepeat?1:0].click();selected(noRepeat);app.pick();assert.equal(state().busy,true);assert.ok(buttons.every(b=>b.disabled));
  const original=state(),randomAtStart=env.randomCalls;writes.length=0;
  for(const b of buttons){b.click();b.onclick();b.onkeydown({key:'Home',preventDefault(){throw Error('Busy key handler must return')}})}
  selected(noRepeat);assert.deepEqual(state().used,original.used);assert.equal(env.randomCalls,randomAtStart);assert.equal(writes.length,0);
  for(const destination of ['space','paper','classroom']){app.setTheme(destination);selected(noRepeat);assert.ok(buttons.every(b=>b.disabled))}
  app.cancelDraw();assert.ok(buttons.every(b=>!b.disabled));selected(noRepeat);app.setTheme(theme);
 }
 buttons[0].click();app.pick();await env.step(drawTimingForTheme(theme).total);await env.flush();await env.step(1600);await env.flush();assert.ok(buttons.every(b=>!b.disabled));
 const used=state().used;assert.ok(used.length);buttons[1].click();selected(true);assert.deepEqual(state().used,used);buttons[0].click();selected(false);assert.deepEqual(state().used,used);
}
const storageSnapshot=Object.fromEntries([CLASS_KEY,'sunlit-theme'].map(key=>[key,localStorage.getItem(key)]).filter(([,value])=>value!==null));
const child=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--reopen',Buffer.from(JSON.stringify(storageSnapshot)).toString('base64')],{encoding:'utf8'});assert.equal(child.status,0,child.stderr||child.stdout);process.stdout.write(child.stdout);
buttons[1].click();const used=state().used;localStorage.setItem=()=>{throw Error('simulated quota')};buttons[0].click();selected(false);assert.equal(app.classStore.current.noRepeat,true);assert.deepEqual(state().used,used);assert.match($('storage-notice').textContent,/保存失败/);app.restoreClass();selected(true);assert.deepEqual(state().used,used);
console.log(`PASS repeat controls: ${paintChecks} three-theme contrast pairs, clear selected/focus/disabled paint, flat 44px touch targets, 320–760px layout contracts, native keyboard contracts plus arrow/Home/End handlers, exclusive clicks, RNG untouched, busy guards, class preference persistence, save failures and retained session history. Browser pixels were not tested.`);
