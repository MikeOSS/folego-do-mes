import {
  AccountSnapshot,
  AlertStatus,
  CriticalMilestone,
  DailyProjection,
  EntryOrigin,
  EvaluatedEntry,
  FinancialEntry,
  ISODateString,
  NextExpectedInflow,
  ProjectionMetrics,
  ProjectionResult,
  WarningReason,
} from './types';
import { addCents, formatBRL, subtractCents, toSafeCents } from './money';
import {
  addDaysISO,
  compareISODates,
  daysBetweenISO,
  formatShortDatePT,
  isValidISODate,
} from './date';

/**
 * Prioridade determinística de origem para desempate de deduplicação
 * (Fontes bancárias concretas têm prioridade sobre lembretes manuais/históricos)
 */
const ORIGIN_PRIORITY: Record<EntryOrigin, number> = {
  debito_automatico: 1,
  pix_agendado: 2,
  dda: 3,
  folha_pagamento: 4,
  manual: 5,
  recorrente_historico: 6,
};

const STRUCTURED_BANK_ORIGINS = new Set<EntryOrigin>([
  'debito_automatico',
  'pix_agendado',
  'dda',
  'folha_pagamento',
]);

const PREDICTIVE_OR_MANUAL_ORIGINS = new Set<EntryOrigin>([
  'manual',
  'recorrente_historico',
]);

const TITLE_STOPWORDS = new Set([
  'boleto',
  'conta',
  'fatura',
  'pagamento',
  'pgto',
  'de',
  'do',
  'da',
  'dos',
  'das',
  'mensal',
  'lembrete',
  'agendado',
  'dda',
]);

/**
 * Normaliza título para comparação semântica de deduplicação
 * Ex: "Boleto Conta de Luz CPFL" -> "luz cpfl"
 */
export function normalizeEntryTitle(title: string): string {
  const withoutAccents = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ');

  const tokens = withoutAccents
    .split(/\s+/)
    .filter((token) => token.length > 1 && !TITLE_STOPWORDS.has(token));

  return tokens.join(' ').trim();
}

/**
 * Verifica se dois títulos normalizados representam a mesma entidade semântica
 */
function titlesMatchSemantically(a: string, b: string): boolean {
  const normA = normalizeEntryTitle(a);
  const normB = normalizeEntryTitle(b);
  if (!normA || !normB) return false;
  if (normA === normB) return true;

  // Permite que "luz cpfl" bata com "energia luz cpfl paulista" se compartilhar >= 1 token específico (>3 letras)
  if (normA.includes(normB) || normB.includes(normA)) {
    const shortest = normA.length <= normB.length ? normA : normB;
    return shortest.length >= 4;
  }
  return false;
}

/**
 * Regra determinística dos 5 critérios para deduplicação sem falsos positivos
 */
function areEntriesDuplicates(a: FinancialEntry, b: FinancialEntry): boolean {
  if (a.id === b.id) return false;
  // 1. Mesmo tipo (inflow vs outflow)
  if (a.type !== b.type) return false;
  // 2. Mesmo valor exato em centavos
  if (toSafeCents(a.amountCents) !== toSafeCents(b.amountCents)) return false;

  // 3. Janela temporal estrita (até 3 dias entre as datas de vencimento ou efetivas)
  const dueDiff = Math.abs(daysBetweenISO(a.dueDate, b.dueDate));
  const effDiff = Math.abs(daysBetweenISO(a.effectiveDate, b.effectiveDate));
  if (Math.min(dueDiff, effDiff) > 3) return false;

  // 4. Se possuírem a mesma dedupeKey explícita (não vazia), são duplicados
  if (a.dedupeKey && b.dedupeKey && a.dedupeKey.trim() === b.dedupeKey.trim()) {
    return true;
  }

  // 5. Origens cruzadas compatíveis: um de fonte bancária concreta e outro manual/histórico
  const aIsBank = STRUCTURED_BANK_ORIGINS.has(a.origin);
  const bIsBank = STRUCTURED_BANK_ORIGINS.has(b.origin);
  const aIsManual = PREDICTIVE_OR_MANUAL_ORIGINS.has(a.origin);
  const bIsManual = PREDICTIVE_OR_MANUAL_ORIGINS.has(b.origin);

  const hasCrossOrigin = (aIsBank && bIsManual) || (bIsBank && aIsManual);
  if (!hasCrossOrigin) {
    return false;
  }

  return titlesMatchSemantically(a.title, b.title);
}

