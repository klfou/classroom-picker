# 静态部署与 Sites 输入

网页源码在 `src/`，模型/音效/vendor/许可证在 `public/`。二者以同一相对路径原字节复制到生成目录 `dist/`，另生成严格校验的 `build-info.json` 和静态 `version.html`。根项目没有 npm 依赖，不需要框架构建器。

## 首选：部署已经测试的同源网页包

需要网页与桌面对应同一份代码时，从同一次成功 CI artifact 或正式 Release 取得 `SunlitClassroom-X.Y.Z-web.zip` 与桌面 ZIP，先核对该次 `SHA256SUMS.txt` 的两项校验和。网页 ZIP 根就是站点根，不要混入旧版文件，也不要从另一个分支重新构建替换其中部分文件。

网页上线后，实际读取站点 `/build-info.json` 或 `/version.html`，确认 `version`、完整 `sourceCommit`、`buildId` 与桌面 EXE 同级 `build-info.json` 一致。记录实际地址和身份；仅完成 GitHub Release 并不代表线上站点已经更新。旧 EXE 也不会因为网页更新自动升级。

## 从克隆重建

使用 Node.js 24.x：

```sh
npm ci --ignore-scripts
npm run check
npm run build:sites
```

`build:sites` 执行原字节复制构建、获审资源清单校验及来源生成/校验，输出目录仍为 `dist/`。这个命令只生成并检查本地文件，不创建、上传或发布 Site，不改变现有线上预览。

仅将生成的 `dist/` 内容作为静态站点根目录。`src/` 和 `public/` 单独都不是完整运行站点；仓库根、`electron/`、`tests/`、用户数据或备份也不应成为公开部署输入。

## Sites

在经过授权的 Sites 托管工作区中保留其原有 Site 身份与访问级别，不从本仓库猜测或新建身份。托管配置的静态输出应继续设为 `static.directory: "dist"`。优先使用上面已经测试的网页 ZIP。若经授权选择在 Sites 源码同步流程中重建，必须使用目标提交的真实 Git 克隆并保持干净，按顺序执行，例如：

```json
[
  ["npm", "ci", "--ignore-scripts"],
  ["npm", "run", "check"],
  ["npm", "run", "build:sites"]
]
```

没有 Git 的源码快照仍可本地预览，但其 `sourceCommit` 为空且标记为本地未验证来源；不能填写一个环境变量或手写 SHA 来冒充已测试版本。构建未执行任何 Sites API 或自动部署操作。

运行后的静态部署包需要包含 `dist/`，即使它被源码 Git 忽略；源仓库则跟踪 `src/`、`public/` 和构建脚本。不能把忽略生成目录误当成无需构建。`.openai/` 的托管身份仍是该工作区私有配置，不提交到此独立仓库。

独立预览的页面代码位于 `src/orbit-preview/`，许可证位于 `public/orbit-preview/`，构建后从 `/orbit-preview/` 访问。原站 51 项资源与预览 32 项资源分别保留原始字节，共享模型、音频和 vendor 仍位于站点根路径。此次冲突处理仅更新源仓库，没有发布或替换线上预览。

## 常规静态服务器

上传 `dist/` 中的全部文件，保持目录结构。服务器应为 `.js`/`.mjs` 返回 JavaScript MIME，为 `.json` 返回 JSON MIME，为 `.mp3` 返回音频 MIME。不要删去 vendor、模型、音频或许可证。

浏览器资料依赖来源（协议/域名/端口）。本次构建不更改来源或 localStorage 键；部署到不同域名或端口不会自动迁移原有班级资料。需要时由用户在原站导出，再在新站导入，不能把名单备份放进部署包。
