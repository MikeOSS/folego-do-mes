import { describe, it, expect } from 'vitest';
import { buildFinancialContextPack } from '../geminiAdvisor';
import { DEMO_SCENARIOS } from '../../data/scenarios';
import { projectLiquidity } from '../../domain/engine';
import { formatBRL } from '../../domain/money';
const delta={hasChanges:false,modifiedEntriesCount:0,addedEntriesCount:0,hasBalanceOverride:false,deficitSavedCents:0,lowestBalanceGainCents:0,shortfallEliminated:false};
describe('financial context agrees with the visible projection',()=>{
  it('does not replace missing balance with zero',()=>{
    const scenario=DEMO_SCENARIOS[6];
    const pack=buildFinancialContextPack(scenario,projectLiquidity(scenario.snapshot,scenario.entries),delta);
    expect(pack.availableBalanceBRL).toBe('Dado indisponível');
    expect(pack.lowestProjectedBalanceBRL).toBe('Dado indisponível');
    expect(pack.simulationActive.minProjectedDeltaBRL).toContain('Comparação indisponível');
  });
  it('uses the effective balance after a simulation, including a real zero',()=>{
    for(const availableBalanceCents of [0,123456]) {
      const scenario=DEMO_SCENARIOS[1];
      const snapshot={...scenario.snapshot,availableBalanceCents};
      const pack=buildFinancialContextPack(scenario,projectLiquidity(snapshot,scenario.entries),delta,snapshot);
      expect(pack.availableBalanceBRL).toBe(formatBRL(availableBalanceCents));
    }
  });
});
