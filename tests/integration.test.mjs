import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { binaries, run } from '../scripts/lib-machine.mjs';
import { launch } from '../scripts/lib-chrome.mjs';
import { openProject, frame } from '../scripts/lib-project.mjs';
import { mixAudio } from '../scripts/lib-audio.mjs';
import { readJson, writeJson } from '../scripts/lib-cli.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const testRoot = path.join(root, '.test-output'); fs.mkdirSync(testRoot, { recursive: true });
const work = fs.mkdtempSync(path.join(testRoot, 'features-'));
const cli = (...argv) => {
  const result = spawnSync(process.execPath, argv, { cwd: root, encoding: 'utf8', timeout: 180000, windowsHide: true });
  assert.equal(result.status, 0, result.stdout + '\n' + result.stderr);
  return result.stdout;
};
function demoProject(mode) {
  return `let scene;
window.VIDEO_PROJECT = {
 title: '组件与字幕测试', formats: ['${mode}'], defaultFormat: '${mode}', fps: 24, duration: 5,
 chapters: [{at:0,title:'开始'},{at:1,title:'旁白'},{at:2,title:'结束'}],
 audio: {src:'assets/master.wav'},
 captions: { cues: [{start:0,end:1,text:'第一句字幕'},{start:1,end:2,text:'第二句字幕'},{start:2,end:5,text:'字幕自动换行，随绝对时间定位。'}]},
 async setup(ctx) {
  ctx.stage.style.background='#101c38'; scene=VideoComponents.create(ctx.stage,ctx);
  scene.title({text:'组合画面组件',subtitle:'HTML 与 MP4 共用时间轴',start:0,end:5,enter:0,fontSize:ctx.width<ctx.height?64:80,rect:{x:.06,y:.04,width:.88,height:.14}});
  scene.counter({from:0,to:100,suffix:'%',start:0,end:5,enter:0,fontSize:84,rect:{x:.06,y:.23,width:.5,height:.15}});
  scene.image({src:'assets/card.svg',start:0,end:5,enter:0,zoomFrom:1,zoomTo:1.2,rect:{x:.67,y:.22,width:.27,height:.18}});
  scene.comparison({items:[{label:'方案 A',value:60},{label:'方案 B',value:90}],start:0,end:5,enter:0,fontSize:44,rect:{x:.06,y:.43,width:.88,height:.17}});
  scene.flow({steps:['内容','HTML','视频'],direction:'horizontal',start:0,end:5,enter:0,fontSize:ctx.width<ctx.height?28:42,rect:{x:.06,y:.62,width:.88,height:.1}});
  scene.lowerThird({text:'可复用字幕条',subtitle:'标题 / 数字 / 图表 / 流程 / 图片',start:0,end:5,animation:'zoom',enter:.6,fontSize:34,rect:{x:.06,y:.74,width:.88,height:.1}});
  await scene.ready();
 }, render(t) {scene.render(t);}
};`;
}
test('真实混音验证起点、循环、旁白避让及淡出', () => {
  const assets = path.join(work, 'audio'); fs.mkdirSync(assets);
  const { ffmpeg } = binaries();
  run(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1:sample_rate=48000', path.join(assets, 'voice.wav')]);
  run(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=880:duration=0.75:sample_rate=48000', path.join(assets, 'music.wav')]);
  const config = { duration: 5, tracks: [{ src: 'voice.wav', role: 'narration', start: 1 }, { src: 'music.wav', role: 'music', loop: true, volume: 0.6, fadeOut: 0.3 }] };
  const configFile = path.join(assets, 'mix.json'); writeJson(configFile, config);
  const ducked = path.join(assets, 'master.wav'); mixAudio(configFile, ducked);
  writeJson(configFile, { ...config, ducking: false }); const plain = path.join(assets, 'plain.wav'); mixAudio(configFile, plain);
  const decode = file => run(ffmpeg, ['-v', 'error', '-i', file, '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'], { binary: true });
  const a = decode(ducked), b = decode(plain);
  assert.equal(a.length, 5 * 48000 * 4);
  function amplitude(bytes, start, end, frequency) {
    let sine = 0, cosine = 0, count = 0;
    for (let n = Math.round(start * 48000); n < Math.round(end * 48000); n++) { const v = bytes.readFloatLE(n * 4); sine += v * Math.sin(2 * Math.PI * frequency * n / 48000); cosine += v * Math.cos(2 * Math.PI * frequency * n / 48000); count++; }
    return 2 * Math.hypot(sine, cosine) / count;
  }
  assert.ok(amplitude(a, 0.3, 0.7, 440) < 0.001, '旁白起点之前不应有旁白');
  assert.ok(amplitude(a, 1.3, 1.7, 440) > 0.08, '旁白应从第 1 秒开始');
  assert.ok(amplitude(a, 1.3, 1.7, 880) < amplitude(b, 1.3, 1.7, 880) * 0.6, '旁白段配乐应压低');
  assert.ok(amplitude(a, 3.3, 3.7, 880) > amplitude(a, 1.3, 1.7, 880) * 1.5, '旁白结束后配乐恢复，短配乐循环到后段');
  assert.ok(amplitude(a, 4.9, 4.98, 880) < amplitude(a, 4.3, 4.7, 880) * 0.4, '片尾配乐淡出');
  const compressed = path.join(assets, 'master.m4a'); mixAudio(configFile, compressed);
  const info = JSON.parse(run(binaries().ffprobe, ['-v', 'error', '-show_streams', '-of', 'json', compressed]));
  assert.equal(info.streams[0].codec_name, 'aac'); assert.ok(Math.abs(Number(info.streams[0].duration) - 5) < 0.1);
  console.log('混音波形测试通过：' + assets);
});
test('两种画幅的组件与字幕、预估、导出、坏帧恢复及版本拒绝', { timeout: 240000 }, async () => {
  for (const mode of ['landscape', 'portrait']) {
    const project = path.join(work, mode), out = path.join(work, mode + '-smoke');
    cli('scripts/init.mjs', project, '--format', mode, '--duration', '5', '--fps', '24');
    fs.mkdirSync(path.join(project, 'assets'));
    fs.copyFileSync(path.join(work, 'audio/master.wav'), path.join(project, 'assets/master.wav'));
    fs.writeFileSync(path.join(project, 'assets/card.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#83b4ff"/><circle cx="200" cy="150" r="70" fill="#203968"/></svg>');
    fs.writeFileSync(path.join(project, 'project.js'), demoProject(mode));
    const browser = await launch();
    try {
      const p = await openProject(browser, path.join(project, 'index.html'), mode);
      await p.page.eval('window.video.render(1)');
      assert.equal(await p.page.eval('document.querySelector("[data-video-captions]").textContent'), '第二句字幕');
      const state = () => p.page.eval('Array.from(document.querySelectorAll("[data-video-component]")).map(e=>({type:e.dataset.videoComponent,style:e.getAttribute("style"),text:e.textContent,html:e.innerHTML}))');
      await p.page.eval('window.video.render(1.5)'); const a = await state(); await p.page.eval('window.video.render(4)'); await p.page.eval('window.video.render(1.5)');
      assert.deepEqual(await state(), a);
      assert.equal(a.length, 6);
      fs.writeFileSync(path.join(work, mode + '-components.png'), await frame(p, 36));
    } finally { await browser.close(); }
    const estimateOut = path.join(work, mode + '-estimate');
    assert.match(cli('scripts/export.mjs', project, '--format', mode, '--estimate', '--out', estimateOut), /renderSeconds/);
    assert.equal(fs.existsSync(estimateOut), false, '预估不创建帧或影片');
    cli('scripts/check.mjs', project, '--format', mode, '--out', path.join(work, mode + '-preview'));
    cli('scripts/export.mjs', project, '--format', mode, '--smoke', '--out', out);
    assert.equal(readJson(path.join(out, 'verify-report.json')).ok, true);
    assert.match(fs.readFileSync(path.join(out, 'captions.srt'), 'utf8'), /第二句字幕/);
    if (mode === 'landscape') {
      const report = readJson(path.join(out, 'render.json'));
      report.status = 'interrupted'; writeJson(path.join(out, 'render.json'), report);
      const good = path.join(out, 'frames/frame-000002.png'), modified = fs.statSync(good).mtimeMs;
      fs.unlinkSync(path.join(out, 'frames/frame-000010.png')); fs.writeFileSync(path.join(out, 'frames/frame-000011.png'), 'corrupt');
      cli('scripts/export.mjs', project, '--format', mode, '--smoke', '--out', out, '--resume');
      assert.equal(fs.statSync(good).mtimeMs, modified, '完好的帧应直接复用');
      assert.equal(readJson(path.join(out, 'render.json')).reusedFrames, 46);
      assert.equal(readJson(path.join(out, 'verify-report.json')).ok, true);
      assert.match(cli('scripts/export.mjs', project, '--format', mode, '--smoke', '--out', out, '--resume'), /无需重复导出/);
      const manifestBefore = fs.readFileSync(path.join(out, 'render.json'));
      fs.appendFileSync(path.join(project, 'project.js'), '\n// changed source\n');
      const rejected = spawnSync(process.execPath, ['scripts/export.mjs', project, '--format', mode, '--smoke', '--out', out, '--resume'], { cwd: root, encoding: 'utf8', windowsHide: true });
      assert.notEqual(rejected.status, 0); assert.match(rejected.stderr, /无法续跑/);
      assert.deepEqual(fs.readFileSync(path.join(out, 'render.json')), manifestBefore, '拒绝续跑时保留原报告');
    }
  }
  console.log('集成验证与截图保存在：' + work);
});
test('进程强制终止后回收旧锁，恢复已落盘的帧并完成全片', { timeout: 120000 }, async () => {
  const project = path.join(work, 'interrupted'), out = path.join(work, 'recovered');
  cli('scripts/init.mjs', project, '--duration', '5', '--fps', '24');
  const argv = ['scripts/export.mjs', project, '--out', out];
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, argv, { cwd: root, windowsHide: true, detached: process.platform !== 'win32' });
    let text = '', killed = false;
    const timer = setTimeout(() => { child.kill(); reject(Error('中断测试等待检查点超时：' + text)); }, 60000);
    child.stdout.on('data', chunk => {
      text += chunk;
      if (!killed && text.includes('逐帧 1/')) {
        killed = true;
        if (process.platform === 'win32') {
          const result = spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
          if (result.status !== 0) reject(Error('无法终止测试子进程'));
        } else process.kill(-child.pid, 'SIGKILL');
      }
    });
    child.stderr.on('data', chunk => { text += chunk; });
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', () => { clearTimeout(timer); if (!killed) reject(Error('没有执行中断：' + text)); else resolve(); });
  });
  const old = readJson(path.join(out, 'render.json'));
  assert.equal(old.status, 'rendering');
  assert.ok(Object.keys(old.frameHashes).length >= 1);
  cli(...argv, '--resume');
  const result = readJson(path.join(out, 'render.json'));
  assert.equal(result.status, 'complete'); assert.equal(result.smoke, false);
  assert.ok(result.reusedFrames >= 1);
  assert.equal(readJson(path.join(out, 'verify-report.json')).ok, true);
  assert.equal(fs.existsSync(path.join(out, '.render.lock')), false);
  console.log('真实中断续跑通过：' + out);
});
