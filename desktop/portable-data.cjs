'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const MARKER = 'portable-profile.json';
function directory(p) {
  const st = fs.lstatSync(p);
  if (!st.isDirectory() || st.isSymbolicLink()) throw Error('数据目录不能是链接或普通文件：' + p);
}
function probeWritable(dir) {
  directory(dir);
  const probe = path.join(dir, '.write-check-' + crypto.randomUUID());
  let fd;
  try { fd = fs.openSync(probe, 'wx', 0o600); fs.writeSync(fd, 'ok'); fs.fsyncSync(fd); }
  finally { if (fd !== undefined) { fs.closeSync(fd); fs.unlinkSync(probe); } }
}
function copyStorage(source, target) {
  directory(source); fs.mkdirSync(target);
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.name === 'LOCK') continue; // LevelDB recreates its OS lock; never transport it.
    const src = path.join(source, entry.name), dst = path.join(target, entry.name);
    if (entry.isSymbolicLink()) throw Error('旧数据包含链接，已停止迁移。');
    if (entry.isDirectory()) { copyStorage(src, dst); continue; }
    if (!entry.isFile()) throw Error('旧数据包含不支持的文件，已停止迁移。');
    const before = fs.readFileSync(src);
    fs.writeFileSync(dst, before, { flag: 'wx', mode: 0o600 });
    const fd = fs.openSync(dst, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    if (!before.equals(fs.readFileSync(dst)) || !before.equals(fs.readFileSync(src))) throw Error('旧数据在迁移中发生变化，已停止。');
  }
}
function readMarker(data) {
  const marker = path.join(data, MARKER);
  if (!fs.existsSync(marker)) throw Error('发现没有初始化标记的 Data 文件夹。为避免覆盖已有资料，已停止。请保留它并改名为备份，再重试；不要删除旧班级。');
  const value = JSON.parse(fs.readFileSync(marker, 'utf8'));
  if (value.format !== 1 || !['fresh','pending-validation','validated'].includes(value.status)) throw Error('Data 初始化标记无效，已停止以保护资料。');
  return value;
}
// Caller must hold the legacy Electron single-instance lock throughout startup.
function preparePortable({ base, legacy, recoverPending = false }) {
  let allowMigration = true;
  directory(base);
  const data = path.join(base, 'Data');
  if (fs.existsSync(data)) {
    directory(data); const marker = readMarker(data); probeWritable(data);
    if (recoverPending && marker.status === 'pending-validation') {
      // Invoked only after the user chooses recovery and the app restarts, before
      // Chromium opens any profile files. Preserve the entire failed copy.
      fs.renameSync(data, path.join(base, 'Data-recovery-' + crypto.randomUUID()));
      allowMigration = false;
    } else return { data, marker, migrated: false };
  }
  probeWritable(base);
  const stage = fs.mkdtempSync(path.join(base, '.Data-migration-'));
  try {
    const source = path.join(legacy, 'Local Storage');
    const migrated = allowMigration && fs.existsSync(source);
    if (migrated) { directory(legacy); copyStorage(source, path.join(stage, 'Local Storage')); }
    const marker = { format: 1, status: migrated ? 'pending-validation' : 'fresh', createdAt: new Date().toISOString() };
    fs.writeFileSync(path.join(stage, MARKER), JSON.stringify(marker, null, 2), { flag: 'wx', mode: 0o600 });
    // Never merge, overwrite, or reinterpret an existing destination.
    if (fs.existsSync(data)) throw Error('Data 已出现，已停止迁移，请重新启动。');
    fs.renameSync(stage, data);
    return { data, marker, migrated };
  } catch (error) {
    // Only our newly created staging directory is removed. Legacy/Data are untouched.
    fs.rmSync(stage, { recursive: true, force: true }); throw error;
  }
}
function completeMigration(profile) {
  const value = { ...profile.marker, status: 'validated', validatedAt: new Date().toISOString() };
  const pending = path.join(profile.data, MARKER + '.next');
  fs.writeFileSync(pending, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(pending, path.join(profile.data, MARKER));
  profile.marker = value;
}
module.exports = { preparePortable, completeMigration, probeWritable, copyStorage, readMarker, MARKER };
