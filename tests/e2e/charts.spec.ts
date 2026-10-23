import { test, expect } from '@playwright/test';
import { DEMO_SCENARIOS } from '../../src/data/scenarios';
import { projectLiquidity } from '../../src/domain/engine';
import { formatBRL } from '../../src/domain/money';

test('chart data is available with keyboard and matches the deterministic engine',async({page})=>{
  const scenario=DEMO_SCENARIOS[1];
  const expected=projectLiquidity(scenario.snapshot,scenario.entries);
  await page.goto(`/?cenario=${scenario.id}`);
  const control=page.getByLabel('Inspecionar uma data');
  await control.selectOption('2026-11-10');
  await expect(control).toHaveValue('2026-11-10');
  const summary=page.getByText('Ver dados da projeção em tabela',{exact:true});
  await summary.focus();
  await page.keyboard.press('Enter');
  const table=page.getByRole('table');
  await expect(table).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(expected.dailySeries.length);
  const row=table.locator('tbody tr').first();
  await expect(row).toContainText(formatBRL(expected.dailySeries[0].closingProjectedCents));
  await expect(table.getByRole('columnheader')).toHaveCount(4);
});

test('missing data has no invented chart or balance baseline',async({page})=>{
  await page.goto('/?cenario=informacoes-insuficientes');
  await expect(page.getByRole('heading',{name:'Projeção aguardando confirmação de saldo'})).toBeVisible();
  await expect(page.getByLabel('Inspecionar uma data')).toHaveCount(0);
  await page.getByRole('button',{name:'Informar saldo e simular projeção'}).click();
  await page.getByLabel('Informe o saldo disponível para simular (R$)').fill('100,00');
  await page.getByRole('button',{name:'Calcular fôlego'}).click();
  await expect(page.getByTestId('baseline-curve')).toHaveCount(0);
  await expect(page.getByText('A base original não tinha dados suficientes para comparação.',{exact:false})).toBeVisible();
  await page.getByText('Ver dados da projeção em tabela',{exact:true}).click();
  await expect(page.getByRole('table').getByRole('cell',{name:'Dado indisponível'}).first()).toBeVisible();
});
