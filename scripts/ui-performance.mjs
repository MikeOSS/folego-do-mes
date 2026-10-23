import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { chromium } from '@playwright/test';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { mkdir, writeFile } from 'node:fs/promises';
const folder = `artifacts/ui/${process.env.AUDIT_PHASE || 'before'}`;
await mkdir(folder, {recursive:true});
const chrome = await launch({chromePath:chromium.executablePath(),chromeFlags:['--headless','--no-sandbox']});
try {
  for (const desktop of [false,true]) {
    const result = await lighthouse(process.env.BASE_URL || 'http://127.0.0.1:4173', {
      port:chrome.port, output:'html', onlyCategories:['performance','accessibility','best-practices','seo'],
      ...(desktop ? {formFactor:'desktop',screenEmulation:{mobile:false,width:1440,height:900,deviceScaleFactor:1,disabled:false}} : {}),
    },desktop ? desktopConfig : undefined);
    const name = desktop?'desktop':'mobile';
    await writeFile(`${folder}/lighthouse-${name}.html`,result.report);
    const summary = {categories:Object.fromEntries(Object.entries(result.lhr.categories).map(([key,value])=>[key,value.score])),metrics:Object.fromEntries(['first-contentful-paint','largest-contentful-paint','cumulative-layout-shift','total-blocking-time','speed-index'].map(key=>[key,result.lhr.audits[key].numericValue]))};
    await writeFile(`${folder}/lighthouse-${name}.json`,JSON.stringify(summary,null,2));
    console.log(name,JSON.stringify(summary));
  }
} finally {await chrome.kill();}
