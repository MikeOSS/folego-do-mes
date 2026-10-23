import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock,
  CopyCheck,
  Plus,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { useFinancialStore } from '../state/useFinancialStore';
import {
  EntryOrigin,
  EvaluatedEntry,
  ISODateString,
} from '../domain/types';
import { formatBRL } from '../domain/money';
import { formatShortDatePT, getWeekdayShortPT } from '../domain/date';
import { CurrencyDisplay } from './CurrencyDisplay';

type FilterMode = 'all' | 'outflows' | 'inflows' | 'estimated_or_uncertain';

const ORIGIN_LABELS: Record<EntryOrigin, string> = {
  dda: 'DDA Bancário',
  debito_automatico: 'Débito Automático',
  pix_agendado: 'Pix Agendado',
  folha_pagamento: 'Salário / Folha',
  recorrente_historico: 'Média Histórica',
  manual: 'Lembrete Manual',
};

interface CommitmentsLedgerProps {
  onOpenNewEntryModal: () => void;
}

export const CommitmentsLedger: React.FC<CommitmentsLedgerProps> = ({
  onOpenNewEntryModal,
}) => {
  const {
    activeScenario,
    activeProjection,
    entryOverrides,
    updateEntryOverride,
    resetEntryOverride,
    selectedDate,
    setSelectedDate,
    setEditingEntryId,
  } = useFinancialStore();

  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const { dailySeries, evaluatedEntries, metrics } = activeProjection;

  const originalEntriesById = useMemo(() => {
    const map = new Map<string, (typeof activeScenario.entries)[number]>();
    for (const e of activeScenario.entries) {
      map.set(e.id, e);
    }
    return map;
  }, [activeScenario.entries]);

  const nextSalaryDate: ISODateString | null = useMemo(() => {
    const nextInflow = evaluatedEntries.find(
      (ev) =>
        ev.eligibility === 'included' &&
        ev.entry.type === 'inflow' &&
        ev.entry.certainty === 'confirmed'
    );
    return nextInflow ? nextInflow.projectedDate : null;
  }, [evaluatedEntries]);

  const groupedDays = useMemo(() => {
    return dailySeries
      .map((day) => {
        const filtered = day.entries.filter((ev) => {
          if (filterMode === 'outflows') return ev.entry.type === 'outflow';
          if (filterMode === 'inflows') return ev.entry.type === 'inflow';
          if (filterMode === 'estimated_or_uncertain') {
            return ev.entry.certainty !== 'confirmed';
          }
          return true;
        });
        return {
          day,
          entries: filtered,
        };
      })
      .filter((group) => group.entries.length > 0);
  }, [dailySeries, filterMode]);

  return (
    <section
      aria-label="Linha do tempo de compromissos e recebimentos"
      className="surface-raised p-5 sm:p-6 space-y-5"
    >
      {/* Cabeçalho Editorial Limpo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-mono-tabular uppercase tracking-[0.12em] text-[#8891a5] block mb-0.5">
            Extrato Projetado · Selecione o nome para simular
          </span>
          <h2 className="text-base sm:text-lg font-bold tracking-[-0.02em] text-[#151a28]">
            Próximas movimentações ({evaluatedEntries.length})
          </h2>
        </div>

        <button
          type="button"
          onClick={onOpenNewEntryModal}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full bg-[#0064fd] hover:bg-[#0052d0] text-white text-xs font-semibold transition-all shadow-xs min-h-[38px] cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Simular novo gasto</span>
        </button>
      </div>

      {/* Filtros em Pílula Suave */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {(
          [
            { id: 'all', label: 'Todos' },
            { id: 'outflows', label: 'Saídas' },
            { id: 'inflows', label: 'Entradas' },
            { id: 'estimated_or_uncertain', label: 'Estimados e incertos' },
          ] as const
        ).map((tab) => {
          const isActive = filterMode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setFilterMode(tab.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all min-h-[34px] shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[#151a28] text-white shadow-2xs'
                  : 'bg-[#f1f4f9] text-[#525b6e] hover:text-[#151a28] hover:bg-[#e6ebf3]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Feed Cronológico Contínuo */}
      {groupedDays.length === 0 ? (
        <div className="rounded-xl bg-[#f8f9fc] border border-[#151a28]/6 p-8 text-center space-y-2">
          <p className="text-sm font-medium text-[#525b6e]">
            Nenhuma movimentação encontrada para este filtro.
          </p>
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className="text-xs font-semibold text-[#0064fd] hover:underline cursor-pointer"
          >
            Mostrar todas as movimentações
          </button>
        </div>
      ) : (
        <div className="divide-y divide-[#151a28]/7 border-t border-[#151a28]/7">
          {groupedDays.map(({ day, entries }) => {
            const isSelectedDay = selectedDate === day.date;
            const isFirstDeficitDay = metrics.firstShortfallDate === day.date;
            const isClosingNegative = day.closingProjectedCents < 0;

            return (
              <div
                key={day.date}
                id={`ledger-day-${day.date}`}
                onClick={() => setSelectedDate(day.date)}
                className={`py-4 transition-colors ${
                  isSelectedDay ? 'bg-[#0064fd]/[0.025] -mx-3 px-3 rounded-xl' : ''
                }`}
              >
                {/* Divisor de Data e Saldo Projetado */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#151a28]">
                      {formatShortDatePT(day.date)}
                    </span>
                    <span className="text-xs text-[#8891a5] capitalize">
                      · {getWeekdayShortPT(day.date)}
                    </span>

                    {isFirstDeficitDay && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-[#c93535] text-[10px] font-semibold">
                        Início do aperto
                      </span>
                    )}
                  </div>

                  {activeProjection.alertStatus !== 'INSUFFICIENT_DATA' && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-[#8891a5]">Saldo após o dia:</span>
                      <span
                        className={`font-mono-tabular font-semibold ${
                          isClosingNegative ? 'text-[#c93535]' : 'text-[#525b6e]'
                        }`}
                      >
                        {formatBRL(day.closingProjectedCents, { showPlusSign: true })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Aviso de Horário Intradiário (Mesmo Dia) */}
                {day.intradayTimingRisk && (
                  <div className="mb-3 mx-1 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/20 flex items-start gap-2 text-xs text-[#b87810]">
                    <Zap className="w-3.5 h-3.5 shrink-0 text-[#e8a020] mt-0.5" />
                    <div>
                      <strong>Atenção ao horário no dia:</strong> as contas confirmadas (
                      {formatBRL(day.confirmedOutflowsCents)}) superam o saldo da manhã (
                      {formatBRL(day.openingConfirmedCents)}). Confira se a entrada de{' '}
                      {formatBRL(day.confirmedInflowsCents)} cai antes do débito.
                    </div>
                  </div>
                )}

                {/* Itens do Dia */}
                <div className="space-y-1">
                  {entries.map((ev) => (
                    <EntryRow
                      key={ev.entry.id}
                      evaluated={ev}
                      originalEntry={originalEntriesById.get(ev.entry.id)}
                      isSimulated={Boolean(entryOverrides[ev.entry.id])}
                      nextSalaryDate={nextSalaryDate}
                      onOpenEditor={() => setEditingEntryId(ev.entry.id)}
                      onQuickMarkOtherBank={() =>
                        updateEntryOverride(ev.entry.id, {
                          status:
                            ev.entry.status === 'paid_other_bank'
                              ? 'pending'
                              : 'paid_other_bank',
                        })
                      }
                      onQuickPostponeToSalary={(targetDate) =>
                        updateEntryOverride(ev.entry.id, {
                          effectiveDate: targetDate,
                        })
                      }
                      onQuickConfirmUncertain={() =>
                        updateEntryOverride(ev.entry.id, {
                          certainty:
                            ev.entry.certainty === 'confirmed'
                              ? 'uncertain'
                              : 'confirmed',
                        })
                      }
                      onForceIncludeDuplicate={() =>
                        updateEntryOverride(ev.entry.id, {
                          dedupeKey: `forced-distinct-${ev.entry.id}`,
                          origin: 'dda',
                        })
                      }
                      onResetItem={() => resetEntryOverride(ev.entry.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

interface EntryRowProps {
  evaluated: EvaluatedEntry;
  originalEntry?: EvaluatedEntry['entry'];
  isSimulated: boolean;
  nextSalaryDate: ISODateString | null;
  onOpenEditor: () => void;
  onQuickMarkOtherBank: () => void;
  onQuickPostponeToSalary: (targetDate: ISODateString) => void;
  onQuickConfirmUncertain: () => void;
  onForceIncludeDuplicate: () => void;
  onResetItem: () => void;
}

const EntryRow: React.FC<EntryRowProps> = ({
  evaluated,
  originalEntry,
  isSimulated,
  nextSalaryDate,
  onOpenEditor,
  onQuickMarkOtherBank,
  onQuickPostponeToSalary,
  onQuickConfirmUncertain,
  onForceIncludeDuplicate,
  onResetItem,
}) => {
  const {
    entry,
    eligibility,
    deduplicatedOfTitle,
    triggersLatePenaltyWarning,
    daysDelayed,
  } = evaluated;

  const isIgnored = eligibility !== 'included';
  const isInflow = entry.type === 'inflow';

  const canPostponeToSalary =
    !isInflow &&
    eligibility === 'included' &&
    nextSalaryDate !== null &&
    entry.effectiveDate < nextSalaryDate;

  // Define no máximo 1 badge semântico limpo por item
  const renderStatusPill = () => {
    if (eligibility === 'deduplicated') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f1f4f9] text-[#525b6e] text-[10px] font-medium">
          <CopyCheck className="w-3 h-3 text-[#0064fd]" />
          Duplicidade evitada
        </span>
      );
    }
    if (eligibility === 'ignored_other_bank') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#2fc750]/12 text-[#168030] text-[10px] font-medium">
          <Check className="w-3 h-3" />
          Pago em outro banco
        </span>
      );
    }
    if (eligibility === 'ignored_already_paid_here') {
      return (
        <span className="px-2 py-0.5 rounded-full bg-[#f1f4f9] text-[#8891a5] text-[10px] font-medium">
          Já quitado
        </span>
      );
    }
    if (eligibility === 'ignored_cancelled') {
      return (
        <span className="px-2 py-0.5 rounded-full bg-[#f1f4f9] text-[#8891a5] text-[10px] font-medium">
          Ignorado na simulação
        </span>
      );
    }
    if (isSimulated) {
      return (
        <span className="px-2 py-0.5 rounded-full bg-[#0064fd]/10 text-[#0064fd] text-[10px] font-semibold">
          Simulado
        </span>
      );
    }
    if (entry.certainty === 'estimated') {
      return (
        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-[#b87810] text-[10px] font-medium">
          Valor estimado
        </span>
      );
    }
    if (entry.certainty === 'uncertain') {
      return (
        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-[#b87810] text-[10px] font-medium">
          Data/valor incerto
        </span>
      );
    }
    return null;
  };

  return (
    <div
      className={`group p-3 rounded-xl transition-all ${
        isSimulated
          ? 'bg-[#0064fd]/[0.04] ring-1 ring-[#0064fd]/20'
          : isIgnored
            ? 'opacity-65 hover:opacity-95 hover:bg-[#f8f9fc]'
            : 'hover:bg-[#f8f9fc]'
      }`}
    >
      <div className="flex items-start sm:items-center justify-between gap-3">
        {/* Esquerda: Ícone Circular Suave + Título + Subtítulo */}
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
              isIgnored
                ? 'bg-[#f1f4f9] text-[#8891a5]'
                : isInflow
                  ? 'bg-[#2fc750]/12 text-[#168030]'
                  : entry.certainty === 'estimated'
                    ? 'bg-amber-500/12 text-[#b87810]'
                    : 'bg-[#f1f4f9] text-[#151a28]'
            }`}
          >
            {isInflow ? (
              <ArrowDownLeft className="w-4 h-4" />
            ) : (
              <ArrowUpRight className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className={`text-sm font-semibold text-[#151a28] leading-snug ${
                  isIgnored ? 'line-through text-[#8891a5]' : ''
                }`}
              >
                <button type="button" onClick={onOpenEditor} aria-label={`Simular ${entry.title}`} className="text-left hover:underline">{entry.title}</button>
              </h3>
              {renderStatusPill()}
            </div>

            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[#8891a5]">
              <span>{ORIGIN_LABELS[entry.origin]}</span>
              <span>·</span>
              <span>{entry.category}</span>
              {entry.effectiveDate !== entry.dueDate && (
                <>
                  <span>·</span>
                  <span className="text-[#0064fd] font-medium">
                    Venc. original {formatShortDatePT(entry.dueDate)} →{' '}
                    {formatShortDatePT(entry.effectiveDate)}
                  </span>
                </>
              )}
            </div>

            {/* Nota de Duplicidade Evitada */}
            {eligibility === 'deduplicated' && (
              <p
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-[#525b6e] pt-1"
              >
                Identificado como mesmo compromisso de{' '}
                <strong className="text-[#151a28]">"{deduplicatedOfTitle}"</strong>.{' '}
                <button
                  type="button"
                  onClick={onForceIncludeDuplicate}
                  className="text-[#0064fd] font-medium hover:underline cursor-pointer"
                >
                  Descontar mesmo assim
                </button>
              </p>
            )}

            {/* Aviso de Encargos por Simulação Após o Vencimento */}
            {triggersLatePenaltyWarning && (
              <div className="inline-flex items-center gap-1.5 text-[11px] text-[#b87810] pt-1 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-[#e8a020] shrink-0" />
                <span>
                  {daysDelayed} dia(s) após o vencimento (
                  {formatShortDatePT(entry.dueDate)}) — sujeito a multa/juros.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Direita: Valor Tabular + Atalho Rápido Discreto */}
        <div
          className="flex flex-col items-end gap-1.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5">
            {originalEntry && originalEntry.amountCents !== entry.amountCents && (
              <span className="text-xs font-mono-tabular text-[#8891a5] line-through">
                {formatBRL(originalEntry.amountCents)}
              </span>
            )}
            <div
              className={`text-sm sm:text-[15px] font-semibold ${
                isIgnored
                  ? 'line-through text-[#8891a5]'
                  : isInflow
                    ? 'text-[#168030]'
                    : 'text-[#151a28]'
              }`}
            >
              <CurrencyDisplay
                cents={isInflow ? entry.amountCents : -entry.amountCents}
                showPlusSign={isInflow}
              />
            </div>
            <ChevronRight
              aria-hidden="true"
              className="w-4 h-4 text-[#8891a5] group-hover:text-[#0064fd] transition-colors"
            />
          </div>

          {/* Apenas 1 atalho contextual limpo para ação rápida em 1 toque */}
          <div className="flex items-center gap-1.5">
            {isSimulated ? (
              <button
                type="button"
                onClick={onResetItem}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0064fd]/10 hover:bg-[#0064fd]/15 text-[#0064fd] text-[11px] font-medium transition-colors cursor-pointer"
                title="Restaurar lançamento original"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restaurar</span>
              </button>
            ) : !isInflow && eligibility === 'included' ? (
              canPostponeToSalary && nextSalaryDate && entry.certainty === 'confirmed' ? (
                <button
                  type="button"
                  onClick={() => onQuickPostponeToSalary(nextSalaryDate)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#f1f4f9] hover:bg-[#e6ebf3] text-[#525b6e] hover:text-[#151a28] text-[11px] font-medium transition-colors cursor-pointer"
                >
                  <Clock className="w-3 h-3 text-[#0064fd]" />
                  <span>Simular em {formatShortDatePT(nextSalaryDate)}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onQuickMarkOtherBank}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#f1f4f9] hover:bg-[#e6ebf3] text-[#525b6e] hover:text-[#151a28] text-[11px] font-medium transition-colors cursor-pointer"
                >
                  <span>Pago em outro banco</span>
                </button>
              )
            ) : isInflow && entry.certainty === 'uncertain' ? (
              <button
                type="button"
                onClick={onQuickConfirmUncertain}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/18 text-[#b87810] text-[11px] font-medium transition-colors cursor-pointer"
              >
                <Check className="w-3 h-3" />
                <span>Testar confirmação</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
