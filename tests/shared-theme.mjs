import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Execute the production theme-switch function with observable view adapters.
// Full DOM/audio/countdown integration is independently exercised in the QA harness.
const source=readFileSync(new URL('../dist/scene.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const start=source.indexOf('function setTheme(theme){');
const end=source.indexOf('const themeChoices=',start);
assert.ok(start>=0&&end>start,'production setTheme must remain identifiable');
const setThemeSource=source.slice(start,end);
assert.doesNotMatch(setThemeSource,/cancelDraw\(|cancelCountdown\(|makeDesks\(|sounds\.|\.start\(|\.reveal\(|\.reset\(/);
assert.match(html,/data-theme-choice="classroom"/);
assert.match(html,/data-theme-choice="space"/);
assert.match(html,/data-theme-choice="paper">翻牌点名/);
const header=html.match(/<header>[\s\S]*?<\/header>/)[0],footer=html.match(/<footer>[\s\S]*?<\/footer>/)[0];
assert.doesNotMatch(header,/data-theme-choice|theme-choices/,'No duplicate theme control remains in header');
assert.match(header,/class="brand"[\s\S]*晴窗教室/,'Brand remains visible');
assert.match(footer,/class="bottom-toolbar">[\s\S]*class="theme-choices"/,'Real theme controls belong to bottom toolbar');
assert.equal((html.match(/data-theme-choice="classroom"/g)||[]).length,1);
assert.equal((html.match(/data-theme-choice="space"/g)||[]).length,1);
assert.equal((html.match(/data-theme-choice="paper"/g)||[]).length,1);
let assertions=0;
for(const storageFails of [false,true])for(const boardMode of [false,true])for(const drawDurationMs of [600,1000,1750]){
 const events=[],used=new Set([0,2]),names=['林予安','陈星禾','许知夏'];
 const context={activeTheme:'classroom',boardMode,lastBoardState:{text:'00:51',hundredths:'30',state:'running'},viewportWidth:1366,lastRenderKey:'previous',used,names,chosen:2,busy:true,drawStart:1000,drawGeneration:5,drawDurationMs,deadline:61000,
  localStorage:{setItem(key,value){events.push(['save',key,value]);if(storageFails)throw Error('denied')}},
  performance:{now:()=>1400},dimensions:()=>[1366,520],
  renderBudgets:{classroom:{resetSamples(){}},space:{resetSamples(){}},paper:{resetSamples(){}}},applyRenderQuality(){},syncClassroomMotion(){},
  spaceCards:{setActive:active=>events.push(['space.active',active]),resize:(...args)=>events.push(['space.resize',...args]),setCountdown:s=>events.push(['space.countdown',s]),render:t=>events.push(['space.render',t])},
  paperCards:{setActive:active=>events.push(['paper.active',active]),resize:(...args)=>events.push(['paper.resize',...args]),setCountdown:s=>events.push(['paper.countdown',s]),render:t=>events.push(['paper.render',t])},
  boardTimer:{update:s=>events.push(['board.update',s])},
  resize:()=>events.push(['classroom.resize']),updateBoardVisibility:()=>events.push(['classroom.visibility']),updateArchitecture:()=>events.push(['classroom.architecture']),renderer:{render:()=>events.push(['classroom.render'])},scene:{},camera:{},
  updateThemeControls(){events.push(['controls',context.activeTheme])}};
 vm.createContext(context);vm.runInContext(setThemeSource,context);
 const shared=()=>({used:[...context.used],names:[...context.names],chosen:context.chosen,busy:context.busy,drawStart:context.drawStart,drawGeneration:context.drawGeneration,drawDurationMs:context.drawDurationMs,deadline:context.deadline});
 const before=shared();
 for(let i=0;i<20;i++){
  const theme=['space','paper','classroom'][i%3],at=events.length;
  context.setTheme(theme);
  assert.equal(context.activeTheme,theme);assertions++;
  assert.deepEqual(shared(),before);assertions++;
  assert.equal(context.used,used);assert.equal(context.names,names);assertions+=2;
  const calls=events.slice(at);
  assert.deepEqual(calls[0],['space.active',theme==='space']);assertions++;
  assert.deepEqual(calls[1],['paper.active',theme==='paper']);assertions++;
  assert.deepEqual(calls[2],['save','sunlit-theme',theme]);assertions++;
  assert.deepEqual(calls.at(-1),['controls',theme]);assertions++;
  const rendered=calls.findIndex(call=>call[0]===`${theme}.render`);
  assert.ok(rendered>=0&&rendered<calls.length-1,'paint destination before changing visible theme');assertions++;
  if(theme!=='classroom'){
   assert.deepEqual(calls.find(call=>call[0]===`${theme}.countdown`),[`${theme}.countdown`,boardMode?context.lastBoardState:null]);assertions++;
  }else{
   assert.equal(calls.some(call=>call[0]==='board.update'),boardMode);assertions++;
   assert.equal(context.lastRenderKey,'');assertions++;
  }
  const size=events.length;
  context.setTheme(theme);context.setTheme('invalid');context.setTheme(null);
  assert.equal(events.length,size);assert.equal(context.activeTheme,theme);assertions+=2;
 }
}
console.log(`PASS ${assertions} production theme-switch assertions: shared state/identity, 600ms, 1000ms and 1750ms draw deadline continuity, timer continuity, save failure tolerance, invalid/same-theme guards, countdown view synchronization, shared-GPU activation gating, and paint-before-show order.`);
// Moving the real buttons keeps their existing selector-based keyboard handlers.
{
 const seen=[],buttons=['classroom','space','paper'].map(theme=>({dataset:{themeChoice:theme},focus(){seen.push(['focus',theme])},click(){this.onclick()}}));
 const binding=source.slice(source.indexOf('const themeChoices='),source.indexOf('window.classroom='));
 vm.runInNewContext(binding,{document:{querySelectorAll:()=>buttons},setTheme:theme=>seen.push(['theme',theme])});
 for(const [index,key,expected]of [[0,'ArrowRight','space'],[1,'ArrowLeft','classroom'],[1,'Home','classroom'],[0,'End','paper'],[1,'ArrowRight','paper'],[2,'ArrowRight','classroom'],[0,'ArrowLeft','paper']]){
  let prevented=false;buttons[index].onkeydown({key,preventDefault(){prevented=true}});assert.ok(prevented);assert.deepEqual(seen.slice(-2),[['theme',expected],['focus',expected]]);
 }
}
