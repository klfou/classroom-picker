# 晴窗教室

三个共享名单的点名主题：晴窗教室、星空卡片、翻牌点名；带 1–10 分钟背书倒计时（默认 2 分钟，下拉框选择）。

本仓库从网页 v96 的独立源码快照开始，初始上游提交为 `365796b4493178fdee6cf4b68b60621d1fdef810`；后续变更以本仓库 Git 历史为准。不含原托管仓库历史、托管身份配置、真实学生名单、用户截图或桌面运行时。

## 场景预览

以下六张图片使用本次源码的原生 Canvas / 软件渲染路径生成，展示演示名单下的点名与倒计时场景。它们不是浏览器整页截图，不包含底部操作栏，也不代表浏览器 GPU 或触摸布局验收。倒计时标题已移除；三主题主数字按相同实际可见字高适度放大并上移，“时间到”也采用统一的可见字高。各主题保留自己的材质，纸牌保留完整双边框。

### 晴窗教室

点名场景：

![晴窗教室点名原生场景预览](docs/images/classroom-pick.png)

倒计时场景：

![晴窗教室倒计时原生场景预览](docs/images/classroom-countdown.png)

### 星空卡片

点名场景：

![星空卡片点名原生场景预览](docs/images/space-pick.png)

倒计时场景：

![星空卡片倒计时原生场景预览](docs/images/space-countdown.png)

### 翻牌点名

点名场景：

![翻牌点名原生场景预览](docs/images/paper-pick.png)

倒计时场景：

![翻牌倒计时原生场景预览](docs/images/paper-countdown.png)

班级与座位编辑器属于浏览器 DOM 界面，本次未取得可验证的浏览器截图，未以模拟图替代。可运行网页后点击“班级与座位”查看。

## 运行网页

使用 Node.js 24.x 与 npm。网页仍为原生 HTML / CSS / JavaScript ES modules，没有引入框架、打包器或转译器。`src/` 保存可编辑页面代码，`public/` 保存模型、音效、离线 vendor 和许可证；构建将两者原字节复制到 `dist/`，另生成 `build-info.json` 和静态 `version.html` 记录版本与来源。运行时依赖已随包提供，根项目没有 npm 依赖。

从干净克隆开始，在项目根目录执行：

```sh
npm ci --ignore-scripts
npm run build
npm run serve
```

打开 `http://127.0.0.1:8000`。`serve` 会先重新构建，只监听本机回环地址；可用 `npm run serve -- --port 8080` 修改端口。修改源码后重新启动服务或运行 `npm run build` 刷新输出，不带热更新。不要直接双击 HTML：ES modules 和模型读取需要 HTTP 服务。

也可在构建后使用 Python 3：

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

`dist/` 是可删除、可重建、已 gitignore 的纯生成目录。不要在其中编辑源码或提交生成文件。静态服务器与 Sites 都只消费构建后的 `dist/`，无需数据库或服务端 API；见 [部署说明](docs/DEPLOYMENT.md)。目录重构没有更改运行时 URL、模型、动画、声音或本地存储键。

本仓库包含用户提供并授权用于本项目的点名音频；原始字节保留。详情见 `ASSET_SOURCES.md`。

## 验证

测试使用 Node 内置模块、随包 Three.js 和确定性 DOM/时钟/声音夹具，无外部测试依赖。

```sh
npm run check
```

`check` 顺序执行：

- `npm test`：先构建并校验 83 个运行资源（51 个原站资源和 32 个独立预览资源），另严格校验两份生成的来源信息，再运行全部网页回归与构建/本地服务/Electron 暂存测试。测试继续读取实际 `dist/`，覆盖最终交付文件。直接运行单个 `tests/*.mjs` 前需先 `npm run build`。
- `npm run test:portable`：便携 Data 的合成文件系统与模拟启动检查。
- `npm run verify:release`：检查应用版本、两份 npm 锁和固定 Electron 运行时配置一致。
- `npm run verify:sources`：用 Git 跟踪文件逐项核验 `SOURCE_MANIFEST.json`（因此需 Git 克隆或工作树）。

单独校验当前构建产物可运行 `npm run verify:assets`；它会拒绝文件缺失、多余、大小或 SHA-256 不符，不会生成或改写资源清单。`node scripts/test.mjs` 仍可直接使用，会自动先构建。

这些测试覆盖状态、计时、随机候选、数据往返、模型投影与渲染结构，不能替代 Windows / 浏览器 GPU、音频设备和触摸屏实测。CI 在 Ubuntu 和 Windows 上运行全部检查；Windows 额外制作同源的完整便携 ZIP 与网页 ZIP，并启动真实 EXE，以合成数据验证保存、重启和同机目录移动。PR 只产生预览 artifact，手动构建也不发布；正式版本 tag 才进入 GitHub Release 发布路径。详见 [打包与发布指南](docs/RELEASING.md)。

### 清单维护

