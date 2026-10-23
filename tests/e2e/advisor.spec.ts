import { test, expect } from '@playwright/test';

test('live response is identified and the prompt survives; offline takes status precedence',async({page,context})=>{
  await page.route('**/api/gemini',route=>route.fulfill({json:{text:'Seu saldo foi analisado com os dados enviados.\nConfira as próximas contas.',model:'gemini-mock',functionCalls:[]}}));
  await page.goto('/');
  await page.getByLabel('Pergunte ao consultor').fill('Como fica meu saldo?');
  await page.getByRole('button',{name:'Analisar ou simular',exact:true}).click();
  await expect(page.getByRole('log')).toContainText('Seu saldo foi analisado');
  await expect(page.getByTestId('advisor-status')).toHaveText('Última resposta: Gemini');
  await expect(page.getByLabel('Pergunte ao consultor')).toHaveValue('Como fica meu saldo?');
  await context.setOffline(true);
  await expect(page.getByTestId('advisor-status')).toHaveText('Sem conexão');
});

test('failed remote call produces one explicit local explanation',async({page})=>{
  await page.route('**/api/gemini',route=>route.fulfill({status:503,json:{error:'Unavailable'}}));
  await page.goto('/');
  await page.getByRole('button',{name:'Diagnosticar fôlego e plano de ação',exact:true}).click();
  await expect(page.getByRole('log')).toContainText('não é uma resposta gerada por IA');
  await expect(page.getByTestId('advisor-status')).toHaveText('Resposta local · sem IA generativa');
});

test('request cannot apply tools to a different scenario or send twice',async({page})=>{
  let release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  let calls=0;
  await page.route('**/api/gemini',async route=>{calls++;await gate;await route.fulfill({json:{text:'Resposta antiga que não deve aparecer.',functionCalls:[{name:'add_simulated_entry',args:{title:'Lançamento antigo',amountReais:99,effectiveDate:'2026-11-10',type:'outflow',certainty:'estimated'}}]}}).catch(()=>{});});
  await page.goto('/?cenario=insuficiencia-confirmada');
  await page.getByLabel('Pergunte ao consultor').fill('Diagnostique meu saldo');
  await page.getByLabel('Pergunte ao consultor').press('Enter');
  await expect(page.getByTestId('advisor-status')).toHaveText('Consultando');
  await expect(page.getByRole('button',{name:'Analisando...',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Próximo cenário',exact:true}).click();
  release();
  await expect(page.getByTestId('advisor-status')).toHaveText('Aguardando consulta');
  await expect(page.getByRole('log')).toHaveCount(0);
  await expect(page.getByText('Lançamento antigo',{exact:true})).toHaveCount(0);
  expect(calls).toBe(1);
});

test('context changes while pending are recoverable without losing the question',async({page})=>{
  let release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  let first=true;
  await page.route('**/api/gemini',async route=>{if(first){first=false;await gate;}await route.fulfill({json:{text:'Análise atualizada e recuperada.',functionCalls:[]}});});
  await page.goto('/');
  await page.getByLabel('Pergunte ao consultor').fill('Analise minhas contas');
  await page.getByLabel('Pergunte ao consultor').press('Enter');
  await expect(page.getByTestId('advisor-status')).toHaveText('Consultando');
  await page.getByRole('button',{name:'Alterar saldo',exact:true}).click();
  await page.getByLabel('Saldo disponível para simular (R$)').fill('999,00');
  await page.getByRole('button',{name:'Aplicar',exact:true}).click();
  release();
  await expect(page.getByRole('alert')).toContainText('pergunta foi preservada');
  await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
  await expect(page.getByRole('log')).toContainText('Análise atualizada e recuperada');
  await expect(page.getByLabel('Pergunte ao consultor')).toHaveValue('Analise minhas contas');
});

test('invalid remote monetary tools cannot corrupt the financial store',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/gemini',route=>route.fulfill({json:{text:'Valor inválido que deve ser descartado.',functionCalls:[{name:'update_entry_amount',args:{entryId:'c2-aluguel',newAmountBRL:1e100}}]}}));
  await page.goto('/?cenario=insuficiencia-confirmada');
  await page.getByRole('button',{name:'Diagnosticar fôlego e plano de ação',exact:true}).click();
  await expect(page.getByTestId('advisor-status')).toHaveText('Resposta local · sem IA generativa');
  await expect(page.getByRole('main')).toBeVisible();
  expect(errors).toEqual([]);
});
