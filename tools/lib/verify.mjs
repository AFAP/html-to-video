import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJson, hash, inside } from './cli.mjs';
import { binaries, run } from './machine.mjs';
export function verify(out, maxMae = 8) {
  const manifest = readJson(path.join(out, 'render.json'));
  const checks = [], { ffmpeg, ffprobe } = binaries();
  const check = (name, ok, detail) => checks.push({ name, ok, detail });
  const movie = path.resolve(out, manifest.movie);
  if (!inside(out, movie)) throw Error('render.json 中的影片路径越出输出目录');
  const report = { ok: false, checkedAt: new Date().toISOString(), movie, checks };
  try {
    if (!Number.isInteger(manifest.frames) || manifest.frames < 1 || !Number.isFinite(manifest.fps) || manifest.fps <= 0) throw Error('渲染清单缺少有效帧数或帧率');
    if (!Array.isArray(manifest.samples) || !manifest.samples.length) throw Error('渲染清单没有原始样本，不能跳过画面验收');
    if (manifest.samples.some(s => !Number.isInteger(s.frame) || s.frame < 0 || s.frame >= manifest.frames || typeof s.file !== 'string')) throw Error('样本编号或路径无效');
    const digest = hash(fs.readFileSync(movie));
    if (manifest.movieSha256) check('影片哈希', digest === manifest.movieSha256, digest);
    const info = JSON.parse(run(ffprobe, ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', movie], { timeout: 300000 }));
    const v = info.streams.find(s => s.codec_type === 'video'), a = info.streams.find(s => s.codec_type === 'audio');
    if (!v) throw Error('文件没有视频轨');
    const [n, d] = v.avg_frame_rate.split('/').map(Number);
    check('尺寸', v.width === manifest.width && v.height === manifest.height, `${v.width}x${v.height}`);
    check('帧率', Math.abs(n / d - manifest.fps) < 1e-6, v.avg_frame_rate);
    check('帧数', Number(v.nb_read_frames) === manifest.frames, `${v.nb_read_frames} / ${manifest.frames}`);
    check('视频时长', Math.abs(Number(v.duration) - manifest.duration) <= 1 / manifest.fps + 0.001, Number(v.duration));
    check('H.264 / yuv420p', v.codec_name === 'h264' && v.pix_fmt === 'yuv420p', `${v.codec_name} / ${v.pix_fmt}`);
    check('音轨', manifest.audio ? a?.codec_name === 'aac' : !a, a?.codec_name || '无音轨（按项目声明）');
    if (manifest.audio && a) check('音轨时长', Math.abs(Number(a.duration) - manifest.duration) < 0.1, Number(a.duration));
    run(ffmpeg, ['-v', 'error', '-xerror', '-i', movie, '-f', 'null', '-'], { timeout: 300000 });
    check('全片解码', true, '无解码错误');
    const w = manifest.width > manifest.height ? 320 : 180, h = manifest.width > manifest.height ? 180 : 320;
    for (const s of manifest.samples) {
      const reference = path.resolve(out, s.file);
      if (!inside(out, reference)) throw Error('样本路径越出输出目录');
      const ref = run(ffmpeg, ['-v', 'error', '-i', reference, '-vf', `scale=${w}:${h}`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { binary: true });
      const dec = run(ffmpeg, ['-v', 'error', '-i', movie, '-vf', `select=eq(n\\,${s.frame}),scale=${w}:${h}`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { binary: true, timeout: 300000 });
      if (ref.length !== w * h * 3 || dec.length !== ref.length) throw Error('无法解码样本帧 ' + s.frame);
      let sum = 0;
      for (let i = 0; i < ref.length; i++) sum += Math.abs(ref[i] - dec[i]);
      const mae = sum / ref.length;
      check(`样本帧 ${s.frame}`, mae <= maxMae, { mae: Number(mae.toFixed(3)), threshold: maxMae });
    }
    report.sha256 = digest;
    report.ok = checks.every(c => c.ok);
  } catch (e) { check('验收执行', false, e.message); }
  writeJson(path.join(out, 'verify-report.json'), report);
  return report;
}