`electron/assets-manifest.json` 是部署根相对路径的获审资源清单。清单包含 51 项原站资源和 32 项独立预览资源。本次核心点名动画修复仅更新原站 `paper-cards.js` 与 `space-card-model.js` 的大小和 SHA-256，其余原站资源及独立预览资源保持不变；独立预览的原站保护基线同步记录这两项获审变更。不要因校验失败直接重新生成它；先审查源码/素材变化并完成回归，再有意更新受影响条目。构建与测试不会自动批准新资源。

`SOURCE_MANIFEST.json` 记录当前跟踪源码（排除清单自身与生成输出）。审查修改并暂存所有预期文件后，显式运行以下命令更新它，再审查清单差异：

```sh
git add <已审查的文件路径>
node scripts/source-manifest.mjs --write
git add SOURCE_MANIFEST.json
npm run check
```

`.gitattributes` 禁止自动换行转换，使 Windows 克隆也保留清单所校验的原始字节。源码包不含 Git 时仍可构建、运行网页和校验运行资源，但来源信息明确标记为不可归属单一提交；源码清单的跟踪集合校验和可交付桌面包要求真实 Git 克隆。只有干净工作树可打包交付。网页访问 `/version.html`，桌面查看 EXE 同级 `build-info.json`；同时比较版本、源码提交和 buildId，不能只看版本号。网页更新不会自动替换旧 EXE。

## 数据与行为

- 班级、姓名、座位及偏好保存在浏览器本机 localStorage，不上传名单。
- 已点集合仅存在本次文档会话，各班独立；刷新/重开清空已点集合，切主题或重复模式不会清空。
- 不重复模式耗尽后提示停止；允许重复期间也记录已点集合。
- 编辑器与新版 Excel 导出均采用老师视角：后排在上，第一排及讲台在下，左右按老师所见。座位 row/col 与学生身份不变；新版网页仍可导入旧 v1/v2 Excel。新版 v3 Excel 请用新版网页导入，旧版程序会安全拒绝，避免读反座位。
- 空班主按钮显示“添加学生”，直接打开当前班级座位编辑器；保存成功会显示班级名与已保存人数。
- 教室抽取 1 秒，星空完整旋转 1 秒（总过程 1.75 秒），翻牌单次翻开 0.6 秒。倒计时依实际时间戳推进。
- 核心点名效果在系统“减少动态效果”开启或关闭时均完整播放，不新增开关。星空待机与流星、界面 CSS 过渡及倒计时镜头仍遵循系统偏好。若首个动画帧因卡顿或后台暂停晚于点名截止时间，当前仍可能直接显示结果；这属于独立的帧调度问题。
- 中文姓名播报依赖系统可用的本地中文语音，读音可能存在多音字差异。

## 目录

- `src/`：HTML / CSS / 项目 JavaScript，作为网页源码编辑入口
- `public/`：模型、音效、离线第三方库及许可证，保留部署相对路径
- `dist/`：`npm run build` 生成的完整网页，不提交
- `tests/`：生产逻辑、构建产物与测试夹具
- `scripts/`：纯复制构建、本地静态服务、测试入口及源码清单核验
- `electron/`：桌面包装源码、依赖锁、资源清单和构建说明（原 `desktop/`，不含 Electron 二进制）
- `docs/`：场景示意、部署说明及字形来源
- `ASSET_SOURCES.md`：第三方来源和分发注意事项
- `SOURCE_MANIFEST.json`：当前跟踪源码文件大小与 SHA-256 清单

本项目没有新增项目级开源许可证。第三方组件继续适用各自许可证；用户提供素材的使用授权不代表对公众授予额外开放许可证。不要把名单、班级备份、截图、浏览器资料目录或密钥提交到仓库。

## 独立星际轨道预览

先运行 `npm run build`，再在相同本地服务器打开 `/orbit-preview/`，可体验独立的星际姓名轨道方案；首页和现有三个主题保持原样。预览默认打开星空，使用独立主题偏好，点击“返回原版”回到首页。

预览与原版共享班级名单存储。预览里保存、导入或删除班级会改变同一份名单，建议先导出备份。预览不带真实学生数据。倒计时仍为1–10分钟下拉框、默认2分钟。

预览源码位于 `src/orbit-preview/`，许可证位于 `public/orbit-preview/`，构建后生成 `dist/orbit-preview/`；不要编辑或提交 `dist/`。预览复用原有模型、音频及vendor资源，不复制桌面运行时。执行 `node tests/orbit-preview.mjs` 可运行独立宿主回归，`node scripts/test.mjs` 同时运行原站与预览测试。测试使用模拟DOM、时钟和录制Canvas；不等于浏览器GPU、真实鼠标/全屏、声音或Windows验收。

预览待机采用有序三层布局并降低星流背景噪声。桌面最多显示30张、竖屏最多18张代表卡；抽取球阵仍包含全部名单，不按待机展示范围筛选。新增 `node tests/orbit-preview-quiet-idle.mjs` 检查四尺寸下108秒无遮挡、无裁切和结果不中断。
