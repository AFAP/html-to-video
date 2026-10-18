# 时间驱动的渲染接口

新建项目或接入已有 HTML 时，按以下接口实现资源就绪、时间定位和画面绘制。

## 项目与页面

```text
my-video/
  index.html       播放页面，普通 script 按依赖顺序加载
  project.js       内容、元数据、setup、render
  runtime.js       从技能模板复制，播放/定位/资源就绪
  player.css       播放外壳与 export 模式
  assets/          按需添加的本地图片、音轨、字体
```

可随文件夹移动。HTML 用相对 `src`/`href`，不用 `fetch('./data.json')`、ES module 或 CDN 作为双击播放的必要条件；这些可能受 `file://` 限制。数据可写入普通 JS 的全局对象，第三方库使用本地普通脚本构建；确需构建工具时先打包成浏览器可以直接加载的资源。

页面包含 `#stage` 和模板的播放器 DOM；项目脚本在 `runtime.js` 前执行。`?format=portrait` / `?format=landscape` 选择布局；无参数使用 `VIDEO_FORMAT` 或项目 `defaultFormat`，最终缺省横屏。`?export=1` 隐藏外壳并取消缩放。

## 作者接口

```js
window.VIDEO_PROJECT = {
  title: '作品标题',
  defaultFormat: 'landscape',
  formats: ['landscape'],                // 可选：声明本作品只实现的画幅
  fps: 30,
  duration: 12,                         // 秒，可不是整帧；运行时向上取整
  chapters: [{ at: 0, title: '开场' }, { at: 6, title: '过程' }],
  async setup({ stage, width, height, format }) {
    // 一次性建 DOM / Canvas、预计算粒子、等待本地图片和字体。
  },
  async render(t, { stage, width, height, format, fps, duration }) {
    // t 是绝对秒；返回时，这一帧所有资源和状态应准备完毕。
  },
  // audio 可省略，另见 audio.md
};
```

`formats` 可省略；省略时允许两种画幅入口。单次只需实现选定画幅，不要求双版本；指定后播放器隐藏未提供的入口。`chapters.at` 按递增秒数排列，范围 `[0,有效片长)`；运行时不因为章节或旁白自动延长片长。更改片长需在源项目中明确修改。

运行时暴露：

```js
await window.video.ready;            // 返回实际 meta，含 frames、duration
await window.video.render(4.2);      // 不启动播放
await window.video.seek(4.2);        // 暂停播放并定位，通常供人工操作
await window.video.play();
window.video.pause();
window.video.state;                  // time / playing / starting / busy / muted
window.video.meta;
```

## Canvas 例子

```js
let g;
window.VIDEO_PROJECT = {
  title: '移动圆点', fps: 30, duration: 8,
  setup({ stage, width, height }) {
    const c = document.createElement('canvas');
    c.width = width; c.height = height; stage.append(c);
    g = c.getContext('2d');
  },
  render(t, { width, height }) {
    g.resetTransform(); g.globalAlpha = 1;
    g.clearRect(0, 0, width, height);
    g.fillStyle = '#102044'; g.fillRect(0, 0, width, height);
    g.fillStyle = '#9bc1ff'; g.beginPath();
    g.arc(width * (0.2 + 0.6 * t / 8), height / 2, 60, 0, Math.PI * 2);
    g.fill();
  }
};
```

每次清理并完整设置状态；保存/恢复 `globalAlpha`、transform、混合模式，避免跨帧残留。随机点集只在 setup 用固定种子生成；运动位置直接由 `t` 计算。拖尾可重新采样过去的时间，不累积上一帧的像素。

## DOM / SVG / CSS 例子

```js
let card;
window.VIDEO_PROJECT = {
  title: '文字入场', fps: 30, duration: 6,
  setup({ stage }) {
    card = document.createElement('div');
    card.textContent = '从想法到画面';
    card.style.cssText = 'position:absolute;left:8%;top:38%;font:bold 80px sans-serif;color:white';
    stage.style.background = '#102044'; stage.append(card);
  },
  render(t) {
    const p = Math.min(1, Math.max(0, t / 0.8));
    card.style.opacity = String(p);
    card.style.transform = `translateY(${(1 - p) * 80}px)`;
  }
};
```

已有 Web Animations 可以保存 animation 对象，立即 `pause()`，每次 render 设置 `currentTime = t * 1000`。将 CSS transition 改为由 `t` 显式插值，避免 seek 后仍在过渡。将字形、SVG、滤镜和渐变放入 stage；工具截图整个 stage。

## 嵌入图片、字体和视频

- 图片在 setup 载入并 `await img.decode()`；Canvas 绘制前确认完成。
- 本地字体用相对 `@font-face`。若浏览器对 `file://` 字体加载有限制，改为内嵌 data URI 或可用系统字体，再重新检查。固定字体包有助于跨机一致，系统字体替代会改变排版。
- 视频素材不属于最小模板的内置能力。若添加，应暂停素材、按 t 设置 `currentTime`，等待 `seeked` 且视频帧准备完毕后返回；音频另行进入 master。只设置 currentTime 然后立即截图可能得到上一帧。
- GIF、持续 CSS 动画、WebGL 的非确定行为和无法暂停的第三方部件需先改造或烘焙成可定位素材。工具不会自动把任意网页变成确定性动画。

## 播放性能检查

按项目声明的尺寸和 fps，播放包含最多图层、粒子或滤镜的片段。检查实际播放节奏，结合绘制耗时与帧间隔定位卡顿；30fps 的单帧预算约 33.3ms，60fps 约 16.7ms。

- 把静态图形、路径与粒子种子移入 `setup()` 预计算，复用可缓存的图层；动态位置仍由 `t` 直接计算。
- 对高负载镜头减少逐帧重复构建、过密颗粒和大面积滤镜，保留关键主体和动作，再复测播放。
- 若 Canvas 在加速绘制时出现乱序定位像素差异，可在 `?export=1` 模式使用 `willReadFrequently: true` 获取稳定光栅结果，预览保留浏览器加速。两种模式共用同一个 `render`，调整后分别检查播放与定位。
- 检查切点前后、动作最大幅度、文字全部显示和结尾淡出等阶段；关键帧总览不能替代连续播放。

## 帧边界

`N = ceil(duration × fps)`，有效片长 `N/fps`。按 `0/fps…(N-1)/fps` 输出，避免多一帧。播放器拖到结尾时绘制最后一帧，点击播放从零开始。检查章节切点的前一帧、切点和后一帧，明确相同时间只归属一个镜头。

确定性检查是同一浏览器的抽样，不是形式证明。页面异步加载、字体更换和浏览器升级后都应重跑。MP4 压缩后有色度采样和量化误差，不能用“截图 PNG 哈希等于 MP4 解码帧”当验收方法。
