import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const skillRoot = fileURLToPath(new URL('../', import.meta.url));
function find(env, names, candidates = []) {
  if (process.env[env]) {
    if (!fs.existsSync(process.env[env])) throw Error(`${env} 指向不存在的文件：${process.env[env]}`);
    return process.env[env];
  }
  for (const name of names) {
    const r = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [name], { encoding: 'utf8', windowsHide: true });
    const found = (r.stdout || '').trim().split(/\r?\n/).find(p => fs.existsSync(p));
    if (found) return found;
  }
  return candidates.filter(Boolean).find(p => fs.existsSync(p)) || null;
}
export function browserPath() {
  return find('CHROME_PATH', ['google-chrome', 'chromium', 'chromium-browser', 'msedge', 'chrome'], [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ]);
}
export function binaries() {
  const suffix = process.platform === 'win32' ? '.exe' : '';
  const dirs = [process.env.HTML_VIDEO_FFMPEG_DIR, path.resolve('.cache/ffmpeg/bin'), path.join(skillRoot, '.cache/ffmpeg/bin')].filter(Boolean);
  const ffmpeg = find('FFMPEG', ['ffmpeg'], [...dirs.map(d => path.join(d, 'ffmpeg' + suffix)), 'C:/ffmpeg/bin/ffmpeg.exe']);
  const ffprobe = find('FFPROBE', ['ffprobe'], [ffmpeg && path.join(path.dirname(ffmpeg), 'ffprobe' + suffix), ...dirs.map(d => path.join(d, 'ffprobe' + suffix))].filter(Boolean));
  return { ffmpeg, ffprobe };
}
export function run(bin, argv, { binary = false, timeout = 120000 } = {}) {
  if (!bin) throw Error('缺少外部工具；先运行 node tools/doctor.mjs');
  const r = spawnSync(bin, argv, { encoding: binary ? undefined : 'utf8', maxBuffer: 64 * 1024 * 1024, timeout, windowsHide: true });
  if (r.error) throw r.error;
  if (r.status !== 0) throw Error(`${path.basename(bin)} 退出码 ${r.status}：${String(r.stderr || '').slice(-4000)}`);
  return r.stdout;
}
export function doctor() {
  const bins = binaries(), browser = browserPath();
  const checks = [
    { name: 'Node.js ≥22', ok: Number(process.versions.node.split('.')[0]) >= 22, detail: process.version },
    { name: 'Chrome / Edge', ok: !!browser, detail: browser || '安装 Chrome/Edge，或设置 CHROME_PATH' },
    ...Object.entries(bins).map(([name, bin]) => ({ name, ok: !!bin, detail: bin || `由 agent 准备到 .cache/ffmpeg/bin，或设置 ${name.toUpperCase()}；见 SKILL.md 的环境准备` }))
  ];
  if (bins.ffmpeg) {
    const enc = run(bins.ffmpeg, ['-hide_banner', '-encoders']);
    checks.push({ name: 'libx264 + AAC', ok: /\blibx264\b/.test(enc) && /\baac\b/.test(enc), detail: 'MP4 编码器' });
  }
  return { ok: checks.every(c => c.ok), checks, browser, ...bins };
}
