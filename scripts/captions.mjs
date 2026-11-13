import fs from 'node:fs';
import path from 'node:path';
import { args, allowArgs, main } from './lib-cli.mjs';
import '../templates/captions.js';
await main(() => {
  const o = args(); allowArgs(o, ['out']);
  if (o._.length !== 1 || !o.out) throw Error('用法：node scripts/captions.mjs <字幕.srt|字幕.json> --out <字幕.js|字幕.json|字幕.srt|字幕.vtt>');
  const source = fs.readFileSync(o._[0], 'utf8'), C = globalThis.VideoCaptions;
  const cues = path.extname(o._[0]).toLowerCase() === '.srt' ? C.parseSrt(source) : C.normalize(JSON.parse(source));
  const ext = path.extname(o.out).toLowerCase();
  const content = ext === '.srt' ? C.toSrt(cues) : ext === '.vtt' ? C.toVtt(cues) : ext === '.json' ? JSON.stringify(cues, null, 2) + '\n' : ext === '.js' ? 'window.VIDEO_CAPTIONS = ' + JSON.stringify(cues, null, 2) + ';\n' : null;
  if (content === null) throw Error('输出扩展名使用 js/json/srt/vtt');
  fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
  fs.writeFileSync(o.out, content, { flag: 'wx' });
  console.log(`已生成 ${cues.length} 条字幕：${o.out}；JS 用普通 script 加载后设 captions: window.VIDEO_CAPTIONS。`);
});
