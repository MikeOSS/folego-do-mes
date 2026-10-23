import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  Lock,
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
import { parseBRLInputToCents } from '../domain/money';
import { addDaysISO, compareISODates, formatShortDatePT } from '../domain/date';
import { shouldTriggerLatePenalty } from '../domain/engine';

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

  // Estado local do formulário (para edição ou criação)
  const [title, setTitle] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('2026-11-10');
  const [type, setType] = useState<EntryType>('outflow');
  const [certainty, setCertainty] = useState<CertaintyLevel>('confirmed');
  const [status, setStatus] = useState<EntryStatus>('pending');
  const [origin, setOrigin] = useState<EntryOrigin>('manual');
  const [affectsMonitoredAccount, setAffectsMonitoredAccount] = useState(true);

  useEffect(() => {
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

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingEntryId(null);
        onCloseCreateNew();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, setEditingEntryId, onCloseCreateNew]);

  const handleApplyChanges = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedCents = parseBRLInputToCents(amountInput);
    if (parsedCents === null || parsedCents <= 0) return;

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

  // Verifica se a data escolhida no formulário é posterior ao vencimento original
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
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#061826]/65 backdrop-blur-[2px] p-0 sm:p-4"
          onClick={handleClose}
        >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="simulator-sheet-title"
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-white rounded-t-[16px] sm:rounded-[12px] border border-[#DCE3EA] shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col"
        >
          {/* Cabeçalho Tátil Escuro */}
          <div className="bg-[#061826] text-white px-4 py-3.5 sm:px-5 flex items-center justify-between border-b border-[#163A54]">
            <div>
              <span className="text-[10px] font-mono-tabular uppercase tracking-wider text-[#00E58F] font-bold block">
                {isCreatingNew
                  ? 'Simular Nova Movimentação'
                  : 'Simulador & Correção de Compromisso'}
              </span>
              <h2 id="simulator-sheet-title" className="text-base font-bold truncate">
                {isCreatingNew
                  ? 'Adicionar lançamento hipotético'
                  : evaluatedTarget?.entry.title}
              </h2>
            </div>

            <button
              type="button"
              onClick={handleClose}
              aria-label="Fechar painel de simulação"
              className="p-2 rounded-[6px] bg-[#0C2538] hover:bg-[#163A54] text-slate-300 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Aviso de Segurança: Simulação vs. Pagamento Real */}
          <div className="px-4 py-2.5 sm:px-5 bg-indigo-50 border-b border-indigo-200 flex items-start gap-2 text-xs text-indigo-950">
            <Lock className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
            <span>
              <strong>Apenas simulação:</strong> alterações feitas aqui atualizam o cálculo
              de fôlego instantaneamente, mas{' '}
              <strong>não cancelam nem alteram agendamentos bancários reais</strong>.
            </span>
          </div>

          <form
            onSubmit={handleApplyChanges}
            className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-sm"
          >
            {/* Atalhos Táteis de 1 Toque (Quick-Sim Pills) para itens existentes */}
            {!isCreatingNew && evaluatedTarget && (
              <div className="space-y-2 pb-3 border-b border-[#DCE3EA]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#475869] block">
                  Atalhos rápidos de simulação (1 toque):
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
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[6px] bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-[#006644] font-semibold text-xs min-h-[40px] cursor-pointer"
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
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[6px] bg-[#EEF2F5] hover:bg-[#E2E8F0] border border-[#B8C5D1] text-[#091521] font-semibold text-xs min-h-[40px] cursor-pointer"
                      >
                        <Calendar className="w-3.5 h-3.5 text-[#0052CC]" />
                        <span>
                          Simular no dia do recebimento ({formatShortDatePT(nextSalaryDate)})
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
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[6px] bg-amber-50 hover:bg-amber-100 border border-amber-300 text-[#92400E] font-semibold text-xs min-h-[40px] cursor-pointer"
                    >
                      <span>Reduzir gasto estimado em 50%</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Tipo (Apenas ao criar novo) */}
            {isCreatingNew && (
              <div>
                <label className="block text-xs font-bold text-[#091521] mb-1.5">
                  Tipo de movimentação
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('outflow')}
                    className={`py-2 px-3 rounded-[6px] font-semibold text-xs border cursor-pointer min-h-[40px] ${
                      type === 'outflow'
                        ? 'bg-[#091521] border-[#091521] text-white'
                        : 'bg-[#F4F6F8] border-[#DCE3EA] text-[#475869]'
                    }`}
                  >
                    Saída / Compromisso (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('inflow')}
                    className={`py-2 px-3 rounded-[6px] font-semibold text-xs border cursor-pointer min-h-[40px] ${
                      type === 'inflow'
                        ? 'bg-[#00875A] border-[#00875A] text-white'
                        : 'bg-[#F4F6F8] border-[#DCE3EA] text-[#475869]'
                    }`}
                  >
                    Recebimento / Entrada (+)
                  </button>
                </div>
              </div>
            )}

            {/* Descrição */}
            <div>
              <label className="block text-xs font-bold text-[#091521] mb-1">
                Descrição do compromisso
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Ex: Conta de Luz, Supermercado, Freela..."
                className="w-full px-3 py-2 rounded-[6px] border border-[#B8C5D1] text-[#091521] text-sm focus:outline-none focus:border-[#0052CC]"
              />
            </div>

            {/* Valor e Data */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#091521] mb-1">
                  Valor (R$)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-[6px] border border-[#B8C5D1] text-[#091521] font-mono-tabular font-semibold text-sm focus:outline-none focus:border-[#0052CC]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#091521] mb-1">
                  Data considerada na simulação
                </label>
                <input
                  type="date"
                  value={effectiveDate}
                  min={activeScenario.snapshot.referenceDate}
                  max={addDaysISO(
                    activeScenario.snapshot.referenceDate,
                    activeScenario.snapshot.horizonDays
                  )}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-[6px] border border-[#B8C5D1] text-[#091521] font-mono-tabular text-sm focus:outline-none focus:border-[#0052CC]"
                />
              </div>
            </div>

            {/* Advertência imediata se simular pagamento após o vencimento */}
            {previewLatePenalty && evaluatedTarget && (
              <div className="p-3 rounded-[6px] bg-amber-50 border border-amber-300 flex items-start gap-2 text-xs text-[#92400E]">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Atenção ao vencimento original ({formatShortDatePT(evaluatedTarget.entry.dueDate)}):</strong>{' '}
                  pagar compromissos confirmados após o vencimento pode gerar multas, juros
                  moratórios ou corte de serviço. Esta simulação não recomenda atrasar
                  contas; serve apenas para visualizar cenários de caixa.
                </div>
              </div>
            )}

            {/* Status de Pagamento e Classificação (Confirmado vs Estimado vs Incerto) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#091521] mb-1">
                  Status do pagamento
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as EntryStatus)}
                  className="w-full px-3 py-2 rounded-[6px] border border-[#B8C5D1] bg-white text-[#091521] text-xs font-medium min-h-[40px]"
                >
                  <option value="pending">Pendente (Desconta na projeção)</option>
                  <option value="paid_other_bank">
                    Pago por outro banco (Não desconta aqui)
                  </option>
                  <option value="paid_here">
                    Já quitado nesta conta (Já saiu do saldo)
                  </option>
                  <option value="cancelled">Ignorar / Cancelado na simulação</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#091521] mb-1">
                  Grau de certeza
                </label>
                <select
                  value={certainty}
                  onChange={(e) => setCertainty(e.target.value as CertaintyLevel)}
                  className="w-full px-3 py-2 rounded-[6px] border border-[#B8C5D1] bg-white text-[#091521] text-xs font-medium min-h-[40px]"
                >
                  <option value="confirmed">Confirmado (Valor/data fixos)</option>
                  <option value="estimated">Estimado (Despesa/renda variável)</option>
                  {type === 'inflow' && (
                    <option value="uncertain">
                      Recebimento Incerto / Sem garantia de data
                    </option>
                  )}
                </select>
              </div>
            </div>

            {/* Origem do Compromisso & Afeta Conta Monitorada */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <label className="block text-xs font-bold text-[#091521] mb-1">
                  Origem da informação
                </label>
                <select
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value as EntryOrigin)}
                  className="w-full px-3 py-2 rounded-[6px] border border-[#B8C5D1] bg-white text-[#091521] text-xs font-medium min-h-[40px]"
                >
                  <option value="dda">DDA (Boleto Registrado)</option>
                  <option value="debito_automatico">Débito Automático</option>
                  <option value="pix_agendado">Pix Agendado</option>
                  <option value="recorrente_historico">Recorrente / Histórico</option>
                  <option value="folha_pagamento">Folha de Pagamento</option>
                  <option value="manual">Lançamento Manual</option>
                </select>
              </div>

              <label className="flex items-center gap-2.5 pt-4 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={affectsMonitoredAccount}
                  onChange={(e) => setAffectsMonitoredAccount(e.target.checked)}
                  className="w-4 h-4 accent-[#0052CC] rounded"
                />
                <span className="text-xs font-medium text-[#091521]">
                  Afeta o saldo desta conta monitorada
                </span>
              </label>
            </div>

            {/* Botões de Ação no Rodapé do Modal/Bottom Sheet */}
            <div className="pt-3 border-t border-[#DCE3EA] flex flex-wrap items-center justify-between gap-2">
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
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[6px] bg-slate-100 hover:bg-slate-200 text-[#091521] text-xs font-semibold min-h-[40px] cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restaurar item</span>
                    </button>
                  )}

                {isAddedByUser && evaluatedTarget && (
                  <button
                    type="button"
                    onClick={() => {
                      removeSimulatedEntry(evaluatedTarget.entry.id);
                      handleClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[6px] bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold min-h-[40px] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remover item</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3.5 py-2 rounded-[6px] border border-[#B8C5D1] text-[#475869] hover:text-[#091521] text-xs font-semibold min-h-[40px] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-[6px] bg-[#0052CC] hover:bg-[#0043A6] text-white text-xs font-bold min-h-[40px] cursor-pointer"
                >
                  {isCreatingNew ? 'Adicionar à Simulação' : 'Aplicar Simulação'}
                </button>
              </div>
            </div>
          </form>
        </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
