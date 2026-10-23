/**
 * Contratos de Domínio Financeiro Puro — Fôlego do Mês
 * Zero dependência de React/UI. Todos os valores monetários são inteiros em centavos (Cents).
 */

/** Inteiro seguro representando centavos (ex: R$ 1.250,50 => 125050) */
export type Cents = number;

/** Data civil estrita no formato YYYY-MM-DD (imune a deslocamento de fuso horário) */
export type ISODateString = string;

export type EntryType = 'inflow' | 'outflow';

/**
 * Classificação de certeza da movimentação:
 * - confirmed: Compromisso fixo/boleto emitido/salário contratual confirmado
 * - estimated: Gasto variável previsto ou entrada recorrente estimada
 * - uncertain: Recebimento incerto/atrasado (ex: freela pendente, comissão sem data firme)
 */
export type CertaintyLevel = 'confirmed' | 'estimated' | 'uncertain';

/**
 * Status operacional do compromisso:
 * - pending: Pendente (será projetado na conta se affectsMonitoredAccount === true)
 * - paid_here: Já quitado e já descontado do availableBalanceCents atual
 * - paid_other_bank: Quitado por outra instituição (não desconta desta conta)
 * - cancelled: Cancelado ou ignorado na simulação
 */
export type EntryStatus = 'pending' | 'paid_here' | 'paid_other_bank' | 'cancelled';

export type EntryOrigin =
  | 'dda'
  | 'pix_agendado'
  | 'debito_automatico'
  | 'recorrente_historico'
  | 'manual'
  | 'folha_pagamento';

/**
 * Os 4 estados oficiais de diagnóstico determinístico do Fôlego do Mês
 */
export type AlertStatus =
  | 'INSUFFICIENT_DATA'
  | 'PREVENTIVE_ALERT'
  | 'CONDITIONAL_WARNING'
  | 'NO_SHORTFALL_IDENTIFIED';

/**
 * Subtipos explicativos para detalhar a causa exata do alerta
 */
export type WarningReason =
  | 'CONFIRMED_SHORTFALL'
  | 'ESTIMATED_OUTFLOW_RISK'
  | 'UNCERTAIN_INFLOW_DEPENDENCY'
  | 'INTRADAY_TIMING_RISK';

export interface AccountSnapshot {
  accountLabel: string;
  availableBalanceCents: Cents | null;
  /** Limite de cheque especial: exibido apenas como referência de proteção, NUNCA somado ao saldo disponível */
  overdraftLimitCents: Cents;
  referenceDate: ISODateString;
  horizonDays: number;
  hasCompleteData: boolean;
  missingDataReason?: string;
}

export interface FinancialEntry {
  id: string;
  title: string;
  category: string;
  amountCents: Cents;
  /** Data de vencimento original contratual/prevista */
  dueDate: ISODateString;
  /** Data efetiva considerada na projeção (permite simular adiamento mantendo o dueDate original) */
  effectiveDate: ISODateString;
  type: EntryType;
  certainty: CertaintyLevel;
  status: EntryStatus;
  origin: EntryOrigin;
  affectsMonitoredAccount: boolean;
  /** Chave semântica opcional para pareamento de deduplicação (ex: código do beneficiário/documento) */
  dedupeKey?: string;
  notes?: string;
}

export type EntryEligibility =
  | 'included'
  | 'ignored_cancelled'
  | 'ignored_already_paid_here'
  | 'ignored_other_bank'
  | 'ignored_not_monitored'
  | 'ignored_beyond_horizon'
  | 'deduplicated';

/**
 * Envelope enriquecido pelo motor determinístico (preserva o FinancialEntry imutável)
 */
