import { main } from './lib-cli.mjs';
import { doctor } from './lib-machine.mjs';
import { launch } from './lib-chrome.mjs';
await main(async () => {
  const result = doctor();
  for (const c of result.checks) console.log(`${c.ok ? '✓' : '✗'} ${c.name}: ${c.detail}`);
  if (!result.ok) throw Error('环境未就绪；HTML 仍可直接打开，MP4 导出需要补齐以上工具');
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.viewport(320, 180);
    await page.eval('document.body.style.background = "#123456"');
    const png = await page.screenshot();
    if (png.readUInt32BE(16) !== 320 || png.readUInt32BE(20) !== 180) throw Error('截图尺寸不符');
    console.log('✓ 实际启动浏览器、CDP 通信和 PNG 截图通过');
  } finally { await browser.close(); }
});
