import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { args, allowArgs, format, main, writeJson } from './lib/cli.mjs';
import { launch } from './lib/chrome.mjs';
import { htmlFile, openProject, frame, sampleFrames, deterministic, playbackCheck } from './lib/project.mjs';
await main(async () => {
  const o = args(); allowArgs(o, ['format', 'out']);
  if (o._.length !== 1) throw Error('用法：node tools/check.mjs <项目或HTML> [--format portrait] [--out 目录]');
  const file = htmlFile(o._[0]), mode = format(o.format);
  const out = path.resolve(o.out || path.join('output', 'preview-' + mode));
  fs.mkdirSync(out, { recursive: true });
  const browser = await launch();
  const report = { ok: false, file, format: mode, checkedAt: new Date().toISOString() };
  try {
    const p = await openProject(browser, file, mode);
    report.meta = p.meta;
    const samples = sampleFrames(p.meta);
    console.log(`检查 ${samples.length} 个时间点的乱序定位一致性…`);
    report.determinism = await deterministic(p, samples);
    report.playback = await playbackCheck(browser, file, mode);
    const pics = [];
    for (const c of p.meta.chapters) {
      const i = p.meta.chapters.indexOf(c), end = p.meta.chapters[i + 1]?.at ?? p.meta.duration;
      const n = Math.floor((c.at + end) / 2 * p.meta.fps), name = `frame-${String(n).padStart(6, '0')}.png`;
      fs.writeFileSync(path.join(out, name), await frame(p, n));
      pics.push({ name, title: c.title, time: n / p.meta.fps });
    }
    const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const cellW = mode === 'portrait' ? 280 : 440;
    const cellH = mode === 'portrait' ? 540 : 292;
    fs.writeFileSync(path.join(out, 'sheet.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>关键帧总览</title><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#e8edf3;font:14px Arial,"Microsoft YaHei",sans-serif;color:#15213a}h1{font-size:22px;margin:0 0 20px}.grid{display:grid;grid-template-columns:repeat(3,${cellW}px);gap:16px}figure{margin:0;background:white;padding:10px;border-radius:8px;height:${cellH}px}img{display:block;width:100%;height:${mode === 'portrait' ? 462 : 236}px;object-fit:contain;background:#10182c}figcaption{margin-top:10px}</style><h1>${escape(p.meta.title)} · ${p.meta.width} × ${p.meta.height}</h1><div class="grid">${pics.map(c => `<figure><img src="${c.name}"><figcaption>${escape(c.title)} · ${c.time.toFixed(2)}s</figcaption></figure>`).join('')}</div></html>`);
    const sheet = await browser.newPage();
    await sheet.viewport(48 + cellW * 3 + 32, 100 + Math.ceil(pics.length / 3) * (cellH + 16));
    await sheet.goto(pathToFileURL(path.join(out, 'sheet.html')).href);
    await sheet.eval(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images).map(i => i.decode())); });
    fs.writeFileSync(path.join(out, 'sheet.png'), await sheet.screenshot());
    report.ok = true;
    console.log('通过：file:// 资源、乱序定位、播放/暂停/拖动/重播。请目检 ' + path.join(out, 'sheet.png'));
  } catch (e) { report.error = e.message; throw e; }
  finally { writeJson(path.join(out, 'check-report.json'), report); await browser.close(); }
});
