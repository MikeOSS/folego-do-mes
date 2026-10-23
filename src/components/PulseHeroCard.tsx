import React, { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Edit3,
  HelpCircle,
  Lock,
  PlusCircle,
  RotateCcw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useFinancialStore } from '../state/useFinancialStore';
import { AlertStatus } from '../domain/types';
import { formatBRL, parseBRLInputToCents } from '../domain/money';
import { formatShortDatePT } from '../domain/date';
import { CurrencyDisplay } from './CurrencyDisplay';

const STATUS_CONFIG: Record<
  AlertStatus,
  {
    eyebrow: string;
    badgeBg: string;
    badgeBorder: string;
    badgeText: string;
    accentBar: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  NO_SHORTFALL_IDENTIFIED: {
    eyebrow: 'SEM INSUFICIÊNCIA IDENTIFICADA',
    badgeBg: 'bg-[#052E22]',
    badgeBorder: 'border-[#00E58F]/40',
    badgeText: 'text-[#00E58F]',
    accentBar: 'bg-[#00E58F]',
    Icon: CheckCircle2,
  },
  CONDITIONAL_WARNING: {
    eyebrow: 'AVISO CONDICIONAL • ATENÇÃO ÀS VARIÁVEIS',
    badgeBg: 'bg-[#3B2106]',
    badgeBorder: 'border-amber-400/50',
    badgeText: 'text-amber-300',
    accentBar: 'bg-amber-400',
    Icon: AlertTriangle,
  },
  PREVENTIVE_ALERT: {
    eyebrow: 'ALERTA PREVENTIVO • DÉFICIT PROJETADO',
    badgeBg: 'bg-[#3B0D11]',
    badgeBorder: 'border-rose-400/50',
    badgeText: 'text-rose-300',
    accentBar: 'bg-rose-500',
    Icon: AlertOctagon,
  },
  INSUFFICIENT_DATA: {
    eyebrow: 'INFORMAÇÕES INSUFICIENTES',
    badgeBg: 'bg-slate-800',
    badgeBorder: 'border-slate-500/50',
    badgeText: 'text-slate-300',
    accentBar: 'bg-slate-400',
    Icon: HelpCircle,
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

  const { alertStatus, headline, explanation, metrics, actionableHints } =
    activeProjection;
  const cfg = STATUS_CONFIG[alertStatus];
  const StatusIcon = cfg.Icon;

  const handleOpenBalanceEdit = () => {
    const current = effectiveSnapshot.availableBalanceCents;
    setBalanceInput(
      current !== null ? (current / 100).toFixed(2).replace('.', ',') : '1500,00'
    );
    setEditingBalance(true);
  };

  const handleSaveBalance = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseBRLInputToCents(balanceInput);
    if (parsed !== null) {
      setBalanceOverride(parsed, true);
      setEditingBalance(false);
    }
  };

  return (
    <section
      aria-label="Resumo executivo do Fôlego do Mês"
      className="abyssal-card rounded-[12px] text-white overflow-hidden relative"
    >
      {/* Barra superior cromática semântica de 3px */}
      <div className={`h-1 w-full ${cfg.accentBar} transition-colors duration-300`} />

      <div className="p-4 sm:p-6 space-y-5">
        {/* Linha 1: Conta Monitorada + Badge Semântico de Diagnóstico */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00E58F]" />
            <span className="text-xs font-medium text-slate-300">
              {effectiveSnapshot.accountLabel}
            </span>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] border text-[11px] font-mono-tabular font-bold tracking-wider uppercase ${cfg.badgeBg} ${cfg.badgeBorder} ${cfg.badgeText}`}
          >
            <StatusIcon className="w-3.5 h-3.5 shrink-0" />
            <span>{cfg.eyebrow}</span>
          </div>
        </div>

        {/* Banner de Simulação Ativa (Ghost Comparison Antes vs. Depois) */}
        {simulationDelta.hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-[8px] bg-indigo-950/80 border border-indigo-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-200 uppercase tracking-wider font-mono-tabular">
                <Sparkles className="w-3.5 h-3.5 text-[#00E58F]" />
                <span>
                  Simulação Ativa ({simulationDelta.modifiedEntriesCount} ajuste(s)
                  {simulationDelta.addedEntriesCount > 0
                    ? ` + ${simulationDelta.addedEntriesCount} novo(s)`
                    : ''}
                  )
                </span>
              </div>
              <p className="text-xs text-slate-200">
                {simulationDelta.shortfallEliminated ? (
                  <span>
                    Você <strong className="text-[#00E58F]">eliminou o déficit</strong> que
                    ocorreria em{' '}
                    {formatShortDatePT(baselineProjection.metrics.firstShortfallDate!)}!
                  </span>
                ) : simulationDelta.lowestBalanceGainCents > 0 ? (
                  <span>
                    Sua simulação melhorou o menor saldo do mês em{' '}
                    <strong className="text-[#00E58F]">
                      +{formatBRL(simulationDelta.lowestBalanceGainCents)}
                    </strong>
                    .
                  </span>
                ) : (
                  <span>
                    Apenas simulação: nenhum pagamento ou agendamento bancário real foi
                    alterado.
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={resetAllSimulations}
              className="self-start sm:self-center inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[5px] bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shrink-0 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Voltar ao Real</span>
            </button>
          </motion.div>
        )}

        {/* Linha 2: Manchete de Diagnóstico em 3 Segundos (aria-live para acessibilidade) */}
        <motion.div
          key={`${activeScenario.id}-${alertStatus}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          aria-live="polite"
          aria-atomic="true"
          className="space-y-2"
        >
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white leading-snug">
            {headline}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {explanation}
          </p>
        </motion.div>

        {/* Estado Especial: Destravar quando Informações Insuficientes */}
        {alertStatus === 'INSUFFICIENT_DATA' && !editingBalance && (
          <div className="p-3.5 rounded-[8px] bg-[#0C2538] border border-amber-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-200 space-y-0.5">
              <p className="font-semibold text-amber-300">
                Deseja simular o fôlego desta conta agora?
              </p>
              <p className="text-slate-300">
                Informe um saldo livre hipotético para calcular a cobertura dos{' '}
                {activeScenario.entries.length} compromissos listados.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenBalanceEdit}
              className="px-3.5 py-2 rounded-[6px] bg-[#00E58F] hover:bg-[#19F0A0] text-[#04101A] font-bold text-xs shrink-0 transition-colors cursor-pointer min-h-[40px]"
            >
              Informar Saldo Livre
            </button>
          </div>
        )}

        {/* Linha 3: Tríade de KPIs em Células Técnicas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Célula 1: Saldo Livre Hoje */}
          <div className="abyssal-cell rounded-[8px] p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Saldo Livre Hoje
              </span>
              <button
                type="button"
                onClick={handleOpenBalanceEdit}
                className="inline-flex items-center gap-1 text-[11px] text-[#00E58F] hover:underline font-medium cursor-pointer"
                title="Simular outro saldo disponível"
              >
                <Edit3 className="w-3 h-3" />
                <span>Simular</span>
              </button>
            </div>

            {editingBalance ? (
              <form onSubmit={handleSaveBalance} className="mt-1 space-y-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono-tabular text-slate-400">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={balanceInput}
                    onChange={(e) => setBalanceInput(e.target.value)}
                    className="w-full px-2 py-1 rounded-[5px] bg-[#061826] border border-[#00E58F] text-white font-mono-tabular text-sm focus:outline-none"
                    placeholder="1.420,00"
                    autoFocus
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="submit"
                    className="px-2.5 py-1 rounded-[4px] bg-[#00E58F] text-[#061826] text-xs font-bold cursor-pointer"
                  >
                    Aplicar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingBalance(false)}
                    className="px-2 py-1 rounded-[4px] bg-slate-800 text-slate-300 text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {effectiveSnapshot.availableBalanceCents !== null ? (
                    <CurrencyDisplay cents={effectiveSnapshot.availableBalanceCents} />
                  ) : (
                    <span className="font-mono-tabular text-slate-400 text-base">
                      Não sincronizado
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-400">
                  <Lock className="w-3 h-3 text-[#00E58F] shrink-0" />
                  <span className="truncate">
                    Sem contar {formatBRL(effectiveSnapshot.overdraftLimitCents)} de limite
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Célula 2: Menor Saldo Projetado (Vale de Liquidez) */}
          <div className="abyssal-cell rounded-[8px] p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Menor Saldo (30d)
              </span>
              <span className="font-mono-tabular text-[11px] text-slate-300">
                {alertStatus !== 'INSUFFICIENT_DATA'
                  ? formatShortDatePT(metrics.lowestProjectedBalanceDate)
                  : '--'}
              </span>
            </div>

            {alertStatus === 'INSUFFICIENT_DATA' ? (
              <div className="text-base font-mono-tabular text-slate-400 py-1">
                Aguardando dados
              </div>
            ) : (
              <>
                <div
                  className={`text-xl sm:text-2xl font-bold tracking-tight ${
                    metrics.lowestProjectedBalanceCents < 0
                      ? 'text-rose-400'
                      : 'text-[#00E58F]'
                  }`}
                >
                  <CurrencyDisplay
                    cents={metrics.lowestProjectedBalanceCents}
                    showPlusSign={metrics.lowestProjectedBalanceCents > 0}
                  />
                </div>
                <div className="mt-1.5 text-[11px] text-slate-300 flex items-center justify-between gap-1">
                  {simulationDelta.hasChanges &&
                  baselineProjection.metrics.lowestProjectedBalanceCents !==
                    metrics.lowestProjectedBalanceCents ? (
                    <span className="text-indigo-300 font-mono-tabular truncate">
                      Antes:{' '}
                      <span className="line-through opacity-75">
                        {formatBRL(baselineProjection.metrics.lowestProjectedBalanceCents)}
                      </span>
                    </span>
                  ) : metrics.firstShortfallDate ? (
                    <span className="text-rose-300 truncate">
                      1ª falta em {formatShortDatePT(metrics.firstShortfallDate)} (
                      {metrics.daysUntilShortfall === 0
                        ? 'hoje'
                        : `daqui a ${metrics.daysUntilShortfall}d`}
                      )
                    </span>
                  ) : (
                    <span className="text-slate-400 truncate">
                      Firme: {formatBRL(metrics.lowestConfirmedBalanceCents)}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Célula 3: Próximo Recebimento Esperado */}
          <div className="abyssal-cell rounded-[8px] p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Próximo Recebimento
              </span>
              {metrics.nextExpectedInflow && (
                <span className="font-mono-tabular text-[11px] text-[#00E58F]">
                  {formatShortDatePT(metrics.nextExpectedInflow.entry.effectiveDate)}
                </span>
              )}
            </div>

            {metrics.nextExpectedInflow ? (
              <>
                <div className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  <CurrencyDisplay
                    cents={metrics.nextExpectedInflow.entry.amountCents}
                    showPlusSign
                  />
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-300 truncate">
                  <TrendingUp className="w-3 h-3 text-[#00E58F] shrink-0" />
                  <span className="truncate">
                    {metrics.nextExpectedInflow.entry.title} (em{' '}
                    {metrics.nextExpectedInflow.daysUntil}d)
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="text-base font-mono-tabular text-slate-400 py-1">
                  Nenhum previsto
                </div>
                <div className="mt-1.5 text-[11px] text-slate-400 flex items-center gap-1">
                  <CalendarClock className="w-3 h-3 shrink-0" />
                  <span>Sem entradas mapeadas</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Barra de Resumo de Fluxos & Botão de Simular Novo Compromisso */}
        {alertStatus !== 'INSUFFICIENT_DATA' && (
          <div className="pt-3 border-t border-[#163A54] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-300">
              <span>
                Saídas confirmadas:{' '}
                <strong className="font-mono-tabular text-white">
                  -{formatBRL(metrics.totalConfirmedOutflowsCents)}
                </strong>
              </span>
              {metrics.totalEstimatedOutflowsCents > 0 && (
                <span>
                  Estimadas:{' '}
                  <strong className="font-mono-tabular text-amber-300">
                    -{formatBRL(metrics.totalEstimatedOutflowsCents)}
                  </strong>
                </span>
              )}
              {metrics.totalUncertainInflowsCents > 0 && (
                <span>
                  Recebimento incerto:{' '}
                  <strong className="font-mono-tabular text-amber-300">
                    +{formatBRL(metrics.totalUncertainInflowsCents)}
                  </strong>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onOpenNewEntryModal}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-[6px] bg-[#0F2E46] hover:bg-[#163F5E] border border-[#235378] text-[#00E58F] font-semibold text-xs transition-colors min-h-[38px] cursor-pointer shrink-0"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Simular gasto ou entrada</span>
            </button>
          </div>
        )}

        {/* Dicas Determinísticas Acionáveis */}
        {actionableHints.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {actionableHints.map((hint, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs text-slate-300 bg-[#081E30] border border-[#14354D] rounded-[6px] px-3 py-2"
              >
                <span className="text-[#00E58F] font-bold">›</span>
                <span>{hint}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
