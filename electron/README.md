# 晴窗教室 Windows 桌面构建（1.8.2）

本目录为项目根的 `electron/`（原 `desktop/`），与 `src/`、`public/` 和生成目录 `dist/` 并列。仅源码组织目录改名；成品应用的内部布局、`classroom://app` 来源与 `Data/` 数据路径不变。
上游源为 v96 / `365796b4493178fdee6cf4b68b60621d1fdef810`；应用版本 1.8.2，Electron 44.7.0。

## 构建

使用 Node.js 24.x 与 npm。在 `electron/` 中执行：

```sh
npm ci --ignore-scripts
npm run verify
npm run test:portable
# 仅在明确需要制作 Windows 成品时运行：
npm run build:win
```

`npm run verify` 先从根 `src/` + `public/` 生成 `dist/`，随后按既有清单校验。`npm run build:win` 同样先重建并校验，绝不直接打包陈旧产物；校验失败即停止，不自动更新清单。若只检查已生成的产物，可从项目根运行 `npm run verify:assets`。

首次打包需要联网下载 npm 锁定的开发依赖及 Electron 官方 Windows x64 发行包。
完成后 `out/1.8.2/SunlitClassroom-win32-x64/` 是完整便携目录，运行其中 `SunlitClassroom.exe`。
不要单独复制 exe；保留 DLL、resources、locales 及许可证文件。成品运行无需联网。
输出目录已存在时构建会停止，不覆盖。临时目录与工具缓存均位于本 electron 目录并已忽略；构建不会读写用户 AppData。

本移交快照在上游基础上删除资产中的工作区路径，并将默认示例姓名通用化，详见项目根 SNAPSHOT_NOTES.md；不是旧发布包的逐字节源。`assets-manifest.json` 锁定全部项目资源，包括用户提供、获准用于本项目的 `audio/rollcall-drum.mp3`；音频按原始字节保存，没有转码。授权用于本项目不意味着授予第三方音频开放许可证。构建不从旧运行时或隐含路径复制任何资产。
以后修改网页源时应先测试并人工审查，再有意更新受影响的资源清单条目；发布时按实际需要更新应用版本和构建常量。此次目录迁移未更改任何运行资源，`assets-manifest.json` 原字节保留。
不要把 `.openai`、`.git`、本地班级导出文件、凭据、缓存、运行时、exe、分卷或截图添加到仓库。

## 数据与安全

运行时使用程序根目录的 `Data/`；首次启动从旧 `%APPDATA%\SunlitClassroom` 安全复制并校验，旧目录保留。已有 Data 不会被其他电脑的名单覆盖。移动程序前完全退出，并复制完整目录（含 Data）。迁移失败默认停止；可保留迁移备份后重启并手动导入。详见 [便携数据说明](PORTABLE-DATA.md)。
已点进度在当前文档内存中，关闭重开或刷新清空；名单资料持久保存。网页版资料可用 Excel 导出/导入迁移。
保持原 `classroom://app` 本地协议、contextIsolation、sandbox、webSecurity；远程网络请求和外部导航被拒绝。
Excel/JSON 导出仅允许本页产生的 Blob，保存位置由用户选择。
中文朗读仅使用浏览器报告为 `localService=true` 的本机中文声音；缺少时提示，不联网替代，不安装声音包。

## 可复现与验证边界

这里的“可复现”指固定源码、资源校验和锁定构建依赖，可重新生成同版本应用；不承诺新压缩包与先前交付ZIP逐字节相同。
便携 Data 迁移为此前已合并的逻辑。本次目录重构保持 `main.cjs`、`portable-data.cjs`、应用版本、Electron 版本及依赖锁字节不变，没有生成发行包。
此前构建配置的历史检查不代表当前版本已实机验收。本次验证覆盖干净克隆安装、网页重建、全部网页回归、51 项资源 SHA-256、实际应用暂存布局和便携数据/模拟启动；未下载 Electron 运行时，未生成 EXE，未进行 Windows 或浏览器 GPU 实测。
当前无Windows实机，启动、真实保存对话框、图形性能和声音仍需在目标Windows验收。
未配置代码签名，不需付费证书。Windows可能提示未知发布者；不要关闭杀毒或绕过组织安全策略。
本源码准备不包含GitHub Actions、自动发布、远程更新或任何GitHub凭据。

第三方来源与许可见 THIRD-PARTY.md。项目自身的开源许可证应由仓库拥有者选择；本目录不擅自授予新的许可。
