'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(ROOT, name), 'utf8'));
function validateConfig(root = ROOT, tag) {
  const json = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
  const app = json('electron/app-package.json');
  assert.match(app.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$(?![\s\S])/, 'Use an exact X.Y.Z application version');
  for (const name of ['package.json', 'electron/package.json']) assert.equal(json(name).version, app.version, name + ' version mismatch');
  for (const name of ['package-lock.json', 'electron/package-lock.json']) {
    const lock = json(name);
    assert.equal(lock.version, app.version, name + ' version mismatch');
    assert.equal(lock.packages[''].version, app.version, name + ' root version mismatch');
  }
  assert.equal(app.main, 'main.cjs');
  const runtime = json('electron/runtime-lock.json');
  assert.match(runtime.version, /^\d+\.\d+\.\d+$(?![\s\S])/);
  assert.equal(runtime.platform, 'win32'); assert.equal(runtime.arch, 'x64');
  assert.equal(runtime.filename, `electron-v${runtime.version}-win32-x64.zip`);
  assert.equal(runtime.source, `https://github.com/electron/electron/releases/download/v${runtime.version}/${runtime.filename}`);
  assert.match(runtime.sha256, /^[a-f0-9]{64}$(?![\s\S])/);
  if (tag !== undefined) assert.equal(tag, 'v' + app.version, 'Release tag must exactly match package versions');
  return { version: app.version, runtime };
}
module.exports = { ROOT, read, validateConfig };
if (require.main === module) {
  const {version, runtime} = validateConfig(ROOT, process.argv[2]);
  console.log(`Validated application ${version}, Electron ${runtime.version}, Windows x64${process.argv[2] ? ', tag ' + process.argv[2] : ''}.`);
}
