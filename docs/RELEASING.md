# Windows 打包、预览与发布

## 下载和使用

正式版本从 [GitHub Releases](https://github.com/klfou/classroom-picker/releases) 下载 `SunlitClassroom-X.Y.Z-windows-x64.zip` 和 `SHA256SUMS.txt`。GitHub 自动附带的 “Source code” 是源码，不是可运行桌面程序。

在 PowerShell 中核对下载文件：

```powershell
Get-FileHash .\SunlitClassroom-X.Y.Z-windows-x64.zip -Algorithm SHA256
```

输出应与同次 Release 的 `SHA256SUMS.txt` 对应项完全一致。该校验可发现损坏或下载不一致，不是代码签名。完整解压后双击 `SunlitClassroom\SunlitClassroom.exe`；不要在压缩包内直接运行，不要只复制 exe。固定的 `SunlitClassroom` 目录包含 DLL、resources、locales 和第三方许可证，适合复制到 U 盘；不要将版本号加到应用目录名中作为更新机制。

当前没有代码签名，Windows 可能提示未知发布者。请核对来源与哈希，不要关闭杀毒或绕过学校/单位安全策略。程序不带安装器、在线更新器或后台联网服务。

## 数据备份与更新

分发 ZIP 不包含任何 `Data/`、AppData、真实名单或班级导出。第一次运行会使用 exe 同级 `Data/`。首次迁移旧版 Windows AppData 的逻辑保持不变，详见 [便携数据说明](../electron/PORTABLE-DATA.md)。

更新时先完全关闭程序，另行备份旧版完整目录及其 `Data/`。把新 ZIP 解压到新位置，在第一次启动前将自己的旧 `Data/` 复制到新的 `SunlitClassroom/` 中。核对名单后再决定何时清理旧副本，绝不要覆盖或删除唯一备份。移动到 U 盘也需先退出，再搬完整目录。Data 含学生姓名，只交给获授权的人；不要放进源码、CI artifact 或 Release。名单持久化，已点进度不跨刷新/重启保存。

## 如何确认网页与 EXE 是同一份代码

每个成功 Windows CI artifact / Release 包含六个文件：桌面 ZIP、`SunlitClassroom-X.Y.Z-web.zip`、两行 `SHA256SUMS.txt`、`build-manifest.json`、`smoke-report.json` 和 `RELEASE-NOTES.md`。

网页 ZIP 根就是完整静态站点，不含仓库、Electron 开发文件或 Data。它与桌面 ASAR 使用同一次构建的全部获审资源及原字节相同的 `build-info.json`。网页访问 `/version.html` 或 `/build-info.json`；桌面查看 EXE 同级 `build-info.json`。应同时比较 `version`、完整 `sourceCommit` 和 `buildId`。发行说明也明确记录这些身份及元数据哈希；只比较版本号无法区分未发版的修复提交。

构建身份取自实际 Git checkout，而不是可伪造的版本环境变量。PR CI 默认检出测试合并提交，所以它与 PR head 的 SHA 可以不同；CI 会核对来源等于实际工作流 SHA。正式发布则对应经过 tag/main 校验的提交。没有 Git 或有未提交、暂存、未跟踪修改时，网页标记为未验证本地来源，`sourceCommit` 为空，禁止打包交付。生成文件不含时间、机器路径、Git remote URL 或名单。

可靠更新顺序：先在 PR 测试 → 维护者审查合并 → 决定发版时显式推送版本 tag → 下载同一次 Release 的两个 ZIP并核对校验和 → 经授权将网页 ZIP 的全部内容部署到既有站点 → 在线核对 `/build-info.json` 与下载 EXE 的信息。GitHub 的网页附件不会自己部署到 Sites；本仓库不创建或更改 Site 身份/权限，也不自动替换用户已有 EXE。

维护者应把部署 URL、日期及其实际 `sourceCommit/buildId` 记录在交付记录里。线上站点元数据不存在或不匹配时，只能说明它尚未确认同步，不能宣称网页和 EXE 已经一致。Sites 的具体授权操作见 [部署说明](DEPLOYMENT.md)。

## 本机手动构建

使用已提交且干净的 Git 克隆，Node.js **24.19.0**（CI 精确固定；仓库引擎范围为 24.x）与 npm。所有命令从项目根开始：

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm --prefix electron ci --ignore-scripts --no-audit --no-fund
npm run build
npm run check
npm run build:sites
npm --prefix electron run build:win
# 以下 ZIP 生成步骤在 Windows 上执行，使用系统 PowerShell/.NET：
npm --prefix electron run package:win
```

产物是 `electron/out/X.Y.Z/SunlitClassroom/` 和 `electron/out/X.Y.Z/release/` 中的桌面/网页双 ZIP、SHA256SUMS、说明及构建清单。输出已存在时停止，不覆盖；需要再次构建时先把旧输出移到别处。纯构建不会读取用户 AppData。

`npm run test:windows`（位于 electron 包）是 CI 专用，拒绝普通 Windows 开发机和 self-hosted runner。不要通过伪造环境变量强行运行它；应使用下面的托管预览流程。它启动从最终 ZIP 解压的临时副本，首次检查系统实际旧 AppData 不存在，使用合成名单，正常退出后验证重启及同机目录移动。测试也核对运行中 EXE 的来源信息，不改动两个 ZIP，另写同时绑定两份 ZIP 与来源哈希的 `smoke-report.json`。不上传临时目录或 Data。

## GitHub 预览与日常 CI

- `CI`：每个 pull request 与 main push 在 Ubuntu 24.04、Windows Server 2022 执行锁定安装、构建、全部测试、源码与资源清单验证。Windows 还生成同源桌面与网页 ZIP、验证 ASAR 和网页精确文件集合及内容、启动真实 EXE；只有全部成功才上传 `windows-portable` artifact，保留 14 天。
- `Windows release or preview`：在 Actions 页面选 **Run workflow**，选待验证分支即可运行同样的检查与打包。无论手动选择的是分支还是 tag，都只生成 artifact，绝不创建 Release。新工作流需先进入默认分支，GitHub 才显示手动触发入口。
- artifact 是 GitHub 的外层下载包，解压后才是上述版本 ZIP、校验和与说明。预览需 GitHub 登录，artifact 会过期；正式下载使用 Releases。
- PR（包括 fork）用 `pull_request`，没有 `pull_request_target`，不使用发布权限或仓库 secrets。checkout 不持久保存 token；安装禁用 lifecycle scripts。构建始终从审查后的 src/public 新建 dist，不接受旧 dist。

## 维护者发布正式版本

发布是显式动作。普通提交、PR、合并和手动预览都不会发布。

1. 在独立 PR 中更新 `package.json`、`package-lock.json`、`electron/package.json`、`electron/package-lock.json` 与 `electron/app-package.json` 的应用版本，含两份锁的根 `packages[""]`。版本只能是 X.Y.Z，不接受预发布后缀。
2. 若运行资源变化，先审查和测试，再有意更新 `electron/assets-manifest.json` 对应项。常规构建不自动批准资源变更。审查并暂存所有源码后运行 `node scripts/source-manifest.mjs --write`，审查并提交源码清单。
3. 让 PR 的两种系统 CI 通过，审查并合并。选择目标 main 提交，在本地确认 `npm run check` 和 `node electron/release-config.cjs vX.Y.Z` 都通过。
4. 只有决定发布时才执行以下命令，将 X.Y.Z 和目标提交替换为实际值：

```sh
git fetch origin main --tags
git tag -a vX.Y.Z <已合并到main的提交SHA> -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

5. tag push 触发 `Windows release or preview`。它先校验 tag 与全部应用版本完全一致，并确认提交是 main 的祖先，然后重新跑双平台完整 CI 和 Windows 包/烟测。只有全部成功，最后 publish job 才取得 `contents: write`，创建正常 GitHub Release，附桌面与网页双 ZIP、SHA256SUMS、构建清单、烟测报告与说明。

发布 job 不 checkout 或运行项目代码，只读取同次工作流的已测试 artifact，用固定内联校验器严格验证双 ZIP 校验和、版本、干净源码提交、buildId、实际归档内容、版本说明及绑定同一运行的烟测报告，并在发布前再次核对 tag 没有被移动。无需添加 PAT、签名密钥或任何持久 secrets。这个 PR 不创建 tag 或 Release，也不更改仓库安全设置。

发布门禁另有 `python3 tests/release-gate.py` 合成正反例测试（Python 3 标准库，无额外依赖），Ubuntu CI 自动执行；Windows 在上传前对真实双 ZIP 再执行同一份门禁。正式 publish 不 checkout 或运行这些仓库测试，只运行工作流中固定的内联校验代码。

失败时查看具体 job 日志。修正临时服务故障后应重跑整条验证/构建/烟测流程；发布门禁校验 runId 和 runAttempt，因此仅重跑 publish 并沿用上次烟测报告会被拒绝。已存在的 Release 不会覆盖或替换附件。若已发布内容需变化，应递增版本并经新 PR 发布，不移动旧 tag。若罕见的上传中断留下不完整 Release，先人工审查当前附件状态，不假定重跑会自动修复。

## Electron、依赖与 Actions 的来源

Electron 保持 **44.7.0**。`electron/runtime-lock.json` 的 win32-x64 ZIP SHA-256 来自 [官方 Electron v44.7.0 Release](https://github.com/electron/electron/releases/tag/v44.7.0) 的 [SHA256 清单](https://github.com/electron/electron/releases/download/v44.7.0/SHASUMS256.txt)。下载与缓存复用都会核验该固定哈希，packager 只消费通过校验的本地 ZIP。缓存损坏直接失败，维护者应先查原因，再明确移走损坏缓存；不得把新哈希自动写入锁来让构建通过。

npm 依赖来自现有锁定版本；ASAR 检查器显式声明为既有的 @electron/asar 4.3.1，未升级 packager 或 Electron。运行时升级应另作审查，核对官方发布与 SHA256 清单、更新 runtime lock 并重跑所有检查。

所有 Actions 使用官方仓库的完整 commit SHA，注释标注对应稳定版本（核验日期 2026-10-14）：[checkout v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1)、[setup-node v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0)、[upload-artifact v7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2)、[download-artifact v8.0.2](https://github.com/actions/download-artifact/releases/tag/v8.0.2)。更新应通过 PR 审查官方 tag 对应 commit，不使用浮动分支或未经审查的第三方发布 Action。

固定输入、校验和与依赖意味着可重建相同版本，不承诺 EXE/ZIP 每次逐字节一致。Windows CI 的禁用 GPU 烟测不替代真实教室电脑的 GPU、中文语音、触屏、原生保存对话框或旧版迁移验收，也不等于跨电脑移动实测。项目素材的许可边界见 [素材来源](../ASSET_SOURCES.md)，流水线不扩展任何素材授权。
