import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { hash, inside } from './lib-cli.mjs';
export async function fileHash(file) {
  const digest = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) digest.update(chunk);
  return digest.digest('hex');
}
export async function projectSnapshot(root, output) {
  root = path.resolve(root); output = path.resolve(output);
  if (root === output || inside(output, root)) throw Error('导出目录不能包含或等于源项目目录');
  const files = [];
  async function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const file = path.join(dir, e.name);
      if (file === output || ['.git', '.cache', 'node_modules', '.test-output'].includes(e.name)) continue;
      if (e.isSymbolicLink()) throw Error('为可靠核对续跑版本，请将符号链接素材复制到项目：' + file);
      if (e.isDirectory()) await walk(file);
      else if (e.isFile()) files.push({ file: path.relative(root, file).split(path.sep).join('/'), sha256: await fileHash(file) });
    }
  }
  await walk(root);
  return { sha256: hash(JSON.stringify(files)), files };
}
export async function rendererHash() {
  const root = fileURLToPath(new URL('./', import.meta.url)), entries = [];
  for (const name of fs.readdirSync(root).filter(n => n.endsWith('.mjs')).sort()) entries.push([name, await fileHash(path.join(root, name))]);
  entries.push(['templates/captions.js', await fileHash(fileURLToPath(new URL('../templates/captions.js', import.meta.url)))]);
  return hash(JSON.stringify(entries));
}
export function fingerprint(identity) { return hash(JSON.stringify(identity)); }
export function assertResume(previous, identity) {
  if (previous.version !== 2 || previous.movie !== 'video.mp4' || !previous.frameHashes || typeof previous.frameHashes !== 'object' || Array.isArray(previous.frameHashes) || previous.fingerprint !== fingerprint(identity) || fingerprint(previous.identity) !== previous.fingerprint) throw Error('无法续跑：报告不完整，或源码、素材、浏览器、导出工具、参数已变化。请使用新的 --out 目录。');
}
export function validFrame(file, expectedHash, width, height) {
  if (typeof expectedHash !== 'string' || !fs.existsSync(file)) return false;
  const bytes = fs.readFileSync(file);
  return bytes.length > 32 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.readUInt32BE(16) === width && bytes.readUInt32BE(20) === height && hash(bytes) === expectedHash;
}
export function estimateFrames(samples, frames, remaining = frames) {
  if (!samples.length) throw Error('耗时估算需要抽样帧');
  const ms = samples.reduce((sum, s) => sum + s.ms, 0) / samples.length;
  const bytes = samples.reduce((sum, s) => sum + s.bytes, 0) / samples.length;
  return { frames, remainingFrames: remaining, sampledFrames: samples.length, renderSeconds: remaining * ms / 1000, frameBytes: Math.ceil(frames * bytes), remainingFrameBytes: Math.ceil(remaining * bytes) };
}
export function acquireLock(out) {
  const file = path.join(out, '.render.lock'), token = randomUUID();
  if (fs.existsSync(file)) {
    let old;
    try { old = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw Error('导出锁损坏，请确认没有运行中的导出后处理 .render.lock'); }
    if (old.host !== os.hostname() || !Number.isInteger(old.pid)) throw Error('输出目录由其他机器或未知进程锁定');
    let alive = true;
    try { process.kill(old.pid, 0); } catch (e) { if (e.code === 'ESRCH') alive = false; }
    if (alive) throw Error('该输出目录已有导出进程：' + old.pid);
    fs.unlinkSync(file);
  }
  fs.writeFileSync(file, JSON.stringify({ pid: process.pid, host: os.hostname(), token }), { flag: 'wx' });
  return () => { if (fs.existsSync(file) && JSON.parse(fs.readFileSync(file, 'utf8')).token === token) fs.unlinkSync(file); };
}
