import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch } from '../scripts/lib-chrome.mjs';
import { binaries, run } from '../scripts/lib-machine.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)), artifacts=path.join(root,'.test-output');fs.mkdirSync(artifacts,{recursive:true});const out=fs.mkdtempSync(path.join(artifacts,'music-browser-'));
test('配乐工作台真实生成、播放、分轨控制、方案导入与文件导出', {timeout:90000},async()=>{
  const browser=await launch();
  try{
    const p=await browser.newPage();await p.viewport(1440,1450);await p.goto(pathToFileURL(path.join(root,'workbench/index.html')).href);
    for(let i=0;i<50;i++){if(await p.eval('!!window.musicWorkbench'))break;await new Promise(r=>setTimeout(r,100));}
    assert.equal(await p.eval('document.querySelectorAll(".channel").length'),6);
    await p.eval('window.musicWorkbench.applyConfig({duration:12,preset:"cinema"})');await p.eval('window.musicWorkbench.generate(false,22050)');
    const result=await p.eval('({peak:musicWorkbench.state.mixed.peak,ready:!document.getElementById("export-wav").disabled,events:musicWorkbench.state.score.notes.length})');
    assert.ok(result.peak>.02&&result.ready&&result.events>20);
    const sampledWave=await p.eval('Array.from(musicWorkbench.state.rendered.stems.melody[0].slice(1000,1040))');
    await p.eval('document.getElementById("soundEngine").value="synthetic";document.getElementById("soundEngine").dispatchEvent(new Event("change"))');
    assert.equal(await p.eval('document.getElementById("play").disabled'),true);
    await p.eval('musicWorkbench.generate(false,22050)');
    assert.notDeepEqual(await p.eval('Array.from(musicWorkbench.state.rendered.stems.melody[0].slice(1000,1040))'),sampledWave);
    await p.eval('document.getElementById("soundEngine").value="sampled";document.getElementById("soundEngine").dispatchEvent(new Event("change"));');await p.eval('musicWorkbench.generate(false,22050)');
    fs.writeFileSync(path.join(out,'desktop.png'),await p.screenshot());
    await p.eval('document.querySelector("[data-solo=melody]").click()');
    assert.deepEqual(await p.eval('Object.values(musicWorkbench.effectiveMix()).filter(v=>v>0)'),[1]);
    await p.eval('document.querySelector("[data-solo=melody]").click();document.getElementById("gain-bass").value=25;document.getElementById("gain-bass").dispatchEvent(new Event("input"))');
    assert.equal(await p.eval('musicWorkbench.effectiveMix().bass'),.25);
    await p.eval('musicWorkbench.play()');await new Promise(r=>setTimeout(r,400));
    assert.equal(await p.eval('musicWorkbench.state.playing'),true);assert.ok(await p.eval('Number(document.getElementById("seek").value)>.1'));
    await p.eval('musicWorkbench.pause();musicWorkbench.seek(4)');assert.equal(await p.eval('musicWorkbench.state.position'),4);
    assert.equal(await p.eval('document.querySelector(".beat-dot.active").textContent'),'2');
    assert.match(await p.eval('document.getElementById("beat-position").textContent'),/第 2 小节/);
    await p.call('Page.setDownloadBehavior',{behavior:'allow',downloadPath:out});
    for(const [id,name] of [['export-wav','score.wav'],['save-config','score.json'],['save-timeline','score.timeline.js'],['save-midi','score.mid']]){
      await p.eval(id=>document.getElementById(id).click(),id);
      for(let i=0;i<60&&!fs.existsSync(path.join(out,name));i++)await new Promise(r=>setTimeout(r,50));
      assert.ok(fs.existsSync(path.join(out,name)),name+' 应完成下载');
    }
    const wav=fs.readFileSync(path.join(out,'score.wav'));assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt32LE(40),12*22050*4);assert.match(wav.toString('latin1'),/Salamander Grand Piano/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(out,'score.json'),'utf8')).mix.bass,.25);
    assert.match(fs.readFileSync(path.join(out,'score.timeline.js'),'utf8'),/MUSIC_TIMELINE/);
    assert.equal(fs.readFileSync(path.join(out,'score.mid')).toString('ascii',0,4),'MThd');
    await p.eval('document.querySelector("[data-compare=repeat]").click()');
    for(let i=0;i<100;i++){if(!await p.eval('musicWorkbench.state.busy'))break;await new Promise(r=>setTimeout(r,50));}
    assert.ok(await p.eval('musicWorkbench.state.score.phrases.every(p=>p.transform==="原形")'));
    await p.eval(()=>{const input=document.getElementById('import-config');const dt=new DataTransfer();dt.items.add(new File([JSON.stringify({duration:16,preset:'warm',seed:55})],'score.json',{type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change'));});
    for(let i=0;i<30;i++){if(await p.eval('musicWorkbench.state.config.seed===55'))break;await new Promise(r=>setTimeout(r,50));}
    assert.equal(await p.eval('document.getElementById("preset").value'),'warm');assert.equal(await p.eval('document.getElementById("play").disabled'),true);
    const video=path.join(out,'preview.mp4');run(binaries().ffmpeg,['-v','error','-f','lavfi','-i','color=c=0x182b40:s=160x90:r=24:d=2','-c:v','libx264','-pix_fmt','yuv420p',video]);
    await p.eval(base64=>{const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),input=document.getElementById('import-video'),dt=new DataTransfer();dt.items.add(new File([bytes],'preview.mp4',{type:'video/mp4'}));input.files=dt.files;input.dispatchEvent(new Event('change'));},fs.readFileSync(video).toString('base64'));
    for(let i=0;i<30;i++){if(await p.eval('document.getElementById("video").readyState>=1'))break;await new Promise(r=>setTimeout(r,50));}
    assert.equal(await p.eval('document.getElementById("video").hidden'),false);assert.equal(await p.eval('document.getElementById("video").duration'),2);
    await p.eval('musicWorkbench.generate(false,22050)');await p.eval('musicWorkbench.seek(.5);musicWorkbench.play()');await new Promise(r=>setTimeout(r,300));
    assert.ok(await p.eval('Math.abs(document.getElementById("video").currentTime-Number(document.getElementById("seek").value))<.25'));await p.eval('musicWorkbench.pause()');
    assert.deepEqual(p.errors,[]);
    for(const width of [390,720]){await p.viewport(width,1100);await p.eval('window.dispatchEvent(new Event("resize"))');assert.ok(await p.eval('document.documentElement.scrollWidth<=window.innerWidth'),`不应在 ${width}px 横向溢出`);const h=await p.eval('document.documentElement.scrollHeight');await p.viewport(width,h);await p.eval('window.dispatchEvent(new Event("resize"))');fs.writeFileSync(path.join(out,`mobile-${width}.png`),await p.screenshot());}
    console.log('工作台截图、WAV 和方案验证材料：'+out);
  }finally{await browser.close();}
});
