import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const baseline=JSON.parse(await fs.readFile(new URL('./root-baseline-sha256.json',import.meta.url),'utf8'));
const sourceRoot=path.resolve(fileURLToPath(new URL('../../',import.meta.url)),baseline.root);
const roots=[...new Set([sourceRoot,...(process.env.ORBIT_ASSET_ROOT?[path.resolve(process.env.ORBIT_ASSET_ROOT)]:[])])];
for(const root of roots){const actual={};
for(const [file,expected]of Object.entries(baseline.files)){
 const hash=createHash('sha256').update(await fs.readFile(path.join(root,file))).digest('hex');
 assert.equal(hash,expected,`Existing live-root file changed: ${file}`);actual[file]=hash;
}
const aggregate=createHash('sha256').update(Object.entries(actual).map(([k,v])=>k+' '+v+'\n').join('')).digest('hex');
assert.equal(aggregate,baseline.sha256);
console.log(JSON.stringify({result:'PASS',existingRootFiles:Object.keys(actual).length,sha256:aggregate,nestedPreviewExcluded:true,verifiedRoot:root}));
}
