/* 普通 script 可用于 file://；同一实现也由命令行字幕工具加载。 */
(function (global) {
  'use strict';
  function normalize(track, duration = Infinity) {
    const cues = Array.isArray(track) ? track : track?.cues;
    if (!Array.isArray(cues)) throw Error('captions 需要 cues 数组');
    return cues.map((cue, i) => {
      const { start, end, text } = cue;
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > duration + 1e-6 || typeof text !== 'string' || !text.trim()) {
        throw Error(`字幕 ${i + 1} 需要有效的 start/end/text，且不能超出片长`);
      }
      return { start, end, text: text.replace(/\r\n?/g, '\n') };
    }).sort((a, b) => a.start - b.start || a.end - b.end);
  }
  function active(cues, t) { return cues.filter(c => c.start <= t && t < c.end); }
  function stamp(t, separator = ',') {
    const ms = Math.round(t * 1000);
    return [Math.floor(ms / 3600000), Math.floor(ms / 60000) % 60, Math.floor(ms / 1000) % 60].map(n => String(n).padStart(2, '0')).join(':') + separator + String(ms % 1000).padStart(3, '0');
  }
  function toSrt(track) {
    return normalize(track).map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n');
  }
  function toVtt(track) {
    return 'WEBVTT\n\n' + normalize(track).map(c => `${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${c.text}\n`).join('\n');
  }
  function parseSrt(source) {
    const blocks = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim().split(/\n\s*\n/);
    if (!source.trim()) return [];
    const time = s => {
      const m = /^(\d{2,}):([0-5]\d):([0-5]\d)[,.](\d{3})$/.exec(s);
      if (!m) throw Error('无效的 SRT 时间：' + s);
      return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000;
    };
    return normalize(blocks.map(block => {
      const lines = block.split('\n');
      if (/^\d+$/.test(lines[0].trim())) lines.shift();
      const pair = lines.shift()?.trim().split(/\s+-->\s+/);
      if (pair?.length !== 2) throw Error('SRT 缺少时间行');
      return { start: time(pair[0]), end: time(pair[1]), text: lines.join('\n') };
    }));
  }
  function mount(stage, track, { width, height, duration }) {
    const cues = normalize(track, duration), style = track.style || {};
    const number = (key, fallback, min, max) => {
      const n = style[key] ?? fallback;
      if (!Number.isFinite(n) || n < min || n > max) throw Error('无效字幕样式：' + key);
      return n;
    };
    const box = stage.ownerDocument.createElement('div');
    box.dataset.videoCaptions = '';
    box.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);z-index:10000;box-sizing:border-box;pointer-events:none;white-space:pre-wrap;overflow-wrap:anywhere;text-align:center;';
    Object.assign(box.style, {
      bottom: number('bottom', 0.07, 0, 0.8) * height + 'px',
      width: number('maxWidth', 0.84, 0.1, 1) * width + 'px',
      fontSize: number('fontSize', width < height ? 46 : 40, 8, 200) + 'px',
      lineHeight: String(number('lineHeight', 1.4, 1, 3)),
      padding: number('padding', 14, 0, 100) + 'px',
      borderRadius: number('radius', 10, 0, 100) + 'px',
      color: style.color || '#fff', background: style.background || 'rgba(0,0,0,.72)',
      fontFamily: style.fontFamily || '"Microsoft YaHei","PingFang SC",sans-serif'
    });
    stage.append(box);
    const ready = stage.ownerDocument.fonts.load(`${box.style.fontSize} ${box.style.fontFamily}`, cues.map(c => c.text).join('') || '字幕');
    return { cues, element: box, ready, render(t) {
      const text = active(cues, t).map(c => c.text).join('\n');
      box.textContent = text; box.hidden = !text;
    } };
  }
  global.VideoCaptions = { normalize, active, parseSrt, toSrt, toVtt, mount };
})(globalThis);
