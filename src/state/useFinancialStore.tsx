import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEMO_SCENARIOS, DemoScenario } from '../data/scenarios';
import { projectLiquidity } from '../domain/engine';
import {
  AccountSnapshot,
  Cents,
  FinancialEntry,
  ISODateString,
  ProjectionResult,
} from '../domain/types';

export type EntryOverride = Partial<
  Pick<
    FinancialEntry,
    | 'amountCents'
    | 'effectiveDate'
    | 'certainty'
    | 'status'
    | 'affectsMonitoredAccount'
    | 'origin'
    | 'title'
    | 'dedupeKey'
  >
>;

export interface SimulationDelta {
  hasChanges: boolean;
  modifiedEntriesCount: number;
  addedEntriesCount: number;
  hasBalanceOverride: boolean;
  /** Diferença no maior déficit (positivo = déficit reduzido/evitado) */
  deficitSavedCents: Cents;
  /** Diferença no menor saldo projetado (positivo = fôlego extra ganho) */
  lowestBalanceGainCents: Cents;
  /** Verdadeiro se antes havia déficit e agora não há mais */
  shortfallEliminated: boolean;
}

interface FinancialStoreContextValue {
  scenarios: readonly DemoScenario[];
  activeScenario: DemoScenario;
  selectScenario: (scenarioId: string) => void;
  stepScenario: (direction: 'prev' | 'next') => void;

  /** Projeção do cenário original sem nenhuma simulação */
  baselineProjection: ProjectionResult;
  /** Projeção ativa (com overrides de simulação aplicados) */
  activeProjection: ProjectionResult;
  /** Snapshot efetivo (com eventual override de saldo) */
  effectiveSnapshot: AccountSnapshot;
  /** Comparativo instantâneo entre o cenário original e a simulação */
  simulationDelta: SimulationDelta;

  /** Mapa de alterações por ID de lançamento */
  entryOverrides: Record<string, EntryOverride>;
  addedEntries: FinancialEntry[];
  updateEntryOverride: (entryId: string, patch: EntryOverride) => void;
  resetEntryOverride: (entryId: string) => void;
  addSimulatedEntry: (entry: Omit<FinancialEntry, 'id'>) => void;
  removeSimulatedEntry: (entryId: string) => void;
  setBalanceOverride: (balanceCents: Cents | null, unlockCompleteData?: boolean) => void;
  resetAllSimulations: () => void;

  /** Dia atualmente inspecionado na Curva de Fôlego / Linha do Tempo */
  selectedDate: ISODateString | null;
  setSelectedDate: (date: ISODateString | null) => void;

  /** Compromisso atualmente aberto no Bottom Sheet / Drawer de Simulação */
  editingEntryId: string | null;
  setEditingEntryId: (entryId: string | null) => void;
}

const FinancialStoreContext = createContext<FinancialStoreContextValue | null>(null);

function getInitialScenarioId(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('cenario');
    if (fromUrl && DEMO_SCENARIOS.some((s) => s.id === fromUrl)) {
      return fromUrl;
    }
  }
  // Inicia no Cenário 2 (Insuficiência antes do próximo recebimento) por ser o caso mais rico e impactante
  return DEMO_SCENARIOS[1].id;
}

