import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIOS } from '../../data/scenarios';
import { projectLiquidity } from '../engine';

describe('Validação de Homologação dos 7 Cenários Demonstrativos (scenarios.ts)', () => {
  it('Todos os 7 cenários demonstrativos produzem exatamente o AlertStatus esperado pelo produto', () => {
    expect(DEMO_SCENARIOS).toHaveLength(7);

    for (const scenario of DEMO_SCENARIOS) {
      const result = projectLiquidity(scenario.snapshot, scenario.entries);
      expect(
        result.alertStatus,
        `Cenário "${scenario.id}" deveria produzir ${scenario.expectedAlert}, mas produziu ${result.alertStatus}`
      ).toBe(scenario.expectedAlert);
    }
  });

  it('Cenário 1 (Todos cobertos) detecta e deduplica automaticamente o lembrete manual duplicado do DDA', () => {
    const c1 = DEMO_SCENARIOS.find((s) => s.id === 'cobertos-tranquilo')!;
    const res = projectLiquidity(c1.snapshot, c1.entries);
    expect(res.metrics.deduplicatedCount).toBe(1);
    expect(res.metrics.deduplicatedSavedCents).toBe(68_000);
    expect(res.metrics.firstShortfallDate).toBeNull();
  });

  it('Cenário 2 (Insuficiência antes do próximo recebimento) identifica déficit em 14/nov de -R$ 340,00', () => {
    const c2 = DEMO_SCENARIOS.find((s) => s.id === 'insuficiencia-confirmada')!;
    const res = projectLiquidity(c2.snapshot, c2.entries);
    expect(res.alertStatus).toBe('PREVENTIVE_ALERT');
    expect(res.metrics.firstConfirmedShortfallDate).toBe('2026-11-14');
    expect(res.metrics.lowestConfirmedBalanceCents).toBe(-34_000);

    // Simular "Já paguei por outro banco" no Seguro Auto (c2-seguro) elimina o déficit confirmado!
    const simulatedEntries = c2.entries.map((e) =>
      e.id === 'c2-seguro' ? { ...e, status: 'paid_other_bank' as const } : e
    );
    const simRes = projectLiquidity(c2.snapshot, simulatedEntries);
    expect(simRes.metrics.firstConfirmedShortfallDate).toBeNull();
  });

  it('Cenário 6 (Movimentações no mesmo dia) identifica risco intradiário em 10/nov com fechamento positivo', () => {
    const c6 = DEMO_SCENARIOS.find((s) => s.id === 'mesmo-dia-intradiario')!;
    const res = projectLiquidity(c6.snapshot, c6.entries);
    expect(res.alertStatus).toBe('CONDITIONAL_WARNING');
    expect(res.warningReasons).toContain('INTRADAY_TIMING_RISK');
    expect(res.metrics.firstIntradayRiskDate).toBe('2026-11-10');
    expect(res.metrics.firstConfirmedShortfallDate).toBeNull();
  });
});
