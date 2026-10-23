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
