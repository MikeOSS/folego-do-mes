import { test, expect } from '@playwright/test';

test.use({reducedMotion:'reduce'});
test.skip(({isMobile})=>isMobile,'Baselines use one project and explicit viewport sizes.');
for(const [width,height] of [[320,640],[390,844],[768,1024],[1440,900]]) {
  test(`visual: overview ${width}`,async({page})=>{
    await page.setViewportSize({width,height});
    await page.goto('/?cenario=insuficiencia-confirmada&demo=1');
    await page.evaluate(()=>document.fonts.ready);
    await expect(page).toHaveScreenshot(`overview-${width}.png`,{animations:'disabled',maxDiffPixelRatio:0.005});
  });
}

for(const state of ['scenario-menu','simulator','loading','fallback','error']) {
  test(`visual: mobile ${state}`,async({page})=>{
    await page.setViewportSize({width:390,height:844});
    let release!:()=>void;
    const gate=new Promise<void>(resolve=>{release=resolve;});
    await page.route('**/api/gemini',async route=>{
      if(state==='loading'||state==='error')await gate;
      await route.fulfill(state==='fallback'?{status:503,json:{error:'Unavailable'}}:{json:{text:'Orientação de teste.',functionCalls:[]}}).catch(()=>{});
    });
    await page.goto('/?cenario=insuficiencia-confirmada&demo=1');
    await page.evaluate(()=>document.fonts.ready);
    if(state==='scenario-menu')await page.getByRole('button',{name:/^Escolher cenário:/}).click();
    else if(state==='simulator')await page.getByRole('button',{name:'Simular lançamento',exact:true}).click();
    else {
      await page.getByLabel('Pergunte ao consultor').fill('Analise minhas contas');
      await page.getByLabel('Pergunte ao consultor').press('Enter');
      if(state==='fallback')await expect(page.getByRole('log')).toBeVisible();
      else await expect(page.getByTestId('advisor-status')).toHaveText('Consultando');
      if(state==='error'){
        await page.getByRole('button',{name:'Alterar saldo',exact:true}).click();
        await page.getByLabel('Saldo disponível para simular (R$)').fill('999,00');
        await page.getByRole('button',{name:'Aplicar',exact:true}).click();
        release();
        await expect(page.getByRole('alert')).toBeVisible();
      }
    }
    const target=state==='scenario-menu'||state==='simulator'?page.getByRole('dialog'):page.locator('#consultor');
    await expect(target).toHaveScreenshot(`${state}-390.png`,{animations:'disabled',maxDiffPixelRatio:0.005});
    release();
  });
}
