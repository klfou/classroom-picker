'use strict';
const { app, BrowserWindow, protocol, net, session, dialog } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const { preparePortable, completeMigration } = require('./portable-data.cjs');
const ROOT = path.join(__dirname, 'dist');
const ORIGIN = 'classroom://app';
app.setName('SunlitClassroom');
// Keep the legacy lock for this process lifetime: old and new versions may not
// write concurrently during migration. Chromium storage itself moves to Data.
app.setPath('userData', path.join(app.getPath('appData'), 'SunlitClassroom'));
protocol.registerSchemesAsPrivileged([{ scheme: 'classroom', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true
} }]);
let mainWindow;
if (!app.requestSingleInstanceLock()) { dialog.showErrorBox('请先关闭已打开的教室', '旧版或另一个教室窗口正在运行。请完全关闭后再打开此版本，以安全迁移和保存名单。'); app.quit(); }
else {
  let profile;
  try {
    const legacy = app.getPath('userData');
    const base = app.isPackaged ? path.dirname(process.execPath) : __dirname;
    profile = preparePortable({ base, legacy, recoverPending: process.argv.includes('--sunlit-recover-migration') });
    // Both paths must be set before ready/defaultSession initialization.
    app.setPath('userData', profile.data);
    app.setPath('sessionData', profile.data);
  } catch (error) {
    dialog.showErrorBox('班级数据未能安全打开', error.message + '\n为保护班级资料，已停止启动；不会改用其他目录保存。请保留旧版资料、Data 和已有备份，不要删除数据目录。请提供上方完整错误文字，以便针对失败的操作处理。');
    app.exit(1);
  }
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
  app.whenReady().then(async () => {
    protocol.handle('classroom', async request => {
      try {
        const url = new URL(request.url);
        if (url.hostname !== 'app' || !['GET', 'HEAD'].includes(request.method)) return new Response('Forbidden', { status: 403 });
        if (url.pathname === '/migration-check.html') return new Response('<!doctype html><meta charset="utf-8"><title>检查班级资料</title>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
        const target = path.resolve(ROOT, '.' + relative);
        if (!target.startsWith(ROOT + path.sep) || !fs.statSync(target).isFile()) return new Response('Not found', { status: 404 });
        const response = await net.fetch(pathToFileURL(target).href);
        // Explicit ESM MIME avoids platform-dependent file-extension mappings.
        if (['.js', '.mjs'].includes(path.extname(target).toLowerCase())) {
          const headers = new Headers(response.headers);
          headers.set('Content-Type', 'text/javascript; charset=utf-8');
          headers.set('X-Content-Type-Options', 'nosniff');
          return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
        }
        return response;
      } catch { return new Response('Not found', { status: 404 }); }
    });
    // The application has no remote content, uploads, analytics, or update service.
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_details, callback) => callback({ cancel: true }));
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === 'fullscreen'));
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'fullscreen');
    if (profile.marker.status === 'pending-validation') {
      // Read through Chromium, never parse LevelDB ourselves or mutate roster keys.
      const check = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
      try {
        await check.loadURL(ORIGIN + '/migration-check.html');
        const result = await check.webContents.executeJavaScript(`(async () => {
          const { createClassStore, CLASS_KEY, BACKUP_KEY } = await import('/classes.js');
          const found = [CLASS_KEY, BACKUP_KEY, 'sunlit-roster'].some(key => localStorage.getItem(key) !== null);
          if (!found) return { ok: false, reason: '旧数据中没有读到班级记录。请从旧版导出班级资料包，保留 Data 备份后再导入新版。' };
          const store = createClassStore({ storage: localStorage, sampleSeats: [] });
          return { ok: !store.warning, reason: store.warning || '' };
        })()`);
        if (!result.ok) throw Error('自动迁移未通过校验。' + result.reason + '\n旧版数据仍保留在原处；不会显示空名单冒充迁移成功。');
        completeMigration(profile);
      } catch (error) {
        const choice = dialog.showMessageBoxSync({ type: 'warning', title: '旧班级自动迁移未完成',
          message: error.message,
          detail: '旧版 AppData 资料未改动。可先关闭，回旧版导出 Excel/JSON。也可保留本次 Data 为 Data-recovery 备份，并重新启动一个空白资料目录，再从班级管理导入备份文件。',
          buttons: ['关闭并保留资料', '保留迁移备份，重启后手动导入'], defaultId: 0, cancelId: 0 });
        if (choice === 1) app.relaunch({ args: [...process.argv.slice(1).filter(arg => arg !== '--sunlit-recover-migration'), '--sunlit-recover-migration'] });
        app.quit(); return;
      } finally { check.destroy(); }
      dialog.showMessageBoxSync({ type: 'info', title: '旧班级已复制到便携目录', message: '旧班级已复制并通过读取校验，请核对名单。', detail: '原电脑旧版资料仍保留。以后先关闭程序，再把完整文件夹（包括 Data）压缩复制。Data 含学生姓名，请只交给获授权的人。' });
    }
    mainWindow = new BrowserWindow({ width: 1440, height: 940, minWidth: 960, minHeight: 640, title: '晴窗教室 · 随机点名', backgroundColor: '#f4f1e9', autoHideMenuBar: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, spellcheck: false } });
    // User-selected file inputs remain browser-sandboxed. Exports are generated
    // locally as Blob URLs; they must not be mistaken for remote navigation.
    session.defaultSession.on('will-download', (event, item, webContents) => {
      const trustedPage = webContents === mainWindow.webContents &&
        webContents.getURL().startsWith(ORIGIN + '/');
      const localBlob = item.getURL().startsWith('blob:' + ORIGIN + '/');
      if (!trustedPage || !localBlob) { event.preventDefault(); return; }
      const isExcel = path.extname(item.getFilename()).toLowerCase() === '.xlsx';
      item.setSaveDialogOptions({
        title: '保存班级资料',
        defaultPath: path.join(app.getPath('downloads'), path.basename(item.getFilename())),
        filters: [{ name: isExcel ? 'Excel 班级资料' : 'JSON 班级资料包', extensions: [isExcel ? 'xlsx' : 'json'] }]
      });
      // Keep the native Save dialog: the user chooses the destination and sees
      // the overwrite confirmation. Do not auto-open exported roster files.
      item.once('done', (_event, state) => {
        if (state === 'interrupted') dialog.showErrorBox('保存未完成', '班级资料未能保存。请检查磁盘空间和目标文件夹权限后重新导出。');
      });
    });
    mainWindow.setMenu(null);
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    mainWindow.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(ORIGIN + '/')) event.preventDefault(); });
    mainWindow.webContents.on('will-attach-webview', event => event.preventDefault());
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key === 'F11') { event.preventDefault(); mainWindow.webContents.executeJavaScript("document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()", true).catch(() => {}); }
    });
    mainWindow.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
      if (isMainFrame && code !== -3) dialog.showErrorBox('教室未能打开', `请完整解压安装包后再运行。\n${description}`);
    });
    await mainWindow.loadURL(ORIGIN + '/index.html');
  }).catch(error => { dialog.showErrorBox('启动失败', error.message); app.quit(); });
  // The hidden migration checker is not the user's application window.
  app.on('window-all-closed', () => { if (mainWindow) app.quit(); });
  app.on('before-quit', () => { if (app.isReady()) session.defaultSession.flushStorageData(); });
}
