import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const test of ['orbit-host-flow.mjs','orbit-identity-lifecycle.mjs']){
const result=spawnSync(process.execPath,['tests/orbit-preview/'+test],{cwd:root,stdio:'inherit',env:{...process.env,ORBIT_DIST:root+'dist/orbit-preview',ORBIT_ASSET_ROOT:root+'dist',ORBIT_BASE_URL:'http://classroom.test/orbit-preview/'}});
if(result.error)throw result.error;
if(result.status!==0)process.exit(result.status??1);
}
