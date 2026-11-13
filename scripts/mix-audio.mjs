import { args, allowArgs, main } from './lib-cli.mjs';
import { mixAudio } from './lib-audio.mjs';
await main(() => {
  const o = args(); allowArgs(o, ['out']);
  if (o._.length !== 1 || !o.out) throw Error('用法：node scripts/mix-audio.mjs <项目/mix.json> --out <项目/assets/master.wav|master.m4a>');
  const report = mixAudio(o._[0], o.out);
  console.log(`混音完成：${report.output} · ${report.duration}s · ${report.tracks.length} 条素材。将此文件接入 audio.src，先在 HTML 中试听。`);
});
