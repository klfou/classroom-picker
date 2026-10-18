'use strict';

// Exercise the unchanged, final release ZIP in a disposable GitHub-hosted VM.
// APPDATA environment overrides do NOT isolate Electron's Windows known folders.
// Never run this against a teacher's Windows profile or a self-hosted runner.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawn, execFile, execFileSync} = require('node:child_process');
const {setTimeout: delay} = require('node:timers/promises');
const {validateConfig} = require('../release-config.cjs');
const {packageFiles} = require('../verify-package.cjs');

const TOTAL_TIMEOUT_MS = 240_000;
const PAGE_URL = 'classroom://app/index.html';
const CLASS_NAME = 'CI 合成班级';
const SYNTHETIC_SEATS = [
  {row: 1, col: 1, name: '合成学生甲'},
  {row: 2, col: 3, name: '合成学生乙'}
];

function exists(file) {
  try { fs.lstatSync(file); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
function hostedWindowsOnly() {
  assert.equal(process.platform, 'win32', 'Smoke test requires Windows; no application was started');
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Use a disposable GitHub Actions runner only');
  assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted', 'Self-hosted or personal Windows profiles are forbidden');
  assert.equal(process.versions.node.split('.')[0], '24', 'Smoke controller requires Node.js 24');
  assert.equal(typeof WebSocket, 'function', 'Node.js built-in WebSocket is required');
}
function checkAbort(context) { context.signal.throwIfAborted(); }
function remaining(context, maximum = 30_000) {
  checkAbort(context);
  return Math.max(1, Math.min(maximum, context.deadline - Date.now()));
}
async function waitFor(context, description, action, timeout = 30_000) {
  const end = Date.now() + remaining(context, timeout);
  while (Date.now() < end) {
    checkAbort(context);
    const value = await action();
    if (value) return value;
    await delay(100, undefined, {signal: context.signal});
  }
  throw Error('Timed out: ' + description);
}
async function sha256(file, signal) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file, {signal})) hash.update(chunk);
  return hash.digest('hex');
}
function powerShell(context, script, extraEnv = {}) {
  const source = "$ErrorActionPreference = 'Stop'; [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false);\n" + script;
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(source, 'utf16le').toString('base64')], {
      encoding: 'utf8', windowsHide: true, timeout: remaining(context, 60_000),
      signal: context.signal, maxBuffer: 1024 * 1024, env: {...process.env, ...extraEnv}
    }, (error, stdout, stderr) => {
      if (error) reject(Error('PowerShell failed: ' + error.message + '\n' + stderr));
      else resolve(stdout.replace(/^\uFEFF/, '').trim());
    });
  });
}
async function extractRelease(context, archive, destination) {
  await powerShell(context, `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = $env:SUNLIT_SMOKE_ARCHIVE
$destination = $env:SUNLIT_SMOKE_DESTINATION
$zip = [System.IO.Compression.ZipFile]::OpenRead($archive)
try {
  $seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($entry in $zip.Entries) {
    $name = $entry.FullName.Replace('\\', '/')
    if (-not $name.StartsWith('SunlitClassroom/', [System.StringComparison]::Ordinal) -or
        $name.Contains(':') -or $name -match '(^|/)\\.\\.?(/|$)' -or $name.Contains('//') -or
        $name -match '(?i)(^|/)(Data(?:-recovery-[^/]*)?|AppData|userData|Local Storage|\\.Data-migration-[^/]*)(/|$)' -or
        (($entry.ExternalAttributes -shr 16) -band 61440) -eq 40960) {
      throw "Unsafe or private ZIP entry: $name"
    }
    if (-not $seen.Add($name.TrimEnd('/'))) { throw "Duplicate ZIP entry: $name" }
  }
  foreach ($required in @('SunlitClassroom/SunlitClassroom.exe', 'SunlitClassroom/resources/app.asar')) {
    if (-not $seen.Contains($required)) { throw "Missing ZIP entry: $required" }
  }
} finally { $zip.Dispose() }
[System.IO.Compression.ZipFile]::ExtractToDirectory($archive, $destination)
`, {SUNLIT_SMOKE_ARCHIVE: archive, SUNLIT_SMOKE_DESTINATION: destination});
}

