/* 原创电子配乐 / 120 BPM / 48 kHz stereo.
   与画面共用 timeline.js。修改后须重建 assets/score.m4a；播放器使用编译后的音轨。 */
window.makeTechScore = function (duration) {
  'use strict';
  duration = duration ?? 60;
  const score = window.ABYSS_TIMING;
  if (!score) throw Error('请先加载 timeline.js');
  const sr = 48000, count = Math.ceil(duration * sr), TAU = Math.PI * 2;
  const L = new Float32Array(count), R = new Float32Array(count), send = new Float32Array(count);
  const hz = n => 440 * 2 ** ((n - 69) / 12);
  let seed = 10172026;
  const noise = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 2147483648 - 1; };
  const clamp = x => Math.max(0, Math.min(1, x));
  const fade = (t, len, attack, release) => Math.min(clamp(t / attack), clamp((len - t) / release));
  const atSection = t => score.sections.findLast(s => t >= s.at);
  function event(at, len, fn, gain = 1, pan = 0, wet = 0) {
    const a = Math.max(0, Math.round(at * sr)), b = Math.min(count, Math.round((at + len) * sr));
    const gl = Math.sqrt((1 - pan) * 0.5) * gain, gr = Math.sqrt((1 + pan) * 0.5) * gain;
    for (let i = a; i < b; i++) {
      const t = i / sr - at, v = fn(t, len) * fade(t, len, 0.0015, 0.008);
      L[i] += v * gl; R[i] += v * gr; send[i] += v * gain * wet;
    }
  }
  function pluck(at, note, gain = 0.1, pan = 0, len = 1) {
    const f = hz(note);
    event(at, len, t => {
      const mod = Math.sin(TAU * f * 2 * t) * 1.2 * Math.exp(-t * 13);
      return (Math.sin(TAU * f * t + mod) + 0.24 * Math.sin(TAU * f * 2.002 * t)) * Math.exp(-t * 5.5);
    }, gain, pan, 0.42);
  }
  function kick(at, gain = 0.45) {
    event(at, 0.48, t => {
      // 对频率积分，得到连贯的下滑音。
      const phase = TAU * (46 * t + 105 * 0.024 * (1 - Math.exp(-t / 0.024)));
      return Math.sin(phase) * Math.exp(-t * 10) + noise() * Math.exp(-t * 180) * 0.08;
    }, gain);
  }
  function snare(at, gain = 0.20) {
    let low = 0;
    event(at, 0.23, t => {
      const n = noise(); low += (n - low) * 0.12;
      const clap = Math.exp(-t * 24) + (t > 0.013 ? Math.exp(-(t - 0.013) * 45) * 0.35 : 0);
      return (n - low) * clap * 0.68 + Math.sin(TAU * 185 * t) * Math.exp(-t * 35) * 0.35;
    }, gain, 0, 0.12);
  }
  function hat(at, open, gain, pan) {
    let low = 0;
    event(at, open ? 0.19 : 0.055, t => {
      const n = noise(); low += (n - low) * 0.43;
      return (n - low) * Math.exp(-t * (open ? 23 : 78));
    }, gain, pan, 0.10);
  }
  const chords = [[50, 57, 60, 64, 65], [46, 53, 57, 60, 62], [41, 48, 55, 57, 60], [48, 55, 58, 62, 64]];
  const roots = [38, 34, 41, 36];
  // Dm9 / Bbmaj9 / Fadd9 / C9sus。和声交叠，高声部错开入场。
  for (let bar = 0; bar < 30; bar++) {
    const at = bar * score.bar, s = atSection(at), chord = chords[bar >= 28 ? 0 : bar % 4];
    chord.forEach((note, k) => {
      const f = hz(note + 12), len = Math.min(3, duration - at);
      event(at + k * 0.018, len, t => {
        const env = fade(t, len, 0.40, 0.85);
        return (Math.sin(TAU * f * t + k) + Math.sin(TAU * f * 1.0018 * t + k * 0.7) * 0.38 + Math.sin(TAU * f * 2 * t) * 0.07) * env;
      }, (s.mode === 'break' || s.mode === 'open' ? 0.025 : 0.017), (k - 2) * 0.3, 0.34);
    });
    if (at >= 58) continue;
    const breakMode = ['break', 'air', 'open'].includes(s.mode), focus = s.mode === 'focus';
    const kicks = breakMode ? (s.mode === 'air' && at >= 2 ? [0] : []) : focus ? [0, 2.75] : bar % 2 ? [0, 1.5, 2.5] : [0, 1.75, 2.5, 3.5];
    kicks.forEach(b => kick(at + b * score.beat, focus ? 0.30 : 0.44));
    if (!breakMode) {
      (focus ? [2] : [1, 3]).forEach(b => snare(at + b * score.beat, focus ? 0.14 : 0.20));
      for (let step = 0; step < 8; step++) hat(at + step * 0.25 + (step % 2 ? 0.012 : 0), step === 6, (step % 2 ? 0.055 : 0.028) * (focus ? 0.65 : 1), step % 2 ? 0.3 : -0.35);
      if (bar % 4 === 2 && !focus) [3.25, 3.5, 3.75].forEach((b, j) => hat(at + b * 0.5, false, 0.026 + j * 0.009, (j - 1) * 0.45));
    }
    // 切分低音与底鼓错位，分层产生推力。
    if (!breakMode) [0, 0.75, 1.5, 2.75, 3.5].forEach((b, j) => {
      const f = hz(roots[bar % 4] + (j === 3 ? 12 : 0));
      event(at + b * 0.5, 0.30, t => {
        const env = fade(t, 0.30, 0.008, 0.07) * Math.exp(-t * 5);
        return (Math.sin(TAU * f * t) * 0.8 + Math.sin(TAU * f * 2 * t) * 0.16 + Math.sin(TAU * f * 3 * t) * 0.06) * env;
      }, focus ? 0.12 : 0.20);
    });
    // 两小节旋律动机；技术说明段稀疏，结尾主题回归。
    const motif = bar % 2 ? [[0, 3], [1.5, 2], [2.5, 1]] : [[0.5, 2], [1.5, 4], [2, 3], [3.25, 1]];
    const melodic = s.mode === 'finale' ? 0.12 : s.mode === 'open' ? 0.09 : focus ? 0.035 : breakMode ? 0.045 : 0.085;
    motif.forEach(([b, n], j) => pluck(at + b * 0.5, chord[n] + 24, melodic, (j % 2 ? 1 : -1) * 0.28, breakMode ? 1.6 : 1.05));
    if (['drive', 'drop', 'finale'].includes(s.mode)) [0.25, 1.25, 2.25, 3.75].forEach((b, j) => pluck(at + b * 0.5, chord[[0, 2, 1, 3][j]] + 24, 0.026, j % 2 ? -0.55 : 0.55, 0.6));
  }
  score.cues.forEach((c, index) => {
    if (c.type === 'impact') {
      event(c.at, 0.9, t => Math.sin(TAU * (35 * t + 1.3 * (1 - Math.exp(-t * 22)))) * Math.exp(-t * 7), 0.20 * c.power);
      let lp = 0;
      event(c.at, 0.42, t => { lp += (noise() - lp) * 0.08; return lp * Math.exp(-t * 12); }, 0.13 * c.power, 0, 0.55);
    } else if (c.type === 'sonar') {
      event(c.at, 2.1, t => Math.sin(TAU * 587.33 * t + Math.sin(t * 3) * 0.12) * Math.exp(-t * 3.3), c.power * 0.055, index % 2 ? 0.22 : -0.22, 0.8);
    } else pluck(c.at, c.type === 'tick' ? [86, 89, 93][index % 3] : [74, 77, 81][index % 3], c.power * (c.type === 'tick' ? 0.055 : 0.09), (index % 3 - 1) * 0.3, 0.9);
  });
  [18, 30, 52].forEach(at => {
    let lp = 0;
    event(at - 1.1, 0.94, (t, len) => {
      const q = t / len; lp += (noise() - lp) * (0.015 + q * 0.2);
      return lp * q * q * Math.sin(Math.PI * q) + Math.sin(TAU * (140 * t + 750 * t ** 3 / (3 * len ** 2))) * 0.08 * q ** 2;
    }, 0.16, 0, 0.45);
  });
  event(0.2, 4.8, (t, len) => Math.sin(TAU * (55 * t + 3.4 * Math.sin(t * 0.7))) * Math.sin(Math.PI * t / len), 0.035, -0.3, 0.7);
  pluck(56, 86, 0.10, 0, 3.8);
  const bytes = new ArrayBuffer(44 + count * 4), view = new DataView(bytes);
  const write = (at, s) => { for (let j = 0; j < s.length; j++) view.setUint8(at + j, s.charCodeAt(j)); };
  write(0, 'RIFF'); view.setUint32(4, count * 4 + 36, true); write(8, 'WAVEfmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
  view.setUint32(24, sr, true); view.setUint32(28, sr * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true);
  write(36, 'data'); view.setUint32(40, count * 4, true);
  const taps = [[0.25, 0.19, 0.07], [0.375, 0.08, 0.22], [0.61, 0.11, 0.065], [0.83, 0.05, 0.085], [1.12, 0.045, 0.035]].map(([t, l, r]) => [Math.round(t * sr), l, r]);
  for (let i = 0; i < count; i++) {
    const t = i / sr;
    let left = L[i], right = R[i];
    for (const [delay, l, r] of taps) if (i >= delay) { left += send[i - delay] * l; right += send[i - delay] * r; }
    let breath = 1;
    for (const at of [18, 30, 52]) if (t > at - 0.13 && t < at) breath *= 0.24 + 0.76 * clamp((at - t - 0.02) / 0.11);
    const master = fade(t, duration, 0.025, 1.4) * breath;
    view.setInt16(44 + i * 4, Math.round(Math.tanh(left * 1.1) * master * 30000), true);
    view.setInt16(46 + i * 4, Math.round(Math.tanh(right * 1.1) * master * 30000), true);
  }
  return new Uint8Array(bytes);
};
