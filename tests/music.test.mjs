import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import '../workbench/sample-bank.js';
import '../workbench/music-engine.js';
import { inside } from '../scripts/lib-cli.mjs';
const M=globalThis.MusicScore;
test('乐谱可复现，结尾回到主和弦，所有音符处于片长内',()=>{
  const a=M.plan({duration:16});assert.deepEqual(M.plan({duration:16}),a);assert.notDeepEqual(M.plan({duration:16,seed:4}).notes,a.notes);
  assert.equal(a.chords.at(-1).degree,0);assert.ok(a.sections.length>=3);
  assert.ok(a.notes.every(n=>n.at>=0&&n.at<a.duration&&n.at+n.length<=a.duration+1e-6));
  assert.throws(()=>M.plan({duration:Infinity}));assert.throws(()=>M.plan({motifDegrees:[0,1,NaN]}));assert.throws(()=>M.plan({preset:'unknown'}));
  const repeated=M.plan({duration:32,motifMode:'repeat'});assert.ok(repeated.phrases.every(p=>p.transform==='原形'));
  const developed=M.plan({duration:32});assert.notDeepEqual(repeated.notes,developed.notes);
  const middle=developed.sections.find(s=>s.title==='展开');
  const countMelody=score=>score.notes.filter(n=>n.track==='melody'&&n.at>=middle.start&&n.at<middle.end).length;
  assert.ok(countMelody(developed)<countMelody(repeated),'发展编排的中段应为主题留白');
  assert.deepEqual(M.plan({duration:32,variation:0}).notes,M.plan({duration:32,variation:0,motifMode:'repeat'}).notes);
  const midi=Buffer.from(M.midi(a));assert.equal(midi.toString('ascii',0,4),'MThd');assert.equal(midi.readUInt16BE(10),6);assert.equal(midi.readUInt16BE(12),480);assert.equal((midi.toString('latin1').match(/MTrk/g)||[]).length,6);
  for(let key=0;key<12;key++){const score=M.plan({key,mode:'minor',motifDegrees:[14,-7,12,0]}),pitchClasses=[0,2,3,5,7,8,10].map(n=>(n+key)%12);assert.ok(score.notes.filter(n=>n.track==='melody').every(n=>pitchClasses.includes(n.midi%12)),'转入演奏音区时仍应保持调式');}
});
test('和弦连接选择相邻声部，并保留各和弦音',()=>{
  const voicing=M.nearestVoicing([0,4,7,11],[55,60,64,71]);assert.deepEqual(voicing.map(n=>n%12).sort((a,b)=>a-b),[0,4,7,11]);
  assert.ok(voicing.reduce((s,n,i)=>s+Math.abs(n-[55,60,64,71][i]),0)<15);
});
test('实时输出的限幅曲线与离线混音在有效范围内一致',()=>{
  const curve=M.masterCurve();
  for(let x=-3.5;x<=3.5;x+=.037){const position=(x/M.MASTER_RANGE+1)/2*(curve.length-1),i=Math.floor(position),fraction=position-i,live=curve[i]*(1-fraction)+curve[i+1]*fraction;assert.ok(Math.abs(live-Math.tanh(x*1.5)*.92)<1e-5);}
});
test('合成与混音确实产生可重现音频，静音归零，分轨可独听',async()=>{
  const score=M.plan({duration:8,preset:'warm'}), a=await M.render(score,{sampleRate:22050}), b=await M.render(score,{sampleRate:22050});
  const mix=M.mix(a);assert.ok(mix.peak>.02&&mix.peak<.93);assert.ok(mix.rms>.005);
  assert.deepEqual(M.wav(mix),M.wav(M.mix(b)));
  const silent=M.mix(a,Object.fromEntries(M.TRACKS.map(t=>[t.id,0])));assert.equal(silent.peak,0);
  const solo=M.mix(a,Object.fromEntries(M.TRACKS.map(t=>[t.id,t.id==='melody'?1:0])));assert.ok(solo.rms>0);assert.notDeepEqual(M.wav(solo),M.wav(mix));
  const wav=M.wav(mix), v=new DataView(wav.buffer);assert.equal(v.getUint32(24,true),22050);assert.equal(v.getUint32(40,true),8*22050*4);
  assert.ok(Math.abs(mix.channels[0].at(-1))<1e-6);assert.ok(a.stems.melody[0].some(v=>v!==0));
  assert.match(Buffer.from(wav).toString('latin1'),/CC BY 3.0/);
  const synthetic=await M.render(M.plan({...score.config,soundEngine:'synthetic'}),{sampleRate:22050});assert.notDeepEqual(M.wav(M.mix(synthetic)),wav);
});
test('独立工作台可复制、保留方案，命令行生成音轨和视频时间轴',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'h2v-music-'));
  try{
    const dir=path.join(temp,'配乐 工作台');
    const call=(...args)=>spawnSync(process.execPath,['scripts/music.mjs',...args],{encoding:'utf8',windowsHide:true});
    let r=call('init',dir,'--preset','pulse','--duration','8');assert.equal(r.status,0,r.stderr);
    for(const file of ['index.html','style.css','app.js','music-engine.js','score-config.js','sample-bank.js','SAMPLES-LICENSE.txt','sample-bank.js.sources.json'])assert.ok(fs.existsSync(path.join(dir,file)));
    assert.notEqual(call('init',dir).status,0);
    const config=path.join(temp,'input.json'),out=path.join(temp,'score.wav');fs.writeFileSync(config,JSON.stringify({duration:8,preset:'warm'}));
    r=call('render',config,'--out',out);assert.equal(r.status,0,r.stderr);assert.ok(fs.statSync(out).size>100000);assert.ok(fs.existsSync(path.join(temp,'score.timeline.js')));assert.match(fs.readFileSync(path.join(temp,'score.credits.txt'),'utf8'),/Alexander Holm/);
    assert.notEqual(call('render',config,'--out',out).status,0);
  }finally{assert.ok(inside(os.tmpdir(),temp)&&path.basename(temp).startsWith('h2v-music-'));fs.rmSync(temp,{recursive:true,force:true});}
});
