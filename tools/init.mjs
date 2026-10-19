import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { args, allowArgs, format, number, main } from './lib-cli.mjs';
await main(() => {
  const o = args(); allowArgs(o, ['format', 'fps', 'duration', 'title']);
  if (o._.length !== 1) throw Error('用法：node tools/init.mjs <新目录> [--format landscape|portrait] [--fps 30] [--duration 8]');
  const target = path.resolve(o._[0]);
  if (fs.existsSync(target)) throw Error('目标已存在；请选择新的项目目录，初始化不会覆盖文件：' + target);
  const mode = format(o.format), fps = number(o.fps, 30, 24, 60, 'fps');
  if (![24, 25, 30, 50, 60].includes(fps)) throw Error('fps 使用 24/25/30/50/60');
  const duration = number(o.duration, 8, 5, 3600, 'duration');
  const template = fileURLToPath(new URL('../template/', import.meta.url));
  // 按文件复制，避免部分 Windows Node 发行版 cpSync 对中文目标路径的异常。
  fs.mkdirSync(target, { recursive: true });
  for (const name of fs.readdirSync(template)) fs.copyFileSync(path.join(template, name), path.join(target, name));
  const file = path.join(target, 'project.js');
  const title = JSON.stringify(o.title || path.basename(target)).slice(1, -1).replace(/'/g, "\\'");
  const text = fs.readFileSync(file, 'utf8').replace('__TITLE__', () => title).replaceAll('__FORMAT__', mode).replace('__FPS__', String(fps)).replace('__DURATION__', String(duration));
  fs.writeFileSync(file, text);
  console.log(`项目已创建：${target}\n双击 index.html 即可播放；修改 project.js 创作画面。\n导出命令仍在技能目录运行，不需要把 tools 复制进项目。`);
});
