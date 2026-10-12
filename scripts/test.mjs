import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const tests=readdirSync(new URL('../tests/',import.meta.url)).filter(name=>name.endsWith('.mjs')).sort();
for(const name of tests){
 console.log(`\n=== ${name} ===`);
 const result=spawnSync(process.execPath,['tests/'+name],{cwd:root,stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status??1);
}
console.log(`\nAll ${tests.length} test scripts passed.`);
