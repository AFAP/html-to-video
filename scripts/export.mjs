import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { args, allowArgs, format, number, main, writeJson, readJson, inside, hash } from './lib-cli.mjs';
import { doctor, run } from './lib-machine.mjs';
import { launch } from './lib-chrome.mjs';
import { htmlFile, openProject, frame, sampleFrames, deterministic } from './lib-project.mjs';
import { verify } from './lib-verify.mjs';
import { projectSnapshot, rendererHash, fingerprint, assertResume, validFrame, estimateFrames, acquireLock } from './lib-render-state.mjs';
import '../templates/captions.js';
await main(async () => {
  const o = args(undefined, ['smoke', 'silent', 'resume', 'estimate']);
  allowArgs(o, ['format', 'out', 'crf', 'preset', 'smoke', 'silent', 'resume', 'estimate']);
  if (o._.length !== 1) throw Error('用法：node scripts/export.mjs <项目或HTML> [--format portrait] [--smoke] [--out 目录] [--silent] [--estimate|--resume]');
  if (o.estimate && o.resume) throw Error('--estimate 与 --resume 不同时使用');
  const file = htmlFile(o._[0]), mode = format(o.format);
  const crf = number(o.crf, 18, 0, 35, 'crf'), preset = o.preset || 'medium';
  if (!['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow'].includes(preset)) throw Error('不支持的 preset');
  const env = doctor();
  if (!env.ok) throw Error('环境未就绪：' + env.checks.filter(c => !c.ok).map(c => c.detail).join('; '));
  const out = path.resolve(o.out || path.join('output', (o.smoke ? 'smoke-' : '') + mode)), reportFile = path.join(out, 'render.json');
  if (!o.estimate && !o.resume && fs.existsSync(out) && fs.readdirSync(out).length) throw Error('输出目录非空；使用新的 --out，或对同一版本使用 --resume：' + out);
  if (o.resume && !fs.existsSync(reportFile)) throw Error('续跑目录缺少 render.json');
  const snapshot = await projectSnapshot(path.dirname(file), out);
  let browser, release, manifest, stopped = false, writeReport = false;
  const stop = () => { stopped = true; };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  const checkpoint = () => { if (writeReport) writeJson(reportFile, manifest); };
  const abort = () => { if (stopped) throw Error('导出已中断；可使用同一参数和 --resume 继续'); };
  try {
    if (!o.estimate) { fs.mkdirSync(out, { recursive: true }); release = acquireLock(out); }
    browser = await launch();
    const p = await openProject(browser, file, mode);
    const count = o.smoke ? Math.min(p.meta.frames, p.meta.fps * 2) : p.meta.frames, audio = !o.silent && !!p.meta.audio;
    const identity = { source: snapshot.sha256, entry: path.basename(file), meta: p.meta, count, audio, crf, preset, smoke: !!o.smoke, browser: browser.version.product, browserPath: browser.executable, renderer: await rendererHash(), node: process.version, ffmpeg: run(env.ffmpeg, ['-version']).split(/\r?\n/)[0] };
    if (o.resume) {
      manifest = readJson(reportFile); assertResume(manifest, identity);
      Object.assign(manifest, p.meta, { version: 2, frames: count, duration: count / p.meta.fps, audio, crf, preset, smoke: !!o.smoke });
      if (manifest.status === 'complete') {
        const result = verify(out);
        if (!result.ok) throw Error('已有成片验收失败，请保留当前目录并使用新 --out 排查');
        console.log('已有成片完整且验收通过，无需重复导出：' + path.join(out, manifest.movie)); return;
      }
    } else manifest = { ...p.meta, version: 2, fingerprint: fingerprint(identity), identity, sourceFiles: snapshot.files, status: 'preparing', createdAt: new Date().toISOString(), source: file, sourceHtmlSha256: hash(fs.readFileSync(file)), movie: 'video.mp4', smoke: !!o.smoke, frames: count, duration: count / p.meta.fps, audio, browser: browser.executable, crf, preset, samples: [], frameHashes: {} };
    writeReport = !o.estimate;
    if (!o.estimate) {
      fs.mkdirSync(path.join(out, 'frames'), { recursive: true }); fs.mkdirSync(path.join(out, 'samples'), { recursive: true });
      manifest.status = 'preparing'; delete manifest.error; checkpoint();
    }
    const frameName = n => `frame-${String(n).padStart(6, '0')}.png`, reusable = new Set();
    if (o.resume) for (let n = 0; n < count; n++) if (validFrame(path.join(out, 'frames', frameName(n)), manifest.frameHashes?.[n], p.meta.width, p.meta.height)) reusable.add(n);
    const samples = sampleFrames(p.meta, count);
    const checks = await deterministic(p, samples);
    if (o.resume && manifest.determinism?.some(old => checks.some(now => old.frame === now.frame && old.sha256 !== now.sha256))) throw Error('采样画面与上次导出不同，不能复用旧帧；请检查字体或渲染环境，并使用新目录');
    manifest.determinism = checks;
    const timings = [], points = [...new Set([0, Math.floor(count / 4), Math.floor(count / 2), Math.floor(count * 3 / 4), count - 1])];
    for (const n of points) { abort(); const started = performance.now(), bytes = await frame(p, n); timings.push({ ms: performance.now() - started, bytes: bytes.length }); }
    const estimate = estimateFrames(timings, count, count - reusable.size);
    let diskPath = out;
    while (!fs.existsSync(diskPath)) diskPath = path.dirname(diskPath);
    const disk = fs.statfsSync(diskPath), freeBytes = Number(disk.bavail) * Number(disk.bsize);
    const requiredBytes = Math.ceil(estimate.remainingFrameBytes * 1.25 + (audio ? count / p.meta.fps * 48000 * 4 : 0) + 16 * 1024 * 1024);
    Object.assign(estimate, { requiredBytes, freeBytes, note: '抽样估算仅包含逐帧渲染；编码和验收另计，复杂镜头会影响实际耗时。' });
    console.log(`预计渲染剩余约 ${Math.ceil(estimate.renderSeconds)} 秒；需预留约 ${Math.ceil(requiredBytes / 1048576)} MiB，编码和验收另计。`);
    if (o.estimate) { console.log(JSON.stringify(estimate, null, 2)); return; }
    if (requiredBytes > freeBytes) throw Error('磁盘可用空间不足，请更换输出磁盘或清理空间');
    manifest.estimate = estimate; manifest.reusedFrames = reusable.size; checkpoint();
    if (reusable.size) console.log(`续跑复用 ${reusable.size}/${count} 帧；其余缺失或损坏帧将重新渲染。`);
    let track;
    if (audio) {
      let sourceAudio;
      if (p.meta.audio.type === 'file') {
        if (typeof p.meta.audio.src !== 'string' || path.isAbsolute(p.meta.audio.src) || /^[a-z]+:/i.test(p.meta.audio.src)) throw Error('音轨必须是项目内的相对文件路径');
        sourceAudio = path.resolve(path.dirname(file), p.meta.audio.src);
        if (!inside(path.dirname(file), sourceAudio) || !fs.existsSync(sourceAudio)) throw Error('缺少项目内的音轨文件：' + sourceAudio);
      } else {
        sourceAudio = path.join(out, 'source-audio.wav');
        const length = await p.page.eval('window.video.audioLength()');
        if (!Number.isInteger(length) || length < 44 || length > 512 * 1024 * 1024) throw Error('程序化 WAV 长度无效或超过 512MB');
        const fd = fs.openSync(sourceAudio, 'w');
        try {
          for (let offset = 0; offset < length; offset += 65536) { abort(); const chunk = await p.page.eval(offset => window.video.audioChunk(offset), offset); fs.writeSync(fd, Buffer.from(chunk, 'base64')); }
        } finally { fs.closeSync(fd); }
        if (fs.statSync(sourceAudio).size !== length) throw Error('WAV 分块传输长度不符');
      }
      track = path.join(out, 'master.wav');
      run(env.ffmpeg, ['-v', 'error', '-y', '-i', sourceAudio, '-af', 'apad', '-t', String(manifest.duration), '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', track], { timeout: 300000 });
    }
    if (p.meta.captions?.length) {
      const cues = p.meta.captions.filter(c => c.start < manifest.duration).map(c => ({ ...c, end: Math.min(c.end, manifest.duration) }));
      fs.writeFileSync(path.join(out, 'captions.srt'), globalThis.VideoCaptions.toSrt(cues)); fs.writeFileSync(path.join(out, 'captions.vtt'), globalThis.VideoCaptions.toVtt(cues));
    }
    manifest.status = 'rendering'; checkpoint();
    const sampleSet = new Set(samples), started = performance.now(); let rendered = 0;
    for (let n = 0; n < count; n++) {
      abort(); const name = frameName(n), target = path.join(out, 'frames', name);
      if (!reusable.has(n)) { const bytes = await frame(p, n); fs.writeFileSync(target + '.tmp', bytes); fs.renameSync(target + '.tmp', target); manifest.frameHashes[n] = hash(bytes); rendered++; }
      if (sampleSet.has(n)) fs.copyFileSync(target, path.join(out, 'samples', name));
      if (n % 30 === 0 || n === count - 1) {
        checkpoint(); const seconds = rendered ? (performance.now() - started) / 1000 / rendered * Math.max(0, count - reusable.size - rendered) : 0;
        console.log(`逐帧 ${n + 1}/${count} · 已复用 ${reusable.size} · 渲染剩余约 ${Math.ceil(seconds)} 秒`);
      }
    }
    for (let n = 0; n < count; n++) if (!validFrame(path.join(out, 'frames', frameName(n)), manifest.frameHashes[n], p.meta.width, p.meta.height)) throw Error('缺失或损坏帧：' + n);
    if ((await projectSnapshot(path.dirname(file), out)).sha256 !== snapshot.sha256) throw Error('导出期间源项目发生变化，请重新预览并使用新输出目录');
    manifest.samples = samples.map(n => ({ frame: n, file: 'samples/' + frameName(n) })); abort();
    const tempMovie = path.join(out, `video-${Date.now()}-${process.pid}.partial.mp4`);
    const ffargs = ['-hide_banner', '-loglevel', 'error', '-n', '-framerate', String(p.meta.fps), '-start_number', '0', '-i', path.join(out, 'frames', 'frame-%06d.png')];
    if (audio) ffargs.push('-i', track, '-map', '0:v:0', '-map', '1:a:0', '-c:a', 'aac', '-b:a', '192k'); else ffargs.push('-map', '0:v:0', '-an');
    ffargs.push('-frames:v', String(count), '-t', String(manifest.duration), '-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', tempMovie);
    manifest.status = 'encoding'; checkpoint(); console.log('合成 MP4…'); run(env.ffmpeg, ffargs, { timeout: 1800000 }); abort();
    const movie = path.join(out, manifest.movie);
    if (fs.existsSync(movie)) fs.renameSync(movie, path.join(out, `video-previous-${Date.now()}.mp4`));
    fs.renameSync(tempMovie, movie);
    manifest.status = 'verifying'; delete manifest.movieSha256; checkpoint();
    const result = verify(out);
    if (!result.ok) throw Error('成片验收失败：' + result.checks.filter(c => !c.ok).map(c => c.name + ' ' + JSON.stringify(c.detail)).join('; '));
    manifest.status = 'complete'; manifest.movieSha256 = result.sha256;
    console.log(`完成：${movie}\n${manifest.width} × ${manifest.height} · ${manifest.fps}fps · ${manifest.duration}s · ${count} 帧\n验收通过；帧序列保留在 frames/。`);
  } catch (e) { if (writeReport) { manifest.status = stopped ? 'interrupted' : 'failed'; manifest.error = e.message; } throw e; }
  finally { try { checkpoint(); } finally { try { await browser?.close(); } finally { release?.(); process.off('SIGINT', stop); process.off('SIGTERM', stop); } } }
});
