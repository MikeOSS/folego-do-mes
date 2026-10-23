import { test, expect } from '@playwright/test';

test('select scenario announces selection and keeps unrelated query params', async ({ page }) => {
  await page.goto('/?cenario=insuficiencia-confirmada&demo=1&alerts=1');
  await page.getByRole('button', {name:/^Escolher cenário:/}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('button', {pressed:true})).toHaveCount(1);
  await dialog.getByRole('button', {name:/Informações insuficientes/i}).click();
  await expect(page).toHaveURL(/cenario=informacoes-insuficientes/);
  await expect(page).toHaveURL(/demo=1&alerts=1/);
  await expect(page.getByRole('heading',{level:1})).toBeVisible();
});

test('invalid money is explained; valid simulation can be added and reset', async ({ page }) => {
  await page.goto('/?cenario=insuficiencia-confirmada');
  await page.getByRole('button',{name:'Simular lançamento',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Descrição',{exact:true}).fill('Conta de teste');
  await dialog.getByLabel('Valor (R$)',{exact:true}).fill('250abc');
  await dialog.getByRole('button',{name:'Adicionar à simulação'}).click();
  await expect(dialog.getByRole('alert')).toContainText('valor maior que zero');
  await dialog.getByLabel('Valor (R$)',{exact:true}).fill('250,50');
  await dialog.getByLabel('Data na simulação').fill('2026-11-10');
  await dialog.getByRole('button',{name:'Adicionar à simulação'}).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button',{name:'Simular Conta de teste',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Restaurar original',exact:true}).first().click();
  await expect(page.getByRole('button',{name:'Simular Conta de teste',exact:true})).toHaveCount(0);
});

test('missing balance stays missing until a valid value is submitted; zero is valid', async ({ page }) => {
  await page.goto('/?cenario=informacoes-insuficientes');
  await page.getByRole('button',{name:'Informar saldo e simular projeção'}).click();
  const field=page.getByLabel('Informe o saldo disponível para simular (R$)');
  await field.fill('12oops');
  await page.getByRole('button',{name:'Calcular fôlego'}).click();
  await expect(page.getByRole('alert')).toContainText('saldo válido');
  await field.fill('90071992547409,90');
  await page.getByRole('button',{name:'Calcular fôlego'}).click();
  await expect(page.getByRole('alert')).toContainText('100 milhões');
  await field.fill('0,00');
  await page.getByRole('button',{name:'Calcular fôlego'}).click();
  await expect(page.getByRole('button',{name:'Alterar saldo'})).toBeVisible();
});