/**
 * Determina se um compromisso postergado (effectiveDate > dueDate) está sujeito a multa/juros
 */
export function shouldTriggerLatePenalty(entry: FinancialEntry): boolean {
  if (entry.type !== 'outflow') return false;
  if (compareISODates(entry.effectiveDate, entry.dueDate) <= 0) return false;

  // Compromissos confirmados ou de origem contratual (DDA, débito automático, pix agendado) geram alerta de atraso
  if (entry.certainty === 'confirmed') return true;
  if (
    entry.origin === 'dda' ||
    entry.origin === 'debito_automatico' ||
    entry.origin === 'pix_agendado'
  ) {
    return true;
  }
  return false;
}

/**
 * Executa a projeção determinística completa para o Fôlego do Mês
 */
export function projectLiquidity(
  snapshot: AccountSnapshot,
  rawEntries: readonly FinancialEntry[]
): ProjectionResult {
  const referenceDate = isValidISODate(snapshot.referenceDate)
    ? snapshot.referenceDate
    : '2026-11-01';
  const horizonDays = Math.max(1, Math.min(90, Math.round(snapshot.horizonDays || 30)));
  const horizonEndDate = addDaysISO(referenceDate, horizonDays);

  const hasValidBalance =
    snapshot.availableBalanceCents !== null &&
    snapshot.availableBalanceCents !== undefined &&
    Number.isFinite(snapshot.availableBalanceCents);

  // Guarda de Informações Insuficientes
  if (!snapshot.hasCompleteData || !hasValidBalance) {
    return buildInsufficientDataResult(snapshot, referenceDate, horizonDays, rawEntries);
  }

  const initialBalanceCents = toSafeCents(snapshot.availableBalanceCents!);

  // Passo 1: Ordenar candidatos para avaliação determinística (por prioridade de origem, data e ID)
  const sortedEntries = [...rawEntries].sort((a, b) => {
    const dateCmp = compareISODates(a.effectiveDate, b.effectiveDate);
    if (dateCmp !== 0) return dateCmp;
    const prioCmp = ORIGIN_PRIORITY[a.origin] - ORIGIN_PRIORITY[b.origin];
    if (prioCmp !== 0) return prioCmp;
    return a.id.localeCompare(b.id);
  });

  // Passo 2: Avaliar elegibilidade, Overdue Clamping e Deduplicação
  const evaluatedEntries: EvaluatedEntry[] = [];
  const activeSurvivors: FinancialEntry[] = [];
  let deferredBeyondHorizonCents = 0;
  let deduplicatedCount = 0;
  let deduplicatedSavedCents = 0;
  let latePenaltyWarningCount = 0;

  // Ordenar por prioridade de origem primeiro para garantir que a fonte bancária sobreviva à deduplicação
  const priorityOrderedForDedupe = [...rawEntries].sort((a, b) => {
    const prioCmp = ORIGIN_PRIORITY[a.origin] - ORIGIN_PRIORITY[b.origin];
    if (prioCmp !== 0) return prioCmp;
    const dateCmp = compareISODates(a.effectiveDate, b.effectiveDate);
    if (dateCmp !== 0) return dateCmp;
    return a.id.localeCompare(b.id);
  });

  const evaluationById = new Map<string, EvaluatedEntry>();

  for (const entry of priorityOrderedForDedupe) {
    const safeAmount = Math.max(0, toSafeCents(entry.amountCents));
    const normalizedEntry: FinancialEntry = {
      ...entry,
      amountCents: safeAmount,
    };

    const isOverdue =
      normalizedEntry.status === 'pending' &&
      compareISODates(normalizedEntry.dueDate, referenceDate) < 0;
    const daysDelayed = Math.max(
      0,
      daysBetweenISO(normalizedEntry.dueDate, normalizedEntry.effectiveDate)
    );
    const isPostponed = daysDelayed > 0;
    const triggersLatePenaltyWarning =
      normalizedEntry.status === 'pending' &&
      normalizedEntry.affectsMonitoredAccount &&
      shouldTriggerLatePenalty(normalizedEntry);

    // Overdue Clamping: se está pendente mas com effectiveDate no passado (< referenceDate), projeta em referenceDate (dia 0)
    const projectedDate =
      compareISODates(normalizedEntry.effectiveDate, referenceDate) < 0
        ? referenceDate
        : normalizedEntry.effectiveDate;

    if (normalizedEntry.status === 'cancelled') {
      evaluationById.set(normalizedEntry.id, {
        entry: normalizedEntry,
        projectedDate,
        eligibility: 'ignored_cancelled',
        isOverdue: false,
        isPostponed,
        daysDelayed,
        triggersLatePenaltyWarning: false,
      });
      continue;
    }

    if (normalizedEntry.status === 'paid_here') {
      evaluationById.set(normalizedEntry.id, {
        entry: normalizedEntry,
        projectedDate,
        eligibility: 'ignored_already_paid_here',
        isOverdue: false,
        isPostponed,
        daysDelayed,
        triggersLatePenaltyWarning: false,
      });
      continue;
    }

    if (normalizedEntry.status === 'paid_other_bank') {
      evaluationById.set(normalizedEntry.id, {
        entry: normalizedEntry,
        projectedDate,
        eligibility: 'ignored_other_bank',
        isOverdue: false,
        isPostponed,
        daysDelayed,
        triggersLatePenaltyWarning: false,
      });
      continue;
    }

    if (!normalizedEntry.affectsMonitoredAccount) {
      evaluationById.set(normalizedEntry.id, {
        entry: normalizedEntry,
        projectedDate,
        eligibility: 'ignored_not_monitored',
        isOverdue: false,
        isPostponed,
        daysDelayed,
        triggersLatePenaltyWarning: false,
      });
      continue;
    }

    // Verifica se está além do horizonte de visualização
    if (compareISODates(projectedDate, horizonEndDate) > 0) {
      if (normalizedEntry.type === 'outflow') {
        deferredBeyondHorizonCents = addCents(deferredBeyondHorizonCents, safeAmount);
      }
      evaluationById.set(normalizedEntry.id, {
        entry: normalizedEntry,
        projectedDate,
        eligibility: 'ignored_beyond_horizon',
        isOverdue,
        isPostponed,
        daysDelayed,
        triggersLatePenaltyWarning,
      });
      continue;
    }

    // Verifica deduplicação contra sobreviventes já aceitos
    const duplicateSurvivor = activeSurvivors.find((survivor) =>
      areEntriesDuplicates(survivor, normalizedEntry)
    );

    if (duplicateSurvivor) {
      deduplicatedCount += 1;
      if (normalizedEntry.type === 'outflow') {
        deduplicatedSavedCents = addCents(deduplicatedSavedCents, safeAmount);
      }
      evaluationById.set(normalizedEntry.id, {
        entry: normalizedEntry,
        projectedDate,
        eligibility: 'deduplicated',
        deduplicatedOfId: duplicateSurvivor.id,
        deduplicatedOfTitle: duplicateSurvivor.title,
        isOverdue,
        isPostponed,
        daysDelayed,
        triggersLatePenaltyWarning: false,
      });
      continue;
    }

    activeSurvivors.push(normalizedEntry);
    if (triggersLatePenaltyWarning) {
      latePenaltyWarningCount += 1;
    }

    evaluationById.set(normalizedEntry.id, {
      entry: normalizedEntry,
      projectedDate,
      eligibility: 'included',
      isOverdue,
      isPostponed,
      daysDelayed,
      triggersLatePenaltyWarning,
    });
  }

  for (const item of sortedEntries) {
    const ev = evaluationById.get(item.id);
    if (ev) {
      evaluatedEntries.push(ev);
    }
  }

  // Passo 3: Agrupar lançamentos por data projetada dentro da janela [referenceDate, horizonEndDate]
  const entriesByDate = new Map<ISODateString, EvaluatedEntry[]>();
  for (const ev of evaluatedEntries) {
    const list = entriesByDate.get(ev.projectedDate) ?? [];
    list.push(ev);
    entriesByDate.set(ev.projectedDate, list);
  }

  // Passo 4: Construir a Série Diária Determinística (Curvas 1, 2, 3 + Intradiário)
  const dailySeries: DailyProjection[] = [];
  let runningConfirmed = initialBalanceCents;
  let runningProjected = initialBalanceCents;
  let runningOptimistic = initialBalanceCents;

  let firstShortfallDate: ISODateString | null = null;
  let firstConfirmedShortfallDate: ISODateString | null = null;
  let firstOptimisticShortfallDate: ISODateString | null = null;
  let firstIntradayRiskDate: ISODateString | null = null;

  let lowestProjectedBalanceCents = initialBalanceCents;
  let lowestProjectedBalanceDate = referenceDate;
  let lowestConfirmedBalanceCents = initialBalanceCents;
  let lowestConfirmedBalanceDate = referenceDate;

  let totalConfirmedInflowsCents = 0;
  let totalConfirmedOutflowsCents = 0;
  let totalEstimatedOutflowsCents = 0;
  let totalUncertainInflowsCents = 0;

  for (let dayIndex = 0; dayIndex <= horizonDays; dayIndex++) {
    const currentDate = addDaysISO(referenceDate, dayIndex);
    const dayEntries = entriesByDate.get(currentDate) ?? [];

    const openingConfirmedCents = runningConfirmed;
    const openingProjectedCents = runningProjected;
    const openingOptimisticCents = runningOptimistic;

    let confirmedInflowsCents = 0;
    let estimatedInflowsCents = 0;
    let uncertainInflowsCents = 0;
    let confirmedOutflowsCents = 0;
    let estimatedOutflowsCents = 0;

    for (const ev of dayEntries) {
      if (ev.eligibility !== 'included') continue;
      const amt = ev.entry.amountCents;

      if (ev.entry.type === 'inflow') {
        if (ev.entry.certainty === 'confirmed') {
          confirmedInflowsCents = addCents(confirmedInflowsCents, amt);
        } else if (ev.entry.certainty === 'estimated') {
          estimatedInflowsCents = addCents(estimatedInflowsCents, amt);
        } else {
          uncertainInflowsCents = addCents(uncertainInflowsCents, amt);
        }
      } else {
        if (ev.entry.certainty === 'confirmed') {
          confirmedOutflowsCents = addCents(confirmedOutflowsCents, amt);
        } else {
          // Despesas 'estimated' ou 'uncertain' entram na camada estimada
          estimatedOutflowsCents = addCents(estimatedOutflowsCents, amt);
        }
      }
    }

    totalConfirmedInflowsCents = addCents(totalConfirmedInflowsCents, confirmedInflowsCents);
    totalConfirmedOutflowsCents = addCents(totalConfirmedOutflowsCents, confirmedOutflowsCents);
    totalEstimatedOutflowsCents = addCents(totalEstimatedOutflowsCents, estimatedOutflowsCents);
    totalUncertainInflowsCents = addCents(totalUncertainInflowsCents, uncertainInflowsCents);

    // Curva 1: Apenas Confirmados
    const closingConfirmedCents = subtractCents(
      addCents(openingConfirmedCents, confirmedInflowsCents),
      confirmedOutflowsCents
    );

    // Curva 2: Projetada Realista (Confirmados + Estimados, sem depender de entradas incertas)
    const totalDayInflowsRealistic = addCents(confirmedInflowsCents, estimatedInflowsCents);
    const totalDayOutflowsRealistic = addCents(confirmedOutflowsCents, estimatedOutflowsCents);
    const closingProjectedCents = subtractCents(
      addCents(openingProjectedCents, totalDayInflowsRealistic),
      totalDayOutflowsRealistic
    );

    // Curva 3: Otimista (inclui recebimentos marcados como 'uncertain')
    const totalDayInflowsOptimistic = addCents(totalDayInflowsRealistic, uncertainInflowsCents);
    const closingOptimisticCents = subtractCents(
      addCents(openingOptimisticCents, totalDayInflowsOptimistic),
      totalDayOutflowsRealistic
    );

    // Mínimo Intradiário Conservador: saldo de abertura menos saídas confirmadas do próprio dia
    const intradayMinCents = subtractCents(openingConfirmedCents, confirmedOutflowsCents);
    const intradayTimingRisk =
      confirmedOutflowsCents > 0 &&
      confirmedInflowsCents > 0 &&
      intradayMinCents < 0 &&
      closingConfirmedCents >= 0;

    const intradayShortfallCents = intradayTimingRisk ? intradayMinCents : 0;

    if (intradayTimingRisk && firstIntradayRiskDate === null) {
      firstIntradayRiskDate = currentDate;
    }

    if (closingConfirmedCents < 0 && firstConfirmedShortfallDate === null) {
      firstConfirmedShortfallDate = currentDate;
    }

    if (closingProjectedCents < 0 && firstShortfallDate === null) {
      firstShortfallDate = currentDate;
    }

    if (closingOptimisticCents < 0 && firstOptimisticShortfallDate === null) {
      firstOptimisticShortfallDate = currentDate;
    }

    if (closingProjectedCents < lowestProjectedBalanceCents) {
      lowestProjectedBalanceCents = closingProjectedCents;
      lowestProjectedBalanceDate = currentDate;
    }

    if (closingConfirmedCents < lowestConfirmedBalanceCents) {
      lowestConfirmedBalanceCents = closingConfirmedCents;
      lowestConfirmedBalanceDate = currentDate;
    }

    runningConfirmed = closingConfirmedCents;
    runningProjected = closingProjectedCents;
    runningOptimistic = closingOptimisticCents;

    dailySeries.push({
      date: currentDate,
      dayIndex,
      openingConfirmedCents,
      openingProjectedCents,
      openingOptimisticCents,
      confirmedInflowsCents,
      estimatedInflowsCents,
      uncertainInflowsCents,
      confirmedOutflowsCents,
      estimatedOutflowsCents,
      closingConfirmedCents,
      closingProjectedCents,
      closingOptimisticCents,
      intradayMinCents,
      intradayTimingRisk,
      intradayShortfallCents,
      entries: dayEntries,
    });
  }

  const maxDeficitCents = lowestProjectedBalanceCents < 0 ? lowestProjectedBalanceCents : 0;
  const maxConfirmedDeficitCents =
    lowestConfirmedBalanceCents < 0 ? lowestConfirmedBalanceCents : 0;

  const daysUntilShortfall =
    firstShortfallDate !== null ? daysBetweenISO(referenceDate, firstShortfallDate) : null;
  const daysUntilConfirmedShortfall =
    firstConfirmedShortfallDate !== null
      ? daysBetweenISO(referenceDate, firstConfirmedShortfallDate)
      : null;

  const uncertainInflowsCoverDeficit =
    firstShortfallDate !== null &&
    totalUncertainInflowsCents > 0 &&
    firstOptimisticShortfallDate === null;

  const nextExpectedInflow = findNextExpectedInflow(evaluatedEntries, referenceDate);

  const metrics: ProjectionMetrics = {
    firstShortfallDate,
    firstConfirmedShortfallDate,
    firstIntradayRiskDate,
    daysUntilShortfall,
    daysUntilConfirmedShortfall,
    lowestProjectedBalanceCents,
    lowestProjectedBalanceDate,
    lowestConfirmedBalanceCents,
    lowestConfirmedBalanceDate,
    maxDeficitCents,
    maxConfirmedDeficitCents,
    totalConfirmedInflowsCents,
    totalConfirmedOutflowsCents,
    totalEstimatedOutflowsCents,
    totalUncertainInflowsCents,
    deferredBeyondHorizonCents,
    uncertainInflowsCoverDeficit,
    deduplicatedCount,
    deduplicatedSavedCents,
    latePenaltyWarningCount,
    nextExpectedInflow,
  };

  // Passo 5: Tabela Verdade Determinística dos 4 Estados e Subtipos
  const warningReasons: WarningReason[] = [];
  let alertStatus: AlertStatus = 'NO_SHORTFALL_IDENTIFIED';

  if (firstConfirmedShortfallDate !== null) {
    if (uncertainInflowsCoverDeficit) {
      alertStatus = 'CONDITIONAL_WARNING';
      warningReasons.push('UNCERTAIN_INFLOW_DEPENDENCY');
    } else {
      alertStatus = 'PREVENTIVE_ALERT';
      warningReasons.push('CONFIRMED_SHORTFALL');
    }
  } else if (firstShortfallDate !== null) {
    alertStatus = 'CONDITIONAL_WARNING';
    warningReasons.push('ESTIMATED_OUTFLOW_RISK');
  }

  if (firstIntradayRiskDate !== null) {
    warningReasons.push('INTRADAY_TIMING_RISK');
    if (alertStatus === 'NO_SHORTFALL_IDENTIFIED') {
      alertStatus = 'CONDITIONAL_WARNING';
    }
  }

  const copy = buildDiagnosticCopy(alertStatus, warningReasons, metrics, dailySeries);
  const milestones = buildCriticalMilestones(dailySeries, metrics, referenceDate);

  return {
    alertStatus,
    warningReasons,
    headline: copy.headline,
    explanation: copy.explanation,
    scopeDisclaimer:
      'Cálculo baseado apenas no saldo livre da conta (sem contar cheque especial) e nos compromissos listados abaixo.',
    actionableHints: copy.actionableHints,
    metrics,
    dailySeries,
    evaluatedEntries,
    milestones,
  };
}

