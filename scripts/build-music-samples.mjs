// 从已下载的明确来源音色生成离线 PCM 数据；不执行上游 JS。
import fs from 'node:fs';
import path from 'node:path';
import { args, allowArgs, main, hash, writeJson } from './lib-cli.mjs';
import { binaries, run } from './lib-machine.mjs';
await main(()=>{
  const o=args();allowArgs(o,['out']);if(o._.length!==1||!o.out)throw Error('用法：node scripts/build-music-samples.mjs <采样缓存目录> --out <sample-bank.js>');
  const root=path.resolve(o._[0]), {ffmpeg}=binaries(), bank={version:1,sampleRate:22050,instruments:{piano:{},strings:{},bass:{}}}, sources=[];
  const names=['C','Cs','D','Ds','E','F','Fs','G','Gs','A','As','B'];
  function midi(name){const m=/^([A-G](?:s|b|#)?)(-?\d+)$/.exec(name);if(!m)throw Error(name);const pcs={C:0,Cs:1,'C#':1,Db:1,D:2,Ds:3,'D#':3,Eb:3,E:4,F:5,Fs:6,'F#':6,Gb:6,G:7,Gs:8,'G#':8,Ab:8,A:9,As:10,'A#':10,Bb:10,B:11};return(+m[2]+1)*12+pcs[m[1]];}
  function decode(file,instrument,note,maxDuration){
    const bytes=run(ffmpeg,['-v','error','-i',file,'-t',String(maxDuration),'-af','afade=t=out:st='+Math.max(0,maxDuration-.05)+':d=0.05','-ac','1','-ar','22050','-f','s16le','-'],{binary:true});
    bank.instruments[instrument][note]=bytes.toString('base64');sources.push({file:path.basename(file),instrument,midi:note,sha256:hash(fs.readFileSync(file)),pcmFrames:bytes.length/2});
  }
  for(const note of [36,48,51,54,57,60,63,66,69,72,75,78,81,84]){const name=names[note%12]+(Math.floor(note/12)-1);decode(path.join(root,name+'.mp3'),'piano',note,5.5);}
  for(const [file,instrument,select] of [['strings.js','strings',[48,55,60,67,72]],['bass.js','bass',[28,33,38,43,48]]]){
    const text=fs.readFileSync(path.join(root,file),'utf8'),match=/MIDI\.Soundfont\.[a-z_0-9]+\s*=\s*(\{[\s\S]*\})\s*;?\s*$/i.exec(text);
    if(!match)throw Error('无法解析音色数据：'+file);const samples=JSON.parse(match[1].replace(/,\s*}/g,'}'));
    for(const [name,uri] of Object.entries(samples)){
      const note=midi(name);if(!select.includes(note))continue;
      if(!/^data:audio\/[^;]+;base64,/.test(uri))throw Error('采样格式错误');const cache=path.join(root,`${instrument}-${note}.mp3`);fs.writeFileSync(cache,Buffer.from(uri.split(',')[1],'base64'));decode(cache,instrument,note,instrument==='strings'?3:3.5);
    }
    if(Object.keys(bank.instruments[instrument]).length!==select.length)throw Error('缺少采样：'+instrument);
  }
  fs.mkdirSync(path.dirname(path.resolve(o.out)),{recursive:true});fs.writeFileSync(o.out,'globalThis.MUSIC_SAMPLE_BANK = '+JSON.stringify(bank)+';\n');
  writeJson(o.out+'.sources.json',{version:1,processing:'Decoded to 22.05kHz mono 16-bit PCM, duration-limited and 50ms tail fade',sources});
  console.log(`已生成 ${sources.length} 个多音区采样，${fs.statSync(o.out).size} 字节。`);
});
