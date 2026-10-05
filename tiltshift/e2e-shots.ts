import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 1600 } });
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: '/tmp/shot-scheimpflug.png', fullPage: true });

// 细节视图
await page.locator('button', { hasText: '透镜/传感器细节' }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/shot-detail.png', fullPage: false });

// 零倾角平行分支 + 全尺度
await page.locator('button', { hasText: '物方全尺度' }).click();
await page.locator('input[type=range]').first().evaluate((el) => {
  const r = el as HTMLInputElement;
  r.value = '0';
  r.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/shot-parallel.png', fullPage: true });

// 超界
await page.locator('input[type=range]').first().evaluate((el) => {
  const r = el as HTMLInputElement;
  r.value = '12';
  r.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/shot-invalid.png', fullPage: false });

await browser.close();
console.log('shots done');
