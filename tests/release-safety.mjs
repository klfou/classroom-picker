import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
const require = createRequire(import.meta.url);
const {validateConfig, ROOT} = require('../electron/release-config.cjs');
const {verifyRuntime, downloadRuntime} = require('../electron/download-runtime.cjs');
const {packageFiles} = require('../electron/verify-package.cjs');
const {version, runtime} = validateConfig();
assert.equal(validateConfig(ROOT, 'v' + version).version, version);
for (const tag of ['v0.0.0', version, 'v' + version + '-preview', 'v01.8.2', 'v1.8.2\n']) assert.throws(() => validateConfig(ROOT, tag), /tag/);
const temporary = mkdtempSync(path.join(tmpdir(), 'sunlit-release-safety-'));
try {
  mkdirSync(path.join(temporary, 'electron'));
  for (const name of ['package.json', 'package-lock.json', 'electron/package.json', 'electron/package-lock.json', 'electron/app-package.json', 'electron/runtime-lock.json']) copyFileSync(path.join(ROOT, name), path.join(temporary, name));
  const app = JSON.parse(readFileSync(path.join(temporary, 'package.json'))); app.version = '9.9.9';
  writeFileSync(path.join(temporary, 'package.json'), JSON.stringify(app));
  assert.throws(() => validateConfig(temporary), /version mismatch/);
  const bytes = Buffer.from('synthetic runtime checksum fixture');
  const file = path.join(temporary, runtime.filename); writeFileSync(file, bytes);
  await verifyRuntime(file, {...runtime, sha256: createHash('sha256').update(bytes).digest('hex')});
  await assert.rejects(verifyRuntime(file, runtime), /SHA-256 mismatch/);
  await assert.rejects(downloadRuntime(runtime, temporary), /SHA-256 mismatch/);
  const folder = path.join(temporary, 'package'); mkdirSync(folder);
  writeFileSync(path.join(folder, 'LICENSE'), 'synthetic');
  assert.deepEqual(packageFiles(folder), ['LICENSE']);
  for (const name of ['Data', 'AppData', 'userData', 'Local Storage', 'node_modules', '.git', 'Data-recovery-test', '.Data-migration-test']) {
    mkdirSync(path.join(folder, name));
    assert.throws(() => packageFiles(folder), /Private\/build/);
    rmSync(path.join(folder, name), {recursive: true});
  }
  for (const name of ['class.csv', 'class.xlsx', 'sunlit-classes-20260101.json', 'sunlit-backup-test.json']) {
    writeFileSync(path.join(folder, name), 'synthetic');
    assert.throws(() => packageFiles(folder), /Class export/);
    rmSync(path.join(folder, name));
  }
} finally {rmSync(temporary, {recursive: true, force: true});}
for (const name of ['ci.yml', 'release.yml']) {
  const yaml = readFileSync(path.join(ROOT, '.github/workflows', name), 'utf8');
  assert.doesNotMatch(yaml, /^\s*pull_request_target:/m);
  for (const line of yaml.matchAll(/uses: (actions\/[^\s]+)/g)) assert.match(line[1], /^actions\/[^@]+@[a-f0-9]{40}$/);
  assert.match(yaml, /persist-credentials: false/);
}
assert.doesNotMatch(readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8'), /contents: write|secrets\./);
console.log('PASS release safety: exact version/tag agreement, locked official runtime/checksum and corrupt-cache refusal, private-data exclusion, SHA-pinned Actions, read-only PR workflow.');
