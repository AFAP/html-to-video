(function () {
  'use strict';
  const M = window.MusicScore, $ = id => document.getElementById(id);
  const names = ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
  const state = { config: M.config(window.MUSIC_WORKBENCH_DEFAULTS || {}), score: null, rendered: null, mixed: null, playing: false, position: 0, sources: [], gains: {}, meters: {}, muted: new Set(), solo: new Set(), selected: 0, busy: false, cache: new Map(), videoUrl: null };
  let context, master, startedAt = 0, timer;
  const clock = t => `${String(Math.floor(t / 60)).padStart(2,'0')}:${(t % 60).toFixed(1).padStart(4,'0')}`;
  function message(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
  function controlsFromConfig() {
    const c = state.config;
    for (const key of ['preset','bpm','duration','key','mode','seed','soundEngine']) $(key).value = c[key];
    for (const key of ['energy','variation','space']) { $(key).value = Math.round(c[key] * 100); $(key + '-value').textContent = Math.round(c[key] * 100) + '%'; }
    $('motif').value = c.motifDegrees.join(', ');
    for (const t of M.TRACKS) { const input = $('gain-' + t.id); if (input) { input.value = Math.round(c.mix[t.id] * 100); $('gain-value-' + t.id).textContent = input.value + '%'; } }
  }
  function effectiveMix() {
    return Object.fromEntries(M.TRACKS.map(t => [t.id, state.muted.has(t.id) || state.solo.size && !state.solo.has(t.id) ? 0 : state.config.mix[t.id]]));
  }
  function readControls() {
    const c = { ...state.config };
    for (const key of ['preset','mode','soundEngine']) c[key] = $(key).value;
    for (const key of ['bpm','duration','key','seed']) c[key] = Number($(key).value);
    for (const key of ['energy','variation','space']) c[key] = Number($(key).value) / 100;
    c.motifDegrees = $('motif').value.split(/[,，\s]+/).filter(Boolean).map(Number);
    return M.config(c);
  }
  function canvas(id) {
    const el = $(id), ratio = window.devicePixelRatio || 1, width = Math.max(1, el.clientWidth), height = Number(el.dataset.baseHeight || el.getAttribute('height'));
    el.dataset.baseHeight = height;
    el.style.height = height + 'px'; el.width = Math.round(width * ratio); el.height = Math.round(height * ratio);
    const g = el.getContext('2d'); g.setTransform(ratio,0,0,ratio,0,0);
    return { g, width, height };
  }
  function drawArc() {
    const { g, width:w, height:h } = canvas('arc'); g.clearRect(0,0,w,h);
    const sections = state.score.sections, points = [{x:0,y:h-15}, ...sections.map(s => ({x:(s.start+s.end)/2/state.score.duration*w,y:h-15-s.energy*state.config.energy*(h-30)})),{x:w,y:h-19}];
    g.beginPath();g.moveTo(0,h);
    points.forEach(p=>g.lineTo(p.x,p.y));g.lineTo(w,h);g.closePath();
    const fill=g.createLinearGradient(0,0,0,h);fill.addColorStop(0,'#edc18422');fill.addColorStop(1,'#edc18400');g.fillStyle=fill;g.fill();
    g.beginPath();points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.strokeStyle='#9b805c';g.lineWidth=1.2;g.stroke();
  }
  function drawRoll() {
    const {g,width:w,height:h}=canvas('piano-roll'), score=state.score, left=34, top=21, plotW=w-left-3, rows=25, low=48, high=93;
    g.clearRect(0,0,w,h);g.font='10px "Microsoft YaHei",sans-serif';
    for(let i=0;i<=rows;i++){const y=top+i*(h-top)/rows;g.strokeStyle=i%4?'#20232a':'#2c2f37';g.beginPath();g.moveTo(left,y);g.lineTo(w,y);g.stroke();}
    for(let b=0;b<=score.bars;b++){const x=left+b*score.bar/score.duration*plotW;g.strokeStyle=b%2?'#24272f':'#363942';g.beginPath();g.moveTo(x,top);g.lineTo(x,h);g.stroke();if(b%Math.max(1,Math.ceil(score.bars/10))===0){g.fillStyle='#7c808d';g.fillText((b*score.bar).toFixed(0)+'s',x+3,12);}}
    for(const midi of [48,60,72,84]){const y=top+(high-midi)/(high-low)*(h-top);g.fillStyle='#777c8a';g.fillText(names[midi%12]+(Math.floor(midi/12)-1),1,y+3);}
    for(const n of score.notes){if(!['melody','harmony'].includes(n.track))continue;const x=left+n.at/score.duration*plotW,y=top+(high-n.midi)/(high-low)*(h-top);g.fillStyle=n.track==='melody'?'#edc184':'#7f8bba88';g.fillRect(x,y,Math.max(2,n.length/score.duration*plotW-1),n.track==='melody'?5:3);}
    $('phrase-labels').replaceChildren();
    for(const phrase of score.phrases.filter((_,i)=>i%Math.max(1,Math.ceil(score.phrases.length/5))===0)){const span=document.createElement('span');span.textContent=`${phrase.at.toFixed(1)}s · ${phrase.transform}`;$('phrase-labels').append(span);}
  }
  function drawWave() {
    const {g,width:w,height:h}=canvas('waveform');g.clearRect(0,0,w,h);g.strokeStyle='#30343d';g.beginPath();g.moveTo(0,h/2);g.lineTo(w,h/2);g.stroke();
    if(!state.mixed){g.fillStyle='#686e7c';g.font='11px sans-serif';g.fillText('生成配乐后显示实际音频',10,h/2-10);return;}
    const a=state.mixed.channels[0], step=Math.max(1,Math.floor(a.length/w));g.fillStyle='#8fb4a4';
    for(let x=0;x<w;x++){let peak=0;const start=x*step,end=Math.min(a.length,start+step);for(let n=start;n<end;n++)peak=Math.max(peak,Math.abs(a[n]));const y=Math.max(1,peak*(h-8));g.fillRect(x,h/2-y/2,1,y);}
    const db=state.mixed.peak>0?(20*Math.log10(state.mixed.peak)).toFixed(1):'−∞';
    $('audio-stats').textContent=`${(state.mixed.sampleRate/1000).toFixed(1)} kHz · Stereo · 峰值 ${db} dBFS`;
  }
  function drawSections() {
    $('sections').replaceChildren();
    state.score.sections.forEach((s,i)=>{const b=document.createElement('button');b.type='button';b.style.flex=String(s.end-s.start);b.classList.toggle('selected',i===state.selected);b.setAttribute('aria-pressed',String(i===state.selected));const title=document.createElement('b');title.textContent=s.title;const time=document.createElement('small');time.textContent=`${clock(s.start).slice(0,-2)} — ${clock(s.end).slice(0,-2)}`;b.append(title,time);b.onclick=()=>{state.selected=i;seek(s.start);drawSections();};$('sections').append(b);});
  }
  function draw() { if(!state.score)return;drawSections();drawArc();drawRoll();drawWave();updatePosition(); }
  function rebuild() {
    state.score=M.plan(state.config);state.selected=Math.min(state.selected,state.score.sections.length-1);
    $('score-title').replaceChildren(document.createTextNode(M.PRESETS[state.config.preset].label+' '));const tag=document.createElement('span');tag.textContent='原创方案';$('score-title').append(tag);
    $('score-bpm').textContent=state.config.bpm+' BPM';$('score-key').textContent=names[state.config.key]+' '+({minor:'小调',major:'大调',dorian:'多利亚'}[state.config.mode]);$('score-duration').textContent=clock(state.config.duration).slice(0,-2);$('seek').max=state.config.duration;
    $('preset-note').textContent=M.PRESETS[state.config.preset].description;
    $('engine-label').textContent=state.config.soundEngine==='sampled'?'本地生成 · 采样乐器':'本地生成 · 轻量合成';
    document.querySelectorAll('[data-compare]').forEach(b=>{const selected=b.dataset.compare===state.config.motifMode;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});
    draw();
  }
  function invalidate() { pause();state.rendered=null;state.mixed=null;state.position=0;state.cache.clear();$('play').disabled=true;$('export-wav').disabled=true;$('audio-stats').textContent='生成后显示实际波形与峰值';rebuild();message('参数已更新。重新生成后试听当前编排。'); }
  function getContext() {
    if(!context){context=new AudioContext();master=context.createGain();const shaper=context.createWaveShaper();shaper.curve=M.masterCurve();shaper.oversample='none';master.connect(shaper).connect(context.destination);}
    return context;
  }
  function now() { return state.playing?Math.min(state.config.duration,state.position+(context.currentTime-startedAt)):state.position; }
  function updatePosition() {
    const t=now();$('clock').replaceChildren(document.createTextNode(clock(t)+' '));const total=document.createElement('span');total.textContent='/ '+clock(state.config.duration);$('clock').append(total);$('seek').value=t;
    $('playhead').hidden=!state.rendered;$('playhead').style.left=(34+(Math.max(0,$('piano-roll').clientWidth-37))*t/state.config.duration)+'px';
    const phrase=state.score.phrases.findLast(p=>p.at<=t);$('current-note').textContent=phrase?`${phrase.transform} · ${clock(phrase.at)}`:'原创主题';
    if(state.playing){for(const track of M.TRACKS){const analyzer=state.meters[track.id];if(!analyzer)continue;const data=new Float32Array(analyzer.fftSize);analyzer.getFloatTimeDomainData(data);let rms=0;for(const v of data)rms+=v*v;const value=Math.min(100,Math.sqrt(rms/data.length)*450);$('meter-'+track.id).style.width=value+'%';}}
  }
  function pause() {
    if(state.playing)state.position=now();state.playing=false;
    for(const source of state.sources){try{source.stop();}catch{}source.disconnect();}state.sources=[];
    for(const g of Object.values(state.gains))g.disconnect();for(const a of Object.values(state.meters))a.disconnect();state.gains={};state.meters={};
    clearInterval(timer);$('video').pause();$('play').textContent='▶';$('play').setAttribute('aria-label','播放配乐');
    for(const t of M.TRACKS)$('meter-'+t.id).style.width='0%';updatePosition();
  }
  async function play() {
    if(!state.rendered||state.busy)return;
    const ctx=getContext();await ctx.resume();
    if(state.position>=state.config.duration-.03)state.position=0;
    const section=state.score.sections[state.selected];if($('loop').checked&&(state.position<section.start||state.position>=section.end))state.position=section.start;
    const levels=effectiveMix();
    master.gain.value=(state.rendered.masterGain||1)/M.MASTER_RANGE;
    for(const track of M.TRACKS){const pair=state.rendered.stems[track.id],buffer=ctx.createBuffer(2,pair[0].length,state.rendered.sampleRate);buffer.copyToChannel(pair[0],0);buffer.copyToChannel(pair[1],1);const source=ctx.createBufferSource();source.buffer=buffer;const gain=ctx.createGain();gain.gain.value=levels[track.id];const analyzer=ctx.createAnalyser();analyzer.fftSize=256;source.connect(gain).connect(analyzer).connect(master);state.gains[track.id]=gain;state.meters[track.id]=analyzer;state.sources.push(source);}
    startedAt=ctx.currentTime;state.playing=true;for(const source of state.sources)source.start(startedAt,state.position);
    $('play').textContent='Ⅱ';$('play').setAttribute('aria-label','暂停配乐');
    const video=$('video');if(state.videoUrl&&state.position<video.duration){video.currentTime=state.position;video.play().catch(()=>message('配乐已播放；视频暂未能播放，请点击视频控件。'));}
    timer=setInterval(()=>{const t=now(),s=state.score.sections[state.selected];if($('loop').checked&&t>=s.end-.025){seek(s.start);return;}if(t>=state.config.duration-.02){pause();state.position=state.config.duration;updatePosition();return;}if(state.videoUrl&&!video.paused&&Math.abs(video.currentTime-t)>.15&&t<video.duration)video.currentTime=t;updatePosition();},50);
  }
  function seek(t) { const resume=state.playing;pause();state.position=Math.max(0,Math.min(state.config.duration,t));if(state.videoUrl&&Number.isFinite($('video').duration))$('video').currentTime=Math.min(state.position,$('video').duration);updatePosition();if(resume)play(); }
  function updateMix() {
    const levels=effectiveMix();for(const t of M.TRACKS){const g=state.gains[t.id];if(g)g.gain.setTargetAtTime(levels[t.id],context.currentTime,.02);}
    if(state.rendered){state.mixed=M.mix(state.rendered,levels);drawWave();}
  }
  async function generate(autoplay=true,sampleRate=44100) {
    if(state.busy)return;pause();
    if(autoplay){const ctx=getContext();await ctx.resume();}
    try {
      state.config=readControls();rebuild();state.busy=true;$('generate').disabled=true;$('play').disabled=true;$('export-wav').disabled=true;$('generation-progress').hidden=false;
      document.querySelectorAll('.control-rail input,.control-rail select,[data-compare],#import-config').forEach(el=>{el.disabled=true;});message('正在生成主题、和声与分层音色…');
      const key=JSON.stringify({...state.config,mix:undefined})+'@'+sampleRate;
      let rendered=state.cache.get(key);
      if(!rendered){rendered=await M.render(state.score,{sampleRate,onProgress:value=>{$('generation-progress').value=value;},yield:()=>new Promise(resolve=>setTimeout(resolve,0))});if(state.cache.size>=2)state.cache.delete(state.cache.keys().next().value);state.cache.set(key,rendered);}
      state.rendered=rendered;state.mixed=M.mix(rendered,effectiveMix());state.position=Math.min(state.position,state.config.duration);drawWave();$('play').disabled=false;$('export-wav').disabled=false;message('配乐已生成。可以独听分轨、切换 A/B，或导入视频一起试听。');
    }catch(e){state.rendered=null;state.mixed=null;message(e.message,true);}
    finally{state.busy=false;$('generate').disabled=false;$('generation-progress').hidden=true;document.querySelectorAll('.control-rail input,.control-rail select,[data-compare],#import-config').forEach(el=>{el.disabled=false;});}
    if(autoplay&&state.rendered)await play();
  }
  function download(content,name,type) { const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000); }
  function setupMixer() {
    for(const t of M.TRACKS){const channel=document.createElement('div');channel.className='channel';channel.innerHTML=`<div class="channel-head"><i style="background:${t.color}"></i><span>${t.label}</span></div><div class="meter"><i id="meter-${t.id}" style="background:${t.color}"></i></div><input id="gain-${t.id}" type="range" min="0" max="150" value="100" aria-label="${t.label}音量"><div class="channel-foot"><output id="gain-value-${t.id}">100%</output><div><button type="button" data-mute="${t.id}" aria-label="静音${t.label}" aria-pressed="false">M</button><button type="button" data-solo="${t.id}" aria-label="独听${t.label}" aria-pressed="false">S</button></div></div>`;$('mixer').append(channel);
      $('gain-'+t.id).oninput=e=>{state.config.mix[t.id]=Number(e.target.value)/100;$('gain-value-'+t.id).textContent=e.target.value+'%';updateMix();};
      for(const [attr,set] of [['mute',state.muted],['solo',state.solo]]){const b=channel.querySelector('[data-'+attr+']');b.onclick=()=>{if(set.has(t.id))set.delete(t.id);else set.add(t.id);b.setAttribute('aria-pressed',String(set.has(t.id)));updateMix();};}
    }
  }
  setupMixer();controlsFromConfig();rebuild();
  for(const id of ['bpm','duration','key','mode','motif','seed','energy','variation','space','soundEngine'])$(id).addEventListener(['energy','variation','space'].includes(id)?'input':'change',()=>{if(state.busy)return;try{state.config=readControls();for(const key of ['energy','variation','space'])$(key+'-value').textContent=$(key).value+'%';invalidate();}catch(e){message(e.message,true);}});
  $('preset').onchange=()=>{if(state.busy)return;state.config=M.config({...state.config,...M.PRESETS[$('preset').value],preset:$('preset').value});controlsFromConfig();invalidate();};
  document.querySelectorAll('[data-compare]').forEach(b=>{b.onclick=async()=>{if(state.busy||b.dataset.compare===state.config.motifMode)return;const had=!!state.rendered,pos=now();pause();state.config.motifMode=b.dataset.compare;state.rendered=null;state.mixed=null;rebuild();$('play').disabled=true;$('export-wav').disabled=true;if(had){await generate(false);state.position=Math.min(pos,state.config.duration);updatePosition();message('已切换编排。点击播放，在相同位置比较。');}};});
  $('generate').onclick=()=>generate(true);$('play').onclick=()=>state.playing?pause():play();$('restart').onclick=()=>seek(0);$('seek').oninput=e=>seek(Number(e.target.value));
  for(const id of ['piano-roll','waveform'])$(id).onclick=e=>{const rect=e.target.getBoundingClientRect(),left=id==='piano-roll'?34:0;seek((e.clientX-rect.left-left)/(rect.width-left)*state.config.duration);};
  $('export-wav').onclick=()=>{if(state.rendered){state.mixed=M.mix(state.rendered,effectiveMix());download(M.wav(state.mixed),'score.wav','audio/wav');}};
  $('save-config').onclick=()=>{try{const c=M.config({...readControls(),mix:effectiveMix()});download(JSON.stringify(c,null,2)+'\n','score.json','application/json');}catch(e){message(e.message,true);}};
  $('save-timeline').onclick=()=>download('window.MUSIC_TIMELINE = '+JSON.stringify(M.timeline(state.score),null,2)+';\n','score.timeline.js','text/javascript');
  $('save-midi').onclick=()=>download(M.midi(state.score),'score.mid','audio/midi');
  $('import-config').onchange=async e=>{const file=e.target.files[0];if(!file||state.busy)return;try{if(file.size>100000)throw Error('方案文件过大');const c=M.config(JSON.parse(await file.text()));state.config=c;state.muted.clear();state.solo.clear();document.querySelectorAll('[data-mute],[data-solo]').forEach(b=>b.setAttribute('aria-pressed','false'));controlsFromConfig();invalidate();message('已载入方案。点击生成以试听。');}catch(error){message(error.message,true);}finally{e.target.value='';}};
  $('import-video').onchange=e=>{const file=e.target.files[0];if(!file)return;pause();if(state.videoUrl)URL.revokeObjectURL(state.videoUrl);state.videoUrl=URL.createObjectURL(file);$('video').src=state.videoUrl;$('video').hidden=false;$('video-placeholder').hidden=true;message('视频已在本机打开。配乐播放时会与视频同步。');};
  $('video-sound').onchange=e=>{$('video').muted=!e.target.checked;};
  $('video').addEventListener('seeking',()=>{if(state.videoUrl&&Math.abs($('video').currentTime-now())>.2)seek($('video').currentTime);});
  $('video').addEventListener('pause',()=>{if(state.playing)pause();});
  $('video').addEventListener('play',()=>{if(state.rendered&&!state.playing){state.position=Math.min($('video').currentTime,state.config.duration);play();}});
  window.addEventListener('resize',draw);window.addEventListener('beforeunload',()=>{pause();if(state.videoUrl)URL.revokeObjectURL(state.videoUrl);context?.close();});
  window.musicWorkbench={state,generate,play,pause,seek,effectiveMix,applyConfig(input){pause();state.config=M.config(input);controlsFromConfig();invalidate();},downloadWav:()=>M.wav(M.mix(state.rendered,effectiveMix()))};
})();
