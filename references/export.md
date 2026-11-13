# 导出预估与中断续跑

仅在用户看过当前 HTML 并确认导出后使用。预估、试导出和正式导出都不替代 HTML 审片。

## 耗时与空间预估

```bash
node scripts/export.mjs path/to/my-video --format landscape --estimate --out output/my-film
```

抽取全片不同位置的帧，估算逐帧渲染时间和帧文件空间，显示目标磁盘可用空间。预估只在内存中截图，不创建输出目录、帧序列或 MP4。`--smoke --estimate` 只估算两秒，省略 `--smoke` 才是全片。

时间是抽样估算，只涵盖逐帧渲染；音轨处理、编码、验收和复杂镜头带来的变化另计。正式导出也会自动预估，在逐帧过程中更新剩余渲染时间；不要承诺为准确的总耗时。空间按抽样帧大小和余量估算，导出前检查可用空间。

## 续跑

首次导出使用新目录。若中断，保留全部文件，使用原项目、原参数和原输出目录，加 `--resume`：

```bash
node scripts/export.mjs path/to/my-video --format landscape --out output/my-film --resume
```

两秒试导出续跑时仍需传 `--smoke`，无声版仍需 `--silent`。`--crf`、`--preset` 等参数须与首次一致。

续跑核对全部项目文件的哈希、入口、画幅、帧率、片长、声音选项、浏览器版本与路径、Node、FFmpeg 版本和导出脚本指纹，并比对采样画面。输出目录及 `.git/.cache/node_modules/.test-output` 不计入源文件；项目内符号链接应先替换为实际文件。字体和素材尽量随项目提供。

- 同版本且哈希、尺寸正确的 PNG 帧直接复用；缺失、损坏或未写入检查点的帧重新渲染。
- 每 30 帧及异常退出时保存检查点。进程被强制终止时，最后一组未记录的帧可能需要重画。
- 源码、素材、参数或环境变化时拒绝复用，原报告保留。先重新检查和预览，再使用新输出目录。
- 编码和验收阶段中断时，可复用完整帧重新编码；不支持从半个 MP4 的字节位置继续。编码使用独立临时文件，已有影片会保留为 `video-previous-*.mp4`。
- 已完成的同版本成片只重新验收，不重复渲染或编码。导出锁阻止同一目录被多个进程同时写入；同机已结束进程的旧锁可自动回收。
- 旧版无完整指纹的导出目录不支持续跑，使用新目录。保留 `frames/` 才能恢复帧；最终交付后可按需清理。

`render.json` 的 `status` 可为 `preparing/rendering/encoding/verifying/interrupted/failed/complete`。`reusedFrames` 是本次复用帧数，`frameHashes` 是已记录帧校验值，`estimate` 保存当前估算。最终仍须 `status: complete`、`smoke: false` 和 `verify-report.json.ok: true`。
