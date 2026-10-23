import { test, expect } from '@playwright/test';

for (const [width,height] of [[320,640],[375,667],[390,844],[768,1024],[1024,768],[1280,800],[1440,900]]) {
  test(`reflow at ${width}x${height} without global horizontal scrolling`, async ({ page }) => {
    await page.setViewportSize({width,height});
    await page.goto('/?cenario=mesmo-dia-intradiario');
    await page.getByRole('main').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const header=page.locator('header');
    expect((await header.boundingBox())!.width).toBeLessThanOrEqual(width);
    await page.getByRole('button',{name:'Simular lançamento',exact:true}).click();
    const dialog=page.getByRole('dialog');
    const box=(await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x+box.width).toBeLessThanOrEqual(width+1);
    await dialog.getByLabel('Descrição',{exact:true}).fill('Compromisso com nome longo para verificar leitura e ajuste');
    const apply=dialog.getByRole('button',{name:'Adicionar à simulação'});
    await apply.scrollIntoViewIfNeeded();
    const applyBox=(await apply.boundingBox())!;
    expect(applyBox.x).toBeGreaterThanOrEqual(0);
    expect(applyBox.x+applyBox.width).toBeLessThanOrEqual(width+1);
    expect(applyBox.y).toBeGreaterThanOrEqual(0);
    expect(applyBox.y+applyBox.height).toBeLessThanOrEqual(height+1);
  });
}

test('enlarged text at 200% retains the main financial controls',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/?cenario=insuficiencia-confirmada');
  await page.evaluate(()=>{document.documentElement.style.fontSize='32px';});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  await page.getByRole('button',{name:'Simular lançamento',exact:true}).click();
  const dialog=page.getByRole('dialog');
  const apply=dialog.getByRole('button',{name:'Adicionar à simulação'});
  await apply.scrollIntoViewIfNeeded();
  const box=(await apply.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x+box.width).toBeLessThanOrEqual(1440);
  await expect(apply).toBeVisible();
});
