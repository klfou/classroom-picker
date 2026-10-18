# 晴窗教室 Windows 桌面构建（1.8.2）

本目录为项目根的 `electron/`（原 `desktop/`），与 `src/`、`public/` 和生成目录 `dist/` 并列。仅源码组织目录改名；成品应用的内部布局、`classroom://app` 来源与 `Data/` 数据路径不变。
上游源为 v96 / `365796b4493178fdee6cf4b68b60621d1fdef810`；应用版本 1.8.2，Electron 44.7.0。

## 构建

使用 Node.js 24.19.0 与 npm（CI 固定此 Node 版本）。在 `electron/` 中执行：

```sh
npm ci --ignore-scripts
npm run verify
npm run test:portable
# 仅在明确需要制作 Windows 成品时运行：
npm run build:win
# 在 Windows 上将完整目录压成便携 ZIP：
npm run package:win
```

`npm run verify` 先从根 `src/` + `public/` 生成 `dist/`，随后按既有清单校验。`npm run build:win` 同样先重建并校验，绝不直接打包陈旧产物；校验失败即停止，不自动更新清单。若只检查已生成的产物，可从项目根运行 `npm run verify:assets`。

首次打包需要联网下载 npm 锁定的开发依赖及 Electron 官方 Windows x64 发行包。`runtime-lock.json` 固定 Electron 44.7.0 和官方 ZIP 的 SHA-256；下载及缓存命中都验证，之后 packager 仅消费已核验 ZIP，不使用自定义镜像或浮动版本。版本不符或缓存损坏会停止。
完成后 `out/1.8.2/SunlitClassroom/` 是完整便携目录，运行其中 `SunlitClassroom.exe`。
不要单独复制 exe；保留 DLL、resources、locales 及许可证文件。成品运行无需联网。
输出目录已存在时构建会停止，不覆盖。临时目录与工具缓存均位于本 electron 目录并已忽略；构建不会读写用户 AppData。

本移交快照在上游基础上删除资产中的工作区路径，并将默认示例姓名通用化，详见项目根 SNAPSHOT_NOTES.md；不是旧发布包的逐字节源。`assets-manifest.json` 锁定全部项目资源，包括用户提供、获准用于本项目的 `audio/rollcall-drum.mp3`；音频按原始字节保存，没有转码。授权用于本项目不意味着授予第三方音频开放许可证。构建不从旧运行时或隐含路径复制任何资产。
以后修改网页源时应先测试并人工审查，再有意更新受影响的资源清单条目；发布时按 [发布指南](../docs/RELEASING.md) 同步所有应用版本；Electron 运行时只有经过明确审查才能修改其独立锁。此次目录迁移未更改任何运行资源，`assets-manifest.json` 原字节保留。
不要把 `.openai`、`.git`、本地班级导出文件、凭据、缓存、运行时、exe、分卷或截图添加到仓库。

## 数据与安全

运行时使用程序根目录的 `Data/`；首次启动从旧 `%APPDATA%\SunlitClassroom` 安全复制并校验，旧目录保留。已有 Data 不会被其他电脑的名单覆盖。移动程序前完全退出，并复制完整目录（含 Data）。迁移失败默认停止；可保留迁移备份后重启并手动导入。详见 [便携数据说明](PORTABLE-DATA.md)。
已点进度在当前文档内存中，关闭重开或刷新清空；名单资料持久保存。网页版资料可用 Excel 导出/导入迁移。
保持原 `classroom://app` 本地协议、contextIsolation、sandbox、webSecurity；远程网络请求和外部导航被拒绝。
Excel/JSON 导出仅允许本页产生的 Blob，保存位置由用户选择。
中文朗读仅使用浏览器报告为 `localService=true` 的本机中文声音；缺少时提示，不联网替代，不安装声音包。

## 可复现与验证边界

这里的“可复现”指固定源码、资源校验和锁定构建依赖，可重新生成同版本应用；不承诺新压缩包与先前交付ZIP逐字节相同。
便携 Data 迁移为此前已合并的逻辑；本次流水线未修改 `main.cjs` 或 `portable-data.cjs`，不加入远程更新器。
CI 在 Ubuntu 与 Windows 重建网页、运行全部回归、核验资源/源码清单；Windows runner 另构建 ZIP、解压独立测试副本，启动真实 EXE，以合成名单验证应用保存、重启及同机移动整个目录。
真实 EXE 烟测仅允许 GitHub 托管的一次性 Windows VM，拒绝普通开发机和 self-hosted runner。启动前检查 Windows 系统实际 AppData 下没有旧 SunlitClassroom 资料；不把 APPDATA 环境变量改写当作隔离。测试资料只写临时解压副本，不写待发布目录，不上传 Data。
构建清单中 `windowsRunVerified: false` 表示单独构建并不证明运行；测试后不重写 ZIP。`smoke-report.json` 绑定原 ZIP SHA-256，记录是否通过真实运行测试，具体以同一提交的 Actions 日志为准。
自动烟测使用禁用 GPU 的运行参数，不代表目标电脑 GPU、声音、触摸、原生保存对话框、旧版资料迁移或不同电脑之间移动已经实机验收；这些仍须在目标 Windows 上验证。
未配置代码签名，不需付费证书。Windows 可能提示未知发布者；不要关闭杀毒或绕过组织安全策略。
GitHub Actions 的 PR/main CI 和手动预览只有 `contents: read`，不需要另加凭据。只有严格版本 tag 的发布 job 使用短期 `GITHUB_TOKEN` 的 `contents: write`。完整构建、下载、发布、备份步骤见 [打包与发布指南](../docs/RELEASING.md)。

第三方来源与许可见 THIRD-PARTY.md。项目自身的开源许可证应由仓库拥有者选择；本目录不擅自授予新的许可。

## 同源版本识别

交付打包要求干净 Git 克隆。每次构建在网页与 ASAR 中嵌入相同的 `build-info.json` 和静态 `version.html`，EXE 同级另放同一份 `build-info.json`。CI 同次生成桌面和网页双 ZIP，发布说明记录完整提交和 buildId，校验不一致即拒绝发布。网页查看 `/version.html`，桌面查看 EXE 同级 JSON；同版本号不代表同一修复提交。网页附件不会自动部署到 Sites，旧 EXE 也不会自动更新。详见 [发布指南](../docs/RELEASING.md)。