export interface EvaluatedEntry {
  entry: FinancialEntry;
  /** Data operacional na janela [referenceDate, horizonEndDate] */
  projectedDate: ISODateString;
  eligibility: EntryEligibility;
  /** ID do lançamento principal que absorveu esta duplicata */
  deduplicatedOfId?: string;
  /** Título do lançamento principal que absorveu esta duplicata */
  deduplicatedOfTitle?: string;
  /** Verdadeiro se dueDate < referenceDate e ainda estiver pending */
  isOverdue: boolean;
  /** Verdadeiro se effectiveDate > dueDate */
  isPostponed: boolean;
  /** Quantos dias foi adiado além do vencimento original */
  daysDelayed: number;
  /** Verdadeiro se for uma saída confirmada/contratual adiada após o vencimento (sujeita a multa/juros) */
  triggersLatePenaltyWarning: boolean;
}

export interface DailyProjection {
  date: ISODateString;
  dayIndex: number;
  openingConfirmedCents: Cents;
  openingProjectedCents: Cents;
  openingOptimisticCents: Cents;
  confirmedInflowsCents: Cents;
  estimatedInflowsCents: Cents;
  uncertainInflowsCents: Cents;
  confirmedOutflowsCents: Cents;
  estimatedOutflowsCents: Cents;
  /** Curva 1 (Sólida Firme): apenas entradas confirmadas - saídas confirmadas */
  closingConfirmedCents: Cents;
  /** Curva 2 (Projetada Realista): entradas confirmadas/estimadas - saídas confirmadas/estimadas */
  closingProjectedCents: Cents;
  /** Curva 3 (Otimista): inclui entradas marcadas como 'uncertain' */
  closingOptimisticCents: Cents;
  /** Pior momento intradiário conservador: openingConfirmed - confirmedOutflows */
  intradayMinCents: Cents;
  /** Verdadeiro se saídas confirmadas do dia superam o saldo de abertura, mas são cobertas por entradas do mesmo dia */
  intradayTimingRisk: boolean;
  /** Déficit intradiário temporário (valor negativo se houver risco intradiário) */
  intradayShortfallCents: Cents;
  entries: EvaluatedEntry[];
}

export interface NextExpectedInflow {
  entry: FinancialEntry;
  daysUntil: number;
}

export interface ProjectionMetrics {
  firstShortfallDate: ISODateString | null;
  firstConfirmedShortfallDate: ISODateString | null;
  firstIntradayRiskDate: ISODateString | null;
  daysUntilShortfall: number | null;
  daysUntilConfirmedShortfall: number | null;
  lowestProjectedBalanceCents: Cents;
  lowestProjectedBalanceDate: ISODateString;
  lowestConfirmedBalanceCents: Cents;
  lowestConfirmedBalanceDate: ISODateString;
  /** Maior déficit projetado (0 se nunca ficar negativo; valor negativo caso contrário) */
  maxDeficitCents: Cents;
  maxConfirmedDeficitCents: Cents;
  totalConfirmedInflowsCents: Cents;
  totalConfirmedOutflowsCents: Cents;
  totalEstimatedOutflowsCents: Cents;
  totalUncertainInflowsCents: Cents;
  deferredBeyondHorizonCents: Cents;
  uncertainInflowsCoverDeficit: boolean;
  deduplicatedCount: number;
  deduplicatedSavedCents: Cents;
  latePenaltyWarningCount: number;
  nextExpectedInflow: NextExpectedInflow | null;
}

export interface CriticalMilestone {
  id: string;
  date: ISODateString;
  label: string;
  balanceCents: Cents;
  kind: 'today' | 'first_deficit' | 'lowest_balance' | 'salary_recovery' | 'intraday_risk';
}

export interface ProjectionResult {
  alertStatus: AlertStatus;
  warningReasons: WarningReason[];
  headline: string;
  explanation: string;
  scopeDisclaimer: string;
  actionableHints: string[];
  metrics: ProjectionMetrics;
  dailySeries: DailyProjection[];
  evaluatedEntries: EvaluatedEntry[];
  milestones: CriticalMilestone[];
}
