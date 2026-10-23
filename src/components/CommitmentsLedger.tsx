import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Clock,
  CopyCheck,
  Plus,
  RotateCcw,
  SlidersHorizontal,
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
  folha_pagamento: 'Folha / Salário',
  recorrente_historico: 'Média Histórica',
  manual: 'Lançamento Manual',
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

  // Mapa dos lançamentos originais para mostrar valores/datas tachados quando simulados
  const originalEntriesById = useMemo(() => {
    const map = new Map<string, (typeof activeScenario.entries)[number]>();
    for (const e of activeScenario.entries) {
      map.set(e.id, e);
    }
    return map;
  }, [activeScenario.entries]);

  // Próximo recebimento confirmado para sugerir adiamento inteligente em 1 toque
  const nextSalaryDate: ISODateString | null = useMemo(() => {
    const nextInflow = evaluatedEntries.find(
      (ev) =>
        ev.eligibility === 'included' &&
        ev.entry.type === 'inflow' &&
        ev.entry.certainty === 'confirmed'
    );
    return nextInflow ? nextInflow.projectedDate : null;
  }, [evaluatedEntries]);

  // Dias que contêm lançamentos (filtrados conforme o chip ativo)
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
      className="tactile-card rounded-[12px] p-4 sm:p-6 space-y-5"
    >
      {/* Cabeçalho + Botão de Adicionar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DCE3EA] pb-3.5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#475869]">
            Gerenciamento & Simulação Interativa
          </span>
          <h2 className="text-base sm:text-lg font-bold text-[#091521]">
            Linha do Tempo de Compromissos ({evaluatedEntries.length})
          </h2>
        </div>

        <button
          type="button"
          onClick={onOpenNewEntryModal}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-[6px] bg-[#0052CC] hover:bg-[#0043A6] text-white text-xs font-semibold transition-colors min-h-[40px] cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Adicionar compromisso</span>
        </button>
      </div>

      {/* Filtros Rápidos (Alvos de toque >= 40px) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {(
          [
            { id: 'all', label: 'Todos os lançamentos' },
            { id: 'outflows', label: 'Saídas / Contas' },
            { id: 'inflows', label: 'Recebimentos' },
            { id: 'estimated_or_uncertain', label: 'Estimados & Incertos' },
          ] as const
        ).map((tab) => {
          const isActive = filterMode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setFilterMode(tab.id)}
              className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold border transition-colors min-h-[38px] shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[#091521] border-[#091521] text-white'
                  : 'bg-[#F4F6F8] border-[#DCE3EA] text-[#475869] hover:text-[#091521] hover:bg-[#E8ECEF]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Lista Agrupada por Data com Saldo Acumulado */}
      {groupedDays.length === 0 ? (
        <div className="rounded-[8px] border border-[#DCE3EA] bg-[#F4F6F8] p-8 text-center space-y-2">
          <p className="text-sm font-semibold text-[#091521]">
            Nenhuma movimentação encontrada para este filtro
          </p>
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className="text-xs font-semibold text-[#0052CC] hover:underline cursor-pointer"
          >
            Mostrar todos os compromissos
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedDays.map(({ day, entries }) => {
            const isSelectedDay = selectedDate === day.date;
            const isFirstDeficitDay = metrics.firstShortfallDate === day.date;
            const isClosingNegative = day.closingProjectedCents < 0;

            return (
              <div
                key={day.date}
                id={`ledger-day-${day.date}`}
                onClick={() => setSelectedDate(day.date)}
                className={`rounded-[10px] border transition-all overflow-hidden ${
                  isSelectedDay
                    ? 'border-[#0052CC] ring-2 ring-[#0052CC]/15'
                    : isClosingNegative
                      ? 'border-rose-300'
                      : 'border-[#DCE3EA]'
                }`}
              >
                {/* Barra de Cabeçalho do Dia + Saldo Projetado Após as Contas do Dia */}
                <div
                  className={`px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b ${
                    isClosingNegative
                      ? 'bg-rose-50/90 border-rose-200'
                      : day.intradayTimingRisk
                        ? 'bg-amber-50/90 border-amber-200'
                        : 'bg-[#EEF2F5] border-[#DCE3EA]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono-tabular text-xs font-bold uppercase text-[#091521]">
                      {formatShortDatePT(day.date)} • {getWeekdayShortPT(day.date)}
                    </span>

                    {isFirstDeficitDay && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#DC2626] text-white text-[10px] font-mono-tabular font-bold uppercase">
                        <AlertOctagon className="w-3 h-3" />
                        1ª Insuficiência
                      </span>
                    )}
                  </div>

                  {activeProjection.alertStatus !== 'INSUFFICIENT_DATA' && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-[#475869]">Saldo no fim do dia:</span>
                      <span
                        className={`font-mono-tabular font-bold px-2 py-0.5 rounded-[4px] border ${
                          isClosingNegative
                            ? 'bg-rose-100 border-rose-300 text-[#991B1B]'
                            : 'bg-white border-[#DCE3EA] text-[#00875A]'
                        }`}
                      >
                        {formatBRL(day.closingProjectedCents, { showPlusSign: true })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Fita de Alerta Intradiário (Mesmo Dia) */}
                {day.intradayTimingRisk && (
                  <div className="px-3.5 py-2 bg-amber-50 border-b border-amber-200 flex items-start gap-2 text-xs text-[#92400E]">
                    <Zap className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <strong>Atenção ao horário bancário neste dia:</strong> os débitos
                      confirmados ({formatBRL(day.confirmedOutflowsCents)}) superam o saldo
                      da manhã ({formatBRL(day.openingConfirmedCents)}). Garanta que o
                      recebimento de {formatBRL(day.confirmedInflowsCents)} caia antes do
                      processamento do débito automático.
                    </div>
                  </div>
                )}

                {/* Linhas dos Compromissos do Dia */}
                <div className="divide-y divide-[#DCE3EA] bg-white">
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

  return (
    <div
      className={`p-3.5 sm:px-4 transition-colors relative ${
        isSimulated
          ? 'bg-indigo-50/35 border-l-4 border-l-indigo-600'
          : isIgnored
            ? 'bg-[#F8FAFC] opacity-80'
            : 'hover:bg-[#F8FAFC]'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Esquerda: Ícone + Título + Metadados Compactos */}
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-8 h-8 rounded-[6px] flex items-center justify-center shrink-0 mt-0.5 border ${
              isIgnored
                ? 'bg-slate-100 border-slate-300 text-slate-500'
                : isInflow
                  ? 'bg-[#E6F6F0] border-[#00875A]/30 text-[#00875A]'
                  : entry.certainty === 'estimated'
                    ? 'bg-amber-50 border-amber-300 text-[#92400E]'
                    : 'bg-slate-100 border-slate-300 text-[#091521]'
            }`}
          >
            {isInflow ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3
                className={`text-sm font-bold text-[#091521] leading-snug ${
                  isIgnored ? 'line-through text-[#475869]' : ''
                }`}
              >
                {entry.title}
              </h3>

              {/* Badges Técnicos de Exceção */}
              {entry.certainty === 'estimated' && (
                <span className="px-1.5 py-0.5 rounded-[4px] bg-amber-100 border border-amber-300 text-[#92400E] text-[10px] font-mono-tabular font-bold uppercase">
                  Estimado
                </span>
              )}

              {entry.certainty === 'uncertain' && (
                <span className="px-1.5 py-0.5 rounded-[4px] bg-amber-100 border border-amber-400 text-[#92400E] text-[10px] font-mono-tabular font-bold uppercase">
                  Recebimento Incerto
                </span>
              )}

              {eligibility === 'deduplicated' && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-slate-200 border border-slate-300 text-slate-700 text-[10px] font-mono-tabular font-bold uppercase">
                  <CopyCheck className="w-3 h-3" />
                  Duplicidade Ignorada
                </span>
              )}

              {eligibility === 'ignored_other_bank' && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-emerald-100 border border-emerald-300 text-[#006644] text-[10px] font-mono-tabular font-bold uppercase">
                  <Check className="w-3 h-3" />
                  Pago em Outro Banco (Simulado)
                </span>
              )}

              {eligibility === 'ignored_already_paid_here' && (
                <span className="px-1.5 py-0.5 rounded-[4px] bg-slate-200 text-slate-700 text-[10px] font-mono-tabular font-bold uppercase">
                  Já Quitado
                </span>
              )}

              {eligibility === 'ignored_cancelled' && (
                <span className="px-1.5 py-0.5 rounded-[4px] bg-slate-200 text-slate-700 text-[10px] font-mono-tabular font-bold uppercase">
                  Ignorado na Simulação
                </span>
              )}

              {isSimulated && (
                <span className="px-1.5 py-0.5 rounded-[4px] bg-indigo-100 border border-indigo-300 text-indigo-800 text-[10px] font-mono-tabular font-bold uppercase">
                  Editado
                </span>
              )}
            </div>

            {/* Subtítulo: Origem + Categoria + Comparativo de Vencimento Original */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#475869]">
              <span>{ORIGIN_LABELS[entry.origin]}</span>
              <span>•</span>
              <span>{entry.category}</span>
              {entry.effectiveDate !== entry.dueDate && (
                <>
                  <span>•</span>
                  <span className="text-indigo-700 font-mono-tabular font-semibold">
                    Venc. original: {formatShortDatePT(entry.dueDate)} → Simulado:{' '}
                    {formatShortDatePT(entry.effectiveDate)}
                  </span>
                </>
              )}
            </div>

            {/* Explicação de Deduplicação */}
            {eligibility === 'deduplicated' && (
              <p className="text-xs text-[#475869] bg-slate-100 border border-slate-200 rounded-[5px] px-2.5 py-1">
                Não descontado duas vezes: identificado como duplicata de{' '}
                <strong>"{deduplicatedOfTitle}"</strong>.{' '}
                <button
                  type="button"
                  onClick={onForceIncludeDuplicate}
                  className="text-[#0052CC] font-semibold hover:underline ml-1 cursor-pointer"
                >
                  Considerar mesmo assim
                </button>
              </p>
            )}

            {/* Advertência de Multa/Juros em Simulação Posterior ao Vencimento */}
            {triggersLatePenaltyWarning && (
              <div className="inline-flex items-center gap-1.5 text-[11px] text-[#92400E] bg-amber-50 border border-amber-300 rounded-[5px] px-2.5 py-1 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  Simulação {daysDelayed} dia(s) após o vencimento original (
                  {formatShortDatePT(entry.dueDate)}): atenção a possíveis multas, juros ou
                  encargos.
                </span>
              </div>
            )}

            {entry.notes && !isSimulated && eligibility === 'included' && (
              <p className="text-xs text-[#475869] italic">{entry.notes}</p>
            )}
          </div>
        </div>

        {/* Direita: Valor Tabular + Botão de Simular/Editar */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-[#EEF2F5]">
          <div className="text-right">
            {originalEntry && originalEntry.amountCents !== entry.amountCents && (
              <div className="text-[11px] font-mono-tabular text-[#7A8C9E] line-through">
                {formatBRL(originalEntry.amountCents)}
              </div>
            )}
            <div
              className={`text-sm sm:text-base font-bold ${
                isIgnored
                  ? 'line-through text-[#7A8C9E]'
                  : isInflow
                    ? 'text-[#00875A]'
                    : 'text-[#091521]'
              }`}
            >
              <CurrencyDisplay
                cents={isInflow ? entry.amountCents : -entry.amountCents}
                showPlusSign={isInflow}
              />
            </div>
          </div>

          {/* Ações Rápidas de 1 Toque + Botão de Ajuste Completo */}
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {!isInflow && eligibility !== 'deduplicated' && (
              <button
                type="button"
                aria-pressed={entry.status === 'paid_other_bank'}
                onClick={onQuickMarkOtherBank}
                className={`px-2.5 py-1.5 rounded-[5px] text-[11px] font-semibold border transition-colors min-h-[38px] sm:min-h-[34px] cursor-pointer ${
                  entry.status === 'paid_other_bank'
                    ? 'bg-emerald-50 border-emerald-300 text-[#006644]'
                    : 'bg-[#F4F6F8] border-[#DCE3EA] text-[#475869] hover:text-[#091521] hover:bg-[#E6ECF2]'
                }`}
                title="Simular que esta conta foi paga por outra instituição"
              >
                {entry.status === 'paid_other_bank'
                  ? '✓ Pago outro banco'
                  : 'Pago outro banco'}
              </button>
            )}

            {canPostponeToSalary && nextSalaryDate && (
              <button
                type="button"
                onClick={() => onQuickPostponeToSalary(nextSalaryDate)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[5px] bg-[#F4F6F8] hover:bg-[#E6ECF2] border border-[#DCE3EA] text-[11px] font-semibold text-[#091521] transition-colors min-h-[38px] sm:min-h-[34px] cursor-pointer"
                title={`Simular pagamento no dia do recebimento (${formatShortDatePT(nextSalaryDate)})`}
              >
                <Clock className="w-3 h-3 text-[#0052CC]" />
                <span>Simular em {formatShortDatePT(nextSalaryDate)}</span>
              </button>
            )}

            {isInflow && entry.certainty === 'uncertain' && (
              <button
                type="button"
                onClick={onQuickConfirmUncertain}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[5px] bg-amber-50 hover:bg-amber-100 border border-amber-300 text-[11px] font-semibold text-[#92400E] transition-colors min-h-[38px] sm:min-h-[34px] cursor-pointer"
              >
                <Check className="w-3 h-3" />
                <span>Simular confirmação</span>
              </button>
            )}

            {isSimulated && (
              <button
                type="button"
                onClick={onResetItem}
                aria-label="Desfazer alteração neste item"
                className="p-1.5 rounded-[5px] bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 min-h-[38px] min-w-[38px] sm:min-h-[34px] sm:min-w-[34px] flex items-center justify-center cursor-pointer"
                title="Restaurar valor original deste compromisso"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={onOpenEditor}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[5px] bg-white hover:bg-[#F4F6F8] border border-[#B8C5D1] text-[11px] font-bold text-[#091521] transition-colors min-h-[38px] sm:min-h-[34px] cursor-pointer"
            >
              <SlidersHorizontal className="w-3 h-3 text-[#0052CC]" />
              <span>Ajustar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
