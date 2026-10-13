import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PAPER_PALETTE} from '../dist/paper-cards.js';

// Static paint-contract tests, not a browser screenshot or computed-style test.
// The v95 shared fingerprint includes the teacher-view seat-plan wrapper and
// bottom lectern spacing, alongside the v93 repeat-button replacement.
// The original PAPER geometry fingerprint still protects layout, hit targets,
// visibility, border widths and shadow dimensions; new repeat paint is color-only.
const css=readFileSync(new URL('../dist/style.css',import.meta.url),'utf8').split('\n/* Native minute selector')[0];
const start=css.indexOf('/* Paper table:'),end=css.indexOf('/* The third choice',start);
assert.ok(start>=0&&end>start);
const paper=css.slice(start,end),outside=css.slice(0,start)+css.slice(end);
const hash=s=>createHash('sha256').update(s).digest('hex');
// Normalize only the explicit disabled-vs-busy cursor fix; all palette/layout
// declarations must still match the original shared fingerprint.
const paletteBaseline=outside.replace('button:disabled{opacity:.5;cursor:not-allowed}button:disabled[aria-busy="true"]{cursor:default}','button:disabled{opacity:.5;cursor:wait}');
assert.equal(hash(paletteBaseline),'c592669bdca85f1c53efdc4a92008d1c7c59bcccc21fb371236101a195594893','Shared and SPACE CSS match the v95 teacher-view baseline');
const rules=[...paper.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([,selector,body])=>({selector:selector.trim(),declarations:Object.fromEntries(body.split(';').filter(Boolean).map(d=>{const i=d.indexOf(':');return[d.slice(0,i),d.slice(i+1)]}))}));
const colorOnly=new Set(['color','background','border-color','outline-color','--green','--line']);
const geometry=rules.map(({selector,declarations})=>{const values=Object.entries(declarations).filter(([key])=>!colorOnly.has(key)).map(([key,value])=>`${key}:${value.replace(/#[\da-f]{3,8}\b/gi,'#COLOR')}`);return values.length?`${selector}{${values.join(';')}}`:''}).filter(Boolean).join('\n');
assert.equal(hash(geometry),'351c4f5a65462d1f87fe9a611c5cb081ed6af0c1f7c09c0726a914da6e61bb3a','PAPER geometry and interaction styles stay unchanged');
for(const {selector}of rules)assert.ok(selector==='#paper-canvas'||selector.startsWith('body[data-theme=paper]'),'Every color override is PAPER scoped');
function rule(selector){const found=rules.find(r=>r.selector===`body[data-theme=paper] ${selector}`);assert.ok(found,`Missing PAPER rule: ${selector}`);return found.declarations}
const body=rules.find(r=>r.selector==='body[data-theme=paper]').declarations;
assert.equal(body.background,PAPER_PALETTE.background);
assert.equal(body.color,PAPER_PALETTE.paper);
assert.equal(rule('#pick').background,PAPER_PALETTE.paper);
assert.equal(rule('#roster-dialog').color,PAPER_PALETTE.ink);

