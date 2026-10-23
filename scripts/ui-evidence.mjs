import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const folder=`artifacts/ui/${process.env.AUDIT_PHASE || 'wave1'}`;
await mkdir(folder,{recursive:true});
const browser=await chromium.launch();
try {
  const context=await browser.newContext({reducedMotion:'reduce'});
  const page=await context.newPage();
  for(const [width,height] of [[1440,900],[320,640]]) {
    await page.setViewportSize({width,height});
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:4173');
    await page.getByRole('main').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:`${folder}/home-${width}.png`,fullPage:true});
    await page.getByRole('button',{name:/^Escolher cenário:/}).click();
    await page.screenshot({path:`${folder}/scenarios-${width}.png`});
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Simular lançamento',exact:true}).click();
    await page.screenshot({path:`${folder}/simulator-${width}.png`});
    await page.keyboard.press('Escape');
  }
} finally {await browser.close();}
console.log(folder);
