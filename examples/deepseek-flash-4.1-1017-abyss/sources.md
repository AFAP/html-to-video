# DeepSeek V4.1 FLASH 1017 · DEEPER / FASTER

横屏深海概念介绍片：**1920×1080 / 60fps / 60 秒 / 含原创配乐**。用官方 DeepSeek 鲸鱼标志作为贯穿全片的“深潜者”，从业务结果潜入技术结构。

## 一句话主题

**DIVE DEEPER. MOVE FASTER.**
业务上更快，是因为底层路径更短；更深的地方，才是速度的来源。

## 分镜

| 时间 | 章节 | 画面与内容 |
| --- | --- | --- |
| 0–4s | 开场 / ABYSS | 深海光柱、气泡、声呐；官方鲸鱼标志以全息徽记出现；“DEEPER. FASTER.”；42.3 / 77.0 / 890B / 1M |
| 4–10s | 从想法到项目 | 鲸鱼游过发光项目城市；一句想法 → 一个完整项目；构思、编码、验证随节拍依次落位 |
| 10–14s | 结果 / PROOF | 三项基准逐拍到位；Terminal-Bench 4.0、DeepSWE v1.1、ProgramBench；性能/成本帕累托示意 |
| 14–18s | 深潜入口 / DIVE | 全屏十二边舱门、透视加速与纵深粒子；鼓组抽离，鲸鱼游向消失点；“从业务，深入底层” |
| 18–22s | 稀疏权重 | 重拍进入权重场；552B 权重矩阵点亮少量专家；解码 16B、预填 8B；2.9% active；45T token、MIT |
| 22–28s | CED 非对称 | 40 层拆成 20 层编码器 + 20 层解码器；全局 KV 从 L20 投影；prefill 约半；后半段保留阅读时间 |
| 28–34s | KV 缓存 / SINGULARITY | 粒子场向双层倾斜吸积盘收束，30s 时核心与 890 数字落位；1/4 HBM、1/8 SSD、1/437 vs V1；1M × 890B ≈ 0.89 GB |
| 34–40s | CSA2 跨层 | Full / Reindex / Reuse 三种模式；跨层复用全局 KV 与 Top-K；固定大小共享候选池 |
| 40–44s | FP4 与分层 | 主 KV FP4 E2M1、SWA KV FP8；HBM / 主机 DRAM 池 / SSD 三级缓存；72 小时持久前缀缓存 |
| 44–48s | DSpark | 并行草稿、Markov 依赖、置信度预测、动态验证长度；验证扫线与接受/拒绝反馈 |
| 48–52s | 开放生态 | 音乐抽离鼓组；MIT 粒子聚合；Hugging Face / ModelScope；官网 / App / API；`deepseek-flash` |
| 52–60s | 收束 / FINALE | 主旋律回归，粒子汇聚为官方鲸鱼标志；轨道与品牌定版；552B / 890B / 1M / MIT；58s 后释放，最后 0.65s 淡出 |

## 官方鲸鱼标志

- 鲸鱼标志路径提取自 DeepSeek Harness 官方品牌组件 [`BrandWordmark.tsx`](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-primitives/src/BrandWordmark.tsx) 中的官方 whale mark，仓库以 MIT 许可开源。
- 本地文件：`whale-path.js`；绘制逻辑：`project.js` 的 `whale()`，使用 Canvas Path2D + evenodd 保留官方标志的负空间。
- 随附上游 MIT 许可原文：[deepseek-harness-LICENSE.txt](assets/deepseek-harness-LICENSE.txt)。
- DeepSeek 名称与鲸鱼标志属于 DeepSeek 的商标/品牌资产；本片是**独立介绍作品**，使用标志用于识别与评论，不代表 DeepSeek 官方出品或背书。

## 内容依据

核对日期：2026-10-18（北京时间）。这是独立介绍片，不是 DeepSeek 官方广告。

### 业务与官方发布

