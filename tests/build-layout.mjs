import assert from 'node:assert/strict';
import {copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {buildWeb, listFiles, ROOT} from '../scripts/build.mjs';
import {createPreviewServer} from '../scripts/serve.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestBytes = readFileSync(new URL('../electron/assets-manifest.json', import.meta.url));
const manifest = JSON.parse(manifestBytes);
const expected = manifest.map(entry => entry.path).sort();
const outputs = listFiles(path.join(ROOT, 'dist'));
assert.deepEqual(outputs, expected);
const inputs = ['src', 'public'].flatMap(directory => listFiles(path.join(ROOT, directory)).map(relative => ({directory, relative})));
assert.equal(inputs.length, manifest.length);
for (const entry of manifest) {
  const input = inputs.find(input => input.relative === entry.path);
  assert.ok(input, `missing source for ${entry.path}`);
  const source = readFileSync(path.join(ROOT, input.directory, input.relative));
  const output = readFileSync(path.join(ROOT, 'dist', entry.path));
  assert.deepEqual(output, source, entry.path);
  assert.equal(output.length, entry.size, entry.path);
  assert.equal(sha(output), entry.sha256, entry.path);
}
assert.match(readFileSync(new URL('../.gitignore', import.meta.url), 'utf8'), /^\/dist\/$/m);
assert.match(readFileSync(new URL('../.gitattributes', import.meta.url), 'utf8'), /^\* -text$/m);
assert.equal(existsSync(path.join(ROOT, 'desktop')), false);
console.log(`PASS layout: all ${outputs.length} runtime files match reviewed manifest, source bytes and unchanged output URLs.`);

const temporary = mkdtempSync(path.join(tmpdir(), 'sunlit-build-layout-'));
try {
  const fixture = path.join(temporary, 'fixture');
  mkdirSync(path.join(fixture, 'src'), {recursive: true});
  mkdirSync(path.join(fixture, 'public'), {recursive: true});
  writeFileSync(path.join(fixture, 'src/index.html'), '<!doctype html>test\n');
  writeFileSync(path.join(fixture, 'public/data.bin'), Buffer.from([0, 1, 255, 13, 10]));
  assert.deepEqual(buildWeb(fixture), ['data.bin', 'index.html']);
  writeFileSync(path.join(fixture, 'dist/stale.js'), 'stale');
  buildWeb(fixture);
  assert.equal(existsSync(path.join(fixture, 'dist/stale.js')), false);
  assert.deepEqual(readFileSync(path.join(fixture, 'dist/data.bin')), Buffer.from([0, 1, 255, 13, 10]));
  writeFileSync(path.join(fixture, 'public/index.html'), 'conflict');
  assert.throws(() => buildWeb(fixture), /Duplicate output path/);
  assert.equal(readFileSync(path.join(fixture, 'dist/index.html'), 'utf8'), '<!doctype html>test\n');
  rmSync(path.join(fixture, 'public/index.html'));
  mkdirSync(path.join(fixture, 'public/index.html'));
  writeFileSync(path.join(fixture, 'public/index.html/nested'), 'conflict');
  assert.throws(() => buildWeb(fixture), /Conflicting output paths/);
  rmSync(path.join(fixture, 'public/index.html'), {recursive: true});
  writeFileSync(path.join(fixture, 'public/.env'), 'synthetic');
  assert.throws(() => buildWeb(fixture), /Hidden files/);
  rmSync(path.join(fixture, 'public/.env'));
  // Windows may require Developer Mode for creating test symlinks.
  let linked = false;
  try {symlinkSync(path.join(fixture, 'src/index.html'), path.join(fixture, 'public/link')); linked = true;}
  catch (error) {if (!['EPERM', 'EACCES'].includes(error.code)) throw error; console.log('SKIP symlink creation: OS permission unavailable.');}
  if (linked) {
    assert.throws(() => buildWeb(fixture), /Symbolic links/);
    rmSync(path.join(fixture, 'public/link'));
  }
  console.log('PASS clean/repeated build, binary bytes, stale removal, pre-clean collision checks and hidden/symlink input refusal.');

  const packaging = path.join(temporary, 'packaging');
  cpSync(path.join(ROOT, 'dist'), path.join(packaging, 'dist'), {recursive: true});
  mkdirSync(path.join(packaging, 'electron'));
  for (const file of ['build.cjs', 'assets-manifest.json', 'app-package.json', 'main.cjs', 'portable-data.cjs']) {
    copyFileSync(path.join(ROOT, 'electron', file), path.join(packaging, 'electron', file));
  }
  const {verifyAssets, stageApplication} = createRequire(import.meta.url)(path.join(packaging, 'electron/build.cjs'));
  assert.deepEqual(verifyAssets(), expected);
  const target = path.join(packaging, 'dist/index.html');
  const original = readFileSync(target);
  writeFileSync(target, 'tampered');
  assert.throws(verifyAssets, /Changed asset: index.html/);
  writeFileSync(target, original);
  writeFileSync(path.join(packaging, 'dist/extra.txt'), 'extra');
  assert.throws(verifyAssets, /file list differs/);
  rmSync(path.join(packaging, 'dist/extra.txt'));
  rmSync(target);
  assert.throws(verifyAssets, /file list differs/);
  writeFileSync(target, original);
  assert.deepEqual(readFileSync(path.join(packaging, 'electron/assets-manifest.json')), manifestBytes, 'verification must never rewrite approval');
  const staged = path.join(temporary, 'staged-app');
  mkdirSync(staged);
  stageApplication(staged, verifyAssets());
  assert.deepEqual(listFiles(staged), [...expected.map(file => 'dist/' + file), 'main.cjs', 'package.json', 'portable-data.cjs'].sort());
  for (const entry of manifest) assert.equal(sha(readFileSync(path.join(staged, 'dist', entry.path))), entry.sha256);
  assert.deepEqual(readFileSync(path.join(staged, 'main.cjs')), readFileSync(path.join(ROOT, 'electron/main.cjs')));
  assert.deepEqual(readFileSync(path.join(staged, 'portable-data.cjs')), readFileSync(path.join(ROOT, 'electron/portable-data.cjs')));
  assert.equal(JSON.parse(readFileSync(path.join(staged, 'package.json'))).main, 'main.cjs');
  console.log('PASS Electron approved-asset checks reject changed/missing/extra files without rewriting manifest; application staging preserves all bytes and app-local dist layout. No EXE built.');
} finally {rmSync(temporary, {recursive: true, force: true});}

const server = createPreviewServer();
await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  for (const entry of manifest) {
    const response = await fetch(origin + '/' + entry.path);
    assert.equal(response.status, 200, entry.path);
    assert.equal(sha(Buffer.from(await response.arrayBuffer())), entry.sha256, entry.path);
    if (/\.(m?js)$/.test(entry.path)) assert.match(response.headers.get('content-type'), /^text\/javascript/);
  }
  const index = await fetch(origin + '/');
  assert.equal(sha(Buffer.from(await index.arrayBuffer())), manifest.find(entry => entry.path === 'index.html').sha256);
  const head = await fetch(origin + '/index.html', {method: 'HEAD'});
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
  for (const forbidden of ['/src/index.html', '/electron/main.cjs', '/SOURCE_MANIFEST.json', '/Data/roster.json', '/%2e%2e%2fREADME.md', '/missing.js']) {
    assert.equal((await fetch(origin + forbidden)).status, 404, forbidden);
  }
  assert.equal((await fetch(origin + '/%broken')).status, 400);
  assert.equal((await fetch(origin + '/', {method: 'POST'})).status, 405);
  console.log(`PASS loopback preview: ${manifest.length} assets served with exact SHA-256, ESM MIME, index/HEAD, and source/private/traversal rejection.`);
} finally {await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));}
