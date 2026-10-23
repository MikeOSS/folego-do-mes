import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  Info,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useFinancialStore } from '../state/useFinancialStore';
import {
  CertaintyLevel,
  EntryOrigin,
  EntryStatus,
  EntryType,
} from '../domain/types';
import { validateMoneyInput } from '../lib/financial-input';
import { addDaysISO, compareISODates, formatShortDatePT } from '../domain/date';
import { shouldTriggerLatePenalty } from '../domain/engine';
import { AccessibleDialog } from './ui/AccessibleDialog';

interface SimulatorSheetProps {
  isCreatingNew: boolean;
  onCloseCreateNew: () => void;
}

export const SimulatorSheet: React.FC<SimulatorSheetProps> = ({
  isCreatingNew,
  onCloseCreateNew,
}) => {
  const {
    activeScenario,
    activeProjection,
    editingEntryId,
    setEditingEntryId,
    entryOverrides,
    updateEntryOverride,
    resetEntryOverride,
    addSimulatedEntry,
    addedEntries,
    removeSimulatedEntry,
  } = useFinancialStore();

  const evaluatedTarget = useMemo(() => {
    if (!editingEntryId) return null;
    return (
      activeProjection.evaluatedEntries.find(
        (ev) => ev.entry.id === editingEntryId
      ) ?? null
    );
  }, [editingEntryId, activeProjection.evaluatedEntries]);

  const isAddedByUser = useMemo(() => {
    if (!editingEntryId) return false;
    return addedEntries.some((e) => e.id === editingEntryId);
  }, [editingEntryId, addedEntries]);

  const nextSalaryDate = useMemo(() => {
    const nextInflow = activeProjection.evaluatedEntries.find(
      (ev) =>
        ev.eligibility === 'included' &&
        ev.entry.type === 'inflow' &&
        ev.entry.certainty === 'confirmed'
    );
    return nextInflow ? nextInflow.projectedDate : null;
  }, [activeProjection.evaluatedEntries]);

  const [title, setTitle] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('2026-11-10');
  const [type, setType] = useState<EntryType>('outflow');
  const [certainty, setCertainty] = useState<CertaintyLevel>('confirmed');
  const [status, setStatus] = useState<EntryStatus>('pending');
  const [origin, setOrigin] = useState<EntryOrigin>('manual');
  const [affectsMonitoredAccount, setAffectsMonitoredAccount] = useState(true);
  const formId = useId();
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setFormError(null);
    if (evaluatedTarget) {
      const e = evaluatedTarget.entry;
      setTitle(e.title);
      setAmountInput((e.amountCents / 100).toFixed(2).replace('.', ','));
      setEffectiveDate(e.effectiveDate);
      setType(e.type);
      setCertainty(e.certainty);
      setStatus(e.status);
      setOrigin(e.origin);
      setAffectsMonitoredAccount(e.affectsMonitoredAccount);
    } else if (isCreatingNew) {
      setTitle('');
      setAmountInput('250,00');
      setEffectiveDate(
        addDaysISO(activeScenario.snapshot.referenceDate, 7)
      );
      setType('outflow');
      setCertainty('estimated');
      setStatus('pending');
      setOrigin('manual');
      setAffectsMonitoredAccount(true);
    }
  }, [evaluatedTarget, isCreatingNew, activeScenario.snapshot.referenceDate]);

  const isOpen = Boolean(evaluatedTarget) || isCreatingNew;

  const handleClose = () => {
    setEditingEntryId(null);
    onCloseCreateNew();
  };

  const handleApplyChanges = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedCents = validateMoneyInput(amountInput);
    if (parsedCents === null || parsedCents <= 0) {
      setFormError('Informe um valor maior que zero, até R$ 100 milhões, com até duas casas decimais. Exemplo: 250,00.');
      return;
    }

    if (isCreatingNew) {
      addSimulatedEntry({
        title: title.trim() || 'Compromisso Simulado',
        category: type === 'inflow' ? 'Entrada Simulada' : 'Despesa Simulada',
        amountCents: parsedCents,
        dueDate: effectiveDate,
        effectiveDate,
        type,
        certainty,
        status,
        origin,
        affectsMonitoredAccount,
      });
      handleClose();
      return;
    }

    if (evaluatedTarget) {
      updateEntryOverride(evaluatedTarget.entry.id, {
        title: title.trim() || evaluatedTarget.entry.title,
        amountCents: parsedCents,
        effectiveDate,
        certainty,
        status,
        origin,
        affectsMonitoredAccount,
      });
      handleClose();
    }
  };

  const previewLatePenalty =
    evaluatedTarget !== null &&
    shouldTriggerLatePenalty({
      ...evaluatedTarget.entry,
      effectiveDate,
      certainty,
      origin,
    });

  return (
    <AnimatePresence>
      {isOpen && (
        <AccessibleDialog open={isOpen} onClose={handleClose} labelledBy="simulator-sheet-title" className="simulator-dialog">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full min-w-0 max-w-lg bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[90dvh] flex flex-col"
          >
            {/* Cabeçalho Limpo e Luminoso */}
            <div className="px-5 py-4 flex shrink-0 items-center justify-between gap-2 border-b border-[#151a28]/8">
              <div className="min-w-0">
                <span className="text-[11px] font-mono-tabular uppercase tracking-[0.12em] text-[#0064fd] font-semibold block">
                  {isCreatingNew
                    ? 'Simular Nova Movimentação'
                    : 'Simular Ajuste de Compromisso'}
                </span>
                <h2
                  id="simulator-sheet-title"
                  className="text-base sm:text-lg font-bold tracking-[-0.02em] text-[#151a28] truncate"
                >
                  {isCreatingNew
                    ? 'Adicionar lançamento hipotético'
                    : evaluatedTarget?.entry.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={handleClose}
                aria-label="Fechar painel de simulação"
                className="p-2 rounded-full bg-[#f1f4f9] hover:bg-[#e6ebf3] text-[#525b6e] transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Nota de Segurança e Escopo */}
            <div className="px-5 py-2.5 shrink-0 bg-[#f8f9fc] border-b border-[#151a28]/6 flex items-start gap-2 text-xs text-[#525b6e]">
              <Info className="w-3.5 h-3.5 text-[#0064fd] shrink-0 mt-0.5" />
              <span>
                Alterações simuladas recalculam seu fôlego na hora, mas{' '}
                <strong className="text-[#151a28]">
                  não cancelam nem pagam boletos reais
                </strong>
                .
              </span>
            </div>

            <form
              onSubmit={handleApplyChanges}
              className="p-5 min-h-0 overflow-y-auto space-y-4 text-xs sm:text-sm"
            >
              {/* Atalhos Rápidos de 1 Toque */}
              {!isCreatingNew && evaluatedTarget && (
                <div className="space-y-2 pb-3.5 border-b border-[#151a28]/8">
                  <span className="text-[11px] font-medium text-[#8891a5] block">
                    Testar decisão com 1 toque:
                  </span>

                  <div className="flex flex-wrap gap-2">
                    {evaluatedTarget.entry.type === 'outflow' && (
                      <button
                        type="button"
                        onClick={() => {
                          updateEntryOverride(evaluatedTarget.entry.id, {
                            status: 'paid_other_bank',
                          });
                          handleClose();
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#2fc750]/12 hover:bg-[#2fc750]/20 text-[#168030] font-semibold text-xs transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Já paguei por outro banco</span>
                      </button>
                    )}

                    {evaluatedTarget.entry.type === 'outflow' &&
                      nextSalaryDate &&
                      compareISODates(evaluatedTarget.entry.effectiveDate, nextSalaryDate) <
                        0 && (
                        <button
                          type="button"
                          onClick={() => {
                            updateEntryOverride(evaluatedTarget.entry.id, {
                              effectiveDate: nextSalaryDate,
                            });
                            handleClose();
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#0064fd]/10 hover:bg-[#0064fd]/16 text-[#0064fd] font-semibold text-xs transition-colors cursor-pointer"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            Simular em {formatShortDatePT(nextSalaryDate)} (após entrada)
                          </span>
                        </button>
                      )}

                    {evaluatedTarget.entry.certainty === 'estimated' && (
                      <button
                        type="button"
                        onClick={() => {
                          const halfCents = Math.round(
                            evaluatedTarget.entry.amountCents * 0.5
                          );
                          updateEntryOverride(evaluatedTarget.entry.id, {
                            amountCents: halfCents,
                          });
                          handleClose();
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-amber-500/12 hover:bg-amber-500/20 text-[#b87810] font-semibold text-xs transition-colors cursor-pointer"
                      >
                        <span>Reduzir gasto estimado em 50%</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Seletor Saída vs Entrada (Ao criar novo) */}
              {isCreatingNew && (
                <div>
                  <span id={`${formId}-type`} className="block text-xs font-semibold text-[#151a28] mb-1.5">
                    Tipo de movimentação
                  </span>
                  <div role="group" aria-labelledby={`${formId}-type`} className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#f1f4f9]">
                    <button
                      type="button"
                      aria-pressed={type === 'outflow'}
                      onClick={() => { setType('outflow'); if (certainty === 'uncertain') setCertainty('confirmed'); }}
                      className={`py-2 px-3 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
                        type === 'outflow'
                          ? 'bg-white text-[#151a28] shadow-xs'
                          : 'text-[#525b6e] hover:text-[#151a28]'
                      }`}
                    >
                      Saída / Conta (−)
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('inflow')}
                      aria-pressed={type === 'inflow'}
                      className={`py-2 px-3 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
                        type === 'inflow'
                          ? 'bg-white text-[#168030] shadow-xs'
                          : 'text-[#525b6e] hover:text-[#151a28]'
                      }`}
                    >
                      Entrada / Recebimento (+)
                    </button>
                  </div>
                </div>
              )}

              {/* Descrição */}
              <div>
                <label htmlFor={`${formId}-title`} className="block text-xs font-semibold text-[#151a28] mb-1">
                  Descrição
                </label>
                <input
                  id={`${formId}-title`}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Ex: Conta de Luz, Supermercado, Freela..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#151a28]/12 bg-[#f8f9fc] focus:bg-white text-[#151a28] text-sm focus:outline-none focus:border-[#0064fd] transition-colors"
                />
              </div>

              {/* Valor e Data */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`${formId}-amount`} className="block text-xs font-semibold text-[#151a28] mb-1">
                    Valor (R$)
                  </label>
                  <input
                    id={`${formId}-amount`}
                    aria-invalid={Boolean(formError)}
                    aria-describedby={formError ? `${formId}-error` : undefined}
                    type="text"
                    inputMode="decimal"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#151a28]/12 bg-[#f8f9fc] focus:bg-white text-[#151a28] font-mono-tabular font-semibold text-sm focus:outline-none focus:border-[#0064fd] transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor={`${formId}-date`} className="block text-xs font-semibold text-[#151a28] mb-1">
                    Data na simulação
                  </label>
                  <input
                    id={`${formId}-date`}
                    type="date"
                    value={effectiveDate}
                    min={activeScenario.snapshot.referenceDate}
                    max={addDaysISO(
                      activeScenario.snapshot.referenceDate,
                      activeScenario.snapshot.horizonDays
                    )}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#151a28]/12 bg-[#f8f9fc] focus:bg-white text-[#151a28] font-mono-tabular text-sm focus:outline-none focus:border-[#0064fd] transition-colors"
                  />
                </div>
              </div>

              {/* Aviso de Multa/Juros se postergar conta confirmada */}
              {previewLatePenalty && evaluatedTarget && (
                <div className="p-3.5 rounded-xl bg-amber-500/8 border border-amber-500/20 flex items-start gap-2.5 text-xs text-[#b87810]">
                  <AlertTriangle className="w-4 h-4 text-[#e8a020] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#151a28]">
                      Atenção ao vencimento original (
                      {formatShortDatePT(evaluatedTarget.entry.dueDate)}):
                    </strong>{' '}
                    pagar compromissos confirmados após o vencimento pode gerar multa e
                    juros. Use apenas para comparar o impacto no caixa.
                  </div>
                </div>
              )}

              {/* Status e Certeza */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`${formId}-status`} className="block text-xs font-semibold text-[#151a28] mb-1">
                    Situação do pagamento
                  </label>
                  <select
                    id={`${formId}-status`}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as EntryStatus)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#151a28]/12 bg-[#f8f9fc] text-[#151a28] text-xs font-medium focus:outline-none focus:border-[#0064fd]"
                  >
                    <option value="pending">Pendente (entra na conta)</option>
                    <option value="paid_other_bank">
                      Pago por outro banco (não desconta)
                    </option>
                    <option value="paid_here">Já quitado nesta conta</option>
                    <option value="cancelled">Ignorar na simulação</option>
                  </select>
                </div>

                <div>
                  <label htmlFor={`${formId}-certainty`} className="block text-xs font-semibold text-[#151a28] mb-1">
                    Grau de certeza
                  </label>
                  <select
                    id={`${formId}-certainty`}
                    value={certainty}
                    onChange={(e) => setCertainty(e.target.value as CertaintyLevel)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#151a28]/12 bg-[#f8f9fc] text-[#151a28] text-xs font-medium focus:outline-none focus:border-[#0064fd]"
                  >
                    <option value="confirmed">Confirmado (valor e data fixos)</option>
                    <option value="estimated">Estimado (gasto variável)</option>
                    {type === 'inflow' && (
                      <option value="uncertain">Recebimento incerto</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Origem & Conta Monitorada */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label htmlFor={`${formId}-origin`} className="block text-xs font-semibold text-[#151a28] mb-1">
                    Origem do registro
                  </label>
                  <select
                    id={`${formId}-origin`}
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value as EntryOrigin)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#151a28]/12 bg-[#f8f9fc] text-[#151a28] text-xs font-medium focus:outline-none focus:border-[#0064fd]"
                  >
                    <option value="dda">DDA (Boleto Registrado)</option>
                    <option value="debito_automatico">Débito Automático</option>
                    <option value="pix_agendado">Pix Agendado</option>
                    <option value="recorrente_historico">Média Histórica</option>
                    <option value="folha_pagamento">Folha de Pagamento</option>
                    <option value="manual">Lembrete Manual</option>
                  </select>
                </div>

                <label className="flex items-center gap-2.5 pt-4 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={affectsMonitoredAccount}
                    onChange={(e) => setAffectsMonitoredAccount(e.target.checked)}
                    className="w-4 h-4 accent-[#0064fd] rounded"
                  />
                  <span className="text-xs font-medium text-[#151a28]">
                    Desconta desta conta monitorada
                  </span>
                </label>
              </div>

              {/* Rodapé do Modal */}
              {formError && <p id={`${formId}-error`} role="alert" className="text-sm text-[#c93535]">{formError}</p>}
              <div className="pt-4 border-t border-[#151a28]/8 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {!isCreatingNew &&
                    evaluatedTarget &&
                    entryOverrides[evaluatedTarget.entry.id] && (
                      <button
                        type="button"
                        onClick={() => {
                          resetEntryOverride(evaluatedTarget.entry.id);
                          handleClose();
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#f1f4f9] hover:bg-[#e6ebf3] text-[#151a28] text-xs font-semibold cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restaurar original</span>
                      </button>
                    )}

                  {isAddedByUser && evaluatedTarget && (
                    <button
                      type="button"
                      onClick={() => {
                        removeSimulatedEntry(evaluatedTarget.entry.id);
                        handleClose();
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-rose-500/10 hover:bg-rose-500/18 text-[#c93535] text-xs font-semibold cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 rounded-full text-[#525b6e] hover:text-[#151a28] hover:bg-[#f1f4f9] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-full bg-[#0064fd] hover:bg-[#0052d0] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                  >
                    {isCreatingNew ? 'Adicionar à simulação' : 'Aplicar simulação'}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </AccessibleDialog>
      )}
    </AnimatePresence>
  );
};
