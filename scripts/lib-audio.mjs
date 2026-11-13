import fs from 'node:fs';
import path from 'node:path';
import { inside, hash, writeJson } from './lib-cli.mjs';
import { binaries, run } from './lib-machine.mjs';

export function planMix(config, root, durationOf) {
  const duration = config.duration;
  if (!Number.isFinite(duration) || duration <= 0 || duration > 3600) throw Error('混音 duration 应在 0–3600 秒之间');
  if (!Array.isArray(config.tracks) || !config.tracks.length || config.tracks.length > 64) throw Error('混音需要 1–64 条 tracks');
  const inputArgs = [], filters = [], tracks = [];
  const groups = { narration: [], music: [], sfx: [] };
  const scalar = (v, fallback, min, max, name) => {
    const n = v ?? fallback;
    if (!Number.isFinite(n) || n < min || n > max) throw Error('无效混音参数：' + name);
    return n;
  };
  config.tracks.forEach((track, i) => {
    if (typeof track.src !== 'string' || !track.src || path.isAbsolute(track.src) || /^[a-z]+:/i.test(track.src)) throw Error('音频 src 必须是混音配置目录内的相对路径');
    const file = path.resolve(root, track.src);
    if (!inside(root, file) || !fs.existsSync(file) || !inside(fs.realpathSync(root), fs.realpathSync(file)) || !fs.statSync(file).isFile()) throw Error('音频文件缺失或越出项目：' + track.src);
    const role = track.role ?? 'sfx';
    if (!Object.hasOwn(groups, role)) throw Error('role 使用 narration/music/sfx');
    const sourceDuration = durationOf(file);
    const start = scalar(track.start, 0, 0, duration, 'start');
    const trim = scalar(track.trim, 0, 0, sourceDuration, 'trim');
    if (start >= duration || trim >= sourceDuration) throw Error('start/trim 超出有效时长');
    if (track.loop !== undefined && typeof track.loop !== 'boolean') throw Error('loop 应为布尔值');
    const length = scalar(track.duration, track.loop ? duration - start : Math.min(duration - start, sourceDuration - trim), 0, duration - start, 'track.duration');
    if (length <= 0 || (!track.loop && length > sourceDuration - trim + 1e-6)) throw Error('音频片段超出源文件；重复配乐请声明 loop: true');
    const volume = scalar(track.volume, 1, 0, 8, 'volume');
    const fadeIn = scalar(track.fadeIn, 0, 0, length, 'fadeIn'), fadeOut = scalar(track.fadeOut, 0, 0, length, 'fadeOut');
    if (track.loop) inputArgs.push('-stream_loop', '-1');
    inputArgs.push('-i', file);
    const chain = [`atrim=start=${trim}:duration=${length}`, 'asetpts=PTS-STARTPTS', 'aresample=48000', 'aformat=sample_fmts=fltp:channel_layouts=stereo', `volume=${volume}`];
    if (fadeIn) chain.push(`afade=t=in:st=0:d=${fadeIn}`);
    if (fadeOut) chain.push(`afade=t=out:st=${length - fadeOut}:d=${fadeOut}`);
    chain.push(`adelay=delays=${Math.round(start * 48000)}S:all=1`, 'apad', `atrim=duration=${duration}`);
    filters.push(`[${i}:a]${chain.join(',')}[t${i}]`);
    groups[role].push(`t${i}`);
    tracks.push({ src: track.src, role, start, trim, duration: length, volume, fadeIn, fadeOut, loop: !!track.loop, file });
  });
  const mix = (labels, name) => {
    filters.push(labels.map(l => `[${l}]`).join('') + (labels.length === 1 ? 'anull' : `amix=inputs=${labels.length}:duration=longest:normalize=0:dropout_transition=0`) + `[${name}]`);
    return name;
  };
  const outputs = [];
  let narration;
  if (groups.narration.length) narration = mix(groups.narration, 'voice');
  if (groups.music.length) {
    const music = mix(groups.music, 'music');
    if (narration && config.ducking !== false) {
      const d = config.ducking ?? {};
      const threshold = scalar(d.threshold, 0.025, 0.001, 1, 'ducking.threshold');
      const ratio = scalar(d.ratio, 8, 1, 20, 'ducking.ratio');
      const attack = scalar(d.attack, 20, 0.01, 2000, 'ducking.attack'), release = scalar(d.release, 250, 0.01, 9000, 'ducking.release');
      filters.push('[voice]asplit=2[voiceMix][voiceSide]');
      filters.push(`[music][voiceSide]sidechaincompress=threshold=${threshold}:ratio=${ratio}:attack=${attack}:release=${release}[ducked]`);
      narration = 'voiceMix'; outputs.push('ducked');
    } else outputs.push(music);
  }
  if (narration) outputs.push(narration);
  if (groups.sfx.length) outputs.push(mix(groups.sfx, 'effects'));
  mix(outputs, 'combined');
  filters.push(`[combined]alimiter=limit=0.95:level=0:latency=1,apad,atrim=duration=${duration}[master]`);
  return { duration, tracks, inputArgs, filter: filters.join(';') };
}

export function mixAudio(configFile, output) {
  const root = path.dirname(path.resolve(configFile));
  const { ffmpeg, ffprobe } = binaries();
  if (!ffmpeg || !ffprobe) throw Error('混音需要 FFmpeg/ffprobe；先按环境说明准备');
  if (fs.existsSync(output)) throw Error('混音输出已存在，请使用新文件名：' + output);
  const ext = path.extname(output).toLowerCase();
  if (!['.wav', '.m4a'].includes(ext)) throw Error('混音输出使用 wav 或 m4a');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8').replace(/^\uFEFF/, ''));
  const plan = planMix(config, root, file => {
    const result = JSON.parse(run(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]));
    const duration = Number(result.format.duration);
    if (!result.streams.some(s => s.codec_type === 'audio') || !Number.isFinite(duration) || duration <= 0) throw Error('没有有效音轨：' + file);
    return duration;
  });
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  // 独立临时产物完成后才发布，失败时不留下可被预览误用的半成品。
  const temp = path.join(path.dirname(output), `.${path.basename(output, ext)}-${process.pid}-${Date.now()}${ext}`);
  try {
    run(ffmpeg, ['-v', 'error', '-n', ...plan.inputArgs, '-filter_complex', plan.filter, '-map', '[master]', '-t', String(plan.duration), '-ar', '48000', '-ac', '2', '-c:a', ext === '.wav' ? 'pcm_s16le' : 'aac', ...(ext === '.m4a' ? ['-b:a', '192k'] : []), temp], { timeout: 600000 });
    fs.renameSync(temp, output);
  } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
  const report = { duration: plan.duration, output: path.resolve(output), sha256: hash(fs.readFileSync(output)), ducking: config.ducking !== false, filter: plan.filter, tracks: plan.tracks.map(({ file, ...t }) => ({ ...t, sha256: hash(fs.readFileSync(file)) })) };
  writeJson(output + '.mix.json', report);
  return report;
}
