import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { format, args, inside } from '../tools/lib-cli.mjs';
import { sampleFrames } from '../tools/lib-project.mjs';
import { binaries } from '../tools/lib-machine.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
test('参数拒绝无效画幅、缺失值与目录逃逸', () => {
  assert.equal(format('1080x1920'), 'portrait');
  assert.throws(() => format('square'));
  assert.throws(() => args(['--out']));
  assert.deepEqual(args(['--smoke', '--format', 'portrait'], ['smoke']).smoke, true);
  assert.equal(inside(root, path.resolve(root, '../other')), false);
});
test('抽样覆盖章节切点两侧，冒烟不会借用全片的帧', () => {
  const meta = { frames: 1080, fps: 30, duration: 36, chapters: [{ at: 0 }, { at: 5 }, { at: 11 }] };
  const samples = sampleFrames(meta);
  for (const n of [0, 1079, 149, 150, 151, 329, 330, 331]) assert.ok(samples.includes(n));
  assert.ok(sampleFrames(meta, 60).every(n => n >= 0 && n < 60));
});
test('初始化中文空格目录，已有内容不被覆盖', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'h2v-test-'));
  try {
    const target = path.join(temp, '中文 空格项目');
    const call = () => spawnSync(process.execPath, ['tools/init.mjs', target, '--format', 'portrait', '--title', "测试'标题"], { cwd: root, encoding: 'utf8', windowsHide: true });
    const a = call(); assert.equal(a.status, 0, a.stderr);
    const file = path.join(target, 'project.js'), source = fs.readFileSync(file, 'utf8');
    assert.ok(!/__TITLE__|__FORMAT__|__FPS__|__DURATION__/.test(source));
    assert.equal(spawnSync(process.execPath, ['--check', file], { windowsHide: true }).status, 0);
    fs.writeFileSync(path.join(target, 'keep.txt'), 'keep');
    assert.equal(call().status, 1); assert.equal(fs.readFileSync(path.join(target, 'keep.txt'), 'utf8'), 'keep');
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
test('私有 FFmpeg 路径可发现，无须修改系统 PATH', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'h2v-tools-'));
  const keys = ['PATH', 'FFMPEG', 'FFPROBE', 'HTML_VIDEO_FFMPEG_DIR'];
  const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  try {
    const suffix = process.platform === 'win32' ? '.exe' : '';
    for (const name of ['ffmpeg', 'ffprobe']) fs.writeFileSync(path.join(temp, name + suffix), 'fixture');
    process.env.PATH = ''; delete process.env.FFMPEG; delete process.env.FFPROBE;
    process.env.HTML_VIDEO_FFMPEG_DIR = temp;
    const found = binaries();
    assert.equal(found.ffmpeg, path.join(temp, 'ffmpeg' + suffix));
    assert.equal(found.ffprobe, path.join(temp, 'ffprobe' + suffix));
  } finally {
    for (const key of keys) if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('从其他工作目录发现技能内的 FFmpeg 缓存', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'h2v-skill-root-'));
  assert.ok(inside(os.tmpdir(), temp));
  try {
    const skill = path.join(temp, 'skill'), work = path.join(temp, 'work');
    const tools = path.join(skill, 'tools'), bin = path.join(skill, '.cache', 'ffmpeg', 'bin');
    fs.mkdirSync(tools, { recursive: true }); fs.mkdirSync(bin, { recursive: true }); fs.mkdirSync(work);
    const moduleFile = path.join(tools, 'lib-machine.mjs');
    fs.copyFileSync(path.join(root, 'tools', 'lib-machine.mjs'), moduleFile);
    const suffix = process.platform === 'win32' ? '.exe' : '';
    for (const name of ['ffmpeg', 'ffprobe']) fs.writeFileSync(path.join(bin, name + suffix), 'fixture');
    const env = { ...process.env, PATH: '' };
    for (const key of ['FFMPEG', 'FFPROBE', 'HTML_VIDEO_FFMPEG_DIR']) delete env[key];
    const script = `import { binaries } from ${JSON.stringify(pathToFileURL(moduleFile).href)}; process.stdout.write(JSON.stringify(binaries()));`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: work, env, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      ffmpeg: path.join(bin, 'ffmpeg' + suffix), ffprobe: path.join(bin, 'ffprobe' + suffix)
    });
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
