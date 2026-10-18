import path from 'node:path';
import { args, allowArgs, number, main } from './lib/cli.mjs';
import { verify } from './lib/verify.mjs';
await main(() => {
  const o = args(); allowArgs(o, ['mae']);
  if (o._.length !== 1) throw Error('用法：node tools/verify.mjs <导出目录> [--mae 8]');
  const result = verify(path.resolve(o._[0]), number(o.mae, 8, 0, 255, 'mae'));
  for (const c of result.checks) console.log(`${c.ok ? '✓' : '✗'} ${c.name}: ${typeof c.detail === 'object' ? JSON.stringify(c.detail) : c.detail}`);
  if (!result.ok) throw Error('成片验收未通过，详见 verify-report.json');
});