- [DeepSeek-V4.1-Flash-1017 发布说明，2026-10-17](https://api-docs.deepseek.com/news/news261017/)：官网、App、API 上线；官方称任务完成更快、输出更短，并称性能与成本为帕累托改进；展示游戏开发、三维建模等完整项目案例；官方基准表。
- [DeepSeek-V4.1-Flash 发布说明，2026-09-10](https://api-docs.deepseek.com/news/news260910/)：552B 参数 MoE、Causal Encoder–Decoder 非对称结构、输入 8B / 输出 16B 激活、原生多模态；相对上一代 KV 缓存仅需 1/4 HBM 与 1/8 SSD。
- [阿里云 Model Studio 模型页](https://www.alibabacloud.com/help/en/model-studio/deepseek-v4-1-flash)：1M 上下文、最大输出 384K、上下文缓存支持等部署参数。
- [Hugging Face 权重页](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017)：开放权重与 MIT 许可。
- [OpenRouter 模型页](https://openrouter.ai/deepseek/deepseek-v4.1-flash-1017)：1M 上下文、激活规模与发布日期的交叉核对。

### 技术报告与解读

- [DeepSeek-V4.1-Flash 技术报告 PDF](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/DeepSeek_V41_Tech_Report.pdf)：CED、CSA2、FP4 KV、跨层复用等架构细节；报告摘要给出全局 KV 缓存 **890 bytes/token**。
- [量子位：DeepSeek V4.1 全新架构解析](https://hub-assets-cache.baai.ac.cn/view/57879)：40 层、20 层编码器 + 20 层解码器；CSA2 的 Full / Reindex / Reuse；FP4 E2M1 主 KV、FP8 SWA、RoPE 后 QAT；SWA Bounded Replay；Engram 条件记忆；DSpark；45T token 预训练；KV Cache 相对 V1 缩至 1/437。
- [mem0：890 Bytes Per Token](https://mem0.ai/blog/deepseek-v4.1-flash-890-bytes-per-token-zero-bytes-of-persistent-memory)：对技术报告中持久 KV 缓存 72 小时生命周期的解读；属于部署层说明。
- [腾讯云开发者社区：CSA2 把 KV 缓存压到 890 字节/token](https://cloud.tencent.cn/developer/article/2742163)：对 890 B/token、1/4 上一代缓存与成本含义的独立拆解。

### 数字口径

- **42.3 / 77.0 / 29.1**：官方自测的 Terminal-Bench 4.0、DeepSWE v1.1、ProgramBench；上一版分别为 31.2 / 74.2 / 20.3。分数依赖 harness、评测设置与采样参数，本片不把分数差当作速度倍数。
- **890 B/token**：技术报告摘要中的全局 KV 缓存足迹；1M token × 890 B ≈ 0.89 GB，为十进制估算，不含 SWA 工作集与其他运行时开销。
- **1/4 HBM、1/8 SSD**：官方发布说明中的相对上一代缓存需求。
- **1/437 vs V1**：来自技术报告解读的代际对比，不是本片实测。
- **72H**：持久前缀缓存的部署层生命周期；不是“模型记住了 72 小时”。
- **4 ACCEPTED / 6 DRAFTED**：DSpark 段落的机制示意，不代表官方公布的接受率。
- 画面中的城市、权重矩阵、层堆、缓存包、候选池、草稿轨道、深海与鲸鱼徽记均为**概念可视化**，不是模型真实运行录像；不表示精确的专家数量或物理布局。

## 声音

`music.js` 为原创程序化配乐源文件（120 BPM，60 秒）；交付音轨 `assets/score.m4a`（48kHz 双声道 AAC）。无外部音乐素材、无人声。

- `timeline.js` 是画面与声音共用的章节、节拍与 cue 表；章节起点全部对齐 2 秒小节。
- 两小节拨弦旋律、四组延伸和弦、切分贝斯、交替底鼓与带轻微 swing 的 hi-hat。技术说明段降低声部密度；14–18s、48–52s 抽离鼓组；18/30/52s 前短暂吸气，重拍落点与镜头对齐；58s 后只留延音。
- 声呐、低频冲击、旋律提示与数据 tick 使用不同音色；立体声多抽头延迟提供空间。母带目标 −16 LUFS，编码前峰值限制在 −2 dBTP，为 AAC 编码预留余量；使用 FFmpeg 两遍响度处理。
- 重建音轨：在技能根目录执行 `node examples/deepseek-flash-4.1-1017-abyss/build-score.mjs`。FFmpeg 不在 PATH 时设置 `FFMPEG` 为其绝对路径。生成完成后自动替换本项目的 `assets/score.m4a`；HTML 预览与 MP4 导出使用同一文件。

## 实现说明

- 画面入口：`project.js` 的 `VIDEO_PROJECT.render(t)`；每一帧由绝对秒数独立计算。
- HTML 预览允许浏览器加速绘制；`?export=1` 使用 CPU 光栅以保证帧采样一致。两种模式共用同一绘制函数与时间轴。
- 鲸鱼标志：`whale-path.js` 提供官方路径，`project.js` 以 Path2D 绘制并叠加全息扫描、粒子、声呐与高光。
- 播放器：`runtime.js` 的挂钟推进；音频不阻塞画面启动。
- 导出：技能根目录执行 `node tools/export.mjs examples/deepseek-flash-4.1-1017-abyss --format landscape --out output/<新目录>`。
- 预览检查：`node tools/check.mjs examples/deepseek-flash-4.1-1017-abyss --format landscape --out output/<新目录>`。
