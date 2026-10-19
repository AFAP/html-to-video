import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export function args(argv = process.argv.slice(2), flags = []) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (!item.startsWith('--')) { out._.push(item); continue; }
    const [key, ...rest] = item.slice(2).split('=');
    if (flags.includes(key)) {
      if (rest.length) throw Error(`--${key} 不接受值`);
      out[key] = true;
    } else {
      const value = rest.length ? rest.join('=') : argv[++i];
      if (!value || value.startsWith('--')) throw Error(`--${key} 缺少值`);
      out[key] = value;
    }
  }
  return out;
}
export function allowArgs(opts, names) {
  for (const key of Object.keys(opts)) if (key !== '_' && !names.includes(key)) throw Error(`未知参数 --${key}`);
}
export function number(value, fallback, min, max, label) {
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw Error(`${label} 应在 ${min}–${max} 之间`);
  return n;
}
export function format(value = 'landscape') {
  if (value === 'landscape' || value === '1920x1080') return 'landscape';
  if (value === 'portrait' || value === '1080x1920') return 'portrait';
  throw Error('--format 使用 landscape / portrait（或 1920x1080 / 1080x1920）');
}
export const sizes = { landscape: [1920, 1080], portrait: [1080, 1920] };
export const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}
export function inside(root, file) {
  const rel = path.relative(path.resolve(root), path.resolve(file));
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}
export async function main(fn) {
  try { await fn(); } catch (e) { console.error('失败：' + e.message); process.exitCode = 1; }
}