function findNextExpectedInflow(
  evaluatedEntries: EvaluatedEntry[],
  referenceDate: ISODateString
): NextExpectedInflow | null {
  const candidates = evaluatedEntries.filter(
    (ev) =>
      ev.eligibility === 'included' &&
      ev.entry.type === 'inflow' &&
      compareISODates(ev.projectedDate, referenceDate) >= 0
  );

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const cmp = compareISODates(a.projectedDate, b.projectedDate);
    if (cmp !== 0) return cmp;
    return b.entry.amountCents - a.entry.amountCents;
  });

  const best = candidates[0];
  return {
    entry: best.entry,
    daysUntil: Math.max(0, daysBetweenISO(referenceDate, best.projectedDate)),
  };
}

function buildDiagnosticCopy(
  alertStatus: AlertStatus,
  warningReasons: WarningReason[],
  metrics: ProjectionMetrics,
  dailySeries: DailyProjection[]
): { headline: string; explanation: string; actionableHints: string[] } {
  const hints: string[] = [];

  if (metrics.deduplicatedCount > 0) {
    hints.push(
      `Contagem dupla evitada: ${metrics.deduplicatedCount} lançamento(s) duplicado(s) (${formatBRL(metrics.deduplicatedSavedCents)}) foram identificados e considerados apenas uma vez.`
    );
  }

  if (metrics.latePenaltyWarningCount > 0) {
    hints.push(
      `Atenção na simulação: ${metrics.latePenaltyWarningCount} compromisso(s) com vencimento fixo foram simulados após a data de vencimento original e podem gerar multa ou juros.`
    );
  }

  if (alertStatus === 'PREVENTIVE_ALERT') {
    const shortfallDatePT = formatShortDatePT(metrics.firstConfirmedShortfallDate!);
    const deficitFormatted = formatBRL(Math.abs(metrics.maxDeficitCents));
    const daysText =
      metrics.daysUntilConfirmedShortfall === 0
        ? 'hoje'
        : `em ${metrics.daysUntilConfirmedShortfall} dia(s) (${shortfallDatePT})`;

    return {
      headline: `Alerta preventivo: faltam ${deficitFormatted} para cobrir seus compromissos confirmados ${daysText}.`,
      explanation:
        metrics.nextExpectedInflow !== null
          ? `Mesmo sem considerar gastos variáveis, as contas fixas vencem antes ou superam o próximo recebimento previsto (${metrics.nextExpectedInflow.entry.title} em ${formatShortDatePT(metrics.nextExpectedInflow.entry.effectiveDate)}).`
          : 'Seus compromissos confirmados superam o saldo livre disponível no período analisado.',
      actionableHints: [
        ...hints,
        'Toque em um compromisso abaixo para informar caso já tenha sido pago por outro banco ou simular outra data de pagamento.',
      ],
    };
  }

  if (alertStatus === 'CONDITIONAL_WARNING') {
    if (warningReasons.includes('UNCERTAIN_INFLOW_DEPENDENCY')) {
      const shortfallDatePT = formatShortDatePT(metrics.firstConfirmedShortfallDate!);
      const deficitFormatted = formatBRL(Math.abs(metrics.maxConfirmedDeficitCents));
      return {
        headline: `Aviso condicional: a cobertura das contas de ${shortfallDatePT} depende da confirmação de recebimentos pendentes.`,
        explanation: `Sem os recebimentos marcados como incertos (${formatBRL(metrics.totalUncertainInflowsCents)}), faltariam ${deficitFormatted} no dia ${shortfallDatePT}. Se caírem na data prevista, seu saldo permanece positivo.`,
        actionableHints: [
          ...hints,
          'Acompanhe a confirmação do recebimento pendente ou simule um plano B caso o depósito atrase.',
        ],
      };
    }

    if (warningReasons.includes('ESTIMATED_OUTFLOW_RISK')) {
      const shortfallDatePT = formatShortDatePT(metrics.firstShortfallDate!);
      const deficitFormatted = formatBRL(Math.abs(metrics.maxDeficitCents));
      return {
        headline: `Aviso condicional: suas contas fixas estão cobertas, mas os gastos estimados projetam aperto de ${deficitFormatted} em ${shortfallDatePT}.`,
        explanation: `Todos os compromissos confirmados cabem no seu saldo (menor saldo firme: ${formatBRL(metrics.lowestConfirmedBalanceCents)}). O risco ocorre apenas se as despesas estimadas (${formatBRL(metrics.totalEstimatedOutflowsCents)}) se realizarem integralmente.`,
        actionableHints: [
          ...hints,
          'Ajuste o valor das despesas estimadas na linha do tempo para descobrir quanto economizar para manter o mês no azul.',
        ],
      };
    }

    if (warningReasons.includes('INTRADAY_TIMING_RISK')) {
      const riskDate = metrics.firstIntradayRiskDate!;
      const riskDay = dailySeries.find((d) => d.date === riskDate);
      const intradayGap = riskDay ? formatBRL(Math.abs(riskDay.intradayMinCents)) : 'R$ 0,00';
      return {
        headline: `Atenção ao horário em ${formatShortDatePT(riskDate)}: compromissos e recebimento acontecem no mesmo dia.`,
        explanation: `O dia ${formatShortDatePT(riskDate)} fecha no azul, mas se os débitos confirmados baterem na conta antes de o recebimento cair, faltariam ${intradayGap} temporariamente durante o dia.`,
        actionableHints: [
          ...hints,
          'Verifique se o crédito cai no início da manhã ou mantenha saldo de reserva na véspera para evitar falha no débito automático.',
        ],
      };
    }
  }

  // NO_SHORTFALL_IDENTIFIED
  const lowestFormatted = formatBRL(metrics.lowestProjectedBalanceCents);
  const lowestDatePT = formatShortDatePT(metrics.lowestProjectedBalanceDate);
  return {
    headline: `Sem insuficiência identificada: os compromissos mapeados estão cobertos nos próximos ${dailySeries.length - 1} dias.`,
    explanation: `Considerando suas contas confirmadas e estimadas, seu menor saldo projetado será de ${lowestFormatted} em ${lowestDatePT}, sem usar cheque especial.`,
    actionableHints: [
      ...hints,
      'Esta previsão considera apenas os compromissos conhecidos listados abaixo. Cadastre novos gastos caso surjam imprevistos.',
    ],
  };
}

