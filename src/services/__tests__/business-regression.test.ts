import { describe,it,expect } from 'vitest';
import { DEMO_SCENARIOS } from '../../data/scenarios';
import { projectLiquidity } from '../../domain/engine';
import { buildFinancialContextPack } from '../geminiAdvisor';
const delta={hasChanges:false,modifiedEntriesCount:0,addedEntriesCount:0,hasBalanceOverride:false,deficitSavedCents:0,lowestBalanceGainCents:0,shortfallEliminated:false};
describe('unchanged financial contracts from the original deployment',()=>{
  for(const scenario of DEMO_SCENARIOS) {
    it(scenario.id,()=>{
      const projection=projectLiquidity(scenario.snapshot,scenario.entries);
      expect({
        status:projection.alertStatus,
        metrics:projection.metrics,
        series:projection.dailySeries.map(day=>[day.date,day.closingConfirmedCents,day.closingProjectedCents,day.closingOptimisticCents,day.intradayMinCents]),
        eligibility:projection.evaluatedEntries.map(entry=>[entry.entry.id,entry.eligibility,entry.projectedDate]),
      }).toMatchSnapshot();
      const pack=buildFinancialContextPack(scenario,projection,delta);
      expect(pack.entries.map(entry=>entry.id)).toEqual(projection.evaluatedEntries.map(entry=>entry.entry.id));
    });
  }
});
