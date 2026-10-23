import { test, expect } from '@playwright/test';

test('demo can collapse, survive scenario navigation, exit and resume without losing params',async({page})=>{
  await page.goto('/?cenario=insuficiencia-confirmada&demo=1&alerts=1');
  await page.getByRole('button',{name:'Recolher roteiro',exact:true}).click();
  await page.getByRole('button',{name:'Próximo cenário',exact:true}).click();
  await expect(page.getByRole('button',{name:'Expandir roteiro',exact:true})).toHaveAttribute('aria-expanded','false');
  await page.reload();
  await expect(page.getByRole('button',{name:'Expandir roteiro',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Sair da demonstração',exact:true}).click();
  await expect(page).not.toHaveURL(/demo=1/);
  await expect(page).toHaveURL(/alerts=1/);
  await page.getByRole('button',{name:'Iniciar demonstração guiada',exact:true}).click();
  await expect(page).toHaveURL(/demo=1/);
  await expect(page.getByRole('button',{name:'Expandir roteiro',exact:true})).toBeVisible();
});

test('browser back restores the scenario and current keyboard context',async({page})=>{
  await page.goto('/?cenario=insuficiencia-confirmada&demo=1&alerts=1');
  await page.getByRole('button',{name:'Próximo cenário',exact:true}).click();
  await expect(page).toHaveURL(/cenario=risco-estimados/);
  await page.goBack();
  await expect(page).toHaveURL(/cenario=insuficiencia-confirmada/);
  await expect(page.getByRole('button',{name:/^Escolher cenário:/})).toContainText('Roberto');
  await expect(page.getByRole('main')).toBeFocused();
});

test('reduced motion disables JS transforms while preserving controls',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await page.getByRole('button',{name:'Simular lançamento',exact:true}).click();
  const content=page.getByRole('dialog').locator(':scope > div');
  await expect(content).toHaveCSS('transform','none');
  await expect(content).toHaveCSS('opacity','1');
  await page.getByLabel('Descrição',{exact:true}).fill('Sem movimento');
  await page.getByRole('button',{name:'Adicionar à simulação',exact:true}).click();
  await expect(page.getByRole('button',{name:'Simular Sem movimento',exact:true})).toBeVisible();
});

test('back across a hash preserves simulations of the same scenario',async({page})=>{
  await page.goto('/?cenario=insuficiencia-confirmada&demo=1');
  await page.getByRole('link',{name:'Entenda o saldo e veja os dados.'}).click();
  await page.getByRole('button',{name:'Simular lançamento',exact:true}).click();
  await page.getByLabel('Descrição',{exact:true}).fill('Preservar no histórico');
  await page.getByRole('button',{name:'Adicionar à simulação'}).click();
  await page.goBack();
  await expect(page.getByRole('button',{name:'Simular Preservar no histórico',exact:true})).toBeVisible();
});

test('back to a different scenario closes the unfinished simulation',async({page})=>{
  await page.goto('/?cenario=insuficiencia-confirmada&demo=1');
  await page.getByRole('button',{name:'Próximo cenário',exact:true}).click();
  await page.getByRole('button',{name:'Simular lançamento',exact:true}).click();
  await page.getByLabel('Descrição',{exact:true}).fill('Rascunho do cenário anterior');
  await page.goBack();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button',{name:'Simular lançamento',exact:true}).click();
  await expect(page.getByLabel('Descrição',{exact:true})).toHaveValue('');
});
