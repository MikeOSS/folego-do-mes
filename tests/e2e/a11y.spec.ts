import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ reducedMotion:'reduce' });
test('a11y: overview and both dialogs meet automated AA checks', async ({page})=>{
  await page.goto('/?cenario=recebimento-incerto');
  await page.evaluate(()=>document.fonts.ready);
  const check=async()=>{
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
    expect(result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))).toEqual([]);
  };
  await check();
  await page.getByRole('button',{name:/^Escolher cenário:/}).click();
  await check();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Simular lançamento',exact:true}).click();
  await expect(page.getByRole('dialog').locator(':scope > div')).toHaveCSS('opacity','1');
  await check();
});

test('a11y: fallback, context inspector and API key controls',async({page})=>{
  await page.route('**/api/gemini',route=>route.fulfill({status:503,json:{error:'Unavailable'}}));
  await page.goto('/');
  await page.getByRole('button',{name:'Diagnosticar fôlego e plano de ação',exact:true}).click();
  await expect(page.getByRole('log')).toBeVisible();
  await page.getByRole('button',{name:'Context Pack',exact:true}).click();
  await page.getByRole('button',{name:'Chave Gemini',exact:true}).click();
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});
