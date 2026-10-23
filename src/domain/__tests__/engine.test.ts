import { describe, expect, it } from 'vitest';
import { projectLiquidity } from '../engine';
import { addDaysISO, daysBetweenISO, isValidISODate } from '../date';
import { addCents, formatBRL, parseBRLInputToCents, subtractCents } from '../money';
import { AccountSnapshot, FinancialEntry } from '../types';

const BASE_SNAPSHOT: AccountSnapshot = {
  accountLabel: 'Conta Corrente Principal',
  availableBalanceCents: 100_000, // R$ 1.000,00
  overdraftLimitCents: 150_000,   // R$ 1.500,00 (nunca somado ao saldo disponível)
  referenceDate: '2026-11-01',
  horizonDays: 30,
  hasCompleteData: true,
};

function makeEntry(overrides: Partial<FinancialEntry> & { id: string; title: string }): FinancialEntry {
  const dueDate = overrides.dueDate ?? '2026-11-10';
  return {
    id: overrides.id,
    title: overrides.title,
    category: overrides.category ?? 'Moradia',
    amountCents: overrides.amountCents ?? 50_000,
    dueDate,
    effectiveDate: overrides.effectiveDate ?? dueDate,
    type: overrides.type ?? 'outflow',
    certainty: overrides.certainty ?? 'confirmed',
    status: overrides.status ?? 'pending',
    origin: overrides.origin ?? 'dda',
    affectsMonitoredAccount: overrides.affectsMonitoredAccount ?? true,
    dedupeKey: overrides.dedupeKey,
    notes: overrides.notes,
  };
}

