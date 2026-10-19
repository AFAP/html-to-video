// 仅驱动本工具启动的临时浏览器；不连接用户正在使用的浏览器。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { browserPath } from './lib-machine.mjs';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function launch() {
  const exe = browserPath();
  if (!exe) throw Error('找不到 Chrome/Edge；设置 CHROME_PATH 或运行 doctor');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'html-video-'));
  const proc = spawn(exe, [
    '--headless=new', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
    '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking', '--disable-component-update',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', '--force-color-profile=srgb',
    '--hide-scrollbars', '--mute-audio', 'about:blank'
  ], { stdio: 'ignore', windowsHide: true });
  let spawnError, ws, cleanupDone = false;
  proc.on('error', e => { spawnError = e; });
  const pending = new Map(), listeners = new Map();
  let nextId = 0;
  function rejectPending(message) {
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(Error(message)); }
    pending.clear();
  }
  async function cleanup() {
    if (cleanupDone) return;
    cleanupDone = true;
    try { ws?.close(); } catch { /* 已关闭 */ }
    if (proc.exitCode === null) proc.kill();
    for (let i = 0; i < 8; i++) {
      await sleep(100);
      try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch { /* 等待浏览器释放文件 */ }
    }
  }
  try {
    let endpoint;
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 150; i++) {
      if (spawnError) throw spawnError;
      if (proc.exitCode !== null) throw Error('浏览器提前退出：' + proc.exitCode);
      if (fs.existsSync(portFile)) {
        const lines = fs.readFileSync(portFile, 'utf8').trim().split(/\r?\n/);
        if (lines[0] && lines[1]) { endpoint = `ws://127.0.0.1:${lines[0]}${lines[1]}`; break; }
      }
      await sleep(100);
    }
    if (!endpoint) throw Error('浏览器启动超时');
    ws = new WebSocket(endpoint);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('CDP 连接超时')), 10000);
      ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      ws.addEventListener('error', () => { clearTimeout(timer); reject(Error('CDP 连接失败')); }, { once: true });
    });
    ws.addEventListener('close', e => rejectPending(`浏览器连接已关闭（${e.code} ${e.reason || ''}）`));
    ws.addEventListener('message', ({ data }) => {
      const msg = JSON.parse(data);
      if (msg.id) {
        const p = pending.get(msg.id);
        if (!p) return;
        clearTimeout(p.timer); pending.delete(msg.id);
        if (msg.error) p.reject(Error(msg.error.message)); else p.resolve(msg.result);
      } else for (const fn of listeners.get(msg.method) || []) fn(msg.params, msg.sessionId);
    });
    function send(method, params = {}, sessionId) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP 超时：' + method)); }, 30000);
        pending.set(id, { resolve, reject, timer });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    }
    return {
      executable: exe,
      async newPage() {
        const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
        const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
        const errors = [];
        function on(method, fn) {
          if (!listeners.has(method)) listeners.set(method, []);
          listeners.get(method).push((params, sid) => { if (sid === sessionId) fn(params); });
        }
        on('Runtime.exceptionThrown', p => errors.push(p.exceptionDetails.exception?.description || p.exceptionDetails.text));
        on('Runtime.consoleAPICalled', p => { if (p.type === 'error') errors.push(p.args.map(a => a.value ?? a.description).join(' ')); });
        on('Network.loadingFailed', p => { if (!p.canceled) errors.push('资源加载失败：' + p.errorText); });
        on('Inspector.targetCrashed', () => errors.push('浏览器渲染进程崩溃'));
        const call = (method, params) => send(method, params, sessionId);
        await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
        await call('Network.setBlockedURLs', { urls: ['http://*', 'https://*'] });
        return {
          errors, call,
          async viewport(width, height) { await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }); },
          async goto(url) {
            const r = await call('Page.navigate', { url });
            if (r.errorText) throw Error('打开页面失败：' + r.errorText);
          },
          async eval(fn, arg) {
            const expression = typeof fn === 'function' ? `(${fn.toString()})(${arg === undefined ? '' : JSON.stringify(arg)})` : String(fn);
            const r = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
            if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
            return r.result?.value;
          },
          async screenshot(clip) {
            // 使用正常的无损压缩，避免高细节 1080p 帧在 base64 传输时过大导致连接退出。
            const r = await call('Page.captureScreenshot', { format: 'png', optimizeForSpeed: false, captureBeyondViewport: false, ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
            return Buffer.from(r.data, 'base64');
          }
        };
      },
      async close() {
        try { await send('Browser.close'); } catch { /* 浏览器可能先关闭连接 */ }
        rejectPending('浏览器正在退出'); await cleanup();
      }
    };
  } catch (e) { await cleanup(); throw e; }
}
