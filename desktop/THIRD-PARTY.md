# 第三方来源

- Electron 44.7.0：官方 https://github.com/electron/electron/releases/tag/v44.7.0 ，运行时采用MIT及随包Chromium等第三方许可。成品必须保留 `LICENSE`、`LICENSES.chromium.html` 与原发行包其他必要文件。
- Electron Packager：官方 https://github.com/electron/packager ，BSD-2-Clause；仅构建依赖，精确版本与传递依赖锁定在 package-lock.json，由npm官方registry获取。
- 项目鼓声：用户提供的 `audio/rollcall-drum.mp3`，经用户授权用于本项目，按原字节保留；不据此推定第三方获得开放许可。
- 网页静态依赖和模型按根 `dist/` 内原资源及许可证一并打包。包括 Three.js/OrbitControls（MIT）、SheetJS（Apache-2.0）、fflate（MIT）、音频来源说明、字体/字形及模型来源说明（以各原始许可文件为准）。

不要删除或覆盖dist内LICENSE、NOTICE及来源说明。缺少某个资产的许可依据时，不应将“可运行”视为获得再分发或公开开源授权；发布前由拥有者确认各资产适用范围。
