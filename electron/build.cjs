'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = __dirname;
const WEB = path.resolve(ROOT, '../dist');
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'app-package.json'))).version;
function files(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (e.isSymbolicLink()) throw new Error('Symbolic links are not packaged: ' + prefix + e.name);
    if (e.isDirectory()) return files(path.join(dir, e.name), prefix + e.name + '/');
    if (!e.isFile()) throw new Error('Not a regular asset: ' + prefix + e.name);
    return [prefix + e.name];
  }).sort();
}
function verifyAssets() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets-manifest.json')));
  const expected = manifest.map(x => x.path).sort();
  const actual = files(WEB);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('dist file list differs from the approved sanitized-source manifest. Review changes before updating the manifest.');
  for (const entry of manifest) {
    const bytes = fs.readFileSync(path.join(WEB, entry.path));
    if (bytes.length !== entry.size || sha(bytes) !== entry.sha256) throw new Error('Changed asset: ' + entry.path);
  }
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app-package.json')));
  if (app.version !== VERSION || app.main !== 'main.cjs') throw new Error('Unexpected application version/main');
  return actual;
}
function stageApplication(work, actual) {
  for (const relative of actual) {
    const destination = path.join(work, 'dist', relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(WEB, relative), destination);
  }
  for (const file of ['main.cjs', 'portable-data.cjs']) fs.copyFileSync(path.join(ROOT, file), path.join(work, file));
  fs.copyFileSync(path.join(ROOT, 'app-package.json'), path.join(work, 'package.json'));
}
async function run() {
  const {runtime} = require('./release-config.cjs').validateConfig();
  const ELECTRON = runtime.version;
  // Packaging always consumes a fresh build. Verification alone checks existing output.
  if (!process.argv.includes('--verify-only')) (await import('../scripts/build.mjs')).buildWeb();
  const actual = verifyAssets();
  console.log('Verified ' + actual.length + ' sanitized-source assets; desktop ' + VERSION);
  if (process.argv.includes('--verify-only')) return;
  const output = path.join(ROOT, 'out', VERSION);
  if (fs.existsSync(output)) throw new Error('Output already exists: ' + output + '. Move it away before rebuilding. Nothing was overwritten.');
  const workRoot = path.join(ROOT, '.build');
  fs.mkdirSync(workRoot, { recursive: true });
  const work = fs.mkdtempSync(path.join(workRoot, 'stage-'));
  try {
    stageApplication(work, actual);
    const electronZipDir = await require('./download-runtime.cjs').downloadRuntime(runtime);
    const module = await import('@electron/packager');
    const packager = module.default || module.packager;
    const results = await packager({ dir: work, out: output, name: 'SunlitClassroom',
      executableName: 'SunlitClassroom', platform: 'win32', arch: 'x64',
      electronVersion: ELECTRON, appVersion: VERSION, asar: true,
      overwrite: false, prune: false, electronZipDir });
    if (results.length !== 1) throw new Error('Expected exactly one Windows x64 package');
    for (const result of results) {
      const folder = path.join(output, 'SunlitClassroom');
      fs.renameSync(result, folder);
      const exe = fs.readFileSync(path.join(folder, 'SunlitClassroom.exe'));
      const pe = exe.readUInt32LE(0x3c);
      if (exe.toString('ascii', pe, pe + 4) !== 'PE\0\0' || exe.readUInt16LE(pe + 4) !== 0x8664) throw new Error('Expected Windows x64 PE');
      fs.copyFileSync(path.join(ROOT, 'README.md'), path.join(folder, 'BUILD-README.md'));
      fs.copyFileSync(path.join(ROOT, 'THIRD-PARTY.md'), path.join(folder, 'THIRD-PARTY.md'));
      fs.copyFileSync(path.join(ROOT, 'PORTABLE-DATA.md'), path.join(folder, 'PORTABLE-DATA.md'));
      const packageEntries = files(folder).map(name => {
        const bytes = fs.readFileSync(path.join(folder, name));
        return {path: name, size: bytes.length, sha256: sha(bytes)};
      });
      const asar = fs.readFileSync(path.join(folder, 'resources/app.asar'));
      fs.writeFileSync(path.join(folder, 'build-manifest.json'), JSON.stringify({ version: VERSION, electron: ELECTRON,
        sourceCommit: require('node:child_process').execFileSync('git', ['rev-parse', 'HEAD'], {cwd: ROOT, encoding: 'utf8'}).trim(),
        runtimeArchiveSha256: runtime.sha256, runtimeSource: runtime.source,
        assetManifestSha256: sha(fs.readFileSync(path.join(ROOT, 'assets-manifest.json'))), assetCount: actual.length,
        asarSha256: sha(asar), exeSha256: sha(exe), files: packageEntries, signed: false, windowsRunVerified: false }, null, 2));
      await require('./verify-package.cjs').verifyPackage(folder);
      console.log('Built: ' + folder);
    }
  } finally { fs.rmSync(work, { recursive: true, force: true }); }
}
module.exports = { verifyAssets, stageApplication };
if (require.main === module) run().catch(error => { console.error(error.message); process.exitCode = 1; });
