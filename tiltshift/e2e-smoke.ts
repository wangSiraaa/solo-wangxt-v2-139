import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const errors: string[] = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// 1. 基础渲染：3D canvas、SVG 路径、关键文字
const canvas = await page.locator('.three-host canvas').count();
const svgPaths = await page.locator('svg path').count();
console.log('canvas count:', canvas, 'svg paths:', svgPaths);
if (canvas !== 1) errors.push('three canvas missing');
if (svgPaths < 4) errors.push('2D section paths missing');

const readout = await page.locator('.readout .nums').innerText();
console.log('readout:', readout);

// 2. 默认参数下 Scheimpflug 分支信息
const infoText = await page.locator('.info').innerText();
console.log(infoText.slice(0, 400));
if (!infoText.includes('Scheimpflug')) errors.push('missing Scheimpflug branch label');
if (!infoText.includes('铰链')) errors.push('missing hinge point');

// 3. 零倾角 → 平行分支
await page.locator('input[type=range]').first().evaluate((el) => {
  const r = el as HTMLInputElement;
  r.value = '0';
  r.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(300);
const info2 = await page.locator('.info').innerText();
console.log('--- tilt 0 ---');
console.log(info2.slice(0, 260));
if (!info2.includes('普通平行焦面')) errors.push('parallel branch not shown at tilt 0');

// 4. 奇异角度：倾角拉到 8.5 之上不行（slider 上限 8.5）；直接通过 store 不易，改测近距不成像
//    对焦距离设为 51mm（f=50）在零倾角下 51>50.05 可成像；改为 f 滑块 200 + s 小？
//    简单方案：倾角回到 8、对焦 50.5（数值输入）
await page.locator('input[type=range]').first().evaluate((el) => {
  const r = el as HTMLInputElement;
  r.value = '8';
  r.dispatchEvent(new Event('input', { bubbles: true }));
});
const focusInput = page.locator('.numline.wide input[type=number]');
await focusInput.fill('50.5');
await focusInput.dispatchEvent('blur');
await page.waitForTimeout(300);
const blocked = await page.locator('.three-host .blocked').count();
const info3 = await page.locator('.info').innerText();
console.log('--- invalid regime, blocked overlay:', blocked, '---');
console.log(info3.slice(0, 200));
if (blocked !== 1) errors.push('blocked overlay missing for out-of-range regime');
if (!info3.includes('停止给出精确结果')) errors.push('info panel did not stop results');

// 5. 恢复有效参数并测 IndexedDB 保存/载入
await page.locator('input[type=range]').first().evaluate((el) => {
  const r = el as HTMLInputElement;
  r.value = '4';
  r.dispatchEvent(new Event('input', { bubbles: true }));
});
await focusInput.fill('1500');
await focusInput.dispatchEvent('blur');
await page.waitForTimeout(300);
await page.locator('details summary').click();
await page.waitForTimeout(100);
await page.locator('.save-row input').fill('冒烟场景');
await page.locator('.save-row button').click();
await page.waitForTimeout(400);
const saved = await page.locator('button.load strong').innerText();
console.log('saved scene name:', saved);
if (saved !== '冒烟场景') errors.push('IndexedDB save/load list failed');

// 6. 导出 JSON：拦截下载
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.locator('.export-row button', { hasText: 'JSON' }).click(),
]);
const path = await download.path();
const content = JSON.parse(await readFile(path!, 'utf8'));
console.log('export assumptions count:', content.assumptions?.length, 'branch:', content.result.branch);
if (!Array.isArray(content.assumptions) || content.assumptions.length < 5) errors.push('export missing assumptions');

// 7. reload 后 IndexedDB 场景仍在
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.locator('details summary').click();
await page.waitForTimeout(200);
const afterReload = await page.locator('button.load strong').count();
console.log('scenes after reload:', afterReload);
if (afterReload !== 1) errors.push('scene not persisted across reload');

console.log('\nERRORS:', errors.length ? errors : 'NONE');
await browser.close();
process.exit(errors.length ? 1 : 0);
