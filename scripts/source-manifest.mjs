import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import {ROOT} from './build.mjs';

// Explicit --write is a maintenance action after reviewing and staging changes.
// build/test/verify never rewrite either approved manifest.
const target = path.join(ROOT, 'SOURCE_MANIFEST.json');
const manifest = JSON.parse(readFileSync(target, 'utf8'));
const tracked = execFileSync('git', ['ls-files', '-z'], {cwd: ROOT, encoding: 'utf8'})
  .split('\0').filter(name => name && name !== 'SOURCE_MANIFEST.json').sort();
const files = tracked.map(name => {
  const bytes = readFileSync(path.join(ROOT, name));
  return {path: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')};
});
if (process.argv.slice(2).join(' ') === '--write') {
  writeFileSync(target, JSON.stringify({...manifest, files}, null, 2) + '\n');
  console.log(`Wrote ${files.length} reviewed/staged source entries; inspect the manifest diff before committing.`);
} else {
  assert.equal(process.argv.length, 2, 'Usage: node scripts/source-manifest.mjs [--write]');
  assert.deepEqual(files, manifest.files, 'Source manifest differs. Review changes, stage intended files, then explicitly refresh the manifest.');
  console.log(`Verified ${files.length} tracked source files against SOURCE_MANIFEST.json.`);
}
