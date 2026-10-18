'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {Readable} = require('node:stream');
const {pipeline} = require('node:stream/promises');
const {validateConfig} = require('./release-config.cjs');
async function verifyRuntime(file, runtime) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw Error('Runtime archive must be a regular file');
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  if (hash.digest('hex') !== runtime.sha256) throw Error('Electron runtime SHA-256 mismatch; refusing to package');
}
async function downloadRuntime(runtime = validateConfig().runtime, cache = path.join(__dirname, '.cache', 'verified-electron')) {
  fs.mkdirSync(cache, {recursive: true});
  const file = path.join(cache, runtime.filename);
  // A corrupt cache is an error, never silently trusted or approved again.
  if (fs.existsSync(file)) { await verifyRuntime(file, runtime); return cache; }
  const temporary = file + '.' + crypto.randomUUID() + '.partial';
  try {
    const response = await fetch(runtime.source, {signal: AbortSignal.timeout(300000)});
    if (!response.ok || !response.body) throw Error('Official Electron download failed: HTTP ' + response.status);
    const final = new URL(response.url);
    if (final.protocol !== 'https:' || !['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(final.hostname)) throw Error('Unexpected Electron download destination');
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(temporary, {flags: 'wx'}));
    await verifyRuntime(temporary, runtime);
    fs.renameSync(temporary, file);
    return cache;
  } finally { fs.rmSync(temporary, {force: true}); }
}
module.exports = {verifyRuntime, downloadRuntime};
