import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import '../templates/captions.js';
import { sampleFrames } from '../scripts/lib-project.mjs';
import { hash, inside } from '../scripts/lib-cli.mjs';
import { planMix } from '../scripts/lib-audio.mjs';
import { projectSnapshot, fingerprint, assertResume, validFrame, estimateFrames, acquireLock } from '../scripts/lib-render-state.mjs';
const C = globalThis.VideoCaptions, root = fileURLToPath(new URL('../', import.meta.url));
function temp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'h2v-feature-')); }
function clean(dir) { assert.ok(inside(os.tmpdir(), dir) && path.basename(dir).startsWith('h2v-feature-')); fs.rmSync(dir, { recursive: true, force: true }); }
test('字幕 SRT/JSON 往返、多行、重叠及结束边界一致', () => {
  const source = '\uFEFF1\r\n00:00:00,250 --> 00:00:01,000\r\n你好\r\n第二行\r\n\r\n2\r\n00:00:01,000 --> 00:00:02,125\r\nWorld\r\n';
  const cues = C.parseSrt(source);
  assert.equal(cues[0].text, '你好\n第二行');
  assert.deepEqual(C.parseSrt(C.toSrt(cues)), cues);
  assert.equal(C.active(cues, 1)[0].text, 'World');
  assert.equal(C.active(cues, 2.125).length, 0);
  assert.equal(C.active([...cues, { start: 0.5, end: 1.5, text: '重叠' }], 0.75).length, 2);
  assert.match(C.toVtt(cues), /^WEBVTT\n\n00:00:00\.250/);
  assert.throws(() => C.normalize([{ start: 1, end: 1, text: 'x' }]));
  assert.throws(() => C.normalize(cues, 2));
  assert.throws(() => C.parseSrt('1\n00:61:00,000 --> 00:62:00,000\nx'));
  const samples = sampleFrames({ frames: 90, fps: 30, duration: 3, chapters: [], captions: [{ start: 1, end: 2 }] });
  for (const n of [29, 30, 59, 60]) assert.ok(samples.includes(n));
});
test('字幕转换可直接加载到 file:// 项目，拒绝覆盖输出', () => {
  const dir = temp();
  try {
    const input = path.join(dir, '字幕.srt'), out = path.join(dir, '字幕.js');
    fs.writeFileSync(input, '1\n00:00:00,000 --> 00:00:01,000\n你好\n');
    const call = () => spawnSync(process.execPath, ['scripts/captions.mjs', input, '--out', out], { cwd: root, encoding: 'utf8', windowsHide: true });
    assert.equal(call().status, 0);
    assert.match(fs.readFileSync(out, 'utf8'), /window.VIDEO_CAPTIONS =/);
    const before = fs.readFileSync(out); assert.notEqual(call().status, 0); assert.deepEqual(fs.readFileSync(out), before);
  } finally { clean(dir); }
});
test('混音规划保留素材起点、裁剪、淡入淡出，并仅压低配乐', () => {
  const dir = temp();
  try {
    fs.writeFileSync(path.join(dir, 'voice.wav'), 'fixture'); fs.writeFileSync(path.join(dir, 'music.wav'), 'fixture');
    const config = { duration: 5, tracks: [{ src: 'voice.wav', role: 'narration', start: 1, trim: 0.2, duration: 1, volume: 0.8 }, { src: 'music.wav', role: 'music', loop: true, fadeIn: 0.2, fadeOut: 0.3 }] };
    const p = planMix(config, dir, () => 2);
    assert.equal(p.tracks[0].duration, 1);
    assert.match(p.filter, /atrim=start=0.2:duration=1/);
    assert.match(p.filter, /adelay=delays=48000S:all=1/);
    assert.match(p.filter, /afade=t=out:st=4.7:d=0.3/);
    assert.match(p.filter, /\[music\]\[voiceSide\]sidechaincompress/);
    assert.ok(p.inputArgs.includes('-stream_loop'));
    assert.doesNotMatch(planMix({ ...config, ducking: false }, dir, () => 2).filter, /sidechaincompress/);
    assert.throws(() => planMix({ duration: 1, tracks: [{ src: '../outside.wav' }] }, dir, () => 2));
    assert.throws(() => planMix({ duration: 1, tracks: [{ src: 'voice.wav', volume: -1 }] }, dir, () => 2));
  } finally { clean(dir); }
});
test('续跑指纹覆盖素材、排除自己的输出，参数变化拒绝复用', async () => {
  const dir = temp();
  try {
    const out = path.join(dir, 'output'); fs.mkdirSync(out); fs.writeFileSync(path.join(dir, 'index.html'), 'html'); fs.writeFileSync(path.join(dir, 'voice.wav'), 'v1');
    const a = await projectSnapshot(dir, out);
    fs.writeFileSync(path.join(out, 'render.json'), '{}'); assert.deepEqual(await projectSnapshot(dir, out), a);
    fs.writeFileSync(path.join(dir, 'voice.wav'), 'v2'); assert.notEqual((await projectSnapshot(dir, out)).sha256, a.sha256);
    const identity = { source: a.sha256, fps: 30, browser: 'a' }, previous = { version: 2, identity, movie: 'video.mp4', frameHashes: {}, fingerprint: fingerprint(identity) };
    assert.doesNotThrow(() => assertResume(previous, identity));
    assert.throws(() => assertResume(previous, { ...identity, fps: 60 }));
    assert.throws(() => assertResume({ ...previous, version: 1 }, identity));
    assert.throws(() => assertResume({ ...previous, movie: '../outside.mp4' }, identity));
    await assert.rejects(projectSnapshot(dir, dir));
  } finally { clean(dir); }
});
test('续跑只认尺寸及哈希匹配的帧，估算按剩余帧计算，锁阻止并发', () => {
  const dir = temp();
  try {
    const png = Buffer.alloc(40); Buffer.from([137,80,78,71,13,10,26,10]).copy(png); png.writeUInt32BE(1920, 16); png.writeUInt32BE(1080, 20);
    const file = path.join(dir, 'frame.png'); fs.writeFileSync(file, png);
    assert.ok(validFrame(file, hash(png), 1920, 1080)); assert.equal(validFrame(file, hash(png), 1080, 1920), false);
    fs.appendFileSync(file, 'bad'); assert.equal(validFrame(file, hash(png), 1920, 1080), false);
    const e = estimateFrames([{ ms: 100, bytes: 1000 }, { ms: 200, bytes: 2000 }], 100, 20);
    assert.equal(e.renderSeconds, 3); assert.equal(e.remainingFrameBytes, 30000);
    const release = acquireLock(dir); assert.throws(() => acquireLock(dir)); release(); acquireLock(dir)();
  } finally { clean(dir); }
});
