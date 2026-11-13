/* 浏览器与导出共用的时间入口。普通 script 可在 file:// 下运行。 */
(function () {
  'use strict';
  const q = new URLSearchParams(location.search);
  const P = window.VIDEO_PROJECT;
  const stage = document.getElementById('stage');
  const status = document.getElementById('status');
  function fail(error) {
    status.textContent = '画面准备失败：' + error.message;
    status.className = 'error';
    window.__videoError = error.message;
    console.error(error);
  }
  if (!P) { fail(Error('project.js 没有定义 VIDEO_PROJECT')); return; }
  if (P.audio && !((typeof P.audio.src === 'string' && P.audio.src.length > 0 && !P.audio.synthesize) || (typeof P.audio.synthesize === 'function' && !P.audio.src))) {
    fail(Error('audio 应明确选择 src 相对路径或 synthesize 函数')); return;
  }
  const format = q.get('format') || window.VIDEO_FORMAT || P.defaultFormat || 'landscape';
  if (!['landscape', 'portrait'].includes(format)) { fail(Error('不支持的画幅：' + format)); return; }
  const formats = P.formats || ['landscape', 'portrait'];
  if (!formats.includes(format)) { fail(Error('该作品仅提供 ' + formats.join('/') + ' 画幅；制作其他画幅请重新布局')); return; }
  document.querySelectorAll('.toolbar nav a').forEach(a => {
    const selected = new URL(a.href).searchParams.get('format');
    if (!formats.includes(selected)) a.hidden = true;
  });
  const [width, height] = format === 'portrait' ? [1080, 1920] : [1920, 1080];
  const fps = P.fps === undefined ? 30 : P.fps;
  if (![24, 25, 30, 50, 60].includes(fps) || !Number.isFinite(P.duration) || P.duration <= 0) {
    fail(Error('fps 应为 24/25/30/50/60，duration 应为正数秒')); return;
  }
  const frames = Math.ceil(P.duration * fps - 1e-7), duration = frames / fps;
  const last = (frames - 1) / fps;
  const chapters = P.chapters || [{ at: 0, title: '开始' }];
  if (chapters.some((c, i) => !Number.isFinite(c.at) || c.at < 0 || c.at >= duration || (i && c.at <= chapters[i - 1].at))) {
    fail(Error('章节 at 必须按递增秒数排列，且位于片长内')); return;
  }
  const ctx = { width, height, format, fps, duration, stage };
  const meta = { version: 1, title: P.title || 'HTML 视频', width, height, format, fps, frames, duration, chapters, audio: P.audio ? (P.audio.src ? { type: 'file', src: P.audio.src } : { type: 'generated' }) : null };
  const exporting = q.get('export') === '1';
  if (exporting) document.body.classList.add('export');
  stage.style.width = width + 'px'; stage.style.height = height + 'px';
  stage.setAttribute('aria-label', meta.title);
  document.title = meta.title;
  document.getElementById('project-title').textContent = meta.title;
  const playButton = document.getElementById('play'), progress = document.getElementById('progress');
  const time = document.getElementById('time');
  let t = 0, playing = false, starting = false, playToken = 0, raf = 0, busy = false, base = 0, audio = null, audioPromise = null;
  const clamp = v => Math.max(0, Math.min(duration, v));
  const clock = s => `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  function update() { progress.value = t / duration; time.textContent = `${clock(t)} / ${clock(duration)}`; }
  function fit() {
    if (exporting) return;
    const box = document.getElementById('viewport');
    const scale = Math.min(box.clientWidth / width, box.clientHeight / height);
    stage.style.transform = `scale(${scale})`;
  }
  async function render(value) {
    if (!Number.isFinite(value)) throw Error('render(t) 需要有限数字秒');
    t = clamp(value);
    await P.render(Math.min(t, last), ctx);
    update();
    return t;
  }
  let audioBytesPromise;
  async function audioBytes() {
    if (!P.audio || !P.audio.synthesize) throw Error('项目没有程序化音轨');
    audioBytesPromise ||= Promise.resolve(P.audio.synthesize(duration));
    return new Uint8Array(await audioBytesPromise);
  }
  async function prepareAudio() {
    if (!P.audio) return null;
    audioPromise ||= (async () => {
      audio = new Audio();
      audio.preload = 'auto';
      audio.src = P.audio.src || URL.createObjectURL(new Blob([await audioBytes()], { type: 'audio/wav' }));
      audio.muted = document.getElementById('mute').getAttribute('aria-pressed') === 'true';
      return audio;
    })();
    return audioPromise;
  }
  function pause() {
    ++playToken; starting = false; playing = false; cancelAnimationFrame(raf); audio?.pause(); playButton.textContent = '播放';
  }
  async function seek(value) {
    pause(); await render(value);
    if (audio && Number.isFinite(audio.duration)) audio.currentTime = Math.min(t, audio.duration);
  }
  async function tick(now) {
    if (!playing) return;
    busy = true;
    try {
      // 音频可能被浏览器策略挂起；画面始终由挂钟推进。
      await render((now - base) / 1000);
      if (t >= duration) pause();
      else if (playing) raf = requestAnimationFrame(tick);
    } catch (e) { pause(); fail(e); } finally { busy = false; }
  }
  async function play() {
    if (playing || starting || exporting) return;
    starting = true; const token = ++playToken;
    playButton.textContent = '准备音频…';
    await window.video.ready;
    if (t >= duration) await render(0);
    try {
      const a = await prepareAudio();
      if (a) {
        a.currentTime = t;
        await a.play();
      }
    } catch (e) { status.textContent = '音频未能播放，画面继续播放：' + e.message; }
    if (token !== playToken) { audio?.pause(); return; }
    base = performance.now() - t * 1000;
    starting = false; playing = true; playButton.textContent = '暂停'; raf = requestAnimationFrame(tick);
  }
  const api = {
    meta, render, seek, play, pause,
    get state() { return { time: t, playing, starting, busy, muted: audio?.muted || false }; },
    async audioLength() { return (await audioBytes()).length; },
    async audioChunk(offset, size = 65536) {
      const source = await audioBytes();
      const bytes = source.subarray(offset, offset + Math.min(size, 65536));
      let text = '';
      for (let i = 0; i < bytes.length; i += 16384) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 16384));
      return btoa(text);
    }
  };
  window.video = api;
  // 老 HTML 案例可迁移到同一接口；这两个名字仅作为兼容别名。
  window.__seekAbs = render; window.__tl = meta;
  api.ready = (async () => {
    await P.setup?.(ctx);
    await P.ready;
    await render(0);
    await document.fonts.ready;
    await Promise.all(Array.from(stage.querySelectorAll('img')).map(img => img.decode()));
    await render(0); fit();
    status.textContent = `${width} × ${height} · ${fps} fps · ${duration.toFixed(2)} 秒${P.audio ? ' · 含音轨' : ' · 无音轨'}`;
    return meta;
  })();
  api.ready.catch(fail);
  playButton.addEventListener('click', () => playing || starting ? pause() : play());
  document.getElementById('restart').addEventListener('click', async () => { await seek(0); await play(); });
  progress.addEventListener('input', () => seek(Number(progress.value) * duration));
  document.getElementById('mute').addEventListener('click', () => {
    const button = document.getElementById('mute');
    const muted = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(muted)); button.textContent = muted ? '取消静音' : '静音';
    if (audio) audio.muted = muted;
  });
  if (!P.audio) document.getElementById('mute').hidden = true;
  document.getElementById('fullscreen').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.getElementById('player').requestFullscreen(); fit(); }
    catch (e) { status.textContent = '全屏不可用：' + e.message; }
  });
  chapters.forEach(c => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = c.title;
    b.addEventListener('click', () => seek(c.at)); document.getElementById('chapters').append(b);
  });
  document.addEventListener('keydown', e => {
    if (['INPUT', 'TEXTAREA', 'BUTTON', 'A'].includes(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); playing ? pause() : play(); }
    if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') { e.preventDefault(); seek(t + (e.code === 'ArrowRight' ? 1 : -1)); }
  });
  window.addEventListener('resize', fit);
})();
