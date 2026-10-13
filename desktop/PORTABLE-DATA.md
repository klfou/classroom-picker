# 程序根目录 Data 与安全迁移

本 PR 基于 GitHub main `ad96c6cb340f14d1d56d798df7566e8c7e868a4a`，仅修改桌面数据路径、迁移保护及对应测试/说明。原有 dist、网页主题、资源清单、应用版本1.8.2与Electron 44.7.0保持不变。不包含更新器或新发行包。

应用身份 SunlitClassroom 和本地源 classroom://app 不变。离线网络限制、sandbox、contextIsolation 继续开启。构建仅额外包含 portable-data.cjs；不打包 Data、AppData、测试或班级导出文件。

## 保存位置及迁移
- 新版数据在 SunlitClassroom.exe 同级 Data 内，userData 和 sessionData 都在 ready 之前指向此处。
- 旧版名单原先保存在 %APPDATA%\SunlitClassroom 的 Chromium Local Storage，本次只复制，不删除或改写旧班级键。
- 首次且 Data 不存在才迁移；始终先获取旧版单实例锁，锁保持整个程序生命周期。因此同一 Windows 用户的旧版、新版、不同副本不能同时运行。
- 复制 Local Storage 到同一磁盘的 .Data-migration-* 临时目录，排除 LevelDB LOCK 文件，保留数据库日志 .log 和 MANIFEST/CURRENT 等文件，校验每个文件复制前后字节一致。拒绝符号链接和特殊文件。复制失败清理仅本次临时目录；遗留临时目录不复用、不删除。
- 临时目录完整后原子改名 Data；portable-profile.json 标记 pending-validation。主界面出现前，隐藏 Chromium 页面在同一 classroom://app 源实际读取 localStorage，再由现有 createClassStore 检验班级。通过后写 validated。新用户无旧 Local Storage 时标 fresh。
- 持久键包括 sunlit-classes-v3、sunlit-classes-v3-backup、sunlit-classes-v3-import-backup 及 -next、旧 sunlit-roster；整个 Local Storage 复制也保留主题、声音偏好。点名进度仍按现有设计只在本次会话保留。
- 已有带有效标记的 Data 绝不导入、合并、覆盖另一台电脑的本机名单。已有无标记/损坏标记 Data 则停止，保留资料等待人工确认，不能当成空目录初始化。
- 目录不可写时停止，不悄悄回退 AppData。建议放桌面/文档等可写本地目录；不要直接从压缩包、只读介质、Program Files 或网络共享运行。

## 迁移未通过时
默认按钮关闭并保留所有资料。可回原1.8.2导出 Excel 或 JSON。
也可选择“保留迁移备份，重启后手动导入”。程序完全重启后、Chromium打开前，将失败的 Data 改名为 Data-recovery-随机ID，再建立 fresh Data，不重复导入旧库。原 AppData 与失败迁移备份都保留；用户可进入班级管理导入旧文件。
若恢复过程因权限/磁盘失败，停止并保留备份；不要删除备份。不要手工编辑 LevelDB。

## 使用步骤
1. 在旧版先导出全部班级 Excel/JSON，关闭所有教室窗口，另存备份。
2. 在可写本地文件夹运行采用本修复构建的完整程序，首次迁移后核对班级、姓名、性别和座位。
3. 关闭程序并等待进程退出，再复制或压缩完整程序目录，务必包括 Data；到其他电脑完整解压后运行。
4. 不要覆盖目标电脑已有另一套班级的目录。用独立文件夹运行；合并资料应通过现有带预览的班级导入。
5. Data 含明文学生资料，只交给获授权的人，不上传公共仓库。

## 限制与回退
- 仅支持完全退出后的本地复制，不支持运行中压缩、云盘实时同步、多电脑或跨 Windows 账户并发写同一 Data。
- 原 AppData 是迁移时快照，新修改不会回写旧版。回退旧程序时仍显示旧 AppData 资料；先保留 Data 并通过班级导出备份新修改。
- Excel/JSON班级资料包不是运行时偏好的完整备份。本 PR 不改变导入导出格式或承诺任意版本降级兼容。
- 真实 Windows 单实例锁、Chromium/LevelDB读取、跨机复制、目录权限、恢复重启和原生提示框尚未实测；发行前需用合成名单完成 Windows 验收并确认旧 AppData 未改。

## 自动验证
在项目根执行：

    node desktop/tests/portable-data.cjs
    node desktop/tests/startup.cjs
    node desktop/build.cjs --verify-only
    node tests/class-transfer.mjs
    node tests/excel-transfer.mjs
    node tests/excel-teacher-view.mjs
    node scripts/test.mjs

文件系统测试覆盖11项保护场景；启动测试使用模拟Electron验证锁失败、ready前路径设置、隐藏窗口不提前退出、验证失败/恢复与已有Data。它们不等于真实Windows或LevelDB验收。现有网页测试与合成旧版Excel兼容检查保留，本PR不修改任何网页文件。
