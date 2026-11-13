# 音轨、配音与字幕

按用户选择制作配乐、旁白、字幕或无声版本。需要旁白时，先写并核对台词，再使用可用的配音工具生成音频文件；将最终文件放入项目，接入统一音轨。配音工具不可用时明确说明，先完成可继续制作的画面与字幕。

音轨可使用项目内 master 文件或程序化 WAV。

## 项目内 master 文件

```js
audio: { src: 'assets/master.wav' }
```

路径相对于 HTML 所在目录，必须位于项目文件夹内。浏览器用同一个文件预览，导出工具从磁盘读取，不能使用 HTTP URL、绝对路径或跳出项目的 `../`。

音轨应从全片 0 秒起算，包含旁白、BGM、音效、留白。使用下方混音工具准备 master，再接入这个字段。预览与导出使用同一 master；改声音后先重新预览，用户确认后再导出。

## 多素材混音

在项目根目录保存 `mix.json`，`src` 相对该配置文件所在目录，必须留在此目录内：

```json
{
  "duration": 30,
  "ducking": { "threshold": 0.025, "ratio": 8, "attack": 20, "release": 250 },
  "tracks": [
    { "src": "assets/voice.wav", "role": "narration", "start": 1, "volume": 1 },
    { "src": "assets/bgm.wav", "role": "music", "loop": true, "volume": 0.25, "fadeIn": 1, "fadeOut": 2 },
    { "src": "assets/hit.wav", "role": "sfx", "start": 8, "trim": 0.2, "duration": 0.5, "volume": 0.6 }
  ]
}
```

```bash
node scripts/mix-audio.mjs path/to/my-video/mix.json --out path/to/my-video/assets/master.wav
```

输出 48kHz 双声道 WAV，也支持 `.m4a`，同时生成 `.mix.json` 报告，记录素材哈希及实际处理参数。已有输出拒绝覆盖，修改后使用新音轨名并更新 `audio.src`，在 HTML 中试听。混音仅处理声音，不导出画面；准备预览音轨时可按需使用 FFmpeg/ffprobe。

`start` 是片中起点，`trim` 是源音频裁剪起点，`duration` 是使用长度，单位均为秒；省略长度时使用剩余素材并限制在全片内。短 BGM 可用 `loop: true` 循环。`volume` 为线性音量，`fadeIn/fadeOut` 在所选片段首尾生效。角色使用 `narration/music/sfx`；旁白按信号强度压低 music，sfx 不受影响。`ducking: false` 关闭避让，`attack/release` 单位为毫秒。总线限制峰值，但不替代试听或发布所需的响度处理。

滤镜行为依据 [FFmpeg 官方滤镜文档](https://ffmpeg.org/ffmpeg-filters.html#sidechaincompress)。工具不生成语音，也不自动判断台词与画面的语义对应关系。

## 程序化 WAV

```js
audio: {
  synthesize(duration) {
    // 返回完整 WAV 的 Uint8Array，或其 Promise；不是裸 PCM。
    return buildWav(duration);
  }
}
```

按绝对采样时间求值并固定随机源。运行时缓存同一 WAV，浏览器从 Blob 播放；导出保存为 `source-audio.wav`，转换成 48kHz 双声道 PCM master，再编码 AAC。计算量较大或需要母带处理时，先离线生成文件，再使用 `audio.src` 接入。

需要归一化或调整音色时，先处理 master，并将处理后的同一文件用于预览与导出。修改音乐生成脚本后，重新生成 `audio.src` 指向的文件；仅修改脚本不会更新已生成的音轨。

## 音画对齐

1. 把分镜、旁白、字幕、音乐与音效 cue 放在同一绝对秒时间轴上。有明确节拍时共用 BPM 与每小节拍数：`beat = 60 / BPM`，`bar = beat × 每小节拍数`。时间表可写在项目脚本中，或由本地普通脚本加载后供画面和音乐共同读取。
2. 把关键动作的落位时刻对齐重音：数字定格、粒子收束、验证通过、标题出现等。保留动作后的阅读停留，并按段落安排铺垫、留白、推进与收束；音乐密度、镜头变化和内容密度一起调整。
3. 生成旁白后测真实时长，检查每句结束时间是否跨过分镜；必要时延长镜头和全片，并更新项目声明。
4. 保证旁白清晰，BGM 与音效在旁白段适当降低；将音量变化写进 master。
5. 在编码前处理响度、峰值和首尾淡入淡出，为有损编码留出峰值余量。编码后重新测量并试听，检查爆音、突变、底噪与截断；按发布要求确定响度目标。
6. 合成前检查开头、留白、转场与结尾。导出会对短音轨补静音、对长音轨裁剪；先修正内容对齐，再进行导出。AAC 音轨与视频的流时长允许小于 100ms 的差异，听觉同步仍需检查。

## 字幕

新项目已在 `project.js` 前加载 `captions.js`。在 `VIDEO_PROJECT` 声明统一字幕轨，播放器会在 `render(t)` 后绘制到 stage，因此 HTML 预览和 MP4 使用同样的字幕：

```js
captions: {
  cues: [
    { start: 0.5, end: 3, text: '第一句字幕' },
    { start: 3, end: 6, text: '第二句字幕\n也可以显式换行' }
  ],
  style: { fontSize: 40, bottom: 0.07, maxWidth: 0.84,
    color: '#fff', background: 'rgba(0,0,0,.72)' }
}
```

也可直接写 `captions: [{start, end, text}]`。时间为绝对秒数，开始包含、结束不包含；允许多条重叠，按开始顺序分行显示。字幕不可超过有效片长。文字自动换行，`bottom/maxWidth` 是画面比例；其他样式为 `fontFamily/lineHeight/padding/radius`。不解析字幕中的 HTML 标签，避免把文本当作网页代码。

导入 SRT、导出 SRT/VTT：

```bash
node scripts/captions.mjs path/to/subtitles.srt --out path/to/my-video/subtitles.js
node scripts/captions.mjs path/to/cues.json --out path/to/subtitles.srt
node scripts/captions.mjs path/to/cues.json --out path/to/subtitles.vtt
```

转换工具接受 SRT 或 cues JSON，输出 `.js/.json/.srt/.vtt`，拒绝覆盖。导入的 JS 在 `project.js` 前以普通 script 加载，再写 `captions: window.VIDEO_CAPTIONS`，不需要 `fetch`。正式导出自动另存 `captions.srt` 和 `captions.vtt`；试导出会将旁挂字幕裁剪到试片长度。

已有项目复制并加载 `captions.js` 即可使用。自定义字幕仍可直接绘制到 stage，但不要同时打开重复的内置字幕。文字底边与手机界面遮挡区的安全距离按发布平台和内容确定，检查所选画幅。

无音轨项目会隐藏静音按钮；用户明确要无声版本可用 export 的 `--silent`。有 audio 声明却缺文件属于失败，不自动降级成无声成片。
