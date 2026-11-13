# 可组合的画面组件

新项目已在 `project.js` 前加载 `components.js`，提供全局 `VideoComponents`。已有项目先复制该文件并以普通 script 加载；不需要构建工具。可以与已有 DOM、SVG、Canvas 混用。

```js
let scene;
window.VIDEO_PROJECT = {
  title: '产品介绍', fps: 30, duration: 12,
  setup(ctx) {
    ctx.stage.style.background = '#101c38';
    scene = VideoComponents.create(ctx.stage, ctx);
    scene.title({ text: '从想法到成品', subtitle: '一个共用的时间轴', start: 0, end: 4,
      fontSize: 80, rect: { x: 0.08, y: 0.2, width: 0.84, height: 0.3 } });
    scene.counter({ from: 0, to: 98.6, decimals: 1, suffix: '%', label: '完成率', start: 4, end: 8 });
    scene.flow({ steps: ['内容', 'HTML', '视频'], start: 8, end: 12 });
  },
  render(t) { scene.render(t); }
};
```

所有组件用绝对时间计算，支持乱序定位。`start` 包含、`end` 不包含；`enter`/`exit` 是入退场秒数，默认 0.6/0.3。共同参数：

| 参数 | 含义 |
| --- | --- |
| `rect` | `x/y/width/height` 为画幅比例；按所选画幅排版 |
| `fontSize`, `color` | 字号（原始像素）与文字颜色 |
| `animation` | `slide`（默认）、`fade`、`zoom` 或 `none` |
| `enter`, `exit` | 动画时长；设 0 可立即出现或消失 |

组件接口：

| 方法 | 特有参数 |
| --- | --- |
| `scene.title()` | `text`, `subtitle` |
| `scene.counter()` | `from`, `to`, `decimals`, `prefix`, `suffix`, `label`, `animateDuration` |
| `scene.comparison()` | `items: [{label, value, color?}]`, `max`, `suffix`, `accent`, `animateDuration`；值须非负 |
| `scene.flow()` | `steps: ['步骤一', '步骤二']`, `direction: 'horizontal'/'vertical'`；默认竖屏纵向 |
| `scene.image()` | 本地 `src`, `zoomFrom`, `zoomTo`；必须指定有限 `end`，默认居中裁切 |
| `scene.lowerThird()` | `text`, `subtitle`, `background`, `accent`；用 rect 放到合适位置 |

在项目 `async setup(ctx)` 末尾执行 `await scene.ready()`，等待图片解码和组件字体就绪。所有画面更新都在 `render(t)` 内调用 `scene.render(t)`，不要给组件再加 CSS 自动动画。组件返回 DOM 节点，可继续定制外观；更改影响动画的样式时仍须保持绝对时间驱动。

组件保留稳定合成层，减少透明度和位移动画造成的文字抗锯齿切换。组件提供基础构图，不自动避免重叠；字幕、标题、图形与留白仍应按内容安排，并检查当前画幅。
