'use strict';
const { app, BrowserWindow, protocol, net, session, dialog } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const ROOT = path.join(__dirname, 'dist');
const ORIGIN = 'classroom://app';
app.setName('SunlitClassroom');
// A stable user-owned location survives replacing or moving the application folder.
app.setPath('userData', path.join(app.getPath('appData'), 'SunlitClassroom'));
protocol.registerSchemesAsPrivileged([{ scheme: 'classroom', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true
} }]);
let mainWindow;
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
  app.whenReady().then(async () => {
    protocol.handle('classroom', async request => {
      try {
        const url = new URL(request.url);
        if (url.hostname !== 'app' || !['GET', 'HEAD'].includes(request.method)) return new Response('Forbidden', { status: 403 });
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
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => { if (app.isReady()) session.defaultSession.flushStorageData(); });
}
