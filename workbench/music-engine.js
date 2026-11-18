/* 本地原创配乐：同一乐谱在浏览器和 Node 中使用同一合成器，无在线依赖。 */
(function (global) {
  'use strict';
  const TAU = Math.PI * 2;
  const MASTER_RANGE = 4;
  const TRACKS = [
    { id: 'melody', label: '主题', color: '#edc184' },
    { id: 'harmony', label: '和声', color: '#9caae8' },
    { id: 'bass', label: '低音', color: '#7db9a3' },
    { id: 'pulse', label: '织体', color: '#96cbd8' },
    { id: 'drums', label: '节奏', color: '#c991a5' },
    { id: 'space', label: '空间', color: '#a7a9b0' }
  ];
  const PRESETS = {
    cinema: { label: '叙事电影', bpm: 88, key: 2, mode: 'minor', energy: 0.45, space: 0.3, description: '八分音符钢琴贯穿，低音与轻打击乐托住四拍，弦乐逐层推进。' },
    warm: { label: '温暖讲述', bpm: 96, key: 0, mode: 'major', energy: 0.38, space: 0.24, description: '规律的钢琴分解和弦、轻低音与边鼓，旋律以问答乐句展开。' },
    pulse: { label: '精密电子', bpm: 116, key: 9, mode: 'minor', energy: 0.75, space: 0.24, description: '切分低音、短音型与分层鼓组，适合信息推进。' }
  };
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const hz = n => 440 * 2 ** ((n - 69) / 12);
  function random(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
  function config(input = {}) {
    if(input.version!==undefined&&input.version!==1)throw Error('不支持的配乐方案版本');
    const preset = input.preset ?? 'cinema';
    if (!Object.hasOwn(PRESETS, preset)) throw Error('未知配乐方向');
    const p = PRESETS[preset], out = { version: 1, title: '未命名配乐', duration: 32, variation: 0.5, seed: 17026, soundEngine: 'sampled', motifMode: 'develop', motifDegrees: preset==='warm'?[2,4,3,2,1,0]:preset==='pulse'?[0,2,4,6,4,2]:[0,4,3,2,1,0], ...p, ...input, preset };
    const num = (name, min, max) => { if (!Number.isFinite(out[name]) || out[name] < min || out[name] > max) throw Error(`无效参数 ${name}：${min}–${max}`); };
    num('duration', 8, 120); num('bpm', 60, 150); num('key', 0, 11); num('energy', 0, 1); num('variation', 0, 1); num('space', 0, 1); num('seed', 1, 2147483647);
    if (!Number.isInteger(out.key) || !Number.isInteger(out.seed) || !['minor', 'major', 'dorian'].includes(out.mode) || !['develop', 'repeat'].includes(out.motifMode) || !['sampled','synthetic'].includes(out.soundEngine)) throw Error('无效调性、种子、音源或动机方式');
    if (!Array.isArray(out.motifDegrees) || out.motifDegrees.length < 3 || out.motifDegrees.length > 8 || out.motifDegrees.some(n => !Number.isInteger(n) || n < -7 || n > 14)) throw Error('主题需要 3–8 个整数音级（-7 至 14）');
    if (typeof out.title !== 'string' || out.title.length > 120) throw Error('标题过长');
    out.mix = Object.fromEntries(TRACKS.map(t => [t.id, input.mix?.[t.id] ?? 1]));
    if (Object.values(out.mix).some(n => !Number.isFinite(n) || n < 0 || n > 1.5)) throw Error('分轨音量应在 0–1.5 之间');
    return out;
  }
  function nearestVoicing(pcs, previous) {
    const candidates = pcs.map(pc => [pc + 48, pc + 60, pc + 72].filter(n => n >= 48 && n <= 81));
    let best, cost = Infinity;
    function visit(notes) {
      if (notes.length === pcs.length) {
        const sorted = [...notes].sort((a, b) => a - b);
        if (sorted.some((n, i) => i && n - sorted[i - 1] < 3) || sorted.at(-1) - sorted[0] > 23) return;
        const score = sorted.reduce((s, n, i) => s + Math.abs(n - (previous?.[i] ?? (53 + i * 5))), 0);
        if (score < cost) { best = sorted; cost = score; } return;
      }
      for (const note of candidates[notes.length]) visit([...notes, note]);
    }
    visit([]); return best || pcs.map((pc, i) => pc + 48 + (i > 1 ? 12 : 0)).sort((a, b) => a - b);
  }
  function plan(input = {}) {
    const c = config(input), rand = random(c.seed), beat = 60 / c.bpm, bar = 4 * beat;
    const scale = c.mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : c.mode === 'dorian' ? [0, 2, 3, 5, 7, 9, 10] : [0, 2, 3, 5, 7, 8, 10];
    const degree = (n, octave = 60) => octave + c.key + scale[((n % 7) + 7) % 7] + Math.floor(n / 7) * 12;
    let registerShift = 0;
    while(degree(c.motifDegrees[0],60)+registerShift>68)registerShift-=12;
    while(degree(c.motifDegrees[0],60)+registerShift<57)registerShift+=12;
    const closingBar = Math.max(1, Math.floor((c.duration - 1.1) / bar)), bars = closingBar + 1;
    const sectionNames = ['铺陈', '展开', '推进', '收束'], energies = [0.34, 0.65, 1, 0.32];
    const phraseCount = Math.ceil(closingBar / 2);
    const sectionAt = b => b === closingBar ? 3 : b < 2 ? 0 : Math.floor(b / 2) < Math.ceil(phraseCount * .65) ? 1 : 2;
    const sections = [], chords = [], notes = [], phrases = [];
    let prev, lastSection = -1, lastMelody = degree(c.motifDegrees[0], 60);
    const add = (track, at, length, midi, velocity, instrument, pan = 0) => {
      if (at < 0 || at >= c.duration - .12 || length <= 0) return;
      notes.push({ track, at: +at.toFixed(6), length: +Math.min(length, c.duration - at).toFixed(6), midi, velocity: clamp(velocity, 0, .7), instrument, pan: clamp(pan, -.8, .8), seed: Math.floor(rand() * 2147483646) + 1 });
    };
    // 先铺好整曲和声，旋律落在下一小节时也能找到实际和弦。
    for (let b = 0; b < bars; b++) {
      const section = sectionAt(b), at = b * bar;
      if (section !== lastSection) { if (sections.length) sections.at(-1).end = at; sections.push({ title: sectionNames[section], start: at, end: c.duration, energy: energies[section] }); lastSection = section; }
      const rootDegree = b === closingBar ? 0 : (c.mode === 'major' ? [0, 4, 5, 3] : [0, 5, 2, 6])[b % 4];
      const pcs = (b === closingBar ? [0, 2, 4] : [0, 2, 4, 6]).map(n => degree(rootDegree + n, 0) % 12);
      const voices = nearestVoicing(pcs, prev); prev = voices;
      let root = degree(rootDegree, 36); while(root > 47) root -= 12;
      const chord = { at, end: b === closingBar ? c.duration : at + bar, root, notes: voices, degree: rootDegree };
      chords.push(chord);
    }
    // 各段共用同一拍点；只改变力度与配器，不撤掉整个节奏主干。
    for (let b = 0; b < bars; b++) {
      const section = sectionAt(b), energy = energies[section] * c.energy, chord = chords[b], at = chord.at, ending = b === closingBar;
      chord.notes.forEach((n, i) => add('harmony', at + i * .008, ending ? c.duration - at : bar - .18, n, .026 + energy * .02, c.preset === 'warm' ? 'keys' : 'pad', (i - 1.5) * .3));
      const bassPattern = ending ? [0] : c.preset === 'pulse' ? [0, 1.5, 2, 3.5] : [0, 2];
      bassPattern.forEach((v, i) => add('bass', at + v * beat, (ending ? 2.5 : i % 2 ? .68 : .88) * beat, chord.root + (c.preset === 'pulse' && i === 3 ? 12 : 0), (.105 + energy * .065) * (i % 2 ? .8 : 1), 'bass'));
      const arp = [0, 2, 1, 2, 0, 2, 1, 2], accents = [1, .55, .74, .58, .9, .55, .76, .62];
      for (let i = 0; i < (ending ? 4 : 8); i++) {
        add('pulse', at + i * .5 * beat, .43 * beat, chord.notes[arp[i]], (.032 + c.energy * .022) * (.68 + energies[section] * .32) * accents[i] * (ending ? 1 - i * .16 : 1), 'pluck', i % 2 ? .24 : -.24);
      }
      const drumLevel = c.preset === 'pulse' ? 1 : c.preset === 'warm' ? .58 : .68;
      (ending ? [0] : [0, 2]).forEach(v => add('drums', at + v * beat, .32, 36, (.09 + energy * .08) * drumLevel, 'kick'));
      if (!ending) {
        [1, 3].forEach(v => add('drums', at + v * beat + .006, .09, c.preset === 'pulse' ? 38 : 37, (.048 + energy * .04) * drumLevel, c.preset === 'pulse' ? 'snare' : 'rim'));
        for (let i = 0; i < 8; i++) add('drums', at + i * .5 * beat + (i % 2 ? .004 : 0), .065, 42, (.018 + energy * .018) * drumLevel * (i % 2 ? .8 : .52), 'hat', i % 2 ? .22 : -.22);
      }
    }
    // 乐句固定在两小节网格，段落边界不另起一套重叠旋律。
    const rhythms = {3:[0,3,6],4:[0,2,4.5,6],5:[0,1.5,3,4.5,6],6:[0,1,1.5,3,4.5,6],7:[0,1,1.5,3,4,5,6.5],8:[0,1,1.5,2.5,4,5,6,7]};
    const developed = c.motifMode === 'develop' && c.variation > 0;
    for (let b = 0; b < closingBar; b += 2) {
        const at = b * bar, phrase = b / 2, section = sectionAt(b), energy = energies[section] * c.energy, end = Math.min((b + 2) * bar, closingBar * bar);
        const fragment = developed && section === 1 && phrase % 2 === 1;
        const transform = !developed || phrase === 0 ? '原形' : fragment ? '留白 · 主题片段' : section === 2 ? '主题再现' : phrase % 3 === 1 ? '移位回答' : phrase % 3 === 2 ? '节奏变形' : '尾句变化';
        phrases.push({ at, end, transform });
        const rhythm = [...rhythms[c.motifDegrees.length]];
        if (transform === '节奏变形' && rhythm.length >= 5) { rhythm[1] += .5; rhythm[2] += .5; }
        // 整句移调保持主题轮廓；不逐音贪心找最近八度，把上行五度折成下行四度。
        const startChord=chords[b],head=c.motifDegrees[0];
        const shifts=developed&&phrase>0?[-2,-1,0,1,2].filter(v=>startChord.notes.some(n=>n%12===degree(head+v,0)%12)):[0];
        const phraseShift=shifts.reduce((a,v)=>Math.abs(v)<Math.abs(a)?v:a,shifts[0]??0);
        const events = c.motifDegrees.map((d, i) => ({d,i,at:at + rhythm[i] * beat})).filter(e => e.at < end - .1 && (!fragment || e.i % 2 === 0 || e.i === c.motifDegrees.length - 1));
        events.forEach(({d,i,at:eventAt}, eventIndex) => {
          let step = d + phraseShift;
          if (developed && phrase > 0) {
            if (transform === '移位回答') step += Math.round(c.variation * 2);
            if (transform === '尾句变化' && i >= c.motifDegrees.length - 2) step += i % 2 ? -1 : 1;
          }
          let midi = degree(step, 60) + registerShift;
          const current = chords.findLast(x => x.at <= eventAt + 1e-6);
          if (developed && i===c.motifDegrees.length-1) {
            const choices = current.notes.flatMap(n => [n-12,n,n+12]).filter(n => n >= 55 && n <= 79);
            if (choices.length) midi = choices.reduce((a, n) => Math.abs(n - midi) < Math.abs(a - midi) ? n : a);
          }
          const candidates = [-36,-24,-12,0,12,24,36].map(v => midi + v).filter(n => n >= 55 && n <= 79);
          const intended=midi;
          midi = candidates.reduce((a,n) => Math.abs(n - intended) < Math.abs(a - intended) ? n : a); lastMelody = midi;
          const next = events[eventIndex + 1]?.at ?? end;
          const timing = eventIndex ? (rand() - .5) * .012 : 0;
          add('melody', eventAt + timing, Math.max(.12, next - eventAt - .09), midi, (.105 + energy * .04) * ([1,.78,.88,.92,.8,.9][i%6]) * (.97 + rand() * .06), c.preset === 'pulse' ? 'pluck' : 'keys', (i % 2 ? 1 : -1) * .08);
        });
    }
    const endAt = closingBar * bar;
    phrases.push({at:endAt,end:c.duration,transform:c.motifMode === 'repeat' ? '原形' : '主题回归'});
    const tonics = [-12,0,12].map(n=>degree(0,60)+n).filter(n=>n>=55&&n<=79);
    const tonic = tonics.reduce((a,n)=>Math.abs(n-lastMelody)<Math.abs(a-lastMelody)?n:a);
    add('melody',endAt,Math.min(2.5*beat,c.duration-endAt),tonic,.115,c.preset === 'pulse' ? 'pluck' : 'keys');
    return { version: 1, config: c, duration: c.duration, bpm: c.bpm, beat, bar, bars, sections, chords, phrases, notes: notes.sort((a, b) => a.at - b.at) };
  }
  let sampleCache;
  function samples(){
    if(sampleCache)return sampleCache;
    const bank=global.MUSIC_SAMPLE_BANK;if(!bank)throw Error('采样音色未加载，请检查 sample-bank.js');
    sampleCache={};
    for(const [instrument,notes] of Object.entries(bank.instruments)){sampleCache[instrument]=Object.entries(notes).map(([midi,data])=>{const raw=typeof Buffer!=='undefined'?Buffer.from(data,'base64'):Uint8Array.from(atob(data),c=>c.charCodeAt(0)),view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength),pcm=new Float32Array(raw.byteLength/2);for(let i=0;i<pcm.length;i++)pcm[i]=view.getInt16(i*2,true)/32768;return{midi:+midi,pcm,rate:bank.sampleRate};});}
    return sampleCache;
  }
  async function render(score, options = {}) {
    const sr = options.sampleRate ?? 44100;
    if (![22050, 32000, 44100, 48000].includes(sr)) throw Error('不支持的采样率');
    const count = Math.ceil(score.duration * sr), stems = Object.fromEntries(TRACKS.map(t => [t.id, [new Float32Array(count), new Float32Array(count)]]));
    const wet = new Float32Array(count);
    let completed = 0;
    for (const n of score.notes) {
      const useSamples=score.config.soundEngine==='sampled',kind=n.instrument==='keys'||(n.instrument==='pluck'&&score.config.preset!=='pulse')?'piano':n.instrument==='pad'?'strings':n.instrument==='bass'&&score.config.preset!=='pulse'?'bass':null;
      const bank=useSamples&&kind?samples()[kind]:null, sample=bank?.reduce((a,b)=>Math.abs(b.midi-n.midi)<Math.abs(a.midi-n.midi)?b:a);
      const sampleStep=sample?sample.rate/sr*2**((n.midi-sample.midi)/12):0;
      const interpolate=sample?(p=>{const i=Math.floor(p);return i+1<sample.pcm.length?sample.pcm[i]*(1-(p-i))+sample.pcm[i+1]*(p-i):0;}):null;
      const tail=sample?(kind==='piano'?.9:kind==='strings'?.55:.24):0;
      const start = Math.max(0, Math.round(n.at * sr)), end = Math.min(count, Math.ceil((n.at + n.length+tail) * sr));
      const [l, r] = stems[n.track], f = hz(n.midi), rand = random(n.seed);
      const left = Math.sqrt((1 - n.pan) / 2) * n.velocity, right = Math.sqrt((1 + n.pan) / 2) * n.velocity;
      let low = 0;
      for (let i = start; i < end; i++) {
        const t = (i - start) / sr, remaining = (end - i) / sr, attack = Math.min(1, t / (n.instrument === 'pad' ? .22 : .004)), release = Math.min(1, remaining / (n.instrument === 'pad' ? .4 : .045));
        let v = 0;
        if(sample){
          let pos=(i-start)*sampleStep,blend=0,other=0;
          if(kind==='strings'){
            const a=sample.rate*.45,b=sample.rate*1.2,cross=sample.rate*.08;
            if(pos>a+cross){pos=a+cross+((pos-a-cross)%(b-a-cross));if(pos>b-cross){blend=(pos-b+cross)/cross;other=a+pos-b+cross;}}
          }
          v=interpolate(pos)*(1-blend)+(blend?interpolate(other)*blend:0);
          const held=t<=n.length?1:Math.max(0,1-(t-n.length)/tail)**2;
          v*=held*(kind==='piano'?10:kind==='strings'?9:7);
        } else if (n.instrument === 'keys') {
          for (let k = 1; k <= 5; k++) v += Math.sin(TAU * f * k * (1 + .00012 * k * k) * t) * Math.exp(-t * (.8 + k * 1.1)) / (k * k ** .3);
          v += Math.sin(TAU * f * 1.0014 * t) * Math.exp(-t * 1.4) * .22;
        } else if (n.instrument === 'pad') {
          for (let k = 1; k <= 4; k++) v += (Math.sin(TAU * f * k * .9992 * t + k) + Math.sin(TAU * f * k * 1.0008 * t)) / (k * k * 2.5);
          v *= .8 + .2 * Math.sin(TAU * .22 * t);
        } else if (n.instrument === 'pluck') v = Math.sin(TAU * f * t + Math.sin(TAU * f * 2 * t) * 1.6 * Math.exp(-t * 14)) * Math.exp(-t * 5.4) + .14 * Math.sin(TAU * f * 2.003 * t) * Math.exp(-t * 9);
        else if (n.instrument === 'bass') v = (Math.sin(TAU * f * t) + .24 * Math.sin(TAU * f * 2 * t) * Math.exp(-t * 4) + .1 * Math.sin(TAU * f * 3 * t) * Math.exp(-t * 8)) * Math.exp(-t * 1.5);
        else if (n.instrument === 'kick' || n.instrument === 'impact') v = Math.sin(TAU * (44 * t + 2.5 * (1 - Math.exp(-t * 40)))) * Math.exp(-t * (n.instrument === 'impact' ? 6 : 12));
        else { const noise = rand() * 2 - 1; low += (noise - low) * (n.instrument === 'hat' ? .45 : .12); v = (noise - low) * Math.exp(-t * (n.instrument === 'hat' ? 65 : n.instrument === 'rim' ? 110 : 24)); if (n.instrument === 'snare') v += .3 * Math.sin(TAU * 180 * t) * Math.exp(-t * 35); if(n.instrument==='rim')v=v*.35+(Math.sin(TAU*1750*t)+.5*Math.sin(TAU*2380*t))*Math.exp(-t*90)*.65; }
        v *= attack * release;
        l[i] += v * left; r[i] += v * right;
        if (['keys', 'pad', 'pluck'].includes(n.instrument)) wet[i] += v * n.velocity * (n.instrument === 'pad' ? .25 : .4);
      }
      completed++;
      if (completed % 16 === 0) { options.onProgress?.(completed / score.notes.length * .8); if (options.yield) await options.yield(); }
    }
    const taps = [[.071,.19,.04],[.113,.03,.16],[.173,.14,.08],[.257,.06,.13],[.383,.09,.05],[.521,.05,.08],[.719,.035,.025],[1.039,.018,.026]];
    for (const [delay, a, b] of taps) {
      const shift = Math.round(delay * sr);
      for (let i = shift; i < count; i++) { stems.space[0][i] += wet[i - shift] * a * score.config.space; stems.space[1][i] += wet[i - shift] * b * score.config.space; }
    }
    // 对所有分轨应用同一收尾包络，确保 solo/mute 与完整混音时间一致。
    for (const [l, r] of Object.values(stems)) for (let i = 0; i < count; i++) {
      const fade = Math.min(1, i / (sr * .025), (count - 1 - i) / (sr * 1.1));
      l[i] *= fade; r[i] *= fade;
    }
    options.onProgress?.(1);
    let masterGain=1;
    if(score.config.soundEngine==='sampled'){
      const pairs=Object.values(stems);let sum=0;for(let i=0;i<count;i++){let v=0;for(const pair of pairs)v+=(pair[0][i]+pair[1][i])*.5;sum+=v*v;}
      const rms=Math.sqrt(sum/count);masterGain=rms>0?clamp(.075/rms,.6,3):1;
    }
    return { sampleRate: sr, duration: score.duration, stems, score, masterGain };
  }
  function mix(rendered, levels = rendered.score.config.mix) {
    const count = Math.ceil(rendered.duration * rendered.sampleRate), left = new Float32Array(count), right = new Float32Array(count);
    for (const t of TRACKS) {
      const gain = levels[t.id] ?? 1;
      if (!Number.isFinite(gain) || gain < 0 || gain > 1.5) throw Error('无效分轨音量');
      const pair = rendered.stems[t.id];
      for (let i = 0; i < count; i++) { left[i] += pair[0][i] * gain; right[i] += pair[1][i] * gain; }
    }
    let peak = 0, sum = 0;
    for (let i = 0; i < count; i++) {
      left[i] = Math.tanh(left[i] * 1.5 * (rendered.masterGain||1)) * .92; right[i] = Math.tanh(right[i] * 1.5 * (rendered.masterGain||1)) * .92;
      peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i])); sum += (left[i] ** 2 + right[i] ** 2) / 2;
    }
    return { channels: [left, right], sampleRate: rendered.sampleRate, duration: rendered.duration, peak, rms: Math.sqrt(sum / count), credits:rendered.score.config.soundEngine==='sampled'?credits():'' };
  }
  function credits(){return 'Piano: Salamander Grand Piano V3 by Alexander Holm, retuned by Markus Fiedler; https://github.com/Tonejs/audio/tree/master/salamander. Strings and bass: FluidR3 GM by Frank Wen, MIDI.js pre-rendering by Benjamin Gleitzman; https://github.com/gleitz/midi-js-soundfonts. Samples CC BY 3.0, https://creativecommons.org/licenses/by/3.0/. Modified: selected notes, mono PCM resampling, duration limits, envelopes and pitch shifting. Composition generated by Score Room.';}
  function masterCurve(){const curve=new Float32Array(16385);for(let i=0;i<curve.length;i++)curve[i]=Math.tanh((i/(curve.length-1)*2-1)*MASTER_RANGE*1.5)*.92;return curve;}
  function wav(audio) {
    const [l, r] = audio.channels, comment=audio.credits?new TextEncoder().encode(audio.credits+'\0'):null, commentBytes=comment?comment.length+(comment.length%2):0;
    const buffer = new ArrayBuffer(44 + l.length * 4 + (comment?20+commentBytes:0)), v = new DataView(buffer);
    const text = (at, s) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
    text(0, 'RIFF'); v.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, audio.sampleRate, true); v.setUint32(28, audio.sampleRate * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); text(36, 'data'); v.setUint32(40, l.length * 4, true);
    for (let i = 0; i < l.length; i++) { v.setInt16(44 + i * 4, Math.round(clamp(l[i], -1, 1) * 32767), true); v.setInt16(46 + i * 4, Math.round(clamp(r[i], -1, 1) * 32767), true); }
    if(comment){const at=44+l.length*4;text(at,'LIST');v.setUint32(at+4,12+commentBytes,true);text(at+8,'INFOICMT');v.setUint32(at+16,comment.length,true);new Uint8Array(buffer,at+20,comment.length).set(comment);}
    return new Uint8Array(buffer);
  }
  function timeline(score) { return { version: 1, duration: score.duration, bpm: score.bpm, beat: score.beat, bar: score.bar, sections: score.sections, cues: score.chords.map(c => ({ at: c.at, type: 'chord', notes: c.notes })), phrases: score.phrases }; }
  function midi(score) {
    const bytes=[], ascii=s=>Array.from(s,c=>c.charCodeAt(0)), be=(v,n)=>Array.from({length:n},(_,i)=>(v>>>(8*(n-i-1)))&255);
    const variable=n=>{let a=[n&127];while((n>>>=7)>0)a.unshift((n&127)|128);return a;};
    const track=events=>{events.sort((a,b)=>a.tick-b.tick||a.order-b.order);let last=0,data=[];for(const e of events){data.push(...variable(e.tick-last),...e.data);last=e.tick;}data.push(...variable(Math.max(0,Math.round(score.duration/score.beat*480)-last)),255,47,0);return [...ascii('MTrk'),...be(data.length,4),...data];};
    const tempo=Math.round(60000000/score.bpm);
    const tracks=[track([{tick:0,order:0,data:[255,81,3,...be(tempo,3)]},{tick:0,order:1,data:[255,88,4,4,2,24,8]}])];
    const programs={melody:score.config.preset==='pulse'?10:0,harmony:score.config.preset==='warm'?0:48,bass:score.config.preset==='pulse'?38:32,pulse:score.config.preset==='pulse'?10:0,drums:0};
    TRACKS.filter(t=>t.id!=='space').forEach((t,i)=>{const channel=t.id==='drums'?9:i,events=[{tick:0,order:0,data:[192|channel,programs[t.id]]}];for(const note of score.notes.filter(n=>n.track===t.id)){const pitch=clamp(note.midi,0,127),velocity=clamp(Math.round(note.velocity*400),1,127),start=Math.round(note.at/score.beat*480),end=Math.max(start+1,Math.round((note.at+note.length)/score.beat*480));events.push({tick:start,order:2,data:[144|channel,pitch,velocity]},{tick:end,order:1,data:[128|channel,pitch,0]});}tracks.push(track(events));});
    bytes.push(...ascii('MThd'),0,0,0,6,0,1,...be(tracks.length,2),1,224);for(const t of tracks)bytes.push(...t);return Uint8Array.from(bytes);
  }
  global.MusicScore = { TRACKS, PRESETS, MASTER_RANGE, config, plan, render, mix, wav, midi, timeline, credits, masterCurve, nearestVoicing, random, hz };
})(globalThis);
