'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const GENERATED = Object.freeze(['build-info.json', 'version.html']);
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';

function buildInfo(root) {
  const git = args => execFileSync('git', args, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
  // No environment-variable override, remote URL, local path, timestamp or user data.
  let baseCommit = null, tree = null, dirty = true;
  try {
    assert.equal(fs.realpathSync(git(['rev-parse', '--show-toplevel'])), fs.realpathSync(root), 'Build root must be the Git checkout root');
    baseCommit = git(['rev-parse', 'HEAD']); tree = git(['rev-parse', 'HEAD^{tree}']);
    assert.match(baseCommit, /^[a-f0-9]{40}$/); assert.match(tree, /^[a-f0-9]{40}$/);
    dirty = git(['status', '--porcelain', '--untracked-files=normal']) !== '';
    // These index flags can conceal modified tracked files from git status.
    // Refuse delivery even when a flagged file happens to be unchanged.
    dirty ||= git(['ls-files', '-v', '-z']).split('\0').some(entry => /^[a-zS] /.test(entry));
  } catch { baseCommit = null; tree = null; dirty = true; } // Source archives remain usable, but never release-identifiable.
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version;
  assert.match(version, /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$(?![\s\S])/);
  const info = {format: 1, version, sourceCommit: dirty ? null : baseCommit,
    sourceTree: dirty ? null : tree, baseCommit, dirty,
    assetManifestSha256: sha256(fs.readFileSync(path.join(root, 'electron/assets-manifest.json'))),
    sourceManifestSha256: sha256(fs.readFileSync(path.join(root, 'SOURCE_MANIFEST.json')))};
  return {...info, buildId: sha256(json(info))};
}
function requireClean(info) {
  assert.equal(info.dirty, false, 'Delivery requires a clean Git checkout; commit reviewed changes first');
  assert.match(info.sourceCommit || '', /^[a-f0-9]{40}$/, 'Delivery requires an exact source commit');
  return info;
}
function versionPage(info) {
  // All inserted values have a constrained shape; this page is static and offline.
  return `<!doctype html>\n<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>晴窗教室 · 版本信息</title><style>body{font:16px/1.7 system-ui,sans-serif;max-width:760px;margin:3rem auto;padding:0 1rem;color:#26332d;background:#faf9f5}dt{font-weight:700;margin-top:1rem}dd{margin:0;overflow-wrap:anywhere}a{color:#275e48}</style><h1>晴窗教室 ${info.version}</h1><p>${info.dirty ? '本地未提交或无 Git 来源构建：不能当作正式版本或单一提交的发布产物。' : '此页面与同次桌面包使用相同的代码来源。'}</p><dl><dt>源码提交</dt><dd>${info.sourceCommit || '未提交修改（来源不可归为单一提交）'}</dd><dt>工作区基线</dt><dd>${info.baseCommit || '无 Git 来源'}</dd><dt>构建标识</dt><dd>${info.buildId}</dd><dt>资源清单 SHA-256</dt><dd>${info.assetManifestSha256}</dd></dl><p>比较版本号还不够：请同时比较源码提交和构建标识。网页部署不会自动更新已下载的 EXE。</p><p><a href="./build-info.json">完整构建信息</a> · <a href="./">返回教室</a> · <a href="./orbit-preview/">独立预览</a></p></html>\n`;
}
function generatedFiles(root) {
  const info = buildInfo(root);
  return {'build-info.json': Buffer.from(json(info)), 'version.html': Buffer.from(versionPage(info))};
}
function writeGenerated(root) {
  for (const [name, bytes] of Object.entries(generatedFiles(root))) fs.writeFileSync(path.join(root, 'dist', name), bytes);
}
function verifyGenerated(root, read = name => fs.readFileSync(path.join(root, 'dist', name))) {
  for (const [name, bytes] of Object.entries(generatedFiles(root))) assert.deepEqual(read(name), bytes, 'Stale or changed generated provenance: ' + name);
  return JSON.parse(read('build-info.json'));
}
module.exports = {GENERATED, buildInfo, requireClean, generatedFiles, writeGenerated, verifyGenerated, sha256};