export const FinancialStoreProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activeScenarioId, setActiveScenarioId] = useState<string>(getInitialScenarioId);
  const scenarioIdRef = useRef(activeScenarioId);
  scenarioIdRef.current = activeScenarioId;
  const [entryOverrides, setEntryOverrides] = useState<Record<string, EntryOverride>>({});
  const [addedEntries, setAddedEntries] = useState<FinancialEntry[]>([]);
  const [balanceOverrideCents, setBalanceOverrideCents] = useState<Cents | null>(null);
  const [unlockedCompleteData, setUnlockedCompleteData] = useState<boolean>(false);

  const [selectedDate, setSelectedDate] = useState<ISODateString | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const activeScenario = useMemo(() => {
    return (
      DEMO_SCENARIOS.find((s) => s.id === activeScenarioId) ?? DEMO_SCENARIOS[1]
    );
  }, [activeScenarioId]);

  const resetAllSimulations = useCallback(() => {
    setEntryOverrides({});
    setAddedEntries([]);
    setBalanceOverrideCents(null);
    setUnlockedCompleteData(false);
  }, []);

  const selectScenario = useCallback((scenarioId: string) => {
    if (!DEMO_SCENARIOS.some(scenario=>scenario.id===scenarioId)) return;
    if (scenarioIdRef.current === scenarioId) return;
    setActiveScenarioId(scenarioId);
    setEntryOverrides({});
    setAddedEntries([]);
    setBalanceOverrideCents(null);
    setUnlockedCompleteData(false);
    setSelectedDate(null);
    setEditingEntryId(null);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('cenario', scenarioId);
      if (url.toString() !== window.location.href) window.history.pushState({}, '', url.toString());
      window.dispatchEvent(new Event('folego:scenario-change'));
    }
  }, []);

  useEffect(()=>{
    const restoreFromHistory=()=>{
      const nextId = getInitialScenarioId();
      if (nextId === scenarioIdRef.current) return;
      setActiveScenarioId(nextId);
      resetAllSimulations();
      setSelectedDate(null);
      setEditingEntryId(null);
      window.dispatchEvent(new Event('folego:scenario-change'));
      document.getElementById('conteudo-principal')?.focus({preventScroll:true});
    };
    window.addEventListener('popstate',restoreFromHistory);
    return ()=>window.removeEventListener('popstate',restoreFromHistory);
  },[resetAllSimulations]);

  const stepScenario = useCallback(
    (direction: 'prev' | 'next') => {
      const idx = DEMO_SCENARIOS.findIndex((s) => s.id === activeScenario.id);
      const nextIdx =
        direction === 'next'
          ? (idx + 1) % DEMO_SCENARIOS.length
          : (idx - 1 + DEMO_SCENARIOS.length) % DEMO_SCENARIOS.length;
      selectScenario(DEMO_SCENARIOS[nextIdx].id);
    },
    [activeScenario.id, selectScenario]
  );

  const updateEntryOverride = useCallback((entryId: string, patch: EntryOverride) => {
    setEntryOverrides((prev) => {
      const existing = prev[entryId] ?? {};
      return {
        ...prev,
        [entryId]: {
          ...existing,
          ...patch,
        },
      };
    });
  }, []);

  const resetEntryOverride = useCallback((entryId: string) => {
    setEntryOverrides((prev) => {
      const next = { ...prev };
      delete next[entryId];
      return next;
    });
  }, []);

  const addSimulatedEntry = useCallback((entryData: Omit<FinancialEntry, 'id'>) => {
    const newEntry: FinancialEntry = {
      ...entryData,
      id: `sim-added-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    setAddedEntries((prev) => [...prev, newEntry]);
  }, []);

  const removeSimulatedEntry = useCallback((entryId: string) => {
    setAddedEntries((prev) => prev.filter((e) => e.id !== entryId));
  }, []);

  const setBalanceOverride = useCallback(
    (balanceCents: Cents | null, unlockCompleteData = true) => {
      setBalanceOverrideCents(balanceCents);
      if (unlockCompleteData && balanceCents !== null) {
        setUnlockedCompleteData(true);
      }
    },
    []
  );

  // Projeção Baseline (Original Imutável)
  const baselineProjection = useMemo(() => {
    return projectLiquidity(activeScenario.snapshot, activeScenario.entries);
  }, [activeScenario]);

  // Snapshot e Lançamentos Efetivos (Com Simulação Aplicada)
  const effectiveSnapshot = useMemo<AccountSnapshot>(() => {
    return {
      ...activeScenario.snapshot,
      availableBalanceCents:
        balanceOverrideCents !== null
          ? balanceOverrideCents
          : activeScenario.snapshot.availableBalanceCents,
      hasCompleteData: unlockedCompleteData || activeScenario.snapshot.hasCompleteData,
    };
  }, [activeScenario.snapshot, balanceOverrideCents, unlockedCompleteData]);

  const effectiveEntries = useMemo<FinancialEntry[]>(() => {
    const patchedBase = activeScenario.entries.map((entry) => {
      const override = entryOverrides[entry.id];
      if (!override) return entry;
      return {
        ...entry,
        ...override,
      };
    });

    const patchedAdded = addedEntries.map((entry) => {
      const override = entryOverrides[entry.id];
      if (!override) return entry;
      return {
        ...entry,
        ...override,
      };
    });

    return [...patchedBase, ...patchedAdded];
  }, [activeScenario.entries, entryOverrides, addedEntries]);

  // Projeção Simulada Ativa
  const activeProjection = useMemo(() => {
    return projectLiquidity(effectiveSnapshot, effectiveEntries);
  }, [effectiveSnapshot, effectiveEntries]);

  const simulationDelta = useMemo<SimulationDelta>(() => {
    const modifiedEntriesCount = Object.keys(entryOverrides).length;
    const addedEntriesCount = addedEntries.length;
    const hasBalanceOverride = balanceOverrideCents !== null || unlockedCompleteData;
    const hasChanges =
      modifiedEntriesCount > 0 || addedEntriesCount > 0 || hasBalanceOverride;

    const baseDeficitAbs = Math.abs(baselineProjection.metrics.maxDeficitCents);
    const activeDeficitAbs = Math.abs(activeProjection.metrics.maxDeficitCents);
    const deficitSavedCents = baseDeficitAbs - activeDeficitAbs;

    const lowestBalanceGainCents =
      activeProjection.metrics.lowestProjectedBalanceCents -
      baselineProjection.metrics.lowestProjectedBalanceCents;

    const shortfallEliminated =
      baselineProjection.metrics.firstShortfallDate !== null &&
      activeProjection.metrics.firstShortfallDate === null;

    return {
      hasChanges,
      modifiedEntriesCount,
      addedEntriesCount,
      hasBalanceOverride,
      deficitSavedCents,
      lowestBalanceGainCents,
      shortfallEliminated,
    };
  }, [
    entryOverrides,
    addedEntries.length,
    balanceOverrideCents,
    unlockedCompleteData,
    baselineProjection.metrics,
    activeProjection.metrics,
  ]);

  const value = useMemo<FinancialStoreContextValue>(
    () => ({
      scenarios: DEMO_SCENARIOS,
      activeScenario,
      selectScenario,
      stepScenario,
      baselineProjection,
      activeProjection,
      effectiveSnapshot,
      simulationDelta,
      entryOverrides,
      addedEntries,
      updateEntryOverride,
      resetEntryOverride,
      addSimulatedEntry,
      removeSimulatedEntry,
      setBalanceOverride,
      resetAllSimulations,
      selectedDate,
      setSelectedDate,
      editingEntryId,
      setEditingEntryId,
    }),
    [
      activeScenario,
      selectScenario,
      stepScenario,
      baselineProjection,
      activeProjection,
      effectiveSnapshot,
      simulationDelta,
      entryOverrides,
      addedEntries,
      updateEntryOverride,
      resetEntryOverride,
      addSimulatedEntry,
      removeSimulatedEntry,
      setBalanceOverride,
      resetAllSimulations,
      selectedDate,
      editingEntryId,
    ]
  );

  return (
    <FinancialStoreContext.Provider value={value}>
      {children}
    </FinancialStoreContext.Provider>
  );
};

export function useFinancialStore(): FinancialStoreContextValue {
  const ctx = useContext(FinancialStoreContext);
  if (!ctx) {
    throw new Error('useFinancialStore deve ser utilizado dentro de FinancialStoreProvider');
  }
  return ctx;
}
