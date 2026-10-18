'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {validateConfig} = require('./release-config.cjs');
const {verifyPackage} = require('./verify-package.cjs');
const assert = require('node:assert/strict');
const {verifyAssets} = require('./build.cjs');
const provenance = require('../scripts/build-info.cjs');
const REPO = path.resolve(__dirname, '..');
async function fileHash(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function run() {
  if (process.platform !== 'win32') throw Error('ZIP packaging requires Windows PowerShell/.NET; use the Windows Actions runner');
  const {version} = validateConfig();
  const folder = path.join(__dirname, 'out', version, 'SunlitClassroom');
  await verifyPackage(folder);
  const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'build-manifest.json')));
  const info = provenance.requireClean(provenance.verifyGenerated(REPO));
  assert.deepEqual(info, manifest.buildInfo, 'Web and desktop build identity differs');
  const webFiles = verifyAssets().map(name => {
    const bytes = fs.readFileSync(path.join(REPO, 'dist', name));
    return {path: name, size: bytes.length, sha256: provenance.sha256(bytes)};
  });
  assert.deepEqual(webFiles, manifest.webFiles, 'Web and desktop runtime bytes differ');
  const output = path.join(__dirname, 'out', version, 'release');
  fs.mkdirSync(output); // No overwrite/reuse of a previous release directory.
  const name = `SunlitClassroom-${version}-windows-x64.zip`;
  const archive = path.join(output, name);
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', path.join(__dirname, 'zip-portable.ps1'), '-Source', folder, '-Destination', archive], {stdio: 'inherit'});
  const webName = `SunlitClassroom-${version}-web.zip`;
  const webArchive = path.join(output, webName);
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', path.join(__dirname, 'zip-web.ps1'), '-Source', path.join(REPO, 'dist'), '-Destination', webArchive, '-Manifest', path.join(folder, 'build-manifest.json')], {stdio: 'inherit'});
  fs.writeFileSync(path.join(output, 'SHA256SUMS.txt'), `${await fileHash(archive)}  ${name}\n${await fileHash(webArchive)}  ${webName}\n`);
  fs.copyFileSync(path.join(folder, 'build-manifest.json'), path.join(output, 'build-manifest.json'));
  fs.writeFileSync(path.join(output, 'RELEASE-NOTES.md'), `# 晴窗教室 ${version}\n\n下载并完整解压 ${name}，运行 SunlitClassroom/SunlitClassroom.exe。请勿单独移动 exe；保留 DLL、resources、locales 与许可证。\n\nWindows x64 便携版，无安装器，无自动更新。压缩包不含 Data 或真实班级资料。首次运行会在程序同级创建 Data；首次旧版迁移仍按 PORTABLE-DATA.md 进行。\n\n更新前完全退出程序，将旧版完整目录及 Data 另行备份。在新的解压目录首次启动前，复制自己的 Data；不要覆盖或删除唯一备份。Data 含名单，只交给获授权的人。程序目录始终叫 SunlitClassroom，适合移动到 U 盘。\n\n程序未代码签名，Windows 可能提示未知发布者。只从本仓库 Release 下载并核对 SHA256SUMS.txt，不要关闭杀毒或绕过单位安全策略。\n\nGitHub 托管 Windows runner 验证的是启动、离线页面及合成存储重启/目录移动；不代表目标教室电脑的 GPU、中文声音、触屏或保存对话框已验收。\n\n构建来源和运行时 SHA-256 见 build-manifest.json。该清单的 windowsRunVerified 字段保持 false；真实烟测结果见绑定本 ZIP SHA-256 的 smoke-report.json 和对应 Actions 运行日志。\n`);
  fs.appendFileSync(path.join(output, 'RELEASE-NOTES.md'), `\n## 同源网页与桌面构建\n\nSource commit: ${info.sourceCommit}\nBuild ID: ${info.buildId}\nBuild info SHA-256: ${provenance.sha256(fs.readFileSync(path.join(folder, 'build-info.json')))}\nWeb archive: ${webName}\n\n网页 ZIP 根目录就是完整静态站点；网页 version.html、build-info.json 与 EXE 同级 build-info.json 使用同一身份。只部署同次交付的网页 ZIP，不重新从另一个分支拼装。此附件没有自动部署到 Sites，也不会自动更新旧 EXE；发布说明仅确认本次下载的代码来源，不代表现有线上站点已经更新。\n`);
  console.log('Release files: ' + output);
}
if (require.main === module) run().catch(error => {console.error(error); process.exitCode = 1;});
