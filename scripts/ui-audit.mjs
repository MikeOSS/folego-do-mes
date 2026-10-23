import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const phase = process.env.AUDIT_PHASE || 'before';
const folder = `artifacts/ui/${phase}`;
await mkdir(folder, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
const consoleErrors = [];
const httpErrors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if(message.type()==='error') consoleErrors.push(message.text()); });
page.on('response', response => { if(response.status()>=400) httpErrors.push({url:response.url(),status:response.status()}); });
await page.goto(baseURL);
const scenarioIds = await page.evaluate(async () => {
  // IDs are read from the application UI instead of copying financial fixtures.
  return [];
});
// Stable IDs are also the public deep-link contract.
const { readFile } = await import('node:fs/promises');
const scenarioSource = await readFile('src/data/scenarios.ts', 'utf8');
scenarioIds.push(...[...scenarioSource.matchAll(/^    id: '([^']+)'/gm)].map(match => match[1]));
if (scenarioIds.length !== 7) throw new Error(`Expected seven scenarios, found ${scenarioIds.length}`);
const results = [];
for (const [width, height] of [[1440,900],[1280,800],[768,1024],[390,844],[320,640]]) {
  await page.setViewportSize({ width, height });
  for (const id of scenarioIds) {
    await page.goto(`${baseURL}/?cenario=${id}&demo=1&alerts=1`);
    await page.getByRole('main').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${folder}/${id}-${width}.png`, fullPage: true });
    const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, h1: document.querySelectorAll('h1').length, mains: document.querySelectorAll('main').length }));
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
    results.push({ id, viewport: {width,height}, layout, violations: axe.violations.map(v => ({id:v.id, impact:v.impact, count:v.nodes.length, examples:v.nodes.slice(0,3).map(n=>({target:n.target,summary:n.failureSummary}))})) });
  }
}
await page.goto(`${baseURL}/slides/index.html`);
await page.screenshot({ path: `${folder}/slides-320.png`, fullPage: true });
await writeFile(`${folder}/report.json`, JSON.stringify({ date:new Date().toISOString(), baseURL, errors, consoleErrors, httpErrors, results }, null, 2));
console.log(JSON.stringify({ folder, screenshots:results.length+1, overflow:results.filter(r=>r.layout.scrollWidth>r.layout.width).length, violations:[...new Set(results.flatMap(r=>r.violations.map(v=>v.id)))], errors },null,2));
await browser.close();

