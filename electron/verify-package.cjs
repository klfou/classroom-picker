'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {validateConfig, read} = require('./release-config.cjs');
const provenance = require('../scripts/build-info.cjs');
const REPO = path.resolve(__dirname, '..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function packageFiles(root, prefix = '') {
  return fs.readdirSync(root, {withFileTypes: true}).flatMap(entry => {
    const relative = prefix + entry.name;
    assert.ok(!entry.isSymbolicLink(), 'No package symlinks: ' + relative);
    assert.ok(!/^(?:data(?:-recovery-.*)?|appdata|userdata|local storage|node_modules|\.git|\.env.*|\.data-migration-.*)$/i.test(entry.name), 'Private/build directory in package: ' + relative);
    assert.ok(!/\.(?:xlsx|csv)$/i.test(entry.name) && !/^sunlit-(?:classes|backup)-.*\.json$/i.test(entry.name), 'Class export in package: ' + relative);
    if (entry.isDirectory()) return packageFiles(path.join(root, entry.name), relative + '/');
    assert.ok(entry.isFile(), 'Only regular package files: ' + relative);
    return [relative];
  }).sort();
}
async function verifyPackage(folder) {
  const {version, runtime} = validateConfig();
  const all = packageFiles(folder);
  for (const name of ['SunlitClassroom.exe', 'resources/app.asar', 'LICENSE', 'LICENSES.chromium.html', 'icudtl.dat', 'build-manifest.json', 'BUILD-README.md', 'THIRD-PARTY.md', 'PORTABLE-DATA.md']) assert.ok(all.includes(name), 'Missing runtime file: ' + name);
  assert.ok(all.some(name => name.startsWith('locales/')), 'Missing Electron locales');
  assert.ok(!all.includes('resources/default_app.asar'), 'Do not ship Electron default application');
  const exe = fs.readFileSync(path.join(folder, 'SunlitClassroom.exe'));
  assert.equal(exe.toString('ascii', 0, 2), 'MZ');
  const pe = exe.readUInt32LE(0x3c);
  assert.equal(exe.toString('ascii', pe, pe + 4), 'PE\0\0'); assert.equal(exe.readUInt16LE(pe + 4), 0x8664);
  const archive = path.join(folder, 'resources/app.asar');
  const asar = await import('@electron/asar');
  // ASAR's API traverses with path.sep, so use native paths for reads and
  // POSIX paths only for comparison with the platform-independent manifest.
  const actual = asar.listPackage(archive).map(name => name.replaceAll('\\', '/').replace(/^\//, '')).filter(name => !asar.statFile(archive, path.normalize(name)).files).sort();
  const assets = read('electron/assets-manifest.json');
  assert.deepEqual(actual, [...assets.map(entry => 'dist/' + entry.path), ...provenance.GENERATED.map(name => 'dist/' + name), 'main.cjs', 'portable-data.cjs', 'package.json'].sort(), 'ASAR must contain only approved application files and exact generated provenance');
  const info = provenance.requireClean(provenance.verifyGenerated(REPO, name => asar.extractFile(archive, path.join('dist', name))));
  assert.deepEqual(fs.readFileSync(path.join(folder, 'build-info.json')), asar.extractFile(archive, path.join('dist', 'build-info.json')));
  for (const entry of assets) {
    const bytes = asar.extractFile(archive, path.join('dist', ...entry.path.split('/')));
    assert.equal(bytes.length, entry.size); assert.equal(sha(bytes), entry.sha256, entry.path);
  }
  for (const [inside, source] of [['main.cjs', 'main.cjs'], ['portable-data.cjs', 'portable-data.cjs']]) assert.deepEqual(asar.extractFile(archive, inside), fs.readFileSync(path.join(__dirname, source)), inside + ' changed while packaging');
  // @electron/packager removes development-only metadata (private). Everything
  // else must exactly match the approved application package; no dependency injection.
  const expectedPackage = read('electron/app-package.json');
  delete expectedPackage.private;
  assert.deepEqual(JSON.parse(asar.extractFile(archive, 'package.json').toString('utf8')), expectedPackage, 'Packaged application metadata differs');
  const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'build-manifest.json')));
  assert.deepEqual(manifest.buildInfo, info); assert.equal(manifest.sourceCommit, info.sourceCommit);
  const webFiles = [...assets.map(entry => entry.path), ...provenance.GENERATED].sort().map(name => {
    const bytes = asar.extractFile(archive, path.join('dist', ...name.split('/')));
    return {path: name, size: bytes.length, sha256: sha(bytes)};
  });
  assert.deepEqual(manifest.webFiles, webFiles, 'Desktop/web provenance and runtime bytes must match');
  const recorded = all.filter(name => name !== 'build-manifest.json').map(name => {
    const bytes = fs.readFileSync(path.join(folder, name));
    return {path: name, size: bytes.length, sha256: sha(bytes)};
  });
  assert.deepEqual(recorded, manifest.files, 'Package files differ from the clean build manifest (extra, missing or changed file)');
  assert.equal(manifest.version, version); assert.equal(manifest.electron, runtime.version);
  assert.equal(manifest.runtimeArchiveSha256, runtime.sha256);
  assert.equal(manifest.asarSha256, sha(fs.readFileSync(archive)));
  assert.equal(manifest.exeSha256, sha(exe)); assert.equal(manifest.signed, false);
  console.log(`Verified portable package: ${all.length} files, ${assets.length} approved assets, no Data or class exports.`);
  return all;
}
module.exports = {packageFiles, verifyPackage};
if (require.main === module) verifyPackage(process.argv[2]).catch(error => { console.error(error); process.exitCode = 1; });
