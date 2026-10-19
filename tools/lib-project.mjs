import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { sizes, hash } from './lib-cli.mjs';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export function htmlFile(input) {
  if (!input) throw Error('请提供项目目录或 HTML 文件');
  const resolved = path.resolve(input);
  const file = fs.statSync(resolved).isDirectory() ? path.join(resolved, 'index.html') : resolved;
  if (!fs.existsSync(file) || !/\.html?$/i.test(file)) throw Error('找不到 HTML：' + file);
  return file;
}
export async function openProject(browser, file, mode, exporting = true) {
  const page = await browser.newPage();
  const [w, h] = sizes[mode];
  await page.viewport(exporting ? w : 1440, exporting ? h : 1000);
  const url = pathToFileURL(file);
  url.searchParams.set('format', mode); url.searchParams.set('export', exporting ? '1' : '0');
  await page.goto(url.href);
  let loaded = false;
  for (let i = 0; i < 100; i++) {
    const state = await page.eval('({ ready: !!window.video, error: window.__videoError })');
    if (state?.error) throw Error(state.error);
    if (state?.ready) { loaded = true; break; }
    if (page.errors.length) throw Error(page.errors.join('\n'));
    await sleep(100);
  }
  if (!loaded) throw Error('10 秒内未发现 window.video；按 rendering-contract.md 接入项目');
  const meta = await page.eval('window.video.ready');
  if (page.errors.length) throw Error(page.errors.join('\n'));
  if (meta.version !== 1 || meta.width !== w || meta.height !== h || !Number.isInteger(meta.frames) || meta.frames < 1) throw Error('项目元数据不符合渲染契约');
  const rect = await page.eval(() => {
    const r = document.getElementById('stage').getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  if (exporting && (rect.x !== 0 || rect.y !== 0 || rect.width !== w || rect.height !== h)) throw Error('导出 stage 必须位于 (0,0)，且为原始像素尺寸');
  return { page, meta, rect, file };
}
export async function frame(project, n) {
  // 检查播放器会打开第二个标签页；后台页的 rAF 可能被 Chromium 暂停。
  await project.page.call('Page.bringToFront');
  await project.page.eval(async t => {
    await window.video.render(t);
    await new Promise(requestAnimationFrame);
  }, n / project.meta.fps);
  if (project.page.errors.length) throw Error(project.page.errors.join('\n'));
  return project.page.screenshot(project.rect);
}
export function sampleFrames(meta, count = meta.frames) {
  const set = new Set([0, count - 1, Math.floor(count / 2)]);
  const chapters = meta.chapters || [];
  chapters.forEach((c, i) => {
    const end = chapters[i + 1]?.at ?? meta.duration;
    for (const t of [c.at - 1 / meta.fps, c.at, c.at + 1 / meta.fps, (c.at + end) / 2]) {
      const n = Math.round(t * meta.fps);
      if (n >= 0 && n < count) set.add(n);
    }
  });
  return [...set].sort((a, b) => a - b);
}
export async function deterministic(project, samples) {
  const checks = [];
  for (const n of samples) {
    const a = hash(await frame(project, n));
    await frame(project, n === 0 ? project.meta.frames - 1 : 0);
    const b = hash(await frame(project, n));
    checks.push({ frame: n, equal: a === b, sha256: a });
  }
  if (checks.some(c => !c.equal)) throw Error('乱序跳转后画面发生变化，不能稳定导出：' + checks.filter(c => !c.equal).map(c => c.frame).join(', '));
  return checks;
}
export async function playbackCheck(browser, file, mode) {
  const { page, meta } = await openProject(browser, file, mode, false);
  const result = await page.eval(async () => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const v = window.video;
    document.getElementById('play').click();
    for (let i = 0; i < 160 && !v.state.playing; i++) await wait(50);
    await wait(350);
    const moving = v.state.time > 0.1 && v.state.playing;
    document.getElementById('play').click(); await wait(80);
    const pausedAt = v.state.time; await wait(180);
    const paused = !v.state.playing && v.state.time === pausedAt;
    const slider = document.getElementById('progress'); slider.value = 0.6;
    slider.dispatchEvent(new Event('input', { bubbles: true })); await wait(80);
    const scrub = Math.abs(v.state.time - v.meta.duration * 0.6) < 0.01;
    await v.seek(v.meta.duration); document.getElementById('play').click(); await wait(200);
    const replay = v.state.playing && v.state.time < 1;
    v.pause();
    return { moving, paused, scrub, replay };
  });
  if (page.errors.length) throw Error(page.errors.join('\n'));
  if (Object.values(result).some(x => !x)) throw Error('播放器交互检查失败：' + JSON.stringify(result));
  return { ...result, duration: meta.duration };
}