function buildCriticalMilestones(
  dailySeries: DailyProjection[],
  metrics: ProjectionMetrics,
  referenceDate: ISODateString
): CriticalMilestone[] {
  const milestones: CriticalMilestone[] = [];
  const usedDates = new Set<ISODateString>();

  if (dailySeries.length > 0) {
    milestones.push({
      id: 'milestone-today',
      date: referenceDate,
      label: 'Hoje',
      balanceCents: dailySeries[0].closingProjectedCents,
      kind: 'today',
    });
    usedDates.add(referenceDate);
  }

  if (metrics.firstShortfallDate && !usedDates.has(metrics.firstShortfallDate)) {
    const day = dailySeries.find((d) => d.date === metrics.firstShortfallDate);
    if (day) {
      milestones.push({
        id: 'milestone-first-deficit',
        date: day.date,
        label: `1º Déficit (${formatShortDatePT(day.date)})`,
        balanceCents: day.closingProjectedCents,
        kind: 'first_deficit',
      });
      usedDates.add(day.date);
    }
  }

  if (metrics.firstIntradayRiskDate && !usedDates.has(metrics.firstIntradayRiskDate)) {
    const day = dailySeries.find((d) => d.date === metrics.firstIntradayRiskDate);
    if (day) {
      milestones.push({
        id: 'milestone-intraday',
        date: day.date,
        label: `Mesmo Dia (${formatShortDatePT(day.date)})`,
        balanceCents: day.closingProjectedCents,
        kind: 'intraday_risk',
      });
      usedDates.add(day.date);
    }
  }

  if (
    metrics.lowestProjectedBalanceDate &&
    !usedDates.has(metrics.lowestProjectedBalanceDate)
  ) {
    milestones.push({
      id: 'milestone-lowest',
      date: metrics.lowestProjectedBalanceDate,
      label: `Menor Saldo (${formatShortDatePT(metrics.lowestProjectedBalanceDate)})`,
      balanceCents: metrics.lowestProjectedBalanceCents,
      kind: 'lowest_balance',
    });
    usedDates.add(metrics.lowestProjectedBalanceDate);
  }

  // Encontrar o principal dia de entrada confirmada (Salário / Recebimento)
  const majorInflowDay = dailySeries.find(
    (d) => d.confirmedInflowsCents >= 50000 && !usedDates.has(d.date)
  );
  if (majorInflowDay) {
    milestones.push({
      id: 'milestone-inflow',
      date: majorInflowDay.date,
      label: `Recebimento (${formatShortDatePT(majorInflowDay.date)})`,
      balanceCents: majorInflowDay.closingProjectedCents,
      kind: 'salary_recovery',
    });
    usedDates.add(majorInflowDay.date);
  }

  return milestones.sort((a, b) => compareISODates(a.date, b.date));
}

