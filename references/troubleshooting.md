# 环境与故障定位

先读失败命令的标准错误、`check-report.json`、`render.json` 或 `verify-report.json`。没有输出 MP4 或报告失败时，先修正原因，不声称导出成功。

## 环境

需要 Node.js ≥22、Chrome 或 Edge、带 libx264/AAC 的 FFmpeg 与 ffprobe。脚本没有 npm 运行依赖；`npm install` 不会安装浏览器或 FFmpeg。

缺少 FFmpeg / ffprobe **由 agent 自行解决，不把安装任务转交给用户**。先检查环境变量、PATH、已有软件目录，复用可用版本。没有可用版本时：

1. 判断操作系统和 CPU 架构，访问 [FFmpeg 官方下载入口](https://ffmpeg.org/download.html) 选择它链接的构建来源。不要硬编码“最新版本号”或下载第三方一键安装脚本。
2. Windows 优先下载 [Gyan release essentials ZIP](https://www.gyan.dev/ffmpeg/builds/)，同时获取发布方对应的 SHA-256；校验一致后解压至当前项目 `.cache/ffmpeg/`，将 ffmpeg 和 ffprobe 放在其 `bin/`，或用 `HTML_VIDEO_FFMPEG_DIR` 指向解压后的 bin。这样无需管理员权限或修改系统 PATH。
3. macOS 可用已有 Homebrew 执行 `brew install ffmpeg`；Linux 可用当前可用的发行版包管理器，或官方入口链接的适配架构静态构建。由 agent 根据现有权限选择可行方式，不默认要求用户操作。
4. 执行 `ffmpeg -version`、`ffprobe -version` 和 `node tools/doctor.mjs`，确认 libx264 / AAC 与实际截图通过后继续。记录使用的版本、来源与本地路径；缓存不属于视频交付内容。

Windows 便携构建可从 `https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip` 下载，校验文件地址追加 `.sha256`。每次下载时重新获取校验值并检查 HTTP 成功状态，校验通过后再解压。解压与清理路径留在预定缓存目录内。

网络或权限被环境阻断时，先尝试允许的已有安装、便携构建或包管理器；仍不可行才报告具体阻断，HTML 创作可继续，不能声称 MP4 已导出。

工具先读取显式环境变量，再查 PATH、`.cache/ffmpeg/bin` 和常见浏览器安装位置；ffprobe 可在 ffmpeg 的同级目录找到。`HTML_VIDEO_FFMPEG_DIR` 可指定任意已准备好的 bin 目录。显式变量指向错误文件时立即报错，不用其他路径掩盖配置错误。

PowerShell 示例，请改成当前机器的实际路径：

```powershell
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:FFMPEG = 'C:\ffmpeg\bin\ffmpeg.exe'
$env:FFPROBE = 'C:\ffmpeg\bin\ffprobe.exe'
node tools/doctor.mjs
```

macOS/Linux 用 `export FFMPEG=/实际路径/ffmpeg` 等方式设置路径。在目标机器运行 doctor 和两秒试导出，确认依赖、截图与编码可用后再导出全片。doctor 只执行检查；由调用技能的 agent 准备缺失依赖。

## 症状表

| 症状 | 优先检查 |
| --- | --- |
| 浏览器提前退出、CDP 连接失败 | 浏览器路径、进程启动权限、环境对本地 WebSocket/临时配置目录的限制；doctor 会真实启动浏览器。受限代理环境中用其正规权限机制运行，勿给技能添加自动绕过权限的步骤 |
| HTML 首帧空白 | project.js 加载顺序、控制台异常、setup 是否建好 stage、render(0) 是否真的有内容 |
| 双击打不开，HTTP 才能用 | fetch 本地 JSON、ES module、绝对路径、CDN、字体跨源；改为本地普通脚本/内嵌数据，迁移好再跑 check |
| 文字换行或超出边界 | 当前机器字体与字号、画幅分支、Canvas measureText 或 DOM 包围盒；横竖屏分别修布局，不以整体拉伸解决 |
| 画面播放不动 | 播放逻辑是否错误依赖被挂起的 AudioContext；使用 runtime 的挂钟推进。首次生成音轨可能有短暂准备状态 |
| 跳回之前的时刻画面不同 | Math.random/Date.now、粒子累加、CSS 自动动画、未清理的绘图状态、视频素材 seek 未等完 |
| render 等待超时 | ready/render 是否遗留永不 resolve 的 Promise；是否在后台标签页等待 rAF；工具截图前会 bringToFront |
| 两秒试导出正常、全片失败 | 后段才出现的资源/脚本错误、磁盘不足、长音轨处理、后段非确定状态；先定位报错帧对应时间 |
| 高细节帧截图时连接关闭 | 检查截图体积与 CDP 传输；工具使用正常的无损 PNG 压缩。不要开启 optimizeForSpeed 来换取更大的截图；可减少过密的随机颗粒后重新抽查故障帧 |
| 音频丢失 | 项目是否声明 audio、相对文件是否存在、synthesize 是否返回完整 WAV；有声明时不会自动忽略错误 |
| 输出目录非空 | 使用新的 --out；不要把旧帧搬进新目录，也不要直接覆盖旧成片来测试 |
| 帧数或时长不符 | duration、fps 与 ceil 规则；不要额外画片尾同一时刻，不使用短音轨截断视频 |
| 样本误差大 | 截错区域、色彩/渲染模式、错误帧时间、过强压缩；先比较 samples 和 MP4 抽帧，再决定是否调整 crf |

## 中断与归档

1. 导出中断后保留输出目录，读取 `render.json` 中的 `status` 和 `error`，结合帧号定位对应分镜；检查源资源、脚本、音轨与环境。
2. 修正原因后，用新的 `--out` 重跑。导出命令不自动接续旧帧；不要将试导出或其他版本的帧混入新成片。
3. 确认正式成片通过验收后，可清理 `frames/`。保留 MP4、`render.json`、`verify-report.json` 与 `samples/`，以便再次复核。
4. 归档完整源项目，包括脚本、样式、字体、图片和音频。更改源项目后重新导出，生成与新成片对应的报告。

用 `movieSha256` 标识已验收的 MP4。`sourceHtmlSha256` 只覆盖入口 HTML；需要核对整个项目时，为全部源文件保存版本或另建文件哈希清单。
