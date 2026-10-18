import fs from 'node:fs';
import path from 'node:path';
import { args, allowArgs, format, number, main, writeJson, inside, hash } from './lib/cli.mjs';
import { doctor, run } from './lib/machine.mjs';
import { launch } from './lib/chrome.mjs';
import { htmlFile, openProject, frame, sampleFrames, deterministic } from './lib/project.mjs';
import { verify } from './lib/verify.mjs';
await main(async () => {
  const o = args(undefined, ['smoke', 'silent']);
  allowArgs(o, ['format', 'out', 'crf', 'preset', 'smoke', 'silent']);
  if (o._.length !== 1) throw Error('用法：node tools/export.mjs <项目或HTML> [--format portrait] [--smoke] [--out 新目录] [--silent]');
  const file = htmlFile(o._[0]), mode = format(o.format);
  const crf = number(o.crf, 18, 0, 35, 'crf');
  const preset = o.preset || 'medium';
  if (!['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow'].includes(preset)) throw Error('不支持的 preset');
  const env = doctor();
  if (!env.ok) throw Error('环境未就绪：' + env.checks.filter(c => !c.ok).map(c => c.detail).join('; '));
  const out = path.resolve(o.out || path.join('output', (o.smoke ? 'smoke-' : '') + mode));
  if (fs.existsSync(out) && fs.readdirSync(out).length) throw Error('输出目录非空；请选择新的 --out 目录以保留已有成片：' + out);
  fs.mkdirSync(path.join(out, 'frames'), { recursive: true });
  fs.mkdirSync(path.join(out, 'samples'), { recursive: true });
  const browser = await launch();
  const manifest = { status: 'preparing', createdAt: new Date().toISOString(), source: file, sourceHtmlSha256: hash(fs.readFileSync(file)), movie: 'video.mp4', smoke: !!o.smoke, samples: [] };
  try {
    const p = await openProject(browser, file, mode);
    const count = o.smoke ? Math.min(p.meta.frames, p.meta.fps * 2) : p.meta.frames;
    Object.assign(manifest, p.meta, { frames: count, duration: count / p.meta.fps, audio: !o.silent && !!p.meta.audio, browser: browser.executable, crf, preset });
    const samples = sampleFrames(p.meta, count);
    manifest.determinism = await deterministic(p, samples);
    let track;
    if (manifest.audio) {
      let sourceAudio;
      if (p.meta.audio.type === 'file') {
        if (typeof p.meta.audio.src !== 'string' || /^[a-z]+:/i.test(p.meta.audio.src)) throw Error('音轨必须是项目内的相对文件路径');
        sourceAudio = path.resolve(path.dirname(file), p.meta.audio.src);
        if (!inside(path.dirname(file), sourceAudio) || !fs.existsSync(sourceAudio)) throw Error('缺少项目内的音轨文件：' + sourceAudio);
      } else {
        sourceAudio = path.join(out, 'source-audio.wav');
        const length = await p.page.eval('window.video.audioLength()');
        if (!Number.isInteger(length) || length < 44 || length > 512 * 1024 * 1024) throw Error('程序化 WAV 长度无效或超过 512MB');
        const fd = fs.openSync(sourceAudio, 'wx');
        try {
          for (let offset = 0; offset < length; offset += 65536) {
            const chunk = await p.page.eval(offset => window.video.audioChunk(offset), offset);
            fs.writeSync(fd, Buffer.from(chunk, 'base64'));
          }
        } finally { fs.closeSync(fd); }
        if (fs.statSync(sourceAudio).size !== length) throw Error('WAV 分块传输长度不符');
      }
      track = path.join(out, 'master.wav');
      run(env.ffmpeg, ['-v', 'error', '-n', '-i', sourceAudio, '-af', 'apad', '-t', String(manifest.duration), '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', track], { timeout: 300000 });
    }
    manifest.status = 'rendering'; writeJson(path.join(out, 'render.json'), manifest);
    const sampleSet = new Set(samples), started = Date.now();
    for (let n = 0; n < count; n++) {
      const bytes = await frame(p, n);
      const name = `frame-${String(n).padStart(6, '0')}.png`;
      fs.writeFileSync(path.join(out, 'frames', name), bytes);
      if (sampleSet.has(n)) {
        fs.writeFileSync(path.join(out, 'samples', name), bytes);
        manifest.samples.push({ frame: n, file: 'samples/' + name });
      }
      if (n % 60 === 0 || n === count - 1) console.log(`逐帧 ${n + 1}/${count} · ${((Date.now() - started) / 1000).toFixed(1)}s`);
    }
    // 本次运行独立目录且从 0 连续编号；缺失或空帧拒绝进入编码。
    for (let n = 0; n < count; n++) {
      const f = path.join(out, 'frames', `frame-${String(n).padStart(6, '0')}.png`);
      if (!fs.existsSync(f) || fs.statSync(f).size < 100) throw Error('缺失或损坏帧：' + n);
    }
    if (fs.readdirSync(path.join(out, 'frames')).length !== count) throw Error('帧目录数量不符');
    const ffargs = ['-hide_banner', '-loglevel', 'error', '-n', '-framerate', String(p.meta.fps), '-start_number', '0', '-i', path.join(out, 'frames', 'frame-%06d.png')];
    if (manifest.audio) {
      ffargs.push('-i', track, '-map', '0:v:0', '-map', '1:a:0', '-c:a', 'aac', '-b:a', '192k');
    } else ffargs.push('-map', '0:v:0', '-an');
    ffargs.push('-frames:v', String(count), '-t', String(manifest.duration), '-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, manifest.movie));
    manifest.status = 'encoding'; writeJson(path.join(out, 'render.json'), manifest);
    console.log('合成 MP4…');
    run(env.ffmpeg, ffargs, { timeout: 1800000 });
    manifest.status = 'verifying'; writeJson(path.join(out, 'render.json'), manifest);
    const result = verify(out);
    if (!result.ok) throw Error('成片验收失败：' + result.checks.filter(c => !c.ok).map(c => c.name + ' ' + JSON.stringify(c.detail)).join('; '));
    manifest.status = 'complete'; manifest.movieSha256 = result.sha256;
    console.log(`完成：${path.join(out, manifest.movie)}\n${manifest.width} × ${manifest.height} · ${manifest.fps}fps · ${manifest.duration}s · ${count} 帧\n验收通过；帧序列保留在 frames/，可在交付后按需删除。`);
  } catch (e) { manifest.status = 'failed'; manifest.error = e.message; throw e; }
  finally { writeJson(path.join(out, 'render.json'), manifest); await browser.close(); }
});
