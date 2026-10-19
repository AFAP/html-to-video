// 只替换这个文件即可创作；DOM / SVG / Canvas 都能放在同一个 stage 内。
(function () {
  let canvas, g;
  window.VIDEO_PROJECT = {
    title: '__TITLE__',
    defaultFormat: '__FORMAT__',
    formats: ['__FORMAT__'],
    fps: __FPS__, duration: __DURATION__,
    chapters: [{ at: 0, title: '开场' }, { at: 4, title: '时间驱动画面' }],
    setup({ stage, width, height }) {
      canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      stage.append(canvas); g = canvas.getContext('2d');
    },
    render(t, { width: w, height: h, format }) {
      g.resetTransform(); g.globalAlpha = 1; g.clearRect(0, 0, w, h);
      g.fillStyle = '#101c38'; g.fillRect(0, 0, w, h);
      const p = Math.min(1, Math.max(0, (t % 4) / 0.8));
      const e = 1 - Math.pow(1 - p, 3);
      g.fillStyle = '#a6c5ff'; g.beginPath();
      g.arc(w * 0.5 + Math.sin(t) * w * 0.18, h * 0.33, 60 + 40 * Math.sin(t * 1.4), 0, Math.PI * 2); g.fill();
      g.textAlign = 'center'; g.fillStyle = '#ffffff';
      g.font = `700 ${format === 'portrait' ? 82 : 108}px "Microsoft YaHei", sans-serif`;
      g.globalAlpha = e;
      g.fillText(t < 4 ? 'HTML，让画面动起来' : '每一帧，都有准确时间', w / 2, h * 0.54 + (1 - e) * 32);
      g.globalAlpha = 1; g.font = '32px "Microsoft YaHei", sans-serif'; g.fillStyle = '#b8cae9';
      g.fillText('可播放 · 可定位 · 可导出 MP4', w / 2, h * 0.64);
    }
  };
})();
