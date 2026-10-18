// 修改 timeline.js 或 music.js 后运行：node <本文件>。通过 FFMPEG 环境变量指定可执行文件。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.dirname(fileURLToPath(import.meta.url));
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const wav = path.join(os.tmpdir(), `abyss-score-${process.pid}.wav`);
const target = path.join(root, 'assets', 'score.m4a');
const pending = path.join(root, 'assets', `score-${process.pid}.m4a`);
function run(args) {
  const r = spawnSync(ffmpeg, args, { encoding: 'utf8', windowsHide: true, timeout: 300000 });
  if (r.error || r.status !== 0) throw Error(r.error?.message || r.stderr);
  return r.stderr;
}
try {
  const ctx = vm.createContext({ window: {} });
  for (const file of ['timeline.js', 'music.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, { filename: file });
  fs.writeFileSync(wav, ctx.window.makeTechScore(ctx.window.ABYSS_TIMING.duration));
  const analysis = run(['-hide_banner', '-i', wav, '-af', 'loudnorm=I=-16:TP=-2:LRA=11:print_format=json', '-f', 'null', '-']);
  const stats = JSON.parse(analysis.match(/\{[^{}]*"input_i"[^{}]*\}/s)?.[0] || '{}');
  if (!Number.isFinite(Number(stats.input_i))) throw Error('未取得音轨响度');
  const filter = `loudnorm=I=-16:TP=-2:LRA=11:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true`;
  run(['-v', 'error', '-n', '-i', wav, '-af', filter, '-ar', '48000', '-ac', '2', '-c:a', 'aac', '-b:a', '192k', pending]);
  fs.renameSync(pending, target);
  console.log(`已重建 ${target}\n120 BPM · 60s · stereo AAC · 目标 -16 LUFS / 编码前 -2 dBTP`);
} finally {
  for (const file of [wav, pending]) if (fs.existsSync(file)) fs.unlinkSync(file);
}
