/* DeepSeek V4.1 FLASH 1017 / business + technology / 1920x1080 / 60fps / 60s.
   本片的视觉语言、镜头与配乐属于这部作品，不是技能模板。 */
(function () {
  'use strict';
  const TAU = Math.PI * 2, W = 1920, H = 1080;
  const SCORE = window.ABYSS_TIMING;
  if (!SCORE) throw Error('缺少 timeline.js');
  const GRAIN = new URLSearchParams(location.search).get('grain') !== '0';
  const C = {
    bg: '#01050c', ink: '#eafcff', dim: '#80a8b8', faint: '#153a4c',
    blue: '#2e8dff', cyan: '#5df4ff', acid: '#c6ff5e', red: '#ff5b5b',
    violet: '#8f7cff', line: '#16384a', panel: '#04121c'
  };
  const SECTIONS = SCORE.sections.map(s => ({ ...s, tint: C[s.color] }));
  const starts = SECTIONS.map(s => s.at);
  let g, grainCanvas, grainPattern, whaleMark, whaleDots = [];
  let dust = [], bubbles = [], weightCubes = [], cacheCells = [], poolDots = [], bitCells = [], engramWafers = [], buildings = [], mitPoints = [];

  const clamp = v => Math.max(0, Math.min(1, v));
  const fract = x => x - Math.floor(x);
  const mix = (a, b, p) => a + (b - a) * p;
  const smooth = v => { const p = clamp(v); return p * p * (3 - 2 * p); };
  const easeOut = v => 1 - Math.pow(1 - clamp(v), 4);
  const easeOutQuint = v => 1 - Math.pow(1 - clamp(v), 5);
  const easeInOut = v => { const p = clamp(v); return p < 0.5 ? 8 * p * p * p * p : 1 - Math.pow(-2 * p + 2, 4) / 2; };
  const easeBack = v => { const p = clamp(v); const c = 1.70158; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
  function rng(seed) { return () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }; }
  function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function rgba(hex, a) { const [r, gg, b] = hexRgb(hex); return `rgba(${r},${gg},${b},${a})`; }
  function fmt(v, n = 1) { return v.toFixed(n); }

  function txt(s, x, y, size, color = C.ink, weight = 600, align = 'left', alpha = 1, mono = false, ls = 0) {
    g.save(); g.globalAlpha *= alpha;
    g.font = `${weight} ${size}px ${mono ? '"Cascadia Mono","Consolas",monospace' : 'Bahnschrift,"Microsoft YaHei","PingFang SC",sans-serif'}`;
    g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic';
    if (ls) g.letterSpacing = ls + 'px';
    g.fillText(s, x, y); g.restore();
  }
  function label(s, x, y, color = C.dim, alpha = 1, align = 'left', size = 16, ls = 2) {
    txt(s, x, y, size, color, 500, align, alpha, true, ls);
  }
  function micro(s, x, y, color = C.dim, alpha = 1, align = 'left', size = 13) {
    txt(s, x, y, size, color, 500, align, alpha, true, 1.5);
  }
  function big(s, x, y, size, color = C.ink, alpha = 1, align = 'left', weight = 800) {
    txt(s, x, y, size, color, weight, align, alpha);
  }
  function reveal(s, x, y, size, color, weight, local, delay, dur = 0.72, align = 'left') {
    const p = easeOutQuint((local - delay) / dur);
    if (p <= 0) return;
    g.save(); g.beginPath(); g.rect(align === 'center' ? x - 950 : x - 30, y - size * 1.35, align === 'center' ? 1900 : 1300, size * 1.7); g.clip();
    g.globalAlpha *= p;
    txt(s, x + (1 - p) * 52, y + (1 - p) * size * 1.05, size, color, weight, align, 1);
    g.restore();
  }
  function rect(x, y, w, h, color, alpha = 1) {
    g.save(); g.globalAlpha *= alpha; g.fillStyle = color; g.fillRect(x, y, w, h); g.restore();
  }
  function line(x1, y1, x2, y2, color = C.line, width = 1, alpha = 1, dash = null) {
    g.save(); g.globalAlpha *= alpha; g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'butt';
    if (dash) g.setLineDash(dash);
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.restore();
  }
  function dot(x, y, r, color, alpha = 1) {
    g.save(); g.globalAlpha *= alpha; g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.restore();
  }
  function poly(pts, fill, stroke, lw = 1, alpha = 1) {
    g.save(); g.globalAlpha *= alpha; g.beginPath();
    pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
    g.restore();
  }
  function rr(x, y, w, h, r, fill, stroke, lw = 1, alpha = 1) {
    g.save(); g.globalAlpha *= alpha; g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
    g.restore();
  }
  function glow(x, y, radius, color, alpha = 1) {
    g.save(); g.globalAlpha *= alpha;
    const gr = g.createRadialGradient(x, y, 0, x, y, radius);
    gr.addColorStop(0, rgba(color, 0.9)); gr.addColorStop(0.35, rgba(color, 0.32)); gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr; g.fillRect(x - radius, y - radius, radius * 2, radius * 2); g.restore();
  }
  function shockwave(x, y, radius, color, alpha = 1, width = 2) {
    if (alpha <= 0 || radius <= 0) return;
    g.save(); g.globalAlpha *= alpha; g.strokeStyle = color; g.lineWidth = width;
    g.beginPath(); g.arc(x, y, radius, 0, TAU); g.stroke();
    g.globalAlpha *= 0.5; g.beginPath(); g.arc(x, y, radius * 0.78, 0, TAU); g.stroke();
    g.restore();
  }
  function cutBurst(local) {
    const p = clamp(local / 0.72);
    if (p <= 0 || p >= 1) return;
    for (let i = 0; i < 30; i++) {
      const a = i / 30 * TAU + (i % 3) * 0.17;
      const r = 24 + easeOut(p) * (150 + (i % 7) * 28);
      dot(W * 0.70 + Math.cos(a) * r, H * 0.44 + Math.sin(a) * r * 0.66, 1.2 + (i % 3) * 0.55, i % 4 ? C.cyan : C.acid, (1 - p) * 0.5);
    }
  }

  function whaleLegacy(x, y, s, rot, t, opt = {}) {
    const a = opt.alpha === undefined ? 1 : opt.alpha;
    if (a <= 0.01) return;
    const phase = opt.phase || 0, swim = Math.sin(t * 2.2 + phase);
    const rim = opt.rim || C.cyan;
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s); g.globalAlpha *= a;
    const bodyGrad = g.createLinearGradient(-245, -80, 245, 70);
    bodyGrad.addColorStop(0, '#03101f'); bodyGrad.addColorStop(0.35, '#062b4a');
    bodyGrad.addColorStop(0.72, '#0a4d70'); bodyGrad.addColorStop(1, '#0d7f96');

    // 尾鳍，先于身体绘制
    g.save(); g.translate(-232, 0); g.rotate(swim * 0.12);
    const tail = new Path2D();
    tail.moveTo(8, 0);
    tail.bezierCurveTo(-20, -18, -46, -72, -98, -94);
    tail.bezierCurveTo(-104, -56, -58, -16, -20, 0);
    tail.bezierCurveTo(-58, 16, -104, 56, -98, 94);
    tail.bezierCurveTo(-46, 72, -20, 18, 8, 0);
    g.fillStyle = bodyGrad; g.fill(tail);
    g.strokeStyle = rgba(rim, 0.62); g.lineWidth = 1.4; g.stroke(tail);
    g.strokeStyle = rgba(rim, 0.12); g.lineWidth = 10; g.stroke(tail);
    g.restore();

    // 胸鳍：座头鲸式长鳍
    g.save(); g.translate(60, 26); g.rotate(0.18 + swim * 0.09);
    const fin = new Path2D();
    fin.moveTo(2, 0);
    fin.bezierCurveTo(-8, 48, -44, 108, -104, 132);
    fin.bezierCurveTo(-56, 94, -12, 42, 10, 0);
    g.fillStyle = 'rgba(8,52,78,0.88)'; g.fill(fin);
    g.strokeStyle = rgba(rim, 0.48); g.lineWidth = 1.1; g.stroke(fin);
    g.restore();

    // 身体：蓝鲸式长吻、厚头、细尾柄
    const body = new Path2D();
    body.moveTo(252, 12);
    body.bezierCurveTo(250, -34, 215, -62, 165, -70);
    body.bezierCurveTo(105, -82, 30, -76, -40, -56);
    body.bezierCurveTo(-120, -34, -190, -18, -232, -6);
    body.bezierCurveTo(-248, -4, -248, 2, -232, 4);
    body.bezierCurveTo(-170, 10, -110, 24, -40, 40);
    body.bezierCurveTo(40, 56, 130, 52, 195, 36);
    body.bezierCurveTo(225, 30, 246, 22, 252, 12);
    g.fillStyle = bodyGrad; g.fill(body);
    g.save(); g.clip(body);
    const belly = g.createLinearGradient(0, -20, 0, 60);
    belly.addColorStop(0, 'rgba(20,110,140,0)'); belly.addColorStop(0.55, 'rgba(26,140,160,0.20)'); belly.addColorStop(1, 'rgba(60,220,220,0.10)');
    g.fillStyle = belly; g.fillRect(-260, -90, 520, 160);
    g.restore();
    g.strokeStyle = rgba(rim, 0.14); g.lineWidth = 14; g.stroke(body);
    g.strokeStyle = rgba(rim, 0.72); g.lineWidth = 1.5; g.stroke(body);

    // 身体网格与发光斑点
    g.save(); g.clip(body);
    for (let yy = -62; yy < 44; yy += 11) {
      g.beginPath();
      for (let xx = -238; xx <= 238; xx += 16) {
        const py = yy + Math.sin(xx * 0.03 + t * 1.1 + phase) * 2.2;
        if (xx === -238) g.moveTo(xx, py); else g.lineTo(xx, py);
      }
      g.strokeStyle = rgba(rim, 0.085); g.lineWidth = 0.8; g.stroke();
    }
    for (let xx = -200; xx <= 220; xx += 34) {
      g.beginPath(); g.moveTo(xx, -68); g.bezierCurveTo(xx - 8, -20, xx + 8, 24, xx, 48);
      g.strokeStyle = rgba(rim, 0.05); g.lineWidth = 0.8; g.stroke();
    }
    for (let i = 0; i < 19; i++) {
      const bx = -190 + i * 22.5, by = -53 + Math.sin(i * 1.7 + t * 1.2) * 6;
      dot(bx, by, 0.8 + (i % 3) * 0.55, i % 4 ? C.cyan : C.acid, 0.32 + 0.25 * Math.sin(t * 2 + i));
    }
    g.restore();

    // 背鳍
    const dorsal = new Path2D();
    dorsal.moveTo(-28, -58);
    dorsal.bezierCurveTo(-18, -98, 2, -105, 18, -60);
    dorsal.bezierCurveTo(2, -63, -14, -61, -28, -58);
    g.fillStyle = '#062a45'; g.fill(dorsal);
    g.strokeStyle = rgba(rim, 0.52); g.lineWidth = 1.1; g.stroke(dorsal);

    // 下颌、眼睛、嘴线、腹褶
    const jaw = new Path2D();
    jaw.moveTo(250, 12);
    jaw.bezierCurveTo(220, 34, 172, 44, 138, 38);
    jaw.bezierCurveTo(170, 28, 218, 20, 250, 12);
    g.fillStyle = 'rgba(18,118,144,0.38)'; g.fill(jaw);
    g.strokeStyle = rgba(rim, 0.35); g.lineWidth = 1; g.stroke(jaw);
    glow(208, -22, 30, C.acid, 0.38);
    dot(208, -22, 3.4, C.acid, 1);
    g.strokeStyle = rgba(C.ink, 0.36); g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(154, 22); g.bezierCurveTo(186, 28, 226, 25, 248, 14); g.stroke();
    for (let i = 0; i < 4; i++) {
      g.beginPath(); g.moveTo(130 + i * 9, 34 + i * 4); g.bezierCurveTo(172, 46 + i * 4, 214, 38, 240, 22); g.strokeStyle = rgba(C.cyan, 0.12); g.stroke();
    }
    // 喷气孔
    dot(160, -65, 2.2, C.ink, 0.45);
    for (let i = 0; i < 6; i++) {
      const q = fract(t * 0.25 + i * 0.17);
      dot(160 + Math.sin(q * 6 + i) * 20, -68 - q * 58, 1.2 + (i % 2), C.cyan, (1 - q) * 0.4);
    }

    // 头部声呐与气泡
    if (opt.sonar !== false) {
      for (let i = 0; i < 3; i++) {
        const q = fract(t * 0.32 + i / 3);
        g.strokeStyle = rgba(C.cyan, (1 - q) * 0.20); g.lineWidth = 1;
        g.beginPath(); g.arc(232, 0, 34 + q * 220, -1.1, 1.1); g.stroke();
      }
    }
    for (let i = 0; i < 7; i++) {
      const bx = 214 + fract(t * 0.28 + i * 0.13) * 120;
      const by = -8 - fract(t * 0.4 + i * 0.19) * 90;
      dot(bx, by, 1.2 + (i % 3) * 0.7, i % 2 ? C.cyan : C.ink, 0.28 + 0.22 * Math.sin(t * 2 + i));
    }
    // 尾迹粒子
    for (let i = 0; i < 20; i++) {
      const q = i / 20;
      dot(-250 - q * 240, Math.sin(t * 2.2 + i * 0.6) * (6 + q * 26), 0.8 + (i % 3) * 0.5, i % 4 ? C.cyan : C.acid, (1 - q) * 0.35);
    }
    g.restore();
  }
  function arrow(x1, y1, x2, y2, color, width = 1.5, alpha = 1, head = 9) {
    line(x1, y1, x2, y2, color, width, alpha);
    const a = Math.atan2(y2 - y1, x2 - x1);
    const p1 = [x2 - Math.cos(a - 0.45) * head, y2 - Math.sin(a - 0.45) * head];
    const p2 = [x2 - Math.cos(a + 0.45) * head, y2 - Math.sin(a + 0.45) * head];
    poly([p1, [x2, y2], p2], color, null, 1, alpha);
  }
  function bracket(x, y1, y2, color, alpha = 1, dir = 1, ticks = 12) {
    g.save(); g.globalAlpha *= alpha; g.strokeStyle = color; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x, y1); g.lineTo(x + dir * 13, y1); g.moveTo(x, y2); g.lineTo(x + dir * 13, y2); g.stroke();
    line(x, y1, x, y2, color, 1, alpha);
    for (let i = 0; i <= ticks; i++) { const y = mix(y1, y2, i / ticks); line(x, y, x + dir * 5, y, color, 1, alpha * 0.5); }
    g.restore();
  }

  function rotate(p, ay, ax, az = 0) {
    let [x, y, z] = p;
    const xx = x * Math.cos(ay) + z * Math.sin(ay), zz = z * Math.cos(ay) - x * Math.sin(ay); x = xx; z = zz;
    const yy = y * Math.cos(ax) - z * Math.sin(ax), z2 = y * Math.sin(ax) + z * Math.cos(ax); y = yy; z = z2;
    return [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az), z];
  }
  function project(p, cx, cy, scale, focal = 9) {
    const q = focal / (focal + p[2]);
    return [cx + p[0] * scale * q, cy + p[1] * scale * q, p[2]];
  }

  function project3(p, o) {
    const cy = Math.cos(o.yaw), sy = Math.sin(o.yaw);
    let X = p[0] * cy - p[2] * sy, Z = p[0] * sy + p[2] * cy;
    const cp = Math.cos(o.pitch), sp = Math.sin(o.pitch);
    const Y = p[1] * cp - Z * sp; Z = p[1] * sp + Z * cp;
    const q = (o.focal || 9) / ((o.focal || 9) + Z);
    return [o.cx + X * o.scale * q, o.cy - Y * o.scale * q, Z];
  }

  function stack(o) {
    const n = o.count || 40, gap = o.gap || 0.092, th = o.th || 0.032, w = o.w || 4, d = o.d || 1.1;
    const split = o.split === undefined ? 20 : o.split;
    const splitGap = o.splitGap === undefined ? 0.13 : o.splitGap;
    const top = ((n - 1) * gap + splitGap) / 2;
    const layers = [], faces = [];
    const pushFace = (pts, fill, stroke, lw, z) => faces.push({ pts, fill, stroke, lw, z });
    for (let i = 0; i < n; i++) {
      const y = top - i * gap - (split && i >= split ? splitGap : 0);
      const vis = o.vis ? clamp(o.vis(i)) : 1;
      if (vis <= 0.01) continue;
      const isEnc = i < split;
      const color = isEnc ? (o.enc || C.blue) : (o.dec || C.acid);
      const lit = clamp(o.lit ? o.lit(i) : 0);
      const base = o.alpha === undefined ? 1 : o.alpha;
      const aTop = (lit ? 0.20 + 0.25 * lit : 0.24) * vis * base;
      const aSide = (lit ? 0.09 + 0.12 * lit : 0.13) * vis * base;
      const stroke = lit ? rgba(color, (0.45 + 0.48 * lit) * vis * base) : rgba('#6381a8', 0.27 * vis * base);
      const corners = [
        [-w / 2, y + th / 2, d / 2], [w / 2, y + th / 2, d / 2], [w / 2, y + th / 2, -d / 2], [-w / 2, y + th / 2, -d / 2],
        [-w / 2, y - th / 2, d / 2], [w / 2, y - th / 2, d / 2], [w / 2, y - th / 2, -d / 2], [-w / 2, y - th / 2, -d / 2]
      ];
      const p = corners.map(q => project3(q, o));
      const z = (p[0][2] + p[2][2]) / 2;
      pushFace([p[0], p[1], p[2], p[3]], lit ? rgba(color, aTop) : rgba('#0c1829', aTop), stroke, lit ? 1.35 : 0.75, z);
      pushFace([p[4], p[5], p[1], p[0]], lit ? rgba(color, aSide) : rgba('#07101c', aSide), stroke, lit ? 1.15 : 0.65, z - 0.001);
      pushFace([p[5], p[6], p[2], p[1]], lit ? rgba(color, aSide * 0.75) : 'rgba(5,11,20,0.42)', stroke, lit ? 1 : 0.6, z - 0.002);
      pushFace([p[7], p[4], p[0], p[3]], 'rgba(4,9,17,0.45)', stroke, 0.55, z - 0.003);
      layers.push({ i, y, p, c: project3([0, y, d / 2], o), l: project3([-w / 2, y, d / 2], o), r: project3([w / 2, y, d / 2], o), color, lit });
    }
    // 背面骨架，让层堆叠有体积
    if (layers.length) {
      const t0 = layers[0].p, b0 = layers[layers.length - 1].p;
      g.save(); g.globalAlpha = (o.alpha === undefined ? 1 : o.alpha) * 0.45;
      for (const k of [0, 1, 2, 3]) line(t0[k][0], t0[k][1], b0[k][0], b0[k][1], '#3c5b88', 1, 0.28);
      g.restore();
    }
    faces.sort((a, b) => b.z - a.z);
    for (const f of faces) {
      g.save(); g.beginPath(); f.pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
      if (f.fill) { g.fillStyle = f.fill; g.fill(); }
      if (f.stroke) { g.strokeStyle = f.stroke; g.lineWidth = f.lw; g.stroke(); }
      g.restore();
    }
    return { layers, top, gapY: split ? top - (split - 0.5) * gap - splitGap / 2 : top };
  }

  function whale(x, y, size, rot, t, opt = {}) {
    const a = opt.alpha === undefined ? 1 : opt.alpha;
    if (a <= 0.01) return;
    if (!whaleMark) { whaleLegacy(x, y, size / 460, rot, t, opt); return; }
    const s = size / 24, phase = opt.phase || 0;
    const rim = opt.rim || C.cyan;
    g.save();
    g.translate(x + Math.sin(t * 0.75 + phase) * 3, y + Math.sin(t * 1.15 + phase) * 3);
    g.rotate(rot + Math.sin(t * 0.9 + phase) * 0.012);
    g.scale(s, s); g.translate(-12, -12); g.globalAlpha *= a;

    // 全息光晕与运动残影
    glow(12, 12, 14, rim, 0.17);
    g.save(); g.globalAlpha *= 0.16; g.fillStyle = rim; g.translate(-0.35, 0.04); g.fill(whaleMark, 'evenodd'); g.restore();
    g.save(); g.globalAlpha *= 0.08; g.fillStyle = C.blue; g.translate(0.5, -0.04); g.fill(whaleMark, 'evenodd'); g.restore();

    // 官方鲸鱼标志本体
    const gr = g.createLinearGradient(0, 3, 24, 21);
    gr.addColorStop(0, '#021324'); gr.addColorStop(0.42, '#06334f'); gr.addColorStop(0.78, '#07566c'); gr.addColorStop(1, '#0a8fa0');
    g.fillStyle = gr; g.fill(whaleMark, 'evenodd');

    // 身体扫描线与粒子
    g.save(); g.clip(whaleMark, 'evenodd');
    for (let yy = 3.2; yy < 22; yy += 0.72) line(0, yy, 24, yy, rim, 0.6, 0.075);
    for (let i = 0; i < 15; i++) {
      const bx = 2 + (i * 1.51) % 20, by = 5 + (i * 2.17) % 14;
      dot(bx, by, 0.12 + (i % 3) * 0.10, i % 4 ? C.cyan : C.acid, 0.25 + 0.2 * Math.sin(t * 2 + i));
    }
    // 斜向高光扫过
    const sweep = -8 + fract(t * 0.35 + phase) * 42;
    const sg = g.createLinearGradient(sweep, 0, sweep + 5, 24);
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(180,250,255,0.22)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sg; g.fillRect(sweep, 0, 6, 24);
    g.restore();

    // 边缘与呼吸光
    g.strokeStyle = rgba(rim, 0.14); g.lineWidth = 0.7; g.stroke(whaleMark);
    g.strokeStyle = rgba(rim, 0.82); g.lineWidth = 0.075; g.stroke(whaleMark);
    g.strokeStyle = rgba(C.acid, 0.30); g.lineWidth = 0.035; g.stroke(whaleMark);

    // 声呐环与环绕粒子
    if (!opt.simple) {
      for (let i = 0; i < 3; i++) {
        const q = fract(t * 0.30 + i / 3 + phase);
        g.strokeStyle = rgba(rim, (1 - q) * 0.18); g.lineWidth = 0.08;
        g.beginPath(); g.arc(12, 12, 3 + q * 12, -1.05, 1.05); g.stroke();
      }
      for (let i = 0; i < 26; i++) {
        const q = t * 0.55 + i / 26 * TAU + phase;
        const r = 10.8 + Math.sin(q * 1.7) * 1.6;
        dot(12 + Math.cos(q) * r, 12 + Math.sin(q) * r * 0.9, 0.10 + (i % 3) * 0.07, i % 4 ? rim : C.acid, 0.22 + 0.18 * Math.sin(t * 2.2 + i));
      }
      for (let i = 0; i < 7; i++) {
        const q = fract(t * 0.22 + i * 0.13 + phase);
        dot(14 + Math.sin(q * 5 + i) * 4, 8 - q * 12, 0.12 + (i % 3) * 0.08, C.cyan, (1 - q) * 0.35);
      }
    }
    g.restore();
  }

  function backdrop(t, idx) {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#01040b'); gr.addColorStop(0.46, '#02101b'); gr.addColorStop(1, '#01060d');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const tint = SECTIONS[idx].tint;
    const halo = g.createRadialGradient(W * 0.70, H * 0.22, 0, W * 0.70, H * 0.22, H * 0.9);
    halo.addColorStop(0, rgba(tint, 0.16)); halo.addColorStop(0.38, rgba(tint, 0.05)); halo.addColorStop(1, 'rgba(1,5,12,0)');
    g.fillStyle = halo; g.fillRect(0, 0, W, H);
    // 光柱与水面折射
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const x = W * (0.10 + i * 0.16) + Math.sin(t * 0.17 + i) * 55;
      const lg = g.createLinearGradient(x, 0, x + 220, H * 0.82);
      lg.addColorStop(0, rgba(i % 2 ? C.cyan : C.blue, 0.075));
      lg.addColorStop(0.55, rgba(i % 2 ? C.cyan : C.blue, 0.025));
      lg.addColorStop(1, rgba(C.cyan, 0));
      poly([[x, 0], [x + 95, 0], [x + 330, H], [x + 160, H]], lg, null, 1, 1);
    }
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      for (let x = 0; x <= W; x += 32) {
        const y = 54 + i * 22 + Math.sin(x * 0.009 + t * 0.8 + i) * 12;
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.strokeStyle = rgba(C.cyan, 0.035); g.lineWidth = 1; g.stroke();
    }
    g.restore();
    // 远处声呐环
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const r = 170 + ((t * 42 + i * 150) % 640);
      g.globalAlpha = (1 - ((t * 42 + i * 150) % 640) / 640) * 0.13;
      g.strokeStyle = i % 2 ? C.cyan : C.blue; g.lineWidth = 1.2;
      g.beginPath(); g.arc(W * 0.73, H * 0.43, r, 0, TAU); g.stroke();
    }
    g.restore();
    // 气泡
    for (const b of bubbles) {
      const y = fract(b.y - t * b.speed * 0.03) * H;
      const x = b.x * W + Math.sin(t * b.sway + b.phase) * b.amp;
      dot(x, y, b.r, b.color, b.a * (0.55 + 0.45 * Math.sin(t * 1.4 + b.phase)));
      if (b.r > 2.4) {
        g.save(); g.globalAlpha = b.a * 0.5; g.strokeStyle = rgba(C.cyan, 0.55); g.lineWidth = 0.7;
        g.beginPath(); g.arc(x, y, b.r, 0, TAU); g.stroke(); g.restore();
      }
    }
    // 浮游粒子
    for (const p of dust) {
      const x = fract(p.x + t * p.vx * 0.006) * W;
      const y = p.y * H + Math.sin(t * p.sp + p.ph) * p.amp;
      dot(x, y, p.r, p.color, p.a * (0.45 + 0.55 * Math.sin(t * p.tw + p.ph)));
    }
    // 深海数据床
    const hy = H * 0.83, vx = W * 0.64;
    g.save(); g.globalAlpha = 0.12; g.strokeStyle = '#1e6376'; g.lineWidth = 1;
    for (let i = -8; i <= 8; i++) { g.beginPath(); g.moveTo(vx + i * 42, hy); g.lineTo(vx + i * 280, H + 130); g.stroke(); }
    for (let j = 0; j < 8; j++) {
      const q = Math.pow(j / 8, 2.1), y = hy + q * (H - hy + 130), half = q * 2600;
      g.beginPath(); g.moveTo(vx - half, y); g.lineTo(vx + half, y); g.stroke();
    }
    g.restore();
    if (idx >= 3) {
      const glyphs = ['0', '1', 'K', 'V', 'Q', '8', '9', '0'];
      for (let i = 0; i < 11; i++) {
        const x = (i * 211 + t * 15) % W, y = (i * 127 + t * 11) % H;
        txt(glyphs[i % glyphs.length], x, y, 11, i % 3 ? C.blue : C.cyan, 500, 'left', 0.055, true, 0);
      }
    }
  }

  function chrome(idx, local, t) {
    g.save();
    whale(102, 52, 22, 0, t, { alpha: 0.92, simple: true });
    label('DEEPSEEK', 118, 52, C.ink, 0.92, 'left', 16, 3);
    label('V4.1 FLASH 1017  /  ABYSS PROTOCOL', 118, 76, C.dim, 0.7, 'left', 12, 2.2);
    label(String(idx + 1).padStart(2, '0') + ' / ' + String(SECTIONS.length).padStart(2, '0'), 1824, 52, C.ink, 0.9, 'right', 16, 3);
    label(SECTIONS[idx].en, 1824, 76, C.dim, 0.65, 'right', 12, 2.2);
    label(`T+ ${t.toFixed(2).padStart(6, '0')} s`, 1824, 100, C.faint, 0.9, 'right', 10, 1.4);
    line(96, 1001, 1824, 1001, '#29405f', 1, 0.55);
    label('独立介绍  ·  深渊简报', 96, 1040, C.dim, 0.75, 'left', 14, 1.8);
    label('NOT AN OFFICIAL ADVERTISEMENT', 96, 1060, C.faint, 0.9, 'left', 10, 1.4);
    label('2026.10.17  /  1017 SNAPSHOT', 1824, 1040, C.dim, 0.75, 'right', 14, 1.8);
    label('H.264  /  60 FPS  /  1920×1080', 1824, 1060, C.faint, 0.9, 'right', 10, 1.4);
    // 章节进度
    const segW = (1728 - (SECTIONS.length - 1) * 5) / SECTIONS.length;
    for (let i = 0; i < SECTIONS.length; i++) {
      const x = 96 + i * (segW + 5);
      rect(x, 1071, segW, 2, i < idx ? '#38527b' : i === idx ? C.acid : '#1b2b43', i === idx ? 0.95 : 0.8);
    }
    g.restore();
  }

  function grainAndVignette() {
    if (GRAIN) {
      g.save(); g.globalAlpha = 1; g.fillStyle = grainPattern; g.fillRect(0, 0, W, H); g.restore();
    }
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.92);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.36)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
  }

  function transition(local, idx) {
    if (local >= 0.65) return;
    const p = easeOut(local / 0.65);
    if (idx === 3 || idx === 11) {
      // 光圈开启；保留深海黑位，让大镜头从留白中出现。
      g.save(); g.beginPath(); g.rect(0, 0, W, H);
      g.ellipse(960, 510, 40 + 1250 * p, 20 + 760 * p, 0, 0, TAU);
      g.fillStyle = rgba(C.bg, 0.94 * (1 - p)); g.fill('evenodd'); g.restore();
    } else if (idx % 3 === 1) {
      const edge = W * p;
      rect(edge, 0, W - edge, H, C.bg, (1 - p) * 0.8);
      line(edge, 100, edge, 970, C.cyan, 1.3, (1 - p) * 0.6);
    } else {
      rect(0, 0, W, H, C.bg, (1 - p) * 0.48);
      glow(1320, 500, 550 + 500 * p, SECTIONS[idx].tint, (1 - p) * 0.24);
    }
  }

  function cuePulse(t, decay = 7) {
    return SCORE.cues.reduce((a, c) => t >= c.at && t < c.at + 1.2 ? Math.max(a, c.power * Math.exp(-(t - c.at) * decay)) : a, 0);
  }

  function kicker(s, y, color = C.acid, local = 0, delay = 0) {
    const p = easeOut((local - delay) / 0.55);
    if (p <= 0) return;
    line(96, y - 6, 96 + 36 * p, y - 6, color, 2, p);
    label(s, 148, y, color, p, 'left', 16, 2.8);
  }

  function stat(x, y, value, name, color = C.ink, alpha = 1, align = 'left') {
    txt(value, x, y, 42, color, 700, align, alpha);
    label(name, x, y + 25, C.dim, alpha * 0.8, align, 12, 1.7);
  }

  function flowPackets(st, from, to, color, p, count = 3, radius = 5) {
    if (!st.layers[from] || !st.layers[to]) return;
    const a = st.layers[from].c, b = st.layers[to].c;
    for (let k = 0; k < count; k++) {
      const q = clamp(p * 1.15 - k * 0.11);
      if (q <= 0) continue;
      const x = mix(a[0], b[0], q), y = mix(a[1], b[1], q);
      glow(x, y, 34, color, 0.35); dot(x, y, radius, color, 0.95);
    }
  }

  function city(t) {
    const centerX = 1330, centerY = 710, yaw = -0.62 + Math.sin(t * 0.45) * 0.18;
    const transform = p => project(rotate(p, yaw, -0.66, 0), centerX, centerY, 94, 18);
    const ground = [[-4, 0, -4], [4, 0, -4], [4, 0, 4], [-4, 0, 4]].map(transform);
    poly(ground, '#0b1532', C.blue, 1, 0.92);
    for (let a = -4; a <= 4; a++) {
      const a1 = transform([a, 0, -4]), a2 = transform([a, 0, 4]), b1 = transform([-4, 0, a]), b2 = transform([4, 0, a]);
      line(...a1.slice(0, 2), ...a2.slice(0, 2), '#263d72', 1); line(...b1.slice(0, 2), ...b2.slice(0, 2), '#263d72', 1);
    }
    const faces = [];
    buildings.forEach((b, i) => {
      const grow = easeOut((t - 0.3 - i * 0.035) / 1.0), y = -b.height * grow;
      const raw = [[b.x, 0, b.z], [b.x + 0.72, 0, b.z], [b.x + 0.72, 0, b.z + 0.72], [b.x, 0, b.z + 0.72], [b.x, y, b.z], [b.x + 0.72, y, b.z], [b.x + 0.72, y, b.z + 0.72], [b.x, y, b.z + 0.72]];
      const verts = raw.map(transform);
      for (const [ids, c] of [[[0, 1, 5, 4], '#1d3caa'], [[1, 2, 6, 5], '#0d1e5c'], [[2, 3, 7, 6], '#152d8e'], [[3, 0, 4, 7], '#284ad0'], [[4, 5, 6, 7], i % 5 === 0 ? C.cyan : '#4b76fa']]) {
        faces.push({ z: ids.reduce((s, id) => s + verts[id][2], 0), poly: ids.map(id => verts[id]), c });
      }
    });
    faces.sort((a, b) => b.z - a.z).forEach(f => poly(f.poly, f.c, '#537fe1'));
    const sweep = fract(t * 0.27) * 10 - 5;
    const a = transform([-4, -0.04, sweep]), b = transform([4, -0.04, sweep]);
    line(...a.slice(0, 2), ...b.slice(0, 2), C.acid, 3, 0.8);
  }

  function sceneCreation(local, t) {
    glow(1380, 590, 690, C.blue, 0.34);
    kicker('01  /  FROM INTENT TO PROJECT', 190, C.cyan, local, 0.08);
    reveal('一句想法', 96, 344, 104, C.ink, 800, local, 0.10);
    reveal('一个完整项目', 96, 454, 104, C.ink, 800, local, 0.24, 0.72, 'left');
    line(100, 506, 600, 506, C.cyan, 2, 0.55);
    const bp = easeOut((local - 0.6) / 0.8);
    g.save(); g.globalAlpha = bp;
    txt('从构思、编码到验证，任务被端到端完成。', 100, 566, 27, C.ink, 500);
    txt('官方展示：游戏开发、三维建模、完整项目。', 100, 606, 27, C.dim, 500);
    g.restore();
    city(local);
    whale(1490, 300, 255, -0.13, local, { alpha: 0.55, simple: true, phase: 1.4 });
    const names = ['构思', '编码', '验证'];
    names.forEach((s, i) => {
      const x = 104 + i * 220, p = easeOut((local - i * 0.5 - 0.5) / 0.5);
      dot(x + 7, 748, 5, i === 1 ? C.acid : C.blue, p);
      txt(s, x, 806, 40, C.ink, 600, 'left', p);
      if (i < 2) line(x + 90, 746, x + 198, 746, '#4d608c', 2, p);
    });
    const ep = easeOut((local - 1.6) / 0.7);
    g.save(); g.globalAlpha = ep;
    label('AGENTIC WORK  /  业务侧', 100, 885, C.cyan, 0.85, 'left', 11, 1.8);
    label('CONCEPT VISUALIZATION  /  概念示意', 1810, 885, C.dim, 0.6, 'right', 10, 1.4);
    g.restore();
  }

  function sceneOpen(local, t) {
    glow(1330, 540, 650, C.violet, 0.22);
    kicker('10  /  OPEN WEIGHTS  /  API', 190, C.violet, local, 0.08);
    reveal('开放权重', 96, 344, 100, C.ink, 800, local, 0.10);
    reveal('自由构建', 96, 454, 100, C.ink, 800, local, 0.24);
    line(100, 506, 470, 506, C.violet, 2, 0.55);
    const bp = easeOut((local - 0.6) / 0.8);
    g.save(); g.globalAlpha = bp;
    txt('MIT 许可；Hugging Face / ModelScope 可下载。', 100, 566, 26, C.ink, 500);
    txt('API 模型名 deepseek-flash；官网与 App 同步上线。', 100, 604, 26, C.dim, 500);
    txt('从托管 API 到本地权重，路径不止一条。', 100, 642, 26, C.dim, 500);
    g.restore();
    const p = easeOut((local - 0.1) / 1.55);
    whale(1330, 520, 340, -0.15, local, { alpha: 0.13, simple: true, phase: 2.0 });
    for (let i = 0; i < mitPoints.length; i++) {
      const v = mitPoints[i], stagger = easeOut((local - v.delay) / 1.1);
      const raw = [mix(v.sx, v.x, stagger), mix(v.sy, v.y, stagger), mix(v.sz, v.z, stagger)];
      const r = rotate(raw, Math.sin(local * 0.8) * 0.12, -0.03, -0.04);
      const q = project(r, 1330, 520, 1, 1600);
      const color = i % 7 === 0 ? C.ink : i % 3 === 0 ? C.cyan : C.acid;
      rect(q[0], q[1], 2.6 + v.light * 1.2, 2.6 + v.light * 1.2, color, (0.30 + v.light * 0.7) * p);
      if (i % 15 === 0 && local < 1.5) line(q[0], q[1], q[0] + (1 - stagger) * 35, q[1] - (1 - stagger) * 15, color, 1, 0.3);
    }
    const lp = easeOut((local - 1.4) / 0.8);
    g.save(); g.globalAlpha = lp;
    label('MIT LICENSE', 1330, 790, C.ink, 0.95, 'center', 24, 2.6);
    label('OPEN WEIGHTS  /  OPEN POSSIBILITIES', 1330, 818, C.acid, 0.75, 'center', 10, 1.6);
    label('HUGGING FACE  /  MODEL SCOPE', 100, 790, C.violet, 0.9, 'left', 13, 2);
    label('官网  /  APP  /  API', 100, 860, C.ink, 0.85, 'left', 22, 3);
    label('OPEN ECOSYSTEM  /  开放生态', 100, 900, C.dim, 0.65, 'left', 10, 1.6);
    g.restore();
  }

  function sceneIntro(local, t) {
    glow(1320, 470, 720, C.blue, 0.24);
    glow(1080, 700, 480, C.cyan, 0.12);
    const swimX = 1390 + Math.sin(local * 0.55) * 26;
    const swimY = 510 + Math.sin(local * 1.15) * 18;
    whale(swimX, swimY, 620, -0.02 + Math.sin(local * 0.8) * 0.03, local, {
      alpha: 0.78 + 0.22 * easeOut(local / 1.1), sonar: true
    });
    const pulse = clamp(local / 1.2);
    shockwave(swimX + 110, swimY, 80 + easeOut(pulse) * 760, C.cyan, (1 - pulse) * 0.26, 2);
    kicker('DEEPSEEK  /  V4.1 FLASH 1017  /  ABYSS PROTOCOL', 200, C.cyan, local, 0.10);
    reveal('DEEPER.', 96, 388, 170, C.ink, 800, local, -0.7);
    reveal('FASTER.', 96, 558, 170, C.cyan, 800, local, -0.7);
    const bar = easeOut((local - 0.35) / 0.9);
    rect(100, 602, 520 * bar, 3, C.acid, 0.9);
    reveal('潜入 552B 的深水区。', 100, 678, 40, C.ink, 500, local, 0.25);
    reveal('业务的速度，底层的深度。', 100, 726, 24, C.dim, 400, local, 0.45);
    line(100, 800, 900, 800, '#1d5a70', 1, 0.5);
    const stats = [['42.3', 'TERMINAL-BENCH 4.0'], ['77.0', 'DEEPSWE v1.1'], ['890B', 'KV / TOKEN'], ['1M', 'CONTEXT']];
    stats.forEach((s, i) => {
      const p = easeOut((local - 0.7 - i * 0.09) / 0.55);
      if (p <= 0) return;
      txt(s[0], 100 + i * 202, 870, 42, i === 2 ? C.acid : C.ink, 700, 'left', p);
      label(s[1], 100 + i * 202, 893, C.dim, p * 0.8, 'left', 10, 1.7);
    });
    const p = easeOut((local - 1.2) / 0.8);
    g.save(); g.globalAlpha = p * 0.8;
    label('DIVE DEEPER.  MOVE FASTER.', 1824, 920, C.cyan, 0.9, 'right', 12, 2.2);
    label('ABYSS BRIEF  /  60 SECONDS', 1824, 945, C.acid, 0.85, 'right', 10, 1.8);
    g.restore();
  }

  function sceneCED(local, t) {
    const st = stack({
      cx: 1260, cy: 555, scale: 151, yaw: -0.60, pitch: 0.30, t: local,
      enc: C.blue, dec: C.acid, split: 20, splitGap: 0.16,
      lit: i => {
        if (i < 20) return clamp((local - 0.8 - i * 0.035) / 0.55) * 0.75 + 0.08;
        return clamp((local - 2.8 - (i - 20) * 0.025) / 0.5) * 0.9 + 0.04;
      },
      vis: i => clamp((local * 34 / 1.7) - i * 0.02)
    });
    kicker('05  /  ASYMMETRIC TRANSFORMER', 190, C.cyan, local, 0.08);
    reveal('一半的层', 96, 338, 104, C.ink, 800, local, 0.18);
    reveal('读懂输入', 96, 448, 104, C.ink, 800, local, 0.30);
    const lineY = 510, p = easeOut((local - 0.6) / 0.8);
    line(100, lineY, 100 + 430 * p, lineY, C.cyan, 2, 0.65);
    const bodyAlpha = easeOut((local - 0.9) / 0.9);
    g.save(); g.globalAlpha = bodyAlpha;
    txt('CED 把 40 层拆成 20 层编码器 + 20 层解码器。', 100, 570, 28, C.ink, 500);
    txt('提示词先走前 20 层；解码器每层所需的全局 KV，', 100, 610, 28, C.ink, 500);
    txt('直接从第 20 层隐藏状态投影，不再逐层重建。', 100, 650, 28, C.dim, 500);
    g.restore();
    const s1 = easeOut((local - 1.5) / 0.7), s2 = easeOut((local - 1.7) / 0.7), s3 = easeOut((local - 1.9) / 0.7);
    stat(100, 772, '20 + 20', 'LAYERS', C.ink, s1);
    stat(302, 772, '~1/2', 'PREFILL COMPUTE', C.cyan, s2);
    stat(540, 772, 'L20', 'KV PROJECTION', C.acid, s3);
    const f = easeOut((local - 2.3) / 0.8);
    g.save(); g.globalAlpha = f * 0.9;
    txt('prefill:  O(N·L)   →   ~O(N·L/2)', 100, 928, 25, C.ink, 500, 'left', 0.72, true, 0.5);
    g.restore();

    // KV 总线与标签
    const busA = clamp((local - 2.7) / 0.6);
    if (busA > 0) {
      const gy = project3([0, st.gapY, 1.1], { cx: 1260, cy: 555, scale: 151, yaw: -0.60, pitch: 0.30 })[1];
      const busY = st.layers.length ? (st.layers[19].c[1] + st.layers[20].c[1]) / 2 : gy;
      g.save(); g.globalAlpha = busA * 0.9;
      line(1000, busY, 1578, busY, C.acid, 1.8, 0.75);
      for (let k = 0; k < 7; k++) dot(1010 + fract(local * 0.45 + k / 7) * 558, busY, 2.5, C.acid, 0.9);
      label('KV PROJECTION  /  FROM L20', 762, busY - 14, C.acid, 0.95, 'left', 11, 1.7);
      line(950, busY - 5, 1000, busY - 5, C.acid, 1, 0.55);
      // 右侧 KV 竖总线，向 20–39 层分发
      const xr = 1580;
      line(xr, busY, xr, st.layers[39] ? st.layers[39].r[1] + 18 : busY + 300, C.acid, 1, 0.4);
      for (let i = 20; i < 40; i += 2) {
        if (!st.layers[i]) continue;
        line(xr, st.layers[i].r[1], xr + 17, st.layers[i].r[1], C.acid, 1, 0.45);
      }
      g.restore();
    }
    // 输入与输出
    const inP = easeOut((local - 1.0) / 1.4);
    if (inP > 0 && st.layers[0]) {
      const a = st.layers[0].c;
      line(810, a[1], a[0] - 22, a[1], C.cyan, 1.5, 0.5);
      for (let k = 0; k < 9; k++) {
        const q = clamp((local * 0.40 + k / 9) % 1);
        const idx = Math.min(19, Math.floor(q * 20));
        const x = mix(a[0] - 130, a[0], inP) + 8, y = mix(a[1] - 6, st.layers[idx].c[1], p);
        line(x, y - 10, x, y, C.cyan, 1, 0.18);
        dot(x, y, 2.6 + (k % 3), C.cyan, 0.9);
      }
      label('PROMPT', 760, a[1] - 18, C.cyan, inP, 'left', 12, 1.8);
    }
    const decP = clamp((local - 3.4) / 1.1);
    if (decP > 0 && st.layers[20] && st.layers[39]) {
      flowPackets(st, 20, 39, C.acid, decP, 4, 5);
      const b = st.layers[39].c;
      line(b[0], b[1] + 8, b[0], b[1] + 60, C.acid, 1.5, 0.6);
      label('TOKEN', b[0] + 16, b[1] + 58, C.acid, decP, 'left', 12, 1.8);
    }
    // 右侧括号
    const br = easeOut((local - 1.7) / 0.8);
    if (br > 0 && st.layers[0] && st.layers[19] && st.layers[39]) {
      const x = 1608;
      const e1 = st.layers[0].r[1] - 8, e2 = st.layers[19].r[1] + 8;
      const d1 = st.layers[20].r[1] - 8, d2 = st.layers[39].r[1] + 8;
      bracket(x, e1, e2, C.blue, br, 1);
      bracket(x, d1, d2, C.acid, br, 1);
      label('ENCODER 01–20', x + 28, e1 + 8, C.blue, br, 'left', 12, 1.6);
      label('8B ACTIVE', x + 28, e1 + 28, C.dim, br * 0.8, 'left', 10, 1.5);
      label('DECODER 21–40', x + 28, d1 + 36, C.acid, br, 'left', 12, 1.6);
      label('16B ACTIVE', x + 28, d1 + 56, C.dim, br * 0.8, 'left', 10, 1.5);
      label('552B TOTAL', x + 28, 186, C.ink, br * 0.9, 'left', 12, 1.8);
      line(x, 196, x + 18, 196, C.dim, 1, br * 0.4);
    }
  }

  function drawWeightCube(local) {
    const o = { cx: 1015, cy: 565, scale: 252, yaw: -0.55 + local * 0.035, pitch: 0.26, focal: 9 };
    const active = new Set([0, 29, 58, 91, 122]);
    const activePos = [];
    const faces = [];
    const s = 0.115;
    for (const c of weightCubes) {
      const on = active.has(c.id);
      const color = on ? (c.id % 2 ? C.acid : C.cyan) : '#5d7baa';
      const a = on ? 0.78 : 0.22;
      const cs = [
        [-s, -s, -s], [s, -s, -s], [s, s, -s], [-s, s, -s],
        [-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s]
      ].map(q => [c.x + q[0], c.y + q[1], c.z + q[2]]);
      const p = cs.map(q => project3(q, o));
      const f = [
        [[p[0], p[1], p[2], p[3]], on ? 0.38 : 0.22],
        [[p[4], p[5], p[6], p[7]], on ? 0.62 : 0.30],
        [[p[0], p[1], p[5], p[4]], on ? 0.28 : 0.18],
        [[p[3], p[2], p[6], p[7]], on ? 0.22 : 0.13]
      ];
      for (const [pts, aa] of f) faces.push({ pts, z: (pts[0][2] + pts[2][2]) / 2, color, a: aa * (on ? 1 : 0.9) });
      if (on) activePos.push(project3([c.x, c.y, c.z], o));
      if (!on) {
        // 用细线暗示矩阵的密度
        const e = p[1], f2 = p[2];
        line(e[0], e[1], f2[0], f2[1], '#557399', 0.7, 0.24);
      }
    }
    faces.sort((a, b) => b.z - a.z);
    for (const f of faces) poly(f.pts, rgba(f.color, f.a), rgba(f.color, 0.32), 0.7);
    // 激活专家最后绘制，穿透半透明矩阵，保证可读
    for (const c of weightCubes.filter(c => active.has(c.id))) {
      const col = c.id % 2 ? C.acid : C.cyan;
      const q = project3([c.x, c.y, c.z], o);
      glow(q[0], q[1], 48, col, 0.45);
      const sc = 0.16;
      const corners = [
        [-sc, -sc, -sc], [sc, -sc, -sc], [sc, sc, -sc], [-sc, sc, -sc],
        [-sc, -sc, sc], [sc, -sc, sc], [sc, sc, sc], [-sc, sc, sc]
      ].map(v => [c.x + v[0], c.y + v[1], c.z + v[2]]);
      const p = corners.map(v => project3(v, o));
      poly([p[4], p[5], p[6], p[7]], rgba(col, 0.72), rgba(col, 1), 1.4);
      poly([p[0], p[1], p[5], p[4]], rgba(col, 0.38), rgba(col, 0.85), 1.1);
      poly([p[1], p[2], p[6], p[5]], rgba(col, 0.28), rgba(col, 0.75), 1);
    }
    return { activePos, o };
  }

  function sceneWeightsShort(local, t) {
    kicker('04  /  SPARSE WEIGHTS', 190, C.violet, local, 0.08);
    reveal('552B 的容量', 96, 342, 88, C.ink, 800, local, 0.10);
    reveal('16B 的步频', 96, 444, 88, C.ink, 800, local, 0.22);
    line(100, 494, 540, 494, C.violet, 1, 0.5);
    const bp = easeOut((local - 0.5) / 0.7);
    g.save(); g.globalAlpha = bp;
    txt('总参数 552B；解码每 token 激活 16B，预填 8B。', 100, 554, 26, C.ink, 500);
    txt('稀疏路由只点亮需要的专家，容量与算力被拆开。', 100, 592, 26, C.dim, 500);
    g.restore();
    const cube = drawWeightCube(local);
    // 环绕权重场的粒子与激活火花
    for (let i = 0; i < 26; i++) {
      const a = local * 0.85 + i / 26 * TAU;
      const p = project3([Math.cos(a) * 2.25, Math.sin(a * 1.3) * 1.5, Math.sin(a) * 1.15], cube.o);
      dot(p[0], p[1], 0.9 + (i % 3) * 0.45, i % 3 ? C.cyan : C.acid, 0.18 + 0.14 * Math.sin(local * 1.8 + i));
    }
    const rp = easeOut((local - 0.55) / 0.7);
    if (rp > 0) {
      const rx = 744, ry = 655;
      glow(rx, ry, 60, C.violet, 0.32 * rp);
      rr(rx - 34, ry - 24, 68, 48, 6, 'rgba(8,14,26,0.85)', rgba(C.violet, 0.75), 1.2, rp);
      label('ROUTER', rx, ry + 5, C.violet, rp, 'center', 10, 1.4);
      cube.activePos.slice(0, 4).forEach((p, i) => {
        const q = clamp((local - 0.8 - i * 0.06) / 0.6);
        if (q <= 0) return;
        g.save(); g.globalAlpha = q * 0.7;
        g.strokeStyle = i % 2 ? C.acid : C.cyan; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(rx + 34, ry - 8 + i * 5); g.bezierCurveTo(rx + 120, ry - 100 + i * 30, p[0] - 130, p[1] + 90, p[0], p[1]); g.stroke();
        g.restore();
        dot(p[0], p[1], 4.5, i % 2 ? C.acid : C.cyan, q);
        label('EX' + (i + 1), p[0] + 12, p[1] - 10, i % 2 ? C.acid : C.cyan, q * 0.8, 'left', 9, 1.2);
      });
    }
    const sp = easeOut((local - 1.2) / 0.7);
    g.save(); g.globalAlpha = sp;
    stat(100, 760, '2.9%', 'ACTIVE / DECODE', C.acid, 1);
    stat(340, 760, '45T', 'PRETRAIN TOKENS', C.ink, 1);
    stat(590, 760, 'MIT', 'OPEN WEIGHTS', C.ink, 1);
    label('SPARSE MoE  /  概念示意', 1015, 858, C.dim, 0.6, 'center', 10, 1.4);
    g.restore();
  }

  function sceneWeights(local, t) {
    kicker('02  /  SPARSE WEIGHTS', 190, C.violet, local, 0.08);
    reveal('552B 的容量', 96, 344, 94, C.ink, 800, local, 0.18);
    reveal('16B 的步频', 96, 450, 94, C.ink, 800, local, 0.30);
    line(100, 500, 560, 500, C.violet, 1, 0.45);
    const b1 = easeOut((local - 0.8) / 0.8) * (1 - smooth((local - 4.0) / 0.22));
    const b2 = smooth((local - 4.25) / 0.35);
    g.save(); g.globalAlpha = b1;
    txt('总参数 552B；解码每 token 激活 16B，预填激活 8B。', 100, 560, 27, C.ink, 500);
    txt('稀疏路由只点亮需要的专家，容量与算力被拆开。', 100, 600, 27, C.dim, 500);
    g.restore();
    g.save(); g.globalAlpha = b2;
    label('ENGRAM  /  CONDITIONAL MEMORY', 100, 560, C.acid, 0.95, 'left', 13, 1.8);
    txt('多阶 n-gram、多 hash 头；推理时后台 RDMA 预取。', 100, 597, 25, C.ink, 500);
    txt('一部分容量，放在“记忆”里，而不是每一步的矩阵乘里。', 100, 633, 24, C.dim, 500);
    g.restore();

    const cube = drawWeightCube(local);
    // 路由节点与激活路径
    const rp = easeOut((local - 1.0) / 0.8);
    if (rp > 0) {
      const rx = 744, ry = 655;
      glow(rx, ry, 60, C.violet, 0.32 * rp);
      rr(rx - 34, ry - 24, 68, 48, 6, 'rgba(8,14,26,0.85)', rgba(C.violet, 0.75), 1.2, rp);
      label('ROUTER', rx, ry + 5, C.violet, rp, 'center', 10, 1.4);
      cube.activePos.slice(0, 4).forEach((p, i) => {
        const q = clamp((local - 1.2 - i * 0.08) / 0.7);
        if (q <= 0) return;
        g.save(); g.globalAlpha = q * 0.7;
        g.strokeStyle = i % 2 ? C.acid : C.cyan; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(rx + 34, ry - 8 + i * 5); g.bezierCurveTo(rx + 120, ry - 100 + i * 30, p[0] - 130, p[1] + 90, p[0], p[1]); g.stroke();
        g.restore();
        dot(p[0], p[1], 4.5, i % 2 ? C.acid : C.cyan, q);
        if (q > 0.9) label('EX' + (i + 1), p[0] + 11, p[1] - 8, i % 2 ? C.acid : C.cyan, 0.8, 'left', 9, 1.2);
      });
    }
    // 参数总量标注
    const cp = easeOut((local - 1.4) / 0.8);
    g.save(); g.globalAlpha = cp * 0.72;
    label('WEIGHT FIELD  /  552B TOTAL', 1015, 868, C.dim, 0.85, 'center', 10, 1.6);
    g.restore();
    // Engram 面板
    const ep = clamp((local - 4.0) / 0.7);
    g.save(); g.globalAlpha = 0.38 + 0.62 * ep;
    rr(1500, 324, 300, 386, 10, 'rgba(8,14,24,0.72)', rgba(C.acid, 0.35 + 0.35 * ep), 1.1);
    label('ENGRAM', 1522, 358, C.acid, 0.95, 'left', 15, 2.5);
    label('MEMORY BANK', 1522, 380, C.dim, 0.8, 'left', 10, 1.8);
    engramWafers.forEach((w, i) => {
      const y = 408 + i * 47;
      rr(1522, y, 256, 28, 3, 'rgba(24,40,50,0.55)', rgba(C.acid, 0.18 + 0.25 * ep), 0.8);
      for (let k = 0; k < 9; k++) rect(1534 + k * 26, y + 7, 12, 2, C.acid, (0.13 + 0.35 * ep) * (0.4 + 0.6 * w[k % w.length]));
      label('H' + (i + 1), 1782, y + 18, C.dim, 0.5, 'right', 8, 1);
    });
    line(1652, 710, 1652, 752, C.acid, 1.2, 0.5 + 0.4 * ep);
    arrow(1652, 752, 1652, 780, C.acid, 1.2, 0.5 + 0.4 * ep, 7);
    label('RDMA PREFETCH', 1670, 770, C.acid, 0.55 + 0.4 * ep, 'left', 9, 1.4);
    g.restore();
    // 底部数字
    const sp = easeOut((local - 2.0) / 0.8);
    g.save(); g.globalAlpha = sp;
    stat(100, 790, '2.9%', 'ACTIVE / DECODE', C.acid, 1);
    stat(330, 790, '45T', 'PRETRAIN TOKENS', C.ink, 1);
    stat(570, 790, 'MIT', 'OPEN WEIGHTS', C.ink, 1);
    g.restore();
    const note = easeOut((local - 2.5) / 0.7);
    label('稀疏激活不等于稀疏能力：容量保留在权重里，速度来自被点亮的那一小块。', 100, 884, C.dim, note * 0.9, 'left', 13, 1.2);
  }

  function drawCachePack(x, y, alpha) {
    if (alpha <= 0) return;
    const o = { cx: x, cy: y, scale: 86, yaw: -0.55, pitch: 0.30, focal: 9 };
    const w = 0.86, h = 1.02, d = 0.30;
    const c = [
      [-w, -h, d], [w, -h, d], [w, h, d], [-w, h, d],
      [-w, -h, -d], [w, -h, -d], [w, h, -d], [-w, h, -d]
    ].map(p => project3(p, o));
    g.save(); g.globalAlpha = alpha;
    glow(x, y, 130, C.cyan, 0.32);
    poly([c[0], c[1], c[2], c[3]], 'rgba(10,24,38,0.82)', rgba(C.cyan, 0.65), 1.4);
    poly([c[4], c[5], c[1], c[0]], 'rgba(8,20,32,0.72)', rgba(C.cyan, 0.45), 1.1);
    poly([c[5], c[6], c[2], c[1]], 'rgba(8,18,28,0.72)', rgba(C.cyan, 0.45), 1.1);
    poly([c[3], c[2], c[6], c[7]], 'rgba(12,28,40,0.55)', rgba(C.cyan, 0.32), 1);
    // 缓存行网格
    for (let i = 1; i < 8; i++) {
      const u = i / 8;
      const a = project3([mix(-w, w, u), -h, d], o), b = project3([mix(-w, w, u), h, d], o);
      line(a[0], a[1], b[0], b[1], C.cyan, 0.7, 0.2);
    }
    for (let i = 1; i < 10; i++) {
      const u = i / 10;
      const a = project3([-w, mix(-h, h, u), d], o), b = project3([w, mix(-h, h, u), d], o);
      line(a[0], a[1], b[0], b[1], C.cyan, 0.7, 0.2);
    }
    // 少量点亮的缓存行
    for (let i = 0; i < 22; i++) {
      const u = fract(i * 0.618 + 0.13), v = fract(i * 0.377 + 0.41);
      const p = project3([mix(-w, w, u), mix(-h, h, v), d + 0.01], o);
      dot(p[0], p[1], 1.7, i % 3 ? C.cyan : C.acid, 0.7);
    }
    // 顶部高光
    const top = project3([0, h, d], o);
    dot(top[0], top[1], 4, C.acid, 0.9);
    label('GLOBAL KV PACK', x, y + 118, C.cyan, 0.9, 'center', 10, 1.6);
    label('890 B / TOKEN', x, y + 138, C.acid, 0.9, 'center', 11, 1.4);
    g.restore();
  }

  function sceneCache(local, t) {
    kicker('05  /  KV CACHE', 190, C.cyan, local, 0.08);
    reveal('1M 上下文', 96, 338, 92, C.ink, 800, local, 0.18);
    const slam = easeBack((local - 2.15) / 0.62);
    if (slam > 0) {
      g.save(); g.globalAlpha = clamp(slam);
      glow(300, 545, 260, C.cyan, 0.18 * clamp(slam));
      big('890', 96, 575, 194, C.ink, 1, 'left');
      txt('B', 390, 575, 62, C.acid, 700);
      txt('/ token', 445, 575, 31, C.dim, 500, 'left', 1, true, 1);
      g.restore();
      const p = easeOut((local - 2.5) / 0.8);
      g.save(); g.globalAlpha = p;
      label('GLOBAL KV FOOTPRINT', 100, 612, C.cyan, 0.9, 'left', 12, 2);
      g.restore();
      const sp = clamp((local - 2.15) / 0.9);
      shockwave(300, 520, 80 + easeOut(sp) * 390, C.cyan, (1 - sp) * 0.32, 1.6);
    } else {
      g.save(); g.globalAlpha = easeOut(local / 0.7) * 0.8;
      label('GLOBAL KV  /  PER TOKEN', 100, 530, C.dim, 0.9, 'left', 12, 2);
      txt('3.56 KB', 100, 590, 88, C.dim, 600);
      g.restore();
    }
    const body = easeOut((local - 2.65) / 0.8);
    g.save(); g.globalAlpha = body;
    txt('CSA2 把主 KV 压到 FP4；跨层复用全局 KV 与 Top-K 索引。', 100, 685, 26, C.ink, 500);
    txt('1M token 的全局 KV 约 0.89 GB——不是砍上下文，', 100, 724, 26, C.ink, 500);
    txt('是把每个 token 的缓存压到 890 字节。', 100, 763, 26, C.dim, 500);
    g.restore();
    const stats = [
      ['1/4', 'HBM FOOTPRINT', C.cyan],
      ['1/8', 'SSD STORAGE', C.blue],
      ['1/437', 'KV vs V1', C.acid]
    ];
    stats.forEach((s, i) => {
      const p = easeOut((local - 2.9 - i * 0.12) / 0.6);
      if (p <= 0) return;
      stat(100 + i * 210, 845, s[0], s[1], s[2], p);
    });

    // 压缩墙：大量缓存块向一个点收拢
    const fieldX = 770, fieldY = 290, fieldW = 760, fieldH = 250;
    const compress = easeInOut((local - 1.2) / 2.0);
    g.save(); g.globalAlpha = 0.8;
    line(fieldX, fieldY + fieldH + 20, fieldX + fieldW, fieldY + fieldH + 20, '#2b4669', 1, 0.55);
    label('1,000,000 TOKENS  /  CONTEXT', fieldX, fieldY - 18, C.dim, 0.8, 'left', 11, 1.8);
    for (const c of cacheCells) {
      const tx = mix(fieldX + c.x * fieldW, fieldX + fieldW - 18, compress);
      const ty = mix(fieldY + c.y * fieldH, fieldY + fieldH / 2, compress);
      const w = mix(4.2, 1.2, compress), h = mix(2.6, 7, compress);
      const a = (1 - compress * 0.86) * (0.22 + 0.55 * c.a);
      if (a < 0.01) continue;
      rect(tx, ty, w, h, c.color, a);
    }
    if (compress > 0.75) {
      const p = (compress - 0.75) / 0.25;
      glow(fieldX + fieldW - 18, fieldY + fieldH / 2, 70, C.acid, 0.35 * p);
      rr(fieldX + fieldW - 30, fieldY + fieldH / 2 - 12, 18, 24, 2, rgba(C.acid, 0.7 * p), rgba(C.acid, 0.9), 1);
    }
    g.restore();
    if (compress > 0.7) drawCachePack(fieldX + 690, fieldY + 140, smooth((compress - 0.7) / 0.3));
    if (compress > 0.55) {
      const cx = fieldX + 690, cy = fieldY + 140;
      for (let i = 0; i < 26; i++) {
        const a = local * 1.1 + i / 26 * TAU, r = 78 + Math.sin(local * 2 + i) * 16;
        dot(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 1.18, 1 + (i % 3) * 0.55, i % 4 ? C.cyan : C.acid, 0.28 + 0.16 * Math.sin(local * 2.4 + i));
      }
    }
    // 压缩箭头与旧值
    const arr = easeOut((local - 1.8) / 1.1);
    g.save(); g.globalAlpha = arr * 0.8;
    arrow(1460, 590, 1580, 590, C.cyan, 1.6, 0.75, 9);
    label('≈ ×1/4', 1592, 595, C.cyan, 0.9, 'left', 13, 1.8);
    g.restore();
    // HBM 竖向标尺：四段中只亮最底一段
    const gaugeX = 1710, gy1 = 300, gy2 = 780;
    const gp = easeOut((local - 1.5) / 1.2);
    g.save(); g.globalAlpha = gp * 0.95;
    label('HBM', gaugeX, 278, C.dim, 0.9, 'center', 11, 2);
    for (let i = 0; i < 4; i++) {
      const segH = (gy2 - gy1 - 18) / 4, y = gy1 + i * (segH + 6);
      const active = i === 3;
      rr(gaugeX - 18, y, 36, segH, 2, active ? rgba(C.cyan, 0.55) : 'rgba(12,24,38,0.7)', active ? C.cyan : '#2c4668', 1);
      if (active) label('1/4', gaugeX, y + segH / 2 + 7, C.ink, 1, 'center', 16, 1);
    }
    label('PREV 4×', gaugeX, 296, C.dim, 0.7, 'center', 9, 1.4);
    label('NOW', gaugeX, 810, C.acid, 0.9, 'center', 10, 1.8);
    g.restore();
    // 底部估算
    const fp = easeOut((local - 3.2) / 0.8);
    g.save(); g.globalAlpha = fp * 0.9;
    line(770, 872, 1640, 872, '#2c4668', 1, 0.55);
    txt('1,000,000 × 890 B  ≈  0.89 GB', 770, 914, 26, C.ink, 500, 'left', 1, true, 0.4);
    label('按全局 KV 估算，不含 SWA 工作集', 1624, 914, C.dim, 0.7, 'right', 10, 1.2);
    g.restore();
  }

  function sceneCSA(local, t) {
    kicker('07  /  COMPRESSED SPARSE ATTENTION 2', 190, C.acid, local, 0.08);
    reveal('层与层之间', 96, 338, 94, C.ink, 800, local, 0.18);
    reveal('不再各存一份', 96, 444, 94, C.ink, 800, local, 0.30);
    line(100, 496, 520, 496, C.acid, 1, 0.5);
    const bp = easeOut((local - 0.7) / 0.8);
    g.save(); g.globalAlpha = bp;
    txt('Full 计算并写入；Reindex 复用 KV、重新打分；', 100, 556, 25, C.ink, 500);
    txt('Reuse 连 Top-K 一起复用。索引器只在共享候选池里搜索，', 100, 593, 25, C.ink, 500);
    txt('池子大小固定，深层索引成本不再随上下文增长。', 100, 630, 25, C.dim, 500);
    g.restore();
    const stp = easeOut((local - 1.5) / 0.8);
    g.save(); g.globalAlpha = stp;
    label('EACH LAYER KEEPS ITS OWN Q + SWA KV', 100, 703, C.dim, 0.75, 'left', 11, 1.5);
    stat(100, 780, '3', 'LAYER MODES', C.acid, 1);
    stat(250, 780, 'FIXED', 'CANDIDATE POOL', C.ink, 1);
    stat(470, 780, '×20', 'DECODER LAYERS', C.ink, 1);
    g.restore();

    // 三条模式车道
    const x0 = 760, x1 = 1600;
    const lanes = [
      { y: 310, key: 'FULL', label: '计算 + 写入', color: C.blue, kv: 'OWN KV', note: 'INDEXER → TOP-K' },
      { y: 505, key: 'REINDEX', label: '复用 + 重排', color: C.cyan, kv: 'REUSE KV', note: 'RESCORE → NEW TOP-K' },
      { y: 700, key: 'REUSE', label: '直接复用', color: C.acid, kv: 'REUSE KV', note: 'NO INDEX COMPUTE' }
    ];
    lanes.forEach((L, li) => {
      const a = easeOut((local - 0.5 - li) / 0.5);
      if (a <= 0) return;
      const y = L.y;
      const pulse = local >= 1 + li ? Math.exp(-(local - 1 - li) * 4) : 0;
      g.save(); g.globalAlpha = a;
      rr(x0, y, x1 - x0, 116, 7, rgba(L.color, 0.025 + pulse * 0.08), rgba(L.color, 0.22 + pulse * 0.6), 1 + pulse);
      const sweep = clamp((local - 0.5 - li) / 0.85);
      if (sweep > 0 && sweep < 1) line(x0 + 10 + sweep * 810, y + 10, x0 + 10 + sweep * 810, y + 106, L.color, 2, 0.6);
      label(L.key, x0 + 18, y + 36, L.color, 1, 'left', 19, 2.2);
      micro(L.label, x0 + 18, y + 59, C.dim, 0.8, 'left', 10);
      // 层块
      for (let k = 0; k < 5; k++) {
        const bx = x0 + 150 + k * 72, by = y + 30;
        const on = li === 0 ? true : li === 1 ? k < 4 : k < 3;
        rr(bx, by, 58, 56, 3, on ? rgba(L.color, 0.18) : 'rgba(15,25,42,0.7)', rgba(L.color, on ? 0.65 : 0.18), 1);
        line(bx + 10, by + 39, bx + 48, by + 39, L.color, 1, on ? 0.55 : 0.15);
        label('L' + (li * 5 + k + 1), bx + 29, by + 24, L.color, on ? 0.9 : 0.2, 'center', 9, 1);
      }
      // KV 块
      const kvx = x0 + 540;
      rr(kvx, y + 28, 122, 60, 3, li === 0 ? rgba(L.color, 0.22) : 'rgba(10,18,30,0.7)', rgba(L.color, 0.72), 1.2);
      label(L.kv, kvx + 61, y + 54, L.color, 0.95, 'center', 10, 1.4);
      micro('GLOBAL KV', kvx + 61, y + 72, C.dim, 0.6, 'center', 8);
      // Top-K
      const tx = x0 + 680;
      for (let k = 0; k < 8; k++) {
        const on = li === 0 ? k < 6 : li === 1 ? k < 4 : k < 4;
        dot(tx + (k % 4) * 15, y + 42 + Math.floor(k / 4) * 17, 4.2, on ? L.color : '#334b69', on ? 0.95 : 0.35);
      }
      label('TOP-K', tx, y + 87, C.dim, 0.7, 'center', 8, 1.2);
      micro(L.note, x1 - 18, y + 104, C.dim, 0.55, 'right', 9);
      g.restore();
    });
    // 复用光束
    const beam = (y1, y2, color, phase) => {
      const p = clamp((local - 2.2 - phase) / 0.8);
      if (p <= 0) return;
      g.save(); g.globalAlpha = p * 0.75;
      const x = x0 + 612;
      line(x, y1 + 88, x, y2 - 6, color, 1.4, 0.55, [5, 6]);
      for (let k = 0; k < 3; k++) dot(x, mix(y1 + 88, y2 - 6, fract(local * 0.45 + k / 3)), 3.2, color, 0.95);
      arrow(x, y2 - 12, x, y2 - 2, color, 1.4, 0.85, 7);
      g.restore();
    };
    beam(310, 505, C.cyan, 0.0);
    beam(505, 700, C.acid, 0.25);
    // 共享候选池
    const poolA = easeOut((local - 2.0) / 0.8);
    g.save(); g.globalAlpha = poolA;
    rr(1640, 250, 170, 500, 8, 'rgba(8,14,24,0.6)', rgba(C.acid, 0.32), 1);
    label('SHARED', 1725, 280, C.acid, 0.95, 'center', 12, 2);
    label('CANDIDATE POOL', 1725, 298, C.dim, 0.7, 'center', 9, 1.4);
    poolDots.forEach((d, i) => {
      const on = i < 12;
      dot(1662 + (i % 7) * 20, 334 + Math.floor(i / 7) * 22, on ? 4.5 : 3.2, on ? C.acid : '#36506e', on ? 0.95 : 0.35);
    });
    line(1658, 592, 1792, 592, C.acid, 1, 0.28);
    label('TOP-K 8', 1658, 620, C.acid, 0.8, 'left', 9, 1.4);
    for (let k = 0; k < 8; k++) rect(1658 + k * 16, 634, 10, 34, C.acid, 0.18 + k * 0.06);
    line(1725, 700, 1725, 722, C.acid, 1, 0.5);
    label('FIXED SIZE', 1725, 740, C.acid, 0.8, 'center', 9, 1.4);
    g.restore();
    // Reindex → pool 查询束
    const qp = easeOut((local - 2.8) / 0.7);
    if (qp > 0) {
      g.save(); g.globalAlpha = qp * 0.6;
      line(x0 + 760, 560, 1640, 560, C.cyan, 1.2, 0.55, [3, 5]);
      for (let k = 0; k < 3; k++) dot(mix(x0 + 760, 1640, fract(local * 0.5 + k / 3)), 560, 2.6, C.cyan, 0.9);
      g.restore();
    }
  }

  function sceneStorage(local, t) {
    kicker('08  /  PRECISION & MEMORY HIERARCHY', 190, C.blue, local, 0.08);
    reveal('4 bit 的 KV', 96, 324, 92, C.ink, 800, local, 0.18);
    reveal('3 层的缓存', 96, 430, 92, C.ink, 800, local, 0.30);
    const bp = easeOut((local - 0.7) / 0.8);
    g.save(); g.globalAlpha = bp;
    txt('主 KV 用 FP4 E2M1，SWA KV 保留 FP8；', 100, 500, 25, C.ink, 500);
    txt('热数据在 HBM，SWA 在主机 DRAM 池，持久全局 KV 在 SSD。', 100, 536, 25, C.dim, 500);
    g.restore();

    // 左：位宽压缩
    const lx = 100, ly = 620;
    const bitsA = easeOut((local - 1.0) / 0.8);
    g.save(); g.globalAlpha = bitsA;
    label('MAIN KV', lx, ly - 18, C.cyan, 0.9, 'left', 11, 1.8);
    label('FP8', lx + 430, ly - 18, C.dim, 0.8, 'right', 11, 1.6);
    bitCells.forEach((b, i) => {
      const row = i < 8 ? 0 : 1;
      if (row === 0) {
        rr(lx + i * 43, ly, 34, 42, 2, rgba(C.blue, 0.16), rgba(C.blue, 0.55), 1);
        label(i % 3 === 0 ? '0' : '1', lx + i * 43 + 17, ly + 27, C.blue, 0.8, 'center', 11, 0);
      }
    });
    label('8 bit', lx + 344, ly + 32, C.dim, 0.65, 'left', 10, 1.2);
    // 折叠箭头
    const fold = easeOut((local - 1.7) / 0.8);
    g.save(); g.globalAlpha = fold * 0.8;
    for (let i = 0; i < 8; i += 2) {
      arrow(lx + i * 43 + 17, ly + 52, lx + i * 38 + 38, ly + 92, C.cyan, 1, 0.55, 5);
    }
    bracket(lx + 390, ly + 8, ly + 100, C.cyan, fold * 0.55, -1, 6);
    label('−50%', lx + 408, ly + 60, C.cyan, fold * 0.8, 'left', 10, 1.2);
    g.restore();
    const bitsB = easeOut((local - 1.5) / 0.9);
    g.save(); g.globalAlpha = bitsB;
    for (let i = 0; i < 4; i++) {
      const x = lx + i * 78;
      rr(x, ly + 104, 68, 58, 3, rgba(C.acid, 0.18), rgba(C.acid, 0.72), 1.2);
      label(['S', 'E', 'E', 'M'][i], x + 34, ly + 141, C.acid, 0.95, 'center', 17, 0);
    }
    label('FP4  /  E2M1  /  GROUP SCALE', lx, ly + 195, C.acid, 0.85, 'left', 11, 1.6);
    label('4 bit', lx + 250, ly + 190, C.acid, 0.7, 'left', 10, 1.2);
    label('QAT AFTER RoPE', lx + 460, ly + 195, C.dim, 0.65, 'right', 10, 1.2);
    for (let i = 0; i < 12; i++) {
      const x = lx + 520 + (i * 29) % 170, y = ly + 20 + (i * 47) % 150 + Math.sin(local * 1.6 + i) * 5;
      txt(i % 2 ? '1' : '0', x, y, 12, i % 3 ? C.blue : C.cyan, 500, 'left', 0.16, true, 0);
    }
    g.restore();
    // FP8 SWA 小标签
    const swa = easeOut((local - 2.2) / 0.7);
    g.save(); g.globalAlpha = swa;
    rr(lx, ly + 230, 196, 42, 4, 'rgba(16,30,48,0.7)', rgba(C.blue, 0.55), 1);
    label('SWA KV  /  FP8', lx + 98, ly + 256, C.blue, 0.9, 'center', 12, 1.5);
    label('更敏感，保留 8 bit', lx + 214, ly + 256, C.dim, 0.7, 'left', 10, 1.2);
    g.restore();

    // 右：三级内存
    const mx = 1000, mw = 760, tiers = [
      { y: 468, h: 92, name: 'HBM', detail: 'GLOBAL KV  ·  890 B / TOKEN', color: C.cyan, tag: 'HOT' },
      { y: 606, h: 82, name: 'HOST DRAM POOL', detail: 'SWA KV  ·  TTL: MINUTES', color: C.blue, tag: 'WARM' },
      { y: 732, h: 82, name: 'SSD', detail: 'PERSISTENT KV  ·  PREFIX CACHE 72H', color: C.acid, tag: 'COLD' }
    ];
    label('MEMORY HIERARCHY  /  HOT → COLD', mx, 438, C.dim, 0.75, 'left', 10, 1.6);
    line(mx, 448, mx + mw, 448, '#2b4367', 1, 0.45);
    tiers.forEach((T, i) => {
      const p = easeOut((local - 1.3 - i * 0.18) / 0.8);
      if (p <= 0) return;
      g.save(); g.globalAlpha = p;
      poly([[mx, T.y], [mx + mw, T.y], [mx + mw + 13, T.y - 13], [mx + 13, T.y - 13]], rgba(T.color, 0.07), rgba(T.color, 0.28), 1);
      poly([[mx + mw, T.y], [mx + mw, T.y + T.h], [mx + mw + 13, T.y + T.h - 13], [mx + mw + 13, T.y - 13]], rgba(T.color, 0.05), rgba(T.color, 0.22), 1);
      rr(mx, T.y, mw, T.h, 7, 'rgba(8,14,24,0.62)', rgba(T.color, 0.35), 1);
      line(mx, T.y + T.h, mx + mw, T.y + T.h, T.color, 1, 0.35);
      label(T.name, mx + 22, T.y + 36, T.color, 0.95, 'left', 16, 2);
      micro(T.detail, mx + 22, T.y + 59, C.dim, 0.75, 'left', 10);
      label(T.tag, mx + mw - 22, T.y + 34, T.color, 0.7, 'right', 10, 1.5);
      // 容量条
      for (let k = 0; k < 28; k++) {
        const on = i === 0 ? k < 8 : i === 1 ? k < 14 : k < 24;
        rect(mx + 22 + k * 25, T.y + T.h - 15, 17, 3, T.color, on ? 0.55 : 0.12);
      }
      g.restore();
    });
    // 层级之间的竖向通道
    g.save(); g.globalAlpha = 0.55;
    line(mx + 540, 514, mx + 540, 772, C.blue, 1, 0.28, [4, 6]);
    line(mx + 600, 514, mx + 600, 772, C.dim, 1, 0.18, [2, 8]);
    label('PREFETCH  ↓   /   RECALL  ↑', mx + 620, 592, C.dim, 0.6, 'left', 8, 1.2);
    g.restore();
    // 数据包在层级之间移动
    const packetP = clamp((local - 2.2) / 1.8);
    if (packetP > 0) {
      g.save(); g.globalAlpha = 0.85;
      const x = mx + 540;
      for (let k = 0; k < 4; k++) {
        const q = fract(local * 0.28 + k / 4);
        const y = mix(514, 772, q);
        const col = q < 0.4 ? C.cyan : q < 0.75 ? C.blue : C.acid;
        dot(x, y, 4.5, col, 0.9);
        line(x, y - 28, x, y, col, 1.2, 0.28);
      }
      // 向上回收的一支
      for (let k = 0; k < 3; k++) {
        const q = fract(local * 0.22 + k / 3 + 0.4);
        dot(mx + 600, mix(772, 514, q), 2.8, C.blue, 0.6);
      }
      g.restore();
    }
    // SWA Bounded Replay 环
    const ringA = easeOut((local - 3.0) / 0.7);
    if (ringA > 0) {
      g.save(); g.globalAlpha = ringA;
      const rx = 1690, ry = 906, rad = 36;
      g.strokeStyle = rgba(C.blue, 0.5); g.lineWidth = 1.2;
      g.beginPath(); g.arc(rx, ry, rad, -0.9, 4.6); g.stroke();
      for (let k = 0; k < 7; k++) {
        const a = -0.9 + k / 7 * 5.5;
        dot(rx + Math.cos(a) * rad, ry + Math.sin(a) * rad, 2.4, k < 5 ? C.blue : C.acid, 0.8);
      }
      label('SWA BOUNDED REPLAY', rx, ry + 2, C.blue, 0.85, 'center', 9, 1.2);
      label('只回放最近窗口', rx, ry + 19, C.dim, 0.65, 'center', 8, 1);
      g.restore();
    }
    // 右侧底注
    const note = easeOut((local - 3.3) / 0.7);
    label('热、温、冷：缓存被放到了正确的介质上。', 1000, 878, C.dim, note * 0.8, 'left', 12, 1.3);
  }

  function sceneDSpark(local, t) {
    kicker('09  /  DSPARK  /  SPECULATIVE DECODING', 190, C.acid, local, 0.08);
    reveal('一次前向', 96, 338, 100, C.ink, 800, local, 0.18);
    reveal('多个 token', 96, 450, 100, C.ink, 800, local, 0.30);
    line(100, 500, 490, 500, C.acid, 1, 0.5);
    const bp = easeOut((local - 0.8) / 0.8);
    g.save(); g.globalAlpha = bp;
    txt('骨干冻结后独立训练，并行产出多个草稿位置；', 100, 560, 23, C.ink, 500);
    txt('Markov head 建模依赖，置信度 head 预测接受率；', 100, 596, 23, C.ink, 500);
    txt('调度器按引擎吞吐，动态选择验证长度。', 100, 632, 23, C.dim, 500);
    g.restore();
    const sp = easeOut((local - 1.6) / 0.8);
    g.save(); g.globalAlpha = sp;
    stat(100, 748, '∥', 'PARALLEL DRAFTS', C.acid, 1);
    stat(270, 748, 'M', 'MARKOV HEAD', C.cyan, 1);
    stat(450, 748, 'C', 'CONFIDENCE HEAD', C.blue, 1);
    label('DRAFT  →  VERIFY  →  ACCEPT', 100, 850, C.dim, 0.75, 'left', 11, 1.6);
    g.restore();

    // 右侧：草稿轨道
    const dx = 790, dy = 610;
    const p0 = easeOut((local - 1.0) / 0.8);
    if (p0 > 0) {
      g.save(); g.globalAlpha = p0;
      glow(dx, dy, 90, C.acid, 0.28);
      rr(dx - 42, dy - 42, 84, 84, 10, 'rgba(8,14,24,0.86)', rgba(C.acid, 0.7), 1.4);
      label('DRAFT', dx, dy - 6, C.acid, 0.95, 'center', 13, 2);
      label('HEAD', dx, dy + 16, C.dim, 0.8, 'center', 10, 1.8);
      g.restore();
    }
    // 草稿轨道的速度线
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const y = 500 + i * 17, x = 760 + (local * 760 + i * 137) % 820;
      line(x, y, Math.min(1800, x + 120 + (i % 3) * 40), y, i % 2 ? C.cyan : C.blue, 1, 0.10);
    }
    g.restore();
    const cards = [];
    for (let i = 0; i < 6; i++) {
      const p = easeOut((local - 1.2 - i * 0.08) / 0.6);
      if (p <= 0) continue;
      const x = 955 + i * 105, y = 548 + (i % 2) * 12;
      const accepted = i < 4;
      const verify = clamp((local - 1.5) / 0.6);
      const color = accepted ? C.acid : C.red;
      const alpha = accepted ? 0.2 + 0.45 * verify : 0.15 * (1 - verify * 0.7);
      cards.push({ x, y, accepted, color, alpha, p });
      g.save(); g.globalAlpha = p;
      // 草稿射线
      const q = clamp((local - 1.1 - i * 0.06) / 0.6);
      if (q > 0) {
        g.strokeStyle = rgba(accepted ? C.acid : C.blue, 0.32); g.lineWidth = 1;
        g.beginPath(); g.moveTo(dx + 42, dy - 8 + i * 3); g.bezierCurveTo(dx + 110, dy - 40 + i * 3, x - 70, y + 28, x, y + 22); g.stroke();
      }
      rr(x, y, 72, 92, 6, 'rgba(8,14,24,0.78)', rgba(color, accepted ? 0.65 * verify + 0.15 : 0.25), 1.1);
      label('T' + (i + 1), x + 36, y + 34, color, accepted ? 0.85 : 0.4, 'center', 12, 1);
      micro('DRAFT', x + 36, y + 56, C.dim, 0.5, 'center', 8);
      // 置信度条
      const conf = [0.96, 0.91, 0.87, 0.72, 0.44, 0.28][i];
      const cw = 52 * conf * (0.2 + 0.8 * verify);
      rect(x + 10, y + 69, 52, 3, '#2b3e58', 0.8);
      rect(x + 10, y + 69, cw, 3, color, accepted ? 0.85 : 0.55);
      if (verify > 0.8) {
        label(accepted ? 'ACCEPT' : 'REJECT', x + 36, y + 86, color, 0.8, 'center', 7, 1);
      }
      g.restore();
    }
    // Markov 依赖
    const mp = easeOut((local - 1.8) / 0.7);
    if (mp > 0) {
      g.save(); g.globalAlpha = mp * 0.6;
      for (let i = 0; i < 5; i++) {
        const x1 = 955 + i * 105 + 72, y1 = 548 + (i % 2) * 12 + 46;
        const x2 = 955 + (i + 1) * 105, y2 = 548 + ((i + 1) % 2) * 12 + 46;
        line(x1, y1, x2, y2, C.cyan, 1, 0.55, [3, 4]);
      }
      label('MARKOV DEPENDENCY', 1280, 512, C.cyan, 0.7, 'center', 10, 1.4);
      g.restore();
    }
    // 验证扫线
    const v = easeInOut((local - 1.2) / 0.85);
    if (v > 0 && v < 1) {
      const x = mix(930, 1630, v);
      line(x, 500, x, 760, C.acid, 2, 0.8);
      glow(x, 620, 80, C.acid, 0.22);
    }
    // 验证器
    const vp = easeOut((local - 0.9) / 0.6);
    if (vp > 0) {
      g.save(); g.globalAlpha = vp;
      rr(1580, 556, 128, 110, 8, 'rgba(8,14,24,0.82)', rgba(C.acid, 0.6), 1.2);
      label('VERIFY', 1644, 588, C.acid, 0.95, 'center', 14, 2);
      label('ONE PASS', 1644, 610, C.dim, 0.7, 'center', 9, 1.4);
      label('ACCEPT 4 / 6', 1644, 642, C.ink, 0.85, 'center', 10, 1.2);
      g.restore();
    }
    // 输出 token
    const op = easeOut((local - 2.2) / 0.7);
    if (op > 0) {
      g.save(); g.globalAlpha = op;
      arrow(1708, 610, 1788, 610, C.acid, 1.5, 0.8, 9);
      label('OUTPUT', 1788, 588, C.acid, 0.8, 'right', 9, 1.4);
      g.restore();
    }
    // 底部一次前向的括号
    const fp = easeOut((local - 1.6) / 0.8);
    if (fp > 0) {
      g.save(); g.globalAlpha = fp * 0.72;
      const y = 812;
      line(820, y, 1700, y, '#3b5678', 1, 0.65);
      line(820, y - 10, 820, y + 10, C.dim, 1, 0.6);
      line(1700, y - 10, 1700, y + 10, C.dim, 1, 0.6);
      for (let i = 0; i < 6; i++) {
        const x = 955 + i * 105 + 36;
        const col = i < 4 ? C.acid : C.red;
        line(x, y - 8, x, y + 8, col, 1.2, 0.8);
        dot(x, y, 2.5, col, 0.9);
      }
      label('ONE FORWARD PASS', 820, y - 20, C.dim, 0.8, 'left', 9, 1.4);
      label('4 ACCEPTED  /  6 DRAFTED', 1700, y - 20, C.acid, 0.85, 'right', 9, 1.4);
      label('PARALLEL DRAFT  →  VERIFY  →  ACCEPT', 820, y + 38, C.dim, 0.7, 'left', 10, 1.4);
      g.restore();
    }
  }

  function sceneBench(local, t) {
    kicker('02  /  OUTCOMES  /  1017', 190, C.acid, local, 0.08);
    reveal('更快完成，更强结果。', 96, 336, 82, C.ink, 800, local, 0.18);
    const bp = easeOut((local - 0.6) / 0.8);
    g.save(); g.globalAlpha = bp;
    txt('官方自测：任务完成更快、输出更短；三项基准同步上移。', 100, 392, 23, C.dim, 500);
    g.restore();
    // 右上：性能 / 成本的帕累托示意
    const pc = easeOut((local - 1.0) / 1.2);
    if (pc > 0) {
      g.save(); g.globalAlpha = pc * 0.95;
      const cx = 1320, cy = 430, cw = 470, ch = 170;
      line(cx, cy, cx + cw, cy, '#4c678c', 1.2, 0.75);
      line(cx, cy, cx, cy - ch, '#4c678c', 1.2, 0.75);
      for (let i = 1; i < 5; i++) { line(cx, cy - i * ch / 5, cx + cw, cy - i * ch / 5, '#314a6d', 0.8, 0.38); line(cx + i * cw / 5, cy, cx + i * cw / 5, cy - ch, '#314a6d', 0.8, 0.38); }
      for (let i = 0; i <= 36; i++) {
        const p = i / 36, x = cx + 40 + p * (cw - 70), y = cy - 24 - Math.pow(p, 1.65) * (ch - 44);
        if (i === 0) g.beginPath(), g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.strokeStyle = rgba(C.blue, 0.78); g.lineWidth = 1.8; g.stroke();
      const ox = cx + 302, oy = cy - 58, nx = cx + 214, ny = cy - 108;
      dot(ox, oy, 4, C.dim, 0.95); dot(nx, ny, 5.2, C.acid, 1);
      glow(nx, ny, 36, C.acid, 0.35);
      arrow(ox - 12, oy - 6, nx + 10, ny + 8, C.acid, 1.2, 0.85, 7);
      label('PREV', ox + 12, oy + 16, C.dim, 0.8, 'left', 8, 1.2);
      label('1017', nx + 12, ny - 8, C.acid, 0.95, 'left', 9, 1.2);
      label('PERFORMANCE ↑', cx + 8, cy - ch - 8, C.dim, 0.75, 'left', 8, 1.2);
      label('COST / TASK →', cx + cw, cy + 20, C.dim, 0.75, 'right', 8, 1.2);
      label('PARETO / SCHEMATIC', cx + cw, cy - ch + 4, C.dim, 0.7, 'right', 8, 1.2);
      g.restore();
    }
    const items = [
      { name: 'TERMINAL-BENCH 4.0', before: 31.2, value: 42.3, delta: '+11.1', x: 100, color: C.cyan },
      { name: 'DEEPSWE v1.1', before: 74.2, value: 77.0, delta: '+2.8', x: 700, color: C.acid },
      { name: 'PROGRAMBENCH', before: 20.3, value: 29.1, delta: '+8.8', x: 1300, color: C.blue }
    ];
    items.forEach((it, i) => {
      const p = easeOut((local - 0.5 - i * 0.5) / 0.5);
      if (p <= 0) return;
      const v = mix(it.before, it.value, easeOut((local - 0.5 - i * 0.5) / 0.5));
      g.save(); g.globalAlpha = p;
      label(it.name, it.x, 520, C.dim, 0.85, 'left', 12, 1.8);
      big(fmt(v), it.x, 690, 132, C.ink, 1, 'left');
      txt(it.delta, it.x + 270, 690, 38, it.color, 700);
      label('VS PREVIOUS', it.x, 726, C.dim, 0.65, 'left', 10, 1.4);
      // 双条
      const by = 792, bw = 470;
      rect(it.x, by, bw, 10, '#1d2d45', 0.9);
      rect(it.x, by, bw * it.before / 100, 10, '#5e7292', 0.8);
      rect(it.x, by + 24, bw * it.value / 100, 10, it.color, 0.95);
      label('V4.1 FLASH', it.x, by + 56, C.dim, 0.55, 'left', 9, 0.8);
      label('1017', it.x + bw, by + 56, it.color, 0.75, 'right', 9, 1);
      g.restore();
    });
    const note = easeOut((local - 2.2) / 0.8);
    g.save(); g.globalAlpha = note * 0.9;
    line(100, 900, 1800, 900, '#2b4367', 1, 0.45);
    label('OFFICIAL SELF-REPORTED  /  FASTER COMPLETION  /  SHORTER OUTPUTS', 100, 936, C.dim, 0.8, 'left', 10, 1.4);
    label('CLAUDE CODE HARNESS  /  MINI-SWE-V2 HARNESS  /  2026-10-17', 1824, 936, C.dim, 0.8, 'right', 10, 1.4);
    g.restore();
  }

  function sceneDive(local, t) {
    // 透视舱门：几何从消失点迎面掠过；所有位置只取决于绝对时间。
    const push = smooth(local / 4), cx = 960 + Math.sin(local * 0.7) * 45, cy = 470 - push * 40;
    glow(cx, cy, 780, C.blue, 0.28);
    glow(cx, cy, 260, C.cyan, 0.15 + cuePulse(t) * 0.12);
    for (let j = 15; j >= 0; j--) {
      const depth = 0.18 + fract(j / 16 - local * 0.14) * 5;
      const r = 315 / depth;
      g.save(); g.translate(cx, cy); g.rotate(0.10 * Math.sin(local * 0.45) + j * 0.015);
      g.strokeStyle = rgba(j % 4 ? C.blue : C.cyan, Math.min(0.55, 0.7 / depth));
      g.lineWidth = 0.8 + 1.2 / depth;
      g.beginPath();
      for (let k = 0; k < 12; k++) {
        const a = (k + 0.5) / 12 * TAU, x = Math.cos(a) * r * 1.55, y = Math.sin(a) * r;
        if (!k) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath(); g.stroke();
      for (let k = 0; k < 12; k++) {
        const a = (k + 0.5) / 12 * TAU;
        line(Math.cos(a) * r * 1.55, Math.sin(a) * r, Math.cos(a) * (r + 12) * 1.55, Math.sin(a) * (r + 12), C.cyan, 2, 0.4 / depth);
      }
      g.restore();
    }
    for (let j = 0; j < 104; j++) {
      const a = j * 2.39996, z = 0.3 + fract(j * 0.618 + local * 0.22) * 4;
      const r = (220 + (j % 11) * 20) / z, x = cx + Math.cos(a) * r * 1.7, y = cy + Math.sin(a) * r;
      line(x, y, cx + (x - cx) * 1.035, cy + (y - cy) * 1.035, j % 9 ? C.cyan : C.acid, 0.8, 0.35 / z);
    }
    whale(cx, cy - 15, 300 - push * 110, -0.10, local, { alpha: 0.8, simple: true });
    const title = easeOut(local / 0.65) * (1 - smooth((local - 3.05) / 0.75));
    // 暗色标题托底只在文字区域渐变，不遮挡舱门。
    const shade = g.createLinearGradient(0, 560, 0, 940);
    shade.addColorStop(0, 'rgba(1,5,12,0)'); shade.addColorStop(0.65, 'rgba(1,5,12,0.88)'); shade.addColorStop(1, 'rgba(1,5,12,0)');
    g.fillStyle = shade; g.fillRect(0, 560, W, 400);
    label('03 / BELOW THE SURFACE', 960, 656, C.cyan, title, 'center', 15, 6);
    txt('DIVE DEEPER', 960, 782, 118, C.ink, 800, 'center', title);
    txt('从业务，深入底层。', 960, 846, 30, C.dim, 500, 'center', title);
    const closing = smooth((local - 3.55) / 0.45);
    rect(0, 0, W, H, C.bg, closing * 0.95);
  }

  function sceneSingularity(local, t) {
    const collapse = easeInOut((local - 0.55) / 1.45), hit = cuePulse(t, 5);
    const cx = 1300, cy = 508;
    kicker('06  /  GLOBAL KV CACHE', 190, C.cyan, local);
    reveal('让海量上下文', 96, 330, 83, C.ink, 800, local, 0.1);
    reveal('进入一个核心', 96, 430, 83, C.ink, 800, local, 0.25);
    txt('1M CONTEXT', 100, 535, 34, C.cyan, 600, 'left', easeOut((local - 0.5) / 0.6));
    txt('全局 KV，890 字节 / token。', 100, 584, 27, C.dim, 500, 'left', easeOut((local - 1) / 0.6));
    glow(cx, cy, 600, C.blue, 0.24 + hit * 0.18);
    // 两层倾斜吸积盘，粒子从外场收束到稳定的缓存核心。
    for (let ring = 0; ring < 2; ring++) {
      g.save(); g.translate(cx, cy); g.rotate(ring ? -0.42 : 0.34); g.scale(1, 0.31);
      for (let k = 0; k < 7; k++) {
        g.beginPath(); g.ellipse(0, 0, 150 + k * 33 + hit * 12, 150 + k * 33 + hit * 12, 0, local * 0.26 + k * 0.27, local * 0.26 + k * 0.27 + Math.PI * 1.1);
        g.strokeStyle = rgba(ring ? C.blue : C.cyan, 0.07 + k * 0.018); g.lineWidth = 1.5; g.stroke();
      }
      g.restore();
    }
    cacheCells.forEach((v, j) => {
      const angle = v.x * TAU * 3 + local * (0.1 + v.a * 0.16) + collapse * 2.6;
      const radius = mix(280 + v.y * 600, 70 + v.y * 165, collapse);
      const z = Math.sin(angle), x = cx + Math.cos(angle) * radius, y = cy + z * radius * 0.29 + (v.a - 0.5) * mix(440, 58, collapse);
      const alpha = (0.18 + v.a * 0.5) * (0.8 + z * 0.2);
      line(x, y, x + Math.sin(angle) * (5 + collapse * 8), y - Math.cos(angle) * 3, v.color, 1 + v.a, alpha);
    });
    dot(cx, cy, 78 + hit * 7, '#020811', 1);
    shockwave(cx, cy, 88 + hit * 36, C.cyan, 0.5, 1.3);
    const impact = clamp((local - 2) / 0.8);
    if (local >= 2 && impact < 1) shockwave(cx, cy, 95 + easeOut(impact) * 510, C.cyan, (1 - impact) * 0.65, 2.2);
    whale(cx, cy, 125, -0.1, t, { alpha: 0.7 + hit * 0.2, simple: true });
    const landed = easeOut((local - 1.45) / 0.55);
    g.save(); g.globalAlpha *= landed;
    txt('890', cx, 785 + (1 - landed) * 35, 175, C.ink, 800, 'center');
    label('BYTES / TOKEN', cx, 826, C.cyan, 0.95, 'center', 18, 5);
    g.restore();
    const p = easeOut((local - 2.2) / 0.7);
    stat(100, 748, '1/4', 'HBM / VS PREVIOUS', C.cyan, p);
    stat(350, 748, '1/8', 'SSD / VS PREVIOUS', C.acid, p);
    stat(600, 748, '1/437', 'KV / VS V1¹', C.ink, p);
    txt('1M × 890 B ≈ 0.89 GB', 100, 868, 27, C.ink, 600, 'left', p);
    txt('全局 KV 估算，不含 SWA 与运行时开销；¹ 技术报告解读。', 100, 913, 18, C.dim, 400, 'left', p);
  }

  function sceneFinal(local, t) {
    glow(960, 480, 860, C.blue, 0.24);
    const resolve = easeOut((local - 0.05) / 1.45);
    for (const v of whaleDots) {
      const q = easeOut((local - v.delay) / 1.25), a = v.angle + local * (1 - q) * 0.8;
      const x = mix(960 + Math.cos(a) * v.spread, 960 + v.x * 1.18, q);
      const y = mix(480 + Math.sin(a) * v.spread * 0.5, 480 + v.y * 1.18, q);
      dot(x, y, 1.1 + v.light, v.light > 0.7 ? C.ink : C.cyan, (0.22 + v.light * 0.5) * (1 - smooth((local - 2) / 1.0) * 0.82));
    }
    whale(960, 480, 820, -0.025, local, { alpha: resolve * 0.17, simple: true, phase: 2.1 });
    g.save(); g.translate(960, 480); g.rotate(-0.18);
    for (let j = 0; j < 3; j++) {
      g.beginPath(); g.ellipse(0, 0, 680 + j * 36 + cuePulse(t) * 10, 260 + j * 24, 0, local * 0.12 + j * 2, local * 0.12 + j * 2 + 1.8);
      g.strokeStyle = rgba(j % 2 ? C.acid : C.cyan, 0.16); g.lineWidth = 1.1; g.stroke();
    }
    g.restore();
    const burst = clamp(local / 1.5);
    shockwave(960, 500, 50 + easeOut(burst) * 660, C.acid, (1 - burst) * 0.22, 1.6);
    for (let i = 0; i < 28; i++) {
      const a = i / 28 * TAU, r = 18 + easeOut(burst) * (170 + (i % 5) * 26);
      dot(960 + Math.cos(a) * r, 500 + Math.sin(a) * r * 0.62, 1.5, i % 2 ? C.cyan : C.acid, (1 - burst) * 0.45);
    }
    const p = easeOut((local - 0.1) / 0.9);
    g.save(); g.globalAlpha = p;
    label('DEEPSEEK  /  FASTER. DEEPER.', 960, 252, C.cyan, 0.95, 'center', 15, 3.2);
    txt('V4.1 FLASH', 960, 430, 158, C.ink, 800, 'center');
    txt('1017', 960, 535, 82, C.acid, 700, 'center', 1, false, 8);
    line(660, 590, 1260, 590, C.blue, 2, 0.7);
    g.restore();
    const stats = [
      ['552B', 'TOTAL PARAMETERS'],
      ['890B', 'KV / TOKEN'],
      ['1M', 'CONTEXT'],
      ['MIT', 'OPEN WEIGHTS']
    ];
    stats.forEach((s, i) => {
      const q = easeOut((local - 1.0 - i * 0.1) / 0.7);
      if (q <= 0) return;
      txt(s[0], 300 + i * 440, 710, 52, i === 3 ? C.acid : C.ink, 700, 'center', q);
      label(s[1], 300 + i * 440, 740, C.dim, q * 0.8, 'center', 10, 1.7);
      if (i < 3) line(520 + i * 440, 675, 520 + i * 440, 735, '#2d4568', 1, q * 0.5);
    });
    const cp = easeOut((local - 1.8) / 0.8);
    g.save(); g.globalAlpha = cp;
    txt('更快的业务，更深的技术。', 960, 838, 31, C.ink, 500, 'center');
    label('让想法，成为作品。  /  官网 · App · API · 开放权重', 960, 888, C.dim, 0.85, 'center', 13, 1.8);
    label('HUGGING FACE  /  MODEL SCOPE  /  deepseek-flash', 960, 920, C.dim, 0.75, 'center', 10, 1.7);
    label('2026.10.17  /  1017 SNAPSHOT', 960, 950, C.faint, 0.9, 'center', 9, 1.6);
    g.restore();
  }

  const SCENES = [sceneIntro, sceneCreation, sceneBench, sceneDive, sceneWeightsShort, sceneCED, sceneSingularity, sceneCSA, sceneStorage, sceneDSpark, sceneOpen, sceneFinal];

  window.VIDEO_PROJECT = {
    title: 'DeepSeek V4.1 FLASH 1017 · DEEPER / FASTER',
    defaultFormat: 'landscape', formats: ['landscape'],
    fps: 60, duration: 60,
    chapters: SECTIONS.map(s => ({ at: s.at, title: s.title })),
    audio: { src: 'assets/score.m4a' },
    setup({ stage }) {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      stage.append(c);
      // 预览使用浏览器加速；离线导出使用 CPU 光栅，保证乱序采样逐像素一致。
      g = c.getContext('2d', { alpha: false, willReadFrequently: new URLSearchParams(location.search).get('export') === '1' });
      g.textRendering = 'geometricPrecision';
      whaleMark = window.DEEPSEEK_WHALE_PATH ? new Path2D(window.DEEPSEEK_WHALE_PATH) : null;
      const random = rng(20261017);
      const wc = document.createElement('canvas'); wc.width = 600; wc.height = 600;
      const wg = wc.getContext('2d', { willReadFrequently: true });
      if (whaleMark) { wg.scale(25, 25); wg.fillStyle = '#fff'; wg.fill(whaleMark, 'evenodd'); }
      const wp = wg.getImageData(0, 0, 600, 600).data;
      for (let y = 0; y < 600; y += 8) for (let x = 0; x < 600; x += 8) if (wp[(y * 600 + x) * 4 + 3] > 180) {
        whaleDots.push({ x: x - 300, y: y - 300, delay: random() * 0.25, angle: random() * TAU, spread: 500 + random() * 900, light: random() });
      }
      dust = Array.from({ length: 86 }, () => ({
        x: random(), y: random(), r: 0.7 + random() * 1.7, vx: 0.2 + random() * 0.8,
        sp: 0.3 + random() * 0.8, ph: random() * TAU, amp: 5 + random() * 24,
        tw: 0.5 + random() * 1.5, a: 0.08 + random() * 0.28,
        color: random() > 0.72 ? C.acid : random() > 0.4 ? C.cyan : C.blue
      }));
      bubbles = Array.from({ length: 74 }, () => ({
        x: random(), y: random(), r: 0.7 + random() * 2.8, speed: 0.25 + random() * 1.4,
        sway: 0.3 + random() * 1.4, phase: random() * TAU, amp: 5 + random() * 20,
        a: 0.10 + random() * 0.30,
        color: random() > 0.86 ? C.acid : random() > 0.45 ? C.cyan : C.blue
      }));
      weightCubes = [];
      let id = 0;
      for (let gx = 0; gx < 7; gx++) for (let gy = 0; gy < 7; gy++) for (let gz = 0; gz < 4; gz++) {
        weightCubes.push({ id: id++, x: (gx - 3) * 0.29, y: (gy - 3) * 0.24 + 0.12, z: (gz - 1.5) * 0.31, seed: random() });
      }
      cacheCells = Array.from({ length: 540 }, () => ({
        x: random(), y: random(), a: random(),
        color: random() > 0.82 ? C.acid : random() > 0.5 ? C.cyan : C.blue
      }));
      poolDots = Array.from({ length: 77 }, (_, i) => ({ i }));
      bitCells = Array.from({ length: 16 }, (_, i) => ({ i }));
      engramWafers = Array.from({ length: 5 }, () => Array.from({ length: 16 }, () => random()));
      buildings = [];
      for (let z = -3; z <= 2; z++) for (let x = -3; x <= 2; x++) buildings.push({ x, z, height: 0.35 + random() * 2.2 });
      const mc = document.createElement('canvas'); mc.width = 900; mc.height = 440;
      const mg = mc.getContext('2d', { willReadFrequently: true });
      mg.fillStyle = '#ffffff'; mg.font = '900 350px Arial'; mg.textAlign = 'center'; mg.fillText('MIT', 450, 350);
      const mp = mg.getImageData(0, 0, 900, 440).data; mitPoints = [];
      for (let y = 0; y < 440; y += 7) for (let x = 0; x < 900; x += 7) if (mp[(y * 900 + x) * 4 + 3] > 180) {
        mitPoints.push({
          x: x - 450, y: y - 255, z: (random() - 0.5) * 50,
          sx: (random() - 0.5) * 1800, sy: (random() - 0.5) * 1200, sz: (random() - 0.5) * 1400,
          delay: random() * 0.48, light: random()
        });
      }
      // 固定颗粒，避免每帧随机
      grainCanvas = document.createElement('canvas'); grainCanvas.width = 256; grainCanvas.height = 256;
      const gg = grainCanvas.getContext('2d'), data = gg.createImageData(256, 256);
      for (let i = 0; i < data.data.length; i += 4) { const v = random() * 255; data.data[i] = v; data.data[i + 1] = v; data.data[i + 2] = v; data.data[i + 3] = 2; }
      gg.putImageData(data, 0, 0);
      grainPattern = g.createPattern(grainCanvas, 'repeat');
    },
    render(t) {
      g.resetTransform(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
      let i = 0; while (i + 1 < starts.length && t >= starts[i + 1]) i++;
      const local = t - starts[i];
      backdrop(t, i);
      SCENES[i](local, t);
      if (i >= 4 && i <= 9) whale(1740, 930, 120, -0.24, t, { alpha: 0.06, simple: true, phase: i });
      if (i > 0 && i !== 3 && i !== 6 && local < 0.55) {
        const p = local / 0.55;
        g.save(); g.globalCompositeOperation = 'lighter';
        shockwave(W * 0.70, H * 0.44, 60 + easeOut(p) * 760, C.cyan, (1 - p) * 0.16, 1.4);
        cutBurst(local);
        g.restore();
      }
      chrome(i, local, t);
      grainAndVignette();
      transition(local, i);
      if (t > 59.35) rect(0, 0, W, H, C.bg, smooth((t - 59.35) / 0.65));
    }
  };
})();