const rgb=h=>{assert.match(h,/^#[\da-f]{6}$/i);return h.slice(1).match(/../g).map(c=>parseInt(c,16))};
const luminance=rgb=>rgb.map(c=>c/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const[x,y]=[luminance(a),luminance(b)].sort((a,b)=>a-b);return(y+.05)/(x+.05)};
const blend=(front,back,opacity)=>front.map((c,i)=>c*opacity+back[i]*(1-opacity));
let checks=0,minEnabled=Infinity,minDisabled=Infinity;
function readable(label,color,background,{opacity=1,parent=background,min=4.5}={}){
 const ratio=contrast(blend(rgb(color),rgb(parent),opacity),blend(rgb(background),rgb(parent),opacity));
 assert.ok(ratio>=min,`${label}: ${ratio.toFixed(2)}:1 is below ${min}:1`);
 if(opacity===1)minEnabled=Math.min(minEnabled,ratio);else minDisabled=Math.min(minDisabled,ratio);
 checks++;return ratio;
}
function pair(selector,base=selector,options={}){const style={...rule(base),...rule(selector)};return readable(selector,style.color,style.background,options)}
for(const selector of ['header','#pick','#timer-primary','.theme-choices button[aria-checked=true]','.duration-options button[aria-checked=true]','#screen-help','#storage-notice','#roster-dialog','.seat-card','.seat-gender-badge','.seat-gender-badge.female','#seat-editor-bar','.seat-gender-controls button[aria-pressed=true]','.panel-bottom #panel-confirm','.panel-bottom #panel-confirm-cancel'])pair(selector);
for(const [selector,base]of [['#pick:hover:not(:disabled)','#pick'],['#timer-primary:hover:not(:disabled)','#timer-primary'],['.theme-choices button:hover:not(:disabled)','.theme-choices button[aria-checked=true]'],['.duration-options button:hover:not(:disabled)','.duration-options button[aria-checked=true]'],['.seat-card:hover','.seat-card'],['.seat-card.is-selected','.seat-card']])pair(selector,base);
readable('header detail',rule('#scene-note').color,rule('header').background);
readable('theme choices',rule('.theme-choices button').color,rule('.theme-choices').background);
readable('duration choices',rule('.duration-options button').color,rule('.duration-options').background);
readable('result / timer metadata',rules.find(r=>r.selector.includes('#timer-mini,')).declarations.color,rule('#timer-primary').background);
const toolbar=rules.find(r=>r.selector.includes('.toolbar-button,')).declarations;
const toolbarHover=rules.find(r=>r.selector.includes('.toolbar-button:hover')).declarations;
readable('toolbar',toolbar.color,toolbar.background);readable('toolbar hover',toolbarHover.color,toolbarHover.background);
// Disabled controls retain the original opacity, with legible muted colors.
const footer=rule('footer').background;
pair('#pick:disabled','#pick',{opacity:.8,parent:footer,min:3});
pair('#timer-primary:disabled','#timer-primary',{opacity:.5,parent:footer,min:3});
const disabledToolbar=rules.find(r=>r.selector.includes('.toolbar-button:disabled')).declarations;
readable('disabled toolbar',disabledToolbar.color,disabledToolbar.background,{opacity:.5,parent:footer,min:3});
readable('disabled duration',rule('.duration-options button:disabled').color,rule('.duration-options').background,{opacity:.55,min:3});
pair('.duration-options button[aria-checked=true]:disabled','.duration-options button[aria-checked=true]',{opacity:.55,parent:rule('.duration-options').background,min:3});
const focus=rules.find(r=>r.selector.startsWith('body[data-theme=paper] :is(button,')).declarations['outline-color'];
assert.ok(contrast(rgb(focus),rgb(footer))>=3,'Table focus remains visible');
const editorFocus=rule('#roster-dialog :is(button,a,input,select,textarea,summary):focus-visible')['outline-color'];
assert.ok(contrast(rgb(editorFocus),rgb(rule('#roster-dialog').background))>=3,'Ivory editor uses a contrasting berry focus ring');
for(const selector of ['.repeat-mode button','.repeat-mode button:hover:not(:disabled)','.repeat-mode button[aria-pressed=true]','.repeat-mode button[aria-pressed=true]:hover:not(:disabled)','.repeat-mode button:disabled','.repeat-mode button[aria-pressed=true]:disabled'])pair(selector,'.repeat-mode button');
const on=rule('.repeat-mode button[aria-pressed=true]').background,off=rule('.repeat-mode button').background;
assert.ok(contrast(rgb(on),rgb(off))>=3,'Selected repeat choice is clearly distinct');
assert.ok(contrast(rgb(rule('.repeat-mode button:focus-visible')['outline-color']),rgb(footer))>=3,'Repeat buttons have a visible focus ring');
// Saturated accents must remain in the berry family. Near-neutral ivory paper
// is allowed, but old navy/ice-blue, green and gold paint cannot leak back in.
for(const [,hex]of paper.matchAll(/#([\da-f]{6})(?:[\da-f]{2})?\b/gi)){
 const [r,g,b]=rgb('#'+hex);assert.ok(r>=g&&r>=b,`Unexpected cool/green paint #${hex}`);
 if(Math.max(r,g,b)-Math.min(r,g,b)>35)assert.ok(b>=g,`Unexpected gold paint #${hex}`);
}
console.log(`PASS PAPER palette: v95 shared CSS and unchanged PAPER geometry byte contracts, renderer/UI identity, ${checks} contrast pairs (enabled ≥${minEnabled.toFixed(2)}:1, disabled after opacity ≥${minDisabled.toFixed(2)}:1), separate table/editor focus, explicit repeat-button states, no blue/green/gold paint.`);

// Native dropdown text colors are checked separately from frozen scene styles.
const selectorCss=readFileSync(new URL('../dist/style.css',import.meta.url),'utf8').split('/* Native minute selector')[1];
for(const match of selectorCss.matchAll(/(?:^|\n)([^{}]+#timer-minutes|#timer-minutes)\{([^{}]+)\}/g)){const declarations=Object.fromEntries(match[2].split(';').filter(Boolean).map(d=>{const i=d.indexOf(':');return[d.slice(0,i),d.slice(i+1)]}));if(declarations.color&&declarations.background)readable(match[1],declarations.color,declarations.background);}
