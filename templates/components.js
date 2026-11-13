/* 所有动效由绝对秒数计算，可自由组合到 DOM / Canvas / SVG 画面上。 */
(function (global) {
  'use strict';
  const clamp = n => Math.max(0, Math.min(1, n));
  const ease = n => 1 - (1 - clamp(n)) ** 3;
  function create(stage, { width, height }) {
    const doc = stage.ownerDocument, layers = [], images = [];
    const root = doc.createElement('div');
    root.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;font-family:"Microsoft YaHei","PingFang SC",sans-serif;color:#fff;';
    stage.append(root);
    const element = (tag, text, parent) => { const e = doc.createElement(tag); if (text !== undefined) e.textContent = text; parent.append(e); return e; };
    function add(type, o = {}) {
      const start = o.start ?? 0, end = o.end ?? Infinity;
      if (!Number.isFinite(start) || start < 0 || !(end > start)) throw Error('组件需要有效的 start/end');
      const enter = o.enter ?? 0.6, exit = o.exit ?? 0.3;
      if (![enter, exit].every(n => Number.isFinite(n) && n >= 0)) throw Error('enter/exit 应为非负秒数');
      const box = element('div', undefined, root); box.dataset.videoComponent = type;
      const rect = o.rect || { x: 0.08, y: 0.2, width: 0.84, height: 0.6 };
      if (!['x', 'y', 'width', 'height'].every(k => Number.isFinite(rect[k])) || rect.width <= 0 || rect.height <= 0) throw Error('rect 需要 x/y/width/height 比例');
      // 保持同一合成层，避免入退场后文字在 LCD 与灰度抗锯齿之间切换。
      Object.assign(box.style, { position: 'absolute', boxSizing: 'border-box', willChange: 'transform, opacity', left: rect.x * width + 'px', top: rect.y * height + 'px', width: rect.width * width + 'px', height: rect.height * height + 'px', fontSize: (o.fontSize ?? 48) + 'px', color: o.color || '#fff' });
      let draw = () => {};
      if (type === 'title' || type === 'lowerThird') {
        if (type === 'lowerThird') Object.assign(box.style, { background: o.background || 'rgba(12,24,48,.9)', borderLeft: '8px solid ' + (o.accent || '#8ebaff'), padding: '20px 28px' });
        const title = element('div', o.text || '', box); title.style.fontWeight = '700';
        if (o.subtitle) { const sub = element('div', o.subtitle, box); sub.style.cssText = 'font-size:.5em;line-height:1.5;margin-top:.4em;opacity:.8'; }
      } else if (type === 'counter') {
        const from = o.from ?? 0, to = o.to ?? 100, seconds = o.animateDuration ?? 1.5, decimals = o.decimals ?? 0;
        if (![from, to, seconds].every(Number.isFinite) || seconds <= 0 || !Number.isInteger(decimals) || decimals < 0 || decimals > 8) throw Error('无效 counter 数值');
        const value = element('div', '', box); value.style.fontWeight = '700';
        if (o.label) { const label = element('div', o.label, box); label.style.fontSize = '.4em'; }
        draw = t => { value.textContent = (o.prefix || '') + (from + (to - from) * ease((t - start) / seconds)).toFixed(decimals) + (o.suffix || ''); };
      } else if (type === 'comparison') {
        if (!Array.isArray(o.items) || !o.items.length || o.items.some(i => !Number.isFinite(i.value) || i.value < 0)) throw Error('comparison 需要非负 items.value');
        const max = o.max ?? Math.max(1, ...o.items.map(i => i.value));
        if (!Number.isFinite(max) || max <= 0) throw Error('comparison.max 应为正数');
        const bars = o.items.map(item => {
          const row = element('div', undefined, box); row.style.marginBottom = '.5em';
          const label = element('div', `${item.label}: ${item.value}${o.suffix || ''}`, row); label.style.fontSize = '.6em';
          const track = element('div', undefined, row); track.style.cssText = 'height:.4em;background:#ffffff22;margin-top:.2em;overflow:hidden;border-radius:.2em';
          const bar = element('div', undefined, track); bar.style.cssText = `height:100%;background:${item.color || o.accent || '#8ebaff'}`;
          return { bar, value: item.value };
        });
        draw = t => bars.forEach(b => { b.bar.style.width = clamp(b.value / max) * ease((t - start) / (o.animateDuration || 1.2)) * 100 + '%'; });
      } else if (type === 'flow') {
        if (!Array.isArray(o.steps) || !o.steps.length) throw Error('flow 需要 steps 数组');
        const vertical = o.direction ? o.direction === 'vertical' : height > width;
        Object.assign(box.style, { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', flexDirection: vertical ? 'column' : 'row' });
        o.steps.forEach((step, i) => {
          if (i) element('span', vertical ? '↓' : '→', box);
          const node = element('div', step, box); node.style.cssText = 'padding:.5em .7em;border:2px solid #8ebaff;border-radius:.2em;text-align:center;flex:1;';
        });
      } else if (type === 'image') {
        const img = element('img', undefined, box); img.src = o.src;
        Object.assign(box.style, { overflow: 'hidden' });
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
        const a = o.zoomFrom ?? 1, b = o.zoomTo ?? 1.12;
        if (![a, b].every(n => Number.isFinite(n) && n > 0) || !Number.isFinite(end)) throw Error('image 需要有效 zoomFrom/zoomTo 和有限 end');
        images.push(img);
        draw = t => { img.style.transform = `scale(${a + (b - a) * clamp((t - start) / (end - start))})`; };
      } else throw Error('未知画面组件：' + type);
      layers.push({ render(t) {
        const visible = t >= start && t < end;
        // 保留布局与合成层；display:none 会在重新出现时重建文字光栅缓存。
        box.setAttribute('aria-hidden', String(!visible));
        const p = Math.min(enter ? ease((t - start) / enter) : 1, exit && Number.isFinite(end) ? clamp((end - t) / exit) : 1);
        box.style.opacity = String(visible ? p : 0);
        box.style.transform = o.animation === 'none' ? 'none' : o.animation === 'zoom' ? `scale(${0.94 + 0.06 * p})` : `translateY(${o.animation === 'fade' ? 0 : Math.round((1 - p) * 32)}px)`;
        draw(t);
      } });
      return box;
    }
    const api = { add, render(t) { layers.forEach(l => l.render(t)); }, async ready() {
      await Promise.all(images.map(i => i.decode()));
      const fonts = new Map();
      for (const e of root.querySelectorAll('*')) {
        const s = global.getComputedStyle(e), font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
        fonts.set(font, (fonts.get(font) || '') + (e.textContent || '0123456789'));
      }
      await Promise.all([...fonts].map(([font, text]) => doc.fonts.load(font, text)));
    }, destroy() { root.remove(); } };
    for (const type of ['title', 'counter', 'comparison', 'flow', 'image', 'lowerThird']) api[type] = options => add(type, options);
    return api;
  }
  global.VideoComponents = { create, ease, clamp };
})(globalThis);