describe('Motor Financeiro Determinístico — Fôlego do Mês (18 Casos Críticos)', () => {
  it('T01: Precisão monetária em centavos sem erro de ponto flutuante (0.1 + 0.2)', () => {
    const a = 10; // R$ 0,10
    const b = 20; // R$ 0,20
    const c = 30; // R$ 0,30
    expect(subtractCents(addCents(a, b), c)).toBe(0);
    expect(parseBRLInputToCents('R$ 1.420,55')).toBe(142055);
    expect(formatBRL(142055)).toContain('1.420,55');

    const res = projectLiquidity(
      { ...BASE_SNAPSHOT, availableBalanceCents: 10 },
      [
        makeEntry({ id: 'in-1', title: 'Centavos', type: 'inflow', amountCents: 20, dueDate: '2026-11-02' }),
        makeEntry({ id: 'out-1', title: 'Tarifa', type: 'outflow', amountCents: 30, dueDate: '2026-11-03' }),
      ]
    );
    expect(res.metrics.lowestProjectedBalanceCents).toBe(0);
    expect(Number.isSafeInteger(res.metrics.lowestProjectedBalanceCents)).toBe(true);
  });

  it('T02: Imutabilidade de timezone e avanço de datas YYYY-MM-DD na virada de mês', () => {
    expect(isValidISODate('2026-10-31')).toBe(true);
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(addDaysISO('2026-10-28', 5)).toBe('2026-11-02');
    expect(daysBetweenISO('2026-10-28', '2026-11-02')).toBe(5);
  });

  it('T03: Isolamento estrito do cheque especial (nunca soma ao saldo disponível)', () => {
    const res = projectLiquidity(
      {
        ...BASE_SNAPSHOT,
        availableBalanceCents: 50_000, // R$ 500,00
        overdraftLimitCents: 200_000, // R$ 2.000,00 de cheque especial
      },
      [
        makeEntry({
          id: 'boleto-1',
          title: 'Aluguel',
          amountCents: 80_000, // R$ 800,00
          dueDate: '2026-11-10',
        }),
      ]
    );

    expect(res.alertStatus).toBe('PREVENTIVE_ALERT');
    expect(res.metrics.firstConfirmedShortfallDate).toBe('2026-11-10');
    expect(res.metrics.maxDeficitCents).toBe(-30_000); // -R$ 300,00
  });

  it('T04: Ignora compromissos quitados (paid_here, paid_other_bank), cancelados ou de outra conta', () => {
    const res = projectLiquidity(BASE_SNAPSHOT, [
      makeEntry({ id: 'e1', title: 'Pago aqui', amountCents: 90_000, status: 'paid_here' }),
      makeEntry({ id: 'e2', title: 'Pago outro banco', amountCents: 90_000, status: 'paid_other_bank' }),
      makeEntry({ id: 'e3', title: 'Cancelado', amountCents: 90_000, status: 'cancelled' }),
      makeEntry({ id: 'e4', title: 'Outro cartão', amountCents: 90_000, affectsMonitoredAccount: false }),
    ]);

    expect(res.alertStatus).toBe('NO_SHORTFALL_IDENTIFIED');
    expect(res.metrics.lowestProjectedBalanceCents).toBe(100_000);
    expect(res.metrics.totalConfirmedOutflowsCents).toBe(0);
  });

  it('T05: Deduplicação verdadeira (Boleto DDA + Lembrete Manual de mesmo valor em datas próximas)', () => {
    const res = projectLiquidity(BASE_SNAPSHOT, [
      makeEntry({
        id: 'dda-luz',
        title: 'Boleto Conta de Luz CPFL',
        amountCents: 25_000,
        dueDate: '2026-11-10',
        origin: 'dda',
      }),
      makeEntry({
        id: 'manual-luz',
        title: 'Luz CPFL Mensal',
        amountCents: 25_000,
        dueDate: '2026-11-11',
        origin: 'manual',
      }),
    ]);

    expect(res.metrics.deduplicatedCount).toBe(1);
    expect(res.metrics.deduplicatedSavedCents).toBe(25_000);
    expect(res.metrics.lowestProjectedBalanceCents).toBe(75_000); // Descontou apenas 1 vez!

    const manualEv = res.evaluatedEntries.find((e) => e.entry.id === 'manual-luz');
    expect(manualEv?.eligibility).toBe('deduplicated');
    expect(manualEv?.deduplicatedOfId).toBe('dda-luz');
  });

  it('T06: Anti-falso positivo de deduplicação (Dois Pix agendados ou dois DDAs na mesma data)', () => {
    const res = projectLiquidity(
      { ...BASE_SNAPSHOT, availableBalanceCents: 10_000 },
      [
        makeEntry({
          id: 'pix-1',
          title: 'Transferência Pix João',
          amountCents: 5_000,
          dueDate: '2026-11-10',
          origin: 'pix_agendado',
        }),
        makeEntry({
          id: 'pix-2',
          title: 'Transferência Pix João',
          amountCents: 5_000,
          dueDate: '2026-11-10',
          origin: 'pix_agendado',
        }),
      ]
    );

    expect(res.metrics.deduplicatedCount).toBe(0);
    expect(res.metrics.lowestProjectedBalanceCents).toBe(0);
  });

  it('T07: Anti-falso positivo de deduplicação (Lançamentos quinzenais com janela > 3 dias)', () => {
    const res = projectLiquidity(BASE_SNAPSHOT, [
      makeEntry({
        id: 'terapia-1',
        title: 'Sessão Terapia',
        amountCents: 20_000,
        dueDate: '2026-11-05',
        origin: 'dda',
      }),
      makeEntry({
        id: 'terapia-2',
        title: 'Sessão Terapia',
        amountCents: 20_000,
        dueDate: '2026-11-20',
        origin: 'manual',
      }),
    ]);

    expect(res.metrics.deduplicatedCount).toBe(0);
    expect(res.metrics.lowestProjectedBalanceCents).toBe(60_000);
  });

  it('T08: Risco Intradiário (Salário confirmado + Boleto confirmado no mesmo dia sem saldo matinal)', () => {
    const res = projectLiquidity(
      { ...BASE_SNAPSHOT, availableBalanceCents: 10_000 }, // R$ 100,00
      [
        makeEntry({
          id: 'boleto-cond',
          title: 'Condomínio',
          type: 'outflow',
          certainty: 'confirmed',
          amountCents: 50_000, // R$ 500,00
          dueDate: '2026-11-10',
        }),
        makeEntry({
          id: 'salario',
          title: 'Salário Mensal',
          type: 'inflow',
          certainty: 'confirmed',
          amountCents: 300_000, // R$ 3.000,00
          dueDate: '2026-11-10',
          origin: 'folha_pagamento',
        }),
      ]
    );

    const day10 = res.dailySeries.find((d) => d.date === '2026-11-10')!;
    expect(day10.closingConfirmedCents).toBe(260_000); // +R$ 2.600,00 no fechamento
    expect(day10.intradayMinCents).toBe(-40_000); // -R$ 400,00 se o débito ocorrer antes do crédito
    expect(day10.intradayTimingRisk).toBe(true);
    expect(res.alertStatus).toBe('CONDITIONAL_WARNING');
    expect(res.warningReasons).toContain('INTRADAY_TIMING_RISK');
  });

  it('T09: Recebimento incerto cobrindo conta confirmada (UNCERTAIN_INFLOW_DEPENDENCY)', () => {
    const res = projectLiquidity(
      { ...BASE_SNAPSHOT, availableBalanceCents: 10_000 }, // R$ 100,00
      [
        makeEntry({
          id: 'freela-incerto',
          title: 'Repasse Cliente Consultoria',
          type: 'inflow',
          certainty: 'uncertain',
          amountCents: 200_000, // R$ 2.000,00
          dueDate: '2026-11-08',
          origin: 'manual',
        }),
        makeEntry({
          id: 'aluguel-fixo',
          title: 'Aluguel Residencial',
          type: 'outflow',
          certainty: 'confirmed',
          amountCents: 150_000, // R$ 1.500,00
          dueDate: '2026-11-10',
        }),
      ]
    );

    expect(res.alertStatus).toBe('CONDITIONAL_WARNING');
    expect(res.warningReasons).toContain('UNCERTAIN_INFLOW_DEPENDENCY');
    expect(res.metrics.uncertainInflowsCoverDeficit).toBe(true);
    expect(res.metrics.firstConfirmedShortfallDate).toBe('2026-11-10');
  });

  it('T10: Risco causado apenas por despesas estimadas (ESTIMATED_OUTFLOW_RISK)', () => {
    const res = projectLiquidity(
      { ...BASE_SNAPSHOT, availableBalanceCents: 150_000 }, // R$ 1.500,00
      [
        makeEntry({
          id: 'aluguel',
          title: 'Aluguel',
          certainty: 'confirmed',
          amountCents: 120_000, // R$ 1.200,00 -> sobra R$ 300 confirmado
          dueDate: '2026-11-10',
        }),
        makeEntry({
          id: 'mercado',
          title: 'Supermercado Estimado',
          certainty: 'estimated',
          origin: 'recorrente_historico',
          amountCents: 50_000, // R$ 500,00 -> leva projetado para -R$ 200
          dueDate: '2026-11-15',
        }),
      ]
    );

    expect(res.metrics.firstConfirmedShortfallDate).toBeNull();
    expect(res.metrics.firstShortfallDate).toBe('2026-11-15');
    expect(res.alertStatus).toBe('CONDITIONAL_WARNING');
    expect(res.warningReasons).toContain('ESTIMATED_OUTFLOW_RISK');
  });

  it('T11: Déficit confirmado irreversível (PREVENTIVE_ALERT) mesmo com recebimento incerto', () => {
    const res = projectLiquidity(
      { ...BASE_SNAPSHOT, availableBalanceCents: 30_000 },
      [
        makeEntry({
          id: 'freela-pequeno',
          title: 'Reembolso Incerto',
          type: 'inflow',
          certainty: 'uncertain',
          amountCents: 20_000,
          dueDate: '2026-11-05',
        }),
        makeEntry({
          id: 'conta-alta',
          title: 'Financiamento',
          type: 'outflow',
          certainty: 'confirmed',
          amountCents: 100_000,
          dueDate: '2026-11-10',
        }),
      ]
    );

    expect(res.alertStatus).toBe('PREVENTIVE_ALERT');
    expect(res.warningReasons).toContain('CONFIRMED_SHORTFALL');
    expect(res.metrics.firstConfirmedShortfallDate).toBe('2026-11-10');
    expect(res.metrics.maxDeficitCents).toBe(-70_000);
  });

  it('T12: Compromisso vencido no passado (effectiveDate < referenceDate) sofre Overdue Clamping no dia 0', () => {
    const res = projectLiquidity(
      { ...BASE_SNAPSHOT, referenceDate: '2026-11-10', availableBalanceCents: 30_000 },
      [
        makeEntry({
          id: 'atrasado',
          title: 'Boleto Vencido Semana Passada',
          amountCents: 50_000,
          dueDate: '2026-11-05',
          effectiveDate: '2026-11-05',
          status: 'pending',
        }),
      ]
    );

    expect(res.alertStatus).toBe('PREVENTIVE_ALERT');
    expect(res.metrics.firstConfirmedShortfallDate).toBe('2026-11-10');
    expect(res.metrics.daysUntilConfirmedShortfall).toBe(0);
    expect(res.evaluatedEntries[0].isOverdue).toBe(true);
    expect(res.evaluatedEntries[0].projectedDate).toBe('2026-11-10');
  });

  it('T13: Simulação de adiamento de conta fixa após o vencimento dispara alerta de multa/juros', () => {
    const res = projectLiquidity(BASE_SNAPSHOT, [
      makeEntry({
        id: 'boleto-adiado',
        title: 'Energia Elétrica',
        certainty: 'confirmed',
        origin: 'dda',
        amountCents: 40_000,
        dueDate: '2026-11-10',
        effectiveDate: '2026-11-18', // Adiado em 8 dias
      }),
    ]);

    expect(res.evaluatedEntries[0].isPostponed).toBe(true);
    expect(res.evaluatedEntries[0].daysDelayed).toBe(8);
    expect(res.evaluatedEntries[0].triggersLatePenaltyWarning).toBe(true);
    expect(res.metrics.latePenaltyWarningCount).toBe(1);
  });

  it('T14: Simulação de adiamento de gasto estimado/variável NÃO dispara alerta de multa', () => {
    const res = projectLiquidity(BASE_SNAPSHOT, [
      makeEntry({
        id: 'mercado-adiado',
        title: 'Compra do Mês Supermercado',
        certainty: 'estimated',
        origin: 'recorrente_historico',
        amountCents: 60_000,
        dueDate: '2026-11-10',
        effectiveDate: '2026-11-20',
      }),
    ]);

    expect(res.evaluatedEntries[0].isPostponed).toBe(true);
    expect(res.evaluatedEntries[0].triggersLatePenaltyWarning).toBe(false);
    expect(res.metrics.latePenaltyWarningCount).toBe(0);
  });

  it('T15: Múltiplos vales de liquidez identificam 1ª insuficiência vs. maior déficit em datas distintas', () => {
    const res = projectLiquidity(
      { ...BASE_SNAPSHOT, availableBalanceCents: 50_000 }, // R$ 500
      [
        makeEntry({ id: 'out-1', title: 'Conta 1', amountCents: 60_000, dueDate: '2026-11-05' }), // Vai a -100 em 05/11
        makeEntry({
          id: 'in-1',
          title: 'Adiantamento',
          type: 'inflow',
          amountCents: 50_000,
          dueDate: '2026-11-10',
        }), // Sobe para +400 em 10/11
        makeEntry({ id: 'out-2', title: 'Conta 2 Pesada', amountCents: 85_000, dueDate: '2026-11-20' }), // Cai para -450 em 20/11
      ]
    );

    expect(res.metrics.firstShortfallDate).toBe('2026-11-05');
    expect(res.metrics.maxDeficitCents).toBe(-45_000);
    expect(res.metrics.lowestProjectedBalanceDate).toBe('2026-11-20');
  });

  it('T16: Saldo exatamente zero (R$ 0,00) não é classificado como déficit', () => {
    const res = projectLiquidity(
      { ...BASE_SNAPSHOT, availableBalanceCents: 80_000 },
      [makeEntry({ id: 'z1', title: 'Boleto Exato', amountCents: 80_000, dueDate: '2026-11-12' })]
    );

    expect(res.alertStatus).toBe('NO_SHORTFALL_IDENTIFIED');
    expect(res.metrics.firstShortfallDate).toBeNull();
    expect(res.metrics.lowestProjectedBalanceCents).toBe(0);
  });

  it('T17: Saldo inicial já negativo no referenceDate aponta déficit imediato (dia 0)', () => {
    const res = projectLiquidity(
      { ...BASE_SNAPSHOT, availableBalanceCents: -15_000 },
      []
    );

    expect(res.alertStatus).toBe('PREVENTIVE_ALERT');
    expect(res.metrics.firstConfirmedShortfallDate).toBe('2026-11-01');
    expect(res.metrics.daysUntilConfirmedShortfall).toBe(0);
  });

  it('T18: Guarda de Informações Insuficientes quando hasCompleteData === false ou saldo nulo', () => {
    const resIncomplete = projectLiquidity(
      { ...BASE_SNAPSHOT, hasCompleteData: false },
      [makeEntry({ id: 'x1', title: 'Luz', amountCents: 10_000 })]
    );
    expect(resIncomplete.alertStatus).toBe('INSUFFICIENT_DATA');

    const resNullBalance = projectLiquidity(
      { ...BASE_SNAPSHOT, availableBalanceCents: null },
      []
    );
    expect(resNullBalance.alertStatus).toBe('INSUFFICIENT_DATA');
  });
});
