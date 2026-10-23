import React, { useEffect, useId, useState } from 'react';
import { Plus, RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { useFinancialStore } from '../state/useFinancialStore';
import { AlertStatus } from '../domain/types';
import { formatBRL } from '../domain/money';
import { validateMoneyInput } from '../lib/financial-input';
import { formatShortDatePT } from '../domain/date';
import { CurrencyDisplay } from './CurrencyDisplay';
import { SourceNote } from './ui/SourceNote';

const STATUS_PILL_CONFIG: Record<
  AlertStatus,
  {
    label: string;
    dotClass: string;
    pillClass: string;
  }
> = {
  NO_SHORTFALL_IDENTIFIED: {
    label: 'Fôlego positivo nos próximos 30 dias',
    dotClass: 'bg-[#2fc750]',
    pillClass: 'bg-[#2fc750]/12 text-[#168030] border-[#2fc750]/28',
  },
  CONDITIONAL_WARNING: {
    label: 'Aviso condicional · atenção às variáveis',
    dotClass: 'bg-[#e8a020]',
    pillClass: 'bg-[#e8a020]/12 text-warning-ink border-[#e8a020]/30',
  },
  PREVENTIVE_ALERT: {
    label: 'Alerta preventivo · saldo insuficiente antes do recebimento',
    dotClass: 'bg-[#e04545]',
    pillClass: 'bg-[#e04545]/10 text-danger border-[#e04545]/25',
  },
  INSUFFICIENT_DATA: {
    label: 'Informações insuficientes para conclusão segura',
    dotClass: 'bg-slate-400',
    pillClass: 'bg-slate-100 text-slate-600 border-slate-200',
  },
};

interface PulseHeroCardProps {
  onOpenNewEntryModal: () => void;
}

export const PulseHeroCard: React.FC<PulseHeroCardProps> = ({
  onOpenNewEntryModal,
}) => {
  const {
    activeScenario,
    effectiveSnapshot,
    activeProjection,
    baselineProjection,
    simulationDelta,
    setBalanceOverride,
    resetAllSimulations,
  } = useFinancialStore();

  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState('');
  const balanceId = useId();
  const [balanceError, setBalanceError] = useState<string | null>(null);
  useEffect(() => { setEditingBalance(false); setBalanceError(null); }, [activeScenario.id]);

  const { alertStatus, headline, explanation, metrics, actionableHints } =
    activeProjection;
  const pill = STATUS_PILL_CONFIG[alertStatus];

  const handleOpenBalanceEdit = () => {
    setBalanceError(null);
    const current = effectiveSnapshot.availableBalanceCents;
    setBalanceInput(
      current !== null ? (current / 100).toFixed(2).replace('.', ',') : '1500,00'
    );
    setEditingBalance(true);
  };

  const handleSaveBalance = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = validateMoneyInput(balanceInput);
    if (parsed !== null) {
      setBalanceOverride(parsed, true);
      setEditingBalance(false);
      setBalanceError(null);
    } else {
      setBalanceError('Informe um saldo válido em reais, com até duas casas decimais e até R$ 100 milhões em módulo. Exemplo: 1.500,00.');
    }
  };

  const isLowestNegative = metrics.lowestProjectedBalanceCents < 0;

  return (
    <section
      aria-label="Resumo executivo do Fôlego do Mês"
      className="surface-raised p-6 sm:p-7 space-y-6"
    >
      {/* Topo: Pílula de Estado Semântico + Identificação da Conta */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold ${pill.pillClass}`}
        >
          <span className={`w-2 h-2 rounded-full ${pill.dotClass}`} />
          <span>{pill.label}</span>
        </span>

        <span className="text-xs text-muted">
          {effectiveSnapshot.accountLabel}
        </span>
      </div>

      <SourceNote referenceDate={effectiveSnapshot.referenceDate} />

      {/* Feedback de Simulação Ativa (Limpo, sem caixas escuras nem ícones clichês) */}
      {simulationDelta.hasChanges && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 rounded-[12px] bg-[rgba(0,100,253,0.06)] border border-[rgba(0,100,253,0.22)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="text-xs text-[#151a28] space-y-0.5">
            <p className="font-semibold text-brand">
              Modo simulação ativo ({simulationDelta.modifiedEntriesCount} ajuste(s)
              {simulationDelta.addedEntriesCount > 0
                ? ` + ${simulationDelta.addedEntriesCount} novo(s)`
                : ''}
              )
            </p>
            <p className="text-muted">
              {baselineProjection.alertStatus === 'INSUFFICIENT_DATA' ? (
                <span>Projeção iniciada com o saldo informado. A base original não tinha dados suficientes para comparação.</span>
              ) : simulationDelta.shortfallEliminated ? (
                <span>
                  O déficit que ocorreria em{' '}
                  <strong>
                    {formatShortDatePT(baselineProjection.metrics.firstShortfallDate!)}
                  </strong>{' '}
                  foi <strong className="text-[#168030]">eliminado</strong> nesta simulação.
                </span>
              ) : simulationDelta.lowestBalanceGainCents > 0 ? (
                <span>
                  Seu menor saldo projetado subiu{' '}
                  <strong className="text-[#168030]">
                    +{formatBRL(simulationDelta.lowestBalanceGainCents)}
                  </strong>
                  .
                </span>
              ) : simulationDelta.lowestBalanceGainCents < 0 ? (
                <span>Seu menor saldo projetado caiu {formatBRL(Math.abs(simulationDelta.lowestBalanceGainCents))} em relação à base. Compare as contas antes de decidir.</span>
              ) : (
                <span>
                  Simular não altera agendamentos reais no banco.
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={resetAllSimulations}
            className="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-[#f0f2f7] border border-[rgba(0,100,253,0.24)] text-xs font-semibold text-brand shrink-0 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restaurar original</span>
          </button>
        </motion.div>
      )}

      {/* Destaque Numérico Monumental (Hierarquia Editorial Sem Caixas Aninhadas) */}
      {alertStatus === 'INSUFFICIENT_DATA' ? (
        <div className="py-4 border-y border-[rgba(21,26,40,0.08)] space-y-3">
          <div className="label-caps">Saldo disponível não sincronizado</div>
          <p className="text-sm text-muted leading-relaxed">
            Para evitar falsos alertas de segurança, não emitimos previsão sem confirmar o
            saldo livre da conta.
          </p>
          {!editingBalance ? (
            <button
              type="button"
              onClick={handleOpenBalanceEdit}
              className="px-4 py-2 rounded-full bg-[#0064fd] hover:bg-[#0052d6] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Informar saldo e simular projeção
            </button>
          ) : null}
        </div>
      ) : (
        <div className="py-5 border-y border-[rgba(21,26,40,0.08)] grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Coluna 1: Menor Saldo Projetado (O Número Monumental) */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="label-caps">
                {isLowestNegative ? 'Maior falta projetada' : 'Menor saldo em 30 dias'}
              </span>
              <span className="text-xs font-medium text-muted">
                em {formatShortDatePT(metrics.lowestProjectedBalanceDate)}
              </span>
            </div>

            <div
              className={`text-3xl sm:text-4xl font-bold tracking-tight leading-none ${
                isLowestNegative ? 'text-danger' : 'text-brand'
              }`}
            >
              <CurrencyDisplay
                cents={metrics.lowestProjectedBalanceCents}
                showPlusSign={metrics.lowestProjectedBalanceCents > 0}
              />
            </div>

            <div className="mt-2 text-xs text-muted">
              {simulationDelta.hasChanges &&
              baselineProjection.alertStatus !== 'INSUFFICIENT_DATA' &&
              baselineProjection.metrics.lowestProjectedBalanceCents !==
                metrics.lowestProjectedBalanceCents ? (
                <span>
                  Antes da simulação:{' '}
                  <span className="line-through text-muted">
                    {formatBRL(baselineProjection.metrics.lowestProjectedBalanceCents)}
                  </span>
                </span>
              ) : metrics.firstShortfallDate ? (
                <span className="text-danger font-medium">
                  1ª insuficiência em {formatShortDatePT(metrics.firstShortfallDate)} (
                  {metrics.daysUntilShortfall === 0
                    ? 'hoje'
                    : `daqui a ${metrics.daysUntilShortfall} dias`}
                  )
                </span>
              ) : (
                <span>
                  Saldo só c/ confirmados: {formatBRL(metrics.lowestConfirmedBalanceCents)}
                </span>
              )}
            </div>
          </div>

          {/* Coluna 2: Saldo Livre Hoje */}
          <div className="sm:border-l sm:border-[rgba(21,26,40,0.08)] sm:pl-6">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="label-caps">Saldo livre hoje</span>
              <button
                type="button"
                onClick={handleOpenBalanceEdit}
                className="text-xs font-semibold text-brand hover:underline cursor-pointer"
              >
                Alterar saldo
              </button>
            </div>

            {editingBalance ? (
              <form onSubmit={handleSaveBalance} className="space-y-2 mt-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted">R$</span>
                  <input
                    id={balanceId}
                    aria-label="Saldo disponível para simular (R$)"
                    aria-invalid={Boolean(balanceError)}
                    aria-describedby={balanceError ? `${balanceId}-error` : undefined}
                    type="text"
                    inputMode="decimal"
                    value={balanceInput}
                    onChange={(e) => setBalanceInput(e.target.value)}
                    className="w-full px-2.5 py-1 rounded-lg bg-[#f8f9fc] border border-[#0064fd] text-[#151a28] font-tabular text-sm font-semibold focus:outline-none"
                    autoFocus
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="submit"
                    className="px-3 py-1 rounded-full bg-[#0064fd] text-white text-xs font-semibold cursor-pointer"
                  >
                    Aplicar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingBalance(false); setBalanceError(null); }}
                    className="px-2.5 py-1 rounded-full bg-[#f0f2f7] text-muted text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="text-2xl sm:text-3xl font-bold text-[#151a28] tracking-tight leading-none">
                  {effectiveSnapshot.availableBalanceCents !== null ? (
                    <CurrencyDisplay cents={effectiveSnapshot.availableBalanceCents} />
                  ) : (
                    <span>—</span>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted">
                  Exclui {formatBRL(effectiveSnapshot.overdraftLimitCents)} de limite da conta
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Formulário quando INSUFFICIENT_DATA e clicou em editar */}
      {alertStatus === 'INSUFFICIENT_DATA' && editingBalance && (
        <form
          onSubmit={handleSaveBalance}
          className="p-4 rounded-[12px] bg-[#f8f9fc] border border-[rgba(0,100,253,0.25)] space-y-3"
        >
          <label htmlFor={balanceId} className="block text-xs font-semibold text-[#151a28]">
            Informe o saldo disponível para simular (R$)
          </label>
          <div className="flex items-center gap-2">
            <input
              id={balanceId}
              aria-invalid={Boolean(balanceError)}
              aria-describedby={balanceError ? `${balanceId}-error` : undefined}
              type="text"
              inputMode="decimal"
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-white border border-[rgba(21,26,40,0.16)] text-sm font-tabular font-semibold"
              autoFocus
            />
            <button
              type="submit"
              className="px-4 py-1.5 rounded-full bg-[#0064fd] text-white text-xs font-semibold shrink-0 cursor-pointer"
            >
              Calcular fôlego
            </button>
          </div>
        </form>
      )}

      {/* Diagnóstico Humano e Direto */}
      {balanceError && <p id={`${balanceId}-error`} role="alert" className="text-sm text-danger">{balanceError}</p>}
      <motion.div
        key={`${activeScenario.id}-${alertStatus}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        aria-live="polite"
        aria-atomic="true"
        className="space-y-2"
      >
        <h1 className="text-2xl sm:text-[28px] font-semibold text-[#151a28] leading-snug">
          {headline}
        </h1>
        <p className="text-sm text-muted leading-relaxed">
          {explanation}
        </p>
      </motion.div>

      {/* Linha de Apoio: Próximo Recebimento & Total de Saídas */}
      {alertStatus !== 'INSUFFICIENT_DATA' && (
        <div className="pt-4 border-t border-[rgba(21,26,40,0.08)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1 text-xs text-muted">
            {metrics.nextExpectedInflow ? (
              <div>
                Próxima entrada:{' '}
                <strong className="text-[#168030] font-tabular">
                  +{formatBRL(metrics.nextExpectedInflow.entry.amountCents)}
                </strong>{' '}
                em {formatShortDatePT(metrics.nextExpectedInflow.entry.effectiveDate)} (
                {metrics.nextExpectedInflow.entry.title})
              </div>
            ) : (
              <div>Nenhuma entrada prevista nos próximos 30 dias</div>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                Contas confirmadas:{' '}
                <strong className="text-[#151a28] font-tabular">
                  −{formatBRL(metrics.totalConfirmedOutflowsCents)}
                </strong>
              </span>
              {metrics.totalEstimatedOutflowsCents > 0 && (
                <span>
                  Recorrências estimadas:{' '}
                  <strong className="text-warning-ink font-tabular">
                    −{formatBRL(metrics.totalEstimatedOutflowsCents)}
                  </strong>
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenNewEntryModal}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full bg-[rgba(0,100,253,0.08)] hover:bg-[rgba(0,100,253,0.14)] border border-[rgba(0,100,253,0.22)] text-brand text-xs font-semibold transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Simular lançamento</span>
          </button>
        </div>
      )}

      {/* Nota Editorial de Ação */}
      {actionableHints.length > 0 && (
        <div className="rounded-[12px] bg-[#f8f9fc] border border-[rgba(21,26,40,0.07)] p-3.5 space-y-1.5">
          {actionableHints.map((hint, idx) => (
            <p
              key={idx}
              className="text-xs text-muted leading-relaxed flex items-start gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#0064fd] mt-1.5 shrink-0" />
              <span>{hint}</span>
            </p>
          ))}
        </div>
      )}
    </section>
  );
};
