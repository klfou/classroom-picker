import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {ROOT,listFiles} from '../scripts/build.mjs';
// Scan all shipped first-party sources, including future independent previews.
// Responsive media queries and document.hidden/adaptive-quality guards stay valid.
for(const file of listFiles(path.join(ROOT,'src'))){
 if(!/\.(?:js|css|html)$/.test(file))continue;
 const source=readFileSync(path.join(ROOT,'src',file),'utf8');
 assert.doesNotMatch(source,/prefers-reduced-motion|reducedMotion|reduceMotion|frozenElapsed/,`OS animation gate or dead state in ${file}`);
}
console.log('PASS all first-party runtime sources contain no OS motion query, branch, listener, or frozen-motion state');