class CdpClient {
  constructor(socket, context) {
    this.socket = socket;
    this.context = context;
    this.sequence = 0;
    this.pending = new Map();
    this.jsErrors = [];
    socket.addEventListener('message', event => {
      let message;
      try { message = JSON.parse(event.data); }
      catch { this.rejectPending(Error('Invalid CDP JSON')); return; }
      if (message.id !== undefined) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id); clearTimeout(pending.timer);
        if (message.error) pending.reject(Error(JSON.stringify(message.error)));
        else pending.resolve(message.result);
      } else if (message.method === 'Runtime.exceptionThrown') {
        const details = message.params.exceptionDetails;
        this.jsErrors.push((details.exception?.description || details.text || 'JavaScript exception').slice(0, 4000));
      } else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
        this.jsErrors.push(message.params.args.map(arg => arg.description ?? arg.value ?? arg.type).join(' ').slice(0, 4000));
      }
    });
    socket.addEventListener('close', () => this.rejectPending(Error('CDP connection closed')));
    socket.addEventListener('error', () => this.rejectPending(Error('CDP connection failed')));
  }
  static async connect(url, context) {
    checkAbort(context);
    const socket = new WebSocket(url);
    const client = new CdpClient(socket, context);
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => finish(Error('Timed out connecting to CDP')), remaining(context, 10_000));
        const finish = error => {
          clearTimeout(timer);
          socket.removeEventListener('open', opened); socket.removeEventListener('error', failed);
          socket.removeEventListener('close', failed); context.signal.removeEventListener('abort', aborted);
          if (error) reject(error); else resolve();
        };
        const opened = () => finish();
        const failed = () => finish(Error('Could not connect to CDP'));
        const aborted = () => finish(context.signal.reason);
        socket.addEventListener('open', opened, {once: true});
        socket.addEventListener('error', failed, {once: true});
        socket.addEventListener('close', failed, {once: true});
        context.signal.addEventListener('abort', aborted, {once: true});
      });
      return client;
    } catch (error) { client.close(); throw error; }
  }
  rejectPending(error) {
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear();
  }
  send(method, params = {}) {
    assert.equal(this.socket.readyState, WebSocket.OPEN, 'CDP must be connected');
    this.socket.send(JSON.stringify({id: ++this.sequence, method, params}));
  }
  call(method, params = {}) {
    checkAbort(this.context);
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => { this.pending.delete(id); reject(Error('CDP timeout: ' + method)); }, remaining(this.context));
      this.pending.set(id, {resolve, reject, timer});
      try { this.socket.send(JSON.stringify({id, method, params})); }
      catch (error) { this.pending.delete(id); clearTimeout(timer); reject(error); }
    });
  }
  async evaluate(expression) {
    const result = await this.call('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    assert.ok(!result.exceptionDetails, 'Page evaluation failed: ' + JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  assertNoErrors() { assert.deepEqual(this.jsErrors, [], 'Renderer JavaScript exceptions or console.error calls'); }
  close() {
    this.rejectPending(Error('CDP client closed'));
    try { this.socket.close(); } catch { /* Already closed or never connected. */ }
  }
}

function loopbackWebSocket(value, port, expectedPath) {
  const url = new URL(value);
  assert.equal(url.protocol, 'ws:'); assert.equal(url.hostname, '127.0.0.1');
  assert.equal(Number(url.port), port); assert.equal(url.username, ''); assert.equal(url.password, '');
  if (expectedPath) assert.equal(url.pathname, expectedPath, 'Stale DevToolsActivePort');
  return url.href;
}
function launch(context, folder, label) {
  checkAbort(context);
  const activePort = path.join(folder, 'Data', 'DevToolsActivePort');
  if (exists(activePort)) fs.unlinkSync(activePort); // Only our synthetic temporary profile.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !/^(?:NODE_OPTIONS|ELECTRON_RUN_AS_NODE|ELECTRON_NO_ASAR|ELECTRON_DISABLE_SANDBOX)$/i.test(key)));
  const child = spawn(path.join(folder, 'SunlitClassroom.exe'), [
    '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', '--disable-gpu',
    '--enable-logging=file', '--log-file=' + path.join(context.root, label + '-chromium.log')
  ], {cwd: folder, env, windowsHide: false, stdio: ['ignore', 'pipe', 'pipe']});
  const instance = {child, folder, label, exited: false, exitCode: null, signal: null, error: null, output: '', clients: []};
  context.instances.push(instance);
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { instance.output = (instance.output + chunk.toString()).slice(-32_000); });
  child.once('error', error => { instance.error = error; });
  child.once('exit', (code, signal) => { instance.exited = true; instance.exitCode = code; instance.signal = signal; });
  return instance;
}
function assertAlive(instance) {
  if (instance.error) throw instance.error;
  assert.equal(instance.exited, false, `${instance.label} exited early (${instance.exitCode}, ${instance.signal})\n${instance.output}`);
}
async function attach(context, instance) {
  const endpoint = await waitFor(context, instance.label + ' DevTools endpoint', async () => {
    assertAlive(instance);
    let lines;
    try { lines = fs.readFileSync(path.join(instance.folder, 'Data', 'DevToolsActivePort'), 'utf8').trim().split(/\r?\n/); }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
    const port = Number(lines[0]);
    if (!Number.isInteger(port) || port < 1 || port > 65535 || !/^\/devtools\/browser\/[a-zA-Z0-9-]+$/.test(lines[1] || '')) return false;
    try {
      const options = {signal: AbortSignal.any([context.signal, AbortSignal.timeout(1500)]), redirect: 'error'};
      const versionResponse = await fetch(`http://127.0.0.1:${port}/json/version`, options);
      if (!versionResponse.ok) return false;
      const version = await versionResponse.json();
      const browser = loopbackWebSocket(version.webSocketDebuggerUrl, port, lines[1]);
      const pagesResponse = await fetch(`http://127.0.0.1:${port}/json/list`, options);
      if (!pagesResponse.ok) return false;
      const pages = await pagesResponse.json();
      const page = pages.find(target => target.type === 'page' && target.url === PAGE_URL);
      if (!page) return false;
      return {browser, page: loopbackWebSocket(page.webSocketDebuggerUrl, port)};
    } catch (error) {
      checkAbort(context);
      if (error instanceof assert.AssertionError) throw error;
      return false; // The port file can become visible before HTTP is ready.
    }
  }, 45_000);
  const browser = await CdpClient.connect(endpoint.browser, context); instance.clients.push(browser);
  const page = await CdpClient.connect(endpoint.page, context); instance.clients.push(page);
  instance.browser = browser; instance.page = page;
  await page.call('Runtime.enable');
  await waitFor(context, instance.label + ' renderer initialization', async () => {
    assertAlive(instance);
    return page.evaluate('Boolean(window.classroom && window.classroom.ready)');
  });
  const ready = await page.evaluate(`(async () => {
    const ready = await window.classroom.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {ready, href: location.href, origin: location.origin, title: document.title,
      loading: Boolean(document.querySelector('#loading')), requireType: typeof require,
      warning: window.classroom.classStore.warning, notice: document.querySelector('#storage-notice').hidden};
  })()`);
  assert.equal(ready.ready, true); assert.equal(ready.href, PAGE_URL); assert.equal(ready.origin, 'classroom://app');
  assert.equal(ready.title, '晴窗教室 · 随机点名'); assert.equal(ready.loading, false);
  assert.equal(ready.requireType, 'undefined'); assert.equal(ready.warning, ''); assert.equal(ready.notice, true);
  page.assertNoErrors();
  const marker = JSON.parse(fs.readFileSync(path.join(instance.folder, 'Data', 'portable-profile.json'), 'utf8'));
  assert.equal(marker.format, 1); assert.equal(marker.status, 'fresh', 'Smoke must never migrate an existing Windows roster');
}
async function createSyntheticRoster(page) {
  const result = await page.evaluate(`(() => {
    const expected = ${JSON.stringify(SYNTHETIC_SEATS)}, className = ${JSON.stringify(CLASS_NAME)};
    const need = (condition, message) => { if (!condition) throw Error(message); };
    const get = selector => { const element = document.querySelector(selector); need(element, 'Missing ' + selector); return element; };
    const click = selector => { const element = get(selector); need(!element.disabled, 'Disabled ' + selector); element.click(); };
    const fill = (selector, value) => { const element = get(selector); element.value = value; element.dispatchEvent(new Event('input', {bubbles:true})); };
    need(localStorage.getItem('sunlit-classes-v3') === null, 'Expected a fresh, synthetic-only profile');
    click('#edit'); need(get('#roster-dialog').open, 'Roster editor did not open');
    click('#class-create'); fill('#class-name', className); click('#class-name-save');
    need(window.classroom.classStore.current.name === className, 'Class was not created');
    need(window.classroom.classStore.current.seats.length === 0, 'New class was not empty');
    for (const seat of expected) {
      click('.seat-card[data-row="' + seat.row + '"][data-col="' + seat.col + '"]');
      fill('#seat-name', seat.name);
    }
    click('#save'); need(get('#roster-error').textContent.includes('已保存 2 人'), 'Roster save did not succeed');
    need(get('#save').disabled, 'Editor still has unsaved changes');
    click('#editor-close'); need(!get('#roster-dialog').open, 'Editor did not close cleanly');
    return true;
  })()`);
  assert.equal(result, true); page.assertNoErrors();
}
async function snapshot(page) {
  const result = await page.evaluate(`(() => {
    const app = window.classroom;
    document.querySelector('#edit').click();
    if (!document.querySelector('#roster-dialog').open) throw Error('Editor did not open for persistence check');
    const current = app.classStore.current;
    const visibleSeats = current.seats.map(seat => ({row: seat.row, col: seat.col,
      name: document.querySelector('.seat-card[data-row="' + seat.row + '"][data-col="' + seat.col + '"] .seat-card-name')?.textContent}));
    const result = {current, seats: app.getState().seats, names: app.getState().names,
      selectedClass: document.querySelector('#class-select').selectedOptions[0]?.textContent,
      editorClass: document.querySelector('#editor-class-name').textContent, visibleSeats,
      stored: localStorage.getItem('sunlit-classes-v3'), warning: app.classStore.warning};
    document.querySelector('#editor-close').click();
    if (document.querySelector('#roster-dialog').open) throw Error('Editor has unsaved changes');
    return result;
  })()`);
  assert.equal(result.current.name, CLASS_NAME); assert.equal(result.current.sample, false);
  const simplify = seats => seats.map(({row, col, name}) => ({row, col, name}));
  assert.deepEqual(simplify(result.current.seats), SYNTHETIC_SEATS);
  assert.deepEqual(simplify(result.seats), SYNTHETIC_SEATS); assert.deepEqual(result.visibleSeats, SYNTHETIC_SEATS);
  assert.deepEqual(result.names, SYNTHETIC_SEATS.map(seat => seat.name));
  assert.equal(result.selectedClass, CLASS_NAME); assert.equal(result.editorClass, CLASS_NAME); assert.equal(result.warning, '');
  const stored = JSON.parse(result.stored);
  assert.equal(stored.version, 3); assert.equal(stored.activeId, result.current.id);
  assert.deepEqual(stored.classes.find(item => item.id === stored.activeId), result.current);
  page.assertNoErrors();
  return {current: result.current, stored: result.stored};
}
async function closeNormally(context, instance) {
  instance.page.assertNoErrors();
  // Electron deliberately does not send a response to Browser.close. A normal
  // RPC await would falsely time out; the process exit is our completion signal.
  instance.browser.send('Browser.close');
  await waitFor(context, instance.label + ' clean exit', () => instance.exited, 20_000);
  assert.equal(instance.exitCode, 0, instance.label + ' nonzero exit\n' + instance.output);
  assert.equal(instance.signal, null); instance.page.assertNoErrors();
  for (const client of instance.clients) client.close();
}
function cleanup(context) {
  let failure;
  for (const instance of context.instances) {
    for (const client of instance.clients) client.close();
    if (!instance.exited && instance.child.pid) {
      try {
        execFileSync('taskkill.exe', ['/PID', String(instance.child.pid), '/T', '/F'], {
          windowsHide: true, stdio: 'pipe', timeout: 15_000
        });
      } catch (error) { failure ||= Error('Could not clean up smoke process tree: ' + error.message); }
    }
  }
  if (context.root) {
    // The root is created by this invocation. Never remove the real AppData
    // directory, release folder, an existing profile, or an arbitrary argument.
    try { fs.rmSync(context.root, {recursive: true, force: true, maxRetries: 10, retryDelay: 250}); }
    catch (error) { failure ||= error; }
  }
  if (failure) throw failure;
}
async function run() {
  hostedWindowsOnly();
  const {version, runtime} = validateConfig();
  const builtFolder = path.resolve(__dirname, '..', 'out', version, 'SunlitClassroom');
  const releaseFolder = path.resolve(__dirname, '..', 'out', version, 'release');
  const archive = path.join(releaseFolder, `SunlitClassroom-${version}-windows-x64.zip`);
  const reportPath = path.join(releaseFolder, 'smoke-report.json');
  assert.ok(!exists(reportPath), 'A smoke report already exists; use a fresh release output');
  const controller = new AbortController();
  const context = {signal: controller.signal, deadline: Date.now() + TOTAL_TIMEOUT_MS, root: null, instances: []};
  const watchdog = setTimeout(() => controller.abort(Error('Windows smoke exceeded its total time limit')), TOTAL_TIMEOUT_MS);
  let report;
  try {
    const actualAppData = await powerShell(context, "[Environment]::GetFolderPath([Environment+SpecialFolder]::ApplicationData) | ConvertTo-Json -Compress");
    const appData = JSON.parse(actualAppData);
    assert.ok(typeof appData === 'string' && path.isAbsolute(appData), 'Could not determine the Windows known AppData folder');
    const legacy = path.join(appData, 'SunlitClassroom');
    assert.ok(!exists(legacy), 'Existing Windows SunlitClassroom profile detected; refused to start or delete it');
    packageFiles(builtFolder); // Fail if the publishable output contains a profile.
    const archiveHash = await sha256(archive, context.signal);
    const webArchive = `SunlitClassroom-${version}-web.zip`;
    const webZip = path.join(releaseFolder, webArchive);
    const webZipSha256 = await sha256(webZip, context.signal);
    const infoBytes = fs.readFileSync(path.join(builtFolder, 'build-info.json'));
    const buildInfo = JSON.parse(infoBytes);
    assert.equal(buildInfo.dirty, false);
    assert.equal(buildInfo.sourceCommit, process.env.GITHUB_SHA, 'Packaged provenance must identify the actual workflow checkout');
    const buildInfoSha256 = crypto.createHash('sha256').update(infoBytes).digest('hex');
    context.root = fs.mkdtempSync(path.join(os.tmpdir(), 'sunlit-release-smoke-'));
    const extracted = path.join(context.root, '首次 解压');
    await extractRelease(context, archive, extracted);
    const folder = path.join(extracted, 'SunlitClassroom');
    packageFiles(folder);
    for (const relative of ['SunlitClassroom.exe', 'resources/app.asar']) {
      assert.equal(await sha256(path.join(folder, relative), context.signal), await sha256(path.join(builtFolder, relative), context.signal), 'ZIP differs from verified package: ' + relative);
    }
    const packageHashes = {
      exeSha256: await sha256(path.join(folder, 'SunlitClassroom.exe'), context.signal),
      asarSha256: await sha256(path.join(folder, 'resources/app.asar'), context.signal)
    };

    const first = launch(context, folder, 'first-start'); await attach(context, first);
    assert.equal(await first.page.evaluate("fetch('/build-info.json').then(r => {if (!r.ok) throw Error('No provenance'); return r.text()})"), infoBytes.toString('utf8'), 'Running EXE provenance differs');
    assert.equal(await first.page.evaluate("fetch('/version.html').then(r => r.text()).then(text => text.includes(" + JSON.stringify(buildInfo.buildId) + "))"), true, 'Running EXE version page differs');
    await createSyntheticRoster(first.page);
    const expected = await snapshot(first.page); await closeNormally(context, first);
    assert.ok(fs.statSync(path.join(folder, 'Data', 'Local Storage', 'leveldb')).isDirectory(), 'Chromium storage was not created beside the EXE');
    assert.ok(!exists(path.join(legacy, 'Local Storage')), 'Chromium wrote roster storage into the legacy Windows profile');
    console.log('PASS final ZIP: actual EXE, classroom://app, renderer ready, UI-created synthetic roster and clean exit.');

    const second = launch(context, folder, 'restart'); await attach(context, second);
    assert.deepEqual(await snapshot(second.page), expected, 'Roster did not persist after process restart');
    await closeNormally(context, second);
    console.log('PASS real Chromium roster persistence after EXE restart.');

    const movedParent = path.join(context.root, '移动后的 教室'); fs.mkdirSync(movedParent);
    const moved = path.join(movedParent, 'SunlitClassroom');
    await waitFor(context, 'Windows releases the closed application directory', () => {
      try { fs.renameSync(folder, moved); return true; }
      catch (error) { if (['EPERM', 'EACCES', 'EBUSY'].includes(error.code)) return false; throw error; }
    }, 10_000);
    assert.ok(!exists(folder), 'Original application directory still exists after move');
    const third = launch(context, moved, 'moved-restart'); await attach(context, third);
    assert.deepEqual(await snapshot(third.page), expected, 'Roster did not follow the moved application directory');
    await closeNormally(context, third);
    assert.ok(!exists(path.join(legacy, 'Local Storage')), 'Roster storage escaped the temporary portable profile');
    packageFiles(builtFolder);
    assert.equal(await sha256(archive, context.signal), archiveHash, 'Final ZIP changed during smoke test');
    assert.equal(await sha256(webZip, context.signal), webZipSha256, 'Web ZIP changed during smoke test');
    for (const [relative, expectedHash] of [['SunlitClassroom.exe', packageHashes.exeSha256], ['resources/app.asar', packageHashes.asarSha256]]) {
      assert.equal(await sha256(path.join(moved, relative), context.signal), expectedHash, 'Application bytes changed during smoke: ' + relative);
      assert.equal(await sha256(path.join(builtFolder, relative), context.signal), expectedHash, 'Publishable application bytes changed during smoke: ' + relative);
    }
    report = {
      format: 1, passed: true, status: 'passed', version, electron: runtime.version, platform: 'win32', arch: 'x64',
      archive: path.basename(archive), zipSha256: archiveHash, ...packageHashes,
      webArchive, webZipSha256, buildId: buildInfo.buildId, buildInfoSha256,
      runId: process.env.GITHUB_RUN_ID || null, runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
      commit: process.env.GITHUB_SHA || null, completedAt: new Date().toISOString(),
      checks: ['final ZIP extraction', 'actual packaged EXE', 'classroom://app renderer ready', 'sandboxed renderer without require',
        'synthetic roster saved through UI', 'normal process exit', 'real Chromium restart persistence',
        'whole-directory move persistence', 'no profile in publishable package', 'unchanged final ZIP and application hashes'],
      isolation: 'Disposable GitHub-hosted Windows VM; actual Windows legacy profile absent before first launch; temporary portable Data only.',
      limitations: ['GPU disabled', 'No real student data', 'No legacy-profile migration test', 'No cross-computer transfer test',
        'No native save-dialog, audio, touch, or classroom-hardware acceptance test']
    };
    console.log('PASS moved-directory persistence; publishable package remains profile-free and the final ZIP is unchanged.');
  } catch (error) {
    for (const instance of context.instances) {
      console.error('Smoke diagnostics (' + instance.label + '):\n' + instance.output);
      const log = context.root && path.join(context.root, instance.label + '-chromium.log');
      if (log && exists(log)) console.error(fs.readFileSync(log, 'utf8').slice(-16_000));
    }
    throw error;
  } finally {
    clearTimeout(watchdog); controller.abort(); cleanup(context);
  }
  // A pass report is written only after all process/profile cleanup succeeds.
  // It contains hashes and test boundaries, never the temporary Data directory.
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
  console.log('Windows smoke report: ' + reportPath);
  return report;
}

module.exports = {CdpClient, hostedWindowsOnly, loopbackWebSocket, run};
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
