import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import provenance from '../scripts/build-info.cjs';
import {buildWeb} from '../scripts/build.mjs';

const root = mkdtempSync(path.join(tmpdir(), 'sunlit-provenance-'));
try {
  mkdirSync(path.join(root, 'electron')); mkdirSync(path.join(root, 'src')); mkdirSync(path.join(root, 'public'));
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({version: '1.8.2'}));
  writeFileSync(path.join(root, 'SOURCE_MANIFEST.json'), '{"files":[]}\n');
  writeFileSync(path.join(root, 'electron/assets-manifest.json'), '[]\n');
  writeFileSync(path.join(root, 'src/index.html'), '<!doctype html>synthetic');
  writeFileSync(path.join(root, '.gitignore'), '/dist/\n/Data/\n');
  const unknown = provenance.buildInfo(root);
  assert.equal(unknown.sourceCommit, null); assert.equal(unknown.baseCommit, null); assert.equal(unknown.dirty, true);
  assert.throws(() => provenance.requireClean(unknown), /clean Git checkout/);
  const git = args => execFileSync('git', args, {cwd: root, encoding: 'utf8', stdio: 'pipe'}).trim();
  git(['init']); git(['add', '.']);
  git(['-c', 'user.name=Synthetic Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'Synthetic source']);
  const clean = provenance.buildInfo(root);
  assert.equal(clean.sourceCommit, git(['rev-parse', 'HEAD']));
  assert.equal(clean.sourceTree, git(['rev-parse', 'HEAD^{tree}']));
  assert.equal(clean.dirty, false); provenance.requireClean(clean);
  assert.deepEqual(provenance.generatedFiles(root), provenance.generatedFiles(root), 'Metadata is deterministic');
  assert.deepEqual(buildWeb(root, {metadata: true}), ['build-info.json', 'index.html', 'version.html']);
  assert.deepEqual(provenance.verifyGenerated(root), clean);
  const first = readFileSync(path.join(root, 'dist/build-info.json'));
  buildWeb(root, {metadata: true}); assert.deepEqual(readFileSync(path.join(root, 'dist/build-info.json')), first);
  for (const stage of [false, true]) {
    writeFileSync(path.join(root, 'src/index.html'), 'changed'); if (stage) git(['add', 'src/index.html']);
    const info = provenance.buildInfo(root);
    assert.equal(info.dirty, true); assert.equal(info.sourceCommit, null); assert.equal(info.sourceTree, null);
    assert.equal(info.baseCommit, clean.sourceCommit); assert.notEqual(info.buildId, clean.buildId);
    assert.throws(() => provenance.requireClean(info), /clean Git checkout/);
    assert.throws(() => provenance.verifyGenerated(root), /Stale or changed/);
    git(['restore', '--staged', '--worktree', 'src/index.html']);
  }
  writeFileSync(path.join(root, 'untracked.txt'), 'synthetic');
  assert.equal(provenance.buildInfo(root).dirty, true); rmSync(path.join(root, 'untracked.txt'));
  for (const flag of ['assume-unchanged', 'skip-worktree']) {
    git(['update-index', '--' + flag, 'src/index.html']);
    writeFileSync(path.join(root, 'src/index.html'), 'hidden changed bytes');
    assert.equal(git(['status', '--porcelain']), '', 'Fixture exercises hidden working-tree changes');
    const concealed = provenance.buildInfo(root);
    assert.equal(concealed.dirty, true); assert.equal(concealed.sourceCommit, null);
    assert.throws(() => provenance.requireClean(concealed), /clean Git checkout/);
    git(['update-index', '--no-' + flag, 'src/index.html']); git(['restore', 'src/index.html']);
  }
  mkdirSync(path.join(root, 'Data')); writeFileSync(path.join(root, 'Data/synthetic.json'), 'private synthetic fixture');
  assert.deepEqual(provenance.buildInfo(root), clean, 'Ignored data is never read or embedded');
  assert.ok(!first.includes('private synthetic fixture')); assert.ok(!first.includes(root));
  writeFileSync(path.join(root, 'public/build-info.json'), 'cannot override generated metadata');
  assert.throws(() => buildWeb(root, {metadata: true}), /Reserved generated build path/);
  assert.deepEqual(readFileSync(path.join(root, 'dist/build-info.json')), first, 'Rejected inputs preserve previous output');
} finally { rmSync(root, {recursive: true, force: true}); }
console.log('PASS build provenance: exact Git commit/tree, deterministic metadata, dirty/staged/untracked/no-Git refusal, reserved paths, no data/path leakage.');
