import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://localhost:5182/');
await page.waitForTimeout(600);

await page.getByLabel(/restrict enabledTimeZones/).click();
await page.waitForTimeout(300);

const button = page.getByRole('button', { name: /America\/Los_Angeles/ }).first();
const count = await page.locator('[role="button"]').count();
console.log('button count (restricted, hide-empty default):', count);

// Find aria-labels of all buttons to confirm LA's bucket offset
const labels = await page.locator('[role="button"]').evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
console.log('labels:', labels);

// click on LA's button and confirm payload
await button.click();
await page.waitForTimeout(200);
const selected = await page.evaluate(() => {
  const headers = Array.from(document.querySelectorAll('h3'));
  const h = headers.find((h) => h.textContent === 'Selected');
  return h ? h.nextElementSibling.textContent : null;
});
console.log('Selected (LA bucket):', selected);

await browser.close();