function buildInsufficientDataResult(
  snapshot: AccountSnapshot,
  referenceDate: ISODateString,
  horizonDays: number,
  rawEntries: readonly FinancialEntry[]
): ProjectionResult {
  const evaluatedEntries: EvaluatedEntry[] = rawEntries.map((entry) => ({
    entry,
    projectedDate: entry.effectiveDate,
    eligibility: 'included',
    isOverdue: false,
    isPostponed: false,
    daysDelayed: 0,
    triggersLatePenaltyWarning: false,
  }));

  return {
    alertStatus: 'INSUFFICIENT_DATA',
    warningReasons: [],
    headline:
      'Informações insuficientes para uma projeção segura: confirme seu saldo disponível ou seus próximos compromissos.',
    explanation:
      snapshot.missingDataReason ??
      'Não encontramos dados mínimos confiáveis de saldo livre ou movimentações futuras nesta conta para calcular seu fôlego com precisão.',
    scopeDisclaimer:
      'Para evitar falsas promessas de liquidez, o Fôlego do Mês não emite alertas positivos quando faltam informações essenciais.',
    actionableHints: [
      'Informe o saldo livre atual da conta ou adicione seus compromissos principais no simulador para destravar a projeção.',
    ],
    metrics: {
      firstShortfallDate: null,
      firstConfirmedShortfallDate: null,
      firstIntradayRiskDate: null,
      daysUntilShortfall: null,
      daysUntilConfirmedShortfall: null,
      lowestProjectedBalanceCents: 0,
      lowestProjectedBalanceDate: referenceDate,
      lowestConfirmedBalanceCents: 0,
      lowestConfirmedBalanceDate: referenceDate,
      maxDeficitCents: 0,
      maxConfirmedDeficitCents: 0,
      totalConfirmedInflowsCents: 0,
      totalConfirmedOutflowsCents: 0,
      totalEstimatedOutflowsCents: 0,
      totalUncertainInflowsCents: 0,
      deferredBeyondHorizonCents: 0,
      uncertainInflowsCoverDeficit: false,
      deduplicatedCount: 0,
      deduplicatedSavedCents: 0,
      latePenaltyWarningCount: 0,
      nextExpectedInflow: null,
    },
    dailySeries: Array.from({ length: horizonDays + 1 }, (_, i) => ({
      date: addDaysISO(referenceDate, i),
      dayIndex: i,
      openingConfirmedCents: 0,
      openingProjectedCents: 0,
      openingOptimisticCents: 0,
      confirmedInflowsCents: 0,
      estimatedInflowsCents: 0,
      uncertainInflowsCents: 0,
      confirmedOutflowsCents: 0,
      estimatedOutflowsCents: 0,
      closingConfirmedCents: 0,
      closingProjectedCents: 0,
      closingOptimisticCents: 0,
      intradayMinCents: 0,
      intradayTimingRisk: false,
      intradayShortfallCents: 0,
      entries: [],
    })),
    evaluatedEntries,
    milestones: [],
  };
}
